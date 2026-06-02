import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Play, Shuffle, ListMusic, Heart, Download, Loader2, CheckCircle } from 'lucide-react'
import { api } from '../api/client'
import TrackItem from '../components/TrackItem'
import { TrackShimmerList } from '../components/ShimmerLoader'
import { usePlayerStore } from '../store/playerStore'
import { useLibraryStore } from '../store/libraryStore'
import { useSettingsStore } from '../store/settingsStore'
import styles from './PlaylistScreen.module.css'
import { useState } from 'react'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function PlaylistScreen() {
  const { id } = useParams<{ id: string }>()
  const { setQueue } = usePlayerStore()
  const { savePlaylist, unsavePlaylist, isPlaylistSaved, setDownloadStatus, getDownloadStatus, setDownloadMeta, playlists } = useLibraryStore()
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [allDone, setAllDone] = useState(false)

  const isLocal = id?.startsWith('pl_')
  const localPlaylist = isLocal ? playlists.find(p => p.id === id) : null

  const isSaved = isLocal ? true : isPlaylistSaved(id!)
  const { data: remoteData, isLoading, error } = useQuery({
    queryKey: ['playlist', id],
    queryFn: () => api.getPlaylist(id!),
    enabled: !!id && !isLocal,
  })

  const data = isLocal && localPlaylist ? {
    id: localPlaylist.id,
    title: localPlaylist.name,
    thumbnail: localPlaylist.tracks[0]?.thumbnail || '',
    songs: localPlaylist.tracks,
  } : remoteData

  const { maxCacheSize } = useSettingsStore()

  const handleDownloadAll = async () => {
    if (!data?.songs.length || downloadingAll || allDone) return
    setDownloadingAll(true)
    setAllDone(false)

    const songs = data.songs
    await Promise.allSettled(songs.map(async (t) => {
      setDownloadStatus(t.id, 'downloading')
      setDownloadMeta({
        id: t.id, title: t.title, artists: t.artists,
        album: t.album, thumbnail: t.thumbnail || data.thumbnail, duration: t.duration,
        context: { type: 'playlist', id: data.id, title: data.title }
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
      album: t.album, thumbnail: t.thumbnail || data.thumbnail, duration: t.duration,
    })), 0, { type: 'playlist', id: data.id, title: data.title })
  }

  const handleShuffle = () => {
    if (!data?.songs.length) return
    const shuffled = [...data.songs].sort(() => Math.random() - 0.5)
    setQueue(shuffled.map(t => ({
      id: t.id, title: t.title, artists: t.artists,
      album: t.album, thumbnail: t.thumbnail || data.thumbnail, duration: t.duration,
    })), 0, { type: 'playlist', id: data.id, title: data.title })
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
      {isLoading && !isLocal && (
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
                {!isLocal && (
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
                )}
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
                queueContext={{ type: 'playlist', id: data.id, title: data.title }}
                showArt
              />
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}
