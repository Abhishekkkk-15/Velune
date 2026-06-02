import { useEffect, useRef } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { api } from '../api/client'
import type { Track } from '../store/playerStore'

export function useScrobble(currentTrack: Track | null, isPlaying: boolean, progress: number, duration: number) {
  const {
    lastfmEnabled, lastfmSessionKey, lastfmScrobbleThreshold,
    lastfmApiKey, lastfmApiSecret,
  } = useSettingsStore()
  const scrobbledRef = useRef<string | null>(null)
  const nowPlayingRef = useRef<string | null>(null)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!lastfmEnabled || !lastfmSessionKey || !currentTrack) return
    if (nowPlayingRef.current === currentTrack.id) return

    nowPlayingRef.current = currentTrack.id
    scrobbledRef.current = null
    startTimeRef.current = Math.floor(Date.now() / 1000)

    api.lastfmNowPlaying({
      sessionKey: lastfmSessionKey,
      artist: (currentTrack.artists || []).map(a => a.name).join(', '),
      track: currentTrack.title,
      album: currentTrack.album,
      duration: currentTrack.duration,
      apiKey: lastfmApiKey || undefined,
      apiSecret: lastfmApiSecret || undefined,
    }).catch(() => {})
  }, [currentTrack?.id, lastfmEnabled, lastfmSessionKey])

  useEffect(() => {
    if (!lastfmEnabled || !lastfmSessionKey || !currentTrack || !isPlaying) return
    if (scrobbledRef.current === currentTrack.id) return
    if (!duration || duration < 30) return

    const threshold = Math.min(duration * (lastfmScrobbleThreshold / 100), 240)
    if (progress < threshold) return

    scrobbledRef.current = currentTrack.id
    api.lastfmScrobble({
      sessionKey: lastfmSessionKey,
      artist: (currentTrack.artists || []).map(a => a.name).join(', '),
      track: currentTrack.title,
      album: currentTrack.album,
      duration: currentTrack.duration,
      timestamp: startTimeRef.current,
      apiKey: lastfmApiKey || undefined,
      apiSecret: lastfmApiSecret || undefined,
    }).catch(() => {})
  }, [progress, isPlaying, lastfmEnabled, lastfmSessionKey, currentTrack?.id])
}
