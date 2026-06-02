import { Minus, Square, X } from 'lucide-react'
import styles from './CustomTitleBar.module.css'

export default function CustomTitleBar() {
  const handleMinimize = () => window.electron?.minimizeWindow()
  const handleMaximize = () => window.electron?.maximizeWindow()
  const handleClose = () => window.electron?.closeWindow()

  return (
    <div className={styles.titlebar}>
      <div className={styles.controls}>
        <button className={styles.controlBtn} onClick={handleMinimize} tabIndex={-1}>
          <Minus size={16} />
        </button>
        <button className={styles.controlBtn} onClick={handleMaximize} tabIndex={-1}>
          <Square size={12} />
        </button>
        <button className={`${styles.controlBtn} ${styles.close}`} onClick={handleClose} tabIndex={-1}>
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
