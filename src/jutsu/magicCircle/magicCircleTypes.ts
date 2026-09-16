import type { HandFrame } from '../../types/hand'

export type MagicCircleState = 'SEARCHING' | 'ACTIVE' | 'FADE_OUT'

export type MagicCircleVisualState = 'IDLE' | 'CHARGING' | 'FULL_POWER' | 'RELEASE'

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
  renderStats?: MagicCircleRenderStats
}

export interface MagicCircleDetector {
  analyze(frame: HandFrame, now: number): MagicCircleDetection
  reset(): void
}

export interface MagicCircleRenderStats {
  visualState: MagicCircleVisualState
  energy: number
  layerCount: number
  particleCount: number
  rotation: number
  fps: number
}
