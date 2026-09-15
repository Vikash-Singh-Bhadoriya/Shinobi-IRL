import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { ImageSegmenter } from '@mediapipe/tasks-vision'
import { extractPerson } from '../effects/shadowClone/personExtractor'
import { getSelfieSegmenter } from '../segmentation/selfieSegmentation'
import type { SegmentationStatus } from '../types/segmentation'

const TARGET_INTERVAL_MS = 1000 / 24

export function useSelfieSegmentation(videoRef: RefObject<HTMLVideoElement>) {
  const personCanvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<SegmentationStatus>('loading')
  const segmenterRef = useRef<ImageSegmenter | null>(null)

  useEffect(() => {
    let cancelled = false
    void getSelfieSegmenter()
      .then((segmenter) => {
        if (cancelled) return
        segmenterRef.current = segmenter
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      segmenterRef.current?.close()
      segmenterRef.current = null
    }
  }, [])

  useEffect(() => {
    if (status !== 'ready') return

    let animationFrame = 0
    let lastSegmentedAt = 0
    const canvas = personCanvasRef.current
    const context = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !context) return

    const tick = (now: number) => {
      const video = videoRef.current
      const segmenter = segmenterRef.current
      if (
        video &&
        segmenter &&
        video.readyState >= 2 &&
        !video.paused &&
        now - lastSegmentedAt >= TARGET_INTERVAL_MS
      ) {
        lastSegmentedAt = now
        segmenter.segmentForVideo(video, now, (result) => {
          const mask = result.confidenceMasks?.[0]
          if (mask) extractPerson(video, mask, canvas, context)
        })
      }
      animationFrame = requestAnimationFrame(tick)
    }

    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [status, videoRef])

  return { personCanvasRef, status }
}