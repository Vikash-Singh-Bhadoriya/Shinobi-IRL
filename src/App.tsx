import { CameraView } from './components/CameraView'
import { useCamera } from './hooks/useCamera'

export default function App() {
  const { start: onStart, ...cameraState } = useCamera()

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          <span aria-hidden="true">🥷</span> SHINOBI IRL
        </h1>
        <p className="app-subtitle">Live camera jutsu stage</p>
      </header>

      <main className="app-main">
        <CameraView {...cameraState} onStart={onStart} />
      </main>
    </div>
  )
}