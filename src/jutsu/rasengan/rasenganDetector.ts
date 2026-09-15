import type { HandFrame } from '../../types/hand'
import { distance } from '../../gestures/handGeometry'
import { isOpenPalm, palmCenter, palmRotation, palmSize } from './rasenganGeometry'
import type { PalmPosition, RasenganDetection, RasenganDetector, RasenganState } from './rasenganTypes'

const HISTORY_SIZE = 24
const MOTION_WINDOW_MS = 700
const CHARGE_MS = 500
const MIN_RADIUS = 0.025
const MIN_SWEEP = Math.PI * 1.35
const MIN_SPEED = 0.00016
const MIN_DIRECTIONALITY = 0.58

interface Sample extends PalmPosition {
  now: number
}

interface MotionResult {
  detected: boolean
  confidence: number
}

function unwrapDelta(delta: number): number {
  if (delta > Math.PI) return delta - Math.PI * 2
  if (delta < -Math.PI) return delta + Math.PI * 2
  return delta
}

function detectCircularMotion(samples: Sample[]): MotionResult {
  const recent = samples.filter((sample) => samples[samples.length - 1].now - sample.now <= MOTION_WINDOW_MS)
  if (recent.length < 8) return { detected: false, confidence: 0 }

  const center = recent.reduce(
    (sum, sample) => ({ x: sum.x + sample.x / recent.length, y: sum.y + sample.y / recent.length }),
    { x: 0, y: 0 },
  )
  const radii = recent.map((sample) => distance(sample, center))
  const radius = radii.reduce((sum, value) => sum + value, 0) / radii.length
  if (radius < MIN_RADIUS) return { detected: false, confidence: 0 }

  let sweep = 0
  let direction = 0
  let path = 0
  for (let index = 1; index < recent.length; index += 1) {
    const previous = recent[index - 1]
    const current = recent[index]
    const previousAngle = Math.atan2(previous.y - center.y, previous.x - center.x)
    const currentAngle = Math.atan2(current.y - center.y, current.x - center.x)
    const delta = unwrapDelta(currentAngle - previousAngle)
    sweep += Math.abs(delta)
    direction += Math.sign(delta)
    path += distance(previous, current)
  }

  const elapsed = recent[recent.length - 1].now - recent[0].now
  const speed = elapsed > 0 ? path / elapsed : 0
  const directionality = Math.abs(direction) / Math.max(1, recent.length - 1)
  const closure = distance(recent[0], recent[recent.length - 1])
  const closureScore = Math.max(0, 1 - closure / (radius * 1.8))
  const sweepScore = Math.min(1, sweep / (Math.PI * 2))
  const confidence = Math.min(
    1,
    sweepScore * 0.35 + directionality * 0.3 + Math.min(1, speed / 0.0008) * 0.2 + closureScore * 0.15,
  )

  return {
    detected:
      sweep >= MIN_SWEEP &&
      speed >= MIN_SPEED &&
      directionality >= MIN_DIRECTIONALITY &&
      closure <= radius * 1.8,
    confidence,
  }
}

function emptyResult(state: RasenganState = 'SEARCHING'): RasenganDetection {
  return {
    active: false,
    confidence: 0,
    palmPosition: null,
    rotation: 0,
    palmSize: 0,
    palmOpen: false,
    circularMotion: false,
    state,
  }
}

export function createRasenganDetector(): RasenganDetector {
  let samples: Sample[] = []
  let chargeStartedAt: number | null = null
  let lastResult = emptyResult()

  const reset = () => {
    samples = []
    chargeStartedAt = null
    lastResult = emptyResult()
  }

  return {
    reset,
    analyze(frame: HandFrame, now: number) {
      const tracked = frame.find((candidate) => candidate.landmarks.length >= 21)
      if (!tracked) {
        reset()
        return lastResult
      }

      const hand = tracked.landmarks
      const open = isOpenPalm(hand)
      const position = palmCenter(hand)
      const size = palmSize(hand)
      if (open) samples = [...samples, { ...position, now }].slice(-HISTORY_SIZE)
      else samples = []

      const motion = open ? detectCircularMotion(samples) : { detected: false, confidence: 0 }
      if (open && motion.detected) {
        if (chargeStartedAt === null) chargeStartedAt = now
      } else {
        chargeStartedAt = null
      }

      const charging = chargeStartedAt !== null
      const ready = chargeStartedAt !== null && now - chargeStartedAt >= CHARGE_MS
      const state: RasenganState = !open
        ? 'SEARCHING'
        : ready
          ? 'RASENGAN_READY'
          : charging
            ? 'CHARGING'
            : 'PALM_FOUND'
      const confidence = Math.min(1, (open ? 0.4 : 0) + motion.confidence * 0.6)
      lastResult = {
        active: ready,
        confidence,
        palmPosition: position,
        rotation: palmRotation(hand),
        palmSize: size,
        palmOpen: open,
        circularMotion: motion.detected,
        state,
      }
      return lastResult
    },
  }
}
