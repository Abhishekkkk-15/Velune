import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Shuffle } from 'lucide-react'
import { api } from '../api/client'
import MediaCard from '../components/MediaCard'
import { CardShimmerRow } from '../components/ShimmerLoader'
import { usePlayerStore } from '../store/playerStore'
import type { YTTrack } from '../api/client'
import styles from './HomeScreen.module.css'

import { useLibraryStore } from '../store/libraryStore'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function HomeScreen() {
  const { history } = useLibraryStore()
  // Grab up to 3 recent track IDs to use for personalized recommendations
  const historyIds = history.slice(0, 3).map(t => t.id)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['home', historyIds.join(',')],
    queryFn: () => api.getHome(historyIds),
    staleTime: 1000 * 60 * 10,
  })
  const { setQueue } = usePlayerStore()

  const handleShuffle = () => {
    if (!data?.sections) return
    const allSongs: YTTrack[] = []
    for (const section of data.sections) {
      for (const item of section.items) {
        if (item.type === 'song') allSongs.push(item as YTTrack)
      }
    }
    if (allSongs.length === 0) return
    const shuffled = [...allSongs].sort(() => Math.random() - 0.5)
    setQueue(shuffled.map(t => ({
      id: t.id, title: t.title, artists: t.artists,
      album: t.album, thumbnail: t.thumbnail, duration: t.duration,
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
      <div className={styles.heroArea}>
        <h1 className={styles.greeting}>Good {getTimeOfDay()}</h1>
        <button className={styles.shuffleBtn} onClick={handleShuffle}>
          <Shuffle size={18} />
          Shuffle All
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          <p>Failed to load home feed.</p>
          <button onClick={() => refetch()} className={styles.retryBtn}>Retry</button>
        </div>
      )}

      {isLoading && (
        <div className={styles.sections}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.section}>
              <div className={`shimmer ${styles.sectionTitleShimmer}`} />
              <CardShimmerRow />
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className={styles.sections}>
          {data.sections.map((section, i) => (
            <div key={i} className={styles.section}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <div className={styles.cardRow}>
                {section.items.map((item, j) => (
                  <MediaCard key={`${item.id}-${j}`} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
