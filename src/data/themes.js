// Thèmes de veille et de révision.
// `quiz: true` = une banque de questions existe dans src/data/questions/
// `color` = couleur d'accent du thème (badges, cards de veille)
// `group` = regroupement dans les filtres de la veille ('tech' | 'monde')
export const THEMES = [
  { id: 'php', name: 'PHP', icon: '🐘', quiz: true, color: '#8993be', group: 'tech' },
  { id: 'symfony', name: 'Symfony', icon: '🎼', quiz: true, color: '#22d3ee', group: 'tech' },
  { id: 'sql', name: 'SQL', icon: '🗃️', quiz: true, color: '#fbbf24', group: 'tech' },
  { id: 'database', name: 'Bases de données & Doctrine', icon: '🛢️', quiz: true, color: '#3b82f6', group: 'tech' },
  { id: 'patterns', name: 'Design Patterns', icon: '🧩', quiz: true, color: '#a855f7', group: 'tech' },
  { id: 'devops', name: 'DevOps', icon: '🚀', quiz: true, color: '#14b8a6', group: 'tech' },
  { id: 'securite', name: 'Sécurité / Hack', icon: '🔐', quiz: true, color: '#ef4444', group: 'tech' },
  { id: 'laravel', name: 'Laravel', icon: '🔺', quiz: true, color: '#fb923c', group: 'tech' },
  { id: 'vuejs', name: 'VueJS', icon: '💚', quiz: true, color: '#4ade80', group: 'tech' },
  { id: 'ia', name: 'IA', icon: '🤖', quiz: true, color: '#d946ef', group: 'tech' },
  { id: 'devweb', name: 'Développement Web', icon: '🌐', quiz: false, color: '#94a3b8', group: 'tech' },
  { id: 'frontend', name: 'FrontEnd', icon: '🎨', quiz: false, color: '#ec4899', group: 'tech' },
  { id: 'threed', name: '3D', icon: '🧊', quiz: false, color: '#84cc16', group: 'tech' },
  { id: 'drupal', name: 'Drupal', icon: '💧', quiz: false, color: '#29a8df', group: 'tech' },
  { id: 'divers', name: 'Divers', icon: '📰', quiz: false, color: '#8b949e', group: 'tech' },
  // --- Monde ---
  { id: 'actu-fr', name: 'Actu France', icon: '🇫🇷', quiz: false, color: '#60a5fa', group: 'monde' },
  { id: 'actu-monde', name: 'Actu Monde', icon: '🗺️', quiz: false, color: '#38bdf8', group: 'monde' },
  { id: 'geopolitique', name: 'Géopolitique', icon: '🌍', quiz: false, color: '#f97316', group: 'monde' },
  { id: 'trading', name: 'Marchés', icon: '📈', quiz: false, color: '#facc15', group: 'monde' },
]

export function themeById(id) {
  return THEMES.find((t) => t.id === id)
}

export function themeColor(id) {
  return themeById(id)?.color || '#8b949e'
}

export function themeIcon(id) {
  return themeById(id)?.icon || '📰'
}

export function themesByGroup(group) {
  return THEMES.filter((t) => (t.group || 'tech') === group)
}
