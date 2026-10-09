import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' : fonctionne sur GitHub Pages quel que soit le nom du repo
export default defineConfig({
  base: './',
  plugins: [
    vue({
      // <dw-globe>, <dw-ribbons>, <dw-wave> : custom elements three.js (src/lib/scenes.js)
      template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('dw-') } },
    }),
  ],
  // three.js (~670 ko) est chargé à la demande dans son propre chunk
  build: { chunkSizeWarningLimit: 700 },
})
