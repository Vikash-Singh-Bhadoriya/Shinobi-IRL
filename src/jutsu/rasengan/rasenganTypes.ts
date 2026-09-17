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
  handScale: number
  handVisible?: boolean
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
