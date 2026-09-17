import type { Hand, HandFrame } from '../../types/hand'

export type LightningHand = 'left' | 'right'

export type LightningState =
  | 'SEARCHING'
  | 'CHARGING'
  | 'ACTIVE_HOLD'
  | 'LOST_HAND_GRACE'
  | 'FADE_OUT'

export interface LightningPosition {
  x: number
  y: number
}

export interface LightningDetection {
  active: boolean
  confidence: number
  fistDetected: boolean
  fistConfidence: number
  palmPosition: LightningPosition | null
  palmSize: number
  state: LightningState
  fadeProgress: number
  lostForMs: number
  handScale: number
  handVisible: boolean
  /** Raw 21-point MediaPipe hand skeleton so the renderer can follow hand anatomy. Kept for the last visible frame during fade-out. */
  landmarks: Hand | null
}

export interface LightningInstance {
  id: LightningHand
  hand: LightningHand
  detection: LightningDetection
}

export interface LightningDetector {
  analyze(frame: HandFrame, now: number): LightningDetection
  reset(): void
}
