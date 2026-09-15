import type { ShadowClone, ShadowCloneFrame } from './cloneTypes'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const easeOut = (value: number) => 1 - (1 - value) ** 3

export function animateClone(clone: ShadowClone, progress: number): ShadowCloneFrame {
  const t = clamp(progress, 0, 1)
  const eased = easeOut(t)

  switch (clone.animation) {
    case 'left':
      return { x: clone.x - 0.28 * eased, y: clone.y, scale: clone.scale, opacity: clone.opacity * (1 - t * 0.15), rotation: -0.025 * eased }
    case 'right':
      return { x: clone.x + 0.28 * eased, y: clone.y, scale: clone.scale, opacity: clone.opacity * (1 - t * 0.15), rotation: 0.025 * eased }
    case 'jump':
      return { x: clone.x, y: clone.y - Math.sin(t * Math.PI) * 0.2, scale: clone.scale, opacity: clone.opacity * (1 - t * 0.1), rotation: 0 }
    case 'attack':
      return { x: clone.x, y: clone.y, scale: clone.scale + 0.4 * eased, opacity: clone.opacity * (1 - eased), rotation: 0 }
  }
}