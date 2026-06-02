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
  savedPlaylists: { id: string, title: string, thumbnail?: string }[]
  playlists: PlaylistLocal[]
  history: Track[]
  downloads: Record<string, DownloadStatus>
  downloadedMeta: Record<string, Track>

  likeSong: (track: Track) => void
  unlikeSong: (id: string) => void
  isLiked: (id: string) => boolean
  
  savePlaylist: (playlist: { id: string, title: string, thumbnail?: string }) => void
  unsavePlaylist: (id: string) => void
  isPlaylistSaved: (id: string) => boolean

  createPlaylist: (name: string) => string
  deletePlaylist: (id: string) => void
  addToPlaylist: (playlistId: string, track: Track) => void
  removeFromPlaylist: (playlistId: string, trackId: string) => void
  renamePlaylist: (id: string, name: string) => void
  reorderPlaylist: (id: string, newOrder: Track[]) => void

  addToHistory: (track: Track) => void
  clearHistory: () => void

  setDownloadStatus: (videoId: string, status: DownloadStatus) => void
  removeDownload: (videoId: string) => void
  getDownloadStatus: (videoId: string) => DownloadStatus | undefined
  setDownloadMeta: (track: Track) => void
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      likedSongs: [],
      savedPlaylists: [],
      playlists: [],
      history: [],
      downloads: {},
      downloadedMeta: {},

      likeSong: (track) => set(s => {
        if (s.likedSongs.find(t => t.id === track.id)) return s
        return { likedSongs: [track, ...s.likedSongs] }
      }),
      unlikeSong: (id) => set(s => ({ likedSongs: s.likedSongs.filter(t => t.id !== id) })),
      isLiked: (id) => !!get().likedSongs.find(t => t.id === id),

      savePlaylist: (playlist) => set(s => {
        if (s.savedPlaylists?.find(p => p.id === playlist.id)) return s
        return { savedPlaylists: [playlist, ...(s.savedPlaylists || [])] }
      }),
      unsavePlaylist: (id) => set(s => ({ savedPlaylists: (s.savedPlaylists || []).filter(p => p.id !== id) })),
      isPlaylistSaved: (id) => !!(get().savedPlaylists || []).find(p => p.id === id),

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
      reorderPlaylist: (id, newOrder) => set(s => ({
        playlists: s.playlists.map(p => p.id === id ? { ...p, tracks: newOrder } : p),
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
        const m = { ...s.downloadedMeta }
        delete d[videoId]
        delete m[videoId]
        return { downloads: d, downloadedMeta: m }
      }),
      getDownloadStatus: (videoId) => get().downloads[videoId],
      setDownloadMeta: (track) => set(s => ({
        downloadedMeta: { ...s.downloadedMeta, [track.id]: track }
      })),
    }),
    { name: 'velune-library' }
  )
)
