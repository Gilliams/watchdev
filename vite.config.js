import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' : fonctionne sur GitHub Pages quel que soit le nom du repo
export default defineConfig({
  base: './',
  // Worker PHP des katas en module ES (import dynamique de php-wasm depuis le CDN)
  worker: { format: 'es' },
  // La page d'un kata embarque CodeMirror (~230 Ko gzip), chargée à la demande seulement
  build: { chunkSizeWarningLimit: 800 },
  plugins: [
    vue({
      // <dw-globe>, <dw-ribbons>, <dw-wave> : custom elements canvas (src/lib/scenes.js)
      template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('dw-') } },
    }),
  ],
})
