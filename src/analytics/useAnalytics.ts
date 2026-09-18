/**
 * useAnalytics.ts
 *
 * Observes existing jutsu/camera state from App.tsx and fires analytics events
 * at the appropriate state transitions.  No detection logic lives here — this
 * hook is a pure observer of the existing system.
 *
 * Jutsu edge-triggering:
 *   Each jutsu has a "previously active" ref.  An event fires only on the
 *   false → true transition.  Sustained "active" does NOT re-fire.
 */

import { useEffect, useRef } from 'react'
import type { RasenganInstance } from '../jutsu/rasengan/rasenganTypes'
import type { LightningInstance } from '../jutsu/lightning/lightningTypes'
import type { MagicCircleDetection } from '../jutsu/magicCircle/magicCircleTypes'
import type { ShadowCloneState } from '../types/gesture'
import {
  trackCameraStarted,
  trackJutsuActivated,
  trackSessionEnded,
  trackSessionStarted,
} from './analytics'

export interface UseAnalyticsOptions {
  cameraReady: boolean
  rasenganResult: RasenganInstance[]
  lightningResult: LightningInstance[]
  magicCircleResult: MagicCircleDetection
  shadowCloneState: ShadowCloneState
}

export function useAnalytics({
  cameraReady,
  rasenganResult,
  lightningResult,
  magicCircleResult,
  shadowCloneState,
}: UseAnalyticsOptions): void {
  // -------------------------------------------------------------------------
  // session_started — fires once on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    trackSessionStarted()
  }, [])

  // -------------------------------------------------------------------------
  // session_ended — fires on page hide / visibility change
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleHide = () => trackSessionEnded()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handleHide()
    }

    // pagehide is the most reliable unload event (fires on mobile, bfcache, etc.)
    window.addEventListener('pagehide', handleHide)
    // visibilitychange catches tab switches and app backgrounding
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', handleHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // -------------------------------------------------------------------------
  // camera_started — fires once when the camera transitions to ready
  // -------------------------------------------------------------------------
  const cameraTrackedRef = useRef(false)
  useEffect(() => {
    if (cameraReady && !cameraTrackedRef.current) {
      cameraTrackedRef.current = true
      trackCameraStarted()
    }
  }, [cameraReady])

  // -------------------------------------------------------------------------
  // jutsu_activated — rasengan (either hand active = activation)
  // Edge: false → true only.
  // -------------------------------------------------------------------------
  const rasenganActiveRef = useRef(false)
  useEffect(() => {
    const isActive = rasenganResult.some((inst) => inst.detection.active)
    if (isActive && !rasenganActiveRef.current) {
      trackJutsuActivated('rasengan')
    }
    rasenganActiveRef.current = isActive
  }, [rasenganResult])

  // -------------------------------------------------------------------------
  // jutsu_activated — lightning (either hand active = activation)
  // -------------------------------------------------------------------------
  const lightningActiveRef = useRef(false)
  useEffect(() => {
    const isActive = lightningResult.some((inst) => inst.detection.active)
    if (isActive && !lightningActiveRef.current) {
      trackJutsuActivated('lightning')
    }
    lightningActiveRef.current = isActive
  }, [lightningResult])

  // -------------------------------------------------------------------------
  // jutsu_activated — magic circle
  // -------------------------------------------------------------------------
  const magicCircleActiveRef = useRef(false)
  useEffect(() => {
    const isActive = magicCircleResult.active
    if (isActive && !magicCircleActiveRef.current) {
      trackJutsuActivated('magicCircle')
    }
    magicCircleActiveRef.current = isActive
  }, [magicCircleResult])

  // -------------------------------------------------------------------------
  // jutsu_activated — shadow clone
  // ShadowCloneState 'SHADOW_CLONE_READY' means the gesture is confirmed.
  // -------------------------------------------------------------------------
  const shadowCloneActiveRef = useRef(false)
  useEffect(() => {
    const isActive = shadowCloneState === 'SHADOW_CLONE_READY'
    if (isActive && !shadowCloneActiveRef.current) {
      trackJutsuActivated('shadowClone')
    }
    shadowCloneActiveRef.current = isActive
  }, [shadowCloneState])
}
