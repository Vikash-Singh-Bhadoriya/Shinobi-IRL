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
  smoothingFrames: number
  readyConfidence: number
  resetConfidence: number
  missingHandGraceMs: number
}

export const DEFAULT_SHADOW_CLONE_CONFIG: ShadowCloneConfig = {
  stabilityMs: 500,
  intersectionMaxRatio: 1.0,
  smoothingFrames: 8,
  readyConfidence: 0.8,
  resetConfidence: 0.6,
  missingHandGraceMs: 150,
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
  const fingerScore = mandatoryFingerScore * 0.35 + softFingerScore * 0.65
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
  let missingHandSince: number | null = null
  let lastTwoHandAnalysis: ShadowCloneAnalysis | null = null
  let confidenceHistory: number[] = []

  const reset = () => {
    poseStartAt = null
    missingHandSince = null
    lastTwoHandAnalysis = null
    confidenceHistory = []
  }

  const smoothConfidence = (confidence: number): number => {
    confidenceHistory = [...confidenceHistory, confidence].slice(-cfg.smoothingFrames)
    return confidenceHistory.reduce((total, value) => total + value, 0) / confidenceHistory.length
  }

  return {
    analyze(frame: HandFrame, now: number): ShadowCloneResult {
      if (frame.length === 0) {
        reset()
        const analysis = analyzeShadowClonePose(frame, cfg.intersectionMaxRatio)
        return { detected: false, confidence: 0, stabilityElapsedMs: 0, analysis }
      }

      const currentAnalysis = analyzeShadowClonePose(frame, cfg.intersectionMaxRatio)
      let analysis = currentAnalysis
      const hasTwoHands = currentAnalysis.twoHands
      let graceExpired = false

      if (hasTwoHands) {
        lastTwoHandAnalysis = currentAnalysis
        missingHandSince = null
      } else if (lastTwoHandAnalysis) {
        if (missingHandSince === null) missingHandSince = now
        if (now - missingHandSince <= cfg.missingHandGraceMs) {
          analysis = lastTwoHandAnalysis
        } else {
          lastTwoHandAnalysis = null
          graceExpired = true
        }
      }

      const mandatoryFingerScore =
        (Number(analysis.indexExtended) + Number(analysis.middleExtended)) / 2
      const softFingerScore =
        (Number(analysis.ringCurled) + Number(analysis.pinkyCurled)) / 2
      const poseConfidence =
        Number(analysis.twoHands) * 0.05 +
        mandatoryFingerScore * 0.25 +
        softFingerScore * 0.5 +
        analysis.orientationScore * 0.08 +
        Number(analysis.intersectionOk) * 0.07 +
        0.05
      const confidence = graceExpired
        ? (confidenceHistory = [0.05], 0.05)
        : smoothConfidence(Math.min(1, poseConfidence))
      const confidenceReady = confidence >= cfg.readyConfidence

      if (confidenceReady) {
        if (poseStartAt === null) poseStartAt = now
      } else if (confidence < cfg.resetConfidence) {
        poseStartAt = null
      }

      const stabilityElapsedMs =
        poseStartAt !== null ? Math.max(0, now - poseStartAt) : 0
      const detected =
        confidenceReady && stabilityElapsedMs >= cfg.stabilityMs

      return { detected, confidence, stabilityElapsedMs, analysis }
    },
  }
}