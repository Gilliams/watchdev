// Bouton « Rafraîchir » : déclenche le workflow deploy.yml via l'API GitHub, suit son exécution,
// puis recharge les données une fois le site redéployé.
// Progression : étapes terminées du job, pondérées par leur durée lors du dernier run réussi.
// Token fine-grained requis : Contents (read & write) + Actions (read & write).
import { reactive } from 'vue'
import { state } from '../stores/progress.js'
import { dataVersion } from './data.js'

const WORKFLOW = 'deploy.yml'
const POLL_MS = 3000
const TIMEOUT_MS = 8 * 60000

export const refresh = reactive({ status: 'idle', message: '', startedAt: null, progress: 0 })

const api = (path, init = {}) =>
  fetch(`https://api.github.com/repos/${state.settings.githubOwner}/${state.settings.githubRepo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${state.settings.githubToken}`,
      Accept: 'application/vnd.github+json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const secs = (a, b) => (new Date(b) - new Date(a)) / 1000
const DEFAULT_STEP_S = 5
let hideTimer

const STEP_LABELS = [
  [/^(Set up job|Run actions\/(checkout|setup-node|configure-pages))/, 'Préparation'],
  [/npm ci/, 'Installation des dépendances'],
  [/cotations précédentes|veille précédente/, 'Reprise des données précédentes'],
  [/npm run build$/, 'Construction du site'],
  [/upload-pages-artifact/, 'Envoi du site'],
  [/deploy-pages/, 'Publication'],
  [/^(Post |Complete job)/, 'Finalisation'],
]
const stepLabel = (name) => STEP_LABELS.find(([re]) => re.test(name))?.[1] || name.replace(/^Run /, '')

async function runSteps(runId) {
  const res = await api(`/actions/runs/${runId}/jobs`)
  if (!res.ok) return []
  const { jobs = [] } = await res.json()
  return jobs.flatMap((j) => j.steps || [])
}

// Durée de chaque étape lors du dernier run réussi : sert de poids et d'estimation
async function previousDurations() {
  try {
    const res = await api(`/actions/workflows/${WORKFLOW}/runs?status=success&per_page=1`)
    const prev = res.ok ? (await res.json()).workflow_runs?.[0] : null
    if (!prev) return {}
    const steps = await runSteps(prev.id)
    return Object.fromEntries(steps.filter((s) => s.started_at && s.completed_at).map((s) => [s.name, Math.max(1, secs(s.started_at, s.completed_at))]))
  } catch {
    return {}
  }
}

function stepProgress(steps, durations) {
  const weight = (s) => durations[s.name] ?? DEFAULT_STEP_S
  const total = steps.reduce((t, s) => t + weight(s), 0)
  if (!total) return { ratio: 0, current: null }
  let done = 0
  let current = null
  for (const s of steps) {
    if (s.status === 'completed') done += weight(s)
    else if (s.status === 'in_progress') {
      current = s
      // Avance dans l'étape en cours, asymptotique : ne dépasse jamais l'étape tant qu'elle n'est pas finie
      const elapsed = s.started_at ? (Date.now() - new Date(s.started_at)) / 1000 : 0
      done += weight(s) * 0.95 * (1 - Math.exp(-elapsed / weight(s)))
    }
  }
  return { ratio: done / total, current }
}

async function latestRun(sinceMs) {
  const res = await api(`/actions/workflows/${WORKFLOW}/runs?per_page=5`)
  if (!res.ok) throw new Error(`lecture des runs : HTTP ${res.status}`)
  const { workflow_runs: runs = [] } = await res.json()
  return runs.find((r) => new Date(r.created_at).getTime() >= sinceMs - 10000) || null
}

export async function triggerRefresh() {
  if (refresh.status === 'running') return
  const { githubOwner, githubRepo, githubToken } = state.settings
  if (!githubOwner || !githubRepo || !githubToken) {
    Object.assign(refresh, { status: 'error', message: 'Configure owner, repo et token dans Paramètres.' })
    return
  }

  clearTimeout(hideTimer)
  Object.assign(refresh, { status: 'running', message: 'Démarrage…', startedAt: Date.now(), progress: 0.02 })
  const setProgress = (p) => { refresh.progress = Math.max(refresh.progress, Math.min(1, p)) }
  try {
    const durationsP = previousDurations()
    // Un run déjà en cours (push récent, autre onglet) : on le suit au lieu d'en relancer un
    const res = await api(`/actions/workflows/${WORKFLOW}/runs?status=in_progress&per_page=1`)
    let run = res.ok ? (await res.json()).workflow_runs?.[0] : null

    if (!run) {
      const since = Date.now()
      const d = await api(`/actions/workflows/${WORKFLOW}/dispatches`, {
        method: 'POST',
        body: JSON.stringify({ ref: state.settings.githubBranch || 'main' }),
      })
      if (d.status === 403 || d.status === 404) throw new Error('token sans permission « Actions : Read and write »')
      if (!d.ok) throw new Error(`déclenchement : HTTP ${d.status}`)
      while (!run) {
        if (Date.now() - since > 60000) throw new Error('le run n\'apparaît pas')
        await sleep(3000)
        run = await latestRun(since)
      }
    }

    const durations = await durationsP
    while (run.status !== 'completed') {
      if (Date.now() - refresh.startedAt > TIMEOUT_MS) throw new Error('délai dépassé, vérifie l\'onglet Actions')
      if (run.status === 'queued') {
        setProgress(0.05)
        refresh.message = 'En file d\'attente…'
      } else {
        const { ratio, current } = stepProgress(await runSteps(run.id), durations)
        setProgress(0.05 + 0.95 * ratio)
        refresh.message = current ? `${stepLabel(current.name)}…` : 'Mise à jour en cours…'
      }
      await sleep(POLL_MS)
      const r = await api(`/actions/runs/${run.id}`)
      if (r.ok) run = await r.json()
    }

    if (run.conclusion !== 'success') throw new Error(`run terminé en « ${run.conclusion} »`)
    dataVersion.value = Date.now()
    Object.assign(refresh, { status: 'done', message: 'Données à jour.', progress: 1 })
    hideTimer = setTimeout(() => Object.assign(refresh, { status: 'idle', message: '', progress: 0 }), 4000)
  } catch (e) {
    Object.assign(refresh, { status: 'error', message: `Échec : ${e.message}` })
  }
}
