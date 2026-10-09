// Thème clair / sombre partagé par toutes les pages (clé localStorage des maquettes : dw-theme)
import { ref, watch } from 'vue'

const KEY = 'dw-theme'
const read = () => {
  try { return localStorage.getItem(KEY) || 'light' } catch { return 'light' }
}

export const theme = ref(read())

watch(theme, (t) => {
  document.documentElement.dataset.theme = t
  try { localStorage.setItem(KEY, t) } catch {}
}, { immediate: true })

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}
