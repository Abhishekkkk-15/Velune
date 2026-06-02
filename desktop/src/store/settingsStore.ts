import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  accentColor: string
  dynamicColor: boolean

  crossfadeDuration: number
  gaplessPlayback: boolean
  playbackSpeed: number

  sleepTimerMinutes: number | null

  maxCacheSize: number

  lastfmEnabled: boolean
  lastfmSessionKey: string
  lastfmUsername: string
  lastfmApiKey: string
  lastfmApiSecret: string
  lastfmScrobbleThreshold: number

  discordEnabled: boolean
  discordToken: string

  spotifyClientId: string
  spotifyClientSecret: string

  eqBands: number[]
  playerTheme: 'default' | 'spotify'
  miniPlayerTheme: 'floating' | 'vinyl' | 'docked'

  setAccentColor: (v: string) => void
  setDynamicColor: (v: boolean) => void
  setCrossfade: (v: number) => void
  setGapless: (v: boolean) => void
  setPlaybackSpeed: (v: number) => void
  setSleepTimer: (v: number | null) => void
  setMaxCacheSize: (v: number) => void
  setLastfmEnabled: (v: boolean) => void
  setLastfmSessionKey: (v: string) => void
  setLastfmUsername: (v: string) => void
  setLastfmApiKey: (v: string) => void
  setLastfmApiSecret: (v: string) => void
  setLastfmScrobbleThreshold: (v: number) => void
  setDiscordEnabled: (v: boolean) => void
  setDiscordToken: (v: string) => void
  setSpotifyClientId: (v: string) => void
  setSpotifyClientSecret: (v: string) => void
  setEqBand: (index: number, gain: number) => void
  setPlayerTheme: (v: 'default' | 'spotify') => void
  setMiniPlayerTheme: (v: 'floating' | 'vinyl' | 'docked') => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      accentColor: '#ED5564',
      dynamicColor: true,

      crossfadeDuration: 0,
      gaplessPlayback: true,
      playbackSpeed: 1,

      sleepTimerMinutes: null,

      maxCacheSize: 1024,

      lastfmEnabled: false,
      lastfmSessionKey: '',
      lastfmUsername: '',
      lastfmApiKey: '',
      lastfmApiSecret: '',
      lastfmScrobbleThreshold: 50,

      discordEnabled: false,
      discordToken: '',

      spotifyClientId: '',
      spotifyClientSecret: '',

      eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      playerTheme: 'default',
      miniPlayerTheme: 'floating',

      setAccentColor: (v) => set({ accentColor: v }),
      setDynamicColor: (v) => set({ dynamicColor: v }),
      setCrossfade: (v) => set({ crossfadeDuration: v }),
      setGapless: (v) => set({ gaplessPlayback: v }),
      setPlaybackSpeed: (v) => set({ playbackSpeed: v }),
      setSleepTimer: (v) => set({ sleepTimerMinutes: v }),
      setMaxCacheSize: (v) => set({ maxCacheSize: v }),
      setLastfmEnabled: (v) => set({ lastfmEnabled: v }),
      setLastfmSessionKey: (v) => set({ lastfmSessionKey: v }),
      setLastfmUsername: (v) => set({ lastfmUsername: v }),
      setLastfmApiKey: (v) => set({ lastfmApiKey: v }),
      setLastfmApiSecret: (v) => set({ lastfmApiSecret: v }),
      setLastfmScrobbleThreshold: (v) => set({ lastfmScrobbleThreshold: v }),
      setDiscordEnabled: (v) => set({ discordEnabled: v }),
      setDiscordToken: (v) => set({ discordToken: v }),
      setSpotifyClientId: (v) => set({ spotifyClientId: v }),
      setSpotifyClientSecret: (v) => set({ spotifyClientSecret: v }),
      setEqBand: (index, gain) => set((s) => {
        const next = [...s.eqBands]
        next[index] = gain
        return { eqBands: next }
      }),
      setPlayerTheme: (v) => set({ playerTheme: v }),
      setMiniPlayerTheme: (v) => set({ miniPlayerTheme: v }),
    }),
    { name: 'velune-settings' }
  )
)
