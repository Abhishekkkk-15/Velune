import { motion } from 'framer-motion'
import { BarChart2, Music2, User, Clock } from 'lucide-react'
import { useLibraryStore } from '../store/libraryStore'
import styles from './StatsScreen.module.css'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function StatsScreen() {
  const { history, likedSongs } = useLibraryStore()

  const totalTime = history.reduce((acc, t) => acc + (t.duration || 0), 0)
  const hours = Math.floor(totalTime / 3600)
  const minutes = Math.floor((totalTime % 3600) / 60)

  const artistCounts: Record<string, { name: string; count: number; thumbnail: string }> = {}
  for (const track of history) {
    for (const artist of track.artists || []) {
      if (!artistCounts[artist.name]) {
        artistCounts[artist.name] = { name: artist.name, count: 0, thumbnail: track.thumbnail }
      }
      artistCounts[artist.name].count++
    }
  }
  const topArtists = Object.values(artistCounts).sort((a, b) => b.count - a.count).slice(0, 10)

  const songCounts: Record<string, { track: any; count: number }> = {}
  for (const track of history) {
    if (!songCounts[track.id]) songCounts[track.id] = { track, count: 0 }
    songCounts[track.id].count++
  }
  const topSongs = Object.values(songCounts).sort((a, b) => b.count - a.count).slice(0, 10)

  return (
    <motion.div
      className={styles.page}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25 }}
    >
      <h1 className={styles.title}>Stats</h1>

      <div className={styles.cards}>
        <div className={styles.statCard}>
          <Clock size={28} color="var(--primary)" />
          <div className={styles.statValue}>{hours}h {minutes}m</div>
          <div className={styles.statLabel}>Time Listened</div>
        </div>
        <div className={styles.statCard}>
          <Music2 size={28} color="var(--primary)" />
          <div className={styles.statValue}>{history.length}</div>
          <div className={styles.statLabel}>Songs Played</div>
        </div>
        <div className={styles.statCard}>
          <BarChart2 size={28} color="var(--primary)" />
          <div className={styles.statValue}>{likedSongs.length}</div>
          <div className={styles.statLabel}>Liked Songs</div>
        </div>
        <div className={styles.statCard}>
          <User size={28} color="var(--primary)" />
          <div className={styles.statValue}>{topArtists.length}</div>
          <div className={styles.statLabel}>Artists</div>
        </div>
      </div>

      {history.length === 0 ? (
        <div className={styles.empty}>
          <BarChart2 size={56} color="var(--outline)" />
          <p>No stats yet</p>
          <span>Start playing music to see your listening stats</span>
        </div>
      ) : (
        <div className={styles.sections}>
          {topArtists.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Top Artists</h2>
              <div className={styles.rankList}>
                {topArtists.map((a, i) => (
                  <div key={a.name} className={styles.rankItem}>
                    <div className={styles.rank}>#{i + 1}</div>
                    <img src={a.thumbnail} alt="" className={styles.rankThumb} />
                    <div className={styles.rankInfo}>
                      <div className={styles.rankName}>{a.name}</div>
                      <div className={styles.rankSub}>{a.count} plays</div>
                    </div>
                    <div className={styles.rankBar}>
                      <div
                        className={styles.rankBarFill}
                        style={{ width: `${(a.count / topArtists[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topSongs.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Top Songs</h2>
              <div className={styles.rankList}>
                {topSongs.map(({ track, count }, i) => (
                  <div key={track.id} className={styles.rankItem}>
                    <div className={styles.rank}>#{i + 1}</div>
                    <img src={track.thumbnail} alt="" className={styles.rankThumb} />
                    <div className={styles.rankInfo}>
                      <div className={styles.rankName}>{track.title}</div>
                      <div className={styles.rankSub}>{track.artists?.map((a: any) => a.name).join(', ')} · {count} plays</div>
                    </div>
                    <div className={styles.rankBar}>
                      <div
                        className={styles.rankBarFill}
                        style={{ width: `${(count / topSongs[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
