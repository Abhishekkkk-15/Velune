import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, GripVertical } from 'lucide-react'
import { usePlayerStore } from '../store/playerStore'
import { proxyImage } from '../api/client'
import styles from './Queue.module.css'

export default function Queue() {
  const { queue, queueIndex, currentTrack, toggleQueue, playAt, removeFromQueue, reorderQueue } = usePlayerStore()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const dragNodeRef = useRef<number | null>(null)

  const upNext = queue.slice(queueIndex + 1)

  const handleDragStart = (e: React.DragEvent, realIndex: number) => {
    dragNodeRef.current = realIndex
    setDragIndex(realIndex)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnter = (realIndex: number) => {
    if (dragNodeRef.current === realIndex) return
    setDragOver(realIndex)
  }

  const handleDragEnd = () => {
    if (dragIndex !== null && dragOver !== null && dragIndex !== dragOver) {
      reorderQueue(dragIndex, dragOver)
    }
    setDragIndex(null)
    setDragOver(null)
    dragNodeRef.current = null
  }

  return (
    <motion.div
      className={styles.panel}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>Queue</h2>
        <button className={styles.closeBtn} onClick={toggleQueue}>
          <X size={20} />
        </button>
      </div>

      {currentTrack && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Now Playing</div>
          <div className={styles.nowPlaying}>
            {currentTrack.thumbnail && (
              <img src={proxyImage(currentTrack.thumbnail)} alt="" className={styles.thumb} />
            )}
            <div className={styles.info}>
              <div className={styles.trackTitle}>{currentTrack.title}</div>
              <div className={styles.trackArtist}>{(currentTrack.artists || []).map(a => a.name).join(', ')}</div>
            </div>
          </div>
        </div>
      )}

      {upNext.length > 0 && (
        <div className={`${styles.section} ${styles.queueList}`}>
          <div className={styles.sectionLabel}>Up Next ({upNext.length})</div>
          <div className={styles.list}>
            {upNext.map((track, i) => {
              const realIndex = queueIndex + 1 + i
              const isDragging = dragIndex === realIndex
              const isOver = dragOver === realIndex
              return (
                <div
                  key={`${track.id}-${realIndex}`}
                  className={`${styles.item} ${isDragging ? styles.dragging : ''} ${isOver ? styles.dragOver : ''}`}
                  draggable
                  onDragStart={e => handleDragStart(e, realIndex)}
                  onDragEnter={() => handleDragEnter(realIndex)}
                  onDragOver={e => e.preventDefault()}
                  onDragEnd={handleDragEnd}
                  onDoubleClick={() => playAt(realIndex)}
                >
                  <GripVertical size={16} color="var(--on-surface-variant)" className={styles.grip} />
                  {track.thumbnail && (
                    <img src={proxyImage(track.thumbnail)} alt="" className={styles.thumb} />
                  )}
                  <div className={styles.info}>
                    <div className={styles.trackTitle}>{track.title}</div>
                    <div className={styles.trackArtist}>{track.artists.map(a => a.name).join(', ')}</div>
                  </div>
                  <button className={styles.removeBtn} onClick={() => removeFromQueue(realIndex)}>
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {queue.length === 0 && (
        <div className={styles.empty}>Queue is empty</div>
      )}
    </motion.div>
  )
}
