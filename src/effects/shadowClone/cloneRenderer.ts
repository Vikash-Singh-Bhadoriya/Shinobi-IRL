import type { ShadowClone, ShadowCloneFrame } from './cloneTypes'

interface SmokeParticle {
  angle: number
  distance: number
  size: number
}

const SMOKE_PARTICLES: SmokeParticle[] = Array.from({ length: 12 }, (_, index) => ({
  angle: (index / 12) * Math.PI * 2,
  distance: 0.06 + (index % 4) * 0.035,
  size: 0.035 + (index % 3) * 0.018,
}))

function drawVideoCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number) {
  const sourceRatio = video.videoWidth / video.videoHeight
  const targetRatio = width / height
  let sourceX = 0
  let sourceY = 0
  let sourceWidth = video.videoWidth
  let sourceHeight = video.videoHeight

  if (sourceRatio > targetRatio) {
    sourceWidth = video.videoHeight * targetRatio
    sourceX = (video.videoWidth - sourceWidth) / 2
  } else if (sourceRatio < targetRatio) {
    sourceHeight = video.videoWidth / targetRatio
    sourceY = (video.videoHeight - sourceHeight) / 2
  }

  ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height)
}

function drawClone(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number, frame: ShadowCloneFrame) {
  ctx.save()
  ctx.globalAlpha = frame.opacity
  ctx.filter = 'blur(1.2px) saturate(0.7)'
  ctx.translate(width / 2 + frame.x * width, height / 2 + frame.y * height)
  ctx.rotate(frame.rotation)
  ctx.scale(frame.scale, frame.scale)
  ctx.translate(-width / 2, -height / 2)
  drawVideoCover(ctx, video, width, height)
  ctx.restore()
}

function drawSmoke(ctx: CanvasRenderingContext2D, width: number, height: number, progress: number) {
  const smokeOpacity = Math.max(0, 0.42 * (1 - progress))
  if (smokeOpacity === 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (const particle of SMOKE_PARTICLES) {
    const distance = particle.distance * (0.5 + progress * 1.8)
    const x = width / 2 + Math.cos(particle.angle) * distance * width
    const y = height * 0.58 + Math.sin(particle.angle) * distance * height
    const radius = particle.size * Math.min(width, height) * (0.6 + progress)
    ctx.fillStyle = `rgba(245, 249, 255, ${smokeOpacity})`
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function renderShadowCloneFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  clones: ShadowClone[],
  frames: ShadowCloneFrame[],
  width: number,
  height: number,
  progress: number,
) {
  ctx.clearRect(0, 0, width, height)
  drawVideoCover(ctx, video, width, height)
  for (let index = 0; index < clones.length; index += 1) {
    drawClone(ctx, video, width, height, frames[index])
  }
  drawSmoke(ctx, width, height, progress)
}