import '@quasar/extras/material-icons/material-icons.css';
import '@quasar/extras/roboto-font/roboto-font.css';
import '@quasar/extras/fontawesome-v6/fontawesome-v6.css';
import { createHead } from '@unhead/vue/client';
import { createPinia } from 'pinia';
import { Dark, Quasar, Dialog, Notify } from 'quasar';
import 'quasar/src/css/index.sass';
import { createApp } from 'vue';
import App from './main.vue';
import router from './router';

const app = createApp(App);
const head = createHead();
const pinia = createPinia();
app.use(Quasar, {
  plugins: {
    Dialog,
    Notify,
  },
  config: {
    notify: {
      position: 'bottom-right',
      timeout: 3000,
      classes: 'glass-panel',
      actions: [{ icon: 'close', color: 'white', size: 'sm', round: true }]
    },
  },
});
app.use(head);
app.use(router);
app.use(pinia);
app.mount('#app');
Dark.set(true);
