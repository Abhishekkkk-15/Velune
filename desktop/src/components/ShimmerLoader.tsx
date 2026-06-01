import styles from './ShimmerLoader.module.css'

interface CardShimmerProps { count?: number }

export function CardShimmerRow({ count = 6 }: CardShimmerProps) {
  return (
    <div className={styles.cardRow}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.cardShimmer}>
          <div className={`shimmer ${styles.cardArt}`} />
          <div className={`shimmer ${styles.cardTitle}`} />
          <div className={`shimmer ${styles.cardSub}`} />
        </div>
      ))}
    </div>
  )
}

export function TrackShimmerList({ count = 8 }: CardShimmerProps) {
  return (
    <div className={styles.trackList}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.trackShimmer}>
          <div className={`shimmer ${styles.trackArt}`} />
          <div className={styles.trackInfo}>
            <div className={`shimmer ${styles.trackTitle}`} />
            <div className={`shimmer ${styles.trackSub}`} />
          </div>
          <div className={`shimmer ${styles.trackDur}`} />
        </div>
      ))}
    </div>
  )
}
