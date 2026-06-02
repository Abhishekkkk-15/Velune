import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Search, Library, Clock, BarChart2, Settings } from 'lucide-react'
import logoSrc from '../../assets/ic_velune_concept.svg'
import styles from './NavigationBar.module.css'

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/search', label: 'Search', icon: Search },
  { path: '/library', label: 'Library', icon: Library },
  { path: '/history', label: 'History', icon: Clock },
  { path: '/stats', label: 'Stats', icon: BarChart2 },
]

export default function NavigationBar() {
  const navigate = useNavigate()

  return (
    <nav className={styles.nav}>
      <div className={styles.logo} onClick={() => navigate('/')}>
        <img src={logoSrc} alt="Velune Logo" style={{ width: 28, height: 28, objectFit: 'contain' }} />
        <span className={styles.logoText}>Velune</span>
      </div>

      <div className={styles.items}>
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
          >
            {({ isActive }) => (
              <div className={styles.itemInner}>
                {isActive && (
                  <motion.div
                    className={styles.pill}
                    layoutId="nav-pill"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon size={20} className={styles.icon} />
                <span className={styles.label}>{label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </div>

      <div className={styles.bottom}>
        <NavLink
          to="/settings"
          className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
        >
          {({ isActive }) => (
            <div className={styles.itemInner}>
              {isActive && (
                <motion.div
                  className={styles.pill}
                  layoutId="nav-pill"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Settings size={20} className={styles.icon} />
              <span className={styles.label}>Settings</span>
            </div>
          )}
        </NavLink>
      </div>
    </nav>
  )
}
