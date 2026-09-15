import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { HandLandmarker } from '@mediapipe/tasks-vision'
import type { HandLandmarks, HandLandmarksSink, HandTrackingState } from '../types/hand'
import { getHandLandmarker } from '../vision/handLandmarker'

const INITIAL_STATE: HandTrackingState = {
  status: 'loading',
  error: null,
  handsCount: 0,
  visionFps: 0,
}

const FPS_WINDOW_MS = 500

export function useHandTracking(videoRef: RefObject<HTMLVideoElement>) {
  const [state, setState] = useState<HandTrackingState>(INITIAL_STATE)

  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const sinkRef = useRef<HandLandmarksSink | null>(null)
  const detectionCountRef = useRef(0)
  const fpsWindowStartRef = useRef(0)
  const isReady = state.status === 'ready'

  const registerSink = useCallback((sink: HandLandmarksSink) => {
    sinkRef.current = sink
  }, [])

  useEffect(() => {
    let cancelled = false
    void getHandLandmarker()
      .then((landmarker) => {
        if (cancelled) return
        landmarkerRef.current = landmarker
        setState((prev) => ({ ...prev, status: 'ready', error: null }))
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        }))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isReady) return

    let raf = 0
    fpsWindowStartRef.current = 0

    const updateVisionFps = (now: number) => {
      detectionCountRef.current += 1
      if (!fpsWindowStartRef.current) fpsWindowStartRef.current = now
      const elapsed = now - fpsWindowStartRef.current
      if (elapsed >= FPS_WINDOW_MS) {
        const fps = Math.round((detectionCountRef.current / elapsed) * 1000)
        detectionCountRef.current = 0
        fpsWindowStartRef.current = now
        setState((prev) => (prev.visionFps === fps ? prev : { ...prev, visionFps: fps }))
      }
    }

    const tick = (now: number) => {
      const video = videoRef.current
      const landmarker = landmarkerRef.current

      if (video && landmarker && video.videoWidth > 0 && video.readyState >= 2 && !video.paused) {
        const result = landmarker.detectForVideo(video, now)
        const hands: HandLandmarks | null = result.landmarks.length > 0 ? result.landmarks : null

        sinkRef.current?.(hands)
        updateVisionFps(now)

        const detected = hands?.length ?? 0
        setState((prev) =>
          prev.handsCount === detected ? prev : { ...prev, handsCount: detected },
        )
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isReady, videoRef])

  return { ...state, registerSink }
}