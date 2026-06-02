import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus, Heart, Music2, Disc3, User, ListMusic, Trash2, Download, HardDrive, Loader2, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import { proxyImage, api } from '../api/client'
import TrackItem from '../components/TrackItem'
import ChipsRow from '../components/ChipsRow'
import SpotifyImportModal from '../components/SpotifyImportModal'
import styles from './LibraryScreen.module.css'

const TABS = [
  { label: 'Songs', value: 'songs' },
  { label: 'Artists', value: 'artists' },
  { label: 'Albums', value: 'albums' },
  { label: 'Playlists', value: 'playlists' },
  { label: 'Downloads', value: 'downloads' },
]

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function LibraryScreen() {
  const [tab, setTab] = useState('songs')
  const [showNewPlaylist, setShowNewPlaylist] = useState(false)
  const [showSpotifyModal, setShowSpotifyModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [downloadIds, setDownloadIds] = useState<string[]>([])
  const [downloadsLoading, setDownloadsLoading] = useState(false)
  const [expandedDownloadGroup, setExpandedDownloadGroup] = useState<string | null>(null)
  const { likedSongs, playlists, savedPlaylists, history, createPlaylist, deletePlaylist, unsavePlaylist, downloads, removeDownload, downloadedMeta } = useLibraryStore()
  const { setQueue } = usePlayerStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (tab !== 'downloads') return
    setDownloadsLoading(true)
    api.getDownloads().then(({ ids }) => {
      setDownloadIds(ids)
      setDownloadsLoading(false)
    }).catch(() => setDownloadsLoading(false))
  }, [tab])

  const downloadedTracks = useMemo(() => {
    const allTracks = [...likedSongs, ...history]
    const seen = new Set<string>()
    return downloadIds.map(id => {
      if (downloadedMeta[id]) {
        if (!seen.has(id)) { seen.add(id); return downloadedMeta[id] }
      }
      const found = allTracks.find(t => t.id === id)
      if (found && !seen.has(id)) { seen.add(id); return found }
      return { id, title: id, artists: [], thumbnail: '' }
    }).filter(Boolean)
  }, [downloadIds, downloadedMeta, likedSongs, history])

  const handleCreatePlaylist = () => {
    if (!newName.trim()) return
    createPlaylist(newName.trim())
    setNewName('')
    setShowNewPlaylist(false)
  }

  const playLiked = () => {
    if (likedSongs.length > 0) setQueue(likedSongs, 0)
  }

  const downloadGroups = useMemo(() => {
    const groups: Record<string, { type: string, id: string, title: string, thumbnail: string, tracks: any[] }> = {}
    const individuals: any[] = []
    for (const t of downloadedTracks) {
      if (t.context) {
        if (!groups[t.context.id]) {
          groups[t.context.id] = { ...t.context, thumbnail: t.thumbnail, tracks: [] }
        }
        groups[t.context.id].tracks.push(t)
      } else {
        individuals.push(t)
      }
    }
    return { groups: Object.values(groups), individuals }
  }, [downloadedTracks])

  const expandedGroupData = expandedDownloadGroup ? downloadGroups.groups.find(g => g.id === expandedDownloadGroup) : null

  const topArtists = (() => {
    const counts: Record<string, { name: string; count: number; thumbnail: string; id?: string }> = {}
    for (const track of history) {
      for (const artist of track.artists || []) {
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
          artist: (track.artists || []).map(a => a.name).join(', '),
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={styles.addBtn} onClick={() => setShowSpotifyModal(true)} style={{ background: '#1DB954', color: '#fff' }}>
              <Plus size={18} />
              Import Spotify
            </button>
            <button className={styles.addBtn} onClick={() => setShowNewPlaylist(true)}>
              <Plus size={18} />
              New Playlist
            </button>
          </div>
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

      {showSpotifyModal && (
        <SpotifyImportModal onClose={() => setShowSpotifyModal(false)} />
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
          {playlists.length === 0 && (!savedPlaylists || savedPlaylists.length === 0) ? (
            <div className={styles.empty}>
              <ListMusic size={56} color="var(--outline)" />
              <p>No playlists yet</p>
              <span>Create or save a playlist to organize your music</span>
            </div>
          ) : (
            <div className={styles.playlistGrid}>
              {(savedPlaylists || []).map(pl => (
                <div key={pl.id} className={styles.playlistCard} onClick={() => navigate(`/playlist/${pl.id}`)}>
                  <div className={styles.playlistArt}>
                    {pl.thumbnail
                      ? <img src={proxyImage(pl.thumbnail)} alt="" />
                      : <ListMusic size={32} color="var(--on-surface-variant)" />}
                  </div>
                  <div className={styles.playlistInfo}>
                    <div className={styles.playlistName}>{pl.title}</div>
                    <div className={styles.playlistCount}>Saved Playlist</div>
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={e => { e.stopPropagation(); unsavePlaylist(pl.id) }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {playlists.map(pl => (
                <div key={pl.id} className={styles.playlistCard} onClick={() => navigate(`/playlist/${pl.id}`)}>
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
      {tab === 'downloads' && (
        <div className={styles.content}>
          {downloadsLoading ? (
            <div className={styles.empty}>
              <Loader2 size={40} className={styles.spinIcon} color="var(--primary)" />
              <p>Loading downloads…</p>
            </div>
          ) : downloadedTracks.length === 0 ? (
            <div className={styles.empty}>
              <HardDrive size={56} color="var(--outline)" />
              <p>No downloads yet</p>
              <span>Download songs from album or artist pages to listen offline</span>
            </div>
          ) : expandedGroupData ? (
            <>
              <div className={styles.playAllRow} style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    style={{ background: 'transparent', border: 'none', color: 'var(--on-surface)', cursor: 'pointer', display: 'flex', padding: '8px' }}
                    onClick={() => setExpandedDownloadGroup(null)}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{expandedGroupData.title}</h2>
                </div>
                <button className={styles.playAllBtn} onClick={() => setQueue(expandedGroupData.tracks, 0, { type: expandedGroupData.type as any, id: expandedGroupData.id, title: expandedGroupData.title })}>
                  <Play size={16} fill="var(--primary)" color="var(--primary)" />
                  Play All ({expandedGroupData.tracks.length})
                </button>
              </div>
              {expandedGroupData.tracks.map((track, i) => (
                <TrackItem key={track.id} track={track as any} index={i} queue={expandedGroupData.tracks as any} showArt />
              ))}
            </>
          ) : (
            <>
              <div className={styles.playAllRow}>
                <button className={styles.playAllBtn} onClick={() => setQueue(downloadedTracks, 0)}>
                  <Download size={16} color="var(--primary)" />
                  Play All Downloads ({downloadedTracks.length})
                </button>
              </div>

              {downloadGroups.groups.length > 0 && (
                <div className={styles.playlistGrid} style={{ marginBottom: '24px' }}>
                  {downloadGroups.groups.map(g => (
                    <div key={g.id} className={styles.playlistCard} onClick={() => setExpandedDownloadGroup(g.id)}>
                      <div className={styles.playlistArt}>
                        {g.thumbnail ? <img src={proxyImage(g.thumbnail)} alt="" /> : <Disc3 size={32} color="var(--on-surface-variant)" />}
                      </div>
                      <div className={styles.playlistInfo}>
                        <div className={styles.playlistName}>{g.title}</div>
                        <div className={styles.playlistCount}>Downloaded {g.type} • {g.tracks.length} songs</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {downloadGroups.individuals.length > 0 && (
                <>
                  {downloadGroups.groups.length > 0 && <h3 style={{ fontSize: '14px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', paddingLeft: '12px' }}>Individual Songs</h3>}
                  {downloadGroups.individuals.map((track, i) => (
                    <TrackItem
                      key={track.id}
                      track={track as any}
                      index={i}
                      queue={downloadGroups.individuals as any}
                      showArt
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  )
}
