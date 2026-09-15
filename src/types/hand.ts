import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

/** One hand: an array of 21 normalized landmarks. */
export type Hand = NormalizedLandmark[]

/** All hands detected in a frame, or null when none detected. */
export type HandLandmarks = Hand[]

/** Imperative draw sink invoked on each processed frame (no React re-renders). */
export type HandLandmarksSink = (landmarks: HandLandmarks | null) => void

export type HandTrackingStatus = 'loading' | 'ready' | 'error'

export interface HandTrackingState {
  status: HandTrackingStatus
  error: string | null
  handsCount: number
  visionFps: number
}