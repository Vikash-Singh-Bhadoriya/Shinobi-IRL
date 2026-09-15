import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision'
import type { HandFrame, HandFrameSink, HandTrackingState } from '../types/hand'
import { getHandLandmarker } from '../vision/handLandmarker'

const INITIAL_STATE: HandTrackingState = {
  status: 'loading',
  error: null,
  handsCount: 0,
  visionFps: 0,
}

const FPS_WINDOW_MS = 500
const BASE_INTERVAL_MS = 33
const HEAVY_INTERVAL_MS = 50
const HEAVY_THRESHOLD_MS = 30
const AI_MAX_DIM = 480

export function useHandTracking(videoRef: RefObject<HTMLVideoElement>) {
  const [state, setState] = useState<HandTrackingState>(INITIAL_STATE)

  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const sinksRef = useRef<HandFrameSink[]>([])
  const detectionCountRef = useRef(0)
  const fpsWindowStartRef = useRef(0)
  const lastInferenceRef = useRef(0)
  const lastProcessedVideoTimeRef = useRef(-1)
  const nextIntervalRef = useRef<number>(BASE_INTERVAL_MS)
  const isReady = state.status === 'ready'

  const registerSink = useCallback((sink: HandFrameSink) => {
    sinksRef.current.push(sink)
    return () => {
      sinksRef.current = sinksRef.current.filter((registered) => registered !== sink)
    }
  }, [])

  const buildFrame = useCallback((result: HandLandmarkerResult): HandFrame => {
    return result.landmarks.map((landmarks, index) => ({
      landmarks,
      handedness: result.handedness?.[index]?.[0]?.categoryName ?? `Hand ${index + 1}`,
    }))
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
    lastInferenceRef.current = 0
    lastProcessedVideoTimeRef.current = -1
    nextIntervalRef.current = BASE_INTERVAL_MS

    let aiCanvas: HTMLCanvasElement | null = null
    let aiContext: CanvasRenderingContext2D | null = null
    let lastAiW = 0
    let lastAiH = 0

    const ensureAiCanvas = (videoW: number, videoH: number): HTMLCanvasElement | null => {
      const scale = AI_MAX_DIM / Math.max(videoW, videoH)
      const nextW = Math.max(2, Math.round(videoW * scale))
      const nextH = Math.max(2, Math.round(videoH * scale))

      if (!aiCanvas) {
        aiCanvas = document.createElement('canvas')
        aiContext = aiCanvas.getContext('2d')
        if (aiContext) {
          aiContext.imageSmoothingEnabled = true
          aiContext.imageSmoothingQuality = 'low'
        }
      }

      if (nextW !== lastAiW || nextH !== lastAiH) {
        if (aiCanvas) {
          aiCanvas.width = nextW
          aiCanvas.height = nextH
        }
        lastAiW = nextW
        lastAiH = nextH
        console.info(`[hand-tracking] AI input canvas ${nextW}x${nextH} (video ${videoW}x${videoH})`)
      }

      return aiContext ? aiCanvas : null
    }

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
        const frameReady = video.currentTime !== lastProcessedVideoTimeRef.current
        if (now - lastInferenceRef.current >= nextIntervalRef.current && frameReady) {
          lastProcessedVideoTimeRef.current = video.currentTime
          const canvas = ensureAiCanvas(video.videoWidth, video.videoHeight)
          if (canvas && aiContext) {
            lastInferenceRef.current = now
            aiContext.drawImage(video, 0, 0, canvas.width, canvas.height)
            const t0 = performance.now()
            const result = landmarker.detectForVideo(canvas, now)
            const cost = performance.now() - t0
            nextIntervalRef.current = cost >= HEAVY_THRESHOLD_MS ? HEAVY_INTERVAL_MS : BASE_INTERVAL_MS

            const frame = buildFrame(result)
            for (const sink of sinksRef.current) {
              sink(frame)
            }
            updateVisionFps(now)

            const detected = frame.length
            setState((prev) =>
              prev.handsCount === detected ? prev : { ...prev, handsCount: detected },
            )
          }
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [buildFrame, isReady, videoRef])

  return { ...state, registerSink }
}