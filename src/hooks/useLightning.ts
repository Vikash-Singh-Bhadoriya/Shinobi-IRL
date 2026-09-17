import { useEffect, useMemo, useRef, useState } from 'react'
import type { HandFrameSink } from '../types/hand'
import { createLightningDetector } from '../jutsu/lightning/lightningDetector'
import { LightningRenderer } from '../jutsu/lightning/lightningRenderer'
import type { LightningDetection, LightningHand, LightningInstance } from '../jutsu/lightning/lightningTypes'

function createEmptyResult(): LightningDetection {
  return {
    active: false,
    confidence: 0,
    fistDetected: false,
    fistConfidence: 0,
    palmPosition: null,
    palmSize: 0,
    state: 'SEARCHING',
    fadeProgress: 0,
    lostForMs: 0,
    handScale: 0,
    handVisible: false,
    landmarks: null,
  }
}

const HANDS: LightningHand[] = ['left', 'right']

export function useLightning(registerSink: (sink: HandFrameSink) => () => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<LightningRenderer | null>(null)
  const detectors = useMemo(
    () => HANDS.reduce<Record<LightningHand, ReturnType<typeof createLightningDetector>>>(
      (all, hand) => ({ ...all, [hand]: createLightningDetector(hand) }),
      {} as Record<LightningHand, ReturnType<typeof createLightningDetector>>,
    ),
    [],
  )
  const [result, setResult] = useState<LightningInstance[]>(() => HANDS.map((hand) => ({
    id: hand,
    hand,
    detection: createEmptyResult(),
  })))
  const lastKeyRef = useRef('')
  const lastDebugUpdateRef = useRef(0)
  const lastStateRef = useRef<Record<LightningHand, string>>({ left: 'SEARCHING', right: 'SEARCHING' })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new LightningRenderer(canvas)
    rendererRef.current = renderer
    return () => {
      renderer.destroy()
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    const unsubscribe = registerSink((frame) => {
      const now = performance.now()
      const instances = HANDS.map((hand) => ({
        id: hand,
        hand,
        detection: detectors[hand].analyze(frame, now),
      }))
      rendererRef.current?.setDetections(instances)
      const key = instances.map(({ hand, detection: next }) => `${hand}:${next.state}:${next.fistDetected}:${next.active}:${Math.round(next.confidence * 100)}:${Math.round(next.handScale * 1000)}:${Math.round((next.palmPosition?.x ?? -1) * 100)}:${Math.round((next.palmPosition?.y ?? -1) * 100)}`).join('|')
      const stateChanged = instances.some(({ hand, detection: next }) => next.state !== lastStateRef.current[hand])
      if (key !== lastKeyRef.current && (now - lastDebugUpdateRef.current >= 100 || stateChanged)) {
        lastKeyRef.current = key
        lastDebugUpdateRef.current = now
        for (const instance of instances) lastStateRef.current[instance.hand] = instance.detection.state
        setResult(instances)
      }
    })
    return () => {
      unsubscribe()
      for (const detector of Object.values(detectors)) detector.reset()
    }
  }, [detectors, registerSink])

  return { canvasRef, result }
}
