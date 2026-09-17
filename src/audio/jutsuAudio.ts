import type { AudioBundle } from './audioManager'
import {
  ensureAudioBundle,
  isAudioSupported,
  unlockAudio,
  setMasterVolume,
  getMasterVolume,
  attachUnlockListeners,
  detachUnlockListeners,
  disposeAudio,
} from './audioManager'

export type JutsuLoopKind = 'rasengan' | 'lightning' | 'magicCircle'

interface LoopAudio {
  kind: JutsuLoopKind
  bundle: AudioBundle
  output: GainNode
  anchoredSources: AudioScheduledSourceNode[]
  gains: GainNode[]
  startedSince: number
  stopped: boolean
}

const MIN_REASONABLE_GAIN = 0.0001
const OUTPUT_FADE_SECONDS = 0.28
const OUTPUT_SETTLE_GAP_SECONDS = 0.1
const NOISE_BUFFER_SECONDS = 2
const NOISE_BUFFER_LOOPING = true
const RASENGAN_LOOP_SUB_BASE = 80
const RASENGAN_LOOP_SUB_DETUNE = 8
const RASENGAN_LOOP_MID_FREQUENCY = 160
const RASENGAN_LOOP_MID_DETUNE = -6
const RASENGAN_LOOP_SHIMMER_FREQUENCY = 240
const RASENGAN_LOOP_NOISE_BANDPASS = 700
const RASENGAN_LOOP_NOISE_Q = 2.0
const RASENGAN_LOOP_NOISE_LEVEL = 0.08
const RASENGAN_LOOP_GAIN_PEAK = 0.18
const RASENGAN_LOOP_LFO_RATE = 0.5
const RASENGAN_LOOP_LFO_DEPTH = 0.06
const RASENGAN_LOOP_PULSE_RATE = 7
const RASENGAN_LOOP_PULSE_DEPTH = 0.035
const LIGHTNING_LOOP_BUZZ_BASE = 128
const LIGHTNING_LOOP_BUZZ_DETUNE = 14
const LIGHTNING_LOOP_BUZZ_TWO_FREQUENCY = 278
const LIGHTNING_LOOP_HARMLESS_Q = 0.9
const LIGHTNING_LOOP_BANDPASS_FREQUENCY = 2100
const LIGHTNING_LOOP_BANDPASS_Q = 40
const LIGHTNING_LOOP_NOISE_GAIN_PEAK = 0.05
const LIGHTNING_LOOP_GAIN_PEAK = 0.1
const LIGHTNING_LOOP_SPURT_AMOUNT = 0.09
const MAGIC_CIRCLE_LOOP_DRONE_FREQUENCY = 228
const MAGIC_CIRCLE_LOOP_DRONE_DETUNE = 9
const MAGIC_CIRCLE_LOOP_SUB_TONE_FREQUENCY = 344
const MAGIC_CIRCLE_LOOP_GAIN_PEAK = 0.05
const MAGIC_CIRCLE_LOOP_SHINE_AMOUNT = 0.026
const MAGIC_CIRCLE_LOOP_SHINE_RATE = 0.22

let loopsByKind = new Map<JutsuLoopKind, LoopAudio>()
let noiseBufferByRate = new Map<number, AudioBuffer>()
let rasenganOneShotInFlight = 0
let lightningOneShotInFlight = 0
let magicCircleOneShotInFlight = 0

function boundedNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function renderNoiseBuffer(context: AudioContext): AudioBuffer {
  const existing = noiseBufferByRate.get(context.sampleRate)
  if (existing) return existing
  const frames = Math.floor(context.sampleRate * NOISE_BUFFER_SECONDS)
  const buffer = context.createBuffer(1, frames, context.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = Math.random() * 2 - 1
  }
  noiseBufferByRate.set(context.sampleRate, buffer)
  return buffer
}

function clampToGainValue(peak: number): number {
  return Math.max(MIN_REASONABLE_GAIN, Math.min(1, peak))
}

function scheduleGainEnvelope(
  gain: GainNode,
  startAt: number,
  peak: number,
  attackSeconds: number,
  holdSeconds: number,
  releaseSeconds: number,
): void {
  const safePeak = clampToGainValue(peak)
  const releaseAt = startAt + attackSeconds + holdSeconds + releaseSeconds
  try {
    const param = gain.gain
    param.cancelScheduledValues(startAt)
    param.setValueAtTime(MIN_REASONABLE_GAIN, startAt)
    param.exponentialRampToValueAtTime(safePeak, startAt + attackSeconds)
    param.setValueAtTime(safePeak, startAt + attackSeconds + holdSeconds)
    param.exponentialRampToValueAtTime(MIN_REASONABLE_GAIN, releaseAt)
  } catch {
    /* audio must never break the app */
  }
}

function scheduleToneOneShot(
  bundle: AudioBundle,
  type: OscillatorType,
  fromFrequency: number,
  toFrequency: number,
  peak: number,
  attackSeconds: number,
  holdSeconds: number,
  releaseSeconds: number,
  delaySeconds: number,
): void {
  try {
    const { context, master } = bundle
    const now = context.currentTime
    const startAt = now + Math.max(0, delaySeconds)
    const oscillator = context.createOscillator()
    oscillator.type = type
    const startFrequency = Math.max(20, boundedNumber(fromFrequency))
    const endFrequency = Math.max(20, boundedNumber(toFrequency))
    oscillator.frequency.setValueAtTime(startFrequency, startAt)
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startAt + attackSeconds)
    const gain = context.createGain()
    scheduleGainEnvelope(gain, startAt, peak, attackSeconds, holdSeconds, releaseSeconds)
    oscillator.connect(gain)
    gain.connect(master)
    const duration = attackSeconds + holdSeconds + releaseSeconds + 0.06
    oscillator.start(startAt)
    oscillator.stop(startAt + duration)
    oscillator.onended = () => {
      try {
        oscillator.disconnect()
        gain.disconnect()
      } catch {
        /* audio must never break the app */
      }
    }
  } catch {
    /* audio must never break the app */
  }
}

function scheduleNoiseOneShot(
  bundle: AudioBundle,
  type: BiquadFilterType,
  filterFrequency: number,
  filterQ: number,
  peak: number,
  attackSeconds: number,
  holdSeconds: number,
  releaseSeconds: number,
  delaySeconds: number,
): void {
  try {
    const { context, master } = bundle
    const now = context.currentTime
    const startAt = now + Math.max(0, delaySeconds)
    const source = context.createBufferSource()
    source.buffer = renderNoiseBuffer(context)
    source.loop = NOISE_BUFFER_LOOPING
    const filter = context.createBiquadFilter()
    filter.type = type
    filter.frequency.value = Math.max(40, boundedNumber(filterFrequency))
    filter.Q.value = Math.max(0.1, boundedNumber(filterQ))
    const gain = context.createGain()
    scheduleGainEnvelope(gain, startAt, peak, attackSeconds, holdSeconds, releaseSeconds)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    const duration = attackSeconds + holdSeconds + releaseSeconds + 0.06
    source.start(startAt)
    source.stop(startAt + duration)
    source.onended = () => {
      try {
        source.disconnect()
        filter.disconnect()
        gain.disconnect()
      } catch {
        /* audio must never break the app */
      }
    }
  } catch {
    /* audio must never break the app */
  }
}

function fadeOutAndRelease(loop: LoopAudio): void {
  if (loop.stopped) return
  loop.stopped = true
  try {
    const { context } = loop.bundle
    const now = context.currentTime
    const gain = loop.output.gain
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(Math.max(MIN_REASONABLE_GAIN, gain.value), now)
    gain.exponentialRampToValueAtTime(MIN_REASONABLE_GAIN, now + OUTPUT_FADE_SECONDS)
    const stopAt = now + OUTPUT_FADE_SECONDS + OUTPUT_SETTLE_GAP_SECONDS
    for (const source of loop.anchoredSources) {
      try {
        source.stop(stopAt)
      } catch {
        /* already stopped / never started */
      }
    }
    window.setTimeout(() => {
      loopsByKind.delete(loop.kind)
      try {
        loop.output.disconnect()
      } catch {
        /* audio must never break the app */
      }
    }, Math.ceil((OUTPUT_FADE_SECONDS + OUTPUT_SETTLE_GAP_SECONDS) * 1000) + 40)
  } catch {
    /* audio must never break the app */
  }
}

function buildLoopOutput(bundle: AudioBundle): GainNode {
  const output = bundle.context.createGain()
  output.gain.value = MIN_REASONABLE_GAIN
  output.connect(bundle.master)
  return output
}

export function playRasenganActivation(): void {
  if (rasenganOneShotInFlight >= 2) return
  rasenganOneShotInFlight += 1
  const bundle = ensureAudioBundle()
  if (!bundle) {
    return
  }
  const finish = () => {
    rasenganOneShotInFlight -= 1
  }
  try {
    // Rising sawtooth sweep — spinning energy charging up
    scheduleToneOneShot(bundle, 'sawtooth', 80, 320, 0.18, 0.09, 0.12, 0.32, 0)
    // Harmonic overtone — adds brightness and spin character
    scheduleToneOneShot(bundle, 'sine', 160, 480, 0.14, 0.07, 0.1, 0.36, 0.04)
    // Bandpass noise swell — energy texture body
    scheduleNoiseOneShot(bundle, 'bandpass', 900, 2.0, 0.16, 0.11, 0.14, 0.26, 0.02)
    // Descending settling tone — bridges into the loop
    scheduleToneOneShot(bundle, 'sine', 320, 160, 0.10, 0.12, 0.06, 0.28, 0.28)
    window.setTimeout(finish, 760)
  } catch {
    finish()
  }
}

export function playRasenganLoopStart(): void {
  if (loopsByKind.has('rasengan')) return
  const bundle = ensureAudioBundle()
  if (!bundle) return
  try {
    const { context } = bundle
    const output = buildLoopOutput(bundle)

    // Sub-bass body — gives weight and grounding
    const sub = context.createOscillator()
    sub.type = 'sawtooth'
    sub.frequency.value = RASENGAN_LOOP_SUB_BASE
    sub.detune.value = RASENGAN_LOOP_SUB_DETUNE
    sub.connect(output)

    // Mid spinning layer — primary audible body on laptop/desktop speakers
    const mid = context.createOscillator()
    mid.type = 'sawtooth'
    mid.frequency.value = RASENGAN_LOOP_MID_FREQUENCY
    mid.detune.value = RASENGAN_LOOP_MID_DETUNE
    const midGain = context.createGain()
    midGain.gain.value = 0.55
    mid.connect(midGain)
    midGain.connect(output)

    // Shimmer — sine overtone adds aura/energy haze
    const shimmer = context.createOscillator()
    shimmer.type = 'sine'
    shimmer.frequency.value = RASENGAN_LOOP_SHIMMER_FREQUENCY
    const shimmerGain = context.createGain()
    shimmerGain.gain.value = 0.3
    shimmer.connect(shimmerGain)
    shimmerGain.connect(output)

    // Bandpass-filtered noise — continuous energetic texture
    const noise = context.createBufferSource()
    noise.buffer = renderNoiseBuffer(context)
    noise.loop = NOISE_BUFFER_LOOPING
    const bandpass = context.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = RASENGAN_LOOP_NOISE_BANDPASS
    bandpass.Q.value = RASENGAN_LOOP_NOISE_Q
    const noiseGain = context.createGain()
    noiseGain.gain.value = RASENGAN_LOOP_NOISE_LEVEL
    noise.connect(bandpass)
    bandpass.connect(noiseGain)
    noiseGain.connect(output)

    // Slow LFO — overall swelling/breathing modulation
    const lfo = context.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = RASENGAN_LOOP_LFO_RATE
    const lfoGain = context.createGain()
    lfoGain.gain.value = RASENGAN_LOOP_LFO_DEPTH
    lfo.connect(lfoGain)
    lfoGain.connect(output.gain)

    // Fast pulse — spinning/rotating character
    const pulse = context.createOscillator()
    pulse.type = 'sine'
    pulse.frequency.value = RASENGAN_LOOP_PULSE_RATE
    const pulseGain = context.createGain()
    pulseGain.gain.value = RASENGAN_LOOP_PULSE_DEPTH
    pulse.connect(pulseGain)
    pulseGain.connect(output.gain)

    const now = context.currentTime
    output.gain.setValueAtTime(MIN_REASONABLE_GAIN, now)
    output.gain.exponentialRampToValueAtTime(RASENGAN_LOOP_GAIN_PEAK, now + OUTPUT_FADE_SECONDS)

    sub.start(now)
    mid.start(now)
    shimmer.start(now)
    noise.start(now)
    lfo.start(now)
    pulse.start(now)

    loopsByKind.set('rasengan', {
      kind: 'rasengan',
      bundle,
      output,
      anchoredSources: [sub, mid, shimmer, noise, lfo, pulse],
      gains: [midGain, shimmerGain, noiseGain, lfoGain, pulseGain],
      startedSince: now,
      stopped: false,
    })
  } catch {
    /* audio must never break the app */
  }
}

export function playRasenganLoopStop(): void {
  const loop = loopsByKind.get('rasengan')
  if (loop) fadeOutAndRelease(loop)
}

export function playLightningStrike(): void {
  if (lightningOneShotInFlight >= 2) return
  lightningOneShotInFlight += 1
  const bundle = ensureAudioBundle()
  if (!bundle) {
    return
  }
  const finish = () => {
    lightningOneShotInFlight -= 1
  }
  try {
    scheduleNoiseOneShot(bundle, 'highpass', 3000, 0.6, 0.4, 0.008, 0.02, 0.16, 0)
    scheduleToneOneShot(bundle, 'square', 2400, 1200, 0.2, 0.008, 0.02, 0.1, 0)
    scheduleToneOneShot(bundle, 'sawtooth', 700, 180, 0.14, 0.03, 0.02, 0.2, 0.04)
    window.setTimeout(finish, 400)
  } catch {
    finish()
  }
}

export function playLightningLoopStart(): void {
  if (loopsByKind.has('lightning')) return
  const bundle = ensureAudioBundle()
  if (!bundle) return
  try {
    const { context } = bundle
    const output = buildLoopOutput(bundle)
    const buzz = context.createOscillator()
    buzz.type = 'sawtooth'
    buzz.frequency.value = LIGHTNING_LOOP_BUZZ_BASE
    buzz.detune.value = LIGHTNING_LOOP_BUZZ_DETUNE
    const buzzTwo = context.createOscillator()
    buzzTwo.type = 'sawtooth'
    buzzTwo.frequency.value = LIGHTNING_LOOP_BUZZ_TWO_FREQUENCY
    const lowpass = context.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 1600
    lowpass.Q.value = LIGHTNING_LOOP_HARMLESS_Q
    buzz.connect(lowpass)
    buzzTwo.connect(lowpass)
    lowpass.connect(output)
    const noise = context.createBufferSource()
    noise.buffer = renderNoiseBuffer(context)
    noise.loop = NOISE_BUFFER_LOOPING
    const bandpass = context.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = LIGHTNING_LOOP_BANDPASS_FREQUENCY
    bandpass.Q.value = LIGHTNING_LOOP_BANDPASS_Q
    const noiseGain = context.createGain()
    noiseGain.gain.value = LIGHTNING_LOOP_NOISE_GAIN_PEAK
    noise.connect(bandpass)
    bandpass.connect(noiseGain)
    noiseGain.connect(output)
    const spurt = context.createOscillator()
    spurt.type = 'sine'
    spurt.frequency.value = 33
    const spurtGain = context.createGain()
    spurtGain.gain.value = LIGHTNING_LOOP_SPURT_AMOUNT
    spurt.connect(spurtGain)
    spurtGain.connect(output.gain)
    const now = context.currentTime
    output.gain.setValueAtTime(MIN_REASONABLE_GAIN, now)
    output.gain.exponentialRampToValueAtTime(LIGHTNING_LOOP_GAIN_PEAK, now + OUTPUT_FADE_SECONDS)
    buzz.start(now)
    buzzTwo.start(now)
    noise.start(now)
    spurt.start(now)
    loopsByKind.set('lightning', {
      kind: 'lightning',
      bundle,
      output,
      anchoredSources: [buzz, buzzTwo, noise, spurt],
      gains: [noiseGain, spurtGain],
      startedSince: now,
      stopped: false,
    })
  } catch {
    /* audio must never break the app */
  }
}

export function playLightningLoopStop(): void {
  const loop = loopsByKind.get('lightning')
  if (loop) fadeOutAndRelease(loop)
}

export function playMagicCircleActivation(): void {
  if (magicCircleOneShotInFlight >= 1) return
  magicCircleOneShotInFlight += 1
  const bundle = ensureAudioBundle()
  if (!bundle) {
    return
  }
  const finish = () => {
    magicCircleOneShotInFlight -= 1
  }
  try {
    // Warm rising tone — starts at loop drone frequency, no click (attack 0.10s)
    scheduleToneOneShot(bundle, 'sine', 228, 456, 0.10, 0.10, 0.10, 0.38, 0)
    // Shimmer overtone — adds magical harmonic above
    scheduleToneOneShot(bundle, 'sine', 456, 912, 0.07, 0.12, 0.06, 0.34, 0.08)
    // Soft bandpass texture — gentle energy without harsh spike
    scheduleNoiseOneShot(bundle, 'bandpass', 1600, 3.0, 0.04, 0.14, 0.06, 0.24, 0.12)
    window.setTimeout(finish, 840)
  } catch {
    finish()
  }
}

export function playMagicCircleLoopStart(): void {
  if (loopsByKind.has('magicCircle')) return
  const bundle = ensureAudioBundle()
  if (!bundle) return
  try {
    const { context } = bundle
    const output = buildLoopOutput(bundle)
    const drone = context.createOscillator()
    drone.type = 'sine'
    drone.frequency.value = MAGIC_CIRCLE_LOOP_DRONE_FREQUENCY
    drone.detune.value = MAGIC_CIRCLE_LOOP_DRONE_DETUNE
    const subTone = context.createOscillator()
    subTone.type = 'sine'
    subTone.frequency.value = MAGIC_CIRCLE_LOOP_SUB_TONE_FREQUENCY
    drone.connect(output)
    subTone.connect(output)
    const shine = context.createOscillator()
    shine.type = 'sine'
    shine.frequency.value = MAGIC_CIRCLE_LOOP_SHINE_RATE
    const shineGain = context.createGain()
    shineGain.gain.value = MAGIC_CIRCLE_LOOP_SHINE_AMOUNT
    shine.connect(shineGain)
    shineGain.connect(output.gain)
    const now = context.currentTime
    output.gain.setValueAtTime(MIN_REASONABLE_GAIN, now)
    output.gain.exponentialRampToValueAtTime(MAGIC_CIRCLE_LOOP_GAIN_PEAK, now + OUTPUT_FADE_SECONDS)
    drone.start(now)
    subTone.start(now)
    shine.start(now)
    loopsByKind.set('magicCircle', {
      kind: 'magicCircle',
      bundle,
      output,
      anchoredSources: [drone, subTone, shine],
      gains: [shineGain],
      startedSince: now,
      stopped: false,
    })
  } catch {
    /* audio must never break the app */
  }
}

export function playMagicCircleLoopStop(): void {
  const loop = loopsByKind.get('magicCircle')
  if (loop) fadeOutAndRelease(loop)
}

export function playShadowCloneSpawn(): void {
  const bundle = ensureAudioBundle()
  if (!bundle) return
  try {
    scheduleNoiseOneShot(bundle, 'bandpass', 900, 1.1, 0.26, 0.12, 0.05, 0.34, 0)
    scheduleToneOneShot(bundle, 'triangle', 200, 64, 0.24, 0.05, 0.05, 0.26, 0.02)
    scheduleToneOneShot(bundle, 'sine', 520, 380, 0.16, 0.02, 0.03, 0.2, 0.22)
  } catch {
    /* audio must never break the app */
  }
}

export function ensureAudioActive(): void {
  unlockAudio()
}

export function attachJutsuUnlockListeners(): void {
  attachUnlockListeners()
}

export function detachJutsuUnlockListeners(): void {
  detachUnlockListeners()
}

export function disposeJutsuAudio(): void {
  for (const loop of loopsByKind.values()) fadeOutAndRelease(loop)
  loopsByKind.clear()
  noiseBufferByRate.clear()
  disposeAudio()
}

export function isJutsuAudioAvailable(): boolean {
  return isAudioSupported()
}

export function setJutsuMasterVolume(next: number): void {
  setMasterVolume(next)
}

export function getJutsuMasterVolume(): number {
  return getMasterVolume()
}

export { ensureAudioBundle }
