import { useRef } from 'react'
import { CameraView } from './components/CameraView'
import { GestureDebugPanel } from './components/GestureDebugPanel'
import { HandOverlay } from './components/HandOverlay'
import { RasenganDebugPanel } from './components/RasenganDebugPanel'
import { useCamera } from './hooks/useCamera'
import { useGestureDetection } from './hooks/useGestureDetection'
import { useHandTracking } from './hooks/useHandTracking'
import { useRasengan } from './hooks/useRasengan'
import { useShadowCloneEffect } from './hooks/useShadowCloneEffect'
import { useSelfieSegmentation } from './hooks/useSelfieSegmentation'

const VISION_STATUS_LABEL: Record<string, string> = {
  loading: 'Loading hand tracker...',
  ready: 'Hand tracker ready',
  error: 'Hand tracker error',
}

export default function App() {
  const { start: onStart, ...cameraState } = useCamera()
  const videoRef = useRef<HTMLVideoElement>(null)
  const { handsCount, visionFps, status: handStatus, registerSink } = useHandTracking(videoRef)
  const gesture = useGestureDetection(registerSink)
  const rasengan = useRasengan(registerSink)
  const segmentation = useSelfieSegmentation(videoRef)
  const shadowCloneEffect = useShadowCloneEffect(segmentation.personCanvasRef, gesture.state)
  const debugMode = new URLSearchParams(window.location.search).has('debug')

  const cameraLive = cameraState.status === 'ready'
  const visionLive = handStatus === 'ready' && cameraLive

  return (
    <div className={`app ${debugMode ? 'is-debug' : ''}`}>
      <header className="app-header">
        <h1 className="app-title">
          <span aria-hidden="true">🥷</span> SHINOBI IRL
        </h1>
        <p className="app-subtitle">Live camera jutsu stage</p>
      </header>

      <main className="app-main">
        <CameraView
          {...cameraState}
          onStart={onStart}
          videoRef={videoRef}
          showDebug={debugMode}
        >
          <canvas
            ref={shadowCloneEffect.canvasRef}
            className="shadow-clone-effect-canvas"
            width={1}
            height={1}
            aria-hidden="true"
          />
          <canvas
            ref={rasengan.canvasRef}
            className="rasengan-effect-canvas"
            width={1}
            height={1}
            aria-hidden="true"
          />
          <canvas ref={segmentation.personCanvasRef} className="person-mask-canvas" aria-hidden="true" />
          <HandOverlay registerSink={registerSink} />
        </CameraView>

        {debugMode && <section className="vision-readouts" aria-label="Vision diagnostics">
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
          <div className="readout">
            <span className="readout-label">Shadow Clone Effect</span>
            <span className="readout-value">{shadowCloneEffect.status}</span>
          </div>
        </section>}

        {debugMode && <GestureDebugPanel result={gesture} />}
        {debugMode && <RasenganDebugPanel result={rasengan.result} />}
      </main>
    </div>
  )
}