import { Innertube, Platform } from 'youtubei.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'
import fetch from 'node-fetch'

Platform.shim.eval = async (data) => {
  return new Function(data.output)()
}

// ─── yt-dlp streaming ─────────────────────────────────────────────────────────

const YTDLP_URL_CACHE = new Map<string, { url: string; mime: string; duration?: number; expires: number }>()
const YTDLP_URL_TTL_MS = 5 * 60 * 1000

function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(stderr.trim() || `yt-dlp exited ${code}`))
    })
    proc.on('error', (e) => reject(new Error(`yt-dlp not found: ${e.message}`)))
  })
}

/**
 * Resolve an HLS m3u8 manifest URL for a YouTube video using yt-dlp.
 * Prefers format 234 (high-quality audio HLS), falls back to 233 (low).
 * Results are cached for YTDLP_URL_TTL_MS.
 */
interface YtDlpAttempt {
  inputUrl: string
  format: string
  extraArgs: string[]
  label: string
}

async function runYtDlpAttempt(attempt: YtDlpAttempt): Promise<{ url: string; duration?: number }> {
  const raw = await runYtDlp([
    '--print', 'urls',
    '--print', '%(duration)s',
    '-f', attempt.format,
    '--no-playlist',
    '--no-warnings',
    ...attempt.extraArgs,
    attempt.inputUrl,
  ])
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const url = lines[0]
  if (!url || url.startsWith('WARNING') || url.startsWith('ERROR') || !url.startsWith('http')) {
    throw new Error(`yt-dlp returned no URL: ${url?.substring(0, 100)}`)
  }
  const durStr = lines[1]
  const duration = durStr && !isNaN(parseFloat(durStr)) ? parseFloat(durStr) : undefined
  return { url, duration }
}

export async function resolveYtDlpUrl(videoId: string): Promise<{ url: string; mime: string; duration?: number }> {
  const now = Date.now()
  const cached = YTDLP_URL_CACHE.get(videoId)
  if (cached && cached.expires > now) return { url: cached.url, mime: cached.mime, duration: cached.duration }

  // Ordered list of attempts:
  // 1. HLS (m3u8) formats 234/233 — no POT required, works for most YT videos
  // 2. HTTPS DASH format 140 with android+missing_pot — works for YT Music exclusives
  //    (GVS PO Token warning fires but CDN actually serves the audio without it)
  const attempts: YtDlpAttempt[] = [
    {
      inputUrl: `https://music.youtube.com/watch?v=${videoId}`,
      format: '234/233',
      extraArgs: [],
      label: 'ytmusic/hls',
    },
    {
      inputUrl: `https://www.youtube.com/watch?v=${videoId}`,
      format: '234/233',
      extraArgs: [],
      label: 'youtube/hls',
    },
    {
      inputUrl: `https://music.youtube.com/watch?v=${videoId}`,
      format: '140/139',
      extraArgs: [
        '--extractor-args', 'youtube:player_client=android',
        '--extractor-args', 'youtube:formats=missing_pot',
      ],
      label: 'ytmusic/dash-android',
    },
    {
      inputUrl: `https://www.youtube.com/watch?v=${videoId}`,
      format: '140/139',
      extraArgs: [
        '--extractor-args', 'youtube:player_client=android',
        '--extractor-args', 'youtube:formats=missing_pot',
      ],
      label: 'youtube/dash-android',
    },
  ]

  let url: string | null = null
  let duration: number | undefined
  let lastErr = ''

  for (const attempt of attempts) {
    try {
      const result = await runYtDlpAttempt(attempt)
      url = result.url
      duration = result.duration
      // For DASH URLs, also try extracting duration from the URL's dur= parameter
      if (!duration) {
        const durMatch = url.match(/[?&]dur=([0-9.]+)/)
        if (durMatch) duration = parseFloat(durMatch[1])
      }
      console.log(`[yt-dlp] ${videoId} resolved via ${attempt.label}${duration ? ` (${Math.round(duration)}s)` : ''}`)
      break
    } catch (e: any) {
      lastErr = e.message
      console.warn(`[yt-dlp] ${attempt.label} failed for ${videoId}: ${e.message.substring(0, 120)}`)
    }
  }

  if (!url) throw new Error(`yt-dlp all attempts failed for ${videoId}: ${lastErr}`)

  const mime = 'audio/mpeg'
  YTDLP_URL_CACHE.set(videoId, { url, mime, duration, expires: now + YTDLP_URL_TTL_MS })
  return { url, mime, duration }
}

export function invalidateYtDlpCache(videoId: string): void {
  YTDLP_URL_CACHE.delete(videoId)
}

/**
 * Spawn ffmpeg to convert an HLS m3u8 URL to a streaming MP3 pipe.
 * MP3 (audio/mpeg) is the most universally-supported streaming format for
 * browser <audio> elements — works without Content-Length or range requests.
 * For HLS: ffmpeg fetches the m3u8 + segments directly.
 */
export function spawnFfmpegHlsStream(m3u8Url: string): ReturnType<typeof spawn> {
  return spawn('ffmpeg', [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', m3u8Url,
    '-vn',
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-f', 'mp3',
    'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
}

/**
 * Spawn ffmpeg reading from stdin, for YouTube DASH (format 140/139) URLs
 * that require bounded Range requests. YouTube CDN serves format 140 only via
 * bounded Range (bytes=N-M) requests — a full GET or unbounded bytes=0- returns
 * HTTP 403. We chunk-fetch using Node.js fetch() with 480KB Range windows and
 * pipe each chunk to ffmpeg's stdin, which converts m4a → MP3.
 *
 * Returns the spawned ffmpeg ChildProcess. The caller must pipe proc.stdout to
 * the HTTP response. The chunk-fetch loop runs in the background.
 */
export function spawnFfmpegDashStream(dashUrl: string): ReturnType<typeof spawn> {
  const proc = spawn('ffmpeg', [
    '-i', 'pipe:0',
    '-vn',
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-f', 'mp3',
    'pipe:1',
  ], { stdio: ['pipe', 'pipe', 'pipe'] })

  const clenMatch = dashUrl.match(/[?&]clen=(\d+)/)
  const totalBytes = clenMatch ? parseInt(clenMatch[1]) : 8_000_000
  const CHUNK = 480_000 // 480KB — well within YouTube CDN's ~512KB bounded Range limit

  ;(async () => {
    try {
      for (let start = 0; start < totalBytes; start += CHUNK) {
        const end = Math.min(start + CHUNK - 1, totalBytes - 1)
        const resp = await fetch(dashUrl, {
          headers: { 'Range': `bytes=${start}-${end}` },
        })
        if (!resp.ok) throw new Error(`CDN ${resp.status} at bytes=${start}-${end}`)
        const buf = Buffer.from(await resp.arrayBuffer())
        // Respect backpressure on ffmpeg stdin
        const ok = proc.stdin!.write(buf)
        if (!ok) await new Promise<void>(r => proc.stdin!.once('drain', r))
      }
      proc.stdin!.end()
    } catch (e: any) {
      proc.stdin!.destroy(e)
      proc.kill('SIGKILL')
    }
  })()

  return proc
}

let youtubeInstance: Innertube | null = null

export async function getYoutube(): Promise<Innertube> {
  if (!youtubeInstance) {
    youtubeInstance = await Innertube.create({
      generate_session_locally: true,
    })
  }
  return youtubeInstance
}

export function resetYoutubeInstance(): void {
  youtubeInstance = null
}

// ─── Stream URL Cache (URL-level, short TTL) ──────────────────────────────────
interface CacheEntry { url: string; audioOnly: boolean; expires: number }
const MEM_CACHE = new Map<string, CacheEntry>()
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

function readDiskCache(videoId: string): { url: string; audioOnly: boolean } | null {
  try {
    const p = getDiskCachePath(videoId)
    if (!fs.existsSync(p)) return null
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'))
    if (Date.now() > parsed.expires) {
      fs.unlinkSync(p)
      return null
    }
    return { url: parsed.url, audioOnly: parsed.audioOnly ?? false }
  } catch { return null }
}

function writeDiskCache(videoId: string, url: string, audioOnly: boolean) {
  try {
    ensureCacheDir()
    const expires = Date.now() + DISK_CACHE_TTL_MS
    fs.writeFileSync(getDiskCachePath(videoId), JSON.stringify({ url, audioOnly, expires }))
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
  clearAudioCache()
}

/**
 * Evicts a single video's resolved URL from both the memory and disk caches.
 * Call this when the CDN URL returns 403/410 (expired) so the next request
 * forces a fresh decipher pass.
 */
export function invalidateStreamCache(videoId: string): void {
  MEM_CACHE.delete(videoId)
  STREAM_INFO_CACHE.delete(videoId)
  try {
    const p = getDiskCachePath(videoId)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch {}
}

// ─── Stream Info Cache (holds youtubei info object + metadata, memory-only) ───
interface StreamInfoEntry {
  info: any
  contentLength: number
  mimeType: string
  expires: number
}
const STREAM_INFO_CACHE = new Map<string, StreamInfoEntry>()
const INFO_TTL_MS = 5 * 60 * 1000

/**
 * Resolves and caches the youtubei VideoInfo object plus audio metadata
 * (content-length, mime-type) needed to serve proper HTTP range responses.
 * Kept memory-only because the info object isn't serialisable.
 */
export async function resolveStreamInfo(videoId: string): Promise<{
  info: any; contentLength: number; mimeType: string
}> {
  const now = Date.now()
  const cached = STREAM_INFO_CACHE.get(videoId)
  if (cached && cached.expires > now) {
    return { info: cached.info, contentLength: cached.contentLength, mimeType: cached.mimeType }
  }

  const youtube = await getYoutube()
  const safeChoose = (info: any, opts: any) => {
    try { return info.chooseFormat(opts) } catch { return null }
  }
  const CLIENTS = ['ANDROID_TESTSUITE', 'TV_EMBEDDED', 'IOS', 'ANDROID', 'WEB'] as const
  const errors: string[] = []

  for (const client of CLIENTS) {
    try {
      const info = await youtube.getInfo(videoId, { client } as any)

      const fmt =
        safeChoose(info, { itag: 141 }) ??   // AAC 256 kbps
        safeChoose(info, { itag: 140 }) ??   // AAC 128 kbps
        safeChoose(info, { type: 'audio', quality: 'best' })

      if (!fmt) { errors.push(`${client}: no audio format`); continue }

      const contentLength = Number(fmt.content_length ?? 0)
      const mimeType = String(fmt.mime_type ?? 'audio/mp4')

      STREAM_INFO_CACHE.set(videoId, { info, contentLength, mimeType, expires: now + INFO_TTL_MS })
      console.log(`[Stream] ${videoId} info via ${client} (${mimeType}, ${contentLength}b)`)
      return { info, contentLength, mimeType }
    } catch (err: any) {
      errors.push(`${client}: ${err.message}`)
      console.warn(`[Stream] ${client} getInfo failed for ${videoId}: ${err.message}`)
    }
  }

  throw new Error(`resolveStreamInfo failed for ${videoId}: ${errors.join(' | ')}`)
}

export function getCacheStats(): { count: number; sizeBytes: number } {
  try {
    ensureAudioCacheDir()
    const files = fs.readdirSync(AUDIO_CACHE_DIR).filter(f => f.endsWith('.m4a'))
    const sizeBytes = files.reduce((acc, f) => {
      try { return acc + fs.statSync(path.join(AUDIO_CACHE_DIR, f)).size }
      catch { return acc }
    }, 0)
    return { count: files.length, sizeBytes }
  } catch { return { count: 0, sizeBytes: 0 } }
}

export async function resolveStreamUrl(videoId: string): Promise<{ url: string; audioOnly: boolean }> {
  const now = Date.now()

  const memEntry = MEM_CACHE.get(videoId)
  if (memEntry && memEntry.expires > now) return { url: memEntry.url, audioOnly: memEntry.audioOnly }

  const diskEntry = readDiskCache(videoId)
  if (diskEntry) {
    MEM_CACHE.set(videoId, { ...diskEntry, expires: now + 5 * 60 * 1000 })
    return diskEntry
  }

  // chooseFormat() throws in youtubei.js v17 when no format matches — wrap every
  // call individually so we can fall through to the next option gracefully.
  const safeChoose = (info: any, opts: any) => {
    try { return info.chooseFormat(opts) } catch { return null }
  }

  // Try multiple clients — ANDROID_TESTSUITE returns un-ciphered URLs, best for cloud.
  const CLIENTS = ['ANDROID_TESTSUITE', 'TV_EMBEDDED', 'IOS', 'ANDROID', 'WEB'] as const
  const errors: string[] = []

  const youtube = await getYoutube()

  for (const client of CLIENTS) {
    try {
      const info = await youtube.getInfo(videoId, { client } as any)

      // ── Priority 1: audio-only AAC m4a (no ffmpeg needed) ─────────────────
      const audioOnly =
        safeChoose(info, { itag: 141 }) ??   // AAC 256 kbps
        safeChoose(info, { itag: 140 }) ??   // AAC 128 kbps
        safeChoose(info, { type: 'audio', quality: 'best' })

      if (audioOnly) {
        const url = await audioOnly.decipher(youtube.session.player)
        if (url) {
          console.log(`[Stream] ${videoId} resolved via ${client} (audio-only)`)
          MEM_CACHE.set(videoId, { url, audioOnly: true, expires: now + 5 * 60 * 1000 })
          writeDiskCache(videoId, url, true)
          return { url, audioOnly: true }
        }
      }

      // ── Priority 2: muxed video+audio (ffmpeg will extract audio) ─────────
      const muxed =
        safeChoose(info, { itag: 18 }) ??
        safeChoose(info, { type: 'videoandaudio', quality: 'best' })

      if (muxed) {
        const url = await muxed.decipher(youtube.session.player)
        if (url) {
          console.log(`[Stream] ${videoId} resolved via ${client} (muxed)`)
          MEM_CACHE.set(videoId, { url, audioOnly: false, expires: now + 5 * 60 * 1000 })
          writeDiskCache(videoId, url, false)
          return { url, audioOnly: false }
        }
      }

      errors.push(`${client}: no usable format found`)
    } catch (err: any) {
      errors.push(`${client}: ${err.message}`)
      console.warn(`[Stream] Client ${client} failed for ${videoId}: ${err.message}`)
    }
  }

  throw new Error(`Stream resolution failed for ${videoId}: ${errors.join(' | ')}`)
}


// ─── Live Audio Stream (uses youtubei.js download() — handles auth internally) ─

/**
 * Try to download and eagerly read the first chunk to detect CDN 403/non-2xx
 * errors BEFORE the caller sends any HTTP response headers.
 * Returns null if the CDN rejects the request, or a reassembled ReadableStream
 * with the first chunk already prepended.
 */
async function tryDownload(
  info: any,
  opts: any
): Promise<ReadableStream<Uint8Array> | null> {
  let rawStream: ReadableStream<Uint8Array>
  try {
    rawStream = await info.download(opts)
  } catch {
    return null
  }

  const reader = rawStream.getReader()
  let firstChunk: Uint8Array | undefined
  try {
    const { done, value } = await reader.read()
    if (done || !value || value.length === 0) {
      await reader.cancel()
      return null
    }
    firstChunk = value
  } catch {
    // CDN returned non-2xx (403, 410, etc.) — stream errored on first read
    try { await reader.cancel() } catch {}
    return null
  }

  const chunk = firstChunk
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(chunk)
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
        } else {
          controller.enqueue(value)
        }
      } catch (e) {
        controller.error(e)
      }
    },
    cancel() {
      reader.cancel().catch(() => {})
    },
  })
}

/**
 * Returns a Web ReadableStream of audio for the given videoId.
 *
 * Eagerly reads the first chunk before returning so that CDN 403/non-2xx
 * errors are detected BEFORE the proxy has sent any HTTP response headers —
 * allowing the proxy to retry rather than sending a broken stream to the
 * browser (which manifests as MEDIA_ELEMENT_ERROR: Format error).
 *
 * Valid youtubei.js download format values: 'mp4' | 'webm' | 'any'.
 * 'm4a' is NOT valid and causes download() to throw on every client.
 */
export async function streamAudio(
  videoId: string,
  range?: { start: number; end: number }
): Promise<ReadableStream<Uint8Array>> {
  const mp4Opts: any  = { type: 'audio', quality: 'best', format: 'mp4' }
  const anyOpts: any  = { type: 'audio', quality: 'best' }
  if (range) { mp4Opts.range = range; anyOpts.range = range }

  // ── Attempt 1: cached VideoInfo, force mp4 ────────────────────────────────
  const { info } = await resolveStreamInfo(videoId)
  const s1 = await tryDownload(info, mp4Opts)
  if (s1) {
    console.log('[Stream] audio stream validated for', videoId, range ? `range:${range.start}-${range.end}` : 'full', '(cached/mp4)')
    return s1
  }

  // ── Attempt 2: cached VideoInfo, any format ───────────────────────────────
  const s2 = await tryDownload(info, anyOpts)
  if (s2) {
    console.log('[Stream] audio stream validated for', videoId, '(cached/any)')
    return s2
  }

  // ── CDN rejected both — evict and retry fresh with each client ────────────
  STREAM_INFO_CACHE.delete(videoId)
  console.warn(`[Stream] CDN rejected cached stream for ${videoId}, retrying with fresh clients`)

  const youtube = await getYoutube()
  const safeChoose = (i: any, o: any) => { try { return i.chooseFormat(o) } catch { return null } }

  for (const client of ['ANDROID_TESTSUITE', 'TV_EMBEDDED', 'IOS', 'ANDROID', 'WEB'] as const) {
    try {
      const freshInfo = await youtube.getInfo(videoId, { client } as any)

      // Update STREAM_INFO_CACHE with the fresh info
      const fmt =
        safeChoose(freshInfo, { itag: 141 }) ??
        safeChoose(freshInfo, { itag: 140 }) ??
        safeChoose(freshInfo, { type: 'audio', quality: 'best' })
      if (fmt) {
        STREAM_INFO_CACHE.set(videoId, {
          info: freshInfo,
          contentLength: Number(fmt.content_length ?? 0),
          mimeType: String(fmt.mime_type ?? 'audio/mp4'),
          expires: Date.now() + INFO_TTL_MS,
        })
      }

      const s3 = await tryDownload(freshInfo, mp4Opts) ?? await tryDownload(freshInfo, anyOpts)
      if (s3) {
        console.log(`[Stream] audio stream validated for ${videoId} via fresh ${client}`)
        return s3
      }
      console.warn(`[Stream] ${client} also got CDN 403 for ${videoId}`)
    } catch (e: any) {
      console.warn(`[Stream] ${client} getInfo failed for ${videoId}: ${e.message}`)
    }
  }

  throw new Error(`All stream attempts (5 clients × 2 formats) failed for ${videoId}`)
}

// ─── Audio Cache (pure audio, long TTL) ───────────────────────────────────────
const AUDIO_CACHE_DIR = path.join(os.homedir(), '.velune', 'cache', 'audio')
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

export function enforceCacheLimit(maxBytes: number): void {
  try {
    ensureAudioCacheDir()
    const files = fs.readdirSync(AUDIO_CACHE_DIR).filter(f => f.endsWith('.m4a'))
    
    // Get file sizes and modified times
    const fileStats = files.map(f => {
      const p = path.join(AUDIO_CACHE_DIR, f)
      const stat = fs.statSync(p)
      return { path: p, size: stat.size, mtime: stat.mtimeMs }
    })
    
    let totalSize = fileStats.reduce((acc, f) => acc + f.size, 0)
    
    if (totalSize <= maxBytes) return
    
    // Sort oldest first
    fileStats.sort((a, b) => a.mtime - b.mtime)
    
    for (const f of fileStats) {
      if (totalSize <= maxBytes) break
      try {
        fs.unlinkSync(f.path)
        totalSize -= f.size
      } catch (e) {
        console.error(`Failed to delete cache file ${f.path}:`, e)
      }
    }
  } catch (e) {
    console.error('Failed to enforce cache limit:', e)
  }
}

/**
 * Ensures a pure audio file exists in the audio cache for the given videoId.
 *
 * - If an audio-only format is available (itag 140/141), it is downloaded
 *   directly — no ffmpeg required.
 * - If only a muxed format is available, the video is downloaded and ffmpeg
 *   is used to losslessly extract the audio track.
 *
 * Returns the absolute path to the cached .m4a file.
 */
export async function ensureAudioCached(videoId: string): Promise<string> {
  ensureAudioCacheDir()
  const audioPath = getAudioCachePath(videoId)

  if (fs.existsSync(audioPath)) {
    return audioPath
  }

  const existing = activeExtractions.get(videoId)
  if (existing) return existing

  const extractionPromise = (async () => {
    const tmpFile = audioPath + '.tmp'

    try {
      const { url, audioOnly } = await resolveStreamUrl(videoId)

      if (audioOnly) {
        // ── Direct download (audio-only stream, no ffmpeg) ──────────────────
        console.log(`[Audio Cache] Downloading audio-only stream for ${videoId}...`)
        const res = await fetch(url, {
          headers: { 'Referer': 'https://www.youtube.com/' }
        })
        if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)

        await new Promise<void>((resolve, reject) => {
          const out = fs.createWriteStream(tmpFile)
          res.body.pipe(out)
          out.on('finish', resolve)
          out.on('error', reject)
          res.body.on('error', reject)
        })

        fs.renameSync(tmpFile, audioPath)
        console.log(`[Audio Cache] Cached audio-only for ${videoId}`)
      } else {
        // ── Muxed download + ffmpeg extraction ──────────────────────────────
        const tmpMp4 = audioPath + '.tmp.mp4'
        const tmpM4a = audioPath + '.tmp.m4a'

        try {
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

          console.log(`[Audio Cache] Extracting audio via ffmpeg for ${videoId}...`)

          await new Promise<void>((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
              '-y',
              '-i', tmpMp4,
              '-vn',
              '-acodec', 'copy',
              tmpM4a
            ])
            ffmpeg.stderr.on('data', () => {})
            ffmpeg.on('close', (code) => {
              if (code === 0) resolve()
              else reject(new Error(`ffmpeg exited with code ${code}`))
            })
            ffmpeg.on('error', (err) => reject(new Error(`ffmpeg not found or failed: ${err.message}`)))
          })

          fs.renameSync(tmpM4a, audioPath)
          console.log(`[Audio Cache] Cached muxed-extracted audio for ${videoId}`)
        } finally {
          try { if (fs.existsSync(tmpMp4)) fs.unlinkSync(tmpMp4) } catch {}
          try { if (fs.existsSync(tmpM4a)) fs.unlinkSync(tmpM4a) } catch {}
        }
      }

      return audioPath
    } finally {
      try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile) } catch {}
      activeExtractions.delete(videoId)
    }
  })()

  activeExtractions.set(videoId, extractionPromise)
  return extractionPromise
}
