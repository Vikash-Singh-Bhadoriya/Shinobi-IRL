import type { Hand, HandFrame } from '../types/hand'
import { analyzeSignFingers } from './fingerState'
import {
  classifyOrientation,
  distance,
  fingerRegion,
  handOrientationAngle,
  handSize,
} from './handGeometry'
import type { HandAnalysis, ShadowCloneAnalysis, ShadowCloneResult } from './types'

export interface ShadowCloneConfig {
  stabilityMs: number
  intersectionMaxRatio: number
}

export const DEFAULT_SHADOW_CLONE_CONFIG: ShadowCloneConfig = {
  stabilityMs: 500,
  intersectionMaxRatio: 1.0,
}

function analyzeHand(hand: Hand, label: string): HandAnalysis {
  const fingers = analyzeSignFingers(hand)
  const angleDeg = handOrientationAngle(hand)
  return {
    label,
    fingers,
    orientation: { angleDeg: angleDeg ?? 0, label: classifyOrientation(angleDeg) },
    region: fingerRegion(hand),
    size: handSize(hand),
  }
}

export function analyzeShadowClonePose(frame: HandFrame, maxIntersectionRatio: number): ShadowCloneAnalysis {
  const first = frame[0] ? analyzeHand(frame[0].landmarks, frame[0].handedness) : null
  const second = frame[1] ? analyzeHand(frame[1].landmarks, frame[1].handedness) : null
  const hands: Array<HandAnalysis | null> = [first, second]

  if (!first || !second) {
    return {
      twoHands: false,
      indexExtended: false,
      middleExtended: false,
      ringCurled: false,
      pinkyCurled: false,
      orientationsMatch: false,
      intersectionOk: false,
      fingerScore: 0,
      orientationScore: 0,
      intersectionRatio: null,
      hands,
    }
  }

  const indexExtended = first.fingers.index && second.fingers.index
  const middleExtended = first.fingers.middle && second.fingers.middle
  const ringCurled = first.fingers.ring && second.fingers.ring
  const pinkyCurled = first.fingers.pinky && second.fingers.pinky
  const mandatoryFingerScore = (Number(indexExtended) + Number(middleExtended)) / 2
  const softFingerScore = (Number(ringCurled) + Number(pinkyCurled)) / 2
  const fingerScore = mandatoryFingerScore * 0.7 + softFingerScore * 0.3
  const orientations = [first.orientation.label, second.orientation.label]
  const orientationsMatch = orientations.includes('vertical') && orientations.includes('horizontal')
  const orientationScore = orientationsMatch ? 1 : orientations.some(Boolean) ? 0.5 : 0

  const gap =
    first.region && second.region ? distance(first.region, second.region) : null
  const avgSize = (first.size + second.size) / 2
  const intersectionRatio = gap !== null && avgSize > 0 ? gap / avgSize : null
  const intersectionOk =
    intersectionRatio !== null && intersectionRatio <= maxIntersectionRatio

  return {
    twoHands: true,
    indexExtended,
    middleExtended,
    ringCurled,
    pinkyCurled,
    orientationsMatch,
    intersectionOk,
    fingerScore,
    orientationScore,
    intersectionRatio,
    hands,
  }
}

export function createShadowCloneDetector(config?: Partial<ShadowCloneConfig>) {
  const cfg = { ...DEFAULT_SHADOW_CLONE_CONFIG, ...config }
  let poseStartAt: number | null = null

  return {
    analyze(frame: HandFrame, now: number): ShadowCloneResult {
      const analysis = analyzeShadowClonePose(frame, cfg.intersectionMaxRatio)
      const isPose =
        analysis.twoHands &&
        analysis.indexExtended &&
        analysis.middleExtended &&
        (analysis.ringCurled || analysis.pinkyCurled) &&
        analysis.orientationsMatch &&
        analysis.intersectionOk

      if (isPose) {
        if (poseStartAt === null) poseStartAt = now
      } else {
        poseStartAt = null
      }

      const stabilityElapsedMs =
        isPose && poseStartAt !== null ? Math.max(0, now - poseStartAt) : 0
      const stabilityScore = isPose ? Math.min(1, stabilityElapsedMs / cfg.stabilityMs) : 0
      const detected = isPose && stabilityElapsedMs >= cfg.stabilityMs

      const mandatoryFingerScore =
        (Number(analysis.indexExtended) + Number(analysis.middleExtended)) / 2
      const softFingerScore =
        (Number(analysis.ringCurled) + Number(analysis.pinkyCurled)) / 2
      const confidence =
        (Number(analysis.twoHands) * 0.15 +
          mandatoryFingerScore * 0.35 +
          softFingerScore * 0.2 +
          analysis.orientationScore * 0.15 +
          Number(analysis.intersectionOk) * 0.1 +
          stabilityScore * 0.05)

      return { detected, confidence, stabilityElapsedMs, analysis }
    },
  }
}