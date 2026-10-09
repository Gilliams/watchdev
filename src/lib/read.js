// État « lu » des articles (partagé par l'accueil, la veille et la géopolitique)
import { state } from '../stores/progress.js'

export const isRead = (link) => state.readArticles.includes(link)

export function toggleRead(link) {
  const i = state.readArticles.indexOf(link)
  if (i >= 0) state.readArticles.splice(i, 1)
  else state.readArticles.push(link)
}

export function markRead(link) {
  if (!isRead(link)) state.readArticles.push(link)
}
