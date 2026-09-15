export type ShadowCloneAnimation = 'left' | 'right' | 'jump' | 'attack'

export interface ShadowClone {
  id: string
  x: number
  y: number
  scale: number
  opacity: number
  rotation: number
  animation: ShadowCloneAnimation
}

export interface ShadowCloneFrame {
  x: number
  y: number
  scale: number
  opacity: number
  rotation: number
}