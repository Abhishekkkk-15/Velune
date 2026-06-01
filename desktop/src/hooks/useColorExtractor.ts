import { useEffect } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { proxyImage } from '../api/client'
import Color from 'color'

export function useColorExtractor(imageUrl: string | undefined) {
  const setAccentColor = usePlayerStore(s => s.setAccentColor)

  useEffect(() => {
    if (!imageUrl) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        let r = 0, g = 0, b = 0, count = 0

        // Sample every 10th pixel to save CPU
        for (let i = 0; i < imageData.length; i += 40) {
          r += imageData[i]
          g += imageData[i + 1]
          b += imageData[i + 2]
          count++
        }

        r = Math.floor(r / count)
        g = Math.floor(g / count)
        b = Math.floor(b / count)

        let finalColor = Color.rgb([r, g, b])
        
        // Ensure color isn't too dark or too bright for UI legibility
        if (finalColor.isDark() && finalColor.luminosity() < 0.05) {
          finalColor = finalColor.lighten(0.4)
        }
        if (finalColor.isLight() && finalColor.luminosity() > 0.8) {
          finalColor = finalColor.darken(0.4)
        }
        
        const hex = finalColor.hex()
        setAccentColor(hex)

        document.documentElement.style.setProperty('--primary', hex)
        document.documentElement.style.setProperty('--primary-container', finalColor.darken(0.6).hex())
        document.documentElement.style.setProperty('--primary-glow', finalColor.alpha(0.3).string())
      } catch (err) {
        console.error('[ColorExtractor] Failed to extract color:', err)
      }
    }
    img.onerror = (err) => {
      console.error('[ColorExtractor] Image load failed:', err)
    }
    // Route through the local /api/image proxy to avoid CORS issues
    img.src = proxyImage(imageUrl)
  }, [imageUrl])
}
