import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

/** One hand: an array of 21 normalized landmarks. */
export type Hand = NormalizedLandmark[]

/** A detected hand together with its MediaPipe handedness label. */
export interface TrackedHand {
  landmarks: Hand
  handedness: string
}

/** All hands tracked in one processed frame (empty when none detected). */
export type HandFrame = TrackedHand[]

/** Imperative draw/analysis sink invoked on each processed frame (no React re-renders). */
export type HandFrameSink = (frame: HandFrame) => void

export type HandTrackingStatus = 'loading' | 'ready' | 'error'

export interface HandTrackingState {
  status: HandTrackingStatus
  error: string | null
  handsCount: number
  visionFps: number
}