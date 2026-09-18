import { GestureGuide } from './GestureGuide'

export interface OnboardingOverlayProps {
  onDismiss: () => void
}

export function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <h2 className="onboarding-title">SHINOBI IRL</h2>
        <p className="onboarding-desc">Show your hands to the camera.</p>
        
        <GestureGuide />

        <button className="btn onboarding-btn" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </div>
  )
}
