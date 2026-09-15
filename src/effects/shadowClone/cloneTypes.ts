export type ShadowCloneAnimation =
  | 'LEFT_RUNNER'
  | 'RIGHT_RUNNER'
  | 'JUMP_OVER'
  | 'CAMERA_ATTACK'

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