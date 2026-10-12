// Résumé « L'actu en X min » partagé par le header, l'accueil et la page Actu :
// un seul chargement, rechargé après un rafraîchissement, donc le même X partout.
import { ref, computed, watch } from 'vue'
import { loadData, dataVersion } from './data.js'

export const digest = ref(null)
export const digestLoading = ref(true)
export const readingMinutes = computed(() => digest.value?.readingMinutes ?? 5)

async function load() {
  digestLoading.value = true
  digest.value = await loadData('digest')
  digestLoading.value = false
}

load()
watch(dataVersion, load)
