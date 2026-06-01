import { motion } from 'framer-motion'
import { Clock, Trash2 } from 'lucide-react'
import { useLibraryStore } from '../store/libraryStore'
import TrackItem from '../components/TrackItem'
import styles from './HistoryScreen.module.css'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function HistoryScreen() {
  const { history, clearHistory } = useLibraryStore()

  return (
    <motion.div
      className={styles.page}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25 }}
    >
      <div className={styles.header}>
        <h1 className={styles.title}>History</h1>
        {history.length > 0 && (
          <button className={styles.clearBtn} onClick={clearHistory}>
            <Trash2 size={16} />
            Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className={styles.empty}>
          <Clock size={56} color="var(--outline)" />
          <p>No listening history</p>
          <span>Songs you play will appear here</span>
        </div>
      ) : (
        <div className={styles.list}>
          {history.map((track, i) => (
            <TrackItem
              key={`${track.id}-${i}`}
              track={track as any}
              queue={history as any}
              showArt
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}
