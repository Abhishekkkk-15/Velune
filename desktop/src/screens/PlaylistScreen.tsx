import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Play, Shuffle, ListMusic, Heart, Download } from 'lucide-react'
import { api } from '../api/client'
import TrackItem from '../components/TrackItem'
import { TrackShimmerList } from '../components/ShimmerLoader'
import { usePlayerStore } from '../store/playerStore'
import { useLibraryStore } from '../store/libraryStore'
import { useSettingsStore } from '../store/settingsStore'
import styles from './PlaylistScreen.module.css'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function PlaylistScreen() {
  const { id } = useParams<{ id: string }>()
  const { setQueue } = usePlayerStore()
  const { savePlaylist, unsavePlaylist, isPlaylistSaved } = useLibraryStore()
  
  const isSaved = isPlaylistSaved(id!)
  const { data, isLoading, error } = useQuery({
    queryKey: ['playlist', id],
    queryFn: () => api.getPlaylist(id!),
    enabled: !!id,
  })

  const { maxCacheSize } = useSettingsStore()

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
      album: t.album, thumbnail: t.thumbnail || data.thumbnail, duration: t.duration,
    })), 0)
  }

  const handleShuffle = () => {
    if (!data?.songs.length) return
    const shuffled = [...data.songs].sort(() => Math.random() - 0.5)
    setQueue(shuffled.map(t => ({
      id: t.id, title: t.title, artists: t.artists,
      album: t.album, thumbnail: t.thumbnail || data.thumbnail, duration: t.duration,
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
        <div style={{ padding: 32 }}>
          <TrackShimmerList count={12} />
        </div>
      )}

      {error && <div className={styles.error}>Failed to load playlist</div>}

      {data && (
        <>
          <div className={styles.hero}>
            <div className={styles.artWrap}>
              {data.thumbnail
                ? <img src={data.thumbnail} alt={data.title} className={styles.art} />
                : <div className={styles.artPlaceholder}><ListMusic size={48} color="var(--on-surface-variant)" /></div>
              }
            </div>
            <div className={styles.info}>
              <div className={styles.label}>Playlist</div>
              <h1 className={styles.title}>{data.title}</h1>
              <div className={styles.meta}>{data.songs.length} songs</div>
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
                <button 
                  className={styles.shuffleBtn} 
                  onClick={() => {
                    if (isSaved) unsavePlaylist(id!)
                    else savePlaylist({ id: id!, title: data.title, thumbnail: data.thumbnail })
                  }}
                  title={isSaved ? "Remove from Library" : "Save to Library"}
                >
                  <Heart size={18} fill={isSaved ? "var(--primary)" : "transparent"} color={isSaved ? "var(--primary)" : "currentColor"} />
                </button>
              </div>
            </div>
          </div>

          <div className={styles.tracks}>
            {data.songs.map((track, i) => (
              <TrackItem
                key={`${track.id}-${i}`}
                track={{ ...track, thumbnail: track.thumbnail || data.thumbnail }}
                index={i}
                queue={data.songs.map(t => ({ ...t, thumbnail: t.thumbnail || data.thumbnail }))}
                showArt
              />
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}
