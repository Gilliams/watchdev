// Coloration syntaxique PHP statique (blocs de code en lecture seule).
// Réutilise le parseur PHP de CodeMirror, déjà chargé par la page des katas.
import { highlightCode, classHighlighter } from '@lezer/highlight'
import { phpLanguage } from '@codemirror/lang-php'

// Extraits sans « <?php » : on parse directement en mode code PHP
const snippetParser = phpLanguage.parser.configure({ top: 'Program' })

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Renvoie du HTML échappé, chaque token entouré d'un <span class="tok-…">
export function highlightPhp(code) {
  const parser = code.trimStart().startsWith('<?php') ? phpLanguage.parser : snippetParser
  let html = ''
  highlightCode(
    code,
    parser.parse(code),
    classHighlighter,
    (text, cls) => (html += cls ? `<span class="${cls}">${escape(text)}</span>` : escape(text)),
    () => (html += '\n')
  )
  return html
}
