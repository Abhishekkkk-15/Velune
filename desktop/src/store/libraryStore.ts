import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Track } from './playerStore'

export interface PlaylistLocal {
  id: string
  name: string
  tracks: Track[]
  createdAt: number
  thumbnail?: string
}

type DownloadStatus = 'pending' | 'downloading' | 'done' | 'error'

interface LibraryState {
  likedSongs: Track[]
  playlists: PlaylistLocal[]
  history: Track[]
  downloads: Record<string, DownloadStatus>

  likeSong: (track: Track) => void
  unlikeSong: (id: string) => void
  isLiked: (id: string) => boolean

  createPlaylist: (name: string) => string
  deletePlaylist: (id: string) => void
  addToPlaylist: (playlistId: string, track: Track) => void
  removeFromPlaylist: (playlistId: string, trackId: string) => void
  renamePlaylist: (id: string, name: string) => void

  addToHistory: (track: Track) => void
  clearHistory: () => void

  setDownloadStatus: (videoId: string, status: DownloadStatus) => void
  removeDownload: (videoId: string) => void
  getDownloadStatus: (videoId: string) => DownloadStatus | undefined
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      likedSongs: [],
      playlists: [],
      history: [],
      downloads: {},

      likeSong: (track) => set(s => {
        if (s.likedSongs.find(t => t.id === track.id)) return s
        return { likedSongs: [track, ...s.likedSongs] }
      }),
      unlikeSong: (id) => set(s => ({ likedSongs: s.likedSongs.filter(t => t.id !== id) })),
      isLiked: (id) => !!get().likedSongs.find(t => t.id === id),

      createPlaylist: (name) => {
        const id = `pl_${Date.now()}`
        set(s => ({
          playlists: [...s.playlists, { id, name, tracks: [], createdAt: Date.now() }],
        }))
        return id
      },
      deletePlaylist: (id) => set(s => ({ playlists: s.playlists.filter(p => p.id !== id) })),
      addToPlaylist: (playlistId, track) => set(s => ({
        playlists: s.playlists.map(p =>
          p.id === playlistId && !p.tracks.find(t => t.id === track.id)
            ? { ...p, tracks: [...p.tracks, track] }
            : p
        ),
      })),
      removeFromPlaylist: (playlistId, trackId) => set(s => ({
        playlists: s.playlists.map(p =>
          p.id === playlistId ? { ...p, tracks: p.tracks.filter(t => t.id !== trackId) } : p
        ),
      })),
      renamePlaylist: (id, name) => set(s => ({
        playlists: s.playlists.map(p => p.id === id ? { ...p, name } : p),
      })),

      addToHistory: (track) => set(s => {
        const filtered = s.history.filter(t => t.id !== track.id)
        return { history: [track, ...filtered].slice(0, 200) }
      }),
      clearHistory: () => set({ history: [] }),

      setDownloadStatus: (videoId, status) => set(s => ({
        downloads: { ...s.downloads, [videoId]: status },
      })),
      removeDownload: (videoId) => set(s => {
        const d = { ...s.downloads }
        delete d[videoId]
        return { downloads: d }
      }),
      getDownloadStatus: (videoId) => get().downloads[videoId],
    }),
    { name: 'velune-library' }
  )
)
