import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Track {
  id: string
  title: string
  artists: { id?: string; name: string }[]
  album?: string
  thumbnail: string
  duration?: number
  explicit?: boolean
}

type RepeatMode = 'off' | 'one' | 'all'

interface PlayerState {
  currentTrack: Track | null
  queue: Track[]
  queueIndex: number
  isPlaying: boolean
  progress: number
  duration: number
  volume: number
  isMuted: boolean
  shuffle: boolean
  repeat: RepeatMode
  streamUrl: string | null
  isLoading: boolean
  showFullPlayer: boolean
  showQueue: boolean
  accentColor: string
  isWidgetMode: boolean

  setCurrentTrack: (track: Track) => void
  setQueue: (tracks: Track[], index?: number) => void
  addToQueue: (track: Track) => void
  removeFromQueue: (index: number) => void
  reorderQueue: (from: number, to: number) => void
  playNext: () => void
  playPrev: () => void
  playAt: (index: number) => void
  setIsPlaying: (v: boolean) => void
  setProgress: (v: number) => void
  setDuration: (v: number) => void
  setVolume: (v: number) => void
  setMuted: (v: boolean) => void
  toggleShuffle: () => void
  toggleRepeat: () => void
  setStreamUrl: (url: string | null) => void
  setIsLoading: (v: boolean) => void
  toggleFullPlayer: () => void
  setShowFullPlayer: (v: boolean) => void
  toggleQueue: () => void
  setAccentColor: (c: string) => void
  setIsWidgetMode: (v: boolean) => void
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      queueIndex: 0,
      isPlaying: false,
      progress: 0,
      duration: 0,
      volume: 0.8,
      isMuted: false,
      shuffle: false,
      repeat: 'off',
      streamUrl: null,
      isLoading: false,
      showFullPlayer: false,
      showQueue: false,
      accentColor: '#ED5564',

      isWidgetMode: false,

      setCurrentTrack: (track) => set({ currentTrack: track, streamUrl: null, progress: 0, isLoading: true }),
      setQueue: (tracks, index = 0) => {
        const track = tracks[index]
        set({ queue: tracks, queueIndex: index, currentTrack: track, streamUrl: null, progress: 0, isLoading: true, isPlaying: true })
      },
      addToQueue: (track) => set(s => ({ queue: [...s.queue, track] })),
      removeFromQueue: (index) => set(s => {
        const q = [...s.queue]
        q.splice(index, 1)
        const newIndex = index < s.queueIndex
          ? s.queueIndex - 1
          : s.queueIndex
        return { queue: q, queueIndex: Math.max(0, Math.min(newIndex, q.length - 1)) }
      }),
      reorderQueue: (from, to) => set(s => {
        const q = [...s.queue]
        const [item] = q.splice(from, 1)
        q.splice(to, 0, item)
        let newIndex = s.queueIndex
        if (from === s.queueIndex) newIndex = to
        else if (from < s.queueIndex && to >= s.queueIndex) newIndex = s.queueIndex - 1
        else if (from > s.queueIndex && to <= s.queueIndex) newIndex = s.queueIndex + 1
        return { queue: q, queueIndex: newIndex }
      }),
      playNext: () => {
        const { queue, queueIndex, shuffle, repeat } = get()
        if (queue.length === 0) return
        if (repeat === 'all') {
          const next = shuffle
            ? Math.floor(Math.random() * queue.length)
            : (queueIndex + 1) % queue.length
          const track = queue[next]
          set({ queueIndex: next, currentTrack: track, streamUrl: null, progress: 0, isLoading: true, isPlaying: true })
        } else if (shuffle) {
          const next = Math.floor(Math.random() * queue.length)
          const track = queue[next]
          set({ queueIndex: next, currentTrack: track, streamUrl: null, progress: 0, isLoading: true, isPlaying: true })
        } else if (queueIndex < queue.length - 1) {
          const next = queueIndex + 1
          const track = queue[next]
          set({ queueIndex: next, currentTrack: track, streamUrl: null, progress: 0, isLoading: true, isPlaying: true })
        } else {
          set({ isPlaying: false, progress: 0 })
        }
      },
      playPrev: () => {
        const { queue, queueIndex, progress } = get()
        if (progress > 3) {
          set({ progress: 0 })
          return
        }
        const prev = Math.max(queueIndex - 1, 0)
        const track = queue[prev]
        set({ queueIndex: prev, currentTrack: track, streamUrl: null, progress: 0, isLoading: true, isPlaying: true })
      },
      playAt: (index) => {
        const { queue } = get()
        const track = queue[index]
        if (!track) return
        set({ queueIndex: index, currentTrack: track, streamUrl: null, progress: 0, isLoading: true, isPlaying: true })
      },
      setIsPlaying: (v) => set({ isPlaying: v }),
      setProgress: (v) => set({ progress: v }),
      setDuration: (v) => set({ duration: v }),
      setVolume: (v) => set({ volume: v, isMuted: false }),
      setMuted: (v) => set({ isMuted: v }),
      toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),
      toggleRepeat: () => set(s => {
        const next: RepeatMode = s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off'
        return { repeat: next }
      }),
      setStreamUrl: (url) => set({ streamUrl: url, isLoading: false }),
      setIsLoading: (v) => set({ isLoading: v }),
      toggleFullPlayer: () => set(s => ({ showFullPlayer: !s.showFullPlayer, showQueue: s.showFullPlayer ? s.showQueue : false })),
      setShowFullPlayer: (v) => set(s => ({ showFullPlayer: v, showQueue: v ? false : s.showQueue })),
      toggleQueue: () => set(s => ({ showQueue: !s.showQueue, showFullPlayer: !s.showQueue ? false : s.showFullPlayer })),
      setAccentColor: (c) => set({ accentColor: c }),
      setIsWidgetMode: (v) => set({ isWidgetMode: v }),
    }),
    {
      name: 'velune-player',
      partialize: (s) => ({ volume: s.volume, isMuted: s.isMuted, shuffle: s.shuffle, repeat: s.repeat }),
    }
  )
)
