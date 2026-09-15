import type { MPMask } from '@mediapipe/tasks-vision'

const PERSON_THRESHOLD = 0.42
const PERSON_EDGE_SOFTNESS = 0.18

export function extractPerson(
  video: HTMLVideoElement,
  mask: MPMask,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
) {
  const width = mask.width
  const height = mask.height
  if (width === 0 || height === 0) return

  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height

  context.clearRect(0, 0, width, height)
  context.drawImage(video, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height)
  const confidence = mask.getAsFloat32Array()

  for (let index = 0; index < confidence.length; index += 1) {
    const value = confidence[index]
    const alpha = Math.max(0, Math.min(1, (value - PERSON_THRESHOLD) / PERSON_EDGE_SOFTNESS))
    pixels.data[index * 4 + 3] = Math.round(pixels.data[index * 4 + 3] * alpha)
  }

  context.putImageData(pixels, 0, 0)
}