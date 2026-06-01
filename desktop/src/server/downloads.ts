import { getYoutube } from './streams'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { Readable } from 'stream'
import { spawn } from 'child_process'
import fetch from 'node-fetch'

const DOWNLOAD_DIR = path.join(os.homedir(), '.velune', 'downloads')

type DownloadStatus = 'pending' | 'downloading' | 'done' | 'error'
const statusMap = new Map<string, DownloadStatus>()

function ensureDir() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })
  }
}

export function getDownloadPath(videoId: string): string {
  return path.join(DOWNLOAD_DIR, `${videoId}.m4a`)
}

export function isDownloaded(videoId: string): boolean {
  return fs.existsSync(getDownloadPath(videoId))
}

export function getDownloadStatus(videoId: string): DownloadStatus | 'not_started' {
  if (isDownloaded(videoId)) return 'done'
  return statusMap.get(videoId) || 'not_started'
}

export function getAllDownloadedIds(): string[] {
  try {
    ensureDir()
    return fs.readdirSync(DOWNLOAD_DIR)
      .filter(f => f.endsWith('.m4a'))
      .map(f => f.replace('.m4a', ''))
  } catch { return [] }
}

export function getDownloadStats(): { count: number; sizeBytes: number } {
  try {
    ensureDir()
    const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.endsWith('.m4a'))
    const sizeBytes = files.reduce((acc, f) => {
      try { return acc + fs.statSync(path.join(DOWNLOAD_DIR, f)).size }
      catch { return acc }
    }, 0)
    return { count: files.length, sizeBytes }
  } catch { return { count: 0, sizeBytes: 0 } }
}

export function deleteDownload(videoId: string): void {
  const p = getDownloadPath(videoId)
  if (fs.existsSync(p)) fs.unlinkSync(p)
  statusMap.delete(videoId)
}

export function clearAllDownloads(): void {
  try {
    ensureDir()
    for (const f of fs.readdirSync(DOWNLOAD_DIR)) {
      fs.unlinkSync(path.join(DOWNLOAD_DIR, f))
    }
    statusMap.clear()
  } catch {}
}

export async function startDownload(videoId: string): Promise<void> {
  if (statusMap.get(videoId) === 'downloading') {
    return
  }
  if (isDownloaded(videoId)) return

  ensureDir()
  statusMap.set(videoId, 'downloading')

  const outPath = getDownloadPath(videoId)
  const tmpMp4 = outPath + '.tmp.mp4'
  const tmpM4a = outPath + '.tmp.m4a'

  try {
    const youtube = await getYoutube()
    const info = await youtube.getInfo(videoId, { client: 'ANDROID' })
    const format = info.chooseFormat({ itag: 18 })

    if (!format) throw new Error('Itag 18 format not found for download')

    const url = await format.decipher(youtube.session.player)
    if (!url) throw new Error('Failed to decipher download URL')

    // 1. Download the muxed mp4 to a temp file
    console.log(`[Download] Downloading muxed stream for ${videoId}...`)
    const res = await fetch(url, {
      headers: { 'Referer': 'https://www.youtube.com/' }
    })
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)

    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(tmpMp4)
      res.body.pipe(out)
      out.on('finish', resolve)
      out.on('error', (err) => {
        statusMap.set(videoId, 'error')
        if (fs.existsSync(tmpMp4)) fs.unlinkSync(tmpMp4)
        reject(err)
      })
      res.body.on('error', (err) => {
        statusMap.set(videoId, 'error')
        if (fs.existsSync(tmpMp4)) fs.unlinkSync(tmpMp4)
        out.destroy()
        reject(err)
      })
    })

    // 2. Losslessly extract the audio track using ffmpeg
    console.log(`[Download] Extracting audio for ${videoId}...`)
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', tmpMp4,
        '-vn',             // no video
        '-acodec', 'copy', // lossless audio copy
        tmpM4a
      ])

      ffmpeg.stderr.on('data', () => {}) // suppress ffmpeg output
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg exited with code ${code}`))
      })
      ffmpeg.on('error', reject)
    })

    // 3. Atomic rename to final path
    fs.renameSync(tmpM4a, outPath)
    statusMap.set(videoId, 'done')
    console.log(`[Download] Saved audio for ${videoId} at ${outPath}`)
  } catch (err) {
    statusMap.set(videoId, 'error')
    throw err
  } finally {
    try { if (fs.existsSync(tmpMp4)) fs.unlinkSync(tmpMp4) } catch {}
    try { if (fs.existsSync(tmpM4a)) fs.unlinkSync(tmpM4a) } catch {}
  }
}
