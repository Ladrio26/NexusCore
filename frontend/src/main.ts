import './api'; /* Force API init first to avoid "Cannot access before initialization" */
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

import './style.css';

const app = createApp(App);
app.use(router);
app.mount('#app');
