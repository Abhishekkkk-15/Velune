import { useEffect } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { proxyImage } from '../api/client'

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const toLinear = (c: number) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

export function useColorExtractor(imageUrl: string | undefined) {
  const setAccentColor = usePlayerStore(s => s.setAccentColor)

  useEffect(() => {
    if (!imageUrl) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 50
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0, size, size)
      const data = ctx.getImageData(0, 0, size, size).data

      const buckets: Record<string, { r: number; g: number; b: number; count: number }> = {}
      for (let i = 0; i < data.length; i += 4) {
        const r = Math.round(data[i] / 32) * 32
        const g = Math.round(data[i + 1] / 32) * 32
        const b = Math.round(data[i + 2] / 32) * 32
        const key = `${r},${g},${b}`
        if (!buckets[key]) buckets[key] = { r, g, b, count: 0 }
        buckets[key].count++
      }

      const sorted = Object.values(buckets)
        .filter(c => {
          const lum = luminance(c)
          const saturation = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)
          return saturation > 40 && lum > 0.05 && lum < 0.8
        })
        .sort((a, b) => b.count - a.count)

      const pick = sorted[0] || { r: 237, g: 85, b: 100 }
      const hex = `#${pick.r.toString(16).padStart(2, '0')}${pick.g.toString(16).padStart(2, '0')}${pick.b.toString(16).padStart(2, '0')}`
      setAccentColor(hex)

      document.documentElement.style.setProperty('--primary', hex)
      const darkened = `color-mix(in srgb, ${hex} 30%, #000)`
      document.documentElement.style.setProperty('--primary-container', darkened)
    }
    img.onerror = () => {}
    // Route through the local /api/image proxy to avoid 429 rate-limits from Google CDN
    img.src = proxyImage(imageUrl)
  }, [imageUrl])
}
