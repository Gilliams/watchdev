// Pièces 3D des maquettes (three.js), portées en custom elements :
//   <dw-globe>   globe des sujets du jour (accueil, géopolitique) — attributs theme, spots, aim
//   <dw-ribbons> un ruban par actif (marchés)                    — attributs theme, series
//   <dw-wave>    champ de points qui respire (actu, veille)      — attribut theme
// three.js est chargé à la demande (import dynamique → chunk séparé).
let threeP
const getThree = () => threeP || (threeP = import('three'))

const PAL = {
  light: { ink: 0x201e1d, acc: 0xec3013 },
  dark: { ink: 0xf1efee, acc: 0xff563c },
}
const rng = (seed) => {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}
const json = (el, name, fallback) => {
  try { return JSON.parse(el.getAttribute(name) || 'null') || fallback } catch { return fallback }
}

class Base extends HTMLElement {
  static get observedAttributes() { return ['theme'] }
  get theme() { return this.getAttribute('theme') || 'light' }
  set theme(v) { this.setAttribute('theme', v) }
  get pal() { return PAL[this.theme === 'dark' ? 'dark' : 'light'] }
  connectedCallback() {
    // Plein cadre : respecte un positionnement absolu posé par la page (classe .scene)
    this.style.display = 'block'
    if (getComputedStyle(this).position === 'static') Object.assign(this.style, { position: 'relative', width: '100%', height: '100%' })
    this._alive = true
    getThree().then((T) => { if (this._alive && !this._r) { this.init(T); this._ready = true } })
  }
  disconnectedCallback() {
    this._alive = false
    cancelAnimationFrame(this._raf)
    this._ro && this._ro.disconnect()
    this._io && this._io.disconnect()
    if (this._r) { this._r.dispose(); this._r.domElement.remove(); this._r = null }
  }
  attributeChangedCallback() { if (this._r) this.applyTheme() }
  setup(T, fov) {
    const r = new T.WebGLRenderer({ antialias: true, alpha: true })
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    Object.assign(r.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' })
    this.appendChild(r.domElement)
    this._r = r
    this.scene = new T.Scene()
    this.cam = new T.PerspectiveCamera(fov, 1, 0.1, 100)
    const resize = () => {
      const w = this.clientWidth || 1
      const h = this.clientHeight || 1
      r.setSize(w, h, false)
      this.cam.aspect = w / h
      this.cam.updateProjectionMatrix()
    }
    this._ro = new ResizeObserver(resize)
    this._ro.observe(this)
    resize()
    // On ne dessine que ce qui est visible à l'écran
    this._vis = true
    this._io = new IntersectionObserver(([e]) => { this._vis = e.isIntersecting })
    this._io.observe(this)
    this.m = { x: 0, y: 0, tx: 0, ty: 0 }
    this.addEventListener('pointermove', (e) => {
      const b = this.getBoundingClientRect()
      this.m.tx = ((e.clientX - b.left) / b.width) * 2 - 1
      this.m.ty = ((e.clientY - b.top) / b.height) * 2 - 1
    })
    this.addEventListener('pointerleave', () => { this.m.tx = 0; this.m.ty = 0 })
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const t0 = performance.now()
    const loop = () => {
      this._raf = requestAnimationFrame(loop)
      if (!this._ready || !this._vis) return
      this.m.x += (this.m.tx - this.m.x) * 0.05
      this.m.y += (this.m.ty - this.m.y) * 0.05
      this.tick(still ? 4 : (performance.now() - t0) / 1000)
      r.render(this.scene, this.cam)
    }
    loop()
  }
}

// Globe — points + graticule, sujets du jour, arcs tracés depuis Paris
class Globe extends Base {
  init(T) {
    this.setup(T, 32)
    this.cam.position.set(0, 0, 7.4)
    const g = new T.Group()
    g.rotation.x = 0.3
    this.scene.add(g)
    this.g = g
    const R = 2
    const ll = (la, lo, r) => {
      const p = ((90 - la) * Math.PI) / 180
      const t = ((lo + 180) * Math.PI) / 180
      return new T.Vector3(-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t))
    }
    const N = 2600
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2
      const rad = Math.sqrt(1 - y * y)
      const th = i * 2.39996
      pos[i * 3] = Math.cos(th) * rad * R
      pos[i * 3 + 1] = y * R
      pos[i * 3 + 2] = Math.sin(th) * rad * R
    }
    const dg = new T.BufferGeometry()
    dg.setAttribute('position', new T.BufferAttribute(pos, 3))
    this.dotMat = new T.PointsMaterial({ size: 0.022, transparent: true, opacity: 0.5 })
    g.add(new T.Points(dg, this.dotMat))
    this.lineMat = new T.LineBasicMaterial({ transparent: true, opacity: 0.22 })
    for (let k = -3; k <= 3; k++) {
      const pts = []
      for (let a = 0; a <= 120; a++) pts.push(ll(k * 22.5, a * 3 - 180, R))
      g.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), this.lineMat))
    }
    for (let m = 0; m < 12; m++) {
      const pts = []
      for (let a = 0; a <= 120; a++) pts.push(ll(a * 1.5 - 90, m * 30, R))
      g.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), this.lineMat))
    }
    this.accMat = new T.MeshBasicMaterial()
    this.arcMat = new T.LineBasicMaterial({ transparent: true, opacity: 0.9 })
    this.pulses = []
    this.arcs = []
    const spots = json(this, 'spots', [[48.85, 2.35], [50.45, 30.52], [31.5, 34.47], [-34.6, -58.4], [37.77, -122.42], [52.23, 21.01]])
    const paris = spots[0]
    this.ry = -0.9
    this.rx = 0.3
    this._lt = 0
    spots.forEach(([la, lo], i) => {
      const v = ll(la, lo, R * 1.005)
      const dot = new T.Mesh(new T.SphereGeometry(0.045, 12, 12), this.accMat)
      dot.position.copy(v)
      g.add(dot)
      const ring = new T.Mesh(new T.RingGeometry(0.06, 0.075, 40), new T.MeshBasicMaterial({ transparent: true, side: T.DoubleSide }))
      ring.position.copy(v)
      ring.lookAt(v.clone().multiplyScalar(2))
      g.add(ring)
      this.pulses.push({ ring, off: i * 0.37 })
      if (i > 0) {
        const a = ll(paris[0], paris[1], R)
        const b = ll(la, lo, R)
        const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1.25 + a.distanceTo(b) * 0.12))
        const curve = new T.QuadraticBezierCurve3(a, mid, b)
        const line = new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(80)), this.arcMat)
        line.geometry.setDrawRange(0, 0)
        line.userData.off = i * 0.5
        g.add(line)
        this.arcs.push(line)
      }
    })
    this.applyTheme()
  }
  applyTheme() {
    const p = this.pal
    this.dotMat.color.setHex(p.ink)
    this.lineMat.color.setHex(p.ink)
    this.accMat.color.setHex(p.acc)
    this.arcMat.color.setHex(p.acc)
    this.pulses.forEach((q) => q.ring.material.color.setHex(p.acc))
  }
  tick(t) {
    const dt = Math.min(0.1, t - this._lt)
    this._lt = t
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
    this.g.rotation.y = this.ry + this.m.x * 0.5
    this.g.rotation.x = this.rx + this.m.y * 0.2
    this.pulses.forEach((q) => {
      const f = (t * 0.6 + q.off) % 1
      q.ring.scale.setScalar(1 + f * 3)
      q.ring.material.opacity = 1 - f
    })
    this.arcs.forEach((l) => {
      const f = Math.min(1, Math.max(0, (t - l.userData.off) / 1.6))
      l.geometry.setDrawRange(0, Math.floor(81 * (1 - Math.pow(1 - f, 3))))
    })
  }
}

// Rubans — un ruban 3D par actif, dessiné au chargement.
// `series` : tableau de séries de clôtures (une par actif). Sans données : marche aléatoire.
class Ribbons extends Base {
  init(T) {
    this.setup(T, 28)
    this.cam.position.set(0, 3.4, 10.5)
    this.cam.lookAt(0, -0.2, 0)
    const g = new T.Group()
    this.scene.add(g)
    this.g = g
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
    this.inkLine = new T.LineBasicMaterial()
    this.accLine = new T.LineBasicMaterial()
    this.inkFill = new T.MeshBasicMaterial({ transparent: true, opacity: 0.07, side: T.DoubleSide, depthWrite: false })
    this.accFill = new T.MeshBasicMaterial({ transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false })
    this.gridMat = new T.LineBasicMaterial({ transparent: true, opacity: 0.15 })
    this.lines = []
    series.forEach((vals, s) => {
      const mn = Math.min(...vals)
      const mx = Math.max(...vals)
      const z = (s - (series.length - 1) / 2) * 1.05
      const pts = vals.map((y, i) => new T.Vector3(-W / 2 + (i / (P - 1)) * W, ((y - mn) / (mx - mn || 1)) * 1.6 - 0.6, z))
      const up = vals[vals.length - 1] >= vals[0]
      const line = new T.Line(new T.BufferGeometry().setFromPoints(pts), up ? this.inkLine : this.accLine)
      const fp = new Float32Array(P * 2 * 3)
      const idx = []
      pts.forEach((p, i) => {
        fp.set([p.x, p.y, p.z, p.x, -0.8, p.z], i * 6)
        if (i < P - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
      })
      const fg = new T.BufferGeometry()
      fg.setAttribute('position', new T.BufferAttribute(fp, 3))
      fg.setIndex(idx)
      const fill = new T.Mesh(fg, up ? this.inkFill : this.accFill)
      line.geometry.setDrawRange(0, 0)
      fg.setDrawRange(0, 0)
      g.add(fill)
      g.add(line)
      this.lines.push({ line, fg, P, off: s * 0.12 })
    })
    const half = Math.max(3.2, ((series.length - 1) / 2) * 1.05 + 0.5)
    for (let i = 0; i <= 8; i++) {
      const x = -W / 2 + i * (W / 8)
      g.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(x, -0.8, -half), new T.Vector3(x, -0.8, half)]), this.gridMat))
    }
    for (let i = 0; i <= 6; i++) {
      const z = -half + i * ((2 * half) / 6)
      g.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-W / 2, -0.8, z), new T.Vector3(W / 2, -0.8, z)]), this.gridMat))
    }
    this.applyTheme()
  }
  applyTheme() {
    const p = this.pal
    this.inkLine.color.setHex(p.ink)
    this.inkFill.color.setHex(p.ink)
    this.accLine.color.setHex(p.acc)
    this.accFill.color.setHex(p.acc)
    this.gridMat.color.setHex(p.ink)
  }
  tick(t) {
    this.g.rotation.y = Math.sin(t * 0.18) * 0.18 + this.m.x * 0.35
    this.g.rotation.x = this.m.y * 0.12
    this.lines.forEach((l) => {
      const f = Math.min(1, Math.max(0, (t - l.off) / 2.2))
      const e = 1 - Math.pow(1 - f, 3)
      const n = Math.max(0, Math.floor(l.P * e))
      l.line.geometry.setDrawRange(0, n)
      l.fg.setDrawRange(0, Math.max(0, (n - 1) * 6))
    })
  }
}

// Vague — un champ de points qui respire ; les points rouges marquent le pouls
class Wave extends Base {
  init(T) {
    this.setup(T, 40)
    this.cam.position.set(0, 3.2, 7)
    this.cam.lookAt(0, 0, 0)
    const CX = 90
    const CZ = 44
    this.CX = CX
    this.CZ = CZ
    const mk = (filter) => {
      const arr = []
      for (let i = 0; i < CX; i++) for (let j = 0; j < CZ; j++) if (filter(i, j)) arr.push(i, j)
      const pos = new Float32Array((arr.length / 2) * 3)
      const geo = new T.BufferGeometry()
      geo.setAttribute('position', new T.BufferAttribute(pos, 3))
      return { arr, geo, pos }
    }
    this.base = mk((i, j) => (i * 7 + j * 3) % 23 !== 0)
    this.hot = mk((i, j) => (i * 7 + j * 3) % 23 === 0)
    this.inkMat = new T.PointsMaterial({ size: 0.035, transparent: true, opacity: 0.55 })
    this.accMat = new T.PointsMaterial({ size: 0.075 })
    this.scene.add(new T.Points(this.base.geo, this.inkMat))
    this.scene.add(new T.Points(this.hot.geo, this.accMat))
    this.applyTheme()
  }
  applyTheme() {
    const p = this.pal
    this.inkMat.color.setHex(p.ink)
    this.accMat.color.setHex(p.acc)
  }
  upd(set, t) {
    const { arr, pos, geo } = set
    for (let k = 0; k < arr.length / 2; k++) {
      const i = arr[k * 2]
      const j = arr[k * 2 + 1]
      const x = (i / (this.CX - 1) - 0.5) * 14
      const z = (j / (this.CZ - 1) - 0.5) * 7
      const d = Math.hypot(x - this.m.x * 5, z - this.m.y * 3)
      const y = Math.sin(x * 0.55 + t * 0.9) * Math.cos(z * 0.6 + t * 0.6) * 0.45 + Math.sin(d * 1.4 - t * 2.2) * 0.12 * Math.exp(-d * 0.25)
      pos[k * 3] = x
      pos[k * 3 + 1] = y
      pos[k * 3 + 2] = z
    }
    geo.attributes.position.needsUpdate = true
  }
  tick(t) {
    this.upd(this.base, t)
    this.upd(this.hot, t)
    this.scene.rotation.y = Math.sin(t * 0.1) * 0.08
  }
}

if (!customElements.get('dw-globe')) customElements.define('dw-globe', Globe)
if (!customElements.get('dw-ribbons')) customElements.define('dw-ribbons', Ribbons)
if (!customElements.get('dw-wave')) customElements.define('dw-wave', Wave)
