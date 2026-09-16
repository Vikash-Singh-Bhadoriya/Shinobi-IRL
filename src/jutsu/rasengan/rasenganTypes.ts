import type { HandFrame } from '../../types/hand'

export type RasenganState =
  | 'SEARCHING'
  | 'CHARGING'
  | 'ACTIVE'
  | 'LOST_HAND_GRACE'
  | 'FADE_OUT'

export interface PalmPosition {
  x: number
  y: number
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
  state: RasenganState
}

export interface RasenganDetector {
  analyze(frame: HandFrame, now: number): RasenganDetection
  reset(): void
}
