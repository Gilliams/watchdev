<script setup>
// Bloc de code PHP coloré (mêmes teintes que l'éditeur, thème One Dark)
import { computed } from 'vue'
import { highlightPhp } from '../lib/highlight.js'

const props = defineProps({ code: { type: String, required: true } })
const html = computed(() => highlightPhp(props.code))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html : le texte est échappé par highlightPhp -->
  <pre class="code-block hl" v-html="html"></pre>
</template>

<style scoped>
.hl { color: #abb2bf; font-size: 13.5px; line-height: 1.6; padding: 14px 16px; tab-size: 4; }
.hl :deep(.tok-keyword) { color: #c678dd; }
.hl :deep(.tok-string) { color: #98c379; }
.hl :deep(.tok-comment) { color: #7d8799; font-style: italic; }
.hl :deep(.tok-meta) { color: #7d8799; }
.hl :deep(.tok-number), .hl :deep(.tok-bool), .hl :deep(.tok-atom) { color: #d19a66; }
.hl :deep(.tok-variableName) { color: #e06c75; }
.hl :deep(.tok-definition) { color: #61afef; }
.hl :deep(.tok-propertyName) { color: #e5e9f0; }
.hl :deep(.tok-typeName), .hl :deep(.tok-className) { color: #e5c07b; }
.hl :deep(.tok-operator) { color: #56b6c2; }
.hl :deep(.tok-punctuation) { color: #8b929e; }
</style>
