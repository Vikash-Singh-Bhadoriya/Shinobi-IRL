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
          <div className="gesture-debug-row"><span className="gesture-debug-label">Pinch</span><span className="gesture-debug-value">{detection.pinchDetected ? 'YES' : 'NO'} ({detection.pinchDistance.toFixed(2)} / {detection.pinchThreshold.toFixed(2)})</span></div>
          <div className="gesture-debug-row"><span className="gesture-debug-label">Velocity / Previous</span><span className="gesture-debug-value">{detection.velocity.magnitude.toFixed(3)} / {detection.previousVelocity.toFixed(3)}</span></div>
          <div className="gesture-debug-row"><span className="gesture-debug-label">Deceleration</span><span className="gesture-debug-value">{(detection.deceleration ?? 0).toFixed(3)}</span></div>
          <div className="gesture-debug-row"><span className="gesture-debug-label">Throw Confidence</span><span className="gesture-debug-value">{detection.throwConfidence.toFixed(3)}</span></div>
          <div className="gesture-debug-row"><span className="gesture-debug-label">Hand Open / Visible</span><span className="gesture-debug-value">{detection.palmOpen ? 'yes' : 'no'} / {detection.handVisible ? 'yes' : 'no'}</span></div>
          <div className="gesture-debug-row"><span className="gesture-debug-label">Throw Condition</span><span className="gesture-debug-value">{detection.throwCondition ? 'true' : 'false'}</span></div>
          <div className="gesture-debug-row"><span className="gesture-debug-label">Projectile / Progress</span><span className="gesture-debug-value">{detection.projectilePosition ? 'active' : 'none'} / {detection.projectileProgress.toFixed(2)}</span></div>
        </div>
      ))}
    </section>
  )
}
