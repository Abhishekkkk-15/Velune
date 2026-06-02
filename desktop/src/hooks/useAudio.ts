import { useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { useLibraryStore } from '../store/libraryStore'
import { useSettingsStore } from '../store/settingsStore'
import { api } from '../api/client'
import audioEngine from '../audioEngine'

export function useAudio() {
  // audioRef is THE single stable audio element. Never swapped out.
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // nextAudioRef is a hidden element used ONLY for buffering the next track's bytes.
  // We never swap it into the primary slot. We just read its buffered src back out.
  const nextAudioRef = useRef<HTMLAudioElement | null>(null)
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const crossfadingRef = useRef(false)
  // Tracks which videoId is pre-resolved and buffered in nextAudioRef
  const preloadedForRef = useRef<string | null>(null)
  // The resolved URL for the preloaded track
  const preloadedUrlRef = useRef<string | null>(null)
  const lastSkipRef = useRef<number>(0)

  const {
    currentTrack, isPlaying, volume, isMuted, repeat, streamUrl, queue, queueIndex,
    setIsPlaying, setProgress, setDuration, setStreamUrl, setIsLoading, playNext,
  } = usePlayerStore()
  const { addToHistory } = useLibraryStore()
  const settings = useSettingsStore()

  // ── Audio element initialization ──────────────────────────────────────────
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'auto'
      audioRef.current.crossOrigin = 'anonymous'
      audioEngine.element = audioRef.current
      audioEngine.connectElement(audioRef.current)
    }
    if (!nextAudioRef.current) {
      nextAudioRef.current = new Audio()
      nextAudioRef.current.preload = 'auto'
      nextAudioRef.current.crossOrigin = 'anonymous'
    }
  }, [])

  // ── Audio event listeners (always on the stable audioRef element) ─────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => {
      setProgress(audio.currentTime)

      // Crossfade: start fading in the nextAudio when near end
      const cfDur = settings.crossfadeDuration
      if (cfDur > 0 && audio.duration > 0 && isFinite(audio.duration)) {
        const timeLeft = audio.duration - audio.currentTime
        if (timeLeft <= cfDur && timeLeft > 0 && !crossfadingRef.current) {
          const fadeFrac = Math.max(0, timeLeft / cfDur)
          audio.volume = (isMuted ? 0 : volume) * fadeFrac
          const nextAudio = nextAudioRef.current
          if (nextAudio && nextAudio.src && nextAudio.readyState >= 2 && nextAudio.paused) {
            crossfadingRef.current = true
            nextAudio.volume = 0
            nextAudio.play().then(() => {
              const ramp = setInterval(() => {
                if (!audio || audio.ended) { clearInterval(ramp); return }
                const tl = audio.duration - audio.currentTime
                const frac = cfDur > 0 ? Math.max(0, tl / cfDur) : 0
                audio.volume = (isMuted ? 0 : volume) * frac
                nextAudio.volume = (isMuted ? 0 : volume) * (1 - frac)
                if (tl <= 0.1) clearInterval(ramp)
              }, 50)
            }).catch(() => { crossfadingRef.current = false })
          } else if (nextAudio && nextAudio.src && !nextAudio.paused) {
            nextAudio.volume = (isMuted ? 0 : volume) * (1 - fadeFrac)
          }
        }
      }
    }

    const onDuration = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration)
      }
    }

    // Only call playNext() — NEVER manipulate audio elements here.
    // The currentTrack effect handles all audio element changes.
    const onEnded = () => {
      audio.volume = isMuted ? 0 : volume
      crossfadingRef.current = false
      if (repeat === 'one') {
        audio.currentTime = 0
        audio.play().catch(() => { })
      } else {
        playNext()
      }
    }

    const onPlay = () => setIsPlaying(true)

    const onPause = () => {
      // Don't update global state while we're in the middle of a track switch
      if (!usePlayerStore.getState().isLoading) {
        setIsPlaying(false)
      }
    }

    const onWaiting = () => setIsLoading(true)
    const onCanPlay = () => setIsLoading(false)

    const onError = (e: any) => {
      // Ignore self-inflicted errors from clearing src during a track switch.
      // Setting audio.src = '' triggers code=4 'Empty src attribute' — not a real failure.
      if (!audio.src || audio.src === window.location.href) return
      if (audio.error?.message?.toLowerCase().includes('empty src')) return
      console.error('[Audio Error]', e, audio.error ? { code: audio.error.code, message: audio.error.message } : null)
      setIsLoading(false)
      setIsPlaying(false)
      const now = Date.now()
      if (now - lastSkipRef.current > 3000) {
        const { queue, queueIndex, repeat } = usePlayerStore.getState()
        const hasNext = queueIndex < queue.length - 1
        if (hasNext && repeat !== 'one') {
          lastSkipRef.current = now
          setTimeout(() => playNext(), 800)
        }
      }
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('error', onError)
    }
  }, [repeat, volume, isMuted, settings.crossfadeDuration, setProgress, setDuration, setIsPlaying, setIsLoading, playNext])

  // ── Track change: single authority for loading audio ─────────────────────
  useEffect(() => {
    if (!currentTrack) return

    setIsLoading(true)
    crossfadingRef.current = false
    addToHistory(currentTrack)

    const audio = audioRef.current
    if (!audio) return

    // Always stop the hidden buffering element immediately.
    // This ensures nextAudioRef never accidentally leaks audio.
    const nextAudio = nextAudioRef.current
    if (nextAudio) {
      nextAudio.pause()
      nextAudio.src = ''
    }

    // Check if we already pre-resolved the URL for this track.
    // We DON'T swap elements — we just assign the URL directly to the stable element.
    const cachedUrl = preloadedForRef.current === currentTrack.id ? preloadedUrlRef.current : null

    console.log(`[useAudio] track change → id=${currentTrack.id} title="${currentTrack.title}" | preloadedFor=${preloadedForRef.current} | cachedUrl=${!!cachedUrl}`)

    // Reset preload state regardless
    preloadedForRef.current = null
    preloadedUrlRef.current = null

    if (cachedUrl) {
      // Instant load: URL already resolved, assign directly
      console.log(`[useAudio] instant load from cache for "${currentTrack.title}"`)
      audio.pause()
      audio.src = cachedUrl
      audio.playbackRate = settings.playbackSpeed
      audio.load()
      audio.volume = isMuted ? 0 : volume
      audioEngine.context?.resume().catch(() => { })
      audio.play().catch(() => setIsPlaying(false))
      setStreamUrl(cachedUrl)
      setIsLoading(false)
    } else {
      // Normal load — just pause. Do NOT set src='' here; that fires a spurious
      // 'Empty src attribute' error event which triggers the auto-skip logic.
      // The streamUrl effect will assign the correct src once resolved.
      console.log(`[useAudio] normal fetch for "${currentTrack.title}"`)
      audio.pause()

      api.getStream(currentTrack.id)
        .then(({ url, duration }) => {
          // Guard: ignore if the track changed again while we were fetching
          if (usePlayerStore.getState().currentTrack?.id !== currentTrack.id) return
          setStreamUrl(url)
          if (duration && isFinite(duration) && duration > 0) setDuration(duration)
        })
        .catch(() => setIsLoading(false))
    }

    // Background: tell the server to cache the next 2 tracks' audio files
    const { queue: q, queueIndex: qi } = usePlayerStore.getState()
    const maxCacheMB = useSettingsStore.getState().maxCacheSize
    q.slice(qi + 1, qi + 3).forEach(t => api.prefetchStream(t.id, maxCacheMB))
  }, [currentTrack?.id])

  // ── Stream URL → audio element ────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !streamUrl) return
    // Already loaded (e.g. from cached URL branch above)
    if (audio.src && (audio.src === streamUrl || audio.src.endsWith(streamUrl))) return
    audio.src = streamUrl
    audio.playbackRate = settings.playbackSpeed
    audio.load()
    if (usePlayerStore.getState().isPlaying) {
      audioEngine.context?.resume().catch(() => { })
      audio.play().catch(() => setIsPlaying(false))
    }
  }, [streamUrl])

  // ── Play / Pause ──────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !streamUrl) return
    if (isPlaying) {
      audioEngine.context?.resume().catch(() => { })
      audio.play().catch(() => { })
    } else {
      audio.pause()
    }
    if (window.electron?.setThumbarButtons) {
      window.electron.setThumbarButtons(isPlaying)
    }
  }, [isPlaying])

  // ── Media keys / taskbar ──────────────────────────────────────────────────
  useEffect(() => {
    if (window.electron?.onMediaCommand) {
      window.electron.onMediaCommand((cmd) => {
        if (cmd === 'playpause') {
          setIsPlaying(!usePlayerStore.getState().isPlaying)
        } else if (cmd === 'next') {
          playNext()
        } else if (cmd === 'prev') {
          usePlayerStore.getState().playPrev()
        }
      })
    }
    return () => { if (window.electron?.offMediaCommand) window.electron.offMediaCommand() }
  }, [playNext, setIsPlaying])

  // ── Volume / mute ─────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = isMuted ? 0 : volume
  }, [volume, isMuted])

  // ── Playback speed ────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = settings.playbackSpeed
  }, [settings.playbackSpeed])

  // ── EQ ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    settings.eqBands.forEach((gain, index) => audioEngine.setEqBand(index, gain))
  }, [settings.eqBands])

  // ── Discord Rich Presence ─────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack) {
      if (settings.discordEnabled) api.discordClear().catch(() => { })
      return
    }
    if (settings.discordEnabled && isPlaying) {
      api.discordActivity({
        title: currentTrack.title,
        artist: (currentTrack.artists || []).map(a => a.name).join(', '),
        album: currentTrack.album,
        thumbnail: currentTrack.thumbnail,
        startTimestamp: Date.now(),
      }).catch(() => { })
    } else if (settings.discordEnabled && !isPlaying) {
      api.discordClear().catch(() => { })
    }
  }, [currentTrack?.id, isPlaying, settings.discordEnabled])

  // ── Sleep timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null }
    if (settings.sleepTimerMinutes && settings.sleepTimerMinutes > 0 && isPlaying) {
      sleepTimerRef.current = setTimeout(() => {
        setIsPlaying(false)
        settings.setSleepTimer(null)
      }, settings.sleepTimerMinutes * 60 * 1000)
    }
    return () => { if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current) }
  }, [settings.sleepTimerMinutes, isPlaying])

  // ── Next-track URL pre-resolution (gapless / crossfade) ───────────────────
  // Resolves the stream URL for the next queued track so that when the current
  // track ends we can assign it instantly without a network round-trip.
  // The nextAudioRef element is also used to pre-buffer bytes.
  useEffect(() => {
    if (!currentTrack || !isPlaying) return
    if (!settings.crossfadeDuration && !settings.gaplessPlayback) return

    const nextTrack = queue[queueIndex + 1]
    if (!nextTrack) return
    if (preloadedForRef.current === nextTrack.id) return

    preloadedForRef.current = nextTrack.id
    preloadedUrlRef.current = null

    api.getStream(nextTrack.id)
      .then(({ url }) => {
        if (preloadedForRef.current !== nextTrack.id) return // stale, ignore
        preloadedUrlRef.current = url
        // Also load into the hidden audio element to warm browser buffers
        const nextAudio = nextAudioRef.current
        if (nextAudio && !nextAudio.src) {
          nextAudio.src = url
          nextAudio.load()
        }
      })
      .catch(() => {
        if (preloadedForRef.current === nextTrack.id) {
          preloadedForRef.current = null
          preloadedUrlRef.current = null
        }
      })
  }, [currentTrack?.id, isPlaying, queueIndex, settings.crossfadeDuration, settings.gaplessPlayback])

  const seek = useCallback((time: number) => {
    audioEngine.seek(time)
    setProgress(time)
  }, [setProgress])

  return { audioRef, seek }
}
