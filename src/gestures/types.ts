export interface FingerSignOk {
  index: boolean
  middle: boolean
  ring: boolean
  pinky: boolean
}

export type HandOrientationLabel = 'vertical' | 'horizontal'

export interface HandOrientation {
  angleDeg: number
  label: HandOrientationLabel | null
}

export interface HandAnalysis {
  label: string
  fingers: FingerSignOk
  orientation: HandOrientation
  region: { x: number; y: number } | null
  size: number
}

export interface ShadowCloneAnalysis {
  twoHands: boolean
  fingersMatch: boolean
  orientationsMatch: boolean
  intersectionOk: boolean
  fingerScore: number
  orientationScore: number
  intersectionRatio: number | null
  hands: Array<HandAnalysis | null>
}

export interface ShadowCloneResult {
  detected: boolean
  confidence: number
  stabilityElapsedMs: number
  analysis: ShadowCloneAnalysis
}