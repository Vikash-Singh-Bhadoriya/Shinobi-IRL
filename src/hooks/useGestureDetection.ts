import { useEffect, useMemo, useRef, useState } from 'react'
import type { HandFrameSink } from '../types/hand'
import {
  createShadowCloneDetector,
  DEFAULT_SHADOW_CLONE_CONFIG,
} from '../gestures/shadowCloneDetector'
import type { HandAnalysis, ShadowCloneResult } from '../gestures/types'
import type { GestureResult, HandGestureDebug } from '../types/gesture'

const EMPTY_RESULT: GestureResult = {
  detected: false,
  gesture: 'none',
  confidence: 0,
  checks: {
    twoHands: false,
    indexExtended: false,
    middleExtended: false,
    ringCurled: false,
    pinkyCurled: false,
    orientation: false,
    intersection: false,
    stability: false,
  },
  state: 'SEARCHING_HANDS',
  message: 'Show both hands',
  debug: {
    fingerScore: 0,
    orientationScore: 0,
    intersectionRatio: null,
    stabilityElapsedMs: 0,
    left: null,
    right: null,
  },
}

function mapHand(hand: HandAnalysis | null): HandGestureDebug | null {
  if (!hand) return null
  return {
    fingers: hand.fingers,
    orientation: hand.orientation.label,
    angleDeg: hand.orientation.angleDeg,
  }
}

function toPublicResult(result: ShadowCloneResult): GestureResult {
  const { analysis } = result
  const present = analysis.hands.filter((hand): hand is HandAnalysis => hand !== null)
  const leftHand = present.find((hand) => hand.label.toLowerCase() === 'left')
  const rightHand = present.find((hand) => hand.label.toLowerCase() === 'right')
  const left = mapHand(leftHand ?? present[0] ?? null)
  const right = mapHand(rightHand ?? (present[1] !== leftHand ? present[1] : null) ?? present[1] ?? null)
  const stability = result.stabilityElapsedMs >= DEFAULT_SHADOW_CLONE_CONFIG.stabilityMs

  return {
    detected: result.detected,
    gesture: result.detected ? 'shadow-clone' : 'none',
    confidence: result.confidence,
    checks: {
      twoHands: analysis.twoHands,
      indexExtended: analysis.indexExtended,
      middleExtended: analysis.middleExtended,
      ringCurled: analysis.ringCurled,
      pinkyCurled: analysis.pinkyCurled,
      orientation: analysis.orientationsMatch,
      intersection: analysis.intersectionOk,
      stability,
    },
    state: result.detected
      ? 'SHADOW_CLONE_READY'
      : !analysis.twoHands
        ? 'SEARCHING_HANDS'
        : 'WAITING_FOR_SHADOW_CLONE_POSE',
    message: result.detected
      ? 'Shadow Clone Ready'
      : !analysis.twoHands
        ? analysis.hands.some(Boolean)
          ? 'Need two hands'
          : 'Show both hands'
        : 'Form Shadow Clone sign',
    debug: {
      fingerScore: analysis.fingerScore,
      orientationScore: analysis.orientationScore,
      intersectionRatio: analysis.intersectionRatio,
      stabilityElapsedMs: result.stabilityElapsedMs,
      left,
      right,
    },
  }
}

/**
 * Runs Shadow Clone analysis on the latest tracked frame. All analysis happens
 * inside the tracking sink (no per-frame React renders): this hook only calls
 * setState when the serialized result actually changes.
 */
export function useGestureDetection(registerSink: (sink: HandFrameSink) => () => void): GestureResult {
  const detector = useMemo(() => createShadowCloneDetector(), [])
  const [result, setResult] = useState<GestureResult>(EMPTY_RESULT)
  const lastKeyRef = useRef('')

  useEffect(() => {
    const unsubscribe = registerSink((frame) => {
      const next = toPublicResult(detector.analyze(frame, performance.now()))
      const key = JSON.stringify({
        d: next.detected,
        g: next.gesture,
        c: Math.round(next.confidence * 100),
        checks: next.checks,
        fs: next.debug.fingerScore,
        os: next.debug.orientationScore,
        ir:
          next.debug.intersectionRatio !== null
            ? Math.round(next.debug.intersectionRatio * 100)
            : null,
      })
      if (key !== lastKeyRef.current) {
        lastKeyRef.current = key
        setResult(next)
      }
    })
    return unsubscribe
  }, [detector, registerSink])

  return result
}