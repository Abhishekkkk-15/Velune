import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { api } from '../api/client'
import ChipsRow from '../components/ChipsRow'
import TrackItem from '../components/TrackItem'
import MediaCard from '../components/MediaCard'
import { TrackShimmerList, CardShimmerRow } from '../components/ShimmerLoader'
import { usePlayerStore } from '../store/playerStore'
import type { YTTrack } from '../api/client'
import styles from './SearchScreen.module.css'

const FILTERS = [
  { label: 'Songs', value: 'songs' },
  { label: 'Videos', value: 'videos' },
  { label: 'Albums', value: 'albums' },
  { label: 'Artists', value: 'artists' },
  { label: 'Playlists', value: 'playlists' },
]

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [inputValue, setInputValue] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setQueue } = usePlayerStore()

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions', inputValue],
    queryFn: () => api.getSearchSuggestions(inputValue),
    enabled: inputValue.length > 1 && !query,
    staleTime: 1000 * 30,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['search', query, filter],
    queryFn: () => api.search(query, filter || undefined),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 2,
  })

  const handleInput = useCallback((v: string) => {
    setInputValue(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setQuery(v)
    }, 500)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(inputValue)
  }

  const handleSuggestion = (s: string) => {
    setInputValue(s)
    setQuery(s)
  }

  const playAll = (songs: YTTrack[]) => {
    setQueue(songs.map(t => ({
      id: t.id, title: t.title, artists: t.artists,
      album: t.album, thumbnail: t.thumbnail, duration: t.duration,
    })), 0)
  }

  const songs = (data?.items || []).filter(i => i.type === 'song' || i.type === 'video') as YTTrack[]
  const otherItems = (data?.items || []).filter(i => i.type !== 'song' && i.type !== 'video')

  return (
    <motion.div
      className={styles.page}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25 }}
    >
      <div className={styles.searchBar}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <Search size={20} color="var(--on-surface-variant)" />
          <input
            className={styles.input}
            value={inputValue}
            onChange={e => handleInput(e.target.value)}
            placeholder="Search songs, artists, albums…"
            autoFocus
          />
          {inputValue && (
            <button type="button" onClick={() => { setInputValue(''); setQuery('') }}>
              <X size={18} color="var(--on-surface-variant)" />
            </button>
          )}
        </form>
      </div>

      {query && (
        <div className={styles.filters}>
          <ChipsRow
            chips={FILTERS}
            selected={filter}
            onSelect={setFilter}
          />
        </div>
      )}

      {!query && suggestions?.suggestions && suggestions.suggestions.length > 0 && (
        <div className={styles.suggestions}>
          {suggestions.suggestions.map((s, i) => (
            <button key={i} className={styles.suggestion} onClick={() => handleSuggestion(s)}>
              <Search size={14} color="var(--on-surface-variant)" />
              {s}
            </button>
          ))}
        </div>
      )}

      {!query && (
        <div className={styles.empty}>
          <Search size={64} color="var(--outline)" />
          <p>Search for music</p>
        </div>
      )}

      {isLoading && (
        <div className={styles.results}>
          <TrackShimmerList />
        </div>
      )}

      {data && !isLoading && (
        <div className={styles.results}>
          {/* Filtered song/video results */}
          {(filter === 'songs' || filter === 'videos') && songs.length > 0 && (
            <div>
              {songs.map((track, i) => (
                <TrackItem key={track.id} track={track} index={i} queue={songs} />
              ))}
            </div>
          )}

          {/* Non-playable filtered results (albums, artists, playlists) */}
          {filter && filter !== 'songs' && filter !== 'videos' && otherItems.length > 0 && (
            <div className={styles.cardGrid}>
              {otherItems.map((item, i) => (
                <MediaCard key={`${item.id}-${i}`} item={item} contextItems={otherItems} />
              ))}
            </div>
          )}

          {/* Summary sections (no filter) */}
          {!filter && data.items.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Top Results</h3>
              <div>
                {(data.items as YTTrack[]).filter(i => i.type === 'song' || i.type === 'video').map((track, j) => (
                  <TrackItem key={track.id} track={track} queue={data.items as YTTrack[]} />
                ))}
              </div>
              <div className={styles.cardGrid}>
                {data.items.filter(i => i.type !== 'song' && i.type !== 'video').map((item, j, arr) => (
                  <MediaCard key={`${item.id}-${j}`} item={item} contextItems={arr} />
                ))}
              </div>
            </div>
          )}
          
          {!filter && data.sections.map((section, i) => (
            <div key={i} className={styles.section}>
              <h3 className={styles.sectionTitle}>{section.title}</h3>
              {section.items[0]?.type === 'song' ? (
                <div>
                  {(section.items as YTTrack[]).map((track, j) => (
                    <TrackItem key={track.id} track={track} queue={section.items as YTTrack[]} />
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

          {data.items.length === 0 && data.sections.length === 0 && (
            <div className={styles.noResults}>
              <p>No results found for "{query}"</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
