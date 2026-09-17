import type { LightningInstance } from './lightningTypes'

interface LightningDebugPanelProps {
  result: LightningInstance[]
}

export function LightningDebugPanel({ result }: LightningDebugPanelProps) {
  const activeCount = result.filter(({ detection }) => detection.active).length
  return (
    <section className="lightning-debug" aria-label="Lightning analysis">
      <h2 className="gesture-debug-title">Lightning Analysis</h2>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Active Lightning</span>
        <span className="gesture-debug-value">{activeCount}</span>
      </div>
      {result.map(({ hand, detection }) => (
        <div key={hand}>
          <div className={`gesture-state gesture-state-${detection.state.toLowerCase()}`} style={{ color: '#00dcff' }}>
            {hand.toUpperCase()}: {detection.state}
          </div>
          <div className="gesture-debug-row">
            <span className="gesture-debug-label">Fist Detected</span>
            <span className="gesture-debug-value">{detection.fistDetected ? 'YES' : 'NO'}</span>
          </div>
          <div className="gesture-debug-row">
            <span className="gesture-debug-label">Charge</span>
            <span className="gesture-debug-value">{detection.state === 'CHARGING' ? `${Math.round(detection.confidence * 100)}%` : detection.active ? '100%' : '0%'}</span>
          </div>
          <div className="gesture-debug-row">
            <span className="gesture-debug-label">Position</span>
            <span className="gesture-debug-value">x: {detection.palmPosition ? detection.palmPosition.x.toFixed(2) : '-'} y: {detection.palmPosition ? detection.palmPosition.y.toFixed(2) : '-'}</span>
          </div>
          <div className="gesture-debug-row">
            <span className="gesture-debug-label">Scale</span>
            <span className="gesture-debug-value">{detection.handScale.toFixed(3)}</span>
          </div>
          <div className="gesture-debug-row">
            <span className="gesture-debug-label">Hand Visible</span>
            <span className="gesture-debug-value">{detection.handVisible ? 'yes' : 'no'}</span>
          </div>
        </div>
      ))}
    </section>
  )
}
