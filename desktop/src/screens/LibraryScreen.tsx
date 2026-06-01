import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Heart, Music2, Disc3, User, ListMusic, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import { proxyImage } from '../api/client'
import TrackItem from '../components/TrackItem'
import ChipsRow from '../components/ChipsRow'
import styles from './LibraryScreen.module.css'

const TABS = [
  { label: 'Songs', value: 'songs' },
  { label: 'Artists', value: 'artists' },
  { label: 'Albums', value: 'albums' },
  { label: 'Playlists', value: 'playlists' },
]

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function LibraryScreen() {
  const [tab, setTab] = useState('songs')
  const [showNewPlaylist, setShowNewPlaylist] = useState(false)
  const [newName, setNewName] = useState('')
  const { likedSongs, playlists, history, createPlaylist, deletePlaylist } = useLibraryStore()
  const { setQueue } = usePlayerStore()
  const navigate = useNavigate()

  const handleCreatePlaylist = () => {
    if (!newName.trim()) return
    createPlaylist(newName.trim())
    setNewName('')
    setShowNewPlaylist(false)
  }

  const playLiked = () => {
    if (!likedSongs.length) return
    setQueue(likedSongs, 0)
  }

  const topArtists = (() => {
    const counts: Record<string, { name: string; count: number; thumbnail: string; id?: string }> = {}
    for (const track of history) {
      for (const artist of track.artists) {
        if (!counts[artist.name]) {
          counts[artist.name] = { name: artist.name, count: 0, thumbnail: track.thumbnail, id: artist.id }
        }
        counts[artist.name].count++
      }
    }
    return Object.values(counts).sort((a, b) => b.count - a.count)
  })()

  const topAlbums = (() => {
    const seen = new Map<string, { title: string; thumbnail: string; artist: string; count: number }>()
    for (const track of history) {
      if (!track.album) continue
      const key = track.album
      if (!seen.has(key)) {
        seen.set(key, {
          title: track.album,
          thumbnail: track.thumbnail,
          artist: track.artists.map(a => a.name).join(', '),
          count: 0,
        })
      }
      seen.get(key)!.count++
    }
    return Array.from(seen.values()).sort((a, b) => b.count - a.count)
  })()

  return (
    <motion.div
      className={styles.page}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25 }}
    >
      <div className={styles.header}>
        <h1 className={styles.title}>Library</h1>
        {tab === 'playlists' && (
          <button className={styles.addBtn} onClick={() => setShowNewPlaylist(true)}>
            <Plus size={18} />
            New Playlist
          </button>
        )}
      </div>

      <div className={styles.tabs}>
        <ChipsRow
          chips={TABS}
          selected={tab}
          onSelect={v => setTab(v || 'songs')}
        />
      </div>

      {showNewPlaylist && (
        <div className={styles.newPlaylist}>
          <input
            className={styles.nameInput}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Playlist name"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleCreatePlaylist() }}
          />
          <button className={styles.createBtn} onClick={handleCreatePlaylist}>Create</button>
          <button className={styles.cancelBtn} onClick={() => setShowNewPlaylist(false)}>Cancel</button>
        </div>
      )}

      {tab === 'songs' && (
        <div className={styles.content}>
          {likedSongs.length === 0 ? (
            <div className={styles.empty}>
              <Heart size={56} color="var(--outline)" />
              <p>No liked songs yet</p>
              <span>Heart songs to save them here</span>
            </div>
          ) : (
            <>
              <div className={styles.playAllRow}>
                <button className={styles.playAllBtn} onClick={playLiked}>
                  <Heart size={16} fill="var(--primary)" color="var(--primary)" />
                  Play Liked Songs ({likedSongs.length})
                </button>
              </div>
              {likedSongs.map((track, i) => (
                <TrackItem
                  key={track.id}
                  track={track as any}
                  index={i}
                  queue={likedSongs as any}
                  showArt
                />
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'artists' && (
        <div className={styles.content}>
          {topArtists.length === 0 ? (
            <div className={styles.empty}>
              <User size={56} color="var(--outline)" />
              <p>No artists yet</p>
              <span>Artists from your listening history appear here</span>
            </div>
          ) : (
            <div className={styles.artistGrid}>
              {topArtists.map(artist => (
                <div
                  key={artist.name}
                  className={styles.artistCard}
                  onClick={() => artist.id && navigate(`/artist/${artist.id}`)}
                >
                  <img
                    src={proxyImage(artist.thumbnail)}
                    alt={artist.name}
                    className={styles.artistAvatar}
                  />
                  <div className={styles.artistName}>{artist.name}</div>
                  <div className={styles.artistCount}>{artist.count} plays</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'albums' && (
        <div className={styles.content}>
          {topAlbums.length === 0 ? (
            <div className={styles.empty}>
              <Disc3 size={56} color="var(--outline)" />
              <p>No albums yet</p>
              <span>Albums from your listening history appear here</span>
            </div>
          ) : (
            <div className={styles.albumGrid}>
              {topAlbums.map(album => (
                <div key={album.title} className={styles.albumCard}>
                  <img
                    src={proxyImage(album.thumbnail)}
                    alt={album.title}
                    className={styles.albumArt}
                  />
                  <div className={styles.albumTitle}>{album.title}</div>
                  <div className={styles.albumArtist}>{album.artist}</div>
                  <div className={styles.albumCount}>{album.count} plays</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'playlists' && (
        <div className={styles.content}>
          {playlists.length === 0 ? (
            <div className={styles.empty}>
              <ListMusic size={56} color="var(--outline)" />
              <p>No playlists yet</p>
              <span>Create a playlist to organize your music</span>
            </div>
          ) : (
            <div className={styles.playlistGrid}>
              {playlists.map(pl => (
                <div key={pl.id} className={styles.playlistCard} onClick={() => {
                  if (pl.tracks.length > 0) setQueue(pl.tracks, 0)
                }}>
                  <div className={styles.playlistArt}>
                    {pl.tracks[0]?.thumbnail
                      ? <img src={proxyImage(pl.tracks[0].thumbnail)} alt="" />
                      : <Music2 size={32} color="var(--on-surface-variant)" />}
                  </div>
                  <div className={styles.playlistInfo}>
                    <div className={styles.playlistName}>{pl.name}</div>
                    <div className={styles.playlistCount}>{pl.tracks.length} songs</div>
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={e => { e.stopPropagation(); deletePlaylist(pl.id) }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
