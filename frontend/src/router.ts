import { createRouter, createWebHistory } from 'vue-router';
import LoginView from './views/LoginView.vue';
import RegisterView from './views/RegisterView.vue';
import TeamBuilderView from './views/TeamBuilderView.vue';
import CollectionView from './views/CollectionView.vue';
import SanctuaryView from './views/SanctuaryView.vue';
import BattleViewerView from './views/BattleViewerView.vue';
import CampaignView from './views/CampaignView.vue';
import PvPView from './views/PvPView.vue';
import PvPDefenseView from './views/PvPDefenseView.vue';
import BestiaireView from './views/BestiaireView.vue';
import LeaderboardView from './views/LeaderboardView.vue';
import AdminUnitBuilder from './views/AdminUnitBuilder.vue';
import ProfileView from './views/ProfileView.vue';
import ArtifactsView from './views/ArtifactsView.vue';
import GuildView from './views/GuildView.vue';
import { getToken, isAdminUser } from './api';

const routes = [
  { path: '/', redirect: '/collection' },
  { path: '/login', component: LoginView, meta: { guestOnly: true, authPage: true } },
  { path: '/register', component: RegisterView, meta: { guestOnly: true, authPage: true } },
  { path: '/dashboard', redirect: '/collection' },
  { path: '/team-builder', component: TeamBuilderView, meta: { requiresAuth: true } },
  { path: '/collection/:userId?', component: CollectionView, meta: { requiresAuth: true } },
  { path: '/bestiaire', component: BestiaireView, meta: { requiresAuth: true } },
  { path: '/sanctuary', component: SanctuaryView, meta: { requiresAuth: true } },
  { path: '/artifacts', component: ArtifactsView, meta: { requiresAuth: true } },
  { path: '/guild', component: GuildView, meta: { requiresAuth: true } },
  { path: '/guild-war', redirect: { path: '/guild', query: { tab: 'war' } } },
  { path: '/campaign', component: CampaignView, meta: { requiresAuth: true } },
  { path: '/pvp', component: PvPView, meta: { requiresAuth: true } },
  { path: '/pvp/defense', component: PvPDefenseView, meta: { requiresAuth: true } },
  { path: '/classement', component: LeaderboardView, meta: { requiresAuth: true } },
  { path: '/profile', component: ProfileView, meta: { requiresAuth: true } },
  { path: '/gacha', redirect: '/sanctuary' },
  { path: '/battle/:id', component: BattleViewerView, props: true },
  { path: '/admin/unit-builder', component: AdminUnitBuilder, meta: { requiresAuth: true, fullWidth: true, requiresAdmin: true } },
  { path: '/admin/player-units', component: () => import('./views/AdminPlayerUnits.vue'), meta: { requiresAuth: true, fullWidth: true, requiresAdmin: true } },
  { path: '/admin/player-artifacts', component: () => import('./views/AdminPlayerArtifacts.vue'), meta: { requiresAuth: true, fullWidth: true, requiresAdmin: true } },
  { path: '/admin/users', component: () => import('./views/AdminUsers.vue'), meta: { requiresAuth: true, fullWidth: true, requiresAdmin: true } },
  { path: '/faq', component: () => import('./views/FAQView.vue'), meta: { requiresAuth: true } },
  { path: '/feedback', component: () => import('./views/FeedbackView.vue'), meta: { requiresAuth: true } },
  { path: '/admin/feedback', component: () => import('./views/AdminFeedbackView.vue'), meta: { requiresAuth: true, fullWidth: true, requiresAdmin: true } }
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

