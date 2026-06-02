import { useState } from 'react'
import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Play, Shuffle, Download, Loader2, CheckCircle } from 'lucide-react'
import { api } from '../api/client'
import TrackItem from '../components/TrackItem'
import { TrackShimmerList } from '../components/ShimmerLoader'
import { usePlayerStore } from '../store/playerStore'
import { useSettingsStore } from '../store/settingsStore'
import { useLibraryStore } from '../store/libraryStore'
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
  const { setDownloadStatus, getDownloadStatus, setDownloadMeta } = useLibraryStore()
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [allDone, setAllDone] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['album', id],
    queryFn: () => api.getAlbum(id!),
    enabled: !!id,
  })

  const handleDownloadAll = async () => {
    if (!data?.songs.length || downloadingAll || allDone) return
    setDownloadingAll(true)
    setAllDone(false)

    const songs = data.songs
    await Promise.allSettled(songs.map(async (t) => {
      setDownloadStatus(t.id, 'downloading')
      setDownloadMeta({
        id: t.id, title: t.title, artists: t.artists,
        album: data.title, thumbnail: t.thumbnail || data.thumbnail, duration: t.duration,
        context: { type: 'album', id: data.id, title: data.title }
      })
      try {
        const res = await api.downloadTrack(t.id)
        if (res.status === 'done') {
          setDownloadStatus(t.id, 'done')
        } else {
          // Poll until done
          await new Promise<void>((resolve) => {
            const poll = setInterval(async () => {
              try {
                const { status } = await api.getDownloadStatus(t.id)
                if (status === 'done' || status === 'error') {
                  clearInterval(poll)
                  setDownloadStatus(t.id, status as any)
                  resolve()
                }
              } catch { clearInterval(poll); resolve() }
            }, 2000)
          })
        }
      } catch {
        setDownloadStatus(t.id, 'error')
      }
    }))

    setDownloadingAll(false)
    const allCompleted = songs.every(t => getDownloadStatus(t.id) === 'done')
    setAllDone(allCompleted)
  }

  const handlePlay = () => {
    if (!data?.songs.length) return
    setQueue(data.songs.map(t => ({
      id: t.id, title: t.title, artists: t.artists,
      album: data.title, thumbnail: t.thumbnail || data.thumbnail, duration: t.duration,
    })), 0, { type: 'album', id: data.id, title: data.title })
  }

  const handleShuffle = () => {
    if (!data?.songs.length) return
    const shuffled = [...data.songs].sort(() => Math.random() - 0.5)
    setQueue(shuffled.map(t => ({
      id: t.id, title: t.title, artists: t.artists,
      album: data.title, thumbnail: t.thumbnail || data.thumbnail, duration: t.duration,
    })), 0, { type: 'album', id: data.id, title: data.title })
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
                  <button
                    className={styles.shuffleBtn}
                    onClick={handleDownloadAll}
                    title={allDone ? 'Downloaded' : downloadingAll ? 'Downloading…' : 'Download All'}
                    disabled={downloadingAll || allDone}
                    style={{ opacity: (downloadingAll || allDone) ? 0.75 : 1 }}
                  >
                    {allDone
                      ? <CheckCircle size={18} />
                      : downloadingAll
                        ? <Loader2 size={18} className={styles.spin} />
                        : <Download size={18} />}
                    {allDone ? 'Downloaded' : downloadingAll ? 'Downloading…' : 'Download'}
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
