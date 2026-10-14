// Répétition espacée inspirée de la courbe d'Ebbinghaus.
// Chaque réussite espace la prochaine révision ; un échec ramène au début.
export const INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 120]

const DAY = 24 * 60 * 60 * 1000

// Enregistre une révision dans un « bucket » ({ [id]: { level, lastReview, nextReview, history } })
// pct : taux de réussite entre 0 et 1 ; entry : détails gardés dans l'historique
export function recordReview(bucket, id, pct, entry = {}) {
  const t = bucket[id] || { level: 0, lastReview: null, nextReview: null, history: [] }

  if (pct >= 0.8) {
    t.level = Math.min(t.level + 1, INTERVALS_DAYS.length - 1)
  } else if (pct < 0.6) {
    t.level = 0 // on repart de demain : la mémoire a besoin d'être réamorcée
  }
  // entre 60 et 79 % : on garde le même palier, on re-teste au même intervalle

  const now = new Date()
  t.lastReview = now.toISOString()
  t.nextReview = new Date(now.getTime() + INTERVALS_DAYS[t.level] * DAY).toISOString()
  t.history = (t.history || []).slice(-19)
  t.history.push({ date: now.toISOString(), ...entry })
  bucket[id] = t
  return t
}

export function recordQuizResult(state, themeId, score, total) {
  return recordReview(state.themes, themeId, total > 0 ? score / total : 0, { score, total })
}

// Kata : réussi sans aide = palier suivant ; avec indices = même palier ; solution affichée = on repart à 1 jour
export function kataScore({ hints, revealed }) {
  if (revealed) return 0
  return hints > 0 ? 0.7 : 1
}

export function recordKataResult(state, kataId, attempt, ms) {
  const { hints, revealed } = attempt
  return recordReview(state.katas, kataId, kataScore(attempt), { ms, hints, revealed })
}

function dueIn(bucket) {
  const now = Date.now()
  return Object.entries(bucket)
    .filter(([, t]) => t.nextReview && new Date(t.nextReview).getTime() <= now)
    .map(([id]) => id)
}

export function dueKatas(state) {
  return dueIn(state.katas)
}

export function dueThemes(state) {
  return dueIn(state.themes)
}

export function themeStatus(state, themeId) {
  const t = state.themes[themeId]
  if (!t || !t.nextReview) return { label: 'Jamais testé', cls: '', due: true }
  const next = new Date(t.nextReview).getTime()
  const days = Math.ceil((next - Date.now()) / DAY)
  if (days <= 0) return { label: 'À réviser !', cls: 'orange', due: true }
  return { label: `Acquis · revoir dans ${days} j`, cls: 'green', due: false }
}

export function masteryLabel(level) {
  const labels = ['Novice', 'Débutant', 'En cours', 'Solide', 'Avancé', 'Maîtrisé', 'Expert']
  return labels[Math.min(level, labels.length - 1)]
}

// Statut court d'un élément révisé (quiz ou kata) pour les listes
export function reviewStatus(t) {
  if (!t?.nextReview) return { label: 'À découvrir', due: false, fresh: true }
  const days = Math.ceil((new Date(t.nextReview).getTime() - Date.now()) / DAY)
  return days <= 0 ? { label: 'À refaire', due: true } : { label: `Dans ${days} j`, due: false }
}
