import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import NavigationBar from './components/NavigationBar'
import MiniPlayer from './components/MiniPlayer'
import FullPlayer from './components/FullPlayer'
import SpotifyPlayer from './components/SpotifyPlayer'
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
import CustomTitleBar from './components/CustomTitleBar'
import { usePlayerStore } from './store/playerStore'
import { useSettingsStore } from './store/settingsStore'
import { useAudio } from './hooks/useAudio'
import { useScrobble } from './hooks/useScrobble'
import { useColorExtractor } from './hooks/useColorExtractor'
import { api } from './api/client'

function AppInner() {
  const { currentTrack, showFullPlayer, showQueue, isPlaying, progress, duration, isWidgetMode } = usePlayerStore()
  const { accentColor, playerTheme, miniPlayerTheme } = useSettingsStore()
  useAudio()
  useScrobble(currentTrack, isPlaying, progress, duration)
  useColorExtractor(currentTrack?.thumbnail)

  useEffect(() => {
    document.documentElement.style.setProperty('--primary', accentColor)
  }, [accentColor])

  useEffect(() => {
    // Enforce cache limit on app startup
    const maxBytes = useSettingsStore.getState().maxCacheSize * 1024 * 1024
    api.enforceCacheLimit(maxBytes).catch(() => { })
  }, [])

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
      <CustomTitleBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <NavigationBar />
        <main style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: currentTrack
            ? miniPlayerTheme === 'docked' ? 'var(--player-height)'
              : miniPlayerTheme === 'vinyl' ? 'calc(var(--player-height) + 40px)'
                : 'calc(var(--player-height) + 32px)'
            : '0',
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
          bottom: miniPlayerTheme === 'docked' ? 0 : miniPlayerTheme === 'vinyl' ? 24 : 24,
          left: miniPlayerTheme === 'docked' ? 0 : 0,
          right: miniPlayerTheme === 'docked' ? 0 : 0,
          zIndex: 200,
          display: 'flex',
          justifyContent: miniPlayerTheme === 'docked' ? 'stretch' : 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ pointerEvents: 'auto', width: miniPlayerTheme === 'docked' ? '100%' : 'auto' }}>
            <MiniPlayer />
          </div>
        </div>
      )}
      <AnimatePresence>
        {showFullPlayer && (
          playerTheme === 'spotify'
            ? <SpotifyPlayer key="full-player" />
            : <FullPlayer key="full-player" />
        )}
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
