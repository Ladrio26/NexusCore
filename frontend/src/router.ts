import { createRouter, createWebHistory } from 'vue-router';
import LoginView from './views/LoginView.vue';
import RegisterView from './views/RegisterView.vue';
import TeamBuilderView from './views/TeamBuilderView.vue';
import CollectionView from './views/CollectionView.vue';
import SanctuaryView from './views/SanctuaryView.vue';
import RestCenterView from './views/RestCenterView.vue';
import BestiaireView from './views/BestiaireView.vue';
import LeaderboardView from './views/LeaderboardView.vue';
import AdminUnitBuilder from './views/AdminUnitBuilder.vue';
import DungeonView from './views/DungeonView.vue';
import AdminDungeonView from './views/AdminDungeonView.vue';
import ProfileView from './views/ProfileView.vue';
import ArtifactsView from './views/ArtifactsView.vue';
import { getToken, isAdminUser } from './api';

const routes = [
  { path: '/', redirect: '/collection' },
  { path: '/login', component: LoginView, meta: { guestOnly: true, authPage: true } },
  { path: '/register', component: RegisterView, meta: { guestOnly: true, authPage: true } },
  { path: '/dashboard', redirect: '/collection' },
  { path: '/team-builder', component: TeamBuilderView, meta: { requiresAuth: true } },
  { path: '/collection/:userId?', component: CollectionView, meta: { requiresAuth: true } },
  { path: '/bestiaire', component: BestiaireView, meta: { requiresAuth: true } },
  { path: '/rest-center', component: RestCenterView, meta: { requiresAuth: true, fullWidth: true } },
  { path: '/sanctuary', component: SanctuaryView, meta: { requiresAuth: true } },
  { path: '/artifacts', component: ArtifactsView, meta: { requiresAuth: true } },
  { path: '/guild', component: () => import('./views/GuildView.vue'), meta: { requiresAuth: true } },
  { path: '/guild-war', redirect: { path: '/guild', query: { tab: 'war' } } },
  { path: '/campaign', component: () => import('./views/CampaignView.vue'), meta: { requiresAuth: true } },
  { path: '/pvp', component: () => import('./views/PvPView.vue'), meta: { requiresAuth: true, fullWidth: true } },
  { path: '/pvp/defense', component: () => import('./views/PvPDefenseView.vue'), meta: { requiresAuth: true } },
  { path: '/classement', component: LeaderboardView, meta: { requiresAuth: true } },
  { path: '/profile', component: ProfileView, meta: { requiresAuth: true } },
  { path: '/gacha', redirect: '/sanctuary' },
  { path: '/battle/:id', component: () => import('./views/BattleViewerView.vue'), props: true },
  { path: '/admin/unit-builder', component: AdminUnitBuilder, meta: { requiresAuth: true, fullWidth: true, requiresAdmin: true } },
  { path: '/admin/player-units', component: () => import('./views/AdminPlayerUnits.vue'), meta: { requiresAuth: true, fullWidth: true, requiresAdmin: true } },
  { path: '/admin/player-artifacts', component: () => import('./views/AdminPlayerArtifacts.vue'), meta: { requiresAuth: true, fullWidth: true, requiresAdmin: true } },
  { path: '/admin/users', component: () => import('./views/AdminUsers.vue'), meta: { requiresAuth: true, fullWidth: true, requiresAdmin: true } },
  { path: '/faq', component: () => import('./views/FAQView.vue'), meta: { requiresAuth: true } },
  { path: '/feedback', component: () => import('./views/FeedbackView.vue'), meta: { requiresAuth: true } },
  /** Public : joueurs non connectés peuvent lire les notes de version (déploiement inclus). */
  { path: '/news', component: () => import('./views/NewsView.vue') },
  { path: '/admin/feedback', component: () => import('./views/AdminFeedbackView.vue'), meta: { requiresAuth: true, fullWidth: true, requiresAdmin: true } },
  { path: '/admin/campaign', component: () => import('./views/AdminCampaignView.vue'), meta: { requiresAuth: true, fullWidth: true, requiresAdmin: true } },
  { path: '/admin/dungeon', component: AdminDungeonView, meta: { requiresAuth: true, fullWidth: true, requiresAdmin: true } },
  {
    path: '/admin/custom-unit',
    component: () => import('./views/CustomUnitView.vue'),
    meta: { requiresAuth: true, fullWidth: true, requiresAdmin: true }
  },
  /** Donjon joueur : tout compte connecté (pas requiresAdmin). Admin = /admin/dungeon. */
  { path: '/dungeon', component: DungeonView, meta: { requiresAuth: true, fullWidth: true } }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to) => {
  const token = getToken();
  const isAuthenticated = !!token;
  const requiresAuth = to.meta.requiresAuth === true;
  const guestOnly = to.meta.guestOnly === true;

  // Empêcher l'accès aux pages invité (login/register) si déjà connecté
  if (guestOnly && isAuthenticated) {
    return { path: '/collection' };
  }

  // Protéger les pages qui nécessitent l'auth
  if (requiresAuth && !isAuthenticated) {
    return { path: '/login' };
  }

  // Restreindre l'accès admin selon le rôle porté par le JWT
  if (to.meta.requiresAdmin === true && !isAdminUser()) {
    return { path: '/collection' };
  }

  return true;
});

export default router;

