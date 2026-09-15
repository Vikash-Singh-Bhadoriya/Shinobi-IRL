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
        <span className="gesture-debug-label">Confidence</span>
        <span className="gesture-debug-value">{Math.round(result.confidence * 100)}%</span>
      </div>
    </section>
  )
}
