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
    const handLost = detection.state === 'LOST_HAND_GRACE' || detection.state === 'FADE_OUT'
    if (handLost) {
      if (this.missingSince === null) this.missingSince = performance.now()
    } else if (detection.palmPosition) {
      this.lastVisible = detection
      this.missingSince = null
    }
    if (detection.palmPosition && !handLost) this.lastVisible = detection
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
      const missingFor = this.missingSince === null ? 0 : now - this.missingSince
      const graceOpacity = missingFor > 0 ? 0.72 : 1
      const fade = missingFor <= 1000 ? graceOpacity : Math.max(0, 1 - (missingFor - 1000) / FADE_MS)
      if (detection && (detection.state === 'THROW_DETECTED' || detection.state === 'PROJECTILE' || detection.state === 'IMPACT')) {
        this.drawProjectile(detection, width, height, now)
      } else if (visible?.palmPosition && fade > 0 && (visible.active || visible.state === 'CHARGING' || visible.state === 'LOST_HAND_GRACE')) {
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
    const progress = detection.active ? 1 : Math.min(1, 0.25 + (now % 500) / 500)
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

    this.ctx.save()
    this.ctx.globalAlpha = 0.65
    this.ctx.strokeStyle = 'rgba(77, 195, 255, 0.7)'
    this.ctx.lineWidth = Math.max(1, radius * 0.06)
    this.ctx.beginPath()
    this.ctx.arc(0, radius * 0.72, radius * 0.72, Math.PI * 0.12, Math.PI * 0.88)
    this.ctx.stroke()
    this.ctx.restore()

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
      const gather = detection.active ? 1 : Math.max(0.2, progress)
      const orbit = radius * particle.radius * gather
      this.ctx.fillStyle = `rgba(112, 225, 255, ${0.45 + Math.sin(angle * 2) * 0.2})`
      this.ctx.beginPath()
      this.ctx.arc(Math.cos(angle) * orbit, Math.sin(angle) * orbit, particle.size, 0, Math.PI * 2)
      this.ctx.fill()
    }

    this.ctx.fillStyle = 'rgba(123, 226, 255, 0.9)'
    for (let index = 0; index < 8; index += 1) {
      const angle = now / 420 + index * Math.PI / 4
      const orbit = radius * (1.25 + Math.sin(now / 240 + index) * 0.12)
      this.ctx.beginPath()
      this.ctx.arc(Math.cos(angle) * orbit, Math.sin(angle) * orbit, Math.max(1, radius * 0.035), 0, Math.PI * 2)
      this.ctx.fill()
    }
    this.ctx.restore()
  }

  private drawProjectile(detection: RasenganDetection, width: number, height: number, now: number) {
    const position = detection.projectilePosition
    if (!position) return
    const scale = Math.min(width, height)
    const progress = detection.projectileProgress
    const radius = Math.max(14, detection.palmSize * scale * (0.68 + progress * 0.22))
    const centerX = position.x * width
    const centerY = position.y * height
    const impact = detection.state === 'IMPACT'
    const impactProgress = impact ? Math.min(1, (progress - 1) * (1100 / 400)) : 0

    this.ctx.save()
    this.ctx.globalCompositeOperation = 'lighter'
    if (impact) {
      const ringRadius = radius * (1 + impactProgress * 3.5)
      this.ctx.globalAlpha = 0.8 * (1 - impactProgress)
      this.ctx.strokeStyle = 'rgba(157, 241, 255, 0.95)'
      this.ctx.lineWidth = Math.max(2, radius * 0.08) * (1 - impactProgress * 0.4)
      this.ctx.beginPath()
      this.ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2)
      this.ctx.stroke()
      this.ctx.fillStyle = `rgba(147, 235, 255, ${0.55 * (1 - impactProgress)})`
      this.ctx.beginPath()
      this.ctx.arc(centerX, centerY, radius * (1.4 - impactProgress * 0.6), 0, Math.PI * 2)
      this.ctx.fill()
      this.ctx.restore()
      return
    }

    const directionLength = Math.hypot(detection.velocity.x, detection.velocity.y) || 1
    const directionX = detection.velocity.x / directionLength
    const directionY = detection.velocity.y / directionLength
    for (let index = 0; index < 12; index += 1) {
      const trail = (index + 1) / 12
      const wobble = Math.sin(now / 90 + index) * radius * 0.08
      const particleX = centerX - directionX * radius * trail * 2.5 - directionY * wobble
      const particleY = centerY - directionY * radius * trail * 2.5 + directionX * wobble
      this.ctx.globalAlpha = 0.65 * (1 - trail)
      this.ctx.fillStyle = index % 3 === 0 ? 'rgba(236, 253, 255, 0.9)' : 'rgba(62, 172, 255, 0.8)'
      this.ctx.beginPath()
      this.ctx.arc(particleX, particleY, Math.max(1, radius * (0.05 + (1 - trail) * 0.05)), 0, Math.PI * 2)
      this.ctx.fill()
    }

    this.ctx.globalAlpha = 0.8
    const glow = this.ctx.createRadialGradient(centerX, centerY, radius * 0.15, centerX, centerY, radius * 2.8)
    glow.addColorStop(0, 'rgba(220, 252, 255, 0.8)')
    glow.addColorStop(0.3, 'rgba(53, 180, 255, 0.36)')
    glow.addColorStop(1, 'rgba(0, 65, 255, 0)')
    this.ctx.fillStyle = glow
    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, radius * 2.8, 0, Math.PI * 2)
    this.ctx.fill()

    const sphere = this.ctx.createRadialGradient(centerX - radius * 0.28, centerY - radius * 0.32, radius * 0.05, centerX, centerY, radius)
    sphere.addColorStop(0, 'rgba(255, 255, 255, 1)')
    sphere.addColorStop(0.2, 'rgba(115, 229, 255, 1)')
    sphere.addColorStop(0.62, 'rgba(25, 109, 250, 0.98)')
    sphere.addColorStop(1, 'rgba(5, 20, 125, 1)')
    this.ctx.fillStyle = sphere
    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.strokeStyle = 'rgba(205, 247, 255, 0.9)'
    this.ctx.lineWidth = Math.max(1.5, radius * 0.05)
    for (let layer = 0; layer < 3; layer += 1) {
      this.ctx.save()
      this.ctx.translate(centerX, centerY)
      this.ctx.rotate(now / (140 + layer * 45) * (layer % 2 === 0 ? 1 : -1))
      this.ctx.beginPath()
      this.ctx.ellipse(0, 0, radius * (0.8 + layer * 0.1), radius * (0.24 + layer * 0.05), layer * 0.8, 0, Math.PI * 2)
      this.ctx.stroke()
      this.ctx.restore()
    }
    this.ctx.restore()
  }
}
