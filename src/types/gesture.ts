import type { FingerSignOk, HandOrientationLabel } from '../gestures/types'

export interface GestureChecks {
  twoHands: boolean
  indexExtended: boolean
  middleExtended: boolean
  ringCurled: boolean
  pinkyCurled: boolean
  orientation: boolean
  intersection: boolean
  stability: boolean
}

export type ShadowCloneState =
  | 'SEARCHING_HANDS'
  | 'WAITING_FOR_SHADOW_CLONE_POSE'
  | 'SHADOW_CLONE_READY'

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
  state: ShadowCloneState
  message: string
  debug: GestureDebugData
}