import { FINGER_CHAINS, isFingerExtended } from '../../gestures/fingerState'
import { LANDMARKS, distance } from '../../gestures/handGeometry'
import type { Hand } from '../../types/hand'
import type {
  MagicCircleDetection,
  MagicCircleDetector,
  MagicCirclePosition,
} from './magicCircleTypes'

const FADE_OUT_MS = 450
const MIN_CONFIDENCE = 0.72

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function palmCenter(hand: Hand): MagicCirclePosition {
  const points = [
    hand[LANDMARKS.WRIST],
    hand[LANDMARKS.INDEX_MCP],
    hand[LANDMARKS.MIDDLE_MCP],
    hand[LANDMARKS.RING_MCP],
    hand[LANDMARKS.PINKY_MCP],
  ]
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  }
}

function palmSize(hand: Hand): number {
  return (
    distance(hand[LANDMARKS.WRIST], hand[LANDMARKS.MIDDLE_MCP]) +
    distance(hand[LANDMARKS.INDEX_MCP], hand[LANDMARKS.PINKY_MCP]) +
    distance(hand[LANDMARKS.WRIST], hand[LANDMARKS.MIDDLE_TIP])
  ) / 3
}

function palmRotation(hand: Hand): number {
  const wrist = hand[LANDMARKS.WRIST]
  const middleMcp = hand[LANDMARKS.MIDDLE_MCP]
  return Math.atan2(middleMcp.y - wrist.y, middleMcp.x - wrist.x)
}

function thumbIsExtended(hand: Hand, size: number): boolean {
  const thumbTip = hand[4]
  const thumbMcp = hand[2]
  const wrist = hand[LANDMARKS.WRIST]
  return (
    distance(thumbTip, hand[LANDMARKS.INDEX_MCP]) > size * 0.42 &&
    distance(wrist, thumbTip) > distance(wrist, thumbMcp) * 1.08
  )
}

function analyzeOpenPalm(hand: Hand): { open: boolean; confidence: number } {
  const size = palmSize(hand)
  if (size <= 0) return { open: false, confidence: 0 }

  const extended = [
    FINGER_CHAINS.index,
    FINGER_CHAINS.middle,
    FINGER_CHAINS.ring,
    FINGER_CHAINS.pinky,
  ].filter((chain) => isFingerExtended(hand, chain)).length
  const thumb = thumbIsExtended(hand, size) ? 1 : 0
  const confidence = (extended + thumb) / 5
  return { open: confidence >= MIN_CONFIDENCE, confidence }
}

function emptyDetection(state: MagicCircleDetection['state'] = 'SEARCHING'): MagicCircleDetection {
  return {
    state,
    active: false,
    palmDetected: false,
    openPalm: false,
    openPalmConfidence: 0,
    palmPosition: null,
    rotation: 0,
    palmSize: 0,
    fadeProgress: 0,
  }
}

export function createMagicCircleDetector(): MagicCircleDetector {
  let lastDetection = emptyDetection()
  let fadeStartedAt: number | null = null

  const reset = () => {
    lastDetection = emptyDetection()
    fadeStartedAt = null
  }

  return {
    reset,
    analyze(frame, now) {
      const hand = frame.find((candidate) => candidate.landmarks.length >= 21)
      if (!hand) {
        if (lastDetection.active && fadeStartedAt === null) fadeStartedAt = now
        if (fadeStartedAt === null) {
          lastDetection = emptyDetection()
          return lastDetection
        }
        const fadeProgress = clamp01((now - fadeStartedAt) / FADE_OUT_MS)
        if (fadeProgress >= 1) {
          lastDetection = emptyDetection()
          fadeStartedAt = null
          return lastDetection
        }
        lastDetection = { ...lastDetection, state: 'FADE_OUT', active: false, palmDetected: false, fadeProgress }
        return lastDetection
      }

      const handAnalysis = analyzeOpenPalm(hand.landmarks)
      const position = palmCenter(hand.landmarks)
      const size = palmSize(hand.landmarks)
      if (handAnalysis.open) {
        fadeStartedAt = null
        lastDetection = {
          state: 'ACTIVE',
          active: true,
          palmDetected: true,
          openPalm: true,
          openPalmConfidence: handAnalysis.confidence,
          palmPosition: position,
          rotation: palmRotation(hand.landmarks),
          palmSize: size,
          fadeProgress: 0,
        }
        return lastDetection
      }

      if (lastDetection.active && fadeStartedAt === null) fadeStartedAt = now
      if (fadeStartedAt === null) {
        lastDetection = {
          ...emptyDetection(),
          palmDetected: true,
          openPalmConfidence: handAnalysis.confidence,
        }
        return lastDetection
      }

      const fadeProgress = clamp01((now - fadeStartedAt) / FADE_OUT_MS)
      if (fadeProgress >= 1) {
        lastDetection = emptyDetection()
        fadeStartedAt = null
        return lastDetection
      }
      lastDetection = {
        ...lastDetection,
        state: 'FADE_OUT',
        active: false,
        palmDetected: true,
        openPalm: false,
        openPalmConfidence: handAnalysis.confidence,
        fadeProgress,
      }
      return lastDetection
    },
  }
}
