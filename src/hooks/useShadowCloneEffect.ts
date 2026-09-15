import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { ShadowCloneEffectStatus } from '../types/effects'
import type { ShadowCloneState } from '../types/gesture'
import { ShadowCloneEffect } from '../effects/shadowClone/ShadowCloneEffect'

export function useShadowCloneEffect(
  canvasSourceRef: RefObject<HTMLCanvasElement>,
  gestureState: ShadowCloneState,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const effectRef = useRef<ShadowCloneEffect | null>(null)
  const [status, setStatus] = useState<ShadowCloneEffectStatus>('IDLE')

  useEffect(() => {
    const canvas = canvasRef.current
    const personCanvas = canvasSourceRef.current
    if (!canvas || !personCanvas) return
    const effect = new ShadowCloneEffect(canvas, personCanvas, setStatus)
    effectRef.current = effect
    return () => {
      effect.destroy()
      effectRef.current = null
    }
  }, [canvasSourceRef])

  useEffect(() => {
    effectRef.current?.setGestureReady(gestureState === 'SHADOW_CLONE_READY')
  }, [gestureState])

  return { canvasRef, status }
}