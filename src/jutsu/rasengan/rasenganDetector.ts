import type { HandFrame } from '../../types/hand'
import { distance, LANDMARKS } from '../../gestures/handGeometry'
import { isOpenPalm, palmCenter, palmRotation, palmSize } from './rasenganGeometry'
import type {
  PalmPosition,
  RasenganDetection,
  RasenganDetector,
  RasenganState,
  RasenganVelocity,
  RasenganHand,
} from './rasenganTypes'

const HISTORY_SIZE = 12
const MOTION_WINDOW_MS = 850
const CHARGE_MS = 500
const PINCH_CONFIRMATION_MS = 70
const PINCH_SMOOTHING_ALPHA = 0.5
const PINCH_START_THRESHOLD = 0.62
const PINCH_RELEASE_THRESHOLD = 0.72
const LOST_HAND_GRACE_MS = 1000
const FADE_OUT_MS = 500
const PROJECTILE_MS = 360
const IMPACT_MS = 400
const COOLDOWN_MS = 2000
const MIN_SWEEP = Math.PI * 1.15
const MIN_DIRECTIONALITY = 0.45
const STABLE_ARM_MS = 500
const STABLE_SPEED_MAX = 0.16

interface Sample extends PalmPosition {
  now: number
  scale: number
  speed: number
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

interface ProjectileSnapshot {
  start: PalmPosition
  direction: { x: number; y: number }
  startedAt: number
}

const ZERO_VELOCITY: RasenganVelocity = { x: 0, y: 0, z: 0, magnitude: 0 }

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
    velocity: ZERO_VELOCITY,
    previousVelocity: 0,
    acceleration: 0,
    deceleration: 0,
    handScale: 0,
    pinchDetected: false,
    pinchRawDistance: 0,
    pinchDistance: 0,
    pinchStartThreshold: PINCH_START_THRESHOLD,
    pinchReleaseThreshold: PINCH_RELEASE_THRESHOLD,
    pinchDurationMs: 0,
    throwConfidence: 0,
    throwDetected: false,
    throwCondition: false,
    handVisible: false,
    projectilePosition: null,
    projectileProgress: 0,
    state,
  }
}

function getProjectilePosition(projectile: ProjectileSnapshot, now: number): PalmPosition {
  const progress = Math.min(1, Math.max(0, (now - projectile.startedAt) / PROJECTILE_MS))
  const eased = 1 - Math.pow(1 - progress, 1.35)
  const baseX = projectile.start.x + (0.5 - projectile.start.x) * eased
  const baseY = projectile.start.y + (0.42 - projectile.start.y) * eased
  const curve = Math.sin(Math.PI * eased) * 0.1
  return {
    x: baseX - projectile.direction.y * curve,
    y: baseY + projectile.direction.x * curve,
  }
}

export function createRasenganDetector(targetHand: RasenganHand = 'right'): RasenganDetector {
  let samples: Sample[] = []
  let chargeStartedAt: number | null = null
  let stableSince: number | null = null
  let armed = false
  let activated = false
  let missingSince: number | null = null
  let lastHand: HandSnapshot | null = null
  let projectile: ProjectileSnapshot | null = null
  let impactStartedAt: number | null = null
  let cooldownUntil = 0
  let pinchStartedAt: number | null = null
  let pinchActive = false
  let smoothedPinchDistance: number | null = null
  let lastResult = emptyResult()

  const reset = () => {
    samples = []
    chargeStartedAt = null
    stableSince = null
    armed = false
    activated = false
    missingSince = null
    lastHand = null
    projectile = null
    impactStartedAt = null
    cooldownUntil = 0
    pinchStartedAt = null
    pinchActive = false
    smoothedPinchDistance = null
    lastResult = emptyResult()
  }

  const withLifecycle = (state: RasenganState, now: number, values: Partial<RasenganDetection> = {}): RasenganDetection => ({
    ...lastResult,
    active: state === 'ACTIVE_HOLD' || state === 'ARMED' || state === 'CHARGING',
    state,
    throwDetected: false,
    throwCondition: false,
    pinchDetected: false,
    pinchDurationMs: 0,
    ...values,
    projectilePosition: projectile ? getProjectilePosition(projectile, now) : null,
    projectileProgress: projectile ? Math.min(1, Math.max(0, (now - projectile.startedAt) / PROJECTILE_MS)) : 0,
  })

  return {
    reset,
    analyze(frame: HandFrame, now: number) {
      if (cooldownUntil > now) {
        lastResult = withLifecycle('COOLDOWN', now, { active: false, palmOpen: false, circularMotion: false })
        return lastResult
      }
      if (cooldownUntil !== 0) reset()

      if (projectile) {
        if (now - projectile.startedAt < PROJECTILE_MS) {
          lastResult = withLifecycle('PROJECTILE', now, { active: false, palmPosition: null })
          return lastResult
        }
        if (impactStartedAt === null) impactStartedAt = now
        if (now - impactStartedAt < IMPACT_MS) {
          lastResult = withLifecycle('IMPACT', now, { active: false, palmPosition: null })
          return lastResult
        }
        projectile = null
        impactStartedAt = null
        cooldownUntil = now + COOLDOWN_MS
        lastResult = withLifecycle('COOLDOWN', now, { active: false, palmPosition: null })
        return lastResult
      }

      const tracked = frame.find((candidate) =>
        candidate.landmarks.length >= 21 && candidate.handedness.toLowerCase() === targetHand,
      )
      if (!tracked) {
        if (missingSince === null) missingSince = now
        const lostForMs = now - missingSince
        pinchStartedAt = null
        pinchActive = false
        smoothedPinchDistance = null
        if (!activated) {
          samples = []
          chargeStartedAt = null
          lastResult = emptyResult('SEARCHING', lostForMs)
          return lastResult
        }
        const state: RasenganState = lostForMs <= LOST_HAND_GRACE_MS ? 'LOST_HAND_GRACE' : 'FADE_OUT'
        lastResult = withLifecycle(state, now, {
          active: false,
          confidence: Math.max(0, 1 - lostForMs / (LOST_HAND_GRACE_MS + FADE_OUT_MS)),
          palmPosition: lastHand?.position ?? null,
          rotation: lastHand?.rotation ?? 0,
          palmSize: lastHand?.size ?? 0,
          handScale: lastHand?.size ?? 0,
          deceleration: 0,
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
      const previous = samples[samples.length - 1]
      const previousPrevious = samples[samples.length - 2]
      const elapsed = previous ? Math.max(1, now - previous.now) : 1
      const velocity: RasenganVelocity = previous
        ? {
            x: (position.x - previous.x) / elapsed * 1000,
            y: (position.y - previous.y) / elapsed * 1000,
            z: (size - previous.scale) / elapsed * 1000,
            magnitude: distance(position, previous) / elapsed * 1000,
          }
        : ZERO_VELOCITY
      const previousVelocity = previous && previousPrevious
        ? distance(previous, previousPrevious) / Math.max(1, previous.now - previousPrevious.now) * 1000
        : 0
      const acceleration = previous ? Math.max(0, velocity.magnitude - previousVelocity) / elapsed * 1000 : 0
      const deceleration = previous ? Math.max(0, previousVelocity - velocity.magnitude) / elapsed * 1000 : 0
      lastHand = { position, rotation, size }
      if (open && handVisible) samples = [...samples, { ...position, now, scale: size, speed: velocity.magnitude }].slice(-HISTORY_SIZE)
      else if (!activated) samples = []

      const motion = !activated && open ? detectCircularMotion(samples) : { detected: false, confidence: 0 }
      if (!activated && open && motion.detected) {
        if (chargeStartedAt === null) chargeStartedAt = now
      } else if (!activated) {
        chargeStartedAt = null
      }
      if (!activated && chargeStartedAt !== null && now - chargeStartedAt >= CHARGE_MS) {
        activated = true
        stableSince = null
      }

      const stable = activated && open && handVisible && velocity.magnitude <= STABLE_SPEED_MAX
      if (stable) {
        if (stableSince === null) stableSince = now
        if (stableSince !== null && now - stableSince >= STABLE_ARM_MS) armed = true
      } else if (activated && !armed) {
        stableSince = null
      }

      const pinchRawDistance = distance(landmarks[LANDMARKS.THUMB_TIP], landmarks[LANDMARKS.INDEX_TIP]) / Math.max(size, 0.0001)
      smoothedPinchDistance = smoothedPinchDistance === null
        ? pinchRawDistance
        : PINCH_SMOOTHING_ALPHA * pinchRawDistance + (1 - PINCH_SMOOTHING_ALPHA) * smoothedPinchDistance
      if (pinchActive) {
        if (smoothedPinchDistance >= PINCH_RELEASE_THRESHOLD) pinchActive = false
      } else if (smoothedPinchDistance <= PINCH_START_THRESHOLD) {
        pinchActive = true
      }
      const pinchDistance = smoothedPinchDistance
      if (armed && handVisible && pinchActive) {
        if (pinchStartedAt === null) pinchStartedAt = now
      } else {
        pinchStartedAt = null
      }
      const pinchHeldFor = pinchStartedAt === null ? 0 : now - pinchStartedAt
      const throwCondition = armed && handVisible && pinchActive && pinchHeldFor >= PINCH_CONFIRMATION_MS
      if (throwCondition) {
        projectile = {
          start: position,
          direction: { x: 0.5 - position.x, y: 0.42 - position.y },
          startedAt: now,
        }
        activated = false
        armed = false
        pinchStartedAt = null
        lastResult = withLifecycle('THROW_DETECTED', now, {
          active: false,
          confidence: 1,
          palmPosition: position,
          palmOpen: open,
          circularMotion: false,
          velocity,
          previousVelocity,
          acceleration,
          deceleration,
          handScale: size,
          pinchDetected: pinchActive,
          pinchRawDistance,
          pinchDistance,
          pinchStartThreshold: PINCH_START_THRESHOLD,
          pinchReleaseThreshold: PINCH_RELEASE_THRESHOLD,
          pinchDurationMs: pinchHeldFor,
          throwConfidence: 1,
          throwDetected: true,
          throwCondition,
          handVisible,
          lostForMs: 0,
        })
        return lastResult
      }

      const charging = !activated && chargeStartedAt !== null
      const state: RasenganState = activated
        ? armed
          ? 'ARMED'
          : 'ACTIVE_HOLD'
        : charging
          ? 'CHARGING'
          : 'SEARCHING'
      const activationConfidence = Math.min(1, (open ? 0.45 : 0) + motion.confidence * 0.55)
      lastResult = withLifecycle(state, now, {
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
        velocity,
        previousVelocity,
        acceleration,
        deceleration,
        handScale: size,
        pinchDetected: pinchActive,
        pinchRawDistance,
        pinchDistance,
        pinchStartThreshold: PINCH_START_THRESHOLD,
        pinchReleaseThreshold: PINCH_RELEASE_THRESHOLD,
        pinchDurationMs: pinchHeldFor,
        throwConfidence: pinchActive ? Math.min(1, pinchHeldFor / PINCH_CONFIRMATION_MS) : 0,
        throwCondition,
        handVisible,
      })
      return lastResult
    },
  }
}
