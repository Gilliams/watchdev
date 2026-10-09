<script setup>
import DwHeader from './components/DwHeader.vue'
import { dataVersion } from './lib/data.js'
</script>

<template>
  <DwHeader />
  <main>
    <!-- key : remonte la vue quand le paramètre change (/sql/:id) ou quand les données sont rafraîchies -->
    <router-view :key="`${$route.fullPath}#${dataVersion}`" />
  </main>
</template>
