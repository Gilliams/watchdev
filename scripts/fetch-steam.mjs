// Steam : meilleures ventes, nouveautés, sorties à venir et promos -> public/data/steam.json
// API publique du magasin (celle de la page d'accueil Steam), sans clé. Lancé par deploy.yml, ou : npm run fetch-steam
// En cas d'échec, on garde le fichier précédent (récupéré depuis le site publié par le workflow).
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = join(root, 'public/data/steam.json')
const CC = process.env.STEAM_CC || 'fr'
const PER_SECTION = 10

export const SECTIONS = [
  ['top_sellers', 'Meilleures ventes'],
  ['new_releases', 'Nouveautés'],
  ['coming_soon', 'Bientôt disponibles'],
  ['specials', 'En promo'],
]

export function normalize(json) {
  const seen = new Set()
  return SECTIONS.map(([key, label]) => ({
    key,
    label,
    items: (json?.[key]?.items || [])
      .filter((g) => g?.id && g.name && !seen.has(`${key}:${g.id}`) && seen.add(`${key}:${g.id}`))
      .slice(0, PER_SECTION)
      .map((g) => ({
        id: g.id,
        name: g.name,
        url: `https://store.steampowered.com/app/${g.id}/`,
        image: g.header_image || g.large_capsule_image || null,
        discount: g.discounted ? g.discount_percent || 0 : 0,
        price: Number.isFinite(g.final_price) ? g.final_price / 100 : null,
        original: Number.isFinite(g.original_price) ? g.original_price / 100 : null,
        currency: g.currency || 'EUR',
      })),
  })).filter((s) => s.items.length)
}

async function main() {
  try {
    const res = await fetch(`https://store.steampowered.com/api/featuredcategories?cc=${CC}&l=french`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DevWatch/1.1; veille perso)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const sections = normalize(await res.json())
    if (!sections.length) throw new Error('réponse vide')
    mkdirSync(dirname(outFile), { recursive: true })
    writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), sections }, null, 1))
    console.log(`✔ Steam : ${sections.map((s) => `${s.label} ${s.items.length}`).join(' · ')} → public/data/steam.json`)
  } catch (e) {
    console.warn(`✖ Steam : ${e.message}${existsSync(outFile) ? ' — fichier précédent conservé' : ''}`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
