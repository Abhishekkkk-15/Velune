import fetch from 'node-fetch'

export interface LyricLine {
  time: number
  text: string
}

export interface LyricsResult {
  synced: boolean
  lines: LyricLine[]
  plain?: string
}

function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  const regex = /\[(\d+):(\d+)\.(\d+)\](.*)/
  for (const line of lrc.split('\n')) {
    const match = line.match(regex)
    if (match) {
      const min = parseInt(match[1])
      const sec = parseInt(match[2])
      const ms = parseInt(match[3].padEnd(3, '0').slice(0, 3))
      const time = min * 60 + sec + ms / 1000
      const text = match[4].trim()
      if (text) lines.push({ time, text })
    }
  }
  return lines
}

async function fetchFromLrcLib(title: string, artist: string, duration?: number): Promise<LyricsResult | null> {
  try {
    const params = new URLSearchParams({ track_name: title, artist_name: artist })
    if (duration) params.set('duration', String(duration))
    const res = await fetch(`https://lrclib.net/api/get?${params}`)
    if (!res.ok) return null
    const data: any = await res.json()
    if (data.syncedLyrics) {
      return { synced: true, lines: parseLrc(data.syncedLyrics), plain: data.plainLyrics }
    }
    if (data.plainLyrics) {
      return {
        synced: false,
        lines: data.plainLyrics.split('\n').map((text: string) => ({ time: 0, text })),
        plain: data.plainLyrics,
      }
    }
    return null
  } catch { return null }
}

async function fetchFromLrcLibSearch(title: string, artist: string): Promise<LyricsResult | null> {
  try {
    const params = new URLSearchParams({ q: `${artist} ${title}` })
    const res = await fetch(`https://lrclib.net/api/search?${params}`)
    if (!res.ok) return null
    const data: any = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const best = data.find((d: any) => d.syncedLyrics) || data[0]
    if (best?.syncedLyrics) {
      return { synced: true, lines: parseLrc(best.syncedLyrics), plain: best.plainLyrics }
    }
    if (best?.plainLyrics) {
      return {
        synced: false,
        lines: best.plainLyrics.split('\n').map((text: string) => ({ time: 0, text })),
        plain: best.plainLyrics,
      }
    }
    return null
  } catch { return null }
}

async function fetchFromKugou(title: string, artist: string, duration?: number): Promise<LyricsResult | null> {
  try {
    const keyword = `${artist} ${title}`
    const searchRes = await fetch(
      `https://mobilecdn.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(keyword)}&page=1&pagesize=10&showtype=1`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!searchRes.ok) return null
    const searchData: any = await searchRes.json()
    const songs = searchData?.data?.info || []
    if (songs.length === 0) return null

    const { hash, album_audio_id } = songs[0]
    const lyricRes = await fetch(
      `https://krcs.kugou.com/search?ver=1&man=yes&client=mobi&keyword=&duration=${duration || 0}&hash=${hash}&album_audio_id=${album_audio_id || ''}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!lyricRes.ok) return null
    const lyricData: any = await lyricRes.json()
    const candidates = lyricData?.candidates || []
    if (candidates.length === 0) return null

    const { id, accesskey } = candidates[0]
    const downloadRes = await fetch(
      `https://lyrics.kugou.com/download?ver=1&client=pc&id=${id}&accesskey=${accesskey}&fmt=lrc&charset=utf8`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!downloadRes.ok) return null
    const downloadData: any = await downloadRes.json()
    if (!downloadData?.content) return null

    const lrc = Buffer.from(downloadData.content, 'base64').toString('utf-8')
    const lines = parseLrc(lrc)
    if (lines.length > 0) {
      return { synced: true, lines }
    }
    return null
  } catch { return null }
}

export async function fetchLyrics(title: string, artist: string, duration?: number): Promise<LyricsResult | null> {
  const result = await fetchFromLrcLib(title, artist, duration)
    || await fetchFromLrcLibSearch(title, artist)
    || await fetchFromKugou(title, artist, duration)
  return result
}
