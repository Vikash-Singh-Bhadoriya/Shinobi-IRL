import { useRef } from 'react'
import { CameraView } from './components/CameraView'
import { GestureDebugPanel } from './components/GestureDebugPanel'
import { HandOverlay } from './components/HandOverlay'
import { RasenganDebugPanel } from './components/RasenganDebugPanel'
import { useCamera } from './hooks/useCamera'
import { useGestureDetection } from './hooks/useGestureDetection'
import { useHandTracking } from './hooks/useHandTracking'
import { useLightning } from './hooks/useLightning'
import { useRasengan } from './hooks/useRasengan'
import { useShadowCloneEffect } from './hooks/useShadowCloneEffect'
import { useSelfieSegmentation } from './hooks/useSelfieSegmentation'
import { LightningDebugPanel } from './jutsu/lightning/LightningDebugPanel'
import { MagicCircleDebugPanel } from './jutsu/magicCircle/MagicCircleDebugPanel'
import { useMagicCircle } from './jutsu/magicCircle/useMagicCircle'
import { useJutsuAudio } from './audio/useJutsuAudio'
import { useAnalytics } from './analytics/useAnalytics'
import { trackGitHubClicked, trackLinkedInClicked } from './analytics/analytics'

const VISION_STATUS_LABEL: Record<string, string> = {
  loading: 'Loading hand tracker...',
  ready: 'Hand tracker ready',
  error: 'Hand tracker error',
}

export default function App() {
  const { start: onStart, ...cameraState } = useCamera()
  const videoRef = useRef<HTMLVideoElement>(null)
  const handOverlayCanvasRef = useRef<HTMLCanvasElement>(null)

  const { handsCount, visionFps, status: handStatus, registerSink } = useHandTracking(videoRef)
  const gesture = useGestureDetection(registerSink)
  const rasengan = useRasengan(registerSink)
  const lightning = useLightning(registerSink)
  const magicCircle = useMagicCircle(registerSink)
  const segmentation = useSelfieSegmentation(videoRef)
  const shadowCloneEffect = useShadowCloneEffect(segmentation.personCanvasRef, gesture.state)

  useJutsuAudio({
    rasenganResult: rasengan.result,
    lightningResult: lightning.result,
    magicCircleResult: magicCircle.result,
    shadowCloneState: gesture.state,
  })

  // Analytics — pure observer of existing state, no detection logic
  useAnalytics({
    cameraReady: cameraState.status === 'ready',
    rasenganResult: rasengan.result,
    lightningResult: lightning.result,
    magicCircleResult: magicCircle.result,
    shadowCloneState: gesture.state,
  })

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
          <canvas
            ref={lightning.canvasRef}
            className="lightning-effect-canvas"
            width={1}
            height={1}
            aria-hidden="true"
          />
          <canvas
            ref={magicCircle.canvasRef}
            className="magic-circle-effect-canvas"
            width={1}
            height={1}
            aria-hidden="true"
          />
          <canvas ref={segmentation.personCanvasRef} className="person-mask-canvas" aria-hidden="true" />
          <HandOverlay canvasRef={handOverlayCanvasRef} registerSink={registerSink} showDebug={debugMode} />
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

        {debugMode && (
          <GestureDebugPanel
            result={gesture}
            effectStatus={shadowCloneEffect.status}
            gestureEdge={shadowCloneEffect.gestureEdge}
            cooldown={shadowCloneEffect.cooldown}
            cloneCount={shadowCloneEffect.cloneCount}
          />
        )}
        {debugMode && <RasenganDebugPanel result={rasengan.result} />}
        {debugMode && <LightningDebugPanel result={lightning.result} />}
        {debugMode && <MagicCircleDebugPanel result={magicCircle.result} />}
      </main>

      <footer className="app-footer">
        <a
          href="https://github.com/Vikash-Singh-Bhadoriya/Shinobi-IRL"
          target="_blank"
          rel="noopener noreferrer"
          className="app-footer-link"
          onClick={trackGitHubClicked}
        >
          GitHub
        </a>
        <span className="app-footer-sep" aria-hidden="true">·</span>
        <a
          href="https://www.linkedin.com/in/mrvikashsingh/"
          target="_blank"
          rel="noopener noreferrer"
          className="app-footer-link"
          onClick={trackLinkedInClicked}
        >
          LinkedIn
        </a>
      </footer>
    </div>
  )
}