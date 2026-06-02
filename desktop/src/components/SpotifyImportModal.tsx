import { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import styles from '../screens/LibraryScreen.module.css'
import { api } from '../api/client'
import { useSettingsStore } from '../store/settingsStore'
import { useLibraryStore } from '../store/libraryStore'

interface SpotifyImportModalProps {
  onClose: () => void
}

export default function SpotifyImportModal({ onClose }: SpotifyImportModalProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { spotifyClientId, spotifyClientSecret } = useSettingsStore()
  const { createPlaylist, addToPlaylist } = useLibraryStore()

  const handleImport = async () => {
    if (!url.includes('spotify.com/playlist/')) {
      setError('Please enter a valid Spotify playlist URL')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('http://127.0.0.1:3001/api/import/spotify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          clientId: spotifyClientId || undefined,
          clientSecret: spotifyClientSecret || undefined
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to import playlist')
      }

      if (data.tracks.length === 0) {
        throw new Error('No tracks were found or matched')
      }

      // Create new playlist
      const playlistId = createPlaylist(data.title)
      
      // Add matched tracks to the playlist
      data.tracks.forEach((track: any) => {
        addToPlaylist(playlistId, track)
      })

      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <motion.div 
        className={styles.modalContent}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Import Spotify Playlist</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--on-surface-variant)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Paste a Spotify playlist URL below. We will attempt to find matching tracks on YouTube.
        </p>

        <input
          autoFocus
          className={styles.input}
          placeholder="https://open.spotify.com/playlist/..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleImport()
          }}
        />

        {error && (
          <div style={{ color: '#ff5252', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {error}
          </div>
        )}

        <div className={styles.modalActions} style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button 
            className={styles.createBtn} 
            onClick={handleImport}
            disabled={loading || !url}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {loading ? <Loader2 size={16} className={styles.spin} /> : null}
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
