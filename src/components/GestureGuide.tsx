export interface GestureConfig {
  id: string
  name: string
  icon: string
  description: string
  visualUrl: string | null
}

export const GESTURES: GestureConfig[] = [
  {
    id: 'magic-circle',
    name: 'Magic Circle',
    icon: '✨',
    description: 'Open palm',
    visualUrl: null, // Placeholder for future visual asset
  },
  {
    id: 'rasengan',
    name: 'Rasengan',
    icon: '🌀',
    description: 'Open palm + move in circle',
    visualUrl: null,
  },
  {
    id: 'lightning',
    name: 'Lightning',
    icon: '⚡',
    description: 'Fist',
    visualUrl: null,
  },
  {
    id: 'shadow-clone',
    name: 'Shadow Clone',
    icon: '👥',
    description: 'Cross hands (index & middle up)',
    visualUrl: null,
  },
]

export function GestureGuide() {
  return (
    <div className="gesture-guide">
      {GESTURES.map((gesture) => (
        <div key={gesture.id} className="gesture-row">
          <div className="gesture-icon" aria-hidden="true">{gesture.icon}</div>
          <div className="gesture-info">
            <span className="gesture-desc">{gesture.description}</span>
            <span className="gesture-name">{gesture.name}</span>
          </div>
          {gesture.visualUrl && (
            <div className="gesture-visual">
              {/* Future visual integration goes here */}
              <img src={gesture.visualUrl} alt={`How to perform ${gesture.name}`} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
