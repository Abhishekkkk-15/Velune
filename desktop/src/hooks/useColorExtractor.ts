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

        // Downscale to 64×64 for fast sampling
        const SIZE = 64
        canvas.width = SIZE
        canvas.height = SIZE
        ctx.drawImage(img, 0, 0, SIZE, SIZE)

        const imageData = ctx.getImageData(0, 0, SIZE, SIZE).data

        // ── Saturation-weighted color extraction ──────────────────────────────
        // Simple averaging produces muddy grays. Instead, weight each pixel by
        // its saturation so vivid album-art colours dominate the result.
        let rSum = 0, gSum = 0, bSum = 0, totalWeight = 0

        for (let i = 0; i < imageData.length; i += 4) {
          const pr = imageData[i]
          const pg = imageData[i + 1]
          const pb = imageData[i + 2]

          const rn = pr / 255
          const gn = pg / 255
          const bn = pb / 255

          const max = Math.max(rn, gn, bn)
          const min = Math.min(rn, gn, bn)
          const lightness = (max + min) / 2
          const chroma = max - min
          const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1))

          // Skip near-black, near-white, and near-grey pixels — they dilute colour
          if (lightness < 0.08 || lightness > 0.92 || saturation < 0.12) continue

          // Quadratic weight: amplifies vivid pixels, de-emphasises dull ones
          const w = saturation * saturation
          rSum += pr * w
          gSum += pg * w
          bSum += pb * w
          totalWeight += w
        }

        let r: number, g: number, b: number

        if (totalWeight > 0) {
          r = Math.round(rSum / totalWeight)
          g = Math.round(gSum / totalWeight)
          b = Math.round(bSum / totalWeight)
        } else {
          // Fallback: plain average (very muted album art, e.g. black-and-white)
          let rFallback = 0, gFallback = 0, bFallback = 0, count = 0
          for (let i = 0; i < imageData.length; i += 4) {
            rFallback += imageData[i]
            gFallback += imageData[i + 1]
            bFallback += imageData[i + 2]
            count++
          }
          r = Math.round(rFallback / count)
          g = Math.round(gFallback / count)
          b = Math.round(bFallback / count)
        }

        let finalColor = Color.rgb([r, g, b])

        // Ensure colour is legible against a dark UI background
        if (finalColor.luminosity() < 0.06) {
          finalColor = finalColor.lighten(0.5)
        }
        if (finalColor.luminosity() > 0.75) {
          finalColor = finalColor.darken(0.35)
        }

        // Boost saturation so muted album art still produces a noticeable accent
        const hsl = finalColor.hsl()
        if (hsl.saturationl() < 35) {
          finalColor = finalColor.saturate(0.6)
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
    img.src = proxyImage(imageUrl)
  }, [imageUrl])
}
