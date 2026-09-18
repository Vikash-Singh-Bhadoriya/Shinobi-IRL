import type { RefObject } from 'react'
import { useRecording } from '../hooks/useRecording'

interface RecordingControlsProps {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRefs: RefObject<HTMLCanvasElement | null>[]
}

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function RecordingControls(props: RecordingControlsProps) {
  const { isRecording, elapsedMs, startRecording, stopRecording } = useRecording(props)

  return (
    <div className="recording-controls">
      {isRecording ? (
        <button type="button" className="btn btn-recording" onClick={stopRecording}>
          <span className="recording-indicator" />
          REC {formatTime(elapsedMs)}
          <span className="recording-stop-text">[ Stop ]</span>
        </button>
      ) : (
        <button type="button" className="btn" onClick={startRecording}>
          <span className="recording-dot-idle" /> Record
        </button>
      )}
    </div>
  )
}
