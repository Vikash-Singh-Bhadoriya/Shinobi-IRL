/**
 * analytics.ts
 *
 * Thin abstraction over PostHog.  All event calls in the app go through
 * this module so the provider can be swapped or disabled without touching
 * product code.
 *
 * PRIVACY CONTRACT (enforced here, never in calling code):
 *   - No camera frames, screenshots, video, or audio
 *   - No hand landmarks or biometric data
 *   - No names, emails, passwords, or precise location
 *   - Only an anonymous random session_id per page load
 *   - PostHog is configured with person_profiles: 'never' to prevent
 *     any persistent cross-session identity graph
 *
 * SAFETY CONTRACT:
 *   - Every call is wrapped in try/catch
 *   - If the API key is missing the module silently no-ops
 *   - Analytics failure never propagates to product code
 */

import posthog from 'posthog-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JutsuName = 'rasengan' | 'lightning' | 'magicCircle' | 'shadowClone'

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/** Anonymous random identifier valid for this page load only. */
const SESSION_ID = generateSessionId()

function generateSessionId(): string {
  try {
    // crypto.randomUUID is available in all modern browsers
    return crypto.randomUUID()
  } catch {
    // Fallback for environments where randomUUID is unavailable
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
}

/** Wall-clock ms when this page loaded — used for session duration. */
const SESSION_START = Date.now()

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

const POSTHOG_KEY = import.meta.env['VITE_POSTHOG_KEY'] as string | undefined
const POSTHOG_HOST = (import.meta.env['VITE_POSTHOG_HOST'] as string | undefined) ?? 'https://us.i.posthog.com'

let initialised = false

/**
 * Call once at app startup.  Safe to call multiple times — subsequent calls
 * are ignored.  If VITE_POSTHOG_KEY is missing, the whole module no-ops.
 */
export function initAnalytics(): void {
  if (initialised || !POSTHOG_KEY) return
  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Never build a persistent identity graph — fully anonymous
      person_profiles: 'never',
      // Do not auto-capture clicks/pageviews — we fire only explicit events
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      // Respect Do Not Track headers
      respect_dnt: true,
      // Disable session recording completely
      disable_session_recording: true,
    })
    initialised = true
  } catch (err) {
    // If PostHog fails to init, log in dev but never throw
    if (import.meta.env.DEV) {
      console.warn('[analytics] init failed:', err)
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function capture(event: string, properties?: Record<string, unknown>): void {
  if (!initialised) return
  try {
    posthog.capture(event, {
      session_id: SESSION_ID,
      timestamp: new Date().toISOString(),
      ...properties,
    })
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[analytics] capture failed:', event, err)
    }
  }
}

// ---------------------------------------------------------------------------
// Public event API
// ---------------------------------------------------------------------------

let sessionStartedTracked = false

/**
 * session_started — fires once when the app mounts.
 */
export function trackSessionStarted(): void {
  if (sessionStartedTracked) return
  sessionStartedTracked = true
  capture('session_started')
}

/**
 * camera_started — fires once after the camera successfully becomes ready.
 */
export function trackCameraStarted(): void {
  capture('camera_started')
}

/**
 * jutsu_activated — fires on the inactive→active edge for each jutsu.
 * Edge-triggering is the caller's responsibility (see useAnalytics.ts).
 */
export function trackJutsuActivated(jutsu: JutsuName): void {
  capture('jutsu_activated', { jutsu })
}

let sessionEndedTracked = false

/**
 * session_ended — fires on page hide / visibility hidden.
 * duration_ms is the time from page load to this call.
 */
export function trackSessionEnded(): void {
  if (sessionEndedTracked) return
  sessionEndedTracked = true
  
  const duration_ms = Date.now() - SESSION_START
  if (!initialised) return
  try {
    // PostHog queues this and uses sendBeacon automatically on unload
    posthog.capture('session_ended', {
      session_id: SESSION_ID,
      timestamp: new Date().toISOString(),
      duration_ms,
    })
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[analytics] session_ended failed:', err)
    }
  }
}

/**
 * github_clicked — fires when the user clicks the GitHub link.
 */
export function trackGitHubClicked(): void {
  capture('github_clicked')
}

/**
 * linkedin_clicked — fires when the user clicks the LinkedIn link.
 */
export function trackLinkedInClicked(): void {
  capture('linkedin_clicked')
}
