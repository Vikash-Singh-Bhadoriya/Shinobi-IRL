import { distance, pointsOf } from './handGeometry'
import type { Hand } from '../types/hand'
import type { FingerSignOk } from './types'

export const EXTENDED_MIN_RATIO = 0.85
export const CURLED_MAX_RATIO = 0.7

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

export function isFingerExtended(hand: Hand, chain: FingerChain): boolean {
  return straightnessRatio(hand, chain) >= EXTENDED_MIN_RATIO
}

export function isFingerCurled(hand: Hand, chain: FingerChain): boolean {
  return straightnessRatio(hand, chain) <= CURLED_MAX_RATIO
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