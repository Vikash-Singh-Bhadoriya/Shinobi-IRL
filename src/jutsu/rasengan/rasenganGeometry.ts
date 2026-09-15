import type { Hand } from '../../types/hand'
import { LANDMARKS, distance } from '../../gestures/handGeometry'
import type { PalmPosition } from './rasenganTypes'

type Point = { x: number; y: number; z?: number }

const FINGER_CHAINS = [
  [LANDMARKS.INDEX_MCP, LANDMARKS.INDEX_PIP, LANDMARKS.INDEX_DIP, LANDMARKS.INDEX_TIP],
  [LANDMARKS.MIDDLE_MCP, LANDMARKS.MIDDLE_PIP, LANDMARKS.MIDDLE_DIP, LANDMARKS.MIDDLE_TIP],
  [LANDMARKS.RING_MCP, LANDMARKS.RING_PIP, LANDMARKS.RING_DIP, LANDMARKS.RING_TIP],
  [LANDMARKS.PINKY_MCP, LANDMARKS.PINKY_PIP, LANDMARKS.PINKY_DIP, LANDMARKS.PINKY_TIP],
] as const

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) }
}

function isFingerExtended(hand: Hand, chain: readonly number[]): boolean {
  const wrist = hand[LANDMARKS.WRIST]
  const mcp = hand[chain[0]]
  const pip = hand[chain[1]]
  const dip = hand[chain[2]]
  const tip = hand[chain[3]]
  const axis = subtract(mcp, wrist)
  const pipVector = subtract(pip, mcp)
  const dipVector = subtract(dip, pip)
  const tipVector = subtract(tip, dip)
  const fingerLength = distance(mcp, pip) + distance(pip, dip) + distance(dip, tip)
  const wristReach = distance(wrist, tip)
  const handScale = distance(wrist, hand[LANDMARKS.MIDDLE_TIP])
  return (
    fingerLength > handScale * 0.28 &&
    wristReach > distance(wrist, mcp) * 1.25 &&
    dot(axis, pipVector) > 0 &&
    dot(pipVector, dipVector) > 0 &&
    dot(dipVector, tipVector) > 0
  )
}

export function isOpenPalm(hand: Hand): boolean {
  return FINGER_CHAINS.every((chain) => isFingerExtended(hand, chain))
}

export function palmCenter(hand: Hand): PalmPosition {
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

export function palmSize(hand: Hand): number {
  return (
    (distance(hand[LANDMARKS.WRIST], hand[LANDMARKS.MIDDLE_MCP]) +
      distance(hand[LANDMARKS.INDEX_MCP], hand[LANDMARKS.PINKY_MCP]) +
      distance(hand[LANDMARKS.WRIST], hand[LANDMARKS.MIDDLE_TIP])) /
    3
  )
}

export function palmRotation(hand: Hand): number {
  const left = hand[LANDMARKS.INDEX_MCP]
  const right = hand[LANDMARKS.PINKY_MCP]
  return Math.atan2(right.y - left.y, right.x - left.x)
}
