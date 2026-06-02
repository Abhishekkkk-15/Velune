import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, Heart, Shuffle, SkipBack, Play, Pause, SkipForward,
  Repeat, Repeat1, ListMusic, Mic2, Volume2, VolumeX, Volume1,
  Plus, ListPlus, FolderPlus, Share2, MoreHorizontal
} from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { useLibraryStore } from '../store/libraryStore'
import { proxyImage } from '../api/client'
import audioEngine from '../audioEngine'
import LyricsPanel from './LyricsPanel'
import Visualizer from './Visualizer'
import styles from './FullPlayer.module.css'

function formatTime(s: number) {
  if (!s || !isFinite(s) || isNaN(s)) return '--:--'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function FullPlayer() {
  const {
    currentTrack, isPlaying, progress, duration, volume, isMuted,
    shuffle, repeat, accentColor,
    setIsPlaying, setProgress, setVolume, setMuted,
    toggleShuffle, toggleRepeat, playNext, playPrev,
    setShowFullPlayer, toggleQueue, addToQueue,
  } = usePlayerStore()

  const {
    isLiked, likeSong, unlikeSong,
    playlists, addToPlaylist, createPlaylist,
  } = useLibraryStore()

  const [showLyrics, setShowLyrics]         = useState(false)
  const [moreOpen, setMoreOpen]             = useState(false)
  const [newPlaylistMode, setNewPlaylistMode] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const progressRef = useRef<HTMLDivElement>(null)

  const liked     = currentTrack ? isLiked(currentTrack.id) : false
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
      {/* ── Blurred album art backdrop ─────────────────────────────────── */}
      <div className={styles.backdrop}>
        {thumbnail && <img src={thumbnail} className={styles.backdropArt} alt="" />}
        <div
          className={styles.backdropTint}
          style={{ background: `linear-gradient(135deg, ${accentColor}22 0%, transparent 60%)` }}
        />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <button className={styles.iconBtn} onClick={() => setShowFullPlayer(false)}>
          <ChevronDown size={24} />
        </button>

        <div className={styles.headerTitle}>
          <div className={styles.headerSub}>Now Playing</div>
          <div className={styles.headerAlbum}>{currentTrack.album || ''}</div>
        </div>

        {/* More menu */}
        <div className={styles.moreWrapper}>
          <button className={styles.iconBtn} onClick={() => setMoreOpen(o => !o)}>
            <MoreHorizontal size={24} />
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
                <button onClick={() => { liked ? unlikeSong(currentTrack.id) : likeSong(currentTrack); closeMore() }}>
                  <Heart size={15} fill={liked ? 'var(--primary)' : 'none'} color={liked ? 'var(--primary)' : 'var(--on-surface)'} />
                  {liked ? 'Unlike' : 'Like'}
                </button>
                <button onClick={() => { addToQueue(currentTrack); closeMore() }}>
                  <ListPlus size={15} /> Play next
                </button>
                <button onClick={handleCopyLink}>
                  <Share2 size={15} /> Copy link
                </button>

                {playlists.length > 0 && (
                  <>
                    <div className={styles.menuDivider} />
                    <div className={styles.menuLabel}>Add to playlist</div>
                    {playlists.map(p => (
                      <button key={p.id} onClick={() => { addToPlaylist(p.id, currentTrack); closeMore() }}>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className={styles.body}>
        <div className={styles.left}>

          {/* Vinyl + art */}
          <div className={styles.vinylScene}>
            <motion.div
              className={styles.vinylScale}
              animate={{ scale: isPlaying ? 1 : 0.9 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            >
              {/* Vinyl record ring */}
              <div className={styles.vinylRing} />

              {/* Album art — rotates while playing */}
              <div className={`${styles.artWrapper} ${isPlaying ? styles.spinning : ''}`}>
                {thumbnail && (
                  <img src={thumbnail} alt={currentTrack.title} className={styles.albumArt} />
                )}
                <div className={styles.vinylHole} />
              </div>
            </motion.div>

            {/* Accent glow under the record */}
            <div
              className={styles.vinylGlow}
              style={{ background: `radial-gradient(ellipse, ${accentColor}55 0%, transparent 70%)` }}
            />
          </div>

          {/* Visualizer */}
          <div className={styles.vizWrap}>
            <Visualizer accentColor={accentColor} isPlaying={isPlaying} barCount={44} height={52} />
          </div>

          {/* Track info */}
          <div className={styles.trackInfo}>
            <div className={styles.trackMeta}>
              <div className={styles.trackTexts}>
                <div className={styles.trackTitle}>{currentTrack.title}</div>
                <div className={styles.trackArtist}>
                  {currentTrack.artists.map(a => a.name).join(', ')}
                </div>
              </div>
              <button
                className={styles.iconBtn}
                onClick={() => liked ? unlikeSong(currentTrack.id) : likeSong(currentTrack)}
              >
                <Heart
                  size={22}
                  fill={liked ? 'var(--primary)' : 'none'}
                  color={liked ? 'var(--primary)' : 'var(--on-surface-variant)'}
                />
              </button>
            </div>

            {/* Progress */}
            <div className={styles.progressArea}>
              <div ref={progressRef} className={styles.progressBar} onClick={handleSeek}>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${progressPct}%`, background: accentColor }}
                  />
                  <div
                    className={styles.progressThumb}
                    style={{ left: `${progressPct}%`, background: accentColor }}
                  />
                </div>
              </div>
              <div className={styles.times}>
                <span>{formatTime(progress)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className={styles.controls}>
              <button
                className={`${styles.iconBtn} ${shuffle ? styles.active : ''}`}
                onClick={toggleShuffle}
              >
                <Shuffle size={20} color={shuffle ? 'var(--primary)' : 'var(--on-surface-variant)'} />
              </button>
              <button className={styles.iconBtn} onClick={playPrev}>
                <SkipBack size={26} fill="var(--on-surface)" color="var(--on-surface)" />
              </button>
              <button
                className={styles.playBtn}
                style={{ background: accentColor }}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying
                  ? <Pause size={30} fill="white" color="white" />
                  : <Play  size={30} fill="white" color="white" />}
              </button>
              <button className={styles.iconBtn} onClick={playNext}>
                <SkipForward size={26} fill="var(--on-surface)" color="var(--on-surface)" />
              </button>
              <button
                className={`${styles.iconBtn} ${repeat !== 'off' ? styles.active : ''}`}
                onClick={toggleRepeat}
              >
                {repeat === 'one'
                  ? <Repeat1 size={20} color="var(--primary)" />
                  : <Repeat  size={20} color={repeat === 'all' ? 'var(--primary)' : 'var(--on-surface-variant)'} />}
              </button>
            </div>

            {/* Extra controls */}
            <div className={styles.extra}>
              <div className={styles.volumeRow}>
                <button className={styles.iconBtn} onClick={() => setMuted(!isMuted)}>
                  {isMuted || volume === 0
                    ? <VolumeX size={18} color="var(--on-surface-variant)" />
                    : volume < 0.5
                    ? <Volume1  size={18} color="var(--on-surface-variant)" />
                    : <Volume2  size={18} color="var(--on-surface-variant)" />}
                </button>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  className={styles.volumeSlider}
                  style={{ accentColor } as any}
                />
              </div>
              <div className={styles.extraBtns}>
                <button
                  className={`${styles.iconBtn} ${showLyrics ? styles.active : ''}`}
                  onClick={() => setShowLyrics(v => !v)}
                >
                  <Mic2 size={18} color={showLyrics ? 'var(--primary)' : 'var(--on-surface-variant)'} />
                </button>
                <button className={styles.iconBtn} onClick={toggleQueue}>
                  <ListMusic size={18} color="var(--on-surface-variant)" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Lyrics panel */}
        {showLyrics && currentTrack && (
          <div className={styles.right}>
            <LyricsPanel track={currentTrack} progress={progress} />
          </div>
        )}
      </div>

      {/* Dismiss more menu on outside click */}
      {moreOpen && (
        <div className={styles.moreOverlay} onClick={closeMore} />
      )}
    </motion.div>
  )
}
