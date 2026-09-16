import type { RasenganDetection, RasenganInstance } from './rasenganTypes'

const FADE_MS = 500
const IMPACT_MS = 400
const TAU = Math.PI * 2

interface Particle {
  angle: number
  radius: number
  speed: number
  size: number
  phase: number
}

interface ImpactParticle {
  angle: number
  speed: number
  size: number
  phase: number
  spin: number
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

function createImpactParticles(): ImpactParticle[] {
  return Array.from({ length: 48 }, (_, index) => ({
    angle: (index / 48) * TAU + (index % 5) * 0.08,
    speed: 0.7 + ((index * 19) % 17) / 12,
    size: 1.2 + ((index * 11) % 13) / 3,
    phase: ((index * 23) % 19) / 19,
    spin: (index % 2 === 0 ? 1 : -1) * (0.4 + (index % 5) * 0.12),
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
  private readonly impactParticles = createImpactParticles()
  private animationFrame = 0
  private latest: RasenganInstance[] = []
  private readonly lastVisible = new Map<string, RasenganInstance>()
  private readonly missingSince = new Map<string, number>()
  private readonly impactStartedAt = new Map<string, number>()

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
    this.impactStartedAt.clear()
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
        if (detection.state === 'IMPACT') {
          if (!this.impactStartedAt.has(instance.id)) this.impactStartedAt.set(instance.id, now)
        } else {
          this.impactStartedAt.delete(instance.id)
        }
        const visible = detection.palmPosition ? instance : this.lastVisible.get(instance.id)
        const missingAt = this.missingSince.get(instance.id)
        const missingFor = missingAt === undefined ? 0 : now - missingAt
        const graceOpacity = missingFor > 0 ? 0.72 : 1
        const fade = missingFor <= 1000 ? graceOpacity : Math.max(0, 1 - (missingFor - 1000) / FADE_MS)
        if (detection.state === 'THROW_DETECTED' || detection.state === 'PROJECTILE' || detection.state === 'IMPACT') {
          this.drawProjectile(instance.id, detection, instance.color, width, height, now)
        } else if (visible?.detection.palmPosition && fade > 0 && (visible.detection.active || visible.detection.state === 'CHARGING' || visible.detection.state === 'LOST_HAND_GRACE')) {
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
    const progress = detection.active ? 1 : Math.min(1, 0.25 + (now % 500) / 500)
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

  private drawProjectile(instanceId: string, detection: RasenganDetection, color: string, width: number, height: number, now: number) {
    const position = detection.projectilePosition
    if (!position) return
    const scale = Math.min(width, height)
    const progress = detection.projectileProgress
    const radius = Math.max(14, detection.palmSize * scale * (0.68 + progress * 0.22))
    const centerX = position.x * width
    const centerY = position.y * height
    const impact = detection.state === 'IMPACT'
    const impactStartedAt = this.impactStartedAt.get(instanceId)
    const impactProgress = impact && impactStartedAt !== undefined
      ? Math.min(1, Math.max(0, (now - impactStartedAt) / IMPACT_MS))
      : 0

    this.ctx.save()
    this.ctx.globalCompositeOperation = 'lighter'
    if (impact) {
      this.drawImpact(centerX, centerY, radius, color, impactProgress, now)
      this.ctx.restore()
      return
    }

    const trajectoryX = 0.5 - position.x
    const trajectoryY = 0.42 - position.y
    const trajectoryLength = Math.hypot(trajectoryX, trajectoryY)
    const velocityLength = Math.hypot(detection.velocity.x, detection.velocity.y)
    const directionLength = trajectoryLength > 0.02 ? trajectoryLength : velocityLength || 1
    const directionX = trajectoryLength > 0.02 ? trajectoryX / directionLength : detection.velocity.x / directionLength
    const directionY = trajectoryLength > 0.02 ? trajectoryY / directionLength : detection.velocity.y / directionLength
    for (let index = 0; index < 12; index += 1) {
      const trail = (index + 1) / 12
      const wobble = Math.sin(now / 90 + index) * radius * 0.08
      const particleX = centerX - directionX * radius * trail * 2.5 - directionY * wobble
      const particleY = centerY - directionY * radius * trail * 2.5 + directionX * wobble
      this.ctx.globalAlpha = 0.65 * (1 - trail)
      this.ctx.fillStyle = index % 3 === 0 ? 'rgba(236, 253, 255, 0.9)' : colorWithAlpha(color, 0.8)
      this.ctx.beginPath()
      this.ctx.arc(particleX, particleY, Math.max(1, radius * (0.05 + (1 - trail) * 0.05)), 0, Math.PI * 2)
      this.ctx.fill()
    }

    this.ctx.globalAlpha = 0.62
    const glow = this.ctx.createRadialGradient(centerX, centerY, radius * 0.15, centerX, centerY, radius * 2.8)
    glow.addColorStop(0, 'rgba(220, 252, 255, 0.8)')
    glow.addColorStop(0.3, colorWithAlpha(color, 0.36))
    glow.addColorStop(1, colorWithAlpha(color, 0))
    this.ctx.fillStyle = glow
    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, radius * 2.8, 0, Math.PI * 2)
    this.ctx.fill()

    const sphere = this.ctx.createRadialGradient(centerX - radius * 0.28, centerY - radius * 0.32, radius * 0.05, centerX, centerY, radius)
    sphere.addColorStop(0, 'rgba(255, 255, 255, 1)')
    sphere.addColorStop(0.2, colorWithAlpha(color, 0.9))
    sphere.addColorStop(0.62, colorWithAlpha(color, 0.82))
    sphere.addColorStop(1, colorWithAlpha(color, 0.76))
    this.ctx.fillStyle = sphere
    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.strokeStyle = 'rgba(205, 247, 255, 0.68)'
    this.ctx.lineWidth = Math.max(1.5, radius * 0.04)
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

  private drawImpact(centerX: number, centerY: number, radius: number, color: string, progress: number, now: number) {
    const anticipation = Math.min(1, progress / 0.14)
    const burst = Math.min(1, Math.max(0, (progress - 0.06) / 0.54))
    const dissolve = Math.min(1, Math.max(0, (progress - 0.3) / 0.7))
    const compression = 1 - anticipation * 0.18
    const burstEase = 1 - Math.pow(1 - burst, 1.7)
    const dissolveAlpha = 1 - dissolve * dissolve

    this.ctx.save()
    this.ctx.translate(centerX, centerY)

    this.ctx.globalAlpha = 0.72 * dissolveAlpha
    this.ctx.strokeStyle = colorWithAlpha(color, 0.9)
    this.ctx.lineWidth = Math.max(2, radius * 0.055) * (1 - progress * 0.35)
    this.ctx.beginPath()
    this.ctx.arc(0, 0, radius * (0.72 + burstEase * 3.2), 0, TAU)
    this.ctx.stroke()

    const secondaryProgress = Math.min(1, Math.max(0, (progress - 0.1) / 0.7))
    this.ctx.globalAlpha = 0.42 * (1 - secondaryProgress)
    this.ctx.strokeStyle = 'rgba(191, 250, 255, 0.92)'
    this.ctx.lineWidth = Math.max(1.2, radius * 0.026)
    this.ctx.beginPath()
    this.ctx.arc(0, 0, radius * (0.9 + secondaryProgress * 2.5), 0, TAU)
    this.ctx.stroke()

    this.ctx.globalAlpha = 0.6 * burstEase * dissolveAlpha
    this.ctx.strokeStyle = 'rgba(224, 253, 255, 0.92)'
    this.ctx.lineWidth = Math.max(1, radius * 0.025)
    for (let index = 0; index < 16; index += 1) {
      const angle = index * TAU / 16 + now / 520
      const inner = radius * (0.65 + burstEase * 0.5)
      const outer = inner + radius * (0.3 + burstEase * (0.75 + (index % 3) * 0.18))
      this.ctx.beginPath()
      this.ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
      this.ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
      this.ctx.stroke()
    }

    for (const particle of this.impactParticles) {
      const particleProgress = Math.min(1, Math.max(0, (progress - particle.phase * 0.16) / 0.72))
      if (particleProgress <= 0) continue
      const distance = radius * (0.65 + particleProgress * particle.speed * 2.8)
      const angle = particle.angle + particle.spin * particleProgress * 1.8
      const fragmentAlpha = (1 - particleProgress) * dissolveAlpha * (0.5 + (1 - particle.phase) * 0.5)
      this.ctx.globalAlpha = fragmentAlpha
      this.ctx.fillStyle = particle.phase > 0.58 ? 'rgba(226, 253, 255, 0.95)' : colorWithAlpha(color, 0.9)
      this.ctx.save()
      this.ctx.translate(Math.cos(angle) * distance, Math.sin(angle) * distance)
      this.ctx.rotate(angle + particle.spin * now / 300)
      this.ctx.fillRect(-particle.size * 0.7, -particle.size * 0.35, particle.size * (1.4 - particleProgress * 0.65), particle.size * 0.7)
      this.ctx.restore()
    }

    const coreRadius = radius * compression * (1 + burstEase * 0.38)
    this.ctx.globalAlpha = dissolveAlpha
    const glow = this.ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius * 2.8)
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
    glow.addColorStop(0.18, 'rgba(220, 252, 255, 0.82)')
    glow.addColorStop(0.5, colorWithAlpha(color, 0.42))
    glow.addColorStop(1, colorWithAlpha(color, 0))
    this.ctx.fillStyle = glow
    this.ctx.beginPath()
    this.ctx.arc(0, 0, coreRadius * (1.2 + burstEase * 0.8), 0, TAU)
    this.ctx.fill()

    this.ctx.globalAlpha = Math.max(0, 0.95 - burstEase * 0.6) * dissolveAlpha
    this.ctx.scale(1 + burstEase * 0.16, compression)
    const core = this.ctx.createRadialGradient(-coreRadius * 0.24, -coreRadius * 0.28, coreRadius * 0.04, 0, 0, coreRadius)
    core.addColorStop(0, 'rgba(255, 255, 255, 1)')
    core.addColorStop(0.2, 'rgba(196, 249, 255, 0.98)')
    core.addColorStop(0.58, colorWithAlpha(color, 0.94))
    core.addColorStop(1, colorWithAlpha(color, 0.2))
    this.ctx.fillStyle = core
    this.ctx.beginPath()
    this.ctx.arc(0, 0, coreRadius, 0, TAU)
    this.ctx.fill()
    this.ctx.restore()

    this.ctx.globalAlpha = 0.8 * Math.max(0, 1 - progress * 3.2)
    const flash = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.35)
    flash.addColorStop(0, 'rgba(255, 255, 255, 0.96)')
    flash.addColorStop(0.18, 'rgba(214, 253, 255, 0.72)')
    flash.addColorStop(1, colorWithAlpha(color, 0))
    this.ctx.fillStyle = flash
    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, radius * 1.35, 0, TAU)
    this.ctx.fill()
  }

}
