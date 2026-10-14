import strategy from './strategy.js'
import decorator from './decorator.js'
import observer from './observer.js'

// Katas de design patterns : un exercice canonique par pattern, refait jusqu'à la fluidité.
// Pour en ajouter un : copie un fichier, déclare-le ici, et ajoute son id dans
// KATA_NAMES de scripts/send-reminders.mjs pour les rappels par mail.
export const KATAS = [strategy, decorator, observer]

// Patterns prévus, par ordre d'utilité en PHP/Symfony
export const UPCOMING = [
  { name: 'Adapter', guru: 'https://refactoring.guru/fr/design-patterns/adapter' },
  { name: 'Factory Method', guru: 'https://refactoring.guru/fr/design-patterns/factory-method' },
  { name: 'Chain of Responsibility', guru: 'https://refactoring.guru/fr/design-patterns/chain-of-responsibility' },
  { name: 'Builder', guru: 'https://refactoring.guru/fr/design-patterns/builder' },
  { name: 'Command', guru: 'https://refactoring.guru/fr/design-patterns/command' },
  { name: 'Template Method', guru: 'https://refactoring.guru/fr/design-patterns/template-method' },
  { name: 'State', guru: 'https://refactoring.guru/fr/design-patterns/state' },
  { name: 'Composite', guru: 'https://refactoring.guru/fr/design-patterns/composite' },
  { name: 'Proxy', guru: 'https://refactoring.guru/fr/design-patterns/proxy' },
  { name: 'Facade', guru: 'https://refactoring.guru/fr/design-patterns/facade' },
]

export function kataById(id) {
  return KATAS.find((k) => k.id === id)
}
