// Web Worker qui héberge PHP (php-wasm). Isolé du thread principal pour qu'une
// boucle infinie ne fige pas la page : phpEngine.js tue le worker au-delà du délai.
let php = null
let output = ''

// Le build « web » de php-wasm référence window/document à l'initialisation
// (gestion canvas/plein écran, inutile ici) : on fournit le strict minimum.
const noop = () => {}
globalThis.window ??= globalThis
globalThis.document ??= { addEventListener: noop, removeEventListener: noop, getElementById: () => null, querySelector: () => null }

async function boot(url, version) {
  const { PhpWeb } = await import(/* @vite-ignore */ url)
  php = new PhpWeb({ version })
  php.addEventListener('output', (e) => (output += e.detail.join('')))
  php.addEventListener('error', (e) => (output += e.detail.join('')))
  await php.binary
  // Premier run : compile et chauffe le moteur
  await php.run('<?php echo PHP_VERSION;')
  const version_ = output
  output = ''
  return version_
}

self.onmessage = async ({ data }) => {
  const { id, type } = data
  try {
    if (type === 'boot') {
      const version = await boot(data.url, data.version)
      self.postMessage({ id, ok: true, version })
      return
    }
    if (type === 'run') {
      // État PHP neuf à chaque exécution (sinon « Cannot redeclare class »)
      await php.refresh()
      for (const [path, content] of Object.entries(data.files || {})) await php.writeFile(path, content)
      output = ''
      const t0 = performance.now()
      const exitCode = await php.run(data.script)
      self.postMessage({ id, ok: true, output, exitCode, ms: Math.round(performance.now() - t0) })
    }
  } catch (e) {
    self.postMessage({ id, ok: false, error: e?.message || String(e), output })
  }
}
