import { useEffect, useMemo, useRef, useState } from 'react'
import type { HandFrameSink } from '../types/hand'
import { createRasenganDetector } from '../jutsu/rasengan/rasenganDetector'
import { RasenganRenderer } from '../jutsu/rasengan/rasenganRenderer'
import type { RasenganDetection } from '../jutsu/rasengan/rasenganTypes'

const EMPTY_RESULT: RasenganDetection = {
  active: false,
  confidence: 0,
  circleConfidence: 0,
  activationConfidence: 0,
  palmPosition: null,
  rotation: 0,
  palmSize: 0,
  palmOpen: false,
  circularMotion: false,
  lostForMs: 0,
  velocity: { x: 0, y: 0, z: 0, magnitude: 0 },
  acceleration: 0,
  handScale: 0,
  throwConfidence: 0,
  throwDetected: false,
  projectilePosition: null,
  projectileProgress: 0,
  state: 'SEARCHING',
}

export function useRasengan(registerSink: (sink: HandFrameSink) => () => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<RasenganRenderer | null>(null)
  const detector = useMemo(() => createRasenganDetector(), [])
  const [result, setResult] = useState<RasenganDetection>(EMPTY_RESULT)
  const lastKeyRef = useRef('')
  const lastDebugUpdateRef = useRef(0)
  const lastStateRef = useRef(EMPTY_RESULT.state)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new RasenganRenderer(canvas)
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
      const key = `${next.state}:${next.palmOpen}:${next.circularMotion}:${next.active}:${next.throwDetected}:${Math.round(next.confidence * 100)}:${Math.round(next.velocity.magnitude * 100000)}:${Math.round(next.acceleration * 100)}:${Math.round(next.handScale * 1000)}:${Math.round(next.throwConfidence * 100)}:${Math.round((next.projectilePosition?.x ?? -1) * 100)}:${Math.round((next.projectilePosition?.y ?? -1) * 100)}`
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
