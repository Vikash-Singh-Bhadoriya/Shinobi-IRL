import { useEffect, useMemo, useRef, useState } from 'react'
import type { HandFrameSink } from '../types/hand'
import { createRasenganDetector } from '../jutsu/rasengan/rasenganDetector'
import { RasenganRenderer } from '../jutsu/rasengan/rasenganRenderer'
import type { RasenganDetection } from '../jutsu/rasengan/rasenganTypes'

const EMPTY_RESULT: RasenganDetection = {
  active: false,
  confidence: 0,
  palmPosition: null,
  rotation: 0,
  palmSize: 0,
  palmOpen: false,
  circularMotion: false,
  state: 'SEARCHING',
}

export function useRasengan(registerSink: (sink: HandFrameSink) => () => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<RasenganRenderer | null>(null)
  const detector = useMemo(() => createRasenganDetector(), [])
  const [result, setResult] = useState<RasenganDetection>(EMPTY_RESULT)
  const lastKeyRef = useRef('')

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
      const key = `${next.state}:${next.palmOpen}:${next.circularMotion}:${next.active}:${Math.round(next.confidence * 100)}`
      if (key !== lastKeyRef.current) {
        lastKeyRef.current = key
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
