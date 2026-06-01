import fs from 'fs'
import os from 'os'
import path from 'path'

try {
  const logFile = path.join(os.homedir(), '.velune', 'server_crash.log')
  if (!fs.existsSync(path.dirname(logFile))) fs.mkdirSync(path.dirname(logFile), { recursive: true })
  fs.writeFileSync(logFile, `Server starting at ${new Date().toISOString()}\n`, { flag: 'a' })
  
  process.on('uncaughtException', (err) => {
    fs.writeFileSync(logFile, `[Uncaught] ${err.stack || err}\n`, { flag: 'a' })
  })
  process.on('unhandledRejection', (reason) => {
    fs.writeFileSync(logFile, `[Unhandled] ${reason}\n`, { flag: 'a' })
  })
} catch (e) {
  // Ignore
}

import express from 'express'
import cors from 'cors'
import { InnerTube } from './innertube'
import { ensureAudioCached, resolveStreamUrl, resolveStreamInfo, streamAudio, invalidateStreamCache, clearStreamCache, getCacheStats } from './streams'
import {
  startDownload, isDownloaded, getDownloadPath, getDownloadStatus,
  getAllDownloadedIds, getDownloadStats, deleteDownload, clearAllDownloads,
} from './downloads'
import { fetchLyrics } from './lyrics'
import { lastfmScrobble, lastfmNowPlaying } from './lastfm'
import { setDiscordActivity, clearDiscordActivity } from './discord'

const app = express()
const PORT = 3001

// API server is bound to 127.0.0.1 (loopback only) — not reachable from the
// internet. Allow any origin so the Vite proxy and Replit preview work.
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use((req, res, next) => {
  console.log(`[API ${req.method}] ${req.url}`)
  next()
})

const yt = new InnerTube()

app.get('/api/auth/status', async (req, res) => {
  try { res.json(await yt.getAuthStatus()) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.post('/api/auth/start', async (req, res) => {
  try { res.json(await yt.startAuth()) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.post('/api/auth/signout', async (req, res) => {
  try { await yt.signout(); res.json({ ok: true }) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.get('/api/home', async (req, res) => {
  try {
    const { historyIds } = req.query
    const ids = historyIds ? String(historyIds).split(',').filter(Boolean) : undefined
    res.json(await yt.getHomeFeed(ids))
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/search', async (req, res) => {
  try {
    const { q, filter } = req.query
    res.json(await yt.search(String(q || ''), filter ? String(filter) : undefined))
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.get('/api/search/suggestions', async (req, res) => {
  try {
    const { q } = req.query
    res.json(await yt.getSearchSuggestions(String(q || '')))
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.get('/api/artist/:id', async (req, res) => {
  try { res.json(await yt.getArtist(req.params.id)) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.get('/api/album/:id', async (req, res) => {
  try { res.json(await yt.getAlbum(req.params.id)) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.get('/api/playlist/:id', async (req, res) => {
  try { res.json(await yt.getPlaylist(req.params.id)) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.get('/api/next', async (req, res) => {
  try {
    const { videoId, playlistId } = req.query
    res.json(await yt.getNext(String(videoId || ''), playlistId ? String(playlistId) : undefined))
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.get('/api/stream', async (req, res) => {
  try {
    const id = String(req.query.videoId || '')
    if (!id) return res.status(400).json({ error: 'videoId required' })

    if (isDownloaded(id)) {
      const stat = fs.statSync(getDownloadPath(id))
      return res.json({ url: `/api/offline/${id}`, offline: true, size: stat.size })
    }

    // Return the direct CDN URL so the BROWSER fetches it using the user's IP.
    // Replit's server IP is blocked by YouTube CDN (403), but the user's browser
    // IP is not. The client audio element fetches CDN directly with crossOrigin
    // set to 'anonymous' — YouTube CDN returns Access-Control-Allow-Origin: *,
    // which satisfies MediaElementAudioSourceNode's CORS requirement.
    const { url } = await resolveStreamUrl(id)
    res.json({ url, offline: false })
  } catch (e: any) {
    console.error(`[API ERROR /api/stream] Video ID: ${req.query.videoId}`, e)
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/stream/proxy/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params

    // Parse Range header — browsers send this even for initial loads (bytes=0-)
    let rangeStart = 0
    let rangeEnd = 0
    let hasRange = false
    const rangeHeader = req.headers['range'] as string | undefined
    if (rangeHeader) {
      const m = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (m) {
        rangeStart = Number(m[1])
        rangeEnd = m[2] ? Number(m[2]) : 0  // 0 = open-ended ("to the end")
        hasRange = true
      }
    }

    // Resolve metadata (cached 5 min) — gives us Content-Length + MIME type.
    const { contentLength, mimeType } = await resolveStreamInfo(videoId)

    // Only restrict the download range when seeking beyond the start.
    // For bytes=0- (browser initial load) we must NOT pass range:{start:0,end:0}
    // to info.download() — youtubei.js turns that into &range=0-0 which fetches
    // exactly 1 byte, causing MEDIA_ELEMENT_ERROR: Format error in the browser.
    let downloadRange: { start: number; end: number } | undefined
    if (hasRange && rangeStart > 0) {
      const end = (rangeEnd > rangeStart) ? rangeEnd : (contentLength > 0 ? contentLength - 1 : 0)
      downloadRange = { start: rangeStart, end }
    }

    // Stream via youtubei.js info.download() — carries session auth internally.
    // Direct node-fetch of the CDN URL always 403s from Replit.
    const webStream = await streamAudio(videoId, downloadRange)

    const ct = mimeType.startsWith('audio/') ? mimeType : 'audio/mp4'
    res.setHeader('Content-Type', ct)
    res.setHeader('Accept-Ranges', 'bytes')

    const declaredLength = contentLength > 0 ? contentLength : 0
    if (hasRange && declaredLength > 0) {
      const end = (rangeEnd > 0 && rangeEnd > rangeStart) ? rangeEnd : declaredLength - 1
      res.setHeader('Content-Range', `bytes ${rangeStart}-${end}/${declaredLength}`)
      // Omit Content-Length — a mismatch between declared and actual bytes causes
      // the browser to truncate the stream and report MEDIA_ELEMENT_ERROR: Format error.
      // Chunked transfer encoding is safer for proxied streams.
      res.status(206)
    }
    // Do NOT set Content-Length for the body — use chunked transfer.
    // If Content-Length is wrong (even by 1 byte) the browser truncates or
    // stalls, producing a format error.  The audio element works fine without it.

    console.log(`[Proxy] ${videoId} Range:${rangeHeader||'none'} status:${hasRange?206:200} mime:${ct} declaredLen:${declaredLength}`)

    // Convert Web ReadableStream → Node.js Readable and pipe to the response
    const { Readable } = await import('stream')
    const nodeStream = Readable.fromWeb(webStream as any)
    let bytesSent = 0
    let firstChunkLogged = false
    nodeStream.on('data', (chunk: Buffer) => {
      bytesSent += chunk.length
      if (!firstChunkLogged) {
        firstChunkLogged = true
        // Log first 16 bytes as hex — valid MP4 starts with box-size(4) + 'ftyp'(4)
        const hex = chunk.slice(0, 16).toString('hex').match(/.{2}/g)?.join(' ')
        const ascii = chunk.slice(4, 12).toString('ascii').replace(/[^\x20-\x7e]/g, '.')
        console.log(`[Proxy] ${videoId} first bytes: ${hex} | ascii[4-12]: "${ascii}"`)
      }
    })
    nodeStream.on('end', () => console.log(`[Proxy] ${videoId} stream ended, bytesSent:${bytesSent} declaredLen:${declaredLength}`))
    nodeStream.on('error', (e) => console.error(`[Proxy] ${videoId} stream error:`, e.message))
    nodeStream.pipe(res)
    req.on('close', () => nodeStream.destroy())
  } catch (e: any) {
    console.error(`[Proxy Error]`, e)
    if (!res.headersSent) res.status(500).json({ error: e.message })
  }
})

app.get('/api/stream/prefetch/:videoId', (req, res) => {
  const { videoId } = req.params
  resolveStreamInfo(videoId).catch((e) => {
    console.warn(`[Prefetch] failed for ${videoId}: ${e.message}`)
  })
  res.json({ ok: true })
})

app.get('/api/offline/:videoId', (req, res) => {
  const p = getDownloadPath(req.params.videoId)
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not downloaded' })
  res.setHeader('Content-Type', 'audio/mp4')
  res.sendFile(p)
})

app.post('/api/download', async (req, res) => {
  try {
    const { videoId, maxCacheMB } = req.body
    if (!videoId) return res.status(400).json({ error: 'videoId required' })

    if (isDownloaded(videoId)) return res.json({ ok: true, status: 'done' })

    if (maxCacheMB) {
      const stats = getDownloadStats()
      if (stats.sizeBytes / (1024 * 1024) >= maxCacheMB) {
        return res.status(507).json({ error: 'Download cache full. Clear some downloads first.' })
      }
    }

    startDownload(videoId).catch(() => {})
    res.json({ ok: true, status: 'downloading' })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.get('/api/download/:videoId/status', (req, res) => {
  res.json({ status: getDownloadStatus(req.params.videoId) })
})

app.delete('/api/download/:videoId', (req, res) => {
  deleteDownload(req.params.videoId)
  res.json({ ok: true })
})

app.get('/api/downloads', (req, res) => {
  const ids = getAllDownloadedIds()
  const stats = getDownloadStats()
  res.json({ ids, ...stats })
})

app.post('/api/downloads/clear', (req, res) => {
  clearAllDownloads()
  res.json({ ok: true })
})

import nodeFetch from 'node-fetch'

app.get('/api/image', async (req, res) => {
  try {
    const { url } = req.query
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url param required' })
    const allowed = ['yt3.ggpht.com', 'lh3.googleusercontent.com', 'i.ytimg.com', 'ytimg.com', 'yt3.googleusercontent.com', 'googleusercontent.com']
    const parsed = new URL(url)
    if (!allowed.some(h => parsed.hostname.endsWith(h))) return res.status(403).json({ error: 'Disallowed host' })
    
    const imgRes = await nodeFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://music.youtube.com/' },
    })
    if (!imgRes.ok) return res.status(imgRes.status).end()
    
    res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.setHeader('Access-Control-Allow-Origin', '*')
    imgRes.body.pipe(res)
  } catch (e: any) { 
    console.error('[Image proxy error]', e)
    res.status(500).json({ error: e.message }) 
  }
})

app.get('/api/lyrics', async (req, res) => {
  try {
    const { title, artist, duration } = req.query
    res.json(await fetchLyrics(String(title || ''), String(artist || ''), duration ? Number(duration) : undefined))
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.post('/api/lastfm/now-playing', async (req, res) => {
  try {
    const { sessionKey, artist, track, album, duration, apiKey, apiSecret } = req.body
    await lastfmNowPlaying(sessionKey, artist, track, album, duration, apiKey, apiSecret)
    res.json({ ok: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.post('/api/lastfm/scrobble', async (req, res) => {
  try {
    const { sessionKey, artist, track, album, duration, timestamp, apiKey, apiSecret } = req.body
    await lastfmScrobble(sessionKey, artist, track, album, duration, timestamp, apiKey, apiSecret)
    res.json({ ok: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.post('/api/discord/activity', async (req, res) => {
  try {
    await setDiscordActivity(req.body)
    res.json({ ok: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.post('/api/discord/clear', async (req, res) => {
  try { await clearDiscordActivity(); res.json({ ok: true }) }
  catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.get('/api/cache/stats', (req, res) => { res.json(getCacheStats()) })
app.post('/api/cache/clear', (req, res) => { clearStreamCache(); res.json({ ok: true }) })

app.get('/api/moods', async (req, res) => {
  try { res.json(await yt.getMoodAndGenres()) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.get('/api/charts', async (req, res) => {
  try { res.json(await yt.getCharts()) } catch (e: any) { res.status(500).json({ error: e.message }) }
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Velune API server listening on 127.0.0.1:${PORT}`)
})

export default app
