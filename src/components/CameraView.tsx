import { useEffect, useRef } from 'react'
import type { CameraState } from '../types/camera'

interface CameraViewProps extends CameraState {
  onStart: () => void
}

const STATUS_LABEL: Record<CameraState['status'], string> = {
  idle: 'WAITING FOR PERMISSION',
  loading: 'STARTING',
  ready: 'READY',
  'permission-denied': 'PERMISSION DENIED',
  'no-device': 'NO DEVICE',
  error: 'ERROR',
  unsupported: 'UNSUPPORTED',
}

const STATUS_MESSAGE: Record<CameraState['status'], string | null> = {
  idle: null,
  loading: 'Starting camera...',
  ready: null,
  'permission-denied': 'Camera permission denied. Please enable camera access.',
  'no-device': 'No camera device found.',
  error: null,
  unsupported: 'Your browser does not support camera access.',
}

export function CameraView({ status, stream, fps, videoWidth, videoHeight, error, onStart }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    return () => {
      video.srcObject = null
    }
  }, [stream])

  const isLive = status === 'ready' && stream !== null
  const message = error ?? STATUS_MESSAGE[status]
  const aspectRatio = videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : 16 / 9

  return (
    <div className="camera-view">
      <div className="camera-frame" style={{ aspectRatio: `${aspectRatio}` }}>
        <video
          ref={videoRef}
          className="camera-video"
          autoPlay
          muted
          playsInline
          aria-label="Live camera preview"
        />

        {!isLive && (
          <div className="camera-message">
            {message && <p className="camera-message-text">{message}</p>}
            {status === 'idle' && (
              <button type="button" className="btn" onClick={onStart}>
                Start Camera
              </button>
            )}
          </div>
        )}

        {isLive && (
          <div className="camera-live-badge" aria-hidden="true">
            <span className="camera-live-dot" />
            LIVE
          </div>
        )}
      </div>

      <div className="camera-readouts">
        <div className="readout">
          <span className="readout-label">Camera Status</span>
          <span className={`readout-value status-${status}`}>{STATUS_LABEL[status]}</span>
        </div>
        <div className="readout">
          <span className="readout-label">FPS</span>
          <span className="readout-value">{isLive ? fps : '-'}</span>
        </div>
      </div>
    </div>
  )
}