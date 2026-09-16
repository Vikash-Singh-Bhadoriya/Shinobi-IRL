import type { RasenganDetection } from '../jutsu/rasengan/rasenganTypes'

interface RasenganDebugPanelProps {
  result: RasenganDetection
}

export function RasenganDebugPanel({ result }: RasenganDebugPanelProps) {
  return (
    <section className="rasengan-debug" aria-label="Rasengan analysis">
      <h2 className="gesture-debug-title">Rasengan Analysis</h2>
      <div className={`gesture-state gesture-state-${result.state.toLowerCase()}`}>
        {result.state}
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Palm Open</span>
        <span className="gesture-debug-value">{result.palmOpen ? 'YES' : 'NO'}</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Circular Motion</span>
        <span className="gesture-debug-value">{result.circularMotion ? 'YES' : 'NO'}</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Release Detected</span>
        <span className="gesture-debug-value">{result.throwDetected ? 'YES' : 'NO'}</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Velocity</span>
        <span className="gesture-debug-value">{result.velocity.magnitude.toFixed(4)}</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Acceleration</span>
        <span className="gesture-debug-value">{result.acceleration.toFixed(2)}</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Deceleration</span>
        <span className="gesture-debug-value">{(result.deceleration ?? 0).toFixed(2)}</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Hand Scale</span>
        <span className="gesture-debug-value">{result.handScale.toFixed(3)}</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Palm Position</span>
        <span className="gesture-debug-value">
          x: {result.palmPosition ? result.palmPosition.x.toFixed(2) : '-'} y:{' '}
          {result.palmPosition ? result.palmPosition.y.toFixed(2) : '-'}
        </span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Circle Confidence</span>
        <span className="gesture-debug-value">{Math.round(result.circleConfidence * 100)}%</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Activation Confidence</span>
        <span className="gesture-debug-value">{Math.round(result.activationConfidence * 100)}%</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Throw Confidence</span>
        <span className="gesture-debug-value">{Math.round(result.throwConfidence * 100)}%</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Hand Visible</span>
        <span className="gesture-debug-value">{result.handVisible ? 'YES' : 'NO'}</span>
      </div>
      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Projectile Position</span>
        <span className="gesture-debug-value">
          x: {result.projectilePosition ? result.projectilePosition.x.toFixed(2) : '-'} y:{' '}
          {result.projectilePosition ? result.projectilePosition.y.toFixed(2) : '-'}
        </span>
      </div>
    </section>
  )
}
