<script setup>
import { state } from './stores/progress.js'
import { dueThemes } from './lib/spaced.js'
import { computed } from 'vue'
import { dataVersion } from './lib/data.js'
import { refresh, triggerRefresh } from './lib/refresh.js'

const dueCount = computed(() => dueThemes(state).length)
</script>

<template>
  <nav class="sidebar">
    <div class="logo">🧠 Dev<span>Watch</span></div>
    <router-link class="nav-link" to="/">🏠 Tableau de bord</router-link>
    <router-link class="nav-link" to="/actu">☕ L'actu en 5 min</router-link>
    <router-link class="nav-link" to="/veille/geopolitique">🌍 Géopolitique</router-link>
    <router-link class="nav-link" to="/trading">📈 Marchés</router-link>
    <router-link class="nav-link" to="/veille" active-class="" exact-active-class="router-link-active">📡 Veille techno</router-link>
    <router-link class="nav-link" to="/quiz">
      🎯 Quiz &amp; Révisions
      <span v-if="dueCount" class="badge orange">{{ dueCount }}</span>
    </router-link>
    <router-link class="nav-link" to="/sql">🕵️ Enquêtes SQL</router-link>
    <div class="spacer"></div>
    <button class="refresh-btn" :disabled="refresh.status === 'running'" @click="triggerRefresh" title="Relance la veille, le résumé et les cotations sur GitHub (1 à 2 min)">
      <span :class="{ spinning: refresh.status === 'running' }">🔄</span>
      {{ refresh.status === 'running' ? 'Mise à jour…' : 'Rafraîchir' }}
    </button>
    <div v-if="refresh.message" class="refresh-msg" :class="refresh.status">{{ refresh.message }}</div>
    <router-link class="nav-link" to="/settings">⚙️ Paramètres</router-link>
    <div class="sync-badge" v-if="state.settings.githubRepo">
      ☁️ sync : {{ state.settings.githubRepo }}
    </div>
  </nav>
  <main class="content">
    <!-- key : remonte la vue quand le paramètre change (/sql/:id) ou quand les données sont rafraîchies -->
    <router-view :key="`${$route.fullPath}#${dataVersion}`" />
  </main>
</template>
