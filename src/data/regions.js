// Zones de la page Géopolitique. Chaque article est rattaché à la première zone dont
// un lieu apparaît dans son titre ou son chapô ; les lieux trouvés deviennent les
// points du globe (arcs tracés depuis Paris). Ajoute des lieux ou des mots-clés librement.
export const PARIS = [48.85, 2.35]

export const REGIONS = [
  {
    id: 'europe', label: 'Europe', ll: [50.45, 30.52],
    places: [
      { name: 'Ukraine', ll: [50.45, 30.52], kw: ['ukrain', 'kiev', 'kyiv', 'zelensky', 'odessa', 'kharkiv', 'donbass'] },
      { name: 'Russie', ll: [55.75, 37.62], kw: ['russie', 'russe', 'moscou', 'kremlin', 'poutine', 'russia', 'putin', 'moscow'] },
      { name: 'Bruxelles', ll: [50.85, 4.35], kw: ['bruxelles', 'union européenne', "l'ue", 'commission européenne', 'european union', 'parlement européen', 'brussels', 'otan=', 'nato='] },
      { name: 'Allemagne', ll: [52.52, 13.4], kw: ['allemagne', 'berlin', 'germany', 'merz'] },
      { name: 'Royaume-Uni', ll: [51.51, -0.13], kw: ['royaume-uni', 'londres', 'britanni', 'london', 'starmer'] },
      { name: 'Pologne', ll: [52.23, 21.01], kw: ['pologne', 'varsovie', 'poland', 'warsaw'] },
      { name: 'Balkans', ll: [44.79, 20.45], kw: ['balkans', 'serbie', 'kosovo', 'bosnie', 'albanie', 'monténégro', 'montenegro', 'albania', 'serbia'] },
      { name: 'Géorgie', ll: [41.72, 44.79], kw: ['géorgie', 'georgia', 'tbilissi', 'arménie', 'armenia', 'azerbaïdjan', 'azerbaijan'] },
    ],
  },
  {
    id: 'mo', label: 'Moyen-Orient', ll: [31.5, 34.47],
    places: [
      { name: 'Gaza', ll: [31.5, 34.47], kw: ['gaza', 'hamas', 'israël', 'israel', 'israélien', 'netanyahou', 'netanyahu', 'cisjordanie', 'palestin'] },
      { name: 'Liban', ll: [33.89, 35.5], kw: ['liban', 'beyrouth', 'hezbollah', 'lebanon', 'beirut'] },
      { name: 'Iran', ll: [35.69, 51.39], kw: ['iran', 'téhéran', 'tehran'] },
      { name: 'Yémen', ll: [15.37, 44.19], kw: ['yémen', 'yemen', 'houthi'] },
      { name: 'Syrie', ll: [33.51, 36.29], kw: ['syrie', 'syria', 'damas'] },
      { name: 'Golfe', ll: [24.71, 46.68], kw: ['arabie saoudite', 'saoudien', 'riyad', 'émirats', 'qatar', 'golfe', 'bahreïn', 'saudi', 'emirates'] },
      { name: 'Turquie', ll: [39.93, 32.86], kw: ['turquie', 'ankara', 'erdogan', 'erdoğan', 'turkey', 'türkiye'] },
    ],
  },
  {
    id: 'ameriques', label: 'Amériques', ll: [42, -75],
    places: [
      { name: 'Washington', ll: [38.9, -77.04], kw: ['washington', 'trump', 'états-unis', 'etats-unis', 'américain', 'maison blanche', 'pentagone', 'united states', 'white house'] },
      { name: 'Ottawa', ll: [45.42, -75.7], kw: ['canada', 'ottawa', 'carney'] },
      { name: 'Mexique', ll: [19.43, -99.13], kw: ['mexique', 'mexico'] },
      { name: 'Venezuela', ll: [10.48, -66.9], kw: ['venezuela', 'caracas', 'maduro'] },
      { name: 'Brésil', ll: [-15.79, -47.88], kw: ['brésil', 'brasilia', 'lula', 'brazil'] },
      { name: 'Argentine', ll: [-34.6, -58.4], kw: ['argentine', 'buenos aires', 'milei', 'argentina'] },
    ],
  },
  {
    id: 'asie', label: 'Asie', ll: [25.03, 121.56],
    places: [
      { name: 'Taïwan', ll: [25.03, 121.56], kw: ['taïwan', 'taiwan', 'taipei'] },
      { name: 'Chine', ll: [39.9, 116.4], kw: ['chine=', 'chinois', 'pékin', 'xi jinping', 'china=', 'beijing'] },
      { name: 'Inde', ll: [28.61, 77.21], kw: ['inde=', 'indien', 'new delhi', 'modi=', 'india='] },
      { name: 'Japon', ll: [35.68, 139.69], kw: ['japon', 'tokyo', 'japan='] },
      { name: 'Corées', ll: [37.57, 126.98], kw: ['corée', 'séoul', 'pyongyang', 'korea'] },
      { name: 'Pakistan', ll: [33.68, 73.05], kw: ['pakistan', 'islamabad', 'afghanistan', 'kaboul', 'taliban'] },
      { name: 'Asie du Sud-Est', ll: [13.75, 100.5], kw: ['birmanie', 'myanmar', 'thaïlande', 'vietnam', 'philippines', 'indonésie', 'cambodge'] },
    ],
  },
  {
    id: 'afrique', label: 'Afrique', ll: [10, 15],
    places: [
      { name: 'Algérie', ll: [36.75, 3.06], kw: ['algérie', 'alger', 'algeria'] },
      { name: 'Maroc', ll: [34.02, -6.84], kw: ['maroc', 'rabat', 'morocco'] },
      { name: 'Sahel', ll: [12.64, -8.0], kw: ['sahel', 'mali=', 'malien', 'niger=', 'nigérien', 'burkina', 'tchad', 'niamey', 'bamako'] },
      { name: 'Soudan', ll: [15.5, 32.56], kw: ['soudan', 'sudan', 'khartoum'] },
      { name: 'Égypte', ll: [30.04, 31.24], kw: ['égypte', 'egypte', 'le caire', 'egypt'] },
      { name: 'RDC', ll: [-4.32, 15.31], kw: ['rdc=', 'congo', 'kinshasa', 'rwanda'] },
      { name: 'Afrique australe', ll: [-14.9, 13.5], kw: ['angola', 'afrique du sud', 'mozambique', 'zimbabwe', 'south africa'] },
      { name: 'Corne de l\'Afrique', ll: [9.03, 38.74], kw: ['éthiopie', 'somalie', 'érythrée', 'ethiopia', 'somalia'] },
    ],
  },
  {
    id: 'espace', label: 'Espace', ll: [0, -30],
    places: [
      { name: 'Orbite basse', ll: [0, -30], kw: ['spatial', 'spatiale', 'orbite', 'satellite', 'nasa=', 'space force'] },
    ],
  },
]

const regionById = Object.fromEntries(REGIONS.map((r) => [r.id, r]))
export const region = (id) => regionById[id]

// Un mot-clé est un début de mot (« ukrain » couvre « ukrainien ») ;
// suffixé par « = », il doit être un mot entier (« inde= » ne couvre pas « indemnité »).
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
for (const r of REGIONS) {
  for (const p of r.places) {
    p.re = new RegExp(p.kw.map((k) => (k.endsWith('=') ? `(?<!\\p{L})${esc(k.slice(0, -1))}(?!\\p{L})` : `(?<!\\p{L})${esc(k)}`)).join('|'), 'iu')
  }
}

// Renvoie { region, place } pour un article, ou null
export function locate(article) {
  const text = `${article.title} ${article.summary || ''}`
  for (const r of REGIONS) {
    for (const p of r.places) if (p.re.test(text)) return { region: r.id, place: p }
  }
  return null
}
