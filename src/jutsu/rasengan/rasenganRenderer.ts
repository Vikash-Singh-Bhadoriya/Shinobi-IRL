import type { RasenganDetection, RasenganInstance } from './rasenganTypes'

const GRACE_MS = 1000
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

function colorWithAlpha(color: string, alpha: number): string {
  const value = color.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export class RasenganRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly particles = createParticles()
  private animationFrame = 0
  private latest: RasenganInstance[] = []
  private readonly lastVisible = new Map<string, RasenganInstance>()
  private readonly missingSince = new Map<string, number>()

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Rasengan canvas is unavailable')
    this.canvas = canvas
    this.ctx = ctx
    this.animationFrame = requestAnimationFrame(this.render)
  }

  setDetections(instances: RasenganInstance[]) {
    this.latest = instances
    for (const instance of instances) {
      const handLost = instance.detection.state === 'LOST_HAND_GRACE' || instance.detection.state === 'FADE_OUT'
      if (handLost) {
        if (!this.missingSince.has(instance.id)) this.missingSince.set(instance.id, performance.now())
      } else if (instance.detection.palmPosition) {
        this.lastVisible.set(instance.id, instance)
        this.missingSince.delete(instance.id)
      }
    }
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame)
    this.lastVisible.clear()
    this.missingSince.clear()
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  private render = (now: number) => {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width > 0 && height > 0) {
      if (this.canvas.width !== width) this.canvas.width = width
      if (this.canvas.height !== height) this.canvas.height = height
      this.ctx.clearRect(0, 0, width, height)
      for (const instance of this.latest) {
        const detection = instance.detection
        const visible = detection.palmPosition ? instance : this.lastVisible.get(instance.id)
        const missingAt = this.missingSince.get(instance.id)
        const missingFor = missingAt === undefined ? 0 : now - missingAt
        const fade = missingFor <= GRACE_MS ? 1 : Math.max(0, 1 - (missingFor - GRACE_MS) / FADE_MS)
        if (visible?.detection.palmPosition && fade > 0 && (visible.detection.active || visible.detection.state === 'CHARGING' || visible.detection.state === 'LOST_HAND_GRACE' || visible.detection.state === 'FADE_OUT')) {
          this.drawRasengan(visible.detection, instance.color, width, height, now, fade)
        }
      }
    }
    this.animationFrame = requestAnimationFrame(this.render)
  }

  private drawRasengan(detection: RasenganDetection, color: string, width: number, height: number, now: number, fade: number) {
    const { x, y } = detection.palmPosition as { x: number; y: number }
    const centerX = x * width
    const centerY = y * height
    const scale = Math.min(width, height)
    const radius = Math.max(12, detection.palmSize * scale * 0.62)
    const progress = detection.active || detection.state === 'LOST_HAND_GRACE' || detection.state === 'FADE_OUT'
      ? 1
      : Math.min(1, 0.25 + (now % 500) / 500)
    const pulse = 1 + Math.sin(now / 130) * 0.035

    this.ctx.save()
    this.ctx.globalAlpha = fade * progress
    this.ctx.globalCompositeOperation = 'lighter'
    this.ctx.translate(centerX, centerY)
    this.ctx.rotate(detection.rotation)
    this.ctx.scale(pulse, pulse)

    const glow = this.ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 2.2)
    glow.addColorStop(0, colorWithAlpha(color, 0.28))
    glow.addColorStop(0.4, colorWithAlpha(color, 0.12))
    glow.addColorStop(1, colorWithAlpha(color, 0))
    this.ctx.fillStyle = glow
    this.ctx.beginPath()
    this.ctx.arc(0, 0, radius * 2.2, 0, Math.PI * 2)
    this.ctx.fill()

    const shell = this.ctx.createRadialGradient(-radius * 0.2, -radius * 0.24, radius * 0.18, 0, 0, radius * 1.15)
    shell.addColorStop(0, 'rgba(212, 252, 255, 0.08)')
    shell.addColorStop(0.58, colorWithAlpha(color, 0.2))
    shell.addColorStop(0.86, 'rgba(104, 231, 255, 0.3)')
    shell.addColorStop(1, 'rgba(115, 240, 255, 0)')
    this.ctx.fillStyle = shell
    this.ctx.beginPath()
    this.ctx.arc(0, 0, radius * 1.15, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.save()
    this.ctx.globalAlpha = 0.65
    this.ctx.strokeStyle = colorWithAlpha(color, 0.7)
    this.ctx.lineWidth = Math.max(1, radius * 0.06)
    this.ctx.beginPath()
    this.ctx.arc(0, radius * 0.72, radius * 0.72, Math.PI * 0.12, Math.PI * 0.88)
    this.ctx.stroke()
    this.ctx.restore()

    const sphere = this.ctx.createRadialGradient(-radius * 0.28, -radius * 0.32, radius * 0.05, 0, 0, radius)
    sphere.addColorStop(0, 'rgba(255, 255, 255, 1)')
    sphere.addColorStop(0.14, 'rgba(188, 249, 255, 0.98)')
    sphere.addColorStop(0.3, colorWithAlpha(color, 0.98))
    sphere.addColorStop(0.72, colorWithAlpha(color, 0.9))
    sphere.addColorStop(0.93, 'rgba(74, 215, 255, 0.94)')
    sphere.addColorStop(1, 'rgba(66, 190, 255, 0.62)')
    this.ctx.fillStyle = sphere
    this.ctx.beginPath()
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.save()
    this.ctx.globalCompositeOperation = 'lighter'
    this.ctx.globalAlpha = 0.5
    this.ctx.shadowColor = 'rgba(120, 240, 255, 0.9)'
    this.ctx.shadowBlur = radius * 0.16
    this.ctx.strokeStyle = 'rgba(190, 252, 255, 0.9)'
    this.ctx.lineWidth = Math.max(1.5, radius * 0.035)
    this.ctx.beginPath()
    this.ctx.arc(0, 0, radius * 0.96, 0, Math.PI * 2)
    this.ctx.stroke()
    this.ctx.restore()

    const turbulence = 4
    for (let layer = 0; layer < turbulence; layer += 1) {
      this.ctx.save()
      this.ctx.globalCompositeOperation = 'lighter'
      this.ctx.globalAlpha = 0.28 + layer * 0.045
      this.ctx.rotate(now / (460 + layer * 105) * (layer % 2 === 0 ? 1 : -1) + layer * 0.7)
      this.ctx.strokeStyle = layer % 2 === 0 ? 'rgba(199, 252, 255, 0.9)' : colorWithAlpha(color, 0.88)
      this.ctx.shadowColor = 'rgba(83, 224, 255, 0.8)'
      this.ctx.shadowBlur = radius * 0.1
      this.ctx.lineWidth = Math.max(1.1, radius * (0.022 + layer * 0.004))
      this.ctx.beginPath()
      this.ctx.ellipse(0, 0, radius * (0.5 + layer * 0.12), radius * (0.12 + layer * 0.045), layer * 0.55, now / 500 + layer, now / 500 + layer + Math.PI * 1.45)
      this.ctx.stroke()
      this.ctx.restore()
    }

    const core = this.ctx.createRadialGradient(-radius * 0.18, -radius * 0.2, 0, 0, 0, radius * 0.42)
    core.addColorStop(0, 'rgba(255, 255, 255, 1)')
    core.addColorStop(0.2, 'rgba(224, 255, 255, 0.98)')
    core.addColorStop(0.52, 'rgba(99, 231, 255, 0.6)')
    core.addColorStop(1, 'rgba(75, 210, 255, 0)')
    this.ctx.globalCompositeOperation = 'lighter'
    this.ctx.fillStyle = core
    this.ctx.beginPath()
    this.ctx.arc(-radius * 0.14, -radius * 0.16, radius * 0.44, 0, Math.PI * 2)
    this.ctx.fill()

    for (const particle of this.particles) {
      const angle = particle.angle + now * particle.speed + particle.phase * 0.01
      const gather = detection.active ? 1 : Math.max(0.2, progress)
      const orbit = radius * particle.radius * gather
      this.ctx.fillStyle = colorWithAlpha(color, 0.28 + Math.sin(angle * 2) * 0.12)
      this.ctx.beginPath()
      this.ctx.arc(Math.cos(angle) * orbit, Math.sin(angle) * orbit, particle.size, 0, Math.PI * 2)
      this.ctx.fill()
    }

    this.ctx.fillStyle = colorWithAlpha(color, 0.58)
    for (let index = 0; index < 8; index += 1) {
      const angle = now / 420 + index * Math.PI / 4
      const orbit = radius * (1.25 + Math.sin(now / 240 + index) * 0.12)
      this.ctx.beginPath()
      this.ctx.arc(Math.cos(angle) * orbit, Math.sin(angle) * orbit, Math.max(1, radius * 0.035), 0, Math.PI * 2)
      this.ctx.fill()
    }
    this.ctx.restore()
  }

}
