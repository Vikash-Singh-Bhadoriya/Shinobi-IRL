import { useRef } from 'react'
import { CameraView } from './components/CameraView'
import { HandOverlay } from './components/HandOverlay'
import { useCamera } from './hooks/useCamera'
import { useHandTracking } from './hooks/useHandTracking'

const VISION_STATUS_LABEL: Record<string, string> = {
  loading: 'Loading hand tracker...',
  ready: 'Hand tracker ready',
  error: 'Hand tracker error',
}

export default function App() {
  const { start: onStart, ...cameraState } = useCamera()
  const videoRef = useRef<HTMLVideoElement>(null)
  const { handsCount, visionFps, status: handStatus, registerSink } = useHandTracking(videoRef)

  const cameraLive = cameraState.status === 'ready'
  const visionLive = handStatus === 'ready' && cameraLive

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          <span aria-hidden="true">🥷</span> SHINOBI IRL
        </h1>
        <p className="app-subtitle">Live camera jutsu stage</p>
      </header>

      <main className="app-main">
        <CameraView {...cameraState} onStart={onStart} videoRef={videoRef}>
          <HandOverlay registerSink={registerSink} />
        </CameraView>

        <section className="vision-readouts" aria-label="Vision diagnostics">
          <div className="readout">
            <span className="readout-label">Vision Status</span>
            <span className={`readout-value status-hand-${handStatus}`}>
              {VISION_STATUS_LABEL[handStatus]}
            </span>
          </div>
          <div className="readout">
            <span className="readout-label">Vision FPS</span>
            <span className="readout-value">{visionLive ? visionFps : '-'}</span>
          </div>
          <div className="readout">
            <span className="readout-label">Hands Detected</span>
            <span className="readout-value">{visionLive ? handsCount : '-'}</span>
          </div>
        </section>
      </main>
    </div>
  )
}