import type { LightningDetection, LightningInstance } from './lightningTypes'

const GRACE_MS = 600
const FADE_MS = 350
const TAU = Math.PI * 2

type Rgb = { r: number; g: number; b: number }
type Pt = { x: number; y: number }

/** MediaPipe 21-point hand landmark indices used by the electricity paths. */
const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const

// Layered color system:
// Layer 1 - deep electric blue aura
// Layer 2 - bright blue/cyan main electricity
// Layer 3 - white-hot core
// Layer 4 - occasional violet accents
const AURA = { r: 0, g: 90, b: 255 }
const ELECTRIC = { r: 0, g: 205, b: 255 }
const CYAN = { r: 150, g: 245, b: 255 }
const WHITE = { r: 255, g: 255, b: 255 }
const VIOLET = { r: 175, g: 115, b: 255 }

const SPARK_COUNT = 8
const SPARK_ANCHORS = [0, 4, 8, 12, 16, 20, 9, 5]

interface Spark {
  lmIndex: number
  phase: number
  speed: number
  size: number
  baseOpacity: number
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function rgba(color: Rgb, alpha: number): string {
  return `rgba(${color.r},${color.g},${color.b},${clamp01(alpha)})`
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** Stable per-hand numeric seed so left/right hands desync completely. */
function handHash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 997
}

function createSparks(handId: string): Spark[] {
  const seed = handHash(handId)
  return Array.from({ length: SPARK_COUNT }, (_, i) => {
    const pick = Math.floor(seededRandom(seed + i * 1.7) * SPARK_ANCHORS.length)
    return {
      lmIndex: SPARK_ANCHORS[pick]!,
      phase: seededRandom(seed + i * 2.3) * TAU,
      speed: 0.4 + seededRandom(seed + i * 3.1) * 0.8,
      size: 0.7 + seededRandom(seed + i * 4.7) * 1.5,
      baseOpacity: 0.3 + seededRandom(seed + i * 5.9) * 0.35,
    }
  })
}

/** Index/middle/ring/pinky finger chains for transient traversal strokes. */
const FINGER_CHAINS = [
  { mcp: 5, pip: 6, dip: 7, tip: 8 },
  { mcp: 9, pip: 10, dip: 11, tip: 12 },
  { mcp: 13, pip: 14, dip: 15, tip: 16 },
  { mcp: 17, pip: 18, dip: 19, tip: 20 },
]

/**
 * A single electrical stroke generator. Slots are born/die on a cycle so the
 * hand is never covered by persistent connected lines: at any instant only a
 * fraction of slots are live, and each live slot shows one travelling energy
 * front instead of a full path.
 */
type StrokeKind = 'MAJOR' | 'SPINE' | 'FINGER' | 'FOREARM' | 'SURGE'

interface StrokeSlot {
  kind: StrokeKind
  /** Target fingertip landmark (-1 for roaming slots). */
  fingertip: number
  /** Full cycle length in ms. */
  cycle: number
  /** Fraction of the cycle the slot is live. */
  onFrac: number
  /** Relative width scale. */
  width: number
  /** Violet tinted accent. */
  violet: boolean
  /** Crawl from far end back toward the wrist/palm. */
  reverse: boolean
  seed: number
}

interface Forearm {
  dir: Pt
  len: number
  stable: boolean
}

function makeSlots(seed: number): StrokeSlot[] {
  const r = (i: number, salt: number) => seededRandom(seed * 0.71 + i * 13.37 + salt)
  const df = (i: number, base: number, span: number) => base + r(i, 1.1) * span
  return [
    { kind: 'MAJOR', fingertip: LM.INDEX_TIP, cycle: df(0, 800, 300), onFrac: 0.5, width: 1, violet: false, reverse: false, seed: seed * 3 + 101 },
    { kind: 'MAJOR', fingertip: LM.MIDDLE_TIP, cycle: df(1, 950, 280), onFrac: 0.42, width: 1, violet: false, reverse: false, seed: seed * 5 + 203 },
    { kind: 'MAJOR', fingertip: LM.PINKY_TIP, cycle: df(2, 720, 300), onFrac: 0.45, width: 0.9, violet: true, reverse: false, seed: seed * 7 + 307 },
    { kind: 'SPINE', fingertip: LM.MIDDLE_TIP, cycle: df(3, 620, 200), onFrac: 0.42, width: 0.8, violet: false, reverse: false, seed: seed * 11 + 401 },
    { kind: 'SPINE', fingertip: LM.INDEX_TIP, cycle: df(4, 700, 180), onFrac: 0.36, width: 0.7, violet: false, reverse: false, seed: seed * 13 + 503 },
    { kind: 'FINGER', fingertip: -1, cycle: df(5, 540, 220), onFrac: 0.36, width: 0.7, violet: false, reverse: false, seed: seed * 17 + 601 },
    { kind: 'FINGER', fingertip: -1, cycle: df(6, 620, 260), onFrac: 0.32, width: 0.65, violet: false, reverse: false, seed: seed * 19 + 701 },
    { kind: 'FINGER', fingertip: -1, cycle: df(7, 700, 240), onFrac: 0.34, width: 0.6, violet: false, reverse: true, seed: seed * 23 + 809 },
    { kind: 'FINGER', fingertip: -1, cycle: df(8, 520, 200), onFrac: 0.3, width: 0.7, violet: false, reverse: false, seed: seed * 29 + 907 },
    { kind: 'FINGER', fingertip: -1, cycle: df(9, 660, 220), onFrac: 0.32, width: 0.65, violet: false, reverse: false, seed: seed * 31 + 1009 },
    { kind: 'FOREARM', fingertip: -1, cycle: df(10, 720, 240), onFrac: 0.42, width: 0.9, violet: false, reverse: false, seed: seed * 37 + 1103 },
    { kind: 'FOREARM', fingertip: -1, cycle: df(11, 840, 220), onFrac: 0.36, width: 0.8, violet: false, reverse: false, seed: seed * 41 + 1207 },
    { kind: 'FOREARM', fingertip: -1, cycle: df(12, 920, 260), onFrac: 0.38, width: 0.7, violet: true, reverse: true, seed: seed * 43 + 1301 },
    { kind: 'SURGE', fingertip: -1, cycle: df(13, 520, 260), onFrac: 0.46, width: 0.85, violet: false, reverse: false, seed: seed * 47 + 1409 },
    { kind: 'SURGE', fingertip: -1, cycle: df(14, 640, 280), onFrac: 0.4, width: 0.92, violet: true, reverse: false, seed: seed * 53 + 1511 },
    { kind: 'SURGE', fingertip: -1, cycle: df(15, 760, 320), onFrac: 0.42, width: 0.87, violet: false, reverse: false, seed: seed * 59 + 1607 },
  ]
}

/**
 * Layered thickness profiles. Every strike draws the same stack so the effect
 * stays cohesive, but the *scale* of each layer creates the hierarchy:
 * primary wrist/hand shocks are fat, secondary are medium, finger crawls +
 * accents are thin. The white core stays visible on every layer.
 */
interface StrikeTier {
  outerW: number
  outerA: number
  bodyW: number
  bodyA: number
  innerW: number
  innerA: number
  coreW: number
  coreA: number
  tailW: number
  tailA: number
  channelW: number
  channelA: number
  headR: number
}

/** Large dominant strikes that carry the "power" read (MAJOR arcs, wrist SURGES). */
const TIER_PRIMARY: StrikeTier = {
  outerW: 0.26,
  outerA: 0.28,
  bodyW: 0.15,
  bodyA: 0.6,
  innerW: 0.075,
  innerA: 0.85,
  coreW: 0.035,
  coreA: 0.95,
  tailW: 0.1,
  tailA: 0.2,
  channelW: 0.12,
  channelA: 0.06,
  headR: 0.3,
}

/** Forearm + spine strokes: medium, clearly secondary to the major shocks. */
const TIER_SECONDARY: StrikeTier = {
  outerW: 0.14,
  outerA: 0.24,
  bodyW: 0.08,
  bodyA: 0.6,
  innerW: 0.04,
  innerA: 0.85,
  coreW: 0.019,
  coreA: 0.95,
  tailW: 0.055,
  tailA: 0.2,
  channelW: 0.085,
  channelA: 0.05,
  headR: 0.16,
}

/** Finger traversal strokes: thin detail that fills gaps, never competes. */
const TIER_FINGER: StrikeTier = {
  outerW: 0.06,
  outerA: 0.2,
  bodyW: 0.038,
  bodyA: 0.62,
  innerW: 0.019,
  innerA: 0.85,
  coreW: 0.009,
  coreA: 0.92,
  tailW: 0.028,
  tailA: 0.2,
  channelW: 0,
  channelA: 0,
  headR: 0.1,
}

export class LightningRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly sparksByHand = new Map<string, Spark[]>()
  private readonly strokeSlots = new Map<string, StrokeSlot[]>()
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
    this.sparksByHand.clear()
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
          this.drawLightning(visible, width, height, now, fade)
        }
      }
    }
    this.animationFrame = requestAnimationFrame(this.render)
  }

  private drawLightning(inst: LightningInstance, width: number, height: number, now: number, fade: number) {
    const detection = inst.detection
    const scale = Math.min(width, height)
    const refLen = Math.max(14, detection.palmSize * scale * 0.55)
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
    this.ctx.globalCompositeOperation = 'lighter'
    this.ctx.globalAlpha = globalAlpha

    const lms = detection.landmarks
    if (!lms || lms.length < 21 || !detection.palmPosition) {
      this.drawAuraFallback(detection, width, height, pulse, refLen)
      this.ctx.restore()
      return
    }

    const seed = handHash(inst.id)
    const phase = seed * 0.013
    const speedMul = charging
      ? 0.55 + 0.45 * animation
      : fading
        ? Math.max(0.12, animation)
        : 1
    const alphaMul = pulse * (0.9 + 0.18 * Math.sin(now / 370 + phase))

    const pts: Pt[] = Array.from({ length: 21 }, (_, i) => ({
      x: lms[i]!.x * width,
      y: lms[i]!.y * height,
    }))
    const palm = this.palmCenterOf(pts)
    const wrist = pts[LM.WRIST]!
    const forearm = this.forearmOf(pts, palm, wrist, refLen)

    // Layer 1 - outer electrical aura around the palm plus broad soft glows at the
    // lower hand and wrist so the surge occupies a larger volume around the wrist
    // instead of hugging the hand skeleton (all soft glows, no landmark lines)
    this.drawAura(palm, refLen, pulse)
    const lowHand = { x: palm.x * 0.62 + wrist.x * 0.38, y: palm.y * 0.62 + wrist.y * 0.38 }
    this.drawGlow(lowHand, refLen * 1.7, 0.3 * alphaMul)
    if (forearm.stable) this.drawGlow(wrist, refLen * 2.2, 0.27 * alphaMul)
    this.drawDot(palm, CYAN, refLen * 0.45 * pulse, 0.22 * alphaMul)

    // Transient electrical strokes: each slot is a desynced strike that travels
    // from its start anchor to its end anchor, then dies. Only a fraction of
    // slots are live at any instant, so no persistent landmark skeleton shows.
    let slots = this.strokeSlots.get(inst.id)
    if (!slots) {
      slots = makeSlots(seed)
      this.strokeSlots.set(inst.id, slots)
    }
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!
      const cycleBucket = Math.floor(now / slot.cycle)
      this.drawStroke(slot, cycleBucket, pts, palm, wrist, forearm, refLen, now, speedMul, alphaMul)
    }

    // Short violet electrical jumps between adjacent knuckles (accent only)
    const jumps = [
      { a: pts[LM.INDEX_MCP], b: pts[LM.MIDDLE_MCP], s: seed },
      { a: pts[LM.MIDDLE_MCP], b: pts[LM.RING_MCP], s: seed + 31 },
      { a: pts[LM.RING_MCP], b: pts[LM.PINKY_MCP], s: seed + 67 },
    ]
    for (let i = 0; i < jumps.length; i++) {
      const j = jumps[i]!
      this.drawKnuckleJump(j.a, j.b, Math.floor(now / 60) * 7 + j.s, j.s, refLen, alphaMul, now, phase + j.s)
    }

    // Pulsing knuckle / thumb hotspots (blink so they don't read as static joints)
    const nodes = [pts[LM.INDEX_MCP], pts[LM.MIDDLE_MCP], pts[LM.RING_MCP], pts[LM.PINKY_MCP], pts[LM.THUMB_TIP]]
    for (let i = 0; i < nodes.length; i++) {
      this.drawHotspot(nodes[i]!, refLen, phase + i * 2.1, now, seed + i * 7, alphaMul)
    }

    // Fingertip discharges extending just beyond the tips
    const tips = [pts[LM.INDEX_TIP], pts[LM.MIDDLE_TIP], pts[LM.RING_TIP], pts[LM.PINKY_TIP], pts[LM.THUMB_TIP]]
    for (let i = 0; i < tips.length; i++) {
      this.drawDischarge(tips[i]!, palm, seed + i * 13, refLen, alphaMul, now, phase + i * 1.7)
    }

    this.drawSparks(inst, pts, refLen, alphaMul, now)

    this.ctx.restore()
  }

  private drawAuraFallback(detection: LightningDetection, width: number, height: number, pulse: number, refLen: number) {
    const pos = detection.palmPosition
    if (!pos) return
    const p = { x: pos.x * width, y: pos.y * height }
    this.drawAura(p, refLen, pulse)
    this.drawDot(p, CYAN, refLen * 0.4 * pulse, 0.3)
  }

  private drawAura(p: Pt, refLen: number, pulse: number) {
    const r = refLen * 2.6 * pulse
    const gradient = this.ctx.createRadialGradient(p.x, p.y, refLen * 0.1, p.x, p.y, r)
    gradient.addColorStop(0, rgba(AURA, 0.3))
    gradient.addColorStop(0.35, rgba(ELECTRIC, 0.13))
    gradient.addColorStop(0.75, rgba(AURA, 0.05))
    gradient.addColorStop(1, rgba(ELECTRIC, 0))
    this.ctx.fillStyle = gradient
    this.ctx.beginPath()
    this.ctx.arc(p.x, p.y, r, 0, TAU)
    this.ctx.fill()
  }

  /** Broad soft radial glow around a point, used to build volume around the wrist/lower hand. */
  private drawGlow(p: Pt, radius: number, alpha: number) {
    if (alpha <= 0) return
    const gradient = this.ctx.createRadialGradient(p.x, p.y, radius * 0.06, p.x, p.y, radius)
    gradient.addColorStop(0, rgba(AURA, alpha))
    gradient.addColorStop(0.45, rgba(ELECTRIC, alpha * 0.4))
    gradient.addColorStop(1, rgba(ELECTRIC, 0))
    this.ctx.fillStyle = gradient
    this.ctx.beginPath()
    this.ctx.arc(p.x, p.y, radius, 0, TAU)
    this.ctx.fill()
  }

  private drawDot(p: Pt, glow: Rgb, radius: number, alpha: number) {
    if (alpha <= 0) return
    this.ctx.fillStyle = rgba(glow, alpha * 0.45)
    this.ctx.beginPath()
    this.ctx.arc(p.x, p.y, Math.max(0.5, radius * 1.8), 0, TAU)
    this.ctx.fill()
    this.ctx.fillStyle = rgba(WHITE, clamp01(alpha))
    this.ctx.beginPath()
    this.ctx.arc(p.x, p.y, Math.max(0.5, radius * 0.4), 0, TAU)
    this.ctx.fill()
  }

  private palmCenterOf(pts: Pt[]): Pt {
    let x = 0
    let y = 0
    for (const i of [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP]) {
      x += pts[i]!.x
      y += pts[i]!.y
    }
    return { x: x / 5, y: y / 5 }
  }

  /** Shift a landmark slightly away from the palm so arcs float off the hand without detaching. */
  private pullOut(p: Pt, palm: Pt, refLen: number, now: number, phase: number, base = 0.07): Pt {
    const dx = p.x - palm.x
    const dy = p.y - palm.y
    const d = Math.hypot(dx, dy) || 1
    const pull = refLen * (base + 0.1 * (0.5 + 0.5 * Math.sin(now / 400 + phase)))
    return { x: p.x + (dx / d) * pull, y: p.y + (dy / d) * pull }
  }

  /** Direction from the wrist toward the forearm using only hand landmarks. */
  private forearmOf(pts: Pt[], palm: Pt, wrist: Pt, refLen: number): Forearm {
    const dx = palm.x - wrist.x
    const dy = palm.y - wrist.y
    const d = Math.hypot(dx, dy)
    if (d > refLen * 0.35) {
      return { dir: { x: -dx / d, y: -dy / d }, len: refLen * 1.25, stable: true }
    }
    const mcp = pts[LM.MIDDLE_MCP]
    if (mcp) {
      const mx = wrist.x - mcp.x
      const my = wrist.y - mcp.y
      const md = Math.hypot(mx, my)
      if (md > 1e-3) return { dir: { x: mx / md, y: my / md }, len: refLen * 1.25, stable: true }
    }
    return { dir: { x: 0, y: 0 }, len: 0, stable: false }
  }

  /** Phase of a stroke slot: travelling head position while live, fade-out after. */
  private slotState(now: number, speedMul: number, slot: StrokeSlot): { head: number; fade: number } {
    const frac = (now * speedMul) / slot.cycle + slot.seed
    const p = frac % 1
    if (p < slot.onFrac) return { head: p / slot.onFrac, fade: 1 }
    const tail = (p - slot.onFrac) / 0.12
    if (tail < 1) return { head: 1, fade: 1 - tail }
    return { head: 1, fade: 0 }
  }

  /** Pick the anchor path a stroke travels along this cycle. */
  private slotPath(
    slot: StrokeSlot,
    cycleBucket: number,
    pts: Pt[],
    palm: Pt,
    wrist: Pt,
    forearm: Forearm,
    refLen: number,
    now: number,
    phase: number
  ): Pt[] | null {
    if (slot.kind === 'MAJOR') {
      const tip = pts[slot.fingertip]
      if (!tip) return null
      // Pull the endpoint well clear of the fist, then bow the path strongly
      // outward (up to ~1.2x refLen perpendicular) so the arc reads as a large
      // discharge rather than a line following the hand.
      const out = this.pullOut(tip, palm, refLen, now, phase, 0.42)
      const dx = out.x - wrist.x
      const dy = out.y - wrist.y
      const d = Math.hypot(dx, dy) || 1
      const ux = dx / d
      const uy = dy / d
      const side = seededRandom(slot.seed + cycleBucket * 3.1) > 0.5 ? 1 : -1
      const bow = refLen * (0.62 + seededRandom(slot.seed + cycleBucket * 7.3) * 0.55) * side
      const bow2 = refLen * (0.4 + seededRandom(slot.seed + cycleBucket * 19.7) * 0.45) * side
      const c1 = { x: wrist.x + ux * refLen * 0.45 - uy * bow, y: wrist.y + uy * refLen * 0.45 + ux * bow }
      const c2 = { x: wrist.x + ux * refLen * 0.85 - uy * (bow + bow2) * 0.55, y: wrist.y + uy * refLen * 0.85 + ux * (bow + bow2) * 0.55 }
      return [wrist, c1, c2, out]
    }
    if (slot.kind === 'SURGE') {
      // Large wrist-originating shock: travels outward in a seeded fan around
      // the wrist, overlapping the forearm region on the forearm-aligned ones
      // so wrist -> forearm feel like one electrical system.
      if (!forearm.stable || forearm.len <= 0) return null
      const sidePick = seededRandom(slot.seed + cycleBucket * 13.7)
      let dir: Pt
      if (sidePick < 0.6) dir = forearm.dir
      else if (sidePick < 0.8) dir = { x: -forearm.dir.y, y: forearm.dir.x }
      else dir = { x: forearm.dir.y, y: -forearm.dir.x }
      const ang = (seededRandom(slot.seed + cycleBucket * 3.9) - 0.5) * 1.4
      const ca = Math.cos(ang)
      const sa = Math.sin(ang)
      const rot = { x: dir.x * ca - dir.y * sa, y: dir.x * sa + dir.y * ca }
      const len = refLen * (1.6 + seededRandom(slot.seed + cycleBucket * 29.7) * 1.3)
      const px = -rot.y
      const py = rot.x
      const drift = refLen * 0.5 * (seededRandom(slot.seed + cycleBucket * 5.9) > 0.5 ? 1 : -1)
      const origin = { x: wrist.x + forearm.dir.x * refLen * 0.12, y: wrist.y + forearm.dir.y * refLen * 0.12 }
      const mid = { x: origin.x + rot.x * len * 0.5 + px * drift, y: origin.y + rot.y * len * 0.5 + py * drift }
      const end = { x: origin.x + rot.x * len + px * drift * 0.4, y: origin.y + rot.y * len + py * drift * 0.4 }
      return [origin, mid, end]
    }
    if (slot.kind === 'SPINE') {
      const mcp = pts[slot.fingertip - 3]
      if (!mcp) return null
      const pip = pts[slot.fingertip - 2]
      if (!pip) return null
      return [wrist, palm, mcp, pip]
    }
    if (slot.kind === 'FINGER') {
      const pick = Math.floor(seededRandom(slot.seed + cycleBucket * 11.7) * 5)
      const cand: (Pt | undefined)[] =
        pick === 4
          ? [palm, pts[LM.THUMB_CMC], pts[LM.THUMB_MCP], pts[LM.THUMB_IP], pts[LM.THUMB_TIP]]
          : (() => {
              const ch = FINGER_CHAINS[pick]!
              return [palm, pts[ch.mcp], pts[ch.pip], pts[ch.dip], pts[ch.tip]]
            })()
      if (!cand.every((p) => Boolean(p))) return null
      const cpts = cand as Pt[]
      return slot.reverse ? [...cpts].reverse() : cpts
    }
    if (slot.kind === 'FOREARM') {
      if (!forearm.stable || forearm.len <= 0) return null
      const side = seededRandom(slot.seed + cycleBucket * 5.3) > 0.5 ? 1 : -1
      const bend = refLen * 0.16 * side
      const len = forearm.len * (0.9 + seededRandom(slot.seed + cycleBucket * 2.9) * 0.5)
      const px = -forearm.dir.y
      const py = forearm.dir.x
      const mid = { x: wrist.x + forearm.dir.x * len * 0.5 + px * bend, y: wrist.y + forearm.dir.y * len * 0.5 + py * bend }
      const end = { x: wrist.x + forearm.dir.x * len, y: wrist.y + forearm.dir.y * len }
      return slot.reverse ? [end, mid, wrist, palm] : [wrist, mid, end]
    }
    return null
  }

  /** Draw a single stroke: jagged path, travelling bright front, dim tail, head glow. */
  private drawStroke(
    slot: StrokeSlot,
    cycleBucket: number,
    pts: Pt[],
    palm: Pt,
    wrist: Pt,
    forearm: Forearm,
    refLen: number,
    now: number,
    speedMul: number,
    alphaMul: number
  ) {
    const { head, fade } = this.slotState(now, speedMul, slot)
    if (fade <= 0) return
    const path = this.slotPath(slot, cycleBucket, pts, palm, wrist, forearm, refLen, now, slot.seed)
    if (!path || path.length < 2) return
    const tier =
      slot.kind === 'MAJOR' || slot.kind === 'SURGE'
        ? TIER_PRIMARY
        : slot.kind === 'FINGER'
          ? TIER_FINGER
          : TIER_SECONDARY
    const sub = slot.kind === 'MAJOR' || slot.kind === 'SURGE' ? 3 : 2
    const jitter = slot.kind === 'SURGE' ? 0.4 : 0.5
    const regen = slot.seed + cycleBucket * 37
    const bolt = this.boltPoints(path, jitter, regen, now, slot.seed, sub)
    this.drawFront(bolt, refLen, head, slot.width, alphaMul, fade, tier, slot.violet)

    if (head < 1 || fade < 1) {
      if (slot.kind === 'MAJOR') this.drawMajorBranch(bolt, slot, refLen, alphaMul, now, fade)
      if (slot.kind === 'SURGE') this.drawSurgeBranch(bolt, slot, refLen, alphaMul, now, fade)
      if (slot.kind === 'FOREARM') this.drawForearmSide(bolt, forearm, slot, refLen, alphaMul, now, fade)
    }
  }

  /** Travelling front with layered thickness: broad electric body -> cyan -> bright inner -> thin white-hot core + leading head. */
  private drawFront(points: Pt[], refLen: number, head: number, widthMul: number, alphaMul: number, fade: number, tier: StrikeTier, violet: boolean) {
    const { lengths, total } = this.pathMetrics(points)
    if (total <= 0 || points.length < 2) return
    const headPos = Math.min(Math.max(head, 0), 1) * total
    const bodyLen = total * 0.34
    const headT = Math.max(1e-3, headPos / total)
    const bodyT0 = Math.max(0, (headPos - bodyLen) / total)
    const tailT0 = Math.max(0, (headPos - bodyLen - total * 0.5) / total)
    const fadeA = alphaMul * fade

    if (tier.channelW > 0) this.strokePath(points, CYAN, Math.max(2, refLen * tier.channelW), tier.channelA * fadeA)

    this.drawBoltSegment(points, lengths, total, tailT0, bodyT0, ELECTRIC, Math.max(1, refLen * tier.tailW * widthMul), tier.tailA * fadeA)
    this.drawBoltSegment(points, lengths, total, bodyT0, headT, ELECTRIC, Math.max(2, refLen * tier.outerW * widthMul), tier.outerA * fadeA)
    this.drawBoltSegment(points, lengths, total, bodyT0, headT, CYAN, Math.max(1.5, refLen * tier.bodyW * widthMul), tier.bodyA * fadeA)
    if (violet) this.drawBoltSegment(points, lengths, total, bodyT0, headT, VIOLET, Math.max(1.2, refLen * tier.bodyW * 0.6 * widthMul), 0.3 * fadeA)
    this.drawBoltSegment(points, lengths, total, bodyT0, headT, CYAN, Math.max(0.9, refLen * tier.innerW * widthMul), tier.innerA * fadeA)
    this.drawBoltSegment(points, lengths, total, bodyT0, headT, WHITE, Math.max(0.5, refLen * tier.coreW * widthMul), tier.coreA * fadeA)

    const tip = this.pointAt(points, lengths, total, headPos)
    this.drawDot(tip, CYAN, Math.max(1, refLen * tier.headR * widthMul) * 0.6, 0.5 * fadeA)
    this.drawDot(tip, WHITE, Math.max(0.7, refLen * tier.headR * widthMul * 0.35), 0.92 * fadeA)
  }

  /** Shared small jagged offshoot used by major arcs and wrist surges. */
  private drawBranchSegment(
    points: Pt[],
    lengths: number[],
    total: number,
    at: number,
    side: number,
    len: number,
    refLen: number,
    seed: number,
    now: number,
    phase: number,
    alpha: number,
    violet: boolean
  ) {
    const start = this.pointAt(points, lengths, total, at * total)
    const ahead = this.pointAt(points, lengths, total, Math.min(total, at * total + refLen * 0.18))
    let tx = ahead.x - start.x
    let ty = ahead.y - start.y
    const td = Math.hypot(tx, ty) || 1
    if (td < 1e-3) return
    tx /= td
    ty /= td
    const target = { x: start.x + (tx - ty * side) * len, y: start.y + (ty + tx * side) * len }
    const branch = this.boltPoints([start, target], 0.45, seed + Math.floor(now / 60), now, phase, 2)
    this.strokePath(branch, ELECTRIC, Math.max(1.2, refLen * 0.06), alpha * 0.3)
    this.strokePath(branch, violet ? VIOLET : CYAN, Math.max(1, refLen * 0.045), alpha)
    this.strokePath(branch, WHITE, Math.max(0.5, refLen * 0.016), alpha * 1.4)
  }

  /** Violet branches flicking off an active major arc (sometimes doubling). */
  private drawMajorBranch(bolt: Pt[], slot: StrokeSlot, refLen: number, alphaMul: number, now: number, fade: number) {
    const gate = Math.sin(now / 240 + slot.seed * 0.37 + (Math.floor(now / slot.cycle) % 5))
    if (gate <= 0.15) return
    const { lengths, total } = this.pathMetrics(bolt)
    if (total <= 0) return
    const cycleBucket = Math.floor(now / slot.cycle)
    const t = 0.38 + seededRandom(slot.seed + cycleBucket * 17.3) * 0.34
    const side = seededRandom(slot.seed + cycleBucket * 3.7) > 0.5 ? 1 : -1
    const len = refLen * (0.5 + seededRandom(slot.seed + cycleBucket * 23.1) * 0.4)
    const a = Math.min(1, gate) * 0.55 * alphaMul * fade
    this.drawBranchSegment(bolt, lengths, total, t, side, len, refLen, slot.seed, now, slot.seed, a, true)
    if (gate > 0.7) {
      const t2 = t + 0.2
      if (t2 < 0.95) this.drawBranchSegment(bolt, lengths, total, t2, -side, len * 0.65, refLen, slot.seed + 17, now, slot.seed, a * 0.7, true)
    }
  }

  /** One or two violet/cyan branches off a wrist surge, staggered in time. */
  private drawSurgeBranch(bolt: Pt[], slot: StrokeSlot, refLen: number, alphaMul: number, now: number, fade: number) {
    const gate = Math.sin(now / 230 + slot.seed * 0.43 + (Math.floor(now / slot.cycle) % 5))
    if (gate <= 0.1) return
    const { lengths, total } = this.pathMetrics(bolt)
    if (total <= 0) return
    const cycleBucket = Math.floor(now / slot.cycle)
    const t = 0.4 + seededRandom(slot.seed + cycleBucket * 41.3) * 0.3
    const side = seededRandom(slot.seed + cycleBucket * 3.7) > 0.5 ? 1 : -1
    const len = refLen * (0.55 + seededRandom(slot.seed + cycleBucket * 23.1) * 0.5)
    const a = Math.min(1, gate) * 0.5 * alphaMul * fade
    this.drawBranchSegment(bolt, lengths, total, t, side, len, refLen, slot.seed, now, slot.seed, a, slot.violet)
    if (gate > 0.6) {
      const t2 = t + 0.18
      if (t2 < 0.95) this.drawBranchSegment(bolt, lengths, total, t2, -side, len * 0.7, refLen, slot.seed + 23, now, slot.seed, a * 0.7, slot.violet)
    }
  }

  /** Tiny electric discharge flicking sideways off a forearm stroke. */
  private drawForearmSide(bolt: Pt[], forearm: Forearm, slot: StrokeSlot, refLen: number, alphaMul: number, now: number, fade: number) {
    if (!forearm.stable) return
    const gate = Math.sin(now / 300 + slot.seed * 0.51)
    if (gate <= 0.1) return
    const { lengths, total } = this.pathMetrics(bolt)
    if (total <= 0) return
    const t = 0.45 + seededRandom(slot.seed + Math.floor(now / 240) * 7.7) * 0.25
    const start = this.pointAt(bolt, lengths, total, t * total)
    const px = -forearm.dir.y
    const py = forearm.dir.x
    const len = refLen * (0.2 + Math.max(0, gate) * 0.12)
    const side = seededRandom(slot.seed + Math.floor(now / 240) * 3.3) > 0.5 ? 1 : -1
    const target = { x: start.x + px * len * side, y: start.y + py * len * side }
    const branch = this.boltPoints([start, target], 0.5, slot.seed + Math.floor(now / 50), now, slot.seed, 2)
    const a = Math.min(1, gate) * 0.5 * alphaMul * fade
    this.strokePath(branch, ELECTRIC, Math.max(1, refLen * 0.035), a)
    this.strokePath(branch, WHITE, Math.max(0.5, refLen * 0.012), a * 1.5)
  }

  /** Jagged polyline between control points with seeded jitter plus time evolution. */
  private boltPoints(cpts: Pt[], jitter: number, seed: number, now: number, wobblePhase: number, sub = 2): Pt[] {
    if (cpts.length < 2) return cpts
    const out: Pt[] = [{ x: cpts[0]!.x, y: cpts[0]!.y }]
    let idx = 0
    for (let s = 0; s < cpts.length - 1; s++) {
      const a = cpts[s]
      const b = cpts[s + 1]
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const segLen = Math.hypot(dx, dy) || 1e-6
      const px = -dy / segLen
      const py = dx / segLen
      for (let k = 1; k <= sub; k++) {
        idx++
        const f = k / (sub + 1)
        const jr = (seededRandom(seed + idx * 7.13) - 0.5) * 2
        const wob = Math.sin(now / 95 + wobblePhase + idx * 1.9) * 0.35
        const off = (jr * jitter + wob) * segLen
        out.push({ x: a.x + dx * f + px * off, y: a.y + dy * f + py * off })
      }
      out.push({ x: b.x, y: b.y })
    }
    return out
  }

  private pathMetrics(points: Pt[]) {
    const lengths: number[] = [0]
    let total = 0
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
      lengths.push(total)
    }
    return { lengths, total }
  }

  private pointAt(points: Pt[], lengths: number[], total: number, dist: number): Pt {
    const first = points[0]
    if (!first || points.length < 2 || total <= 0) return first ?? { x: 0, y: 0 }
    const d = Math.min(Math.max(0, dist), total)
    let i = 1
    while (i < lengths.length - 1 && lengths[i]! < d) i++
    const segStart = lengths[i - 1]!
    const segLen = lengths[i]! - segStart
    const f = segLen > 0 ? (d - segStart) / segLen : 0
    const a = points[i - 1]
    const b = points[i]
    return { x: a!.x + (b!.x - a!.x) * f, y: a!.y + (b!.y - a!.y) * f }
  }

  private strokePath(points: Pt[], color: Rgb, width: number, alpha: number) {
    if (points.length < 2 || alpha <= 0) return
    this.ctx.strokeStyle = rgba(color, alpha)
    this.ctx.lineWidth = width
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.beginPath()
    this.ctx.moveTo(points[0]!.x, points[0]!.y)
    for (let i = 1; i < points.length; i++) this.ctx.lineTo(points[i]!.x, points[i]!.y)
    this.ctx.stroke()
  }

  /** Draw only the [t0, t1] parametric section of a bolt path. */
  private drawBoltSegment(points: Pt[], lengths: number[], total: number, t0: number, t1: number, color: Rgb, width: number, alpha: number) {
    if (alpha <= 0 || t1 <= t0 || points.length < 2) return
    const n = 12
    const segment: Pt[] = []
    for (let i = 0; i <= n; i++) {
      const t = t0 + (t1 - t0) * (i / n)
      segment.push(this.pointAt(points, lengths, total, t * total))
    }
    this.strokePath(segment, color, width, alpha)
  }

  /** Rapid short arcs jumping between adjacent knuckles. */
  private drawKnuckleJump(a: Pt, b: Pt, regenSeed: number, base: number, refLen: number, alphaMul: number, now: number, phase: number) {
    const gate = Math.sin(now / (700 + (base % 47) * 21) + phase * 2)
    if (gate <= 0.4) return
    const points = this.boltPoints([a, b], 0.5, regenSeed, now, phase + 7, 2)
    const alpha = Math.min(1, (gate - 0.4) / 0.6) * 0.85 * alphaMul
    this.strokePath(points, VIOLET, Math.max(1.3, refLen * 0.05), 0.5 * alpha)
    this.strokePath(points, WHITE, Math.max(0.6, refLen * 0.018), 0.9 * alpha)
  }

  /** Pulsing energy concentration at a knuckle / fingertip. */
  private drawHotspot(p: Pt, refLen: number, phase: number, now: number, seed: number, alphaMul: number) {
    const slow = Math.sin(now / (1500 + (seed % 139) * 17) + phase)
    const fast = Math.sin(now / 90 + phase * 3)
    const pulse = 0.45 + 0.55 * (0.5 + 0.5 * slow) + 0.15 * fast
    const r = refLen * (0.05 + 0.025 * pulse)
    this.drawDot(p, CYAN, r * 1.6, 0.55 * alphaMul * clamp01(0.6 + 0.4 * pulse))
  }

  /** Occasional short electrical discharge just beyond a fingertip. */
  private drawDischarge(tip: Pt, palm: Pt, seed: number, refLen: number, alphaMul: number, now: number, phase: number) {
    const gate = Math.sin(now / (900 + (seed % 71) * 23) + phase * 3)
    if (gate <= 0.5) return
    const dx = tip.x - palm.x
    const dy = tip.y - palm.y
    const d = Math.hypot(dx, dy) || 1
    const len = refLen * (0.13 + 0.1 * Math.max(0, gate - 0.5))
    const end = { x: tip.x + (dx / d) * len, y: tip.y + (dy / d) * len }
    const points = this.boltPoints([tip, end], 0.5, seed + Math.floor(now / 45), now, phase, 2)
    const alpha = Math.min(1, (gate - 0.5) / 0.5) * 0.8 * alphaMul
    this.strokePath(points, CYAN, Math.max(1, refLen * 0.035), 0.55 * alpha)
    this.strokePath(points, WHITE, Math.max(0.5, refLen * 0.012), 0.85 * alpha)
  }

  /** Small flickering sparks anchored near actual hand landmarks. */
  private drawSparks(inst: LightningInstance, pts: Pt[], refLen: number, alphaMul: number, now: number) {
    let sparks = this.sparksByHand.get(inst.id)
    if (!sparks) {
      sparks = createSparks(inst.id)
      this.sparksByHand.set(inst.id, sparks)
    }
    for (const spark of sparks) {
      const base = pts[spark.lmIndex]
      if (!base) continue
      const ang = spark.phase + now * spark.speed * 0.004
      const breathe = 0.6 + 0.4 * Math.sin(now / 660 + spark.phase * 3)
      const radius = refLen * 0.2 * breathe
      const sx = base.x + Math.cos(ang) * radius
      const sy = base.y + Math.sin(ang) * radius
      const flicker = 0.35 + 0.65 * Math.abs(Math.sin(now / (26 + spark.phase * 19) + spark.phase))
      const alpha = spark.baseOpacity * flicker * alphaMul
      this.drawDot({ x: sx, y: sy }, CYAN, spark.size * refLen * 0.055, alpha)
    }
  }
}
