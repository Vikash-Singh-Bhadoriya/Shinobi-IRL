import type { HandFrame } from '../../types/hand'

export type RasenganState = 'SEARCHING' | 'PALM_FOUND' | 'CHARGING' | 'RASENGAN_READY'

export interface PalmPosition {
  x: number
  y: number
}

export interface RasenganDetection {
  active: boolean
  confidence: number
  palmPosition: PalmPosition | null
  rotation: number
  palmSize: number
  palmOpen: boolean
  circularMotion: boolean
  state: RasenganState
}

export interface RasenganDetector {
  analyze(frame: HandFrame, now: number): RasenganDetection
  reset(): void
}
