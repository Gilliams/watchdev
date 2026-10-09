<script setup>
import { useRoute } from 'vue-router'
import Icon from './Icon.vue'
import { theme, toggleTheme } from '../lib/theme.js'
import { refresh, triggerRefresh } from '../lib/refresh.js'

const route = useRoute()

const PAGES = [
  ['/', 'Tableau de bord', (p) => p === '/'],
  ['/actu', "L'actu en 5 min", (p) => p === '/actu'],
  ['/geopolitique', 'Géopolitique', (p) => p.startsWith('/geopolitique')],
  ['/trading', 'Marchés', (p) => p === '/trading'],
  ['/veille', 'Veille techno', (p) => p.startsWith('/veille')],
  ['/quiz', 'Quiz & Révisions', (p) => p.startsWith('/quiz')],
  ['/sql', 'Enquêtes SQL', (p) => p.startsWith('/sql')],
]
</script>

<template>
  <header class="dw-header">
    <router-link to="/" class="brand">DevWatch<span class="dot">.</span></router-link>
    <nav aria-label="Navigation principale">
      <router-link
        v-for="[to, label, match] in PAGES"
        :key="to"
        :to="to"
        :class="{ active: match(route.path) }"
        :aria-current="match(route.path) ? 'page' : undefined"
      >{{ label }}</router-link>
    </nav>
    <div class="tools">
      <button
        class="btn-outline"
        :disabled="refresh.status === 'running'"
        title="Relance la veille, le résumé et les cotations sur GitHub (1 à 2 min)"
        @click="triggerRefresh"
      >
        <span :class="{ spin: refresh.status === 'running' }"><Icon name="refresh" :stroke="2.2" /></span>
        {{ refresh.status === 'running' ? 'Relevé en cours…' : 'Rafraîchir' }}
      </button>
      <router-link to="/settings" class="square outline" :class="{ on: route.path === '/settings' }" title="Paramètres" aria-label="Paramètres">
        <Icon name="settings" :size="16" :stroke="2.2" />
      </router-link>
      <button class="square acc" :title="theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'" :aria-label="theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'" @click="toggleTheme">
        <Icon :name="theme === 'dark' ? 'sun' : 'moon'" :size="16" :stroke="2.2" />
      </button>
    </div>
  </header>
  <p v-if="refresh.message" class="refresh-msg" :class="refresh.status" aria-live="polite">{{ refresh.message }}</p>
</template>

<style scoped>
.dw-header {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  column-gap: 32px;
  padding: 0 var(--pad);
  min-height: 64px;
  border-bottom: 2px solid var(--rule);
  background: var(--bg);
  color: var(--ink);
}
.brand { display: flex; align-items: center; font-weight: 800; font-size: 22px; letter-spacing: -0.03em; color: var(--ink); }
.brand:hover { color: var(--ink); }
nav { display: flex; gap: 24px; flex: 1 1 480px; min-width: 0; overflow-x: auto; font-size: 14px; scrollbar-width: none; }
nav a { display: flex; align-items: center; min-height: 62px; white-space: nowrap; font-weight: 400; color: var(--mut); box-shadow: inset 0 -2px 0 transparent; }
nav a:hover { color: var(--ink); }
nav a.active { font-weight: 600; color: var(--ink); box-shadow: inset 0 -2px 0 var(--acc); }
.tools { display: flex; align-items: center; gap: 10px; padding: 12px 0; }
.square { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; padding: 0; }
.square.acc { background: var(--acc); color: var(--onacc); border: 0; }
.square.outline { border: 2px solid var(--ink); color: var(--ink); }
.square.outline:hover, .square.outline.on { background: var(--ink); color: var(--bg); }
.spin { display: flex; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.refresh-msg { padding: 8px var(--pad); font-size: 12px; font-weight: 600; color: var(--mut); border-bottom: 1px solid var(--hair); }
.refresh-msg.error { color: var(--acc); }
</style>
