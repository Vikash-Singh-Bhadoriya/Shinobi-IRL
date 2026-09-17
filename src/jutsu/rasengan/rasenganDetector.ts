import type { HandFrame } from '../../types/hand'
import { distance } from '../../gestures/handGeometry'
import { isOpenPalm, palmCenter, palmRotation, palmSize } from './rasenganGeometry'
import type {
  PalmPosition,
  RasenganDetection,
  RasenganDetector,
  RasenganState,
  RasenganHand,
} from './rasenganTypes'

const HISTORY_SIZE = 54
const MOTION_WINDOW_MS = 850
const CHARGE_MS = 240
const CHARGE_MOTION_GRACE_MS = 150
const GESTURE_GATE_RESET_MS = 200
const LOST_HAND_GRACE_MS = 1000
const FADE_OUT_MS = 500
const MIN_SWEEP = Math.PI * 1.15
const MIN_DIRECTIONALITY = 0.45

interface Sample extends PalmPosition {
  now: number
  scale: number
}

interface MotionResult {
  detected: boolean
  confidence: number
}

interface HandSnapshot {
  position: PalmPosition
  rotation: number
  size: number
}

function unwrapDelta(delta: number): number {
  if (delta > Math.PI) return delta - Math.PI * 2
  if (delta < -Math.PI) return delta + Math.PI * 2
  return delta
}

function detectCircularMotion(samples: Sample[]): MotionResult {
  const recent = samples.filter((sample) => samples[samples.length - 1].now - sample.now <= MOTION_WINDOW_MS)
  if (recent.length < 6) return { detected: false, confidence: 0 }
  const center = recent.reduce(
    (sum, sample) => ({ x: sum.x + sample.x / recent.length, y: sum.y + sample.y / recent.length }),
    { x: 0, y: 0 },
  )
  const radii = recent.map((sample) => distance(sample, center))
  const radius = radii.reduce((sum, value) => sum + value, 0) / radii.length
  const handScale = recent.reduce((sum, sample) => sum + sample.scale, 0) / recent.length
  if (radius < handScale * 0.18) return { detected: false, confidence: 0 }

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
  const minimumSpeed = handScale / 2600
  const directionality = Math.abs(direction) / Math.max(1, recent.length - 1)
  const closure = distance(recent[0], recent[recent.length - 1])
  const closureScore = Math.max(0, 1 - closure / (radius * 2.2))
  const sweepScore = Math.min(1, sweep / (Math.PI * 2))
  const speedScore = Math.min(1, speed / Math.max(0.00008, radius / Math.max(1, elapsed)))
  const confidence = Math.min(1, sweepScore * 0.4 + directionality * 0.28 + speedScore * 0.14 + closureScore * 0.18)

  return {
    detected: sweep >= MIN_SWEEP && directionality >= MIN_DIRECTIONALITY && speed >= minimumSpeed && closure <= radius * 2.2,
    confidence,
  }
}

function emptyResult(state: RasenganState = 'SEARCHING', lostForMs = 0): RasenganDetection {
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
    lostForMs,
    handScale: 0,
    handVisible: false,
    state,
  }
}

export function createRasenganDetector(targetHand: RasenganHand = 'right'): RasenganDetector {
  let samples: Sample[] = []
  let chargeStartedAt: number | null = null
  let motionLostSince: number | null = null
  let gestureGateLostSince: number | null = null
  let activated = false
  let missingSince: number | null = null
  let lastHand: HandSnapshot | null = null
  let lastResult = emptyResult()

  const reset = () => {
    samples = []
    chargeStartedAt = null
    motionLostSince = null
    gestureGateLostSince = null
    activated = false
    missingSince = null
    lastHand = null
    lastResult = emptyResult()
  }

  const withLifecycle = (state: RasenganState, values: Partial<RasenganDetection> = {}): RasenganDetection => ({
    ...lastResult,
    active: state === 'ACTIVE_HOLD' || state === 'CHARGING',
    state,
    ...values,
  })

  return {
    reset,
    analyze(frame: HandFrame, now: number) {
      const tracked = frame.find((candidate) =>
        candidate.landmarks.length >= 21 && candidate.handedness.toLowerCase() === targetHand,
      )
      if (!tracked) {
        if (missingSince === null) missingSince = now
        const lostForMs = now - missingSince
        if (!activated) {
          samples = []
          chargeStartedAt = null
          motionLostSince = null
          gestureGateLostSince = null
          lastResult = emptyResult('SEARCHING', lostForMs)
          return lastResult
        }
        const state: RasenganState = lostForMs <= LOST_HAND_GRACE_MS ? 'LOST_HAND_GRACE' : 'FADE_OUT'
        lastResult = withLifecycle(state, {
          active: false,
          confidence: Math.max(0, 1 - lostForMs / (LOST_HAND_GRACE_MS + FADE_OUT_MS)),
          palmPosition: lastHand?.position ?? null,
          rotation: lastHand?.rotation ?? 0,
          palmSize: lastHand?.size ?? 0,
          handScale: lastHand?.size ?? 0,
          palmOpen: false,
          circularMotion: false,
          lostForMs,
          handVisible: false,
        })
        if (lostForMs > LOST_HAND_GRACE_MS + FADE_OUT_MS) reset()
        return lastResult
      }

      const landmarks = tracked.landmarks
      missingSince = null
      const open = isOpenPalm(landmarks)
      const position = palmCenter(landmarks)
      const size = palmSize(landmarks)
      const rotation = palmRotation(landmarks)
      const handVisible = landmarks.every((landmark) =>
        Number.isFinite(landmark.x) &&
        Number.isFinite(landmark.y) &&
        landmark.x >= 0.015 &&
        landmark.x <= 0.985 &&
        landmark.y >= 0.015 &&
        landmark.y <= 0.985,
      )
      lastHand = { position, rotation, size }

      if (open && handVisible) {
        samples = [...samples, { ...position, now, scale: size }].slice(-HISTORY_SIZE)
        gestureGateLostSince = null
      } else if (gestureGateLostSince === null) {
        gestureGateLostSince = now
      }

      if (!activated) {
        if (gestureGateLostSince !== null && now - gestureGateLostSince >= GESTURE_GATE_RESET_MS) {
          samples = []
          chargeStartedAt = null
          motionLostSince = null
        }
      }

      const motion = !activated && open ? detectCircularMotion(samples) : { detected: false, confidence: 0 }
      if (!activated) {
        if (motion.detected) {
          if (chargeStartedAt === null) chargeStartedAt = now
          motionLostSince = null
        } else if (chargeStartedAt !== null && motionLostSince === null) {
          motionLostSince = now
        }
        if (chargeStartedAt !== null && motionLostSince !== null && now - motionLostSince >= CHARGE_MOTION_GRACE_MS) {
          chargeStartedAt = null
        }
        if (chargeStartedAt !== null && now - chargeStartedAt >= CHARGE_MS) {
          activated = true
        }
      }

      const charging = !activated && chargeStartedAt !== null
      const state: RasenganState = activated
        ? 'ACTIVE_HOLD'
        : charging
          ? 'CHARGING'
          : 'SEARCHING'
      const activationConfidence = Math.min(1, (open ? 0.45 : 0) + motion.confidence * 0.55)
      lastResult = withLifecycle(state, {
        active: activated,
        confidence: activated ? 1 : activationConfidence,
        circleConfidence: motion.confidence,
        activationConfidence,
        palmPosition: position,
        rotation,
        palmSize: size,
        palmOpen: open,
        circularMotion: motion.detected,
        lostForMs: 0,
        handScale: size,
        handVisible,
      })
      return lastResult
    },
  }
}
