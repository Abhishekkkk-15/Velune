import { useEffect } from 'react'
import { Play, Pause, SkipForward, SkipBack, Maximize2, Heart, ListMusic } from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { useSettingsStore } from '../store/settingsStore'
import { useLibraryStore } from '../store/libraryStore'
import { proxyImage } from '../api/client'
import styles from './WidgetPlayer.module.css'

export default function WidgetPlayer() {
  const {
    currentTrack, isPlaying, progress, duration,
    setIsPlaying, playNext, playPrev, setIsWidgetMode, toggleQueue
  } = usePlayerStore()
  const { miniPlayerTheme } = useSettingsStore()
  const { isLiked, likeSong, unlikeSong } = useLibraryStore()

  if (!currentTrack) return <div className={styles.widget} />

  const thumbnail = proxyImage(currentTrack.thumbnail)

  const handleExpand = async () => {
    if (window.electron?.toggleMiniPlayer) {
      await window.electron.toggleMiniPlayer()
      setIsWidgetMode(false)
    }
  }

  useEffect(() => {
    if (window.electron?.resizeWidget) {
      if (miniPlayerTheme === 'floating') window.electron.resizeWidget(400, 80)
      else if (miniPlayerTheme === 'vinyl') window.electron.resizeWidget(340, 110)
      else window.electron.resizeWidget(300, 300) // docked (square)
    }
  }, [miniPlayerTheme])

  const liked = currentTrack ? isLiked(currentTrack.id) : false
  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentTrack) return
    if (liked) unlikeSong(currentTrack.id)
    else likeSong(currentTrack)
  }

  const progressPct = duration > 0 ? (progress / duration) * 100 : 0
  const themeClass = styles[`theme-${miniPlayerTheme}`] || styles['theme-docked']

  if (miniPlayerTheme === 'floating') {
    return (
      <div className={`${styles.widget} ${themeClass}`}>
        <div className={styles.dragRegion} />
        <div className={styles.progress} style={{ width: `${progressPct}%` }} />
        
        <div className={styles.inner}>
          {thumbnail && <img src={thumbnail} alt={currentTrack.title} className={styles.thumbnailImg} />}
          <div className={styles.info}>
            <div className={styles.titleText}>{currentTrack.title}</div>
            <div className={styles.artistText}>
              {(currentTrack.artists || []).map(a => a.name).join(', ')}
            </div>
          </div>

          <div className={styles.controlsRow}>
            <button className={styles.btnIcon} onClick={handleLike}>
              <Heart size={18} fill={liked ? 'var(--primary)' : 'none'} color={liked ? 'var(--primary)' : 'var(--on-surface-variant)'} />
            </button>
            <button className={styles.btnIcon} onClick={() => playPrev()}>
              <SkipBack size={20} color="var(--on-surface)" />
            </button>
            <button className={styles.btnPrimary} onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying
                ? <Pause size={20} fill="var(--on-primary)" color="var(--on-primary)" />
                : <Play size={20} fill="var(--on-primary)" color="var(--on-primary)" style={{ marginLeft: 2 }}/>}
            </button>
            <button className={styles.btnIcon} onClick={() => playNext()}>
              <SkipForward size={20} color="var(--on-surface)" />
            </button>
            <button className={styles.btnIcon} onClick={handleExpand} title="Exit Mini Player">
              <Maximize2 size={16} color="var(--on-surface-variant)" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (miniPlayerTheme === 'vinyl') {
    return (
      <div className={`${styles.widget} ${themeClass}`}>
        <div className={styles.dragRegion} />
        <div className={styles.vinylInner}>
          <div className={`${styles.vinylArtWrap} ${isPlaying ? styles.spinning : ''}`}>
            {thumbnail && <img src={thumbnail} alt={currentTrack.title} className={styles.vinylArt} />}
            <div className={styles.vinylHole} />
          </div>

          <div className={styles.vinylContent}>
            <div className={styles.vinylHeader}>
              <div className={styles.info}>
                <div className={styles.titleText}>{currentTrack.title}</div>
                <div className={styles.artistText}>
                  {(currentTrack.artists ?? []).map(a => a.name).join(', ')}
                </div>
              </div>
              <button className={styles.expandBtnVinyl} onClick={handleExpand} title="Exit Mini Player">
                <Maximize2 size={14} color="var(--on-surface-variant)" />
              </button>
            </div>

            <div className={styles.vinylProgressArea}>
              <div className={styles.vinylProgressBar}>
                <div className={styles.vinylProgressFill} style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className={styles.vinylControls}>
              <button className={styles.btnIconVinyl} onClick={() => playPrev()}>
                <SkipBack size={20} fill="var(--on-surface)" color="var(--on-surface)" />
              </button>
              <button className={styles.btnIconLargeVinyl} onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying
                  ? <Pause size={24} fill="var(--on-surface)" color="var(--on-surface)" />
                  : <Play size={24} fill="var(--on-surface)" color="var(--on-surface)" style={{ marginLeft: 3 }} />}
              </button>
              <button className={styles.btnIconVinyl} onClick={() => playNext()}>
                <SkipForward size={20} fill="var(--on-surface)" color="var(--on-surface)" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // DEFAULT SQUARE WIDGET (Docked)
  return (
    <div className={`${styles.widget} ${themeClass}`}>
      <div className={styles.dragRegion} />
      
      <button className={styles.expandBtn} onClick={handleExpand} title="Exit Mini Player">
        <Maximize2 size={16} />
      </button>

      {thumbnail && (
        <img
          src={thumbnail}
          alt={currentTrack.title}
          className={styles.thumbnailBg}
        />
      )}

      <div className={styles.overlay}>
        <div className={styles.titleBg}>{currentTrack.title}</div>
        <div className={styles.artistBg}>
          {(currentTrack.artists || []).map(a => a.name).join(', ')}
        </div>

        <div className={styles.controlsBg}>
          <button className={styles.btnBg} onClick={() => playPrev()}>
            <SkipBack size={24} />
          </button>
          <button className={styles.playBtnBg} onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button className={styles.btnBg} onClick={() => playNext()}>
            <SkipForward size={24} />
          </button>
        </div>
      </div>
    </div>
  )
}
