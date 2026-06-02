import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Play, Shuffle } from 'lucide-react'
import { api } from '../api/client'
import TrackItem from '../components/TrackItem'
import MediaCard from '../components/MediaCard'
import { TrackShimmerList } from '../components/ShimmerLoader'
import { usePlayerStore } from '../store/playerStore'
import type { YTTrack } from '../api/client'
import styles from './ArtistScreen.module.css'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function ArtistScreen() {
  const { id } = useParams<{ id: string }>()
  const { setQueue } = usePlayerStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['artist', id],
    queryFn: () => api.getArtist(id!),
    enabled: !!id,
  })

  const allSongs: YTTrack[] = []
  if (data?.sections) {
    for (const s of data.sections) {
      for (const item of s.items) {
        if (item.type === 'song') allSongs.push(item as YTTrack)
      }
    }
  }

  const handlePlay = () => {
    if (allSongs.length === 0) return
    setQueue(allSongs.map(t => ({
      id: t.id, title: t.title, artists: t.artists,
      album: t.album, thumbnail: t.thumbnail, duration: t.duration,
    })), 0)
  }

  const handleShuffle = () => {
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
      {isLoading && (
        <div className={styles.heroShimmer}>
          <div className={`shimmer ${styles.heroArtShimmer}`} />
          <div className={`shimmer ${styles.heroNameShimmer}`} />
        </div>
      )}

      {error && (
        <div className={styles.error}>Failed to load artist</div>
      )}

      {data && (
        <>
          <div className={styles.hero} style={{
            backgroundImage: data.thumbnail ? `url(${data.thumbnail})` : undefined,
          }}>
            <div className={styles.heroOverlay} />
            <div className={styles.heroContent}>
              {data.thumbnail && (
                <img src={data.thumbnail} alt={data.name} className={styles.heroImg} />
              )}
              <div className={styles.heroInfo}>
                <div className={styles.heroLabel}>Artist</div>
                <h1 className={styles.heroName}>{data.name}</h1>
                {data.description && (
                  <p className={styles.heroDesc}>{data.description}</p>
                )}
                <div className={styles.heroActions}>
                  <button className={styles.playBtn} onClick={handlePlay}>
                    <Play size={20} fill="white" color="white" />
                    Play
                  </button>
                  <button className={styles.shuffleBtn} onClick={handleShuffle}>
                    <Shuffle size={18} />
                    Shuffle
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.content}>
            {data.sections.map((section, i) => (
              <div key={i} className={styles.section}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                {section.items[0]?.type === 'song' ? (
                  <div>
                    {(section.items as YTTrack[]).map((track, j) => (
                      <TrackItem key={track.id} track={track} queue={section.items as YTTrack[]} showArt />
                    ))}
                  </div>
                ) : (
                  <div className={styles.cardRow}>
                    {section.items.map((item, j) => (
                      <MediaCard key={`${item.id}-${j}`} item={item} contextItems={section.items} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}
