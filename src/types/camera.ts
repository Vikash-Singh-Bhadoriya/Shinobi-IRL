export type CameraStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'permission-denied'
  | 'no-device'
  | 'error'
  | 'unsupported'

export interface CameraState {
  status: CameraStatus
  stream: MediaStream | null
  fps: number
  videoWidth: number
  videoHeight: number
  error: string | null
}

export type CameraErrorCode =
  | 'NotAllowedError'
  | 'NotFoundError'
  | 'NotReadableError'
  | 'OverconstrainedError'
  | 'AbortError'
  | 'SecurityError'

export interface CameraOptions {
  video?: boolean | MediaTrackConstraints
  audio?: boolean
  targetFacing?: 'user' | 'environment'
}