import type { FingerSignOk, HandOrientationLabel } from '../gestures/types'

export interface GestureChecks {
  twoHands: boolean
  fingers: boolean
  orientation: boolean
  intersection: boolean
  stability: boolean
}

export interface HandGestureDebug {
  fingers: FingerSignOk
  orientation: HandOrientationLabel | null
  angleDeg: number
}

export interface GestureDebugData {
  fingerScore: number
  orientationScore: number
  intersectionRatio: number | null
  stabilityElapsedMs: number
  left: HandGestureDebug | null
  right: HandGestureDebug | null
}

export type GestureName = 'shadow-clone' | 'none'

export interface GestureResult {
  detected: boolean
  gesture: GestureName
  confidence: number
  checks: GestureChecks
  debug: GestureDebugData
}