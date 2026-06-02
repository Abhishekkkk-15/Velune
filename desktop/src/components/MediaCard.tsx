import { useState } from 'react'
import { Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePlayerStore } from '../store/playerStore'
import { proxyImage } from '../api/client'
import type { YTItem } from '../api/client'
import styles from './MediaCard.module.css'

interface Props {
  item: YTItem
  size?: 'sm' | 'md' | 'lg'
  contextItems?: YTItem[]
}

export default function MediaCard({ item, size = 'md', contextItems }: Props) {
  const [hovered, setHovered] = useState(false)
  const navigate = useNavigate()
  const { setQueue } = usePlayerStore()

  const isCircle = item.type === 'artist'
  const thumbnail = proxyImage(item.thumbnail)

  const handleClick = () => {
    if (item.type === 'artist') navigate(`/artist/${item.id}`)
    else if (item.type === 'album') navigate(`/album/${item.id}`)
    else if (item.type === 'playlist') navigate(`/playlist/${(item as any).playlistId || item.id}`)
    else if (item.type === 'song') {
      if (contextItems) {
        const songs = contextItems.filter(i => i.type === 'song')
        const index = songs.findIndex(i => i.id === item.id)
        if (index !== -1) {
          setQueue(songs.map(s => ({
            id: s.id,
            title: s.title,
            artists: (s as any).artists || [],
            thumbnail: s.thumbnail,
          })), index)
          return
        }
      }
      setQueue([{
        id: item.id,
        title: item.title,
        artists: (item as any).artists || [],
        thumbnail: item.thumbnail,
      }], 0)
    }
  }

  const subtitle = item.type === 'song'
    ? (item as any).artists?.map((a: any) => a.name).join(', ')
    : (item as any).subtitle || (item as any).artists?.map((a: any) => a.name).join(', ') || item.type

  return (
    <div
      className={`${styles.card} ${styles[size]}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      <div className={`${styles.artWrap} ${isCircle ? styles.circle : ''}`}>
        {thumbnail && (
          <img src={thumbnail} alt={item.title} className={styles.art} loading="lazy" />
        )}
        {hovered && item.type !== 'artist' && (
          <button
            className={styles.playBtn}
            onClick={e => { e.stopPropagation(); handleClick() }}
          >
            <Play size={20} fill="white" color="white" />
          </button>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.title}>{item.title}</div>
        {subtitle && <div className={styles.sub}>{subtitle}</div>}
      </div>
    </div>
  )
}
