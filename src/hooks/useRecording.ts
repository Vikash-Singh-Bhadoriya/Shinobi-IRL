import { useState, useRef, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import { getRecordingStream } from '../audio/audioManager'

export interface UseRecordingOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRefs: RefObject<HTMLCanvasElement | null>[]
}

export function useRecording({ videoRef, canvasRefs }: UseRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const compositorRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const timerRafRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

  const getMimeType = () => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ]
    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
        return t
      }
    }
    return ''
  }

  const startRecording = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    const cw = video.clientWidth
    const ch = video.clientHeight
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (cw === 0 || ch === 0 || vw === 0 || vh === 0) return

    // Calculate dimensions to preserve exact 'object-fit: cover' aspect ratio at maximum sensible resolution
    const scale = Math.max(cw / vw, ch / vh)
    const outW = Math.round(cw / scale)
    const outH = Math.round(ch / scale)
    const srcX = Math.round((vw - outW) / 2)
    const srcY = Math.round((vh - outH) / 2)

    // 1. Setup Compositor Canvas
    const compositor = document.createElement('canvas')
    compositor.width = outW
    compositor.height = outH
    compositorRef.current = compositor
    const ctx = compositor.getContext('2d', { willReadFrequently: false })

    // 2. Compositor RAF Loop (Throttled to 30 FPS)
    const FRAME_INTERVAL = 1000 / 30
    let lastFrameTime = 0

    const drawFrame = (timestamp: number) => {
      rafRef.current = requestAnimationFrame(drawFrame)

      if (!lastFrameTime) lastFrameTime = timestamp
      const elapsed = timestamp - lastFrameTime
      if (elapsed < FRAME_INTERVAL) return
      
      // Prevent drift by capping the remainder
      lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL)

      if (!ctx || !videoRef.current) return
      
      ctx.clearRect(0, 0, outW, outH)
      ctx.save()
      
      // Mirror the canvas to match the CSS scaleX(-1) behavior
      ctx.translate(outW, 0)
      ctx.scale(-1, 1)
      
      // Draw base video slice (object-fit: cover equivalent)
      ctx.drawImage(videoRef.current, srcX, srcY, outW, outH, 0, 0, outW, outH)
      
      // Draw overlay canvases in z-index order
      for (const ref of canvasRefs) {
        if (ref.current && ref.current.width > 0 && ref.current.height > 0) {
          // The VFX canvases are naturally 'cw x ch' since they span the container.
          // Drawing them into 'outW x outH' maintains exact relative alignment with the camera slice.
          ctx.drawImage(ref.current, 0, 0, outW, outH)
        }
      }
      ctx.restore()
    }
    rafRef.current = requestAnimationFrame(drawFrame)

    // 3. Setup Streams
    // @ts-ignore - captureStream exists on canvas
    const videoStream = compositor.captureStream(30) as MediaStream
    const audioStream = getRecordingStream()
    
    const tracks = [...videoStream.getVideoTracks()]
    if (audioStream) {
      tracks.push(...audioStream.getAudioTracks())
    }
    const combinedStream = new MediaStream(tracks)
    streamRef.current = combinedStream

    // 4. Start Recorder
    const mimeType = getMimeType()
    const options = mimeType ? { mimeType } : undefined
    const recorder = new MediaRecorder(combinedStream, options)
    
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      const now = new Date()
      const pad = (n: number) => n.toString().padStart(2, '0')
      const filename = `shinobi-irl-${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
      const ext = (mimeType && mimeType.includes('mp4')) ? 'mp4' : 'webm'
      a.download = `${filename}.${ext}`
      
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      chunksRef.current = []
    }

    recorder.start(1000)
    recorderRef.current = recorder
    setIsRecording(true)
    startTimeRef.current = performance.now()
    
    // 5. Setup UI Timer Loop
    const updateTimer = () => {
      setElapsedMs(performance.now() - startTimeRef.current)
      timerRafRef.current = requestAnimationFrame(updateTimer)
    }
    timerRafRef.current = requestAnimationFrame(updateTimer)

  }, [videoRef, canvasRefs])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    if (timerRafRef.current) {
      cancelAnimationFrame(timerRafRef.current)
      timerRafRef.current = 0
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setIsRecording(false)
    setElapsedMs(0)
    compositorRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  return { isRecording, elapsedMs, startRecording, stopRecording }
}
