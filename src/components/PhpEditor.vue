<script setup>
// Éditeur PHP (CodeMirror 6). Ctrl/Cmd+Entrée = valider, Ctrl/Cmd+Maj+Entrée = exécuter.
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { php } from '@codemirror/lang-php'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue', 'run', 'validate'])

const host = ref(null)
let view = null

// Fond et typo alignés sur les blocs de code du site
const look = EditorView.theme({
  '&': { backgroundColor: 'var(--code-bg)', fontSize: '14px', height: '100%' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.55' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', border: '0' },
  '&.cm-focused': { outline: 'none' },
})

onMounted(() => {
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        keymap.of([
          { key: 'Mod-Shift-Enter', run: () => (emit('run'), true) },
          { key: 'Mod-Enter', run: () => (emit('validate'), true) },
          indentWithTab,
        ]),
        basicSetup,
        php(),
        indentUnit.of('    '),
        oneDark,
        look,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
        }),
      ],
    }),
  })
})

// Remplacement externe du code (recommencer, étape suivante)
watch(
  () => props.modelValue,
  (v) => {
    if (view && v !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
    }
  }
)

onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div ref="host" class="php-editor"></div>
</template>

<style scoped>
.php-editor { height: clamp(360px, 62vh, 720px); overflow: hidden; background: var(--code-bg); }
.php-editor :deep(.cm-editor) { height: 100%; }
</style>
