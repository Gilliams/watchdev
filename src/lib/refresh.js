// Bouton « Rafraîchir » : déclenche le workflow deploy.yml via l'API GitHub, suit son exécution,
// puis recharge les données une fois le site redéployé.
// Token fine-grained requis : Contents (read & write) + Actions (read & write).
import { reactive } from 'vue'
import { state } from '../stores/progress.js'
import { dataVersion } from './data.js'

const WORKFLOW = 'deploy.yml'
const POLL_MS = 5000
const TIMEOUT_MS = 8 * 60000

export const refresh = reactive({ status: 'idle', message: '', startedAt: null })

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

  Object.assign(refresh, { status: 'running', message: 'Démarrage…', startedAt: Date.now() })
  try {
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

    while (run.status !== 'completed') {
      if (Date.now() - refresh.startedAt > TIMEOUT_MS) throw new Error('délai dépassé, vérifie l\'onglet Actions')
      const secs = Math.round((Date.now() - refresh.startedAt) / 1000)
      refresh.message = run.status === 'queued' ? `En file d'attente… ${secs} s` : `Mise à jour en cours… ${secs} s`
      await sleep(POLL_MS)
      const r = await api(`/actions/runs/${run.id}`)
      if (r.ok) run = await r.json()
    }

    if (run.conclusion !== 'success') throw new Error(`run terminé en « ${run.conclusion} »`)
    dataVersion.value = Date.now()
    Object.assign(refresh, { status: 'done', message: 'Données à jour.' })
  } catch (e) {
    Object.assign(refresh, { status: 'error', message: `Échec : ${e.message}` })
  }
}
