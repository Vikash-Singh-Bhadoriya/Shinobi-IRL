import { useEffect, useRef } from 'react'
import type { HandFrame, HandFrameSink } from '../types/hand'
import { HAND_CONNECTIONS } from '../vision/handLandmarker'

interface HandOverlayProps {
  registerSink: (sink: HandFrameSink) => () => void
  showDebug?: boolean
}

export function HandOverlay({ registerSink, showDebug = false }: HandOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = (frame: HandFrame) => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height

      ctx.clearRect(0, 0, width, height)
      if (!showDebug || frame.length === 0) return

      const point = (l: { x: number; y: number }) => ({ x: l.x * width, y: l.y * height })

      ctx.lineWidth = Math.max(1.5, width / 400)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(124, 231, 255, 0.85)'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'

      for (const tracked of frame) {
        const joints = tracked.landmarks.map(point)

        ctx.beginPath()
        for (const [start, end] of HAND_CONNECTIONS) {
          ctx.moveTo(joints[start].x, joints[start].y)
          ctx.lineTo(joints[end].x, joints[end].y)
        }
        ctx.stroke()

        const radius = Math.max(2, width / 200)
        for (const joint of joints) {
          ctx.beginPath()
          ctx.arc(joint.x, joint.y, radius, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const unsubscribe = registerSink(draw)

    return () => {
      unsubscribe()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [registerSink, showDebug])

  return <canvas ref={canvasRef} className="hand-overlay" width={1} height={1} aria-hidden="true" />
}