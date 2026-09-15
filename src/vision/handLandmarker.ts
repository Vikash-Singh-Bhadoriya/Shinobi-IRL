import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

export const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export const VISION_TASKS_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'

/**
 * Confidence thresholds tuned for real-time tracking stability:
 * - Detection kept at 0.5 to avoid spurious detections when first locking on.
 * - Presence/tracking lowered to 0.4 so the tracker keeps lock during fast
 *   motion and partial occlusion instead of flickering on/off.
 */
export const MIN_HAND_DETECTION_CONFIDENCE = 0.5
export const MIN_HAND_PRESENCE_CONFIDENCE = 0.4
export const MIN_HAND_TRACKING_CONFIDENCE = 0.4

/** Standard 21-point hand topology: palm, thumb, index, middle, ring, pinky. */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
]

async function createHandLandmarker(
  delegate: 'CPU' | 'GPU',
): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(VISION_TASKS_WASM_URL)
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: HAND_LANDMARKER_MODEL_URL,
      delegate,
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: MIN_HAND_DETECTION_CONFIDENCE,
    minHandPresenceConfidence: MIN_HAND_PRESENCE_CONFIDENCE,
    minTrackingConfidence: MIN_HAND_TRACKING_CONFIDENCE,
  })
}

let landmarkerPromise: Promise<HandLandmarker> | null = null

/**
 * Lazily creates the HandLandmarker once per page and reuses it. A page-lifetime
 * singleton avoids re-downloading the model on every mount.
 */
export function getHandLandmarker(): Promise<HandLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = createHandLandmarker('GPU').catch(() =>
      createHandLandmarker('CPU'),
    )
  }
  return landmarkerPromise
}