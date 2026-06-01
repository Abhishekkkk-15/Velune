import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  darkMode: boolean
  pureBlack: boolean
  accentColor: string
  dynamicColor: boolean
  useSystemFont: boolean

  crossfadeDuration: number
  gaplessPlayback: boolean
  playbackSpeed: number
  normalization: boolean
  audioQuality: 'low' | 'medium' | 'high' | 'auto'

  sleepTimerMinutes: number | null

  contentLanguage: string
  contentRegion: string

  maxCacheSize: number

  lastfmEnabled: boolean
  lastfmSessionKey: string
  lastfmUsername: string
  lastfmApiKey: string
  lastfmApiSecret: string
  lastfmScrobbleThreshold: number

  discordEnabled: boolean
  discordToken: string

  eqBands: number[]

  setDarkMode: (v: boolean) => void
  setPureBlack: (v: boolean) => void
  setAccentColor: (v: string) => void
  setDynamicColor: (v: boolean) => void
  setCrossfade: (v: number) => void
  setGapless: (v: boolean) => void
  setPlaybackSpeed: (v: number) => void
  setNormalization: (v: boolean) => void
  setAudioQuality: (v: 'low' | 'medium' | 'high' | 'auto') => void
  setSleepTimer: (v: number | null) => void
  setContentLanguage: (v: string) => void
  setContentRegion: (v: string) => void
  setMaxCacheSize: (v: number) => void
  setLastfmEnabled: (v: boolean) => void
  setLastfmSessionKey: (v: string) => void
  setLastfmUsername: (v: string) => void
  setLastfmApiKey: (v: string) => void
  setLastfmApiSecret: (v: string) => void
  setLastfmScrobbleThreshold: (v: number) => void
  setDiscordEnabled: (v: boolean) => void
  setDiscordToken: (v: string) => void
  setUseSystemFont: (v: boolean) => void
  setEqBand: (index: number, gain: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      darkMode: true,
      pureBlack: false,
      accentColor: '#ED5564',
      dynamicColor: true,
      useSystemFont: false,

      crossfadeDuration: 0,
      gaplessPlayback: true,
      playbackSpeed: 1,
      normalization: false,
      audioQuality: 'auto',

      sleepTimerMinutes: null,

      contentLanguage: 'en',
      contentRegion: 'US',

      maxCacheSize: 1024,

      lastfmEnabled: false,
      lastfmSessionKey: '',
      lastfmUsername: '',
      lastfmApiKey: '',
      lastfmApiSecret: '',
      lastfmScrobbleThreshold: 50,

      discordEnabled: false,
      discordToken: '',

      eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],

      setDarkMode: (v) => set({ darkMode: v }),
      setPureBlack: (v) => set({ pureBlack: v }),
      setAccentColor: (v) => set({ accentColor: v }),
      setDynamicColor: (v) => set({ dynamicColor: v }),
      setCrossfade: (v) => set({ crossfadeDuration: v }),
      setGapless: (v) => set({ gaplessPlayback: v }),
      setPlaybackSpeed: (v) => set({ playbackSpeed: v }),
      setNormalization: (v) => set({ normalization: v }),
      setAudioQuality: (v) => set({ audioQuality: v }),
      setSleepTimer: (v) => set({ sleepTimerMinutes: v }),
      setContentLanguage: (v) => set({ contentLanguage: v }),
      setContentRegion: (v) => set({ contentRegion: v }),
      setMaxCacheSize: (v) => set({ maxCacheSize: v }),
      setLastfmEnabled: (v) => set({ lastfmEnabled: v }),
      setLastfmSessionKey: (v) => set({ lastfmSessionKey: v }),
      setLastfmUsername: (v) => set({ lastfmUsername: v }),
      setLastfmApiKey: (v) => set({ lastfmApiKey: v }),
      setLastfmApiSecret: (v) => set({ lastfmApiSecret: v }),
      setLastfmScrobbleThreshold: (v) => set({ lastfmScrobbleThreshold: v }),
      setDiscordEnabled: (v) => set({ discordEnabled: v }),
      setDiscordToken: (v) => set({ discordToken: v }),
      setUseSystemFont: (v) => set({ useSystemFont: v }),
      setEqBand: (index, gain) => set((s) => {
        const next = [...s.eqBands]
        next[index] = gain
        return { eqBands: next }
      }),
    }),
    { name: 'velune-settings' }
  )
)
