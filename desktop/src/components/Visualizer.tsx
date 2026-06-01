import { useEffect, useRef } from 'react'
import audioEngine from '../audioEngine'

interface Props {
  accentColor: string
  isPlaying: boolean
  barCount?: number
  height?: number
}

export default function Visualizer({ accentColor, isPlaying, barCount = 40, height = 64 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const frameRef  = useRef<number[]>(new Array(barCount).fill(0))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)

      const W = canvas.offsetWidth  * devicePixelRatio
      const H = canvas.offsetHeight * devicePixelRatio
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width  = W
        canvas.height = H
      }

      ctx.clearRect(0, 0, W, H)

      const rawData = audioEngine.getFrequencyData()
      const gap     = Math.max(2, W * 0.012)
      const barW    = (W - gap * (barCount + 1)) / barCount

      for (let i = 0; i < barCount; i++) {
        let target = 0
        if (rawData && isPlaying) {
          const binIndex = Math.floor((i / barCount) * (rawData.length * 0.75))
          target = rawData[binIndex] / 255
        }

        // Smooth towards target
        const prev = frameRef.current[i]
        frameRef.current[i] = target > prev
          ? prev + (target - prev) * 0.4
          : prev + (target - prev) * 0.15

        const v    = frameRef.current[i]
        const barH = Math.max(3, v * H * 0.88)
        const x    = gap + i * (barW + gap)
        const y    = H - barH
        const r    = Math.min(barW / 2, 4)

        ctx.globalAlpha = 0.35 + v * 0.65
        ctx.fillStyle   = accentColor

        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + barW - r, y)
        ctx.arcTo(x + barW, y, x + barW, y + r, r)
        ctx.lineTo(x + barW, H)
        ctx.lineTo(x, H)
        ctx.lineTo(x, y + r)
        ctx.arcTo(x, y, x + r, y, r)
        ctx.closePath()
        ctx.fill()
      }

      ctx.globalAlpha = 1
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [accentColor, isPlaying, barCount])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height, display: 'block' }}
    />
  )
}
