import { useEffect, useMemo, useRef, useState } from 'react'
import type { HandFrameSink } from '../types/hand'
import { createRasenganDetector } from '../jutsu/rasengan/rasenganDetector'
import { RasenganRenderer } from '../jutsu/rasengan/rasenganRenderer'
import { RASENGAN_THEME } from '../jutsu/rasengan/rasenganTypes'
import type { RasenganDetection, RasenganHand, RasenganInstance } from '../jutsu/rasengan/rasenganTypes'

function createEmptyResult(): RasenganDetection {
  return {
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
    previousVelocity: 0,
    acceleration: 0,
    handScale: 0,
    pinchDetected: false,
    pinchRawDistance: 0,
    pinchDistance: 0,
    pinchStartThreshold: 0,
    pinchReleaseThreshold: 0,
    pinchDurationMs: 0,
    throwConfidence: 0,
    throwDetected: false,
    throwCondition: false,
    projectilePosition: null,
    projectileProgress: 0,
    state: 'SEARCHING',
  }
}

const HANDS: RasenganHand[] = ['left', 'right']

export function useRasengan(registerSink: (sink: HandFrameSink) => () => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<RasenganRenderer | null>(null)
  const detectors = useMemo(
    () => HANDS.reduce<Record<RasenganHand, ReturnType<typeof createRasenganDetector>>>(
      (all, hand) => ({ ...all, [hand]: createRasenganDetector(hand) }),
      {} as Record<RasenganHand, ReturnType<typeof createRasenganDetector>>,
    ),
    [],
  )
  const [result, setResult] = useState<RasenganInstance[]>(() => HANDS.map((hand) => ({
    id: hand,
    hand,
    color: hand === 'left' ? RASENGAN_THEME.leftColor : RASENGAN_THEME.rightColor,
    detection: createEmptyResult(),
  })))
  const lastKeyRef = useRef('')
  const lastDebugUpdateRef = useRef(0)
  const lastStateRef = useRef<Record<RasenganHand, string>>({ left: 'SEARCHING', right: 'SEARCHING' })

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
      const now = performance.now()
      const instances = HANDS.map((hand) => ({
        id: hand,
        hand,
        color: hand === 'left' ? RASENGAN_THEME.leftColor : RASENGAN_THEME.rightColor,
        detection: detectors[hand].analyze(frame, now),
      }))
      rendererRef.current?.setDetections(instances)
      const key = instances.map(({ hand, detection: next }) => `${hand}:${next.state}:${next.palmOpen}:${next.circularMotion}:${next.active}:${next.throwDetected}:${Math.round(next.confidence * 100)}:${Math.round(next.velocity.magnitude * 100000)}:${Math.round(next.handScale * 1000)}:${Math.round((next.projectilePosition?.x ?? -1) * 100)}:${Math.round((next.projectilePosition?.y ?? -1) * 100)}`).join('|')
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
