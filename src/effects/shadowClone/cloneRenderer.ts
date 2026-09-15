import type { ShadowClone, ShadowCloneFrame } from './cloneTypes'

interface SmokePuff {
  x: number
  y: number
  radius: number
  drift: number
  phase: number
  opacity: number
}

const SMOKE_PUFFS: SmokePuff[] = [
  { x: -0.09, y: 0.05, radius: 0.1, drift: 0.04, phase: 0.2, opacity: 0.9 },
  { x: 0.02, y: -0.02, radius: 0.14, drift: 0.06, phase: 1.7, opacity: 0.8 },
  { x: 0.11, y: 0.06, radius: 0.09, drift: 0.05, phase: 3.1, opacity: 0.86 },
  { x: -0.02, y: 0.12, radius: 0.12, drift: 0.03, phase: 4.4, opacity: 0.72 },
  { x: -0.16, y: -0.03, radius: 0.07, drift: 0.05, phase: 5.5, opacity: 0.76 },
  { x: 0.17, y: -0.01, radius: 0.08, drift: 0.04, phase: 2.5, opacity: 0.7 },
]

function drawClone(
  ctx: CanvasRenderingContext2D,
  personCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  frame: ShadowCloneFrame,
) {
  ctx.save()
  ctx.globalAlpha = frame.opacity
  ctx.filter = 'blur(0.35px) brightness(0.92) saturate(0.86)'
  ctx.translate(width / 2 + frame.x * width, height / 2 + frame.y * height)
  ctx.rotate(frame.rotation)
  ctx.scale(frame.scale, frame.scale)
  ctx.translate(-width / 2, -height / 2)
  ctx.drawImage(personCanvas, 0, 0, personCanvas.width, personCanvas.height, 0, 0, width, height)
  ctx.restore()
}

function drawSmokePuff(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  size: number,
  opacity: number,
) {
  const radius = size * Math.min(width, height)
  const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.08, centerX, centerY, radius)
  gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.72})`)
  gradient.addColorStop(0.48, `rgba(232, 237, 241, ${opacity * 0.34})`)
  gradient.addColorStop(1, 'rgba(220, 227, 232, 0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.ellipse(centerX, centerY, radius, radius * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawSmoke(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedMs: number,
  fadeProgress: number,
) {
  const smokeProgress = Math.min(1, elapsedMs / 1500)
  const smokeOpacity = Math.max(0, 0.76 * (1 - smokeProgress) * (1 - fadeProgress))
  const burstTimes = [900, 1000, 1200, 1300]
  const burstPositions = [-0.25, 0.25, 0.2, 0.03]

  if (smokeOpacity === 0 && elapsedMs > 1700) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (const puff of SMOKE_PUFFS) {
    const drift = Math.sin(elapsedMs / 260 + puff.phase) * puff.drift * smokeProgress
    const x = width / 2 + (puff.x + drift) * width
    const y = height * 0.6 + (puff.y - smokeProgress * 0.08) * height
    const size = puff.radius * (0.55 + smokeProgress * 1.2)
    drawSmokePuff(ctx, width, height, x, y, size, smokeOpacity * puff.opacity)
  }

  for (let index = 0; index < burstTimes.length; index += 1) {
    const burstProgress = Math.min(1, Math.max(0, (elapsedMs - burstTimes[index]) / 420))
    if (burstProgress <= 0 || burstProgress >= 1) continue
    const x = width / 2 + burstPositions[index] * width
    const y = height * 0.6
    drawSmokePuff(ctx, width, height, x, y, 0.08 + burstProgress * 0.11, 0.62 * (1 - burstProgress))
  }
  ctx.restore()
}

export function renderShadowCloneFrame(
  ctx: CanvasRenderingContext2D,
  personCanvas: HTMLCanvasElement,
  clones: ShadowClone[],
  frames: ShadowCloneFrame[],
  width: number,
  height: number,
  elapsedMs: number,
  fadeProgress: number,
) {
  ctx.clearRect(0, 0, width, height)
  for (let index = 0; index < clones.length; index += 1) {
    drawClone(ctx, personCanvas, width, height, frames[index])
  }
  drawSmoke(ctx, width, height, elapsedMs, fadeProgress)
}