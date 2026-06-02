import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Clock, Trash2, ListMusic, Disc3, User, Play, ChevronLeft } from 'lucide-react'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import { proxyImage } from '../api/client'
import TrackItem from '../components/TrackItem'
import styles from './HistoryScreen.module.css'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function HistoryScreen() {
  const { history, clearHistory } = useLibraryStore()
  const { setQueue } = usePlayerStore()
  const [viewMode, setViewMode] = useState<'timeline' | 'grouped'>('timeline')
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  const historyGroups = useMemo(() => {
    const groups: Record<string, { type: string, id: string, title: string, thumbnail: string, tracks: any[] }> = {}
    const individuals: any[] = []
    for (const t of history) {
      if (t.context) {
        if (!groups[t.context.id]) {
          groups[t.context.id] = { ...t.context, thumbnail: t.thumbnail, tracks: [] }
        }
        groups[t.context.id].tracks.push(t)
      } else {
        individuals.push(t)
      }
    }
    return { groups: Object.values(groups), individuals }
  }, [history])

  const expandedGroupData = expandedGroup ? historyGroups.groups.find(g => g.id === expandedGroup) : null

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h1 className={styles.title}>History</h1>
          <div className={styles.viewToggle}>
            <button className={`${styles.toggleBtn} ${viewMode === 'timeline' ? styles.toggleActive : ''}`} onClick={() => setViewMode('timeline')}>Timeline</button>
            <button className={`${styles.toggleBtn} ${viewMode === 'grouped' ? styles.toggleActive : ''}`} onClick={() => setViewMode('grouped')}>Grouped</button>
          </div>
        </div>
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
      ) : viewMode === 'timeline' ? (
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
      ) : expandedGroupData ? (
        <>
          <div className={styles.playAllRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className={styles.backBtn} onClick={() => setExpandedGroup(null)}>
                <ChevronLeft size={20} />
              </button>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{expandedGroupData.title}</h2>
            </div>
            <button className={styles.playAllBtn} onClick={() => setQueue(expandedGroupData.tracks, 0, { type: expandedGroupData.type as any, id: expandedGroupData.id, title: expandedGroupData.title })}>
              <Play size={16} fill="var(--primary)" color="var(--primary)" />
              Play All ({expandedGroupData.tracks.length})
            </button>
          </div>
          <div className={styles.list}>
            {expandedGroupData.tracks.map((track, i) => (
              <TrackItem key={`${track.id}-${i}`} track={track as any} index={i} queue={expandedGroupData.tracks as any} showArt />
            ))}
          </div>
        </>
      ) : (
        <>
          {historyGroups.groups.length > 0 && (
            <div className={styles.playlistGrid}>
              {historyGroups.groups.map(g => (
                <div key={g.id} className={styles.playlistCard} onClick={() => setExpandedGroup(g.id)}>
                  <div className={styles.playlistArt}>
                    {g.thumbnail ? <img src={proxyImage(g.thumbnail)} alt="" /> : <Disc3 size={32} color="var(--on-surface-variant)" />}
                  </div>
                  <div className={styles.playlistInfo}>
                    <div className={styles.playlistName}>{g.title}</div>
                    <div className={styles.playlistCount}>Played from {g.type} • {g.tracks.length} songs</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {historyGroups.individuals.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', paddingLeft: '12px' }}>Individual Songs</h3>
              <div className={styles.list}>
                {historyGroups.individuals.map((track, i) => (
                  <TrackItem key={`${track.id}-${i}`} track={track as any} queue={historyGroups.individuals as any} showArt />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
