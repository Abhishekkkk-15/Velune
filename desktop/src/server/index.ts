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
import { ensureAudioCached, clearStreamCache, getCacheStats } from './streams'
import {
  startDownload, isDownloaded, getDownloadPath, getDownloadStatus,
  getAllDownloadedIds, getDownloadStats, deleteDownload, clearAllDownloads,
} from './downloads'
import { fetchLyrics } from './lyrics'
import { lastfmScrobble, lastfmNowPlaying } from './lastfm'
import { setDiscordActivity, clearDiscordActivity } from './discord'

const app = express()
const PORT = 3001
const LOCALHOST_ORIGINS = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || LOCALHOST_ORIGINS.test(origin)) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))
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

    res.json({ url: `/api/stream/proxy/${id}`, offline: false })
  } catch (e: any) {
    console.error(`[API ERROR /api/stream] Video ID: ${req.query.videoId}`, e)
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/stream/proxy/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params
    // Ensure we have a pure audio .m4a cached (extracted from muxed Itag 18)
    const audioPath = await ensureAudioCached(videoId)
    // Express's sendFile handles Range requests, 206 Partial Content, and Content-Type automatically
    res.setHeader('Content-Type', 'audio/mp4')
    res.sendFile(audioPath)
  } catch (e: any) {
    console.error(`[Proxy Error]`, e)
    if (!res.headersSent) {
      res.status(500).json({ error: e.message })
    }
  }
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
