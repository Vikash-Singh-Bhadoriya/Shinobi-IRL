import { useEffect, useMemo, useRef, useState } from 'react'
import type { HandFrameSink } from '../../types/hand'
import { createMagicCircleDetector } from './magicCircleDetector'
import { MagicCircleRenderer } from './magicCircleRenderer'
import type { MagicCircleDetection } from './magicCircleTypes'

const EMPTY_RESULT: MagicCircleDetection = {
  state: 'SEARCHING',
  active: false,
  palmDetected: false,
  openPalm: false,
  openPalmConfidence: 0,
  palmPosition: null,
  rotation: 0,
  palmSize: 0,
  fadeProgress: 0,
}

export function useMagicCircle(registerSink: (sink: HandFrameSink) => () => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<MagicCircleRenderer | null>(null)
  const detector = useMemo(() => createMagicCircleDetector(), [])
  const [result, setResult] = useState<MagicCircleDetection>(EMPTY_RESULT)
  const lastKeyRef = useRef('')
  const lastDebugUpdateRef = useRef(0)
  const lastStateRef = useRef(EMPTY_RESULT.state)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new MagicCircleRenderer(canvas)
    rendererRef.current = renderer
    return () => {
      renderer.destroy()
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    const unsubscribe = registerSink((frame) => {
      const next = detector.analyze(frame, performance.now())
      rendererRef.current?.setDetection(next)
      const now = performance.now()
      const key = `${next.state}:${next.palmDetected}:${next.openPalm}:${Math.round(next.openPalmConfidence * 100)}:${Math.round((next.palmPosition?.x ?? -1) * 100)}:${Math.round((next.palmPosition?.y ?? -1) * 100)}:${Math.round((next.rotation * 180) / Math.PI)}`
      if (key !== lastKeyRef.current && (now - lastDebugUpdateRef.current >= 100 || next.state !== lastStateRef.current)) {
        lastKeyRef.current = key
        lastDebugUpdateRef.current = now
        lastStateRef.current = next.state
        setResult(next)
      }
    })
    return () => {
      unsubscribe()
      detector.reset()
    }
  }, [detector, registerSink])

  return { canvasRef, result }
}
