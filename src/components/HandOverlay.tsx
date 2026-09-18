import { useEffect, useRef } from 'react'
import type { HandFrame, HandFrameSink } from '../types/hand'
import { HAND_CONNECTIONS } from '../vision/handLandmarker'

interface HandOverlayProps {
  registerSink: (sink: HandFrameSink) => () => void
  showDebug?: boolean
  canvasRef?: React.RefObject<HTMLCanvasElement>
}

export function HandOverlay({ registerSink, showDebug = false, canvasRef: externalRef }: HandOverlayProps) {
  const internalRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = externalRef || internalRef

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
      if (frame.length === 0) return

      const point = (l: { x: number; y: number }) => ({ x: l.x * width, y: l.y * height })
      
      const scale = Math.max(1, width / 600)

      for (const tracked of frame) {
        const joints = tracked.landmarks.map(point)

        ctx.globalAlpha = 1.0
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        // Connections: thin lines, moderate opacity, subtle glow
        ctx.beginPath()
        for (const [start, end] of HAND_CONNECTIONS) {
          ctx.moveTo(joints[start].x, joints[start].y)
          ctx.lineTo(joints[end].x, joints[end].y)
        }
        ctx.lineWidth = 1.2 * scale
        ctx.strokeStyle = 'rgba(124, 231, 255, 0.45)'
        ctx.shadowColor = 'rgba(124, 231, 255, 0.6)'
        ctx.shadowBlur = 4 * scale
        ctx.stroke()

        // Remove shadow before drawing nodes to keep them clean
        ctx.shadowBlur = 0

        // Landmarks: small, consistent circles
        const radius = 2.0 * scale
        ctx.fillStyle = 'rgba(230, 245, 255, 0.85)'
        ctx.beginPath()
        for (const joint of joints) {
          ctx.moveTo(joint.x + radius, joint.y)
          ctx.arc(joint.x, joint.y, radius, 0, Math.PI * 2)
        }
        ctx.fill()
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