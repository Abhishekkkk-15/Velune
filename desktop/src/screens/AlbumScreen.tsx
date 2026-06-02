import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Play, Shuffle, Download } from 'lucide-react'
import { api } from '../api/client'
import TrackItem from '../components/TrackItem'
import { TrackShimmerList } from '../components/ShimmerLoader'
import { usePlayerStore } from '../store/playerStore'
import { useSettingsStore } from '../store/settingsStore'
import styles from './AlbumScreen.module.css'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function AlbumScreen() {
  const { id } = useParams<{ id: string }>()
  const { setQueue } = usePlayerStore()
  const { maxCacheSize } = useSettingsStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['album', id],
    queryFn: () => api.getAlbum(id!),
    enabled: !!id,
  })

  const handleDownloadAll = () => {
    if (!data?.songs.length) return
    data.songs.forEach(t => {
      api.download(t.id, maxCacheSize)
    })
  }

  const handlePlay = () => {
    if (!data?.songs.length) return
    setQueue(data.songs.map(t => ({
      id: t.id, title: t.title, artists: t.artists,
      album: data.title, thumbnail: t.thumbnail || data.thumbnail, duration: t.duration,
    })), 0)
  }

  const handleShuffle = () => {
    if (!data?.songs.length) return
    const shuffled = [...data.songs].sort(() => Math.random() - 0.5)
    setQueue(shuffled.map(t => ({
      id: t.id, title: t.title, artists: t.artists,
      album: data.title, thumbnail: t.thumbnail || data.thumbnail, duration: t.duration,
    })), 0)
  }

  return (
    <motion.div
      className={styles.page}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25 }}
    >
      {isLoading && (
        <div className={styles.loading}>
          <div className={`shimmer ${styles.artShimmer}`} />
          <div className={styles.infoShimmer}>
            <div className={`shimmer ${styles.titleShimmer}`} />
            <div className={`shimmer ${styles.subShimmer}`} />
          </div>
        </div>
      )}

      {error && <div className={styles.error}>Failed to load album</div>}

      {data && (
        <>
          <div className={styles.hero}>
            <div className={styles.bg} style={{ backgroundImage: `url(${data.thumbnail})` }} />
            <div className={styles.bgOverlay} />
            <div className={styles.heroContent}>
              <img src={data.thumbnail} alt={data.title} className={styles.art} />
              <div className={styles.info}>
                <div className={styles.label}>Album</div>
                <h1 className={styles.albumTitle}>{data.title}</h1>
                <div className={styles.meta}>
                  {data.artists.map((a: any) => a.name).join(', ')}
                  {data.year && ` · ${data.year}`}
                  {data.songs.length > 0 && ` · ${data.songs.length} songs`}
                </div>
                <div className={styles.actions}>
                  <button className={styles.playBtn} onClick={handlePlay}>
                    <Play size={20} fill="white" color="white" />
                    Play All
                  </button>
                  <button className={styles.shuffleBtn} onClick={handleShuffle}>
                    <Shuffle size={18} />
                    Shuffle
                  </button>
                  <button className={styles.shuffleBtn} onClick={handleDownloadAll} title="Download All">
                    <Download size={18} />
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.tracks}>
            <div className={styles.trackHeader}>
              <div className={styles.thIdx}>#</div>
              <div className={styles.thTitle}>Title</div>
              <div className={styles.thDuration}>Duration</div>
            </div>
            {isLoading && <TrackShimmerList />}
            {data.songs.map((track, i) => (
              <TrackItem
                key={track.id}
                track={{ ...track, thumbnail: track.thumbnail || data.thumbnail }}
                index={i}
                queue={data.songs.map(t => ({ ...t, thumbnail: t.thumbnail || data.thumbnail }))}
                showArt={false}
              />
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}
