import { createRouter, createWebHashHistory } from 'vue-router'

import Home from './views/Home.vue'
import Veille from './views/Veille.vue'
import Digest from './views/Digest.vue'
import Trading from './views/Trading.vue'
import Quiz from './views/Quiz.vue'
import QuizSession from './views/QuizSession.vue'
import Sql from './views/Sql.vue'
import SqlCase from './views/SqlCase.vue'
import Settings from './views/Settings.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
    // /veille/geopolitique, /veille/actu-monde… ouvrent la veille déjà filtrée
    { path: '/veille/:theme?', component: Veille },
    { path: '/actu', component: Digest },
    { path: '/trading', component: Trading },
    { path: '/quiz', component: Quiz },
    { path: '/quiz/:theme', component: QuizSession },
    { path: '/sql', component: Sql },
    { path: '/sql/:id', component: SqlCase },
    { path: '/settings', component: Settings },
  ],
})
