// Moteur PHP dans le navigateur : php-wasm (PHP 8.4 compilé en WebAssembly),
// chargé depuis un CDN à la première utilisation, exécuté dans un Web Worker.
import { reactive } from 'vue'

// Version épinglée : un changement de version du runtime doit être volontaire
const PHP_WASM_URL = import.meta.env.VITE_PHP_WASM_URL || 'https://cdn.jsdelivr.net/npm/php-wasm@0.2.0/PhpWeb.mjs'
const PHP_VERSION = '8.4'
const BOOT_TIMEOUT = 90_000 // ~4 Mo à télécharger la première fois
const RUN_TIMEOUT = 6_000

// status : idle | booting | ready | error
export const php = reactive({ status: 'idle', version: '', error: '' })

let worker = null
let booting = null
let seq = 0
const pending = new Map()

function spawn() {
  worker = new Worker(new URL('./phpWorker.js', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id)
    if (!p) return
    pending.delete(data.id)
    clearTimeout(p.timer)
    data.ok ? p.resolve(data) : p.reject(new Error(data.error))
  }
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Le worker PHP a planté'))
    pending.clear()
  }
}

function kill() {
  worker?.terminate()
  worker = null
  booting = null
  php.status = 'idle'
}

function call(msg, timeout) {
  return new Promise((resolve, reject) => {
    const id = ++seq
    const timer = setTimeout(() => {
      pending.delete(id)
      kill()
      reject(Object.assign(new Error('timeout'), { timeout: true }))
    }, timeout)
    pending.set(id, { resolve, reject, timer })
    worker.postMessage({ id, ...msg })
  })
}

export function bootPhp() {
  if (booting) return booting
  spawn()
  php.status = 'booting'
  php.error = ''
  booting = call({ type: 'boot', url: PHP_WASM_URL, version: PHP_VERSION }, BOOT_TIMEOUT).then(
    (r) => {
      php.status = 'ready'
      php.version = r.version
    },
    (e) => {
      kill()
      php.status = 'error'
      php.error = e.timeout ? 'Le moteur PHP a mis trop de temps à charger.' : `Impossible de charger le moteur PHP (${e.message}). Vérifie ta connexion.`
      throw e
    }
  )
  return booting
}

// Exécute `script` après avoir écrit `files` ({ chemin: contenu }) dans le FS virtuel.
// Renvoie { output, exitCode, ms } ou { timeout: true } si le code ne rend pas la main.
export async function runPhp(script, files = {}) {
  await bootPhp()
  try {
    return await call({ type: 'run', script, files }, RUN_TIMEOUT)
  } catch (e) {
    if (e.timeout) {
      bootPhp().catch(() => {}) // relance un moteur neuf en arrière-plan
      return { timeout: true, output: '' }
    }
    throw e
  }
}

export const RUN_TIMEOUT_S = RUN_TIMEOUT / 1000
