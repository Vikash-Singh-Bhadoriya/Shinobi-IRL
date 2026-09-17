/**
 * useJutsuAudio
 *
 * Integration layer between existing jutsu state and the existing procedural
 * audio engine (jutsuAudio.ts). This hook ONLY connects state to audio
 * functions. It does not create AudioContexts, modify VFX, or modify jutsu
 * state.
 *
 * Accepts the already-computed jutsu results from useRasengan, useLightning,
 * useMagicCircle, and useGestureDetection — the same values that App.tsx
 * currently holds — and wires audio edge-detection on top of them.
 *
 * App.tsx wiring required (not implemented here):
 *   import { useJutsuAudio } from './audio/useJutsuAudio'
 *   useJutsuAudio({
 *     rasenganResult: rasengan.result,
 *     lightningResult: lightning.result,
 *     magicCircleResult: magicCircle.result,
 *     shadowCloneState: gesture.state,
 *   })
 */

import { useEffect, useRef } from 'react'
import type { RasenganInstance } from '../jutsu/rasengan/rasenganTypes'
import type { LightningInstance } from '../jutsu/lightning/lightningTypes'
import type { MagicCircleDetection } from '../jutsu/magicCircle/magicCircleTypes'
import type { ShadowCloneState } from '../types/gesture'
import {
  playRasenganActivation,
  playRasenganLoopStart,
  playRasenganLoopStop,
  playLightningStrike,
  playLightningLoopStart,
  playLightningLoopStop,
  playMagicCircleActivation,
  playMagicCircleLoopStart,
  playMagicCircleLoopStop,
  playShadowCloneSpawn,
} from './jutsuAudio'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UseJutsuAudioParams {
  /** Per-hand Rasengan detections as returned by useRasengan().result */
  rasenganResult: RasenganInstance[]
  /** Per-hand Lightning detections as returned by useLightning().result */
  lightningResult: LightningInstance[]
  /** Magic Circle detection as returned by useMagicCircle().result */
  magicCircleResult: MagicCircleDetection
  /**
   * Shadow Clone gesture state as returned by useGestureDetection().state.
   * The audio hook listens for the false->true edge of 'SHADOW_CLONE_READY'.
   */
  shadowCloneState: ShadowCloneState
}

/**
 * useJutsuAudio - audio integration hook.
 *
 * Call once at the App level (or wherever the jutsu results are available).
 * Pass in the result objects directly; the hook tracks edges internally using
 * refs so it never triggers React re-renders for audio purposes.
 *
 * Cleanup on unmount: stops all active Rasengan, Lightning, and Magic Circle
 * loops. Does not modify any VFX or jutsu state.
 */
export function useJutsuAudio({
  rasenganResult,
  lightningResult,
  magicCircleResult,
  shadowCloneState,
}: UseJutsuAudioParams): void {
  // Previous-frame booleans stored in refs - no React state, no re-renders.
  const prevRasenganActiveRef = useRef(false)
  const prevLightningActiveRef = useRef(false)
  const prevMagicCircleActiveRef = useRef(false)
  const prevShadowCloneReadyRef = useRef(false)

  // -------------------------------------------------------------------------
  // Rasengan - aggregate both hands into a single logical active flag.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const rasenganActive = rasenganResult.some(
      (instance) => instance.detection.active,
    )
    const prev = prevRasenganActiveRef.current

    if (!prev && rasenganActive) {
      // false -> true: start audio
      playRasenganActivation()
      playRasenganLoopStart()
    } else if (prev && !rasenganActive) {
      // true -> false: stop loop
      playRasenganLoopStop()
    }
    // true -> true: do nothing (loop already running)

    prevRasenganActiveRef.current = rasenganActive
  }, [rasenganResult])

  // -------------------------------------------------------------------------
  // Lightning - aggregate both hands into a single logical active flag.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const lightningActive = lightningResult.some(
      (instance) => instance.detection.active,
    )
    const prev = prevLightningActiveRef.current

    if (!prev && lightningActive) {
      // false -> true: start audio
      playLightningStrike()
      playLightningLoopStart()
    } else if (prev && !lightningActive) {
      // true -> false: stop loop
      playLightningLoopStop()
    }
    // true -> true: do nothing

    prevLightningActiveRef.current = lightningActive
  }, [lightningResult])

  // -------------------------------------------------------------------------
  // Magic Circle - single active flag.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const magicCircleActive = magicCircleResult.active
    const prev = prevMagicCircleActiveRef.current

    if (!prev && magicCircleActive) {
      // false -> true: activation sound + loop start
      playMagicCircleActivation()
      playMagicCircleLoopStart()
    } else if (prev && !magicCircleActive) {
      // true -> false: stop loop
      playMagicCircleLoopStop()
    }
    // true -> true: do nothing

    prevMagicCircleActiveRef.current = magicCircleActive
  }, [magicCircleResult])

  // -------------------------------------------------------------------------
  // Shadow Clone - detect the SEARCHING/WAITING -> SHADOW_CLONE_READY edge.
  // Play the spawn sound exactly once per transition into SHADOW_CLONE_READY.
  // No persistent loop for Shadow Clone.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const ready = shadowCloneState === 'SHADOW_CLONE_READY'
    const prev = prevShadowCloneReadyRef.current

    if (!prev && ready) {
      // false -> true: one-shot spawn sound
      playShadowCloneSpawn()
    }
    // true -> true: do nothing (already played)
    // true -> false: no action needed (no loop to stop)

    prevShadowCloneReadyRef.current = ready
  }, [shadowCloneState])

  // -------------------------------------------------------------------------
  // Cleanup on unmount - stop all active loops.
  // Does NOT modify VFX or jutsu state.
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      playRasenganLoopStop()
      playLightningLoopStop()
      playMagicCircleLoopStop()
    }
  }, [])
}
