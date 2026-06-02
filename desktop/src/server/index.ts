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
import { ensureAudioCached, resolveStreamUrl, resolveStreamInfo, streamAudio, invalidateStreamCache, clearStreamCache, getCacheStats, enforceCacheLimit, resolveYtDlpUrl, invalidateYtDlpCache, spawnFfmpegHlsStream, spawnFfmpegDashStream, getAudioCachePath } from './streams'
import {
  startDownload, isDownloaded, getDownloadPath, getDownloadStatus,
  getAllDownloadedIds, getDownloadStats, deleteDownload, clearAllDownloads,
} from './downloads'
import { fetchLyrics } from './lyrics'
import { lastfmScrobble, lastfmNowPlaying } from './lastfm'
import { setDiscordActivity, clearDiscordActivity } from './discord'
import { fetchSpotifyPlaylist } from './spotify'

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

app.post('/api/import/spotify', async (req, res) => {
  try {
    const { url, clientId, clientSecret } = req.body
    if (!url) return res.status(400).json({ error: 'url required' })

    const playlist = await fetchSpotifyPlaylist(url, clientId, clientSecret)
    
    // Resolve Spotify tracks to YouTube videos
    const matchedTracks = []
    for (const track of playlist.tracks) {
      const query = `${track.name} ${track.artist}`
      try {
        const searchResults = await yt.search(query, 'song')
        if (searchResults && searchResults.items && searchResults.items.length > 0) {
          
          let bestMatch = null
          
          // Smart Matching: Compare duration if available from Spotify
          if (track.durationMs) {
            const targetSeconds = track.durationMs / 1000
            let closestDiff = Infinity

            for (const item of searchResults.items) {
              if (item.type !== 'video' && item.type !== 'song') continue
              
              const itemSeconds = item.duration || 0
              const durationDiff = Math.abs(itemSeconds - targetSeconds)

              // If within a strict 3-second margin, it's a solid match
              if (durationDiff <= 3 && durationDiff < closestDiff) {
                closestDiff = durationDiff
                bestMatch = item
              }
            }
          }

          // Fallback: If no strict duration match, just pick the first valid song/video result.
          if (!bestMatch) {
            bestMatch = searchResults.items.find((item: any) => item.type === 'video' || item.type === 'song')
          }
          
          if (bestMatch) {
            matchedTracks.push(bestMatch)
          }
        }
      } catch (err) {
        console.warn(`[Spotify Import] Failed to find match for ${query}`, err)
      }
    }

    res.json({ title: playlist.title, tracks: matchedTracks })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// YouTube video IDs are exactly 11 chars (alphanumeric + _ + -).
// Channel IDs start with "UC" and are 24 chars. Playlist IDs start with
// PL/RD/OL etc. Reject non-video IDs immediately so we never call getInfo
// on a browse ID and waste 3 client retries.
function isVideoId(id: string): boolean {
  return /^[-_a-zA-Z0-9]{11}$/.test(id)
}

app.get('/api/stream', async (req, res) => {
  try {
    const id = String(req.query.videoId || '')
    if (!id) return res.status(400).json({ error: 'videoId required' })
    if (!isVideoId(id)) {
      console.warn(`[API /api/stream] rejected non-video ID: ${id}`)
      return res.status(404).json({ error: `Not a playable video ID: ${id}` })
    }

    if (isDownloaded(id)) {
      const stat = fs.statSync(getDownloadPath(id))
      return res.json({ url: `/api/offline/${id}`, offline: true, size: stat.size })
    }

    const cachedPath = getAudioCachePath(id)
    if (fs.existsSync(cachedPath)) {
      const stat = fs.statSync(cachedPath)
      return res.json({ url: `/api/cached/${id}`, offline: false, size: stat.size })
    }

    // Resolve yt-dlp URL eagerly to get the track duration. Results are cached
    // (5 min TTL) so after the first play, subsequent calls return instantly.
    // Duration is sent to the frontend so the player can display it immediately
    // even though the streaming MP3 has no Content-Length.
    let duration: number | undefined
    try {
      const resolved = await resolveYtDlpUrl(id)
      duration = resolved.duration
    } catch {
      // Warm the youtubei cache as fallback
      resolveStreamUrl(id).catch(() => { })
    }
    res.json({ url: `/api/stream/proxy/${id}`, offline: false, duration })
  } catch (e: any) {
    console.error(`[API ERROR /api/stream] Video ID: ${req.query.videoId}`, e)
    res.status(500).json({ error: e.message })
  }
})

// IOS client User-Agent — matches the client type used by resolveStreamUrl
const IOS_UA = 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X)'

app.get('/api/stream/proxy/:videoId', async (req, res) => {
  const { videoId } = req.params
  const rangeHeader = req.headers['range'] as string | undefined

  // ── Primary: yt-dlp + ffmpeg (HLS→MP3 or DASH→MP3, bypasses CDN restrictions) ──
  try {
    let { url: m3u8Url } = await resolveYtDlpUrl(videoId)

    // Detect DASH URLs (format 140/139): googlevideo.com URLs with clen= parameter.
    // DASH URLs require bounded Range requests — ffmpeg's full GET gets HTTP 403.
    // Use spawnFfmpegDashStream() which fetches in 480KB chunks from Node.js and
    // pipes to ffmpeg stdin, bypassing ffmpeg's HTTP stack entirely.
    const isDash = m3u8Url.includes('googlevideo.com') && /[?&]clen=\d+/.test(m3u8Url)
    const ffmpegProc = isDash ? spawnFfmpegDashStream(m3u8Url) : spawnFfmpegHlsStream(m3u8Url)

    // Give ffmpeg 3 s to start producing data; if stderr shows a fatal error
    // before stdout emits anything, fall through to the youtubei fallback.
    let started = false
    let ffmpegError = ''

    ffmpegProc.stderr!.on('data', (d: Buffer) => {
      const txt = d.toString()
      // Accumulate errors only — ffmpeg normally writes progress to stderr
      if (/error|invalid|failed|no such file/i.test(txt)) ffmpegError += txt
    })

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('ffmpeg start timeout')), 8000)
      ffmpegProc.stdout!.once('data', () => {
        clearTimeout(timeout)
        started = true
        resolve()
      })
      ffmpegProc.on('error', (e) => { clearTimeout(timeout); reject(e) })
      ffmpegProc.on('close', (code) => {
        clearTimeout(timeout)
        if (!started) reject(new Error(`ffmpeg exited ${code}: ${ffmpegError}`))
      })
    })

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    console.log(`[Proxy/yt-dlp+ffmpeg] ${videoId} → HLS→AAC stream started`)
    ffmpegProc.stdout!.pipe(res)
    req.on('close', () => ffmpegProc.kill('SIGKILL'))
    ffmpegProc.on('close', () => { if (!res.writableEnded) res.end() })
    return
  } catch (ytdlpErr: any) {
    console.warn(`[Proxy/yt-dlp] failed for ${videoId}: ${ytdlpErr.message} — trying youtubei fallback`)
    invalidateYtDlpCache(videoId)
  }

  // ── Fallback: youtubei.js streamAudio ─────────────────────────────────────
  try {
    invalidateStreamCache(videoId)

    let downloadRange: { start: number; end: number } | undefined
    if (rangeHeader) {
      const m = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (m && Number(m[1]) > 0) {
        downloadRange = { start: Number(m[1]), end: m[2] ? Number(m[2]) : 0 }
      }
    }

    const webStream = await streamAudio(videoId, downloadRange)
    const { Readable } = await import('stream')
    const nodeStream = Readable.fromWeb(webStream as any)
    res.setHeader('Content-Type', 'audio/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (rangeHeader) res.status(206)
    console.log(`[Proxy/youtubei] ${videoId} → streamAudio OK range:${rangeHeader || 'none'}`)
    nodeStream.pipe(res)
    req.on('close', () => nodeStream.destroy())
  } catch (e: any) {
    console.error(`[Proxy Error] ${videoId}:`, e.message)
    if (!res.headersSent) {
      const isUnavailable = /unavailable|not available|private|age.?restrict/i.test(e.message)
      res.status(isUnavailable ? 404 : 500).json({ error: e.message })
    }
  }
})

app.get('/api/stream/prefetch/:videoId', (req, res) => {
  const { videoId } = req.params
  const { maxCacheMB } = req.query
  ensureAudioCached(videoId).then(() => {
    if (maxCacheMB) {
      enforceCacheLimit(Number(maxCacheMB) * 1024 * 1024)
    }
  }).catch((e) => {
    console.warn(`[Prefetch] failed for ${videoId}: ${e.message}`)
  })
  res.json({ ok: true })
})

app.get('/api/cached/:videoId', (req, res) => {
  const p = getAudioCachePath(req.params.videoId)
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not cached' })
  res.setHeader('Content-Type', 'audio/mp4')
  res.sendFile(p)
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

    startDownload(videoId).catch(() => { })
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
app.post('/api/cache/clear', (req, res) => {
  clearStreamCache()
  res.json({ ok: true })
})

app.post('/api/cache/enforce', (req, res) => {
  const maxBytes = req.body.maxBytes
  if (typeof maxBytes === 'number') enforceCacheLimit(maxBytes)
  res.json({ ok: true })
})

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
