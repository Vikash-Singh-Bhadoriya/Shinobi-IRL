import type { MagicCircleDetection } from './magicCircleTypes'

interface MagicCircleDebugPanelProps {
  result: MagicCircleDetection
}

export function MagicCircleDebugPanel({ result }: MagicCircleDebugPanelProps) {
  return (
    <section className="magic-circle-debug" aria-label="Magic Circle analysis">
      <h2 className="gesture-debug-title">Magic Circle Analysis</h2>
      <div className={`gesture-state gesture-state-${result.state.toLowerCase()}`}>
        {result.state}
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
        <span className="gesture-debug-value">{Math.round((result.rotation * 180) / Math.PI)} deg</span>
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
