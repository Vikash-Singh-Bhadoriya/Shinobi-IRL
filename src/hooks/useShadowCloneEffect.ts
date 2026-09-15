import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { ShadowCloneEffectStatus } from '../types/effects'
import type { ShadowCloneState } from '../types/gesture'
import { ShadowCloneEffect } from '../effects/shadowClone/ShadowCloneEffect'

export function useShadowCloneEffect(
  videoRef: RefObject<HTMLVideoElement>,
  gestureState: ShadowCloneState,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const effectRef = useRef<ShadowCloneEffect | null>(null)
  const [status, setStatus] = useState<ShadowCloneEffectStatus>('IDLE')

  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const effect = new ShadowCloneEffect(canvas, video, setStatus)
    effectRef.current = effect
    return () => {
      effect.destroy()
      effectRef.current = null
    }
  }, [videoRef])

  useEffect(() => {
    effectRef.current?.setGestureReady(gestureState === 'SHADOW_CLONE_READY')
  }, [gestureState])

  return { canvasRef, status }
}