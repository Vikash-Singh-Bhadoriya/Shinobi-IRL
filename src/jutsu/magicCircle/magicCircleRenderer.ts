import type {
  MagicCircleDetection,
  MagicCircleRenderStats,
  MagicCircleVisualState,
} from './magicCircleTypes'

interface Rgb {
  r: number
  g: number
  b: number
}

interface MagicCirclePalette {
  primary: Rgb
  secondary: Rgb
}

interface Particle {
  angle: number
  radius: number
  speed: number
  size: number
  phase: number
  tint: number
}

interface ArcTrail {
  phase: number
  speed: number
  radius: number
  span: number
  tint: number
}

const PARTICLE_COUNT = 120
const LAYER_COUNT = 5
const CHARGE_MS = 850
const TAU = Math.PI * 2
const PALETTE_TRANSITION_DURATION = 6500
const WHITE: Rgb = { r: 255, g: 250, b: 245 }
const PALETTES: MagicCirclePalette[] = [
  { primary: hexToRgb('#7b5cf7'), secondary: hexToRgb('#f3c96a') },
  { primary: hexToRgb('#3b82f6'), secondary: hexToRgb('#f472b6') },
  { primary: hexToRgb('#38d4ff'), secondary: hexToRgb('#7c6dff') },
  { primary: hexToRgb('#1ec6b8'), secondary: hexToRgb('#4f9bff') },
  { primary: hexToRgb('#ff9d5c'), secondary: hexToRgb('#ff7ac6') },
  { primary: hexToRgb('#2e5eff'), secondary: hexToRgb('#d95cff') },
]

function hexToRgb(hex: string): Rgb {
  const cleanHex = hex.replace('#', '')
  const normalizedHex = cleanHex.length === 3 ? cleanHex.split('').map((value) => value + value).join('') : cleanHex
  const numericValue = Number.parseInt(normalizedHex, 16)
  return {
    r: (numericValue >> 16) & 255,
    g: (numericValue >> 8) & 255,
    b: numericValue & 255,
  }
}

function mixColor(a: Rgb, b: Rgb, amount: number): Rgb {
  const progress = Math.max(0, Math.min(1, amount))
  return {
    r: Math.round(a.r + (b.r - a.r) * progress),
    g: Math.round(a.g + (b.g - a.g) * progress),
    b: Math.round(a.b + (b.b - a.b) * progress),
  }
}

function colorWithAlpha(color: Rgb, alpha: number): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}

function easeInOutSine(value: number): number {
  return -(Math.cos(Math.PI * value) - 1) / 2
}

function paletteAtTime(now: number): MagicCirclePalette {
  const cycleDuration = PALETTES.length * PALETTE_TRANSITION_DURATION
  const elapsed = ((now % cycleDuration) + cycleDuration) % cycleDuration
  const paletteIndex = Math.floor(elapsed / PALETTE_TRANSITION_DURATION)
  const fromPalette = PALETTES[paletteIndex]
  const toPalette = PALETTES[(paletteIndex + 1) % PALETTES.length]
  const localProgress = (elapsed % PALETTE_TRANSITION_DURATION) / PALETTE_TRANSITION_DURATION
  const easedProgress = easeInOutSine(localProgress)

  return {
    primary: mixColor(fromPalette.primary, toPalette.primary, easedProgress),
    secondary: mixColor(fromPalette.secondary, toPalette.secondary, easedProgress),
  }
}

function createParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    angle: (index / PARTICLE_COUNT) * TAU,
    radius: 0.78 + ((index * 19) % 100) / 300,
    speed: 0.00018 + ((index * 11) % 10) / 50000,
    size: 0.8 + ((index * 7) % 10) / 4,
    phase: index * 1.37,
    tint: index % 5 < 3 ? 0 : 1,
  }))
}

function createArcTrails(): ArcTrail[] {
  return Array.from({ length: 9 }, (_, index) => ({
    phase: index * 2.41,
    speed: 0.00045 + (index % 4) * 0.00012,
    radius: 0.58 + (index % 5) * 0.1,
    span: 0.22 + (index % 3) * 0.14,
    tint: index % 2,
  }))
}

function shortestAngleDelta(from: number, to: number): number {
  let delta = to - from
  while (delta > Math.PI) delta -= TAU
  while (delta < -Math.PI) delta += TAU
  return delta
}

export class MagicCircleRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly particles = createParticles()
  private readonly arcTrails = createArcTrails()
  private animationFrame = 0
  private latest: MagicCircleDetection | null = null
  private visibleX = 0
  private visibleY = 0
  private visibleRotation = 0
  private visibleSize = 0
  private hasVisiblePosition = false
  private activeSince = 0
  private previousX = 0
  private previousY = 0
  private energy = 0
  private fps = 60
  private lastFrameAt = 0
  private stats: MagicCircleRenderStats = {
    visualState: 'IDLE',
    energy: 0,
    layerCount: LAYER_COUNT,
    particleCount: PARTICLE_COUNT,
    rotation: 0,
    fps: 60,
  }

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Magic Circle canvas is unavailable')
    this.canvas = canvas
    this.ctx = context
    this.animationFrame = requestAnimationFrame(this.render)
  }

  setDetection(detection: MagicCircleDetection) {
    if (detection.active && !this.latest?.active) {
      this.activeSince = performance.now()
      this.energy = 0.28
    }
    this.latest = detection
  }

  getStats(): MagicCircleRenderStats {
    return this.stats
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  private render = (now: number) => {
    const delta = this.lastFrameAt ? Math.min(50, now - this.lastFrameAt) : 16.7
    this.lastFrameAt = now
    this.fps += ((1000 / Math.max(1, delta)) - this.fps) * 0.08
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width > 0 && height > 0) {
      if (this.canvas.width !== width) this.canvas.width = width
      if (this.canvas.height !== height) this.canvas.height = height
      this.ctx.clearRect(0, 0, width, height)

      const detection = this.latest
      if (detection?.palmPosition && (detection.active || detection.state === 'FADE_OUT')) {
        if (!this.hasVisiblePosition) {
          this.visibleX = detection.palmPosition.x
          this.visibleY = detection.palmPosition.y
          this.visibleRotation = detection.rotation
          this.visibleSize = detection.palmSize
          this.previousX = detection.palmPosition.x
          this.previousY = detection.palmPosition.y
          this.hasVisiblePosition = true
        }
        const movement = Math.hypot(
          detection.palmPosition.x - this.previousX,
          detection.palmPosition.y - this.previousY,
        )
        this.previousX = detection.palmPosition.x
        this.previousY = detection.palmPosition.y
        this.energy += Math.min(0.18, movement * 3.2) + (detection.active ? 0.002 : -0.02)
        this.energy = Math.max(0, Math.min(1, this.energy - (detection.active ? 0 : 0.01)))
        this.visibleX += (detection.palmPosition.x - this.visibleX) * 0.28
        this.visibleY += (detection.palmPosition.y - this.visibleY) * 0.28
        this.visibleRotation += shortestAngleDelta(this.visibleRotation, detection.rotation) * 0.28
        this.visibleSize += (detection.palmSize - this.visibleSize) * 0.2
        const fade = detection.state === 'FADE_OUT' ? 1 - detection.fadeProgress : 1
        this.drawMagicCircle(width, height, now, fade, delta)
      } else if (!detection || detection.state === 'SEARCHING') {
        this.hasVisiblePosition = false
        this.energy = Math.max(0, this.energy - 0.04)
      }
    }
    this.stats = {
      visualState: this.getVisualState(now),
      energy: this.energy,
      layerCount: LAYER_COUNT,
      particleCount: PARTICLE_COUNT,
      rotation: this.visibleRotation + now / 2800,
      fps: Math.round(this.fps),
    }
    this.animationFrame = requestAnimationFrame(this.render)
  }

  private getVisualState(now: number): MagicCircleVisualState {
    if (!this.latest?.active && this.latest?.state !== 'FADE_OUT') return 'IDLE'
    if (this.latest?.state === 'FADE_OUT') return 'RELEASE'
    return now - this.activeSince < CHARGE_MS ? 'CHARGING' : 'FULL_POWER'
  }

  private drawMagicCircle(width: number, height: number, now: number, fade: number, delta: number) {
    const scale = Math.min(width, height)
    const openness = this.latest?.openPalmConfidence ?? 0
    const radius = Math.max(30, this.visibleSize * scale * (1.35 + openness * 0.5))
    const centerX = this.visibleX * width
    const centerY = this.visibleY * height
    const charge = this.getVisualState(now) === 'CHARGING' ? Math.min(1, (now - this.activeSince) / CHARGE_MS) : 1
    const pulse = 1 + Math.sin(now / 170) * (0.025 + this.energy * 0.035)
    const rotation = this.visibleRotation + now / (3200 - this.energy * 1900)
    const glowIntensity = 0.65 + Math.sin(now / 280) * 0.2 + this.energy * 0.15
    const palette = paletteAtTime(now)
    const primaryGlow = mixColor(palette.primary, WHITE, 0.28)
    const secondaryGlow = mixColor(palette.secondary, WHITE, 0.18)
    const arcBlend = mixColor(palette.secondary, palette.primary, 0.42)

    this.ctx.save()
    this.ctx.globalAlpha = fade * (0.62 + charge * 0.38)
    this.ctx.globalCompositeOperation = 'lighter'
    this.ctx.translate(centerX, centerY)
    this.ctx.rotate(this.visibleRotation)
    this.ctx.scale(pulse, pulse)

    const glow = this.ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.8)
    glow.addColorStop(0, colorWithAlpha(primaryGlow, 0.22 * glowIntensity))
    glow.addColorStop(0.35, colorWithAlpha(mixColor(primaryGlow, secondaryGlow, 0.5), 0.14 * glowIntensity))
    glow.addColorStop(0.72, colorWithAlpha(secondaryGlow, 0.08 * glowIntensity))
    glow.addColorStop(1, colorWithAlpha(secondaryGlow, 0))
    this.ctx.fillStyle = glow
    this.ctx.beginPath()
    this.ctx.arc(0, 0, radius * 1.8, 0, TAU)
    this.ctx.fill()

    this.drawLayer(radius * 1.15, now / 9000, 0.3, 1.8, 0.92, palette.primary, palette.secondary, 0)
    this.ctx.rotate(rotation - this.visibleRotation)
    this.drawLayer(radius, now / 4200, 0.78, 1.25, 0.88, palette.secondary, palette.primary, 1)
    this.drawLayer(radius * 0.85, -now / 3000, 1, 0.9, 0.78, palette.primary, palette.secondary, 0)
    this.drawInnerPattern(radius * 0.62, now, palette)
    this.drawParticles(radius, now, delta, palette)
    this.drawArcTrails(radius, now, palette, arcBlend)
    this.drawHandInteraction(radius, now, palette)
    this.ctx.restore()
  }

  private drawLayer(
    radius: number,
    rotation: number,
    opacity: number,
    lineWidth: number,
    scale: number,
    primary: Rgb,
    secondary: Rgb,
    layerIndex: number,
  ) {
    this.ctx.save()
    this.ctx.rotate(rotation)
    this.ctx.scale(scale, scale)
    this.ctx.globalAlpha *= opacity
    this.ctx.strokeStyle = colorWithAlpha(layerIndex % 2 === 0 ? primary : secondary, opacity)
    this.ctx.lineWidth = Math.max(1, radius * 0.012 * lineWidth)
    this.ctx.setLineDash([radius * 0.08, radius * 0.035])
    this.ctx.beginPath()
    this.ctx.arc(0, 0, radius, 0, TAU)
    this.ctx.stroke()
    this.ctx.restore()
  }

  private drawInnerPattern(radius: number, now: number, palette: MagicCirclePalette) {
    const runeCount = 16
    this.ctx.save()
    this.ctx.rotate(-now / 3600)
    this.ctx.lineWidth = Math.max(1, radius * 0.018)
    for (let index = 0; index < runeCount; index += 1) {
      const angle = (index / runeCount) * TAU
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      const runeColor = index % 2 === 0 ? palette.primary : palette.secondary
      this.ctx.save()
      this.ctx.translate(x, y)
      this.ctx.rotate(angle + Math.PI / 2)
      this.ctx.strokeStyle = colorWithAlpha(runeColor, 0.9)
      this.ctx.beginPath()
      this.ctx.moveTo(-radius * 0.035, radius * 0.035)
      this.ctx.lineTo(0, -radius * 0.05)
      this.ctx.lineTo(radius * 0.035, radius * 0.035)
      this.ctx.moveTo(-radius * 0.035, radius * 0.01)
      this.ctx.lineTo(radius * 0.035, radius * 0.01)
      this.ctx.stroke()
      this.ctx.restore()
    }
    this.ctx.restore()
  }

  private drawParticles(radius: number, now: number, delta: number, palette: MagicCirclePalette) {
    for (const particle of this.particles) {
      const angle = particle.angle + now * particle.speed * (1 + this.energy * 4) + particle.phase * 0.01
      const orbit = radius * particle.radius
      const alpha = (0.2 + (Math.sin(now / 160 + particle.phase) + 1) * 0.18) * (0.65 + this.energy * 0.35)
      const particleColor = particle.tint === 0 ? palette.primary : palette.secondary
      this.ctx.fillStyle = colorWithAlpha(particleColor, alpha * Math.min(1, delta / 12))
      this.ctx.beginPath()
      this.ctx.arc(Math.cos(angle) * orbit, Math.sin(angle) * orbit, particle.size, 0, TAU)
      this.ctx.fill()
    }
  }

  private drawArcTrails(radius: number, now: number, palette: MagicCirclePalette, arcBlend: Rgb) {
    this.ctx.lineCap = 'round'
    this.ctx.lineWidth = Math.max(1, radius * 0.012)
    for (const trail of this.arcTrails) {
      const angle = trail.phase + now * trail.speed * (1 + this.energy * 3)
      const arcColor = trail.tint === 0 ? palette.secondary : arcBlend
      this.ctx.strokeStyle = colorWithAlpha(arcColor, 0.2 + this.energy * 0.5)
      this.ctx.beginPath()
      this.ctx.arc(0, 0, radius * trail.radius, angle, angle + trail.span + this.energy * 0.35)
      this.ctx.stroke()
    }
  }

  private drawHandInteraction(radius: number, now: number, palette: MagicCirclePalette) {
    const interactionRadius = radius * (0.18 + this.energy * 0.12)
    const interactionColor = mixColor(palette.primary, palette.secondary, 0.5)
    this.ctx.strokeStyle = colorWithAlpha(interactionColor, 0.35 + this.energy * 0.5)
    this.ctx.lineWidth = Math.max(1, radius * 0.009)
    this.ctx.setLineDash([radius * 0.03, radius * 0.05])
    this.ctx.beginPath()
    this.ctx.arc(0, 0, interactionRadius, now / 700, now / 700 + Math.PI * 1.25)
    this.ctx.stroke()
    this.ctx.setLineDash([])
  }
}
