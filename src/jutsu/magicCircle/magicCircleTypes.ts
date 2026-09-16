import type { HandFrame } from '../../types/hand'

export type MagicCircleState = 'SEARCHING' | 'ACTIVE' | 'FADE_OUT'

export interface MagicCirclePosition {
  x: number
  y: number
}

export interface MagicCircleDetection {
  state: MagicCircleState
  active: boolean
  palmDetected: boolean
  openPalm: boolean
  openPalmConfidence: number
  palmPosition: MagicCirclePosition | null
  rotation: number
  palmSize: number
  fadeProgress: number
}

export interface MagicCircleDetector {
  analyze(frame: HandFrame, now: number): MagicCircleDetection
  reset(): void
}
