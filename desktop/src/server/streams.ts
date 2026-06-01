import { Innertube, Platform } from 'youtubei.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'
import fetch from 'node-fetch'

Platform.shim.eval = async (data) => {
  return new Function(data.output)()
}

let youtubeInstance: Innertube | null = null

export async function getYoutube(): Promise<Innertube> {
  if (!youtubeInstance) {
    youtubeInstance = await Innertube.create()
  }
  return youtubeInstance
}

// ─── Stream URL Cache (URL-level, short TTL) ──────────────────────────────────
const MEM_CACHE = new Map<string, { url: string; expires: number }>()
const DISK_CACHE_DIR = path.join(os.homedir(), '.velune', 'cache', 'streams')
const DISK_CACHE_TTL_MS = 4 * 60 * 60 * 1000

function ensureCacheDir() {
  if (!fs.existsSync(DISK_CACHE_DIR)) {
    fs.mkdirSync(DISK_CACHE_DIR, { recursive: true })
  }
}

function getDiskCachePath(videoId: string) {
  return path.join(DISK_CACHE_DIR, `${videoId}.json`)
}

function readDiskCache(videoId: string): string | null {
  try {
    const p = getDiskCachePath(videoId)
    if (!fs.existsSync(p)) return null
    const { url, expires } = JSON.parse(fs.readFileSync(p, 'utf-8'))
    if (Date.now() > expires) {
      fs.unlinkSync(p)
      return null
    }
    return url
  } catch { return null }
}

function writeDiskCache(videoId: string, url: string) {
  try {
    ensureCacheDir()
    const expires = Date.now() + DISK_CACHE_TTL_MS
    fs.writeFileSync(getDiskCachePath(videoId), JSON.stringify({ url, expires }))
  } catch {}
}

export function getCacheDir(): string {
  ensureCacheDir()
  return DISK_CACHE_DIR
}

export function clearStreamCache(): void {
  try {
    if (fs.existsSync(DISK_CACHE_DIR)) {
      for (const f of fs.readdirSync(DISK_CACHE_DIR)) {
        fs.unlinkSync(path.join(DISK_CACHE_DIR, f))
      }
    }
    MEM_CACHE.clear()
  } catch {}
  // Also clear the audio cache
  clearAudioCache()
}

export function getCacheStats(): { count: number; sizeBytes: number } {
  try {
    ensureCacheDir()
    const files = fs.readdirSync(DISK_CACHE_DIR)
    const sizeBytes = files.reduce((acc, f) => {
      try { return acc + fs.statSync(path.join(DISK_CACHE_DIR, f)).size }
      catch { return acc }
    }, 0)
    return { count: files.length, sizeBytes }
  } catch { return { count: 0, sizeBytes: 0 } }
}

export async function resolveStreamUrl(videoId: string): Promise<string> {
  const now = Date.now()

  const memEntry = MEM_CACHE.get(videoId)
  if (memEntry && memEntry.expires > now) return memEntry.url

  const diskUrl = readDiskCache(videoId)
  if (diskUrl) {
    MEM_CACHE.set(videoId, { url: diskUrl, expires: now + 5 * 60 * 1000 })
    return diskUrl
  }

  try {
    const youtube = await getYoutube()
    const info = await youtube.getInfo(videoId, { client: 'ANDROID' })
    const format = info.chooseFormat({ itag: 18 })

    if (!format) throw new Error('Itag 18 format not found')

    const url = await format.decipher(youtube.session.player)
    if (!url) throw new Error('Failed to decipher format URL')

    MEM_CACHE.set(videoId, { url, expires: now + 5 * 60 * 1000 })
    writeDiskCache(videoId, url)
    return url
  } catch (err: any) {
    throw new Error(`Stream resolution failed for ${videoId}: ${err.message}`)
  }
}

// ─── Audio Cache (pure .m4a, long TTL) ────────────────────────────────────────
const AUDIO_CACHE_DIR = path.join(os.homedir(), '.velune', 'cache', 'audio')
// Map from videoId -> promise resolving to the cached .m4a path
const activeExtractions = new Map<string, Promise<string>>()

function ensureAudioCacheDir() {
  if (!fs.existsSync(AUDIO_CACHE_DIR)) {
    fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true })
  }
}

export function getAudioCachePath(videoId: string): string {
  return path.join(AUDIO_CACHE_DIR, `${videoId}.m4a`)
}

function clearAudioCache(): void {
  try {
    if (fs.existsSync(AUDIO_CACHE_DIR)) {
      for (const f of fs.readdirSync(AUDIO_CACHE_DIR)) {
        fs.unlinkSync(path.join(AUDIO_CACHE_DIR, f))
      }
    }
  } catch {}
}

/**
 * Ensures a pure audio .m4a file exists in the audio cache for the given videoId.
 * If not cached, downloads the muxed Itag 18 stream and losslessly extracts the
 * audio track via ffmpeg. Multiple concurrent callers for the same videoId will
 * share the same download promise.
 * Returns the absolute path to the cached .m4a file.
 */
export async function ensureAudioCached(videoId: string): Promise<string> {
  ensureAudioCacheDir()
  const audioPath = getAudioCachePath(videoId)

  // Already cached
  if (fs.existsSync(audioPath)) {
    return audioPath
  }

  // Deduplicate concurrent extraction requests for the same track
  const existing = activeExtractions.get(videoId)
  if (existing) return existing

  const extractionPromise = (async () => {
    const tmpMp4 = audioPath + '.tmp.mp4'
    const tmpM4a = audioPath + '.tmp.m4a'

    try {
      // 1. Resolve the muxed stream URL (Itag 18)
      const url = await resolveStreamUrl(videoId)

      // 2. Download the muxed mp4 to a temp file
      console.log(`[Audio Cache] Downloading muxed stream for ${videoId}...`)
      const res = await fetch(url, {
        headers: { 'Referer': 'https://www.youtube.com/' }
      })
      if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)

      await new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(tmpMp4)
        res.body.pipe(out)
        out.on('finish', resolve)
        out.on('error', reject)
        res.body.on('error', reject)
      })

      console.log(`[Audio Cache] Extracting audio for ${videoId}...`)

      // 3. Use ffmpeg to losslessly extract the audio track to .m4a
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-y',
          '-i', tmpMp4,
          '-vn',            // no video
          '-acodec', 'copy', // copy audio codec (lossless, instant)
          tmpM4a
        ])

        ffmpeg.stderr.on('data', () => {}) // suppress ffmpeg output
        ffmpeg.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`ffmpeg exited with code ${code}`))
        })
        ffmpeg.on('error', reject)
      })

      // 4. Atomic rename to final path
      fs.renameSync(tmpM4a, audioPath)
      console.log(`[Audio Cache] Cached audio for ${videoId} at ${audioPath}`)
      return audioPath
    } finally {
      // Clean up temp files
      try { if (fs.existsSync(tmpMp4)) fs.unlinkSync(tmpMp4) } catch {}
      try { if (fs.existsSync(tmpM4a)) fs.unlinkSync(tmpM4a) } catch {}
      activeExtractions.delete(videoId)
    }
  })()

  activeExtractions.set(videoId, extractionPromise)
  return extractionPromise
}
