<script setup>
import { state } from './stores/progress.js'
import { dueThemes } from './lib/spaced.js'
import { computed } from 'vue'

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
    <router-link class="nav-link" to="/settings">⚙️ Paramètres</router-link>
    <div class="sync-badge" v-if="state.settings.githubRepo">
      ☁️ sync : {{ state.settings.githubRepo }}
    </div>
  </nav>
  <main class="content">
    <!-- key = fullPath : force le remontage quand seul le paramètre change (ex : /sql/:id) -->
    <router-view :key="$route.fullPath" />
  </main>
</template>
