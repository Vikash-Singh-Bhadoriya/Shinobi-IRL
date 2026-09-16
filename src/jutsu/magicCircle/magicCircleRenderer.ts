import type { MagicCircleDetection } from './magicCircleTypes'

interface Particle {
  angle: number
  radius: number
  speed: number
  size: number
  phase: number
}

const PARTICLE_COUNT = 42
const TAU = Math.PI * 2

function createParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    angle: (index / PARTICLE_COUNT) * TAU,
    radius: 0.78 + ((index * 19) % 100) / 300,
    speed: 0.00018 + ((index * 11) % 10) / 50000,
    size: 0.8 + ((index * 7) % 10) / 4,
    phase: index * 1.37,
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
  private animationFrame = 0
  private latest: MagicCircleDetection | null = null
  private visibleX = 0
  private visibleY = 0
  private visibleRotation = 0
  private visibleSize = 0
  private hasVisiblePosition = false

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Magic Circle canvas is unavailable')
    this.canvas = canvas
    this.ctx = context
    this.animationFrame = requestAnimationFrame(this.render)
  }

  setDetection(detection: MagicCircleDetection) {
    this.latest = detection
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  private render = (now: number) => {
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
          this.hasVisiblePosition = true
        }
        this.visibleX += (detection.palmPosition.x - this.visibleX) * 0.28
        this.visibleY += (detection.palmPosition.y - this.visibleY) * 0.28
        this.visibleRotation += shortestAngleDelta(this.visibleRotation, detection.rotation) * 0.28
        this.visibleSize += (detection.palmSize - this.visibleSize) * 0.2
        const fade = detection.state === 'FADE_OUT' ? 1 - detection.fadeProgress : 1
        this.drawMagicCircle(width, height, now, fade)
      } else if (!detection || detection.state === 'SEARCHING') {
        this.hasVisiblePosition = false
      }
    }
    this.animationFrame = requestAnimationFrame(this.render)
  }

  private drawMagicCircle(width: number, height: number, now: number, fade: number) {
    const scale = Math.min(width, height)
    const radius = Math.max(30, this.visibleSize * scale * 1.55)
    const centerX = this.visibleX * width
    const centerY = this.visibleY * height
    const pulse = 1 + Math.sin(now / 170) * 0.045
    const rotation = this.visibleRotation + now / 2800

    this.ctx.save()
    this.ctx.globalAlpha = fade
    this.ctx.globalCompositeOperation = 'lighter'
    this.ctx.translate(centerX, centerY)
    this.ctx.rotate(this.visibleRotation)
    this.ctx.scale(pulse, pulse)

    const glow = this.ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.8)
    glow.addColorStop(0, 'rgba(255, 211, 126, 0.2)')
    glow.addColorStop(0.5, 'rgba(217, 91, 255, 0.12)')
    glow.addColorStop(1, 'rgba(120, 47, 255, 0)')
    this.ctx.fillStyle = glow
    this.ctx.beginPath()
    this.ctx.arc(0, 0, radius * 1.8, 0, TAU)
    this.ctx.fill()

    this.ctx.rotate(rotation - this.visibleRotation)
    this.drawRing(radius, 1, 'rgba(255, 211, 126, 0.92)', 2.2)
    this.drawRing(radius * 0.88, -1, 'rgba(225, 116, 255, 0.78)', 1.4)
    this.drawRing(radius * 0.64, 1, 'rgba(255, 235, 179, 0.7)', 1.1)
    this.drawRunes(radius * 0.76, now)
    this.drawParticles(radius, now)
    this.ctx.restore()
  }

  private drawRing(radius: number, direction: number, color: string, lineWidth: number) {
    this.ctx.save()
    this.ctx.rotate(direction * 0.08)
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = Math.max(1, radius * 0.012 * lineWidth)
    this.ctx.setLineDash([radius * 0.08, radius * 0.035])
    this.ctx.beginPath()
    this.ctx.arc(0, 0, radius, 0, TAU)
    this.ctx.stroke()
    this.ctx.restore()
  }

  private drawRunes(radius: number, now: number) {
    const runeCount = 12
    this.ctx.save()
    this.ctx.rotate(-now / 3600)
    this.ctx.strokeStyle = 'rgba(255, 225, 154, 0.88)'
    this.ctx.lineWidth = Math.max(1, radius * 0.018)
    for (let index = 0; index < runeCount; index += 1) {
      const angle = (index / runeCount) * TAU
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      this.ctx.save()
      this.ctx.translate(x, y)
      this.ctx.rotate(angle + Math.PI / 2)
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

  private drawParticles(radius: number, now: number) {
    this.ctx.fillStyle = 'rgba(255, 220, 143, 0.86)'
    for (const particle of this.particles) {
      const angle = particle.angle + now * particle.speed + particle.phase * 0.01
      const orbit = radius * particle.radius
      const alpha = 0.35 + (Math.sin(now / 160 + particle.phase) + 1) * 0.22
      this.ctx.globalAlpha = alpha
      this.ctx.beginPath()
      this.ctx.arc(Math.cos(angle) * orbit, Math.sin(angle) * orbit, particle.size, 0, TAU)
      this.ctx.fill()
    }
  }
}
