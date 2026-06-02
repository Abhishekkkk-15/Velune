import { motion } from 'framer-motion'
import { Play, Pause, SkipForward, SkipBack, Heart, ListMusic } from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { useLibraryStore } from '../store/libraryStore'
import { proxyImage } from '../api/client'
import { useSettingsStore } from '../store/settingsStore'
import styles from './MiniPlayer.module.css'

export default function MiniPlayer() {
  const {
    currentTrack, isPlaying, progress, duration,
    setIsPlaying, toggleFullPlayer, playNext, playPrev, toggleQueue,
  } = usePlayerStore()
  const { isLiked, likeSong, unlikeSong } = useLibraryStore()
  const { miniPlayerTheme } = useSettingsStore()

  if (!currentTrack) return null

  const liked = isLiked(currentTrack.id)
  const finiteDuration = isFinite(duration) && duration > 0 ? duration : 0
  const progressPct = finiteDuration > 0 ? (progress / finiteDuration) * 100 : 0
  const thumbnail = proxyImage(currentTrack.thumbnail)

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (liked) unlikeSong(currentTrack.id)
    else likeSong(currentTrack)
  }

  const themeClass = styles[`theme-${miniPlayerTheme}`] || styles['theme-floating']

  // ======================
  // VINYL THEME RENDER
  // ======================
  if (miniPlayerTheme === 'vinyl') {
    return (
      <motion.div
        className={`${styles.player} ${themeClass}`}
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      >
        <div className={styles.vinylInner}>
          <div className={`${styles.vinylArtWrap} ${isPlaying ? styles.spinning : ''}`} onClick={toggleFullPlayer}>
            {thumbnail && <img src={thumbnail} alt={currentTrack.title} className={styles.vinylArt} />}
            <div className={styles.vinylHole} />
          </div>

          <div className={styles.vinylContent}>
            <div className={styles.vinylHeader}>
              <div className={styles.info} onClick={toggleFullPlayer}>
                <div className={styles.title}>{currentTrack.title}</div>
                <div className={styles.artist}>
                  {(currentTrack.artists ?? []).map(a => a.name).join(', ')}
                </div>
              </div>
            </div>

            <div className={styles.vinylProgressArea}>
              <div className={styles.vinylProgressBar}>
                <div className={styles.vinylProgressFill} style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className={styles.vinylControls}>
              <button className={styles.btnIcon} onClick={() => playPrev()}>
                <SkipBack size={20} fill="black" color="black" />
              </button>
              <button className={styles.btnIconLarge} onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying
                  ? <Pause size={24} fill="black" color="black" />
                  : <Play size={24} fill="black" color="black" style={{ marginLeft: 3 }} />}
              </button>
              <button className={styles.btnIcon} onClick={() => playNext()}>
                <SkipForward size={20} fill="black" color="black" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ======================
  // FLOATING / DOCKED THEMES
  // ======================
  return (
    <motion.div
      className={`${styles.player} ${themeClass}`}
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
    >
      <div className={styles.progress} style={{ width: `${progressPct}%` }} />

      <div className={styles.inner} onClick={toggleFullPlayer}>
        {thumbnail && (
          <img
            src={thumbnail}
            alt={currentTrack.title}
            className={styles.thumbnail}
          />
        )}
        <div className={styles.info}>
          <div className={styles.title}>{currentTrack.title}</div>
          <div className={styles.artist}>
            {(currentTrack.artists ?? []).map(a => a.name).join(', ')}
          </div>
        </div>

        <div className={styles.controls} onClick={e => e.stopPropagation()}>
          <button className={styles.btn} onClick={handleLike} title={liked ? 'Unlike' : 'Like'}>
            <Heart size={18} fill={liked ? 'var(--primary)' : 'none'} color={liked ? 'var(--primary)' : 'var(--on-surface-variant)'} />
          </button>
          <button className={styles.btn} onClick={() => playPrev()}>
            <SkipBack size={20} color="var(--on-surface)" />
          </button>
          <button className={styles.btnPrimary} onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying
              ? <Pause size={20} fill="var(--on-primary)" color="var(--on-primary)" />
              : <Play size={20} fill="var(--on-primary)" color="var(--on-primary)" />}
          </button>
          <button className={styles.btn} onClick={() => playNext()}>
            <SkipForward size={20} color="var(--on-surface)" />
          </button>
          <button className={styles.btn} onClick={toggleQueue}>
            <ListMusic size={18} color="var(--on-surface-variant)" />
          </button>
          <button className={styles.btn} onClick={async (e) => {
            e.stopPropagation()
            if (window.electron?.toggleMiniPlayer) {
              const isMini = await window.electron.toggleMiniPlayer()
              usePlayerStore.getState().setIsWidgetMode(isMini)
            }
          }} title="Mini Player">
            <div style={{ width: 14, height: 14, border: '2px solid var(--on-surface-variant)', borderRadius: 2 }} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
