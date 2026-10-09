import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import '@fontsource-variable/archivo'
import './styles.css'
import './lib/theme.js'
import './lib/scenes.js'
import { loadProgress } from './stores/progress.js'

loadProgress()
createApp(App).use(router).mount('#app')
