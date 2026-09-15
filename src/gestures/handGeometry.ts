import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Hand } from '../types/hand'
import type { HandOrientationLabel } from './types'

type Point = { x: number; y: number }

export const LANDMARKS = {
  WRIST: 0,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function pointsOf(hand: Hand, indices: readonly number[]): NormalizedLandmark[] {
  return indices.map((index) => hand[index])
}

/** Main hand axis (0-180 deg) from the wrist toward the middle finger landmarks. */
export function handOrientationAngle(hand: Hand): number | null {
  const wrist = hand[LANDMARKS.WRIST]
  const axisPoints = [LANDMARKS.MIDDLE_MCP, LANDMARKS.MIDDLE_PIP, LANDMARKS.MIDDLE_DIP, LANDMARKS.MIDDLE_TIP]
  let dx = 0
  let dy = 0
  for (const point of axisPoints) {
    dx += hand[point].x - wrist.x
    dy += hand[point].y - wrist.y
  }
  if (dx === 0 && dy === 0) return null
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI
  return ((degrees % 180) + 180) % 180
}

export function classifyOrientation(angleDeg: number | null): HandOrientationLabel | null {
  if (angleDeg === null) return null
  if (angleDeg >= 60 && angleDeg <= 120) return 'vertical'
  if (angleDeg <= 30 || angleDeg >= 150) return 'horizontal'
  return null
}

/** Center of the index+middle fingertip region used for hand-to-hand proximity. */
export function fingerRegion(hand: Hand): { x: number; y: number } | null {
  const indexTip = hand[LANDMARKS.INDEX_TIP]
  const middleTip = hand[LANDMARKS.MIDDLE_TIP]
  return { x: (indexTip.x + middleTip.x) / 2, y: (indexTip.y + middleTip.y) / 2 }
}

/** Calibration length (wrist to middle fingertip), used to normalize distances. */
export function handSize(hand: Hand): number {
  return distance(hand[LANDMARKS.WRIST], hand[LANDMARKS.MIDDLE_TIP])
}