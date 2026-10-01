// Chargement des JSON générés au build (articles, digest, quotes).
// `dataVersion` change après un rafraîchissement : l'URL change, le cache navigateur/CDN est contourné.
import { ref } from 'vue'

export const dataVersion = ref(0)

export async function loadData(name) {
  try {
    const bust = dataVersion.value ? `?v=${dataVersion.value}` : ''
    const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json${bust}`, { cache: dataVersion.value ? 'no-cache' : 'default' })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}
