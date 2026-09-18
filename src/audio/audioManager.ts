interface WindowWithWebkitAudio extends Window {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

export interface AudioBundle {
  context: AudioContext
  master: GainNode
}

const MASTER_RAMP_SECONDS = 0.05
const DEFAULT_VOLUME = 0.7
const MASTER_EXPONENT = 1.4
const MIN_GAIN_VALUE = 0.0001
const UNLOCK_EVENTS: Array<keyof WindowEventMap> = [
  'pointerdown',
  'keydown',
  'touchstart',
  'pointerup',
]

let audioBundle: AudioBundle | null = null
let masterVolumeValue = DEFAULT_VOLUME
let unlockHandler: (() => void) | null = null

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function audioContextForWindow(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const win = window as unknown as WindowWithWebkitAudio
  return win.AudioContext ?? win.webkitAudioContext ?? null
}

function buildMasterGainValue(): number {
  const clamped = clamp01(masterVolumeValue)
  if (clamped <= 0) return MIN_GAIN_VALUE
  return Math.pow(clamped, MASTER_EXPONENT)
}

function buildAudioBundle(): AudioBundle | null {
  const Ctor = audioContextForWindow()
  if (!Ctor) return null
  try {
    const context = new Ctor()
    const master = context.createGain()
    master.gain.value = buildMasterGainValue()
    master.connect(context.destination)
    audioBundle = { context, master }
    void context.resume().catch(() => {})
  } catch {
    audioBundle = null
  }
  return audioBundle
}

export function isAudioSupported(): boolean {
  if (typeof window === 'undefined') return false
  const win = window as WindowWithWebkitAudio
  return Boolean(win.AudioContext ?? win.webkitAudioContext)
}

export function unlockAudio(): void {
  if (!audioBundle) return
  try {
    if (audioBundle.context.state !== 'running') {
      void audioBundle.context.resume().catch(() => {})
    }
  } catch {
    /* audio must never break the app */
  }
}

export function ensureAudioBundle(): AudioBundle | null {
  if (audioBundle) return audioBundle
  return buildAudioBundle()
}

export function setMasterVolume(next: number): void {
  masterVolumeValue = clamp01(next)
  if (!audioBundle) return
  try {
    const now = audioBundle.context.currentTime
    audioBundle.master.gain.cancelScheduledValues(now)
    audioBundle.master.gain.setTargetAtTime(buildMasterGainValue(), now, MASTER_RAMP_SECONDS)
  } catch {
    /* audio must never break the app */
  }
}

export function getMasterVolume(): number {
  return masterVolumeValue
}

function handleUnlockEvent(): void {
  unlockAudio()
  if (unlockHandler) {
    const handler = unlockHandler
    unlockHandler = null
    for (const eventName of UNLOCK_EVENTS) {
      window.removeEventListener(eventName, handler)
    }
  }
}

export function attachUnlockListeners(): void {
  if (unlockHandler || !isAudioSupported()) return
  const handler = () => handleUnlockEvent()
  unlockHandler = handler
  for (const eventName of UNLOCK_EVENTS) {
    window.addEventListener(eventName, handler)
  }
}

export function detachUnlockListeners(): void {
  if (!unlockHandler) return
  const handler = unlockHandler
  unlockHandler = null
  for (const eventName of UNLOCK_EVENTS) {
    window.removeEventListener(eventName, handler)
  }
}

export function disposeAudio(): void {
  detachUnlockListeners()
  if (!audioBundle) return
  try {
    void audioBundle.context.close().catch(() => {})
  } catch {
    /* audio must never break the app */
  }
  audioBundle = null
}

