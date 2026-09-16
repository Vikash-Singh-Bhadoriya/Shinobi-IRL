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
  const wasGestureReadyRef = useRef(false)
  const [gestureEdge, setGestureEdge] = useState<'NEW' | 'HOLD'>('HOLD')
  const [status, setStatus] = useState<ShadowCloneEffectStatus>('NO_CLONES')

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
    const ready = gestureState === 'SHADOW_CLONE_READY'
    const edge = ready && !wasGestureReadyRef.current
    wasGestureReadyRef.current = ready
    setGestureEdge(edge ? 'NEW' : 'HOLD')
    if (edge) effectRef.current?.toggle()
  }, [gestureState])

  return {
    canvasRef,
    status,
    gestureEdge,
    cooldown: status === 'COOLDOWN',
    cloneCount: effectRef.current?.getCloneCount() ?? 0,
  }
}