// Rappels de révision façon courbe d'Ebbinghaus.
// Lit progress/progress.json (poussé par l'appli) et envoie un mail si des thèmes sont dus.
// Lancé chaque matin par .github/workflows/reminders.yml — secrets requis :
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_TO (optionnel si email présent dans progress.json)
import nodemailer from 'nodemailer'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const progressPath = join(root, 'progress/progress.json')

const THEME_NAMES = {
  php: 'PHP', symfony: 'Symfony', sql: 'SQL', database: 'Bases de données & Doctrine',
  patterns: 'Design Patterns', devops: 'DevOps', securite: 'Sécurité / Hack',
  laravel: 'Laravel', vuejs: 'VueJS', ia: 'IA', all: 'All'
}

// Katas de design patterns (src/data/katas/) : ajoute ici l'id de chaque nouveau kata
const KATA_NAMES = { strategy: 'Strategy', decorator: 'Decorator', observer: 'Observer' }

if (!existsSync(progressPath)) {
  console.log('Pas de progress/progress.json — synchronise ta progression depuis l\'appli (Paramètres). Rien à envoyer.')
  process.exit(0)
}

const progress = JSON.parse(readFileSync(progressPath, 'utf8'))
const now = Date.now()

const due = []
const never = []
for (const [id, name] of Object.entries(THEME_NAMES)) {
  const t = progress.themes?.[id]
  if (!t || !t.nextReview) {
    never.push(name)
  } else if (new Date(t.nextReview).getTime() <= now) {
    const late = Math.floor((now - new Date(t.nextReview).getTime()) / 86400000)
    due.push({ name, late })
  }
}

// Katas : seuls ceux déjà pratiqués au moins une fois sont rappelés
for (const [id, name] of Object.entries(KATA_NAMES)) {
  const k = progress.katas?.[id]
  if (k?.nextReview && new Date(k.nextReview).getTime() <= now) {
    const late = Math.floor((now - new Date(k.nextReview).getTime()) / 86400000)
    due.push({ name: `Kata ${name}`, late, kata: true })
  }
}

if (!due.length) {
  console.log('Aucun thème à réviser aujourd\'hui — la courbe d\'Ebbinghaus te laisse tranquille. 🎉')
  process.exit(0)
}

const to = process.env.MAIL_TO || progress.email
if (!to) {
  console.error('Aucun destinataire : définis le secret MAIL_TO ou renseigne ton email dans l\'appli.')
  process.exit(1)
}

const appUrl = process.env.APP_URL || ''
const dueList = due
  .map((d) => `  • ${d.name}${d.late > 0 ? ` (en retard de ${d.late} j)` : ''}`)
  .join('\n')

const text = `Salut ! 👋

D'après ta courbe d'Ebbinghaus, ${due.length > 1 ? 'ces thèmes attendent' : 'ce thème attend'} ta révision aujourd'hui :

${dueList}
${never.length ? `\nJamais testés : ${never.join(', ')}\n` : ''}
${due.some((d) => !d.kata) ? "Un quiz de 8 questions suffit pour re-espacer l'intervalle. 💪\n" : ''}${due.some((d) => d.kata) ? 'Un kata réussi sans indice repousse la prochaine répétition. 🥋\n' : ''}
${appUrl ? `\n👉 ${appUrl}` : ''}

— DevWatch, ton coach mémoire
`

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

await transporter.sendMail({
  from: `"DevWatch 🧠" <${process.env.SMTP_USER}>`,
  to,
  subject: `🧠 ${due.length} thème${due.length > 1 ? 's' : ''} à réviser aujourd'hui — ${due.map((d) => d.name).join(', ')}`,
  text,
})

console.log(`Mail envoyé à ${to} : ${due.length} thème(s) dû(s).`)
