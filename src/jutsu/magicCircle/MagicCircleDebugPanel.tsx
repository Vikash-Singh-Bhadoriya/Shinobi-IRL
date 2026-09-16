import type { MagicCircleDetection, MagicCircleRenderStats } from './magicCircleTypes'

interface MagicCircleDebugPanelProps {
  result: MagicCircleDetection
}

const EMPTY_STATS: MagicCircleRenderStats = {
  visualState: 'IDLE',
  energy: 0,
  layerCount: 5,
  particleCount: 120,
  rotation: 0,
  fps: 60,
}

export function MagicCircleDebugPanel({ result }: MagicCircleDebugPanelProps) {
  const stats = result.renderStats ?? EMPTY_STATS
  return (
    <section className="magic-circle-debug" aria-label="Magic Circle analysis">
      <h2 className="gesture-debug-title">Magic Circle Analysis</h2>
      <div className={`gesture-state gesture-state-${result.state.toLowerCase()}`}>
        {stats.visualState}
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Energy</span>
        <span className="gesture-debug-value">{Math.round(stats.energy * 100)}%</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Layers</span>
        <span className="gesture-debug-value">{stats.layerCount}</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Particles</span>
        <span className="gesture-debug-value">{stats.particleCount}</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Render FPS</span>
        <span className="gesture-debug-value">{stats.fps}</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Palm Detected</span>
        <span className="gesture-debug-value">{result.palmDetected ? 'YES' : 'NO'}</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Open Palm Confidence</span>
        <span className="gesture-debug-value">{Math.round(result.openPalmConfidence * 100)}%</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Rotation</span>
        <span className="gesture-debug-value">{Math.round((stats.rotation * 180) / Math.PI)} deg</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Position</span>
        <span className="gesture-debug-value">
          x: {result.palmPosition ? result.palmPosition.x.toFixed(2) : '-'} y:{' '}
          {result.palmPosition ? result.palmPosition.y.toFixed(2) : '-'}
        </span>
      </div>
    </section>
  )
}
