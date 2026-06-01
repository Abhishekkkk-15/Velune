import { useState } from 'react'
import { Play, MoreHorizontal, Heart, ListPlus, Plus, Download, CheckCircle, Loader2, Trash2 } from 'lucide-react'
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
  track: YTTrack
  index?: number
  queue?: YTTrack[]
  showAlbum?: boolean
  showArt?: boolean
  compact?: boolean
}

export default function TrackItem({ track, index, queue, showAlbum, showArt = true, compact }: Props) {
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { setQueue, addToQueue, currentTrack, isPlaying } = usePlayerStore()
  const { isLiked, likeSong, unlikeSong, playlists, addToPlaylist, setDownloadStatus, removeDownload, getDownloadStatus } = useLibraryStore()

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
      await api.deleteDownload(track.id).catch(() => {})
      removeDownload(track.id)
      return
    }
    if (dlStatus === 'downloading') return
    setDownloadStatus(track.id, 'downloading')
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

  return (
    <div
      className={`${styles.item} ${isActive ? styles.active : ''} ${compact ? styles.compact : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false) }}
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
        <div className={styles.artist}>{track.artists.map(a => a.name).join(', ')}</div>
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
              onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            >
              <MoreHorizontal size={16} color="var(--on-surface-variant)" />
            </button>
            {menuOpen && (
              <div className={styles.menu}>
                <button onClick={() => addToQueue(toTrack(track))}>
                  <ListPlus size={15} /> Add to queue
                </button>
                {playlists.map(p => (
                  <button key={p.id} onClick={() => addToPlaylist(p.id, toTrack(track))}>
                    <Plus size={15} /> Add to {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
