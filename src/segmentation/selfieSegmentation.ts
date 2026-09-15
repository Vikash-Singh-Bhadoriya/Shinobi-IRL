import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import { VISION_TASKS_WASM_URL } from '../vision/handLandmarker'

export const SELFIE_SEGMENTER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite'

async function createSelfieSegmenter(delegate: 'CPU' | 'GPU'): Promise<ImageSegmenter> {
  const vision = await FilesetResolver.forVisionTasks(VISION_TASKS_WASM_URL)
  return ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: SELFIE_SEGMENTER_MODEL_URL,
      delegate,
    },
    runningMode: 'VIDEO',
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  })
}

let segmenterPromise: Promise<ImageSegmenter> | null = null

export function getSelfieSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = createSelfieSegmenter('GPU').catch(() => createSelfieSegmenter('CPU'))
  }
  return segmenterPromise
}