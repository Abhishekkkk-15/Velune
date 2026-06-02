import { useState } from 'react'
import { Play, MoreHorizontal, Heart, ListPlus, Plus, Download, CheckCircle, Loader2, FolderPlus, ListMusic, Disc3, User } from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { useLibraryStore } from '../store/libraryStore'
import { proxyImage, api } from '../api/client'
import type { YTTrack } from '../api/client'
import styles from './TrackItem.module.css'

function formatDuration(s?: number) {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

interface Props {
  track: YTTrack & { context?: { type: string; id: string; title: string } }
  index?: number
  queue?: YTTrack[]
  showAlbum?: boolean
  showArt?: boolean
  compact?: boolean
}

export default function TrackItem({ track, index, queue, showAlbum, showArt = true, compact }: Props) {
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [newPlaylistMode, setNewPlaylistMode] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')

  const { setQueue, addToQueue, currentTrack, isPlaying } = usePlayerStore()
  const {
    isLiked, likeSong, unlikeSong,
    playlists, addToPlaylist, createPlaylist,
    getDownloadStatus, setDownloadStatus, removeDownload, setDownloadMeta
  } = useLibraryStore()

  const isActive = currentTrack?.id === track.id
  const liked = isLiked(track.id)
  const dlStatus = getDownloadStatus(track.id)
  const thumbnail = proxyImage(track.thumbnail)

  const toTrack = (t: YTTrack) => ({
    id: t.id, title: t.title, artists: t.artists,
    album: t.album, thumbnail: t.thumbnail, duration: t.duration, explicit: t.explicit,
  })

  const handlePlay = () => {
    const tracks = queue || [track]
    const idx = queue ? queue.findIndex(t => t.id === track.id) : 0
    setQueue(tracks.map(toTrack), idx >= 0 ? idx : 0)
  }

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (dlStatus === 'done') {
      await api.deleteDownload(track.id).catch(() => { })
      removeDownload(track.id)
      return
    }
    if (dlStatus === 'downloading') return
    setDownloadStatus(track.id, 'downloading')
    setDownloadMeta(toTrack(track))
    try {
      const result = await api.downloadTrack(track.id)
      if (result.status === 'done') {
        setDownloadStatus(track.id, 'done')
      } else {
        const poll = setInterval(async () => {
          try {
            const { status } = await api.getDownloadStatus(track.id)
            if (status === 'done' || status === 'error') {
              clearInterval(poll)
              setDownloadStatus(track.id, status as any)
            }
          } catch { clearInterval(poll) }
        }, 2000)
      }
    } catch {
      setDownloadStatus(track.id, 'error')
    }
  }

  const closeMenu = () => {
    setMenuOpen(false)
    setNewPlaylistMode(false)
    setNewPlaylistName('')
  }

  const handleCreatePlaylist = () => {
    const name = newPlaylistName.trim()
    if (!name) return
    const id = createPlaylist(name)
    addToPlaylist(id, toTrack(track))
    closeMenu()
  }

  return (
    <div
      className={`${styles.item} ${isActive ? styles.active : ''} ${compact ? styles.compact : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); closeMenu() }}
      onDoubleClick={handlePlay}
    >
      {showArt && (
        <div className={styles.artWrap}>
          {thumbnail && <img src={thumbnail} alt="" className={styles.art} />}
          {hovered && (
            <button className={styles.playOverlay} onClick={handlePlay}>
              <Play size={14} fill="white" color="white" />
            </button>
          )}
          {isActive && !hovered && (
            <div className={styles.playingIndicator}>
              <span /><span /><span />
            </div>
          )}
        </div>
      )}

      {index !== undefined && !showArt && (
        <div className={styles.indexCell}>
          {hovered
            ? <button onClick={handlePlay} className={styles.playInline}><Play size={14} fill="var(--on-surface)" color="var(--on-surface)" /></button>
            : isActive
              ? <span className={styles.activeIdx}>♫</span>
              : <span className={styles.idx}>{index + 1}</span>
          }
        </div>
      )}

      <div className={styles.info}>
        <div className={`${styles.title} ${isActive ? styles.titleActive : ''}`}>{track.title}</div>
        <div className={styles.artist}>
          {(track.artists || []).map(a => a.name).join(', ')}
          {track.context && (
            <span className={styles.contextBadge} title={`From ${track.context.type}: ${track.context.title}`}>
              <span className={styles.contextDot}>•</span>
              {track.context.type === 'playlist' && <ListMusic size={10} />}
              {track.context.type === 'album' && <Disc3 size={10} />}
              {track.context.type === 'artist' && <User size={10} />}
              {track.context.title}
            </span>
          )}
        </div>
      </div>

      {showAlbum && (
        <div className={styles.album}>{track.album || ''}</div>
      )}

      <div className={styles.actions}>
        {(hovered || liked) && (
          <button
            className={styles.actionBtn}
            onClick={e => {
              e.stopPropagation()
              liked ? unlikeSong(track.id) : likeSong(toTrack(track))
            }}
          >
            <Heart size={16} fill={liked ? 'var(--primary)' : 'none'} color={liked ? 'var(--primary)' : 'var(--on-surface-variant)'} />
          </button>
        )}

        {hovered && (
          <button
            className={styles.actionBtn}
            onClick={handleDownload}
            title={dlStatus === 'done' ? 'Remove download' : dlStatus === 'downloading' ? 'Downloading…' : 'Download for offline'}
          >
            {dlStatus === 'done'
              ? <CheckCircle size={16} color="var(--primary)" />
              : dlStatus === 'downloading'
                ? <Loader2 size={16} color="var(--on-surface-variant)" className={styles.spin} />
                : <Download size={16} color="var(--on-surface-variant)" />}
          </button>
        )}

        <div className={styles.duration}>{formatDuration(track.duration)}</div>

        {hovered && (
          <div className={styles.menuWrapper}>
            <button
              className={styles.actionBtn}
              onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); setNewPlaylistMode(false) }}
            >
              <MoreHorizontal size={16} color="var(--on-surface-variant)" />
            </button>

            {menuOpen && (
              <div className={styles.menu} onClick={e => e.stopPropagation()}>
                <button onClick={() => { addToQueue(toTrack(track)); closeMenu() }}>
                  <ListPlus size={15} /> Add to queue
                </button>

                {playlists.length > 0 && (
                  <>
                    <div className={styles.menuDivider} />
                    <div className={styles.menuLabel}>Add to playlist</div>
                    {playlists.map(p => (
                      <button key={p.id} onClick={() => { addToPlaylist(p.id, toTrack(track)); closeMenu() }}>
                        <Plus size={15} /> {p.name}
                      </button>
                    ))}
                  </>
                )}

                <div className={styles.menuDivider} />

                {newPlaylistMode ? (
                  <div className={styles.newPlaylistRow}>
                    <input
                      autoFocus
                      className={styles.newPlaylistInput}
                      placeholder="Playlist name…"
                      value={newPlaylistName}
                      onChange={e => setNewPlaylistName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleCreatePlaylist()
                        if (e.key === 'Escape') { setNewPlaylistMode(false); setNewPlaylistName('') }
                      }}
                    />
                    <button className={styles.newPlaylistConfirm} onClick={handleCreatePlaylist}>✓</button>
                  </div>
                ) : (
                  <button onClick={() => setNewPlaylistMode(true)}>
                    <FolderPlus size={15} /> New playlist…
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
