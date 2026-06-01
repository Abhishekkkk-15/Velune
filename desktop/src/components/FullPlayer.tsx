import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronDown, Heart, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
  ListMusic, Mic2, Volume2, VolumeX, Volume1, MoreHorizontal
} from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { useLibraryStore } from '../store/libraryStore'
import { proxyImage } from '../api/client'
import audioEngine from '../audioEngine'
import LyricsPanel from './LyricsPanel'
import styles from './FullPlayer.module.css'

function formatTime(s: number) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function FullPlayer() {
  const {
    currentTrack, isPlaying, progress, duration, volume, isMuted,
    shuffle, repeat, accentColor,
    setIsPlaying, setProgress, setVolume, setMuted,
    toggleShuffle, toggleRepeat, playNext, playPrev, setShowFullPlayer, toggleQueue,
  } = usePlayerStore()
  const { isLiked, likeSong, unlikeSong } = useLibraryStore()
  const [showLyrics, setShowLyrics] = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)

  const liked = currentTrack ? isLiked(currentTrack.id) : false
  const thumbnail = proxyImage(currentTrack?.thumbnail)

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect()
    if (!rect || !duration) return
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newTime = pct * duration
    audioEngine.seek(newTime)
    setProgress(newTime)
  }

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0

  const bgStyle = {
    background: `radial-gradient(ellipse at top left, ${accentColor}33 0%, transparent 60%),
                 radial-gradient(ellipse at bottom right, ${accentColor}22 0%, transparent 60%),
                 var(--background)`,
  }

  if (!currentTrack) return null

  return (
    <motion.div
      className={styles.overlay}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      style={bgStyle}
    >
      <div className={styles.header}>
        <button className={styles.iconBtn} onClick={() => setShowFullPlayer(false)}>
          <ChevronDown size={24} />
        </button>
        <div className={styles.headerTitle}>
          <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>Now Playing</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{currentTrack.album || ''}</div>
        </div>
        <button className={styles.iconBtn}>
          <MoreHorizontal size={24} />
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.left}>
          <motion.div
            className={styles.artWrapper}
            animate={{ scale: isPlaying ? 1 : 0.92 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {thumbnail && (
              <img src={thumbnail} alt={currentTrack.title} className={styles.albumArt} />
            )}
          </motion.div>

          <div className={styles.trackInfo}>
            <div className={styles.trackMeta}>
              <div>
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

            <div className={styles.controls}>
              <button
                className={`${styles.iconBtn} ${shuffle ? styles.active : ''}`}
                onClick={toggleShuffle}
              >
                <Shuffle size={20} color={shuffle ? 'var(--primary)' : 'var(--on-surface-variant)'} />
              </button>
              <button className={styles.iconBtn} onClick={playPrev}>
                <SkipBack size={24} fill="var(--on-surface)" color="var(--on-surface)" />
              </button>
              <button
                className={styles.playBtn}
                style={{ background: accentColor }}
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying
                  ? <Pause size={28} fill="white" color="white" />
                  : <Play size={28} fill="white" color="white" />}
              </button>
              <button className={styles.iconBtn} onClick={playNext}>
                <SkipForward size={24} fill="var(--on-surface)" color="var(--on-surface)" />
              </button>
              <button
                className={`${styles.iconBtn} ${repeat !== 'off' ? styles.active : ''}`}
                onClick={toggleRepeat}
              >
                {repeat === 'one'
                  ? <Repeat1 size={20} color="var(--primary)" />
                  : <Repeat size={20} color={repeat === 'all' ? 'var(--primary)' : 'var(--on-surface-variant)'} />}
              </button>
            </div>

            <div className={styles.extra}>
              <div className={styles.volume}>
                <button className={styles.iconBtn} onClick={() => setMuted(!isMuted)}>
                  {isMuted || volume === 0
                    ? <VolumeX size={18} color="var(--on-surface-variant)" />
                    : volume < 0.5
                    ? <Volume1 size={18} color="var(--on-surface-variant)" />
                    : <Volume2 size={18} color="var(--on-surface-variant)" />}
                </button>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={e => setVolume(Number(e.target.value))}
                  className={styles.volumeSlider}
                  style={{ accentColor }}
                />
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className={`${styles.iconBtn} ${showLyrics ? styles.active : ''}`}
                  onClick={() => setShowLyrics(!showLyrics)}
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

        {showLyrics && currentTrack && (
          <div className={styles.right}>
            <LyricsPanel track={currentTrack} progress={progress} />
          </div>
        )}
      </div>
    </motion.div>
  )
}
