import type { ShadowClone, ShadowCloneFrame } from './cloneTypes'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const easeOutCubic = (value: number) => 1 - (1 - value) ** 3
const easeInOut = (value: number) =>
  value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2

const SPAWN_DURATION = 1400

function phaseProgress(elapsedMs: number): number {
  return clamp(elapsedMs / SPAWN_DURATION, 0, 1)
}

export function animateClone(clone: ShadowClone, elapsedMs: number): ShadowCloneFrame {
  const t = phaseProgress(elapsedMs)
  const eased = easeOutCubic(t)

  switch (clone.animation) {
    case 'LEFT_RUNNER':
      return {
        x: -0.25 * eased,
        y: 0,
        scale: 1,
        opacity: 0.9,
        rotation: -0.08 * eased,
      }
    case 'RIGHT_RUNNER':
      return {
        x: 0.25 * eased,
        y: 0,
        scale: 1,
        opacity: 0.9,
        rotation: 0.08 * eased,
      }
    case 'JUMP_OVER': {
      const arc = Math.sin(t * Math.PI)
      return {
        x: 0.2 * easeInOut(t),
        y: -0.24 * arc,
        scale: 1 + 0.08 * arc,
        opacity: 0.88,
        rotation: 0.04 * Math.sin(t * Math.PI * 2),
      }
    }
    case 'CAMERA_ATTACK': {
      const attackProgress = clamp(t / 0.72, 0, 1)
      const settleProgress = clamp((t - 0.72) / 0.28, 0, 1)
      const attackScale = 1 + 0.45 * easeOutCubic(attackProgress)
      return {
        x: 0.03 * (1 - settleProgress),
        y: -0.015 * (1 - settleProgress),
        scale: attackProgress < 1 ? attackScale : 1.12 - 0.02 * easeOutCubic(settleProgress),
        opacity: 0.9,
        rotation: 0,
      }
    }
  }
}