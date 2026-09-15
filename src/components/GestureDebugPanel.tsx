import type { GestureResult, HandGestureDebug } from '../types/gesture'

interface GestureDebugPanelProps {
  result: GestureResult
}

interface HandCardProps {
  title: string
  hand: HandGestureDebug | null
}

function FingerRow({ label, ok }: { label: string; ok: boolean | undefined }) {
  return (
    <div className="finger-row">
      <span className="finger-row-label">{label}</span>
      <span className={`finger-row-mark ${ok ? 'is-ok' : 'is-fail'}`}>{ok ? '✅' : '❌'}</span>
    </div>
  )
}

function HandCard({ title, hand }: HandCardProps) {
  return (
    <div className="hand-card">
      <h3 className="hand-card-title">{title}</h3>
      {hand ? (
        <div className="finger-list">
          <FingerRow label="Index" ok={hand.fingers.index} />
          <FingerRow label="Middle" ok={hand.fingers.middle} />
          <FingerRow label="Ring" ok={hand.fingers.ring} />
          <FingerRow label="Pinky" ok={hand.fingers.pinky} />
          <div className="finger-row">
            <span className="finger-row-label">Angle</span>
            <span className="finger-row-mark">{Math.round(hand.angleDeg)}°</span>
          </div>
        </div>
      ) : (
        <p className="hand-card-empty">Not detected</p>
      )}
    </div>
  )
}

export function GestureDebugPanel({ result }: GestureDebugPanelProps) {
  const stabilityProgress = Math.min(
    100,
    Math.round((result.debug.stabilityElapsedMs / 500) * 100),
  )

  return (
    <section className="gesture-debug" aria-label="Shadow clone analysis">
      <h2 className="gesture-debug-title">Shadow Clone Analysis</h2>

      <div className="gesture-debug-grid">
        <HandCard title="Left Hand" hand={result.debug.left} />
        <HandCard title="Right Hand" hand={result.debug.right} />
      </div>

      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Orientation</span>
        <span className="gesture-debug-value">
          Left: {result.debug.left?.orientation ?? '—'} · Right:{' '}
          {result.debug.right?.orientation ?? '—'}
        </span>
      </div>

      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Confidence</span>
        <span className="gesture-debug-value">{Math.round(result.confidence * 100)}%</span>
      </div>

      <div className="gesture-debug-row">
        <span className="gesture-debug-label">Stability</span>
        <span className="gesture-debug-value">{stabilityProgress}%</span>
      </div>

      <div className={`gesture-detection-badge ${result.detected ? 'is-ready' : ''}`}>
        {result.detected ? 'READY' : 'NOT READY'}
      </div>
    </section>
  )
}