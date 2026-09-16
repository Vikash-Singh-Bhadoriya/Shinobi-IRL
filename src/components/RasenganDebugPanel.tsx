import type { RasenganInstance } from '../jutsu/rasengan/rasenganTypes'

interface RasenganDebugPanelProps {
  result: RasenganInstance[]
}

export function RasenganDebugPanel({ result }: RasenganDebugPanelProps) {
  const activeCount = result.filter(({ detection }) => detection.active).length
  return (
    <section className="rasengan-debug" aria-label="Rasengan analysis">
      <h2 className="gesture-debug-title">Rasengan Analysis</h2>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Active Rasengans</span>
        <span className="gesture-debug-value">{activeCount}</span>
      </div>
      {result.map(({ hand, color, detection }) => (
        <div key={hand}>
          <div className={`gesture-state gesture-state-${detection.state.toLowerCase()}`} style={{ color }}>
            {hand.toUpperCase()}: {detection.state}
          </div>
          <div className="gesture-debug-row"><span className="gesture-debug-label">Position</span><span className="gesture-debug-value">x: {detection.palmPosition ? detection.palmPosition.x.toFixed(2) : '-'} y: {detection.palmPosition ? detection.palmPosition.y.toFixed(2) : '-'}</span></div>
          <div className="gesture-debug-row"><span className="gesture-debug-label">Scale</span><span className="gesture-debug-value">{detection.handScale.toFixed(3)}</span></div>
        </div>
      ))}
    </section>
  )
}
