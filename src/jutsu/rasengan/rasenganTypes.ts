import type { HandFrame } from '../../types/hand'

export type RasenganHand = 'left' | 'right'

export interface RasenganTheme {
  leftColor: string
  rightColor: string
}

export const RASENGAN_THEME: RasenganTheme = {
  leftColor: '#3B82F6',
  rightColor: '#A855F7',
}

export type RasenganState =
  | 'SEARCHING'
  | 'CHARGING'
  | 'ACTIVE_HOLD'
  | 'ARMED'
  | 'STRIKE_DETECTED'
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
  previousVelocity: number
  acceleration: number
  deceleration?: number
  handScale: number
  pinchDetected: boolean
  pinchRawDistance: number
  pinchDistance: number
  pinchStartThreshold: number
  pinchReleaseThreshold: number
  pinchDurationMs: number
  throwConfidence: number
  throwDetected: boolean
  throwCondition: boolean
  handVisible?: boolean
  projectilePosition: PalmPosition | null
  projectileProgress: number
  state: RasenganState
}

export interface RasenganInstance {
  id: RasenganHand
  hand: RasenganHand
  color: string
  detection: RasenganDetection
}

export interface RasenganDetector {
  analyze(frame: HandFrame, now: number): RasenganDetection
  reset(): void
}
