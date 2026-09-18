import { useCallback, useEffect, useRef, useState } from 'react'
import type { CameraErrorCode, CameraOptions, CameraState } from '../types/camera'

const INITIAL_STATE: CameraState = {
  status: 'idle',
  stream: null,
  fps: 0,
  videoWidth: 0,
  videoHeight: 0,
  frameRate: null,
  error: null,
}

function isSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  )
}

function buildConstraints(options: CameraOptions): MediaStreamConstraints {
  const source = options.video && typeof options.video === 'object' ? options.video : {}
  const video: MediaTrackConstraints = {
    ...source,
    width: { ideal: 1280 },
    height: { ideal: 720 },
  }
  if (options.targetFacing) video.facingMode = options.targetFacing
  return {
    video,
    audio: options.audio ?? true,
  }
}

function describeError(code: CameraErrorCode): CameraState['error'] {
  switch (code) {
    case 'NotAllowedError':
      return 'Camera permission denied'
    case 'NotFoundError':
      return 'No camera device found'
    case 'NotReadableError':
      return 'Camera is already in use by another application'
    case 'OverconstrainedError':
      return 'No camera matches the requested settings'
    case 'SecurityError':
      return 'Camera access blocked by the browser'
    case 'AbortError':
      return 'Camera request was aborted'
    default:
      return 'Unable to start the camera'
  }
}

export function useCamera(options: CameraOptions = {}) {
  const [state, setState] = useState<CameraState>(INITIAL_STATE)
  // Hold options in a ref so the start/stop callbacks stay referentially
  // stable regardless of how often the caller passes a fresh options object.
  const optionsRef = useRef(options)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)
  const fpsFrameCountRef = useRef<number>(0)
  const fpsAccumRef = useRef<number>(0)
  const fpsLastUpdateRef = useRef<number>(0)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const stopFpsLoop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = 0
    }
    lastFrameTimeRef.current = 0
    fpsFrameCountRef.current = 0
    fpsAccumRef.current = 0
    fpsLastUpdateRef.current = 0
  }, [])

  const runFpsLoop = useCallback(() => {
    const tick = (time: number) => {
      if (!fpsLastUpdateRef.current) fpsLastUpdateRef.current = time

      const delta = time - lastFrameTimeRef.current
      if (delta > 0 && delta < 1000) {
        fpsAccumRef.current += 1000 / delta
        fpsFrameCountRef.current += 1
      }
      lastFrameTimeRef.current = time

      if (time - fpsLastUpdateRef.current >= 500) {
        const avg = fpsFrameCountRef.current
          ? Math.round(fpsAccumRef.current / fpsFrameCountRef.current)
          : 0
        setState((prev) => (prev.fps === avg ? prev : { ...prev, fps: avg }))
        fpsAccumRef.current = 0
        fpsFrameCountRef.current = 0
        fpsLastUpdateRef.current = time
      }

      animationRef.current = requestAnimationFrame(tick)
    }

    animationRef.current = requestAnimationFrame(tick)
  }, [])

  const start = useCallback(async () => {
    if (!isSupported()) {
      setState((prev) => ({ ...prev, status: 'unsupported', error: 'getUserMedia is not available' }))
      return
    }

    // Clean up any previously acquired stream before asking again.
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    setState((prev) => ({ ...prev, status: 'loading', error: null, stream: null }))

    try {
      const stream = await navigator.mediaDevices.getUserMedia(buildConstraints(optionsRef.current))
      streamRef.current = stream
      runFpsLoop()
      const settings = stream.getVideoTracks()[0]?.getSettings()
      console.info('[camera] active track settings:', {
        width: settings?.width ?? 0,
        height: settings?.height ?? 0,
        frameRate: settings?.frameRate ?? null,
        facingMode: settings?.facingMode ?? null,
        requested: buildConstraints(optionsRef.current).video as MediaTrackConstraints,
      })
      setState((prev) => ({
        ...prev,
        status: 'ready',
        stream,
        videoWidth: settings?.width ?? 0,
        videoHeight: settings?.height ?? 0,
        frameRate: settings?.frameRate ?? null,
        error: null,
      }))
    } catch (err) {
      stopFpsLoop()
      const name = (err as DOMException)?.name as CameraErrorCode
      let status: CameraState['status'] = 'permission-denied'
      if (name === 'NotFoundError') status = 'no-device'
      if (name !== 'NotAllowedError' && name !== 'NotFoundError') status = 'error'
      setState((prev) => ({
        ...prev,
        status,
        stream: null,
        error: describeError(name),
      }))
    }
  }, [runFpsLoop, stopFpsLoop])

  const stop = useCallback(() => {
    stopFpsLoop()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setState((prev) => ({ ...prev, status: 'idle', stream: null, fps: 0, error: null }))
  }, [stopFpsLoop])

  useEffect(() => {
    void start()
    return () => stop()
  }, [start, stop])

  return { ...state, start, stop }
}