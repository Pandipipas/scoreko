import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: () => import('./views/Dashboard.vue') },
    { path: '/graphics', name: 'graphics', component: () => import('./views/Graphics.vue') },
    { path: '/packs', name: 'packs', component: () => import('./views/Packs.vue') },
    { path: '/players', name: 'players', component: () => import('./views/Players.vue') },
    { path: '/tournament', name: 'tournamentHub', component: () => import('./views/TournamentHub.vue') },
    { path: '/settings', name: 'settings', component: () => import('./views/Settings.vue') },
    { path: '/about', name: 'about', component: () => import('./views/About.vue') },
  ],
});

export default router;
