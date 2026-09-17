import type { LightningDetection, LightningInstance } from './lightningTypes'

const GRACE_MS = 600
const FADE_MS = 350

interface Spark {
  angleOffset: number
  radiusFactor: number
  speed: number
  size: number
  baseOpacity: number
}

const LIGHTNING_COLOR = { r: 0, g: 220, b: 255 }
const LIGHTNING_HOT = { r: 180, g: 240, b: 255 }
const LIGHTNING_WHITE = { r: 255, g: 255, b: 255 }

function createSparks(): Spark[] {
  return Array.from({ length: 20 }, (_, i) => ({
    angleOffset: (i / 20) * Math.PI * 2 + ((i * 17) % 100) / 200,
    radiusFactor: 1.0 + ((i * 13) % 10) / 14,
    speed: 0.0006 + ((i * 7) % 10) / 12000,
    size: 0.8 + ((i * 11) % 10) / 6,
    baseOpacity: 0.35 + ((i * 23) % 10) / 20,
  }))
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

export class LightningRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly sparks = createSparks()
  private animationFrame = 0
  private latest: LightningInstance[] = []
  private readonly lastVisible = new Map<string, LightningInstance>()
  private readonly missingSince = new Map<string, number>()

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Lightning canvas is unavailable')
    this.canvas = canvas
    this.ctx = ctx
    this.animationFrame = requestAnimationFrame(this.render)
  }

  setDetections(instances: LightningInstance[]) {
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
          this.drawLightning(visible.detection, width, height, now, fade)
        }
      }
    }
    this.animationFrame = requestAnimationFrame(this.render)
  }

  private drawLightning(detection: LightningDetection, width: number, height: number, now: number, fade: number) {
    const { x, y } = detection.palmPosition as { x: number; y: number }
    const centerX = x * width
    const centerY = y * height
    const scale = Math.min(width, height)
    const baseRadius = Math.max(14, detection.palmSize * scale * 0.55)
    const charging = detection.state === 'CHARGING'
    const fading = detection.state === 'FADE_OUT'
    const animation = charging
      ? 0.3 + detection.confidence * 0.7
      : fading
        ? Math.max(0, 1 - detection.fadeProgress)
        : 1
    const pulse = 1 + Math.sin(now / 80) * 0.04 + Math.sin(now / 55) * 0.02

    const globalAlpha = fade * animation
    if (globalAlpha <= 0) return

    this.ctx.save()
    this.ctx.globalAlpha = globalAlpha
    this.ctx.translate(centerX, centerY)

    // Outer glow
    this.ctx.globalCompositeOperation = 'lighter'
    const glowRadius = baseRadius * 2.5 * pulse
    const glow = this.ctx.createRadialGradient(0, 0, baseRadius * 0.1, 0, 0, glowRadius)
    glow.addColorStop(0, `rgba(${LIGHTNING_COLOR.r}, ${LIGHTNING_COLOR.g}, ${LIGHTNING_COLOR.b}, 0.35)`)
    glow.addColorStop(0.3, `rgba(${LIGHTNING_HOT.r}, ${LIGHTNING_HOT.g}, ${LIGHTNING_HOT.b}, 0.15)`)
    glow.addColorStop(0.7, `rgba(${LIGHTNING_COLOR.r}, ${LIGHTNING_COLOR.g}, ${LIGHTNING_COLOR.b}, 0.05)`)
    glow.addColorStop(1, 'rgba(0, 180, 255, 0)')
    this.ctx.fillStyle = glow
    this.ctx.beginPath()
    this.ctx.arc(0, 0, glowRadius, 0, Math.PI * 2)
    this.ctx.fill()

    // Hot core
    const coreRadius = baseRadius * 0.35 * pulse
    const core = this.ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius)
    core.addColorStop(0, `rgba(${LIGHTNING_WHITE.r}, ${LIGHTNING_WHITE.g}, ${LIGHTNING_WHITE.b}, 0.9)`)
    core.addColorStop(0.35, `rgba(${LIGHTNING_HOT.r}, ${LIGHTNING_HOT.g}, ${LIGHTNING_HOT.b}, 0.6)`)
    core.addColorStop(0.7, `rgba(${LIGHTNING_COLOR.r}, ${LIGHTNING_COLOR.g}, ${LIGHTNING_COLOR.b}, 0.25)`)
    core.addColorStop(1, `rgba(${LIGHTNING_COLOR.r}, ${LIGHTNING_COLOR.g}, ${LIGHTNING_COLOR.b}, 0)`)
    this.ctx.fillStyle = core
    this.ctx.beginPath()
    this.ctx.arc(0, 0, coreRadius, 0, Math.PI * 2)
    this.ctx.fill()

    // Lightning arcs
    const arcCount = 5
    const arcsPerFrame = Math.floor(now / 75)
    for (let a = 0; a < arcCount; a++) {
      const baseAngle = (a / arcCount) * Math.PI * 2
      const angleWobble = Math.sin(now / 200 + a * 2.1) * 0.3
      const angle = baseAngle + angleWobble
      const arcLength = baseRadius * (1.2 + seededRandom(arcsPerFrame + a * 100) * 0.8)
      const flickerSeed = now * 0.01 + a * 37
      const opacity = 0.5 + Math.sin(flickerSeed) * 0.25

      this.drawArc(
        0, 0,
        angle,
        arcLength,
        6,
        4 + seededRandom(arcsPerFrame + a * 50) * 3,
        opacity,
        baseRadius,
        arcsPerFrame + a * 100,
        1,
      )

      // Secondary branches
      const branchCount = 2
      for (let b = 0; b < branchCount; b++) {
        const branchFraction = 0.3 + seededRandom(arcsPerFrame + a * 100 + b * 10 + 50) * 0.4
        const branchStartX = Math.cos(angle) * arcLength * branchFraction
        const branchStartY = Math.sin(angle) * arcLength * branchFraction
        const branchAngle = angle + (b % 2 === 0 ? 1 : -1) * (0.4 + seededRandom(arcsPerFrame + a * 100 + b * 10 + 60) * 0.6)
        const branchLength = arcLength * (0.3 + seededRandom(arcsPerFrame + a * 100 + b * 10 + 70) * 0.3)

        this.drawArc(
          branchStartX, branchStartY,
          branchAngle,
          branchLength,
          4,
          3 + seededRandom(arcsPerFrame + a * 100 + b * 10 + 80) * 2,
          opacity * 0.6,
          baseRadius,
          arcsPerFrame + a * 100 + b * 10 + 200,
          0.7,
        )
      }
    }

    // Sparks
    for (const spark of this.sparks) {
      const angle = spark.angleOffset + now * spark.speed
      const radius = baseRadius * spark.radiusFactor * (0.9 + Math.sin(now / 300 + spark.angleOffset) * 0.15)
      const sx = Math.cos(angle) * radius
      const sy = Math.sin(angle) * radius
      const flicker = 0.5 + Math.sin(now / 50 + spark.angleOffset * 10) * 0.5
      const alpha = spark.baseOpacity * flicker * animation
      const sparkSize = spark.size * pulse

      this.ctx.globalCompositeOperation = 'lighter'
      this.ctx.fillStyle = `rgba(${LIGHTNING_HOT.r}, ${LIGHTNING_HOT.g}, ${LIGHTNING_HOT.b}, ${alpha * 0.5})`
      this.ctx.beginPath()
      this.ctx.arc(sx, sy, sparkSize * 2.5, 0, Math.PI * 2)
      this.ctx.fill()

      this.ctx.fillStyle = `rgba(${LIGHTNING_WHITE.r}, ${LIGHTNING_WHITE.g}, ${LIGHTNING_WHITE.b}, ${alpha})`
      this.ctx.beginPath()
      this.ctx.arc(sx, sy, sparkSize, 0, Math.PI * 2)
      this.ctx.fill()
    }

    this.ctx.restore()
  }

  private drawArc(
    startX: number,
    startY: number,
    angle: number,
    length: number,
    segments: number,
    jitter: number,
    opacity: number,
    baseRadius: number,
    seed: number,
    lineWidthScale: number,
  ) {
    const points: Array<{ x: number; y: number }> = [{ x: startX, y: startY }]
    let cx = startX
    let cy = startY
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    const segLen = length / segments

    for (let s = 0; s < segments; s++) {
      const progress = (s + 1) / segments
      const jitterAmount = jitter * (0.5 + progress * 0.5)
      cx += dx * segLen + (seededRandom(seed + s * 7.1) - 0.5) * jitterAmount * baseRadius * 0.07
      cy += dy * segLen + (seededRandom(seed + s * 13.3) - 0.5) * jitterAmount * baseRadius * 0.07
      points.push({ x: cx, y: cy })
    }

    // Bright outer glow
    this.ctx.globalCompositeOperation = 'lighter'
    this.ctx.strokeStyle = `rgba(${LIGHTNING_COLOR.r}, ${LIGHTNING_COLOR.g}, ${LIGHTNING_COLOR.b}, ${opacity * 0.25})`
    this.ctx.lineWidth = Math.max(1.5, baseRadius * 0.06 * lineWidthScale)
    this.ctx.shadowColor = `rgba(${LIGHTNING_COLOR.r}, ${LIGHTNING_COLOR.g}, ${LIGHTNING_COLOR.b}, 0.8)`
    this.ctx.shadowBlur = Math.max(3, baseRadius * 0.12)
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.beginPath()
    this.ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y)
    }
    this.ctx.stroke()

    // Bright core line
    this.ctx.strokeStyle = `rgba(${LIGHTNING_WHITE.r}, ${LIGHTNING_WHITE.g}, ${LIGHTNING_WHITE.b}, ${opacity * 0.85})`
    this.ctx.lineWidth = Math.max(0.8, baseRadius * 0.02 * lineWidthScale)
    this.ctx.shadowColor = `rgba(${LIGHTNING_WHITE.r}, ${LIGHTNING_WHITE.g}, ${LIGHTNING_WHITE.b}, 0.9)`
    this.ctx.shadowBlur = Math.max(2, baseRadius * 0.06)
    this.ctx.beginPath()
    this.ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y)
    }
    this.ctx.stroke()
    this.ctx.shadowBlur = 0
  }
}
