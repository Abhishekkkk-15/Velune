import { useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { useLibraryStore } from '../store/libraryStore'
import { useSettingsStore } from '../store/settingsStore'
import { api } from '../api/client'
import audioEngine from '../audioEngine'

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const nextAudioRef = useRef<HTMLAudioElement | null>(null)
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const crossfadingRef = useRef(false)
  const preloadedForRef = useRef<string | null>(null)

  const {
    currentTrack, isPlaying, volume, isMuted, repeat, streamUrl, queue, queueIndex,
    setIsPlaying, setProgress, setDuration, setStreamUrl, setIsLoading, playNext,
  } = usePlayerStore()
  const { addToHistory } = useLibraryStore()
  const settings = useSettingsStore()

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'auto'
      // crossOrigin='anonymous' is required for MediaElementAudioSourceNode when
      // the audio src is a cross-origin CDN URL (googlevideo.com). YouTube CDN
      // returns Access-Control-Allow-Origin: * which satisfies this requirement.
      audioRef.current.crossOrigin = 'anonymous'
      audioEngine.element = audioRef.current
      audioEngine.connectElement(audioRef.current)
    }
    if (!nextAudioRef.current) {
      nextAudioRef.current = new Audio()
      nextAudioRef.current.preload = 'auto'
      nextAudioRef.current.crossOrigin = 'anonymous'
      audioEngine.connectElement(nextAudioRef.current)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => {
      setProgress(audio.currentTime)

      const cfDur = settings.crossfadeDuration
      if (cfDur > 0 && audio.duration > 0) {
        const timeLeft = audio.duration - audio.currentTime
        if (timeLeft <= cfDur && timeLeft > 0 && !crossfadingRef.current) {
          const fadeFrac = Math.max(0, timeLeft / cfDur)
          audio.volume = (isMuted ? 0 : volume) * fadeFrac

          const nextAudio = nextAudioRef.current
          if (nextAudio && nextAudio.src && !nextAudio.paused) {
            nextAudio.volume = (isMuted ? 0 : volume) * (1 - fadeFrac)
          } else if (nextAudio && nextAudio.src && nextAudio.readyState >= 2) {
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
          }
        }
      }
    }

    const onDuration = () => setDuration(audio.duration || 0)
    const onEnded = () => {
      audio.volume = isMuted ? 0 : volume
      crossfadingRef.current = false
      if (repeat === 'one') {
        audio.currentTime = 0
        audio.play().catch(() => {})
      } else {
        const nextAudio = nextAudioRef.current
        if (settings.crossfadeDuration > 0 && nextAudio && nextAudio.src && !nextAudio.paused) {
          const temp = audioRef.current!
          audioRef.current = nextAudio
          nextAudioRef.current = temp
          audioEngine.element = audioRef.current
          nextAudioRef.current.pause()
          nextAudioRef.current.src = ''
          preloadedForRef.current = null
          playNext()
        } else {
          playNext()
        }
      }
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onWaiting = () => setIsLoading(true)
    const onCanPlay = () => setIsLoading(false)
    const onError = (e: any) => {
      console.error('[Audio Error]', e, audio.error ? { code: audio.error.code, message: audio.error.message } : null)
      setIsLoading(false)
      setIsPlaying(false)
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

  useEffect(() => {
    if (!currentTrack) return
    setIsLoading(true)
    crossfadingRef.current = false
    preloadedForRef.current = null
    if (nextAudioRef.current) {
      nextAudioRef.current.pause()
      nextAudioRef.current.src = ''
    }
    api.getStream(currentTrack.id)
      .then(({ url }) => setStreamUrl(url))
      .catch(() => setIsLoading(false))
    addToHistory(currentTrack)

    // Eagerly warm the server-side resolveStreamInfo cache for the next track
    // so info.download() returns instantly (from cache) when the queue advances.
    const { queue, queueIndex } = usePlayerStore.getState()
    const nextTrack = queue[queueIndex + 1]
    if (nextTrack) api.prefetchStream(nextTrack.id)
  }, [currentTrack?.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !streamUrl) return
    audio.src = streamUrl
    audio.playbackRate = settings.playbackSpeed
    audio.load()
    if (isPlaying) audio.play().catch(() => setIsPlaying(false))
  }, [streamUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !streamUrl) return
    if (isPlaying) {
      // Resume AudioContext first — browsers suspend it until a user gesture.
      // Without this the audio loads but produces no output.
      audioEngine.context?.resume().catch(() => {})
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }

    if (window.electron?.setThumbarButtons) {
      window.electron.setThumbarButtons(isPlaying)
    }
  }, [isPlaying])

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
    return () => {
      if (window.electron?.offMediaCommand) {
        window.electron.offMediaCommand()
      }
    }
  }, [playNext, setIsPlaying])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = isMuted ? 0 : volume
  }, [volume, isMuted])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = settings.playbackSpeed
  }, [settings.playbackSpeed])

  useEffect(() => {
    settings.eqBands.forEach((gain, index) => {
      audioEngine.setEqBand(index, gain)
    })
  }, [settings.eqBands])

  useEffect(() => {
    if (!currentTrack) {
      if (settings.discordEnabled) api.discordClear().catch(() => {})
      return
    }
    if (settings.discordEnabled && isPlaying) {
      api.discordActivity({
        title: currentTrack.title,
        artist: currentTrack.artists.map(a => a.name).join(', '),
        album: currentTrack.album,
        thumbnail: currentTrack.thumbnail,
        startTimestamp: Date.now(),
      }).catch(() => {})
    } else if (settings.discordEnabled && !isPlaying) {
      api.discordClear().catch(() => {})
    }
  }, [currentTrack?.id, isPlaying, settings.discordEnabled])

  useEffect(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current)
      sleepTimerRef.current = null
    }
    if (settings.sleepTimerMinutes && settings.sleepTimerMinutes > 0 && isPlaying) {
      sleepTimerRef.current = setTimeout(() => {
        setIsPlaying(false)
        settings.setSleepTimer(null)
      }, settings.sleepTimerMinutes * 60 * 1000)
    }
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current)
    }
  }, [settings.sleepTimerMinutes, isPlaying])

  useEffect(() => {
    if (!currentTrack || !isPlaying) return
    if (!settings.crossfadeDuration && !settings.gaplessPlayback) return

    const interval = setInterval(() => {
      const nextTrack = queue[queueIndex + 1]
      if (!nextTrack || nextTrack.id === preloadedForRef.current) return
      const audio = audioRef.current
      if (!audio || !audio.duration) return

      const timeLeft = audio.duration - audio.currentTime
      const preloadThreshold = Math.max((settings.crossfadeDuration || 0) + 10, 30)
      if (timeLeft <= preloadThreshold) {
        preloadedForRef.current = nextTrack.id
        api.getStream(nextTrack.id)
          .then(({ url }) => {
            const nextAudio = nextAudioRef.current
            if (!nextAudio || preloadedForRef.current !== nextTrack.id) return
            nextAudio.src = url
            nextAudio.load()
          })
          .catch(() => { preloadedForRef.current = null })
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [currentTrack?.id, isPlaying, queueIndex, settings.crossfadeDuration, settings.gaplessPlayback])

  const seek = useCallback((time: number) => {
    audioEngine.seek(time)
    setProgress(time)
  }, [setProgress])

  return { audioRef, seek }
}
