import { distance, pointsOf } from './handGeometry'
import type { Hand } from '../types/hand'
import type { FingerSignOk } from './types'

export const EXTENDED_MIN_RATIO = 0.78
export const CURLED_MAX_RATIO = 0.78
const EXTENDED_MIN_ANGLE = 145
const CURLED_MAX_ANGLE = 125
const TIP_DISTANCE_MIN_RATIO = 1.35
const TIP_DISTANCE_MAX_RATIO = 1.15

export interface FingerChain {
  mcp: number
  pip: number
  dip: number
  tip: number
}

export const FINGER_CHAINS: Record<'index' | 'middle' | 'ring' | 'pinky', FingerChain> = {
  index: { mcp: 5, pip: 6, dip: 7, tip: 8 },
  middle: { mcp: 9, pip: 10, dip: 11, tip: 12 },
  ring: { mcp: 13, pip: 14, dip: 15, tip: 16 },
  pinky: { mcp: 17, pip: 18, dip: 19, tip: 20 },
}

/**
 * Straightness of a finger: how close the tip-to-MCP span is to the full chain
 * length (MCP->PIP + PIP->DIP + DIP->TIP). A straight finger approaches 1.0, a
 * fully curled finger drops well below. Rotation- and orientation-invariant.
 */
function straightnessRatio(hand: Hand, chain: FingerChain): number {
  const [mcp, pip, dip, tip] = pointsOf(hand, [chain.mcp, chain.pip, chain.dip, chain.tip])
  const chainLength = distance(mcp, pip) + distance(pip, dip) + distance(dip, tip)
  if (chainLength === 0) return 0
  return distance(mcp, tip) / chainLength
}

function jointAngle(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }
  const denominator = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y)
  if (denominator === 0) return 0
  const cosine = Math.max(-1, Math.min(1, (ab.x * cb.x + ab.y * cb.y) / denominator))
  return (Math.acos(cosine) * 180) / Math.PI
}

function normalizedFingerMetrics(hand: Hand, chain: FingerChain) {
  const [mcp, pip, dip, tip] = pointsOf(hand, [chain.mcp, chain.pip, chain.dip, chain.tip])
  const wristSize = distance(hand[0], hand[9])
  const scale = wristSize > 0 ? wristSize : 1
  const angle = (jointAngle(mcp, pip, dip) + jointAngle(pip, dip, tip)) / 2
  const tipDistanceRatio = distance(hand[0], tip) / scale
  return { ratio: straightnessRatio(hand, chain), angle, tipDistanceRatio }
}

export function isFingerExtended(hand: Hand, chain: FingerChain): boolean {
  const metrics = normalizedFingerMetrics(hand, chain)
  return (
    metrics.ratio >= EXTENDED_MIN_RATIO &&
    metrics.angle >= EXTENDED_MIN_ANGLE &&
    metrics.tipDistanceRatio >= TIP_DISTANCE_MIN_RATIO
  )
}

export function isFingerCurled(hand: Hand, chain: FingerChain): boolean {
  const metrics = normalizedFingerMetrics(hand, chain)
  return metrics.ratio <= CURLED_MAX_RATIO || metrics.angle <= CURLED_MAX_ANGLE || metrics.tipDistanceRatio <= TIP_DISTANCE_MAX_RATIO
}

/** Whether this hand satisfies the Shadow Clone finger requirement. */
export function analyzeSignFingers(hand: Hand): FingerSignOk {
  return {
    index: isFingerExtended(hand, FINGER_CHAINS.index),
    middle: isFingerExtended(hand, FINGER_CHAINS.middle),
    ring: isFingerCurled(hand, FINGER_CHAINS.ring),
    pinky: isFingerCurled(hand, FINGER_CHAINS.pinky),
  }
}