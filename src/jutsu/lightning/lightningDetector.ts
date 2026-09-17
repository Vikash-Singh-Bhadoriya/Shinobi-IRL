import type { Hand, HandFrame } from '../../types/hand'
import { isFingerCurled } from '../../gestures/fingerState'
import { FINGER_CHAINS } from '../../gestures/fingerState'
import { LANDMARKS, distance } from '../../gestures/handGeometry'
import type { LightningDetection, LightningDetector, LightningHand, LightningState } from './lightningTypes'

const CHARGE_MS = 300
const CHARGE_FIST_GRACE_MS = 150
const LOST_HAND_GRACE_MS = 600
const FADE_OUT_MS = 350
const MAX_FIST_CONFIDENCE_DISTANCE = 0.5

function palmCenter(hand: Hand): { x: number; y: number } {
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
    (distance(hand[LANDMARKS.WRIST], hand[LANDMARKS.MIDDLE_MCP]) +
      distance(hand[LANDMARKS.INDEX_MCP], hand[LANDMARKS.PINKY_MCP]) +
      distance(hand[LANDMARKS.WRIST], hand[LANDMARKS.MIDDLE_TIP])) /
    3
  )
}

function thumbIsCurled(hand: Hand): boolean {
  const thumbTip = hand[LANDMARKS.THUMB_TIP]
  const thumbIp = hand[3]
  const thumbMcp = hand[2]
  const indexMcp = hand[LANDMARKS.INDEX_MCP]
  const wrist = hand[LANDMARKS.WRIST]
  const size = palmSize(hand)
  if (size <= 0) return false
  const tipToIndexMcp = distance(thumbTip, indexMcp) / size
  const tipToWrist = distance(thumbTip, wrist)
  const mcpToWrist = distance(thumbMcp, wrist)
  const ipToMcp = distance(thumbIp, thumbMcp)
  const tipToMcp = distance(thumbTip, thumbMcp)
  const thumbChainStraightness = tipToMcp > 0 ? ipToMcp / tipToMcp : 0
  return tipToIndexMcp < 0.35 || tipToWrist < mcpToWrist * 1.0 || thumbChainStraightness < 0.6
}

function detectFist(hand: Hand): { detected: boolean; confidence: number } {
  const size = palmSize(hand)
  if (size <= 0) return { detected: false, confidence: 0 }

  const curledCount = [
    FINGER_CHAINS.index,
    FINGER_CHAINS.middle,
    FINGER_CHAINS.ring,
    FINGER_CHAINS.pinky,
  ].filter((chain) => isFingerCurled(hand, chain)).length

  if (curledCount < 4) return { detected: false, confidence: curledCount / 4 * 0.5 }

  const center = palmCenter(hand)
  const tips = [LANDMARKS.INDEX_TIP, LANDMARKS.MIDDLE_TIP, LANDMARKS.RING_TIP, LANDMARKS.PINKY_TIP]
  const avgTipDistance = tips.reduce((sum, tipIndex) => sum + distance(center, hand[tipIndex]), 0) / tips.length
  const normalizedTipDistance = avgTipDistance / size

  if (normalizedTipDistance > MAX_FIST_CONFIDENCE_DISTANCE) {
    return { detected: false, confidence: 0.3 }
  }

  const thumbCurled = thumbIsCurled(hand) ? 1 : 0
  const fingerConfidence = curledCount / 4
  const tipConfidence = Math.max(0, 1 - normalizedTipDistance / MAX_FIST_CONFIDENCE_DISTANCE)
  const confidence = fingerConfidence * 0.6 + tipConfidence * 0.25 + (thumbCurled * 0.15)

  return { detected: curledCount >= 4, confidence }
}

function emptyResult(state: LightningState = 'SEARCHING'): LightningDetection {
  return {
    active: false,
    confidence: 0,
    fistDetected: false,
    fistConfidence: 0,
    palmPosition: null,
    palmSize: 0,
    state,
    fadeProgress: 0,
    lostForMs: 0,
    handScale: 0,
    handVisible: false,
    landmarks: null,
  }
}

export function createLightningDetector(targetHand: LightningHand = 'right'): LightningDetector {
  let activated = false
  let chargeStartedAt: number | null = null
  let fistLostSince: number | null = null
  let missingSince: number | null = null
  let lastPosition: { x: number; y: number } | null = null
  let lastPalmSize = 0
  let lastLandmarks: Hand | null = null
  let fadeStartedAt: number | null = null
  let lastResult = emptyResult()

  const reset = () => {
    activated = false
    chargeStartedAt = null
    fistLostSince = null
    missingSince = null
    lastPosition = null
    lastPalmSize = 0
    lastLandmarks = null
    fadeStartedAt = null
    lastResult = emptyResult()
  }

  return {
    reset,
    analyze(frame: HandFrame, now: number): LightningDetection {
      const tracked = frame.find((candidate) =>
        candidate.landmarks.length >= 21 && candidate.handedness.toLowerCase() === targetHand,
      )

      if (!tracked) {
        if (missingSince === null) missingSince = now
        const lostForMs = now - missingSince

        if (!activated && chargeStartedAt === null) {
          lastResult = emptyResult('SEARCHING')
          lastResult.lostForMs = lostForMs
          return lastResult
        }

        const state: LightningState = lostForMs <= LOST_HAND_GRACE_MS ? 'LOST_HAND_GRACE' : 'FADE_OUT'
        const fadeProgress = state === 'FADE_OUT'
          ? Math.min(1, (lostForMs - LOST_HAND_GRACE_MS) / FADE_OUT_MS)
          : 0

        if (!activated) {
          chargeStartedAt = null
          fistLostSince = null
        }

        lastResult = {
          active: false,
          confidence: activated
            ? Math.max(0, 1 - lostForMs / (LOST_HAND_GRACE_MS + FADE_OUT_MS))
            : 0,
          fistDetected: false,
          fistConfidence: 0,
          palmPosition: lastPosition,
          palmSize: lastPalmSize,
          state,
          fadeProgress,
          lostForMs,
          handScale: lastPalmSize,
          handVisible: false,
          landmarks: lastLandmarks,
        }

        if (lostForMs > LOST_HAND_GRACE_MS + FADE_OUT_MS) reset()

        return lastResult
      }

      const landmarks = tracked.landmarks
      missingSince = null

      const fist = detectFist(landmarks)
      const position = palmCenter(landmarks)
      const size = palmSize(landmarks)
      lastPosition = position
      lastPalmSize = size
      lastLandmarks = landmarks

      if (!fist.detected) {
        if (activated) {
          const state: LightningState = 'FADE_OUT'
          if (fadeStartedAt === null) fadeStartedAt = now
          const fadeProgress = Math.min(1, (now - fadeStartedAt) / FADE_OUT_MS)
          lastResult = {
            active: false,
            confidence: Math.max(0, 1 - fadeProgress),
            fistDetected: false,
            fistConfidence: fist.confidence,
            palmPosition: position,
            palmSize: size,
            state,
            fadeProgress,
            lostForMs: 0,
            handScale: size,
            handVisible: true,
            landmarks,
          }
          if (fadeProgress >= 1) reset()
          return lastResult
        }

        if (chargeStartedAt !== null && fistLostSince === null) fistLostSince = now
        if (chargeStartedAt !== null && fistLostSince !== null && now - fistLostSince >= CHARGE_FIST_GRACE_MS) {
          chargeStartedAt = null
          fistLostSince = null
        }
        lastResult = {
          active: false,
          confidence: 0,
          fistDetected: false,
          fistConfidence: fist.confidence,
          palmPosition: position,
          palmSize: size,
          state: 'SEARCHING',
          fadeProgress: 0,
          lostForMs: 0,
          handScale: size,
          handVisible: true,
          landmarks,
        }
        return lastResult
      }

      if (chargeStartedAt === null) chargeStartedAt = now
      fistLostSince = null
      fadeStartedAt = null

      if (now - chargeStartedAt >= CHARGE_MS) {
        activated = true
      }

      const state: LightningState = activated ? 'ACTIVE_HOLD' : 'CHARGING'
      const chargeProgress = !activated ? Math.min(1, (now - chargeStartedAt) / CHARGE_MS) : 1

      lastResult = {
        active: activated,
        confidence: activated ? 1 : chargeProgress * fist.confidence,
        fistDetected: true,
        fistConfidence: fist.confidence,
        palmPosition: position,
        palmSize: size,
        state,
        fadeProgress: 0,
        lostForMs: 0,
        handScale: size,
        handVisible: true,
        landmarks,
      }
      return lastResult
    },
  }
}
