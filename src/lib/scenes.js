// Pièces « 3D » des maquettes, en custom elements dessinés sur un <canvas> 2D :
//   <dw-globe>   globe des sujets du jour (accueil, géopolitique) — attributs theme, spots, aim
//   <dw-ribbons> un ruban par actif (marchés)                    — attributs theme, series
//   <dw-wave>    champ de points qui respire (actu, veille)      — attribut theme
// Projection perspective faite à la main : aucune dépendance, et pas de WebGL
// (indisponible sur certains postes : accélération matérielle coupée, VM, pilote bloqué).

const PAL = {
  light: { ink: '#201e1d', acc: '#ec3013' },
  dark: { ink: '#f1efee', acc: '#ff563c' },
}
const rng = (seed) => {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}
const json = (el, name, fallback) => {
  try { return JSON.parse(el.getAttribute(name) || 'null') || fallback } catch { return fallback }
}
const norm = ([x, y, z]) => {
  const l = Math.hypot(x, y, z) || 1
  return [x / l, y / l, z / l]
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

class Base extends HTMLElement {
  static get observedAttributes() { return ['theme'] }
  get pal() { return PAL[this.getAttribute('theme') === 'dark' ? 'dark' : 'light'] }

  connectedCallback() {
    // Plein cadre : respecte un positionnement absolu posé par la page (classe .scene)
    this.style.display = 'block'
    if (getComputedStyle(this).position === 'static') Object.assign(this.style, { position: 'relative', width: '100%', height: '100%' })
    const cv = document.createElement('canvas')
    Object.assign(cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' })
    this.appendChild(cv)
    this.cv = cv
    this.ctx = cv.getContext('2d')
    this.W = 0
    this.H = 0
    this.m = { x: 0, y: 0, tx: 0, ty: 0 }
    this.P = { x: 0, y: 0, z: 0 }
    this.addEventListener('pointermove', (e) => {
      const b = this.getBoundingClientRect()
      this.m.tx = ((e.clientX - b.left) / b.width) * 2 - 1
      this.m.ty = ((e.clientY - b.top) / b.height) * 2 - 1
    })
    this.addEventListener('pointerleave', () => { this.m.tx = 0; this.m.ty = 0 })
    this.init()

    this._ro = new ResizeObserver(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      this.W = this.clientWidth
      this.H = this.clientHeight
      this.dpr = dpr
      cv.width = Math.round(this.W * dpr)
      cv.height = Math.round(this.H * dpr)
      this.lens()
      this.dirty = true
    })
    this._ro.observe(this)
    // On ne dessine que ce qui est visible à l'écran
    this.vis = true
    this._io = new IntersectionObserver(([e]) => { this.vis = e.isIntersecting })
    this._io.observe(this)

    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const t0 = performance.now()
    const loop = () => {
      this._raf = requestAnimationFrame(loop)
      if (!this.vis || !this.W || !this.H || (still && !this.dirty)) return
      this.dirty = false
      this.m.x += (this.m.tx - this.m.x) * 0.05
      this.m.y += (this.m.ty - this.m.y) * 0.05
      const ctx = this.ctx
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
      ctx.clearRect(0, 0, this.W, this.H)
      this.draw(ctx, still ? 4 : (performance.now() - t0) / 1000)
      ctx.globalAlpha = 1
    }
    loop()
  }
  disconnectedCallback() {
    cancelAnimationFrame(this._raf)
    this._ro && this._ro.disconnect()
    this._io && this._io.disconnect()
    this.cv && this.cv.remove()
  }
  attributeChangedCallback() { this.dirty = true }

  // Caméra perspective (fov vertical, comme three.js) placée en `eye`, visant `target`
  camera(eye, target, fov) {
    this.eye = eye
    const f = norm([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]])
    const r = norm(cross(f, [0, 1, 0]))
    this.basis = { f, r, u: cross(r, f) }
    this.fov = fov
    this.lens()
  }
  lens() {
    if (this.fov) this.F = this.H / 2 / Math.tan((this.fov * Math.PI) / 360)
  }
  // Rotation du groupe : Y puis X (ordre Euler « XYZ » de three.js)
  rotate(ry, rx) {
    this.cy = Math.cos(ry)
    this.sy = Math.sin(ry)
    this.cx = Math.cos(rx)
    this.sx = Math.sin(rx)
  }
  // Point monde (après rotation du groupe) → écran ; renvoie false s'il est derrière la caméra
  project(x, y, z) {
    const x1 = x * this.cy + z * this.sy
    const z1 = -x * this.sy + z * this.cy
    const y2 = y * this.cx - z1 * this.sx
    const z2 = y * this.sx + z1 * this.cx
    const { f, r, u } = this.basis
    const dx = x1 - this.eye[0]
    const dy = y2 - this.eye[1]
    const dz = z2 - this.eye[2]
    const vz = dx * f[0] + dy * f[1] + dz * f[2]
    if (vz < 0.05) return false
    const P = this.P
    P.x = this.W / 2 + ((dx * r[0] + dy * r[1] + dz * r[2]) / vz) * this.F
    P.y = this.H / 2 - ((dx * u[0] + dy * u[1] + dz * u[2]) / vz) * this.F
    P.z = vz
    return true
  }
  // Taille d'un point à l'écran, même règle que les PointsMaterial de three.js
  dot(size) { return Math.max(0.75, (size * this.H) / 2 / this.P.z) }
  // Polyligne 3D (tableau de [x,y,z]) ajoutée au chemin courant, limitée à n points
  polyline(ctx, pts, n = pts.length) {
    let pen = false
    for (let i = 0; i < n; i++) {
      if (!this.project(pts[i][0], pts[i][1], pts[i][2])) { pen = false; continue }
      if (pen) ctx.lineTo(this.P.x, this.P.y)
      else { ctx.moveTo(this.P.x, this.P.y); pen = true }
    }
  }
}

// Globe — points + graticule, sujets du jour, arcs tracés depuis Paris
class Globe extends Base {
  init() {
    this.camera([0, 0, 7.4], [0, 0, 0], 32)
    const R = 2
    const ll = (la, lo, r) => {
      const p = ((90 - la) * Math.PI) / 180
      const t = ((lo + 180) * Math.PI) / 180
      return [-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t)]
    }
    const N = 2600
    this.dots = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2
      const rad = Math.sqrt(1 - y * y)
      const th = i * 2.39996
      this.dots.set([Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R], i * 3)
    }
    this.lines = []
    for (let k = -3; k <= 3; k++) this.lines.push(Array.from({ length: 121 }, (_, a) => ll(k * 22.5, a * 3 - 180, R)))
    for (let m = 0; m < 12; m++) this.lines.push(Array.from({ length: 121 }, (_, a) => ll(a * 1.5 - 90, m * 30, R)))

    const spots = json(this, 'spots', [[48.85, 2.35], [50.45, 30.52], [31.5, 34.47], [-34.6, -58.4], [37.77, -122.42], [52.23, 21.01]])
    const paris = spots[0]
    this.spots = []
    this.arcs = []
    spots.forEach(([la, lo], i) => {
      const v = ll(la, lo, R * 1.005)
      // Repère tangent pour dessiner l'anneau à plat sur la sphère
      const n = norm(v)
      const e1 = norm(Math.abs(n[1]) < 0.9 ? cross(n, [0, 1, 0]) : cross(n, [1, 0, 0]))
      const e2 = cross(n, e1)
      this.spots.push({ v, e1, e2, off: i * 0.37 })
      if (i > 0) {
        const a = ll(paris[0], paris[1], R)
        const b = ll(la, lo, R)
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
        const mid = norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]).map((c) => c * R * (1.25 + d * 0.12))
        const pts = Array.from({ length: 81 }, (_, k) => {
          const t = k / 80
          const q = (j) => (1 - t) * (1 - t) * a[j] + 2 * (1 - t) * t * mid[j] + t * t * b[j]
          return [q(0), q(1), q(2)]
        })
        this.arcs.push({ pts, off: i * 0.5 })
      }
    })
    this.ry = -0.9
    this.rx = 0.3
    this.lt = 0
  }
  draw(ctx, t) {
    const dt = Math.min(0.1, Math.max(0, t - this.lt))
    this.lt = t
    const aim = this.getAttribute('aim')
    if (aim) {
      const [la, lo] = aim.split(',').map(Number)
      const tY = Math.PI / 2 - ((lo + 180) * Math.PI) / 180
      const tX = ((la * Math.PI) / 180) * 0.8
      this.ry += Math.atan2(Math.sin(tY - this.ry), Math.cos(tY - this.ry)) * 0.05
      this.rx += (tX - this.rx) * 0.05
    } else {
      this.ry += dt * 0.06
      this.rx += (0.3 - this.rx) * 0.03
    }
    this.rotate(this.ry + this.m.x * 0.5, this.rx + this.m.y * 0.2)
    const { ink, acc } = this.pal

    // Nuage de points
    ctx.fillStyle = ink
    ctx.globalAlpha = 0.5
    const D = this.dots
    for (let i = 0; i < D.length; i += 3) {
      if (!this.project(D[i], D[i + 1], D[i + 2])) continue
      const s = this.dot(0.022)
      ctx.fillRect(this.P.x - s / 2, this.P.y - s / 2, s, s)
    }
    // Graticule
    ctx.strokeStyle = ink
    ctx.globalAlpha = 0.22
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const l of this.lines) this.polyline(ctx, l)
    ctx.stroke()
    // Arcs depuis Paris, tracés progressivement
    ctx.strokeStyle = acc
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    for (const a of this.arcs) {
      const f = Math.min(1, Math.max(0, (t - a.off) / 1.6))
      this.polyline(ctx, a.pts, Math.floor(81 * (1 - Math.pow(1 - f, 3))))
    }
    ctx.stroke()
    // Points chauds : pastille + anneau qui pulse
    ctx.fillStyle = acc
    for (const s of this.spots) {
      if (!this.project(...s.v)) continue
      const cx = this.P.x
      const cy = this.P.y
      const k = this.F / this.P.z
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(1.5, 0.045 * k), 0, Math.PI * 2)
      ctx.fill()
      const f = (t * 0.6 + s.off) % 1
      const sc = 1 + f * 3
      const rr = 0.0675 * sc
      ctx.globalAlpha = 1 - f
      ctx.lineWidth = Math.max(1, 0.015 * sc * k)
      ctx.beginPath()
      const ring = []
      for (let j = 0; j <= 40; j++) {
        const th = (j / 40) * Math.PI * 2
        const c = Math.cos(th) * rr
        const sn = Math.sin(th) * rr
        ring.push([s.v[0] + c * s.e1[0] + sn * s.e2[0], s.v[1] + c * s.e1[1] + sn * s.e2[1], s.v[2] + c * s.e1[2] + sn * s.e2[2]])
      }
      this.polyline(ctx, ring)
      ctx.stroke()
    }
  }
}

// Rubans — un ruban par actif, dessiné au chargement.
// `series` : tableau de séries de clôtures (une par actif). Sans données : marche aléatoire.
class Ribbons extends Base {
  init() {
    this.camera([0, 3.4, 10.5], [0, -0.2, 0], 28)
    const P = 90
    const W = 8
    let series = json(this, 'series', null)
    if (!series || !series.length) {
      series = [-16.72, 12.02, 3.21, -6.18, -9.4, -12.1].map((tr, s) => {
        const r = rng(17 + s * 31)
        const vals = []
        let v = 0
        for (let i = 0; i < P; i++) { v += (r() - 0.5) * 0.9 + (tr / P) * 0.6; vals.push(v) }
        return vals
      })
    }
    // Ré-échantillonne chaque série sur P points
    series = series.map((s) => (s.length < 2 ? [0, 0] : Array.from({ length: P }, (_, i) => s[Math.round((i / (P - 1)) * (s.length - 1))])))
    this.ribbons = series.map((vals, s) => {
      const mn = Math.min(...vals)
      const mx = Math.max(...vals)
      const z = (s - (series.length - 1) / 2) * 1.05
      const top = vals.map((y, i) => [-W / 2 + (i / (P - 1)) * W, ((y - mn) / (mx - mn || 1)) * 1.6 - 0.6, z])
      return { top, base: top.map(([x]) => [x, -0.8, z]), up: vals[vals.length - 1] >= vals[0], off: s * 0.12, z }
    })
    const half = Math.max(3.2, ((series.length - 1) / 2) * 1.05 + 0.5)
    this.grid = []
    for (let i = 0; i <= 8; i++) { const x = -W / 2 + i * (W / 8); this.grid.push([[x, -0.8, -half], [x, -0.8, half]]) }
    for (let i = 0; i <= 6; i++) { const z = -half + i * ((2 * half) / 6); this.grid.push([[-W / 2, -0.8, z], [W / 2, -0.8, z]]) }
    this.P90 = P
  }
  draw(ctx, t) {
    this.rotate(Math.sin(t * 0.18) * 0.18 + this.m.x * 0.35, this.m.y * 0.12)
    const { ink, acc } = this.pal
    ctx.lineWidth = 1
    ctx.strokeStyle = ink
    ctx.globalAlpha = 0.15
    ctx.beginPath()
    for (const g of this.grid) this.polyline(ctx, g)
    ctx.stroke()
    // Du plus lointain au plus proche (z négatif = au fond)
    for (const rb of [...this.ribbons].sort((a, b) => a.z - b.z)) {
      const f = Math.min(1, Math.max(0, (t - rb.off) / 2.2))
      const n = Math.max(0, Math.floor(this.P90 * (1 - Math.pow(1 - f, 3))))
      if (n < 2) continue
      const col = rb.up ? ink : acc
      // Voile sous la courbe
      ctx.fillStyle = col
      ctx.globalAlpha = rb.up ? 0.07 : 0.12
      ctx.beginPath()
      this.polyline(ctx, rb.top, n)
      for (let i = n - 1; i >= 0; i--) if (this.project(...rb.base[i])) ctx.lineTo(this.P.x, this.P.y)
      ctx.closePath()
      ctx.fill()
      // Courbe
      ctx.strokeStyle = col
      ctx.globalAlpha = 1
      ctx.beginPath()
      this.polyline(ctx, rb.top, n)
      ctx.stroke()
    }
  }
}

// Vague — un champ de points qui respire ; les points rouges marquent le pouls
class Wave extends Base {
  init() {
    this.camera([0, 3.2, 7], [0, 0, 0], 40)
    this.CX = 90
    this.CZ = 44
  }
  draw(ctx, t) {
    this.rotate(Math.sin(t * 0.1) * 0.08, 0)
    const { ink, acc } = this.pal
    const { CX, CZ } = this
    const mx = this.m.x * 5
    const mz = this.m.y * 3
    for (const hot of [false, true]) {
      ctx.fillStyle = hot ? acc : ink
      ctx.globalAlpha = hot ? 1 : 0.55
      const size = hot ? 0.075 : 0.035
      for (let i = 0; i < CX; i++) {
        for (let j = 0; j < CZ; j++) {
          if (((i * 7 + j * 3) % 23 === 0) !== hot) continue
          const x = (i / (CX - 1) - 0.5) * 14
          const z = (j / (CZ - 1) - 0.5) * 7
          const d = Math.hypot(x - mx, z - mz)
          const y = Math.sin(x * 0.55 + t * 0.9) * Math.cos(z * 0.6 + t * 0.6) * 0.45 + Math.sin(d * 1.4 - t * 2.2) * 0.12 * Math.exp(-d * 0.25)
          if (!this.project(x, y, z)) continue
          const s = this.dot(size)
          ctx.fillRect(this.P.x - s / 2, this.P.y - s / 2, s, s)
        }
      }
    }
  }
}

if (!customElements.get('dw-globe')) customElements.define('dw-globe', Globe)
if (!customElements.get('dw-ribbons')) customElements.define('dw-ribbons', Ribbons)
if (!customElements.get('dw-wave')) customElements.define('dw-wave', Wave)
