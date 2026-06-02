import fetch from 'node-fetch'
import md5 from 'md5'

const API_URL = 'https://ws.audioscrobbler.com/2.0/'

function sign(params: Record<string, string>, apiSecret: string): string {
  const sorted = Object.keys(params).sort()
  const str = sorted.map(k => k + params[k]).join('') + apiSecret
  return md5(str)
}

async function lastfmPost(
  method: string,
  sessionKey: string,
  extra: Record<string, string>,
  apiKey: string,
  apiSecret: string
) {
  if (!apiKey || !apiSecret) throw new Error('Last.fm API credentials not configured')

  const params: Record<string, string> = {
    method,
    api_key: apiKey,
    sk: sessionKey,
    ...extra,
  }
  params.api_sig = sign(params, apiSecret)
  params.format = 'json'

  const body = new URLSearchParams(params)
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  return res.json()
}

function resolveCredentials(reqApiKey?: string, reqApiSecret?: string) {
  return {
    apiKey: reqApiKey || process.env.LASTFM_API_KEY || '',
    apiSecret: reqApiSecret || process.env.LASTFM_API_SECRET || '',
  }
}

export async function lastfmNowPlaying(
  sessionKey: string,
  artist: string,
  track: string,
  album?: string,
  duration?: number,
  reqApiKey?: string,
  reqApiSecret?: string
) {
  if (!sessionKey) return
  const { apiKey, apiSecret } = resolveCredentials(reqApiKey, reqApiSecret)
  const extra: Record<string, string> = { artist, track }
  if (album) extra.album = album
  if (duration) extra.duration = String(duration)
  return lastfmPost('track.updateNowPlaying', sessionKey, extra, apiKey, apiSecret)
}

export async function lastfmScrobble(
  sessionKey: string,
  artist: string,
  track: string,
  album: string | undefined,
  duration: number | undefined,
  timestamp: number,
  reqApiKey?: string,
  reqApiSecret?: string
) {
  if (!sessionKey) return
  const { apiKey, apiSecret } = resolveCredentials(reqApiKey, reqApiSecret)
  const extra: Record<string, string> = {
    artist,
    track,
    timestamp: String(Math.floor(timestamp)),
  }
  if (album) extra.album = album
  if (duration) extra.duration = String(duration)
  return lastfmPost('track.scrobble', sessionKey, extra, apiKey, apiSecret)
}
