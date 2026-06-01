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
  const containerRef = useRef<HTMLDivElement>(null)
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

  // Determine active line based on progress
  useEffect(() => {
    if (!data?.synced || !data.lines.length) return
    let idx = 0
    for (let i = 0; i < data.lines.length; i++) {
      if (data.lines[i].time <= progress) idx = i
      else break
    }
    setActiveLine(idx)
  }, [progress, data])

  const scrollState = useRef({ currentY: 0, targetY: 0 })

  // requestAnimationFrame smooth scroll
  useEffect(() => {
    if (!listRef.current || !containerRef.current) return

    let animationFrameId: number

    const updateScroll = () => {
      if (listRef.current && containerRef.current) {
        // Query the active element dynamically inside the loop to avoid dependency resets
        const activeEl = listRef.current.querySelector(`.${styles.active}`) as HTMLElement
        if (activeEl) {
          const containerHeight = containerRef.current.clientHeight
          const offsetTop = activeEl.offsetTop
          const elHeight = activeEl.offsetHeight
          
          scrollState.current.targetY = -offsetTop + (containerHeight / 2) - (elHeight / 2)
        }
      }

      // Smooth interpolation (lerp)
      const { targetY, currentY } = scrollState.current
      if (Math.abs(targetY - currentY) > 0.1) {
        scrollState.current.currentY += (targetY - currentY) * 0.1
        if (listRef.current) {
          listRef.current.style.transform = `translateY(${scrollState.current.currentY}px)`
        }
      }

      animationFrameId = requestAnimationFrame(updateScroll)
    }

    animationFrameId = requestAnimationFrame(updateScroll)
    return () => cancelAnimationFrame(animationFrameId)
  }, [])

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
    <div className={styles.container} ref={containerRef}>
      <div className={styles.list} ref={listRef}>
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
