import { Play, Pause, SkipForward, SkipBack, Maximize2 } from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { proxyImage } from '../api/client'
import styles from './WidgetPlayer.module.css'

export default function WidgetPlayer() {
  const {
    currentTrack, isPlaying,
    setIsPlaying, playNext, playPrev, setIsWidgetMode
  } = usePlayerStore()

  if (!currentTrack) return <div className={styles.widget} />

  const thumbnail = proxyImage(currentTrack.thumbnail)

  const handleExpand = async () => {
    if (window.electron?.toggleMiniPlayer) {
      await window.electron.toggleMiniPlayer()
      setIsWidgetMode(false)
    }
  }

  return (
    <div className={styles.widget}>
      <div className={styles.dragRegion} />
      
      <button className={styles.expandBtn} onClick={handleExpand} title="Exit Mini Player">
        <Maximize2 size={16} />
      </button>

      {thumbnail && (
        <img
          src={thumbnail}
          alt={currentTrack.title}
          className={styles.thumbnail}
        />
      )}

      <div className={styles.overlay}>
        <div className={styles.title}>{currentTrack.title}</div>
        <div className={styles.artist}>
          {currentTrack.artists.map(a => a.name).join(', ')}
        </div>

        <div className={styles.controls}>
          <button className={styles.btn} onClick={() => playPrev()}>
            <SkipBack size={24} />
          </button>
          <button className={styles.playBtn} onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button className={styles.btn} onClick={() => playNext()}>
            <SkipForward size={24} />
          </button>
        </div>
      </div>
    </div>
  )
}
