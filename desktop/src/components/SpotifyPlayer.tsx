import { useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown, Heart, Shuffle, SkipBack, Play, Pause, SkipForward,
  Repeat, Repeat1, ListMusic, Volume2, VolumeX, Volume1, Maximize2,
  Share2, MoreVertical, Plus, ListPlus, FolderPlus
} from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { useLibraryStore } from '../store/libraryStore'
import { proxyImage } from '../api/client'
import audioEngine from '../audioEngine'
import styles from './SpotifyPlayer.module.css'

function formatTime(s: number) {
  if (!s || !isFinite(s) || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function SpotifyPlayer() {
  const {
    currentTrack, isPlaying, progress, duration,
    shuffle, repeat, accentColor, volume, isMuted,
    setIsPlaying, setProgress, setVolume, setMuted,
    toggleShuffle, toggleRepeat, playNext, playPrev,
    setShowFullPlayer, toggleQueue, addToQueue
  } = usePlayerStore()

  const {
    isLiked, likeSong, unlikeSong,
    playlists, addToPlaylist, createPlaylist,
  } = useLibraryStore()

  const [moreOpen, setMoreOpen] = useState(false)
  const [newPlaylistMode, setNewPlaylistMode] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const progressRef = useRef<HTMLDivElement>(null)

  const liked = currentTrack ? isLiked(currentTrack.id) : false
  const thumbnail = proxyImage(currentTrack?.thumbnail)

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect()
    if (!rect || !duration) return
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audioEngine.seek(pct * duration)
    setProgress(pct * duration)
  }

  const finiteDuration = isFinite(duration) && duration > 0 ? duration : 0
  const progressPct = finiteDuration > 0 ? (progress / finiteDuration) * 100 : 0

  const closeMore = () => {
    setMoreOpen(false)
    setNewPlaylistMode(false)
    setNewPlaylistName('')
  }

  const handleCreatePlaylist = () => {
    const name = newPlaylistName.trim()
    if (!name || !currentTrack) return
    const id = createPlaylist(name)
    addToPlaylist(id, currentTrack)
    closeMore()
  }

  const handleCopyLink = () => {
    if (!currentTrack) return
    navigator.clipboard.writeText(`https://music.youtube.com/watch?v=${currentTrack.id}`)
    closeMore()
  }

  if (!currentTrack) return null

  return (
    <motion.div
      className={styles.overlay}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
    >
      <div
        className={styles.backgroundGradient}
        style={{ '--accent-color': accentColor || '#121212' } as React.CSSProperties}
      />

      <div className={styles.header}>
        <button className={styles.iconBtn} onClick={() => setShowFullPlayer(false)}>
          <ChevronDown size={28} />
        </button>
        <div className={styles.headerTitle}>
          {currentTrack.album || 'Now Playing'}
        </div>
        <div className={styles.moreWrapper}>
          <button className={styles.iconBtn} onClick={() => setMoreOpen(o => !o)}>
            <MoreVertical size={24} />
          </button>

          <AnimatePresence>
            {moreOpen && (
              <motion.div
                className={styles.moreMenu}
                initial={{ opacity: 0, scale: 0.92, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -8 }}
                transition={{ duration: 0.15 }}
                onClick={e => e.stopPropagation()}
              >
                <button onClick={() => { addToQueue(currentTrack); closeMore() }}>
                  <ListPlus size={16} /> Add to queue
                </button>
                <button onClick={handleCopyLink}>
                  <Share2 size={16} /> Copy link
                </button>

                {playlists.length > 0 && (
                  <>
                    <div className={styles.menuDivider} />
                    <div className={styles.menuLabel}>Add to playlist</div>
                    {playlists.map(p => (
                      <button key={p.id} onClick={() => { addToPlaylist(p.id, currentTrack); closeMore() }}>
                        <Plus size={16} /> {p.name}
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
                    <FolderPlus size={16} /> New playlist…
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className={styles.mainContent}>
        {thumbnail && <img src={thumbnail} className={styles.albumArt} alt="" />}
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.leftControls}>
          <div className={styles.trackInfo}>
            <h2 className={styles.trackTitle}>{currentTrack.title}</h2>
            <p className={styles.trackArtist}>{(currentTrack.artists || []).map(a => a.name).join(', ')}</p>
          </div>
          <button
            className={styles.iconBtn}
            onClick={() => liked ? unlikeSong(currentTrack.id) : likeSong(currentTrack)}
          >
            <Heart size={16} fill={liked ? 'var(--primary)' : 'none'} color={liked ? 'var(--primary)' : '#b3b3b3'} />
          </button>
        </div>

        <div className={styles.centerControls}>
          <div className={styles.playbackButtons}>
            <button
              className={`${styles.iconBtn} ${shuffle ? styles.active : ''}`}
              onClick={toggleShuffle}
            >
              <Shuffle size={16} color={shuffle ? 'var(--primary)' : '#b3b3b3'} />
            </button>

            <button className={styles.iconBtn} onClick={playPrev}>
              <SkipBack size={20} fill="#b3b3b3" color="#b3b3b3" />
            </button>

            <button className={styles.playBtn} onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying
                ? <Pause size={16} fill="black" color="black" />
                : <Play size={16} fill="black" color="black" style={{ marginLeft: 2 }} />}
            </button>

            <button className={styles.iconBtn} onClick={playNext}>
              <SkipForward size={20} fill="#b3b3b3" color="#b3b3b3" />
            </button>

            <button
              className={`${styles.iconBtn} ${repeat !== 'off' ? styles.active : ''}`}
              onClick={toggleRepeat}
            >
              {repeat === 'one'
                ? <Repeat1 size={16} color="var(--primary)" />
                : <Repeat size={16} color={repeat === 'all' ? 'var(--primary)' : '#b3b3b3'} />}
            </button>
          </div>

          <div className={styles.progressRow}>
            <span className={`${styles.timeLabel} ${styles.right}`}>{formatTime(progress)}</span>
            <div className={styles.progressBar} onClick={handleSeek} ref={progressRef}>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${progressPct}%` }}>
                  <div className={styles.progressThumb} />
                </div>
              </div>
            </div>
            <span className={styles.timeLabel}>{formatTime(finiteDuration)}</span>
          </div>
        </div>

        <div className={styles.rightControls}>
          <button className={styles.iconBtn} onClick={toggleQueue}>
            <ListMusic size={16} />
          </button>

          <div className={styles.volumeRow}>
            <button className={styles.iconBtn} onClick={() => setMuted(!isMuted)}>
              {isMuted || volume === 0
                ? <VolumeX size={16} color="#b3b3b3" />
                : volume < 0.5
                  ? <Volume1 size={16} color="#b3b3b3" />
                  : <Volume2 size={16} color="#b3b3b3" />}
            </button>
            <input
              type="range" min={0} max={1} step={0.01}
              value={isMuted ? 0 : volume}
              onChange={e => setVolume(Number(e.target.value))}
              className={styles.volumeSlider}
            />
          </div>

          <button className={styles.iconBtn} onClick={() => setShowFullPlayer(false)}>
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {moreOpen && (
        <div className={styles.moreOverlay} onClick={closeMore} />
      )}
    </motion.div>
  )
}
