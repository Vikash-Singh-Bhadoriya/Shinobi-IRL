import { trackGitHubClicked, trackLinkedInClicked } from '../analytics/analytics'
import { GestureGuide } from './GestureGuide'

export interface SettingsPanelProps {
  onClose: () => void
  showOnStartup: boolean
  onToggleShowOnStartup: () => void
  onShowTutorial: () => void
}

const DEMO_URL = '' // Configure demo video URL here when available

export function SettingsPanel({
  onClose,
  showOnStartup,
  onToggleShowOnStartup,
  onShowTutorial,
}: SettingsPanelProps) {
  return (
    <>
      <div className="settings-panel-overlay" onClick={onClose} aria-hidden="true" />
      <div className="settings-panel" role="dialog" aria-label="Settings">
        <header className="settings-header">
          <h2>⚙ Settings</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </header>

        <section className="settings-section">
          <h3 className="settings-section-title">How To Use</h3>
          <GestureGuide />
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">Onboarding</h3>
          <div className="settings-toggle-row">
            <span>Show on startup</span>
            <button
              className={`toggle-btn ${showOnStartup ? 'is-on' : 'is-off'}`}
              onClick={onToggleShowOnStartup}
              aria-pressed={showOnStartup}
            >
              [{showOnStartup ? ' ON ' : ' OFF '}]
            </button>
          </div>
          <button className="action-btn" onClick={onShowTutorial}>
            ▶ Show tutorial now
          </button>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">Demo</h3>
          {DEMO_URL ? (
            <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="action-btn" style={{ textDecoration: 'none' }}>
              ▶ Watch Demo
            </a>
          ) : (
            <button className="action-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
              ▶ Demo Coming Soon
            </button>
          )}
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">Links</h3>
          <div className="settings-links">
            <a href="https://github.com/Vikash-Singh-Bhadoriya/Shinobi-IRL" target="_blank" rel="noopener noreferrer" className="settings-link" onClick={trackGitHubClicked}>
              GitHub
            </a>
            <a href="https://www.linkedin.com/in/mrvikashsingh/" target="_blank" rel="noopener noreferrer" className="settings-link" onClick={trackLinkedInClicked}>
              LinkedIn
            </a>
          </div>
        </section>
      </div>
    </>
  )
}
