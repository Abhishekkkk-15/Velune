import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, NavLink } from 'react-router-dom'
import {
  Palette, Music2, FileText, HardDrive, Puzzle,
  Globe, Check, ChevronRight, Info, Loader2, User
} from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'
import { api } from '../api/client'
import styles from './SettingsScreen.module.css'

const SECTIONS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'player', label: 'Player', icon: Music2 },
  { id: 'equalizer', label: 'Equalizer', icon: Music2 },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'integrations', label: 'Integrations', icon: Puzzle },
  { id: 'about', label: 'About', icon: Info },
]

const ACCENT_COLORS = [
  '#ED5564', '#E91E63', '#9C27B0', '#673AB7',
  '#3F51B5', '#2196F3', '#00BCD4', '#009688',
  '#4CAF50', '#8BC34A', '#CDDC39', '#FF9800', '#FF5722',
]

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
      onClick={() => onChange(!value)}
    >
      <div className={styles.toggleThumb} />
    </button>
  )
}

function Slider({ value, min, max, step, onChange, label, format }: {
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; label?: string; format?: (v: number) => string;
}) {
  return (
    <div className={styles.sliderRow}>
      {label && <span className={styles.sliderLabel}>{label}</span>}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={styles.slider}
        style={{ accentColor: 'var(--primary)' }}
      />
      <span className={styles.sliderValue}>{format ? format(value) : value}</span>
    </div>
  )
}

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className={styles.settingRow}>
      <div className={styles.settingInfo}>
        <div className={styles.settingLabel}>{label}</div>
        {desc && <div className={styles.settingDesc}>{desc}</div>}
      </div>
      <div className={styles.settingControl}>{children}</div>
    </div>
  )
}

function AppearanceSection() {
  const s = useSettingsStore()
  return (
    <div className={styles.sectionContent}>
      <h3 className={styles.sectionHeader}>Theme</h3>
      <SettingRow label="Mini Player Theme" desc="Choose the layout of the mini player">
        <select
          className={styles.select}
          value={s.miniPlayerTheme}
          onChange={e => s.setMiniPlayerTheme(e.target.value as any)}
        >
          <option value="floating">Floating Pill</option>
          <option value="vinyl">Vinyl Art</option>
          <option value="docked">Square Card</option>
        </select>
      </SettingRow>
      <SettingRow label="Dynamic Color" desc="Extract accent color from album art">
        <Toggle value={s.dynamicColor} onChange={s.setDynamicColor} />
      </SettingRow>

      <h3 className={styles.sectionHeader}>Accent Color</h3>
      <div className={styles.colorPicker}>
        {ACCENT_COLORS.map(color => (
          <button
            key={color}
            className={`${styles.colorSwatch} ${s.accentColor === color ? styles.colorSwatchActive : ''}`}
            style={{ background: color }}
            onClick={() => {
              s.setAccentColor(color)
              document.documentElement.style.setProperty('--primary', color)
            }}
          >
            {s.accentColor === color && <Check size={14} color="white" />}
          </button>
        ))}
      </div>
    </div>
  )
}

function PlayerSection() {
  const s = useSettingsStore()
  return (
    <div className={styles.sectionContent}>
      <h3 className={styles.sectionHeader}>Playback</h3>
      <SettingRow label="Gapless Playback" desc="Remove silence between tracks">
        <Toggle value={s.gaplessPlayback} onChange={s.setGapless} />
      </SettingRow>
      <SettingRow label="Playback Speed" desc="Adjust playback rate">
        <Slider
          value={s.playbackSpeed}
          min={0.5} max={2} step={0.25}
          onChange={s.setPlaybackSpeed}
          format={v => `${v}×`}
        />
      </SettingRow>

      <h3 className={styles.sectionHeader}>Theme</h3>
      <SettingRow label="Player Theme" desc="Choose between default vinyl or Spotify style">
        <select
          className={styles.select}
          value={s.playerTheme}
          onChange={e => s.setPlayerTheme(e.target.value as any)}
        >
          <option value="default">Default</option>
          <option value="spotify">Spotify</option>
        </select>
      </SettingRow>

      <h3 className={styles.sectionHeader}>Sleep Timer</h3>
      <SettingRow label="Sleep Timer" desc={s.sleepTimerMinutes ? `Stops in ${s.sleepTimerMinutes} min` : 'Pause after set time'}>
        <select
          className={styles.select}
          value={s.sleepTimerMinutes ?? ''}
          onChange={e => s.setSleepTimer(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Off</option>
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
          <option value="45">45 minutes</option>
          <option value="60">60 minutes</option>
          <option value="90">90 minutes</option>
          <option value="120">2 hours</option>
        </select>
      </SettingRow>

      <h3 className={styles.sectionHeader}>Crossfade</h3>
      <SettingRow label="Crossfade Duration" desc="Fade between tracks (0 = off)">
        <Slider
          value={s.crossfadeDuration}
          min={0} max={12} step={1}
          onChange={s.setCrossfade}
          format={v => v === 0 ? 'Off' : `${v}s`}
        />
      </SettingRow>
    </div>
  )
}

function EqualizerSection() {
  const s = useSettingsStore()
  const freqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
  const labels = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k']

  return (
    <div className={styles.sectionContent}>
      <h3 className={styles.sectionHeader}>10-Band Equalizer</h3>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', marginTop: '2rem', height: '200px' }}>
        {s.eqBands.map((gain, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem' }}>{gain > 0 ? `+${gain}` : gain}</span>
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={gain}
              onChange={e => s.setEqBand(i, Number(e.target.value))}
              style={{
                writingMode: 'bt-lr',
                appearance: 'slider-vertical',
                width: '100%',
                height: '100%',
                accentColor: 'var(--primary)'
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '0.5rem' }}>{labels[i]}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className={styles.saveBtn}
          onClick={() => s.eqBands.forEach((_, i) => s.setEqBand(i, 0))}
        >
          Reset Flat
        </button>
      </div>
    </div>
  )
}


function StorageSection() {
  const s = useSettingsStore()
  const [stats, setStats] = useState<{ count: number; sizeBytes: number } | null>(null)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    api.getCacheStats().then(setStats).catch(() => { })
  }, [])

  const handleClearCache = async () => {
    if (!confirm('Clear all cached stream data? This cannot be undone.')) return
    setClearing(true)
    try {
      await api.clearCache()
      const fresh = await api.getCacheStats()
      setStats(fresh)
      setCleared(true)
      setTimeout(() => setCleared(false), 2000)
    } finally {
      setClearing(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className={styles.sectionContent}>
      <h3 className={styles.sectionHeader}>Cache</h3>
      {stats && (
        <SettingRow label="Cache Usage" desc={`${stats.count} cached streams`}>
          <span className={styles.statValue}>{formatSize(stats.sizeBytes)}</span>
        </SettingRow>
      )}
      <SettingRow label="Maximum Cache Size" desc={`Up to ${s.maxCacheSize} MB`}>
        <Slider value={s.maxCacheSize} min={256} max={4096} step={256} onChange={(val) => {
          s.setMaxCacheSize(val)
          api.enforceCacheLimit(val * 1024 * 1024).then(() => {
            api.getCacheStats().then(setStats).catch(() => { })
          }).catch(() => { })
        }} label="MB" />
      </SettingRow>
      <SettingRow label="Clear Cache" desc="Remove all cached stream URL files">
        <button
          className={`${styles.dangerBtn} ${cleared ? styles.successBtn : ''}`}
          onClick={handleClearCache}
          disabled={clearing}
        >
          {clearing ? <Loader2 size={14} className={styles.spin} /> : null}
          {cleared ? 'Cleared!' : 'Clear Cache'}
        </button>
      </SettingRow>
    </div>
  )
}

function IntegrationsSection() {
  const s = useSettingsStore()
  const [lastfmApiKey, setLastfmApiKey] = useState(s.lastfmApiKey)
  const [lastfmApiSecret, setLastfmApiSecret] = useState(s.lastfmApiSecret)
  const [lastfmSessionKey, setLastfmSessionKey] = useState(s.lastfmSessionKey)
  const [discordClientId, setDiscordClientId] = useState(s.discordToken)
  const [spotifyClientId, setSpotifyClientId] = useState(s.spotifyClientId)
  const [spotifyClientSecret, setSpotifyClientSecret] = useState(s.spotifyClientSecret)

  const saveLastfm = () => {
    s.setLastfmApiKey(lastfmApiKey)
    s.setLastfmApiSecret(lastfmApiSecret)
    s.setLastfmSessionKey(lastfmSessionKey)
  }

  const saveDiscord = () => {
    s.setDiscordToken(discordClientId)
  }

  const saveSpotify = () => {
    s.setSpotifyClientId(spotifyClientId)
    s.setSpotifyClientSecret(spotifyClientSecret)
  }

  return (
    <div className={styles.sectionContent}>
      <h3 className={styles.sectionHeader}>Last.fm Scrobbling</h3>
      <SettingRow label="Enable Scrobbling" desc="Track your listening history on Last.fm">
        <Toggle value={s.lastfmEnabled} onChange={s.setLastfmEnabled} />
      </SettingRow>
      {s.lastfmEnabled && (
        <>
          <SettingRow label="API Key" desc="From last.fm/api/account/create">
            <input
              className={styles.input}
              type="password"
              value={lastfmApiKey}
              onChange={e => setLastfmApiKey(e.target.value)}
              placeholder="API key"
            />
          </SettingRow>
          <SettingRow label="API Secret" desc="Shared secret from your Last.fm API account">
            <input
              className={styles.input}
              type="password"
              value={lastfmApiSecret}
              onChange={e => setLastfmApiSecret(e.target.value)}
              placeholder="API secret"
            />
          </SettingRow>
          <SettingRow label="Session Key" desc="Obtained via Last.fm auth flow">
            <input
              className={styles.input}
              type="password"
              value={lastfmSessionKey}
              onChange={e => setLastfmSessionKey(e.target.value)}
              placeholder="Session key"
            />
          </SettingRow>
          <SettingRow label="Scrobble Threshold" desc={`Scrobble after ${s.lastfmScrobbleThreshold}% of track`}>
            <Slider
              value={s.lastfmScrobbleThreshold}
              min={20} max={80} step={5}
              onChange={s.setLastfmScrobbleThreshold}
              format={v => `${v}%`}
            />
          </SettingRow>
          <div className={styles.saveRow}>
            <button className={styles.saveBtn} onClick={saveLastfm}>Save Last.fm Settings</button>
          </div>
        </>
      )}

      <h3 className={styles.sectionHeader}>Discord Rich Presence</h3>
      <SettingRow label="Enable Discord RPC" desc="Show what you're listening to on Discord">
        <Toggle value={s.discordEnabled} onChange={s.setDiscordEnabled} />
      </SettingRow>
      {s.discordEnabled && (
        <>
          <SettingRow label="Discord Client ID" desc="From Discord Developer Portal (Application ID)">
            <input
              className={styles.input}
              type="text"
              value={discordClientId}
              onChange={e => setDiscordClientId(e.target.value)}
              placeholder="e.g. 1234567890123456789"
            />
          </SettingRow>
          <p className={styles.settingHint}>
            Requires Discord desktop app running locally. Create an app at discord.com/developers.
          </p>
          <div className={styles.saveRow}>
            <button className={styles.saveBtn} onClick={saveDiscord}>Save Discord Settings</button>
          </div>
        </>
      )}

      <h3 className={styles.sectionHeader}>Spotify Importer</h3>
      <SettingRow label="Spotify Client ID" desc="Used for fetching full playlists (Optional)">
        <input
          className={styles.input}
          type="text"
          value={spotifyClientId}
          onChange={e => setSpotifyClientId(e.target.value)}
          placeholder="Client ID"
        />
      </SettingRow>
      <SettingRow label="Spotify Client Secret" desc="Used alongside Client ID">
        <input
          className={styles.input}
          type="password"
          value={spotifyClientSecret}
          onChange={e => setSpotifyClientSecret(e.target.value)}
          placeholder="Client Secret"
        />
      </SettingRow>
      <p className={styles.settingHint}>
        If you leave these blank, Velune will use a public scraper that is limited to the first 100 tracks. Create an app at developer.spotify.com to get these keys.
      </p>
      <div className={styles.saveRow}>
        <button className={styles.saveBtn} onClick={saveSpotify}>Save Spotify Settings</button>
      </div>
    </div>
  )
}

function AboutSection() {
  return (
    <div className={styles.sectionContent}>
      <div className={styles.aboutCard}>
        <div className={styles.aboutLogo}>🌌</div>
        <h2 className={styles.aboutName}>Velune</h2>
        <p className={styles.aboutTagline}>The YouTube Music app you always wanted</p>
        <p className={styles.aboutVersion}>Desktop v1.0.0</p>
        <div className={styles.aboutBadges}>
          <span className={styles.badge}>No Ads</span>
          <span className={styles.badge}>No Subscription</span>
          <span className={styles.badge}>Full Control</span>
        </div>
        <p className={styles.aboutDesc}>
          Velune is an open-source YouTube Music client with a beautiful Material You interface,
          offline playback, lyrics, Discord Rich Presence, Last.fm scrobbling, and much more.
        </p>
        <a
          href="https://github.com/nikhilvishwakarma00/Velune"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.aboutLink}
        >
          View on GitHub →
        </a>
      </div>

      <div className={styles.licenseNote}>
        <p>Licensed under GPL-3.0. Not affiliated with YouTube or Google.</p>
      </div>
    </div>
  )
}

function AccountSection() {
  const [status, setStatus] = useState<{ status: string, code?: string, url?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchStatus = async () => {
    try {
      const res = await api.getAuthStatus()
      setStatus(res)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(() => {
      if (status?.status === 'pending') fetchStatus()
    }, 5000)
    return () => clearInterval(interval)
  }, [status?.status])

  const handleStartAuth = async () => {
    setLoading(true)
    try {
      const res = await api.startAuth()
      setStatus(res)
    } finally {
      setLoading(false)
    }
  }

  const handleSignout = async () => {
    setLoading(true)
    try {
      await api.signout()
      await fetchStatus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.sectionContent}>
      <div className={styles.aboutCard}>
        <h3 className={styles.sectionHeader} style={{ marginTop: 0 }}>YouTube Music Account</h3>
        <p className={styles.aboutDesc} style={{ textAlign: 'left', margin: '0 0 1rem 0' }}>
          Sign in to access your personal playlists, liked songs, and receive real YouTube Music recommendations on your Home screen.
          Logging in will <strong>not</strong> enable ads. Playback remains ad-free.
        </p>

        {status?.status === 'signed_in' && (
          <div style={{ padding: '1rem', background: 'rgba(76, 175, 80, 0.1)', borderRadius: 8, border: '1px solid #4CAF50' }}>
            <p style={{ margin: '0 0 1rem 0', color: '#4CAF50', fontWeight: 'bold' }}>✓ Signed In</p>
            <button className={styles.dangerBtn} onClick={handleSignout} disabled={loading}>
              {loading ? <Loader2 size={14} className={styles.spin} /> : 'Sign Out'}
            </button>
          </div>
        )}

        {status?.status === 'signed_out' && (
          <button className={styles.saveBtn} onClick={handleStartAuth} disabled={loading}>
            {loading ? <Loader2 size={14} className={styles.spin} /> : 'Sign In'}
          </button>
        )}

        {status?.status === 'pending' && status.url && status.code && (
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 8 }}>
            <p style={{ margin: '0 0 0.5rem 0' }}>Please authenticate using your browser:</p>
            <ol style={{ margin: '0 0 1rem 1rem', padding: 0 }}>
              <li>Go to <a href={status.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{status.url}</a></li>
              <li>Enter the code below</li>
              <li>Return to Velune</li>
            </ol>
            <div style={{ padding: '0.5rem', background: '#000', fontSize: '1.5rem', textAlign: 'center', letterSpacing: '2px', borderRadius: 4 }}>
              {status.code}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const SECTION_MAP: Record<string, React.FC> = {
  account: AccountSection,
  appearance: AppearanceSection,
  player: PlayerSection,
  equalizer: EqualizerSection,
  storage: StorageSection,
  integrations: IntegrationsSection,
  about: AboutSection,
}

export default function SettingsScreen() {
  const { section = 'appearance' } = useParams<{ section?: string }>()
  const SectionComponent = SECTION_MAP[section] || AppearanceSection

  return (
    <motion.div
      className={styles.page}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25 }}
    >
      <div className={styles.sidebar}>
        <h1 className={styles.title}>Settings</h1>
        <nav className={styles.nav}>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <NavLink
              key={id}
              to={`/settings/${id}`}
              className={({ isActive }) => `${styles.navItem} ${(isActive || (id === 'appearance' && section === 'appearance')) ? styles.navActive : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight size={14} className={styles.chevron} />
            </NavLink>
          ))}
        </nav>
      </div>

      <div className={styles.content}>
        <motion.div
          key={section}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          <SectionComponent />
        </motion.div>
      </div>
    </motion.div>
  )
}
