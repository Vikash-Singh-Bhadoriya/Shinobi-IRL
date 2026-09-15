import type { ShadowCloneEffectStatus } from '../../types/effects'
import type { ShadowClone } from './cloneTypes'
import { animateClone } from './cloneAnimator'
import { renderShadowCloneFrame } from './cloneRenderer'

const SPAWN_MS = 180
const ANIMATION_MS = 800
const COOLDOWN_MS = 3000
const FRAME_INTERVAL_MS = 1000 / 30

function createClones(): ShadowClone[] {
  return [
    { id: 'clone-left', x: 0, y: 0, scale: 1, opacity: 0.72, rotation: 0, animation: 'left' },
    { id: 'clone-right', x: 0, y: 0, scale: 1, opacity: 0.72, rotation: 0, animation: 'right' },
    { id: 'clone-jump', x: 0, y: 0, scale: 1, opacity: 0.68, rotation: 0, animation: 'jump' },
    { id: 'clone-attack', x: 0, y: 0, scale: 1, opacity: 0.8, rotation: 0, animation: 'attack' },
  ]
}

export class ShadowCloneEffect {
  private readonly canvas: HTMLCanvasElement
  private readonly video: HTMLVideoElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly onStatusChange: (status: ShadowCloneEffectStatus) => void
  private clones: ShadowClone[] = []
  private animationFrame = 0
  private startedAt = 0
  private active = false
  private cooldownUntil = 0
  private cooldownTimer = 0
  private lastRenderAt = 0
  private status: ShadowCloneEffectStatus = 'IDLE'

  constructor(
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    onStatusChange: (status: ShadowCloneEffectStatus) => void,
  ) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Shadow Clone effect canvas is unavailable')
    this.canvas = canvas
    this.video = video
    this.ctx = ctx
    this.onStatusChange = onStatusChange
  }

  setGestureReady(ready: boolean) {
    if (ready) {
      if (!this.active && performance.now() >= this.cooldownUntil) this.setStatus('READY')
      if (!this.active && performance.now() >= this.cooldownUntil) this.activate()
      return
    }
    if (!this.active && performance.now() >= this.cooldownUntil) this.setStatus('IDLE')
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame)
    window.clearTimeout(this.cooldownTimer)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  private activate() {
    this.active = true
    this.clones = createClones()
    this.startedAt = performance.now()
    this.lastRenderAt = 0
    this.setStatus('SPAWNING')
    this.animationFrame = requestAnimationFrame(this.render)
  }

  private setStatus(status: ShadowCloneEffectStatus) {
    if (this.status === status) return
    this.status = status
    this.onStatusChange(status)
  }

  private render = (now: number) => {
    if (this.lastRenderAt !== 0 && now - this.lastRenderAt < FRAME_INTERVAL_MS) {
      this.animationFrame = requestAnimationFrame(this.render)
      return
    }
    this.lastRenderAt = now
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width === 0 || height === 0 || this.video.readyState < 2) {
      this.animationFrame = requestAnimationFrame(this.render)
      return
    }
    if (this.canvas.width !== width) this.canvas.width = width
    if (this.canvas.height !== height) this.canvas.height = height

    const elapsed = now - this.startedAt
    const progress = Math.min(1, elapsed / ANIMATION_MS)
    if (elapsed >= SPAWN_MS && this.status === 'SPAWNING') this.setStatus('ANIMATING')
    const frames = this.clones.map((clone) => animateClone(clone, progress))
    renderShadowCloneFrame(this.ctx, this.video, this.clones, frames, width, height, progress)

    if (elapsed < ANIMATION_MS) {
      this.animationFrame = requestAnimationFrame(this.render)
      return
    }

    this.ctx.clearRect(0, 0, width, height)
    this.active = false
    this.cooldownUntil = now + COOLDOWN_MS
    this.setStatus('COOLDOWN')
    this.cooldownTimer = window.setTimeout(() => {
      if (!this.active && performance.now() >= this.cooldownUntil) this.setStatus('IDLE')
    }, COOLDOWN_MS)
  }
}