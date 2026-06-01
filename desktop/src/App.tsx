import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import NavigationBar from './components/NavigationBar'
import MiniPlayer from './components/MiniPlayer'
import FullPlayer from './components/FullPlayer'
import WidgetPlayer from './components/WidgetPlayer'
import Queue from './components/Queue'
import HomeScreen from './screens/HomeScreen'
import SearchScreen from './screens/SearchScreen'
import LibraryScreen from './screens/LibraryScreen'
import HistoryScreen from './screens/HistoryScreen'
import StatsScreen from './screens/StatsScreen'
import ArtistScreen from './screens/ArtistScreen'
import AlbumScreen from './screens/AlbumScreen'
import PlaylistScreen from './screens/PlaylistScreen'
import SettingsScreen from './screens/SettingsScreen'
import { usePlayerStore } from './store/playerStore'
import { useSettingsStore } from './store/settingsStore'
import { useAudio } from './hooks/useAudio'
import { useScrobble } from './hooks/useScrobble'
import { useColorExtractor } from './hooks/useColorExtractor'

function AppInner() {
  const { currentTrack, showFullPlayer, showQueue, isPlaying, progress, duration, isWidgetMode } = usePlayerStore()
  const { accentColor } = useSettingsStore()
  useAudio()
  useScrobble(currentTrack, isPlaying, progress, duration)
  useColorExtractor(currentTrack?.thumbnail)

  useEffect(() => {
    document.documentElement.style.setProperty('--primary', accentColor)
  }, [accentColor])

  const location = useLocation()

  if (isWidgetMode) {
    return <WidgetPlayer />
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--background)',
    }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <NavigationBar />
        <main style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: currentTrack ? 'var(--player-height)' : '0',
        }}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname.split('/')[1]}>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/search" element={<SearchScreen />} />
              <Route path="/library" element={<LibraryScreen />} />
              <Route path="/history" element={<HistoryScreen />} />
              <Route path="/stats" element={<StatsScreen />} />
              <Route path="/artist/:id" element={<ArtistScreen />} />
              <Route path="/album/:id" element={<AlbumScreen />} />
              <Route path="/playlist/:id" element={<PlaylistScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/settings/:section" element={<SettingsScreen />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
      {currentTrack && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 200,
        }}>
          <MiniPlayer />
        </div>
      )}
      <AnimatePresence>
        {showFullPlayer && <FullPlayer key="full-player" />}
      </AnimatePresence>
      <AnimatePresence>
        {showQueue && <Queue key="queue" />}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return <AppInner />
}
