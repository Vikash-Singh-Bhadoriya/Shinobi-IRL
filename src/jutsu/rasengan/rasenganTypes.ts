import type { HandFrame } from '../../types/hand'

export type RasenganState =
  | 'SEARCHING'
  | 'CHARGING'
  | 'ACTIVE_HOLD'
  | 'THROW_DETECTED'
  | 'PROJECTILE'
  | 'IMPACT'
  | 'COOLDOWN'
  | 'LOST_HAND_GRACE'
  | 'FADE_OUT'

export interface PalmPosition {
  x: number
  y: number
}

export interface RasenganVelocity {
  x: number
  y: number
  z: number
  magnitude: number
}

export interface RasenganDetection {
  active: boolean
  confidence: number
  circleConfidence: number
  activationConfidence: number
  palmPosition: PalmPosition | null
  rotation: number
  palmSize: number
  palmOpen: boolean
  circularMotion: boolean
  lostForMs: number
  velocity: RasenganVelocity
  acceleration: number
  handScale: number
  throwConfidence: number
  throwDetected: boolean
  projectilePosition: PalmPosition | null
  projectileProgress: number
  state: RasenganState
}

export interface RasenganDetector {
  analyze(frame: HandFrame, now: number): RasenganDetection
  reset(): void
}
