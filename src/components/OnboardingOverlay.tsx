export interface OnboardingOverlayProps {
  onDismiss: () => void
}

export function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <h2 className="onboarding-title">SHINOBI IRL</h2>
        <p className="onboarding-desc">Show your hands to the camera.</p>
        
        <div className="onboarding-legend">
          <div className="legend-row"><span>✨</span> <span>Open palm</span> <span>→</span> <span>Magic Circle</span></div>
          <div className="legend-row"><span>🌀</span> <span>Circular hand</span> <span>→</span> <span>Rasengan</span></div>
          <div className="legend-row"><span>⚡</span> <span>Fist</span> <span>→</span> <span>Lightning</span></div>
          <div className="legend-row"><span>👥</span> <span>Two hands</span> <span>→</span> <span>Shadow Clone</span></div>
        </div>

        <button className="btn onboarding-btn" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </div>
  )
}
