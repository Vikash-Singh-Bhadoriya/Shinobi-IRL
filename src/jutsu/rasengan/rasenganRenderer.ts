import type { RasenganDetection } from './rasenganTypes'

const FADE_MS = 500

interface Particle {
  angle: number
  radius: number
  speed: number
  size: number
  phase: number
}

function createParticles(): Particle[] {
  return Array.from({ length: 34 }, (_, index) => ({
    angle: (index / 34) * Math.PI * 2,
    radius: 0.72 + ((index * 17) % 100) / 250,
    speed: 0.0008 + ((index * 13) % 10) / 10000,
    size: 1.2 + ((index * 7) % 10) / 5,
    phase: index * 1.7,
  }))
}

export class RasenganRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly particles = createParticles()
  private animationFrame = 0
  private latest: RasenganDetection | null = null
  private lastVisible: RasenganDetection | null = null
  private missingSince: number | null = null

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Rasengan canvas is unavailable')
    this.canvas = canvas
    this.ctx = ctx
    this.animationFrame = requestAnimationFrame(this.render)
  }

  setDetection(detection: RasenganDetection) {
    this.latest = detection
    if (detection.palmPosition) {
      this.lastVisible = detection
      this.missingSince = null
    } else if (this.missingSince === null) {
      this.missingSince = performance.now()
    }
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
      const visible = detection?.palmPosition ? detection : this.lastVisible
      const fade = this.missingSince === null ? 1 : Math.max(0, 1 - (now - this.missingSince) / FADE_MS)
      if (visible?.palmPosition && fade > 0 && (visible.active || visible.state === 'CHARGING')) {
        this.drawRasengan(visible, width, height, now, fade)
      }
    }
    this.animationFrame = requestAnimationFrame(this.render)
  }

  private drawRasengan(detection: RasenganDetection, width: number, height: number, now: number, fade: number) {
    const { x, y } = detection.palmPosition as { x: number; y: number }
    const centerX = x * width
    const centerY = y * height
    const scale = Math.min(width, height)
    const radius = Math.max(12, detection.palmSize * scale * 0.62)
    const progress = detection.active ? 1 : 0.42
    const pulse = 1 + Math.sin(now / 130) * 0.035

    this.ctx.save()
    this.ctx.globalAlpha = fade * progress
    this.ctx.globalCompositeOperation = 'lighter'
    this.ctx.translate(centerX, centerY)
    this.ctx.rotate(detection.rotation)
    this.ctx.scale(pulse, pulse)

    const glow = this.ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 2.2)
    glow.addColorStop(0, 'rgba(125, 230, 255, 0.5)')
    glow.addColorStop(0.4, 'rgba(31, 145, 255, 0.2)')
    glow.addColorStop(1, 'rgba(0, 72, 255, 0)')
    this.ctx.fillStyle = glow
    this.ctx.beginPath()
    this.ctx.arc(0, 0, radius * 2.2, 0, Math.PI * 2)
    this.ctx.fill()

    const sphere = this.ctx.createRadialGradient(-radius * 0.28, -radius * 0.32, radius * 0.05, 0, 0, radius)
    sphere.addColorStop(0, 'rgba(235, 253, 255, 0.98)')
    sphere.addColorStop(0.18, 'rgba(100, 222, 255, 0.98)')
    sphere.addColorStop(0.58, 'rgba(22, 107, 244, 0.95)')
    sphere.addColorStop(1, 'rgba(5, 20, 125, 0.98)')
    this.ctx.fillStyle = sphere
    this.ctx.beginPath()
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.strokeStyle = 'rgba(169, 239, 255, 0.82)'
    this.ctx.lineWidth = Math.max(1.2, radius * 0.045)
    for (let layer = 0; layer < 3; layer += 1) {
      this.ctx.save()
      this.ctx.rotate(now / (720 + layer * 180) * (layer % 2 === 0 ? 1 : -1))
      this.ctx.beginPath()
      this.ctx.ellipse(0, 0, radius * (0.72 + layer * 0.09), radius * (0.22 + layer * 0.06), layer * 0.8, 0, Math.PI * 2)
      this.ctx.stroke()
      this.ctx.restore()
    }

    for (const particle of this.particles) {
      const angle = particle.angle + now * particle.speed + particle.phase * 0.01
      const orbit = radius * particle.radius
      this.ctx.fillStyle = `rgba(112, 225, 255, ${0.45 + Math.sin(angle * 2) * 0.2})`
      this.ctx.beginPath()
      this.ctx.arc(Math.cos(angle) * orbit, Math.sin(angle) * orbit, particle.size, 0, Math.PI * 2)
      this.ctx.fill()
    }
    this.ctx.restore()
  }
}
