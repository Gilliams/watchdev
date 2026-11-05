// Mots-clés reliant une actu à un actif de l'onglet Marchés (titre ou chapô, insensible aux accents).
// Les flux déclarés avec `"asset": "<id>"` dans scripts/feeds.json sont rattachés directement.
export const ASSET_KEYWORDS = {
  ttwo: ['take-two', 'take two', 'ttwo', 'rockstar', 'gta', '2k games', 'zynga'],
  cdprojekt: ['cd projekt', 'cdprojekt', 'cd red', 'cyberpunk', 'witcher', 'gog.com'],
  sp500: ['s&p 500', 's&p500', 'wall street', 'nasdaq', 'dow jones', 'federal reserve', 'reserve federale', 'powell'],
  cac40: ['cac 40', 'cac40', 'bourse de paris', 'euronext'],
  bitcoin: ['bitcoin', 'btc'],
  solana: ['solana'],
}

// Seuils « gros mouvement » par type d'actif (en %)
export const THRESHOLDS = {
  stock: { d1: 2, d7: 6 },
  index: { d1: 1, d7: 3 },
  crypto: { d1: 4, d7: 10 },
}
