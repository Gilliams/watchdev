import { createRouter, createWebHashHistory } from 'vue-router'
import { themeById } from './data/themes.js'

import Home from './views/Home.vue'
import Veille from './views/Veille.vue'
import Digest from './views/Digest.vue'
import Geopolitique from './views/Geopolitique.vue'
import Trading from './views/Trading.vue'
import Quiz from './views/Quiz.vue'
import QuizSession from './views/QuizSession.vue'
import Sql from './views/Sql.vue'
import SqlCase from './views/SqlCase.vue'
import Settings from './views/Settings.vue'

export default createRouter({
  history: createWebHashHistory(),
  scrollBehavior: (to, from) => (to.path === from.path ? false : { top: 0 }),
  routes: [
    { path: '/', component: Home },
    { path: '/actu', component: Digest },
    { path: '/geopolitique', component: Geopolitique },
    {
      path: '/veille/:theme?',
      component: Veille,
      // Anciennes URL /veille/geopolitique, /veille/actu-monde… → page Géopolitique
      beforeEnter: (to) => {
        const t = themeById(to.params.theme)
        if (t?.group === 'monde') return { path: '/geopolitique', query: { theme: t.id } }
      },
    },
    { path: '/trading', component: Trading },
    { path: '/marches', redirect: '/trading' },
    { path: '/quiz', component: Quiz },
    { path: '/quiz/:theme', component: QuizSession },
    { path: '/sql', component: Sql },
    { path: '/sql/:id', component: SqlCase },
    { path: '/settings', component: Settings },
  ],
})
