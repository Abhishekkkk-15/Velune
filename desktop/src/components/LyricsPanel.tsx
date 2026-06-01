import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Track } from '../store/playerStore'
import styles from './LyricsPanel.module.css'

interface Props {
  track: Track
  progress: number
}

export default function LyricsPanel({ track, progress }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const [activeLine, setActiveLine] = useState(0)

  const { data, isLoading, error } = useQuery({
    queryKey: ['lyrics', track.id],
    queryFn: () => api.getLyrics(
      track.title,
      track.artists.map(a => a.name).join(', '),
      track.duration
    ),
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!data?.synced || !data.lines.length) return
    let idx = 0
    for (let i = 0; i < data.lines.length; i++) {
      if (data.lines[i].time <= progress) idx = i
      else break
    }
    setActiveLine(idx)
  }, [progress, data])

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${activeLine}"]`) as HTMLElement
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeLine])

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading lyrics…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.noLyrics}>No lyrics found</div>
      </div>
    )
  }

  return (
    <div className={styles.container} ref={listRef}>
      <div className={styles.list}>
        {data.lines.map((line, i) => (
          <div
            key={i}
            data-idx={i}
            className={`${styles.line} ${i === activeLine ? styles.active : ''}`}
          >
            {line.text || '♪'}
          </div>
        ))}
      </div>
    </div>
  )
}
