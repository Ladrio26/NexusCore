<template>
  <div class="app" :class="{ 'app-with-sidebar': isAuthenticated, 'sidebar-open': sidebarOpen }">
    <div class="app-bg" aria-hidden="true" />
    <NexusParticles />
    <header v-if="isAuthenticated" class="app-header-mobile">
      <button type="button" class="hamburger-btn" aria-label="Ouvrir le menu" @click="sidebarOpen = true">
        <span class="hamburger-bar" />
        <span class="hamburger-bar" />
        <span class="hamburger-bar" />
      </button>
    </header>
    <div v-if="isAuthenticated && sidebarOpen" class="sidebar-backdrop" aria-hidden="true" @click="sidebarOpen = false" />
    <aside v-if="isAuthenticated" class="app-sidebar">
      <div class="sidebar-user" v-if="currentUser">
        <div class="sidebar-username">{{ currentUser.display_name || currentUser.email || '—' }}</div>
        <div class="sidebar-wallet">
          <div class="sidebar-wallet-row">
            <span class="sidebar-wallet-item credits" title="Crédits">💰 {{ wallet.credits }}</span>
            <span class="sidebar-wallet-item cores" title="Cores">🔷 {{ wallet.cores }}</span>
            <span class="sidebar-wallet-item fragments" title="Fragments">🧩 {{ wallet.fragments }}</span>
            <span class="sidebar-wallet-item gold" title="Or">🪙 {{ wallet.gold }}</span>
          </div>
          <div class="sidebar-wallet-row sidebar-wallet-row-divine">
            <span class="sidebar-wallet-item divine-cores" title="Cores divins">💎 {{ wallet.divine_cores ?? 0 }}</span>
            <span class="sidebar-wallet-item divine-credits" title="Crédits divins">💠 {{ wallet.divine_credits ?? 0 }}</span>
            <span class="sidebar-wallet-item divine-fragments" title="Fragments divins">🔮 {{ wallet.divine_fragments ?? 0 }}</span>
          </div>
        </div>
      </div>
      <h1 class="sidebar-title">Nexus Core Arena</h1>
      <nav class="sidebar-menu">
        <router-link to="/collection" class="menu-item" @click="sidebarOpen = false">Ma Collection</router-link>
        <router-link to="/team-builder" class="menu-item" @click="sidebarOpen = false">Mes Equipes</router-link>
        <router-link to="/rest-center" class="menu-item" @click="sidebarOpen = false">Centre de Repos</router-link>
        <router-link to="/sanctuary" class="menu-item menu-item-with-indicator" @click="sidebarOpen = false">
          <span>Sanctuaires</span>
          <span v-if="hasSanctuaryNotification" class="menu-item-indicator" aria-label="Invocation disponible" title="Invocation disponible" />
        </router-link>
        <router-link to="/artifacts" class="menu-item" @click="sidebarOpen = false">Artefacts</router-link>
        <router-link to="/guild" class="menu-item" @click="sidebarOpen = false">Guilde</router-link>
        <div class="menu-dropdown">
          <button type="button" class="menu-item menu-item-trigger" :class="{ open: combatsMenuOpen, 'router-link-active': isCombatsRoute }" @click="combatsMenuOpen = !combatsMenuOpen" aria-haspopup="true" :aria-expanded="combatsMenuOpen">
            Combats
          </button>
          <div v-show="combatsMenuOpen" class="menu-dropdown-panel">
            <router-link to="/campaign" class="menu-item menu-subitem" @click="combatsMenuOpen = false; sidebarOpen = false">Campagne</router-link>
            <!-- Donjon joueur : tout joueur connecté. L’édition des compositions ennemies = Admin → Donjon Admin uniquement. -->
            <router-link to="/dungeon" class="menu-item menu-subitem" @click="combatsMenuOpen = false; sidebarOpen = false">Donjon</router-link>
            <router-link to="/pvp" class="menu-item menu-subitem" @click="combatsMenuOpen = false; sidebarOpen = false">
              P.v.P<span v-if="pvpEnergyNav !== null"> ({{ pvpEnergyNav }})</span>
            </router-link>
          </div>
        </div>
        <router-link to="/classement" class="menu-item" @click="sidebarOpen = false">Classement</router-link>
        <router-link to="/bestiaire" class="menu-item" @click="sidebarOpen = false">Bestiaire</router-link>
        <router-link to="/faq" class="menu-item" @click="sidebarOpen = false">F.A.Q</router-link>
        <router-link to="/news" class="menu-item menu-item-news menu-item-with-indicator" @click="sidebarOpen = false">
          <span>📰 News</span>
          <span v-if="hasNewsNotification" class="menu-item-indicator" aria-label="Nouvelle actualité" title="Nouvelle actualité" />
        </router-link>
        <router-link to="/feedback" class="menu-item" @click="sidebarOpen = false">Feedback</router-link>
        <div v-if="isAdmin" class="menu-dropdown">
          <button type="button" class="menu-item menu-item-trigger" :class="{ open: adminMenuOpen, 'router-link-active': isAdminRoute }" @click="adminMenuOpen = !adminMenuOpen" aria-haspopup="true" :aria-expanded="adminMenuOpen">
            Admin
          </button>
          <div v-show="adminMenuOpen" class="menu-dropdown-panel">
            <router-link to="/admin/unit-builder" class="menu-item menu-subitem" @click="adminMenuOpen = false; sidebarOpen = false">Unit Builder</router-link>
            <router-link to="/admin/player-units" class="menu-item menu-subitem" @click="adminMenuOpen = false; sidebarOpen = false">Gestion unités joueurs</router-link>
            <router-link to="/admin/users" class="menu-item menu-subitem" @click="adminMenuOpen = false; sidebarOpen = false">Gestion Utilisateurs</router-link>
            <router-link to="/admin/feedback" class="menu-item menu-subitem" @click="adminMenuOpen = false; sidebarOpen = false">Feedback / Tickets</router-link>
            <router-link to="/admin/campaign" class="menu-item menu-subitem" @click="adminMenuOpen = false; sidebarOpen = false">Campagne Admin</router-link>
            <router-link to="/admin/dungeon" class="menu-item menu-subitem" @click="adminMenuOpen = false; sidebarOpen = false">Donjon Admin</router-link>
            <router-link to="/admin/custom-unit" class="menu-item menu-subitem" @click="adminMenuOpen = false; sidebarOpen = false">Unité Personnalisée</router-link>
            <router-link to="/admin/bots" class="menu-item menu-subitem" @click="adminMenuOpen = false; sidebarOpen = false">Bots joueurs</router-link>
          </div>
        </div>
      </nav>
      <div class="sidebar-bottom">
        <router-link to="/profile" class="btn-profile" @click="sidebarOpen = false">Profil</router-link>
        <button type="button" class="btn-logout" @click="logout">Déconnexion</button>
      </div>
    </aside>
    <main class="app-main" :class="{ 'app-main-fullwidth': route.meta.fullWidth, 'app-main-auth': route.meta.authPage }">
      <NotificationBell v-if="isAuthenticated" class="app-notification-bell" />
      <router-view />
    </main>
    <TutorialOverlay />
    <StageModal
      v-if="combatTutorialShow && combatTutorialPending"
      :show="combatTutorialShow"
      :chapter="1"
      :stage="1"
      mode="normal"
      :stage-info="combatTutorialStageInfo"
      :campaign-team="[]"
      :pending-battle="combatTutorialPending"
      tutorial-mode
      @close="onCombatTutorialModalClose"
    />
    <Teleport to="body">
      <Transition name="client-update-banner">
        <div
          v-if="showUpdateBanner"
          class="client-update-banner"
          role="status"
          aria-live="polite"
        >
          <div class="client-update-banner-inner">
            <p class="client-update-banner-text">
              Une nouvelle version du site est disponible. Tu peux charger la mise à jour quand tu voudras, c’est instantané&nbsp;:
            </p>
            <button type="button" class="nx-btn client-update-btn-primary" @click="acknowledgeAndReload">
              Mettre à jour
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
    <Transition name="daily-reward">
      <div
        v-if="dailyRewardPopup"
        class="daily-reward-overlay"
        @click.self="closeDailyRewardPopup"
      >
        <section class="daily-reward-modal nx-panel">
          <span class="daily-reward-kicker">Connexion quotidienne validée</span>
          <h2 class="daily-reward-title">Récompense journalière</h2>
          <p class="daily-reward-text">
            Ta première connexion du jour t'offre ces ressources :
          </p>
          <div class="daily-reward-grid">
            <div class="daily-reward-card credits">
              <span class="daily-reward-icon">💰</span>
              <strong>+{{ dailyRewardPopup.credits }}</strong>
              <span>Crédits</span>
            </div>
            <div class="daily-reward-card cores">
              <span class="daily-reward-icon">🔷</span>
              <strong>+{{ dailyRewardPopup.cores }}</strong>
              <span>Cores</span>
            </div>
            <div class="daily-reward-card fragments">
              <span class="daily-reward-icon">🧩</span>
              <strong>+{{ dailyRewardPopup.fragments }}</strong>
              <span>Fragments</span>
            </div>
          </div>
          <button type="button" class="nx-btn daily-reward-close" @click="closeDailyRewardPopup">
            Super
          </button>
        </section>
      </div>
    </Transition>
    <Transition name="daily-reward">
      <div
        v-if="dungeonFirstClearPopup"
        class="daily-reward-overlay"
        @click.self="closeDungeonFirstClearPopup"
      >
        <section class="daily-reward-modal nx-panel dungeon-first-clear-modal">
          <span class="daily-reward-kicker">Niveau {{ dungeonFirstClearPopup.level }} réussi</span>
          <h2 class="daily-reward-title">Récompenses de première réussite</h2>
          <p class="daily-reward-text">Liste des récompenses :</p>
          <div class="daily-reward-grid daily-reward-grid--six">
            <div class="daily-reward-card credits">
              <span class="daily-reward-icon">💰</span>
              <strong>+{{ dungeonFirstClearPopup.credits }}</strong>
              <span>Crédits</span>
            </div>
            <div class="daily-reward-card cores">
              <span class="daily-reward-icon">🔷</span>
              <strong>+{{ dungeonFirstClearPopup.cores }}</strong>
              <span>Cores</span>
            </div>
            <div class="daily-reward-card fragments">
              <span class="daily-reward-icon">🧩</span>
              <strong>+{{ dungeonFirstClearPopup.fragments }}</strong>
              <span>Fragments</span>
            </div>
            <div class="daily-reward-card divine-credits">
              <span class="daily-reward-icon">💠</span>
              <strong>+{{ dungeonFirstClearPopup.divine_credits }}</strong>
              <span>Crédits divins</span>
            </div>
            <div class="daily-reward-card divine-cores">
              <span class="daily-reward-icon">💎</span>
              <strong>+{{ dungeonFirstClearPopup.divine_cores }}</strong>
              <span>Cores divins</span>
            </div>
            <div class="daily-reward-card divine-fragments">
              <span class="daily-reward-icon">🔮</span>
              <strong>+{{ dungeonFirstClearPopup.divine_fragments }}</strong>
              <span>Fragments divins</span>
            </div>
          </div>
          <button type="button" class="nx-btn daily-reward-close" @click="closeDungeonFirstClearPopup">
            Super
          </button>
        </section>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import api, { authToken, clearToken, isAdminUser } from './api';
import NexusParticles from './components/NexusParticles.vue';
import NotificationBell from './components/NotificationBell.vue';
import TutorialOverlay from './components/TutorialOverlay.vue';
import StageModal from './views/StageModal.vue';
import { startTutorial } from './composables/useTutorial';
import { useClientUpdateCheck } from './composables/useClientUpdateCheck';
import {
  getLatestNewsSignature,
  readNewsLastSeenSignature,
  writeNewsLastSeenSignature
} from './data/newsData';

const { showUpdateBanner, acknowledgeAndReload } = useClientUpdateCheck();

const router = useRouter();
const route = useRoute();
const isAuthenticated = computed(() => !!authToken.value);
const isAdmin = computed(() => {
  void authToken.value;
  return isAdminUser();
});
const currentUser = ref<{
  id: number;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  combat_tutorial_completed?: boolean;
} | null>(null);

const combatTutorialShow = ref(false);
const combatTutorialPending = ref<Record<string, unknown> | null>(null);
const combatTutorialStageInfo = {
  stage: 1,
  isBoss: false,
  cleared: false,
  rewardClaimed: false,
  available: true
} as const;
const sidebarOpen = ref(false);
const adminMenuOpen = ref(false);
const combatsMenuOpen = ref(false);
const dailyRewardPopup = ref<{ credits: number; cores: number; fragments: number } | null>(null);
type DungeonFirstClearPayload = {
  level: number;
  credits: number;
  cores: number;
  fragments: number;
  divine_credits: number;
  divine_cores: number;
  divine_fragments: number;
};
const dungeonFirstClearPopup = ref<DungeonFirstClearPayload | null>(null);
const dailyRewardTimerId = ref<number | null>(null);
const dailyRewardCheckInFlight = ref(false);
const wallet = ref({ credits: 0, cores: 0, fragments: 0, gold: 0, divine_cores: 0, divine_credits: 0, divine_fragments: 0 });
/** Compteur PvP (0–10) pour le libellé du menu — synchronisé via /pvp/me et événement pvp-me-updated */
const pvpEnergyNav = ref<number | null>(null);
const isAdminRoute = computed(() => route.path.startsWith('/admin'));
const isCombatsRoute = computed(
  () => route.path === '/campaign' || route.path === '/dungeon' || route.path === '/pvp'
);
const hasSanctuaryNotification = computed(() => (
  wallet.value.cores >= 10
  || wallet.value.credits >= 100
  || wallet.value.fragments >= 100
));

const newsSeenSignature = ref(typeof window !== 'undefined' ? readNewsLastSeenSignature() : '');
const hasNewsNotification = computed(() => {
  if (!authToken.value) return false;
  const latest = getLatestNewsSignature();
  if (!latest) return false;
  return latest !== newsSeenSignature.value;
});

watch(() => route.path, (path) => {
  sidebarOpen.value = false;
  adminMenuOpen.value = path.startsWith('/admin');
  combatsMenuOpen.value = path === '/campaign' || path === '/pvp';
  if (path === '/pvp' && authToken.value) {
    void fetchPvpEnergyNav();
  }
  if (path === '/news' && authToken.value) {
    const sig = getLatestNewsSignature();
    writeNewsLastSeenSignature(sig);
    newsSeenSignature.value = sig;
  }
}, { immediate: true });

async function fetchCurrentUser() {
  if (!authToken.value) return;
  try {
    const { data } = await api.get('/auth/me');
    currentUser.value = data.user;
  } catch {
    currentUser.value = null;
  }
}

async function tryResumeCombatTutorial() {
  if (!authToken.value) return;
  const generalDone =
    typeof localStorage !== 'undefined' && localStorage.getItem('nca_tutorial_v1_done') === '1';
  try {
    const { data: me } = await api.get('/auth/me');
    if (me?.user?.combat_tutorial_completed) return;
    const { data: pend } = await api.get('/battle/pending');
    const pb = pend?.pendingBattle as Record<string, unknown> | undefined;
    if (pb && String(pb.battleType) === 'tutorial') {
      combatTutorialPending.value = pb;
      combatTutorialShow.value = true;
      return;
    }
    if (!generalDone) return;
    const { data } = await api.post('/tutorial/start-battle');
    if (data?.pendingBattle) {
      combatTutorialPending.value = data.pendingBattle as Record<string, unknown>;
      combatTutorialShow.value = true;
    }
  } catch (e: unknown) {
    const st = (e as { response?: { status?: number } })?.response?.status;
    if (st === 409) return;
  }
}

async function onTutorialGeneralClosed() {
  if (!authToken.value) return;
  try {
    const { data: me } = await api.get('/auth/me');
    if (me?.user?.combat_tutorial_completed) return;
    const { data } = await api.post('/tutorial/start-battle');
    if (data?.pendingBattle) {
      combatTutorialPending.value = data.pendingBattle as Record<string, unknown>;
      combatTutorialShow.value = true;
    }
  } catch (e: unknown) {
    const st = (e as { response?: { status?: number } })?.response?.status;
    if (st === 409) return;
  }
}

function onCombatTutorialModalClose() {
  combatTutorialShow.value = false;
  combatTutorialPending.value = null;
  void fetchCurrentUser();
}

async function fetchPvpEnergyNav() {
  if (!authToken.value) return;
  try {
    const { data } = await api.get('/pvp/me');
    const n = data?.pvp_energy;
    pvpEnergyNav.value = typeof n === 'number' ? n : null;
  } catch {
    pvpEnergyNav.value = null;
  }
}

function handlePvpMeUpdated() {
  void fetchPvpEnergyNav();
}

async function fetchWallet() {
  if (!authToken.value) return;
  try {
    const { data } = await api.get('/wallet');
    wallet.value = {
      credits: Number(data.credits ?? 0),
      cores: Number(data.cores ?? 0),
      fragments: Number(data.fragments ?? 0),
      gold: Number(data.gold ?? 0),
      divine_cores: Number(data.divine_cores ?? 0),
      divine_credits: Number(data.divine_credits ?? 0),
      divine_fragments: Number(data.divine_fragments ?? 0)
    };
  } catch {
    wallet.value = { credits: 0, cores: 0, fragments: 0, gold: 0, divine_cores: 0, divine_credits: 0, divine_fragments: 0 };
  }
}

function handleWalletUpdated(event: Event) {
  const detail = (event as CustomEvent<{
    credits?: number;
    cores?: number;
    fragments?: number;
    gold?: number;
    divine_cores?: number;
    divine_credits?: number;
    divine_fragments?: number;
  }>).detail;
  if (!detail) return;
  wallet.value = {
    credits: Number(detail.credits ?? wallet.value.credits ?? 0),
    cores: Number(detail.cores ?? wallet.value.cores ?? 0),
    fragments: Number(detail.fragments ?? wallet.value.fragments ?? 0),
    gold: Number(detail.gold ?? wallet.value.gold ?? 0),
    divine_cores: Number(detail.divine_cores ?? wallet.value.divine_cores ?? 0),
    divine_credits: Number(detail.divine_credits ?? wallet.value.divine_credits ?? 0),
    divine_fragments: Number(detail.divine_fragments ?? wallet.value.divine_fragments ?? 0)
  };
}

function closeDailyRewardPopup() {
  dailyRewardPopup.value = null;
}

function closeDungeonFirstClearPopup() {
  dungeonFirstClearPopup.value = null;
}

function handleDungeonFirstClearEvent(e: Event) {
  const detail = (e as CustomEvent<DungeonFirstClearPayload>).detail;
  if (!detail || typeof detail.level !== 'number') return;
  dungeonFirstClearPopup.value = {
    level: Number(detail.level),
    credits: Number(detail.credits ?? 0),
    cores: Number(detail.cores ?? 0),
    fragments: Number(detail.fragments ?? 0),
    divine_credits: Number(detail.divine_credits ?? 0),
    divine_cores: Number(detail.divine_cores ?? 0),
    divine_fragments: Number(detail.divine_fragments ?? 0)
  };
}

function clearDailyRewardTimer() {
  if (dailyRewardTimerId.value != null) {
    window.clearTimeout(dailyRewardTimerId.value);
    dailyRewardTimerId.value = null;
  }
}

function scheduleDailyRewardCheck(nextResetAt?: string | null) {
  clearDailyRewardTimer();
  if (!authToken.value) return;
  let delayMs = 60_000;
  if (nextResetAt) {
    const targetMs = new Date(nextResetAt).getTime();
    if (Number.isFinite(targetMs)) {
      delayMs = Math.max(1_000, targetMs - Date.now() + 1_000);
    }
  }
  dailyRewardTimerId.value = window.setTimeout(() => {
    void checkDailyReward();
  }, delayMs);
}

function emitWalletUpdated(wallet?: { credits: number; cores: number; fragments: number; gold?: number; ascension_essence?: number }) {
  if (!wallet) return;
  window.dispatchEvent(new CustomEvent('wallet-updated', { detail: wallet }));
}

async function checkDailyReward() {
  if (!authToken.value || dailyRewardCheckInFlight.value) return;
  dailyRewardCheckInFlight.value = true;
  try {
    const { data } = await api.post('/auth/daily-reward/claim');
    scheduleDailyRewardCheck(data.nextResetAt);
    emitWalletUpdated(data.wallet);
    if (data.claimed && data.reward) {
      dailyRewardPopup.value = {
        credits: Number(data.reward.credits ?? 0),
        cores: Number(data.reward.cores ?? 0),
        fragments: Number(data.reward.fragments ?? 0)
      };
    }
  } catch {
    scheduleDailyRewardCheck();
  } finally {
    dailyRewardCheckInFlight.value = false;
  }
}

function handleWindowResume() {
  if (document.visibilityState === 'hidden') return;
  void checkDailyReward();
}

watch(authToken, async (token) => {
  clearDailyRewardTimer();
  if (!token) {
    currentUser.value = null;
    dailyRewardPopup.value = null;
    dungeonFirstClearPopup.value = null;
    wallet.value = { credits: 0, cores: 0, fragments: 0, gold: 0, divine_cores: 0, divine_credits: 0, divine_fragments: 0 };
    pvpEnergyNav.value = null;
    combatTutorialShow.value = false;
    combatTutorialPending.value = null;
    return;
  }
  newsSeenSignature.value = readNewsLastSeenSignature();
  await fetchCurrentUser();
  await fetchWallet();
  void fetchPvpEnergyNav();
  await checkDailyReward();
  await tryResumeCombatTutorial();
  // Démarrer le tutoriel pour les nouveaux joueurs (après un délai pour laisser la popup quotidienne s'afficher)
  setTimeout(() => startTutorial(), 1800);
}, { immediate: true });

function handleTutorialOpenCombats() {
  combatsMenuOpen.value = true;
}

function handleTutorialOpenSidebar() {
  sidebarOpen.value = true;
}

onMounted(() => {
  window.addEventListener('profile-updated', fetchCurrentUser);
  window.addEventListener('wallet-updated', handleWalletUpdated as EventListener);
  window.addEventListener('pvp-me-updated', handlePvpMeUpdated);
  window.addEventListener('dungeon-first-clear', handleDungeonFirstClearEvent as EventListener);
  window.addEventListener('focus', handleWindowResume);
  document.addEventListener('visibilitychange', handleWindowResume);
  window.addEventListener('tutorial:open-combats', handleTutorialOpenCombats);
  window.addEventListener('tutorial:open-sidebar', handleTutorialOpenSidebar);
  window.addEventListener('nca:tutorial-general-closed', onTutorialGeneralClosed);
});

onUnmounted(() => {
  window.removeEventListener('profile-updated', fetchCurrentUser);
  window.removeEventListener('wallet-updated', handleWalletUpdated as EventListener);
  window.removeEventListener('pvp-me-updated', handlePvpMeUpdated);
  window.removeEventListener('dungeon-first-clear', handleDungeonFirstClearEvent as EventListener);
  window.removeEventListener('focus', handleWindowResume);
  document.removeEventListener('visibilitychange', handleWindowResume);
  window.removeEventListener('tutorial:open-combats', handleTutorialOpenCombats);
  window.removeEventListener('tutorial:open-sidebar', handleTutorialOpenSidebar);
  window.removeEventListener('nca:tutorial-general-closed', onTutorialGeneralClosed);
  clearDailyRewardTimer();
});

function logout() {
  clearToken();
  currentUser.value = null;
  router.push('/login');
}
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: #f9fafb;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  position: relative;
}

.app-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: url('/images/Fond.png') center center / cover no-repeat;
  pointer-events: none;
}

/* Header mobile (hamburger) — visible uniquement sur mobile */
.app-header-mobile {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 44px;
  padding: 0 0.5rem;
  align-items: center;
  background: rgba(10, 15, 30, 0.9);
  border-bottom: 1px solid rgba(0, 255, 255, 0.15);
  z-index: 20;
}

.hamburger-btn {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.8);
  color: #e5e7eb;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.hamburger-btn:hover {
  background: rgba(0, 255, 200, 0.12);
  border-color: rgba(0, 255, 200, 0.4);
}

.hamburger-bar {
  display: block;
  width: 20px;
  height: 2px;
  background: currentColor;
  border-radius: 1px;
  margin: 0 auto;
}

.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.6);
  backdrop-filter: blur(4px);
  z-index: 25;
  cursor: pointer;
}

.app.app-with-sidebar {
  flex-direction: row;
}

.app-sidebar {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  border-right: 1px solid rgba(0, 255, 255, 0.15);
  background: rgba(10, 15, 30, 0.65);
  box-shadow: 0 0 25px rgba(0, 255, 255, 0.05);
  position: sticky;
  top: 0;
  align-self: flex-start;
  overflow-y: auto;
  z-index: 5;
}

.sidebar-user {
  padding: 6px 8px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.sidebar-username {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 500;
  color: #e5e7eb;
  word-break: break-word;
  line-height: 1.2;
}

.sidebar-wallet {
  margin-top: 0.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.6rem;
  color: #cbd5e1;
}

.sidebar-wallet-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.15rem 0.2rem;
}

.sidebar-wallet-row-divine {
  grid-template-columns: repeat(3, 1fr);
  padding-top: 0.2rem;
  border-top: 1px solid rgba(255,255,255,0.08);
}

.sidebar-wallet-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.12rem;
  padding: 0.08rem 0.2rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.2);
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-wallet-item.credits {
  color: #fcd34d;
}

.sidebar-wallet-item.cores {
  color: #93c5fd;
}

.sidebar-wallet-item.fragments {
  color: #c4b5fd;
}

.sidebar-wallet-item.gold {
  color: #f59e0b;
}

.sidebar-wallet-item.divine-cores {
  color: #a78bfa;
}

.sidebar-wallet-item.divine-credits {
  color: #67e8f9;
}

.sidebar-wallet-item.divine-fragments {
  color: #c084fc;
}

.sidebar-title {
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 1rem 1.25rem 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  color: #e5e7eb;
}

.sidebar-menu {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0 0.75rem;
  overflow-y: auto;
}

.sidebar-bottom {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 3px;
  padding: 4px 6px;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}
.btn-profile {
  flex: 1;
  min-width: 0;
  color: rgba(0, 255, 255, 0.9);
  text-decoration: none;
  text-align: center;
  padding: 0.18rem 0.28rem;
  border-radius: 0.3rem;
  border: 1px solid transparent;
  font-size: 0.68rem;
  transition: background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}
.btn-profile:hover {
  background: rgba(0, 255, 255, 0.12);
  border-color: rgba(0, 255, 255, 0.35);
  box-shadow: 0 0 14px rgba(0, 255, 255, 0.25);
}
.btn-profile.router-link-active {
  color: #00ffff;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0 0.75rem;
}

.sidebar-nav a {
  display: block;
  color: #e5e7eb;
  text-decoration: none;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  font-size: 0.9rem;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.menu-item {
  position: relative;
  display: block;
  color: #e5e7eb;
  text-decoration: none;
  padding: 0.55rem 0.9rem;
  border-radius: 0.6rem;
  border: 1px solid transparent;
  font-size: 0.9rem;
  transition:
    background 0.25s ease,
    border-color 0.25s ease,
    transform 0.25s ease,
    box-shadow 0.25s ease;
}

.menu-item-news {
  font-weight: 600;
}

.menu-item-with-indicator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
}

.menu-item-indicator {
  width: 10px;
  height: 10px;
  flex: 0 0 10px;
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, #fef08a, #f59e0b 60%, #dc2626 100%);
  box-shadow:
    0 0 0 2px rgba(15, 23, 42, 0.9),
    0 0 10px rgba(245, 158, 11, 0.75);
}

.menu-item:hover {
  background: linear-gradient(
    90deg,
    rgba(0, 255, 255, 0.15),
    rgba(0, 255, 255, 0.05)
  );
  border-color: rgba(56, 189, 248, 0.3);
  transform: translateX(6px);
  box-shadow: 0 0 12px rgba(0, 255, 255, 0.2);
}

.menu-item.router-link-active {
  position: relative;
  color: #00ffff;
}

.menu-item.router-link-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(to bottom, #00ffff, #8a2be2);
  box-shadow: 0 0 10px #00ffff;
  border-radius: 999px;
}

.menu-dropdown {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.menu-item-trigger {
  width: 100%;
  text-align: left;
  cursor: pointer;
  background: none;
  font: inherit;
  color: inherit;
}
.menu-item-trigger.open {
  background: linear-gradient(90deg, rgba(0, 255, 255, 0.12), rgba(0, 255, 255, 0.04));
  border-color: rgba(56, 189, 248, 0.25);
}
.menu-dropdown-panel {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding-left: 1rem;
  border-left: 2px solid rgba(0, 255, 255, 0.2);
  margin-left: 0.5rem;
}
.menu-subitem {
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  color: #cbd5e1;
}
.menu-subitem.router-link-active {
  color: #00ffff;
}

.btn-logout {
  flex: 1;
  min-width: 0;
  padding: 0.2rem 0.35rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(248, 113, 113, 0.6);
  background: transparent;
  color: #fca5a5;
  cursor: pointer;
  font-size: 0.7rem;
  text-align: center;
  transition: background 0.15s ease;
}

.btn-logout:hover {
  background: rgba(248, 113, 113, 0.1);
}

.app-main {
  flex: 1;
  padding: 0.75rem 1rem;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.app-notification-bell {
  position: absolute;
  top: 1rem;
  left: 1rem;
  z-index: 10;
}

.app-main.app-main-fullwidth {
  padding-left: 0 !important;
  padding-right: 0 !important;
  max-width: 100%;
}

.app-main.app-main-auth {
  padding: 0 !important;
  overflow: hidden;
}

.daily-reward-overlay {
  position: fixed;
  inset: 0;
  z-index: 9100; /* Au-dessus du tutoriel (9000) pour pouvoir valider la récompense avant */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(2, 6, 23, 0.78);
  backdrop-filter: blur(10px);
}

.daily-reward-modal {
  width: min(100%, 520px);
  padding: 1.75rem;
  border-radius: 1.25rem;
  border: 1px solid rgba(34, 211, 238, 0.3);
  background:
    radial-gradient(circle at top, rgba(56, 189, 248, 0.22), transparent 55%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.98));
  box-shadow:
    0 24px 80px rgba(2, 6, 23, 0.72),
    0 0 30px rgba(34, 211, 238, 0.14);
  text-align: center;
}

.daily-reward-kicker {
  display: inline-block;
  margin-bottom: 0.85rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(34, 211, 238, 0.12);
  border: 1px solid rgba(34, 211, 238, 0.28);
  color: #67e8f9;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.daily-reward-title {
  margin: 0;
  font-size: 1.9rem;
  color: #f8fafc;
}

.daily-reward-text {
  margin: 0.9rem 0 1.4rem;
  color: #cbd5e1;
  line-height: 1.5;
}

.daily-reward-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
}

.daily-reward-grid--six {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dungeon-first-clear-modal {
  width: min(100%, 640px);
}

@media (max-width: 520px) {
  .daily-reward-grid--six {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.daily-reward-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 1rem 0.75rem;
  border-radius: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.72);
  color: #e2e8f0;
}

.daily-reward-card strong {
  font-size: 1.45rem;
  color: #f8fafc;
}

.daily-reward-card.credits {
  box-shadow: inset 0 0 0 1px rgba(250, 204, 21, 0.18);
}

.daily-reward-card.cores {
  box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.22);
}

.daily-reward-card.fragments {
  box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.22);
}

.daily-reward-card.divine-credits {
  box-shadow: inset 0 0 0 1px rgba(103, 232, 249, 0.22);
}

.daily-reward-card.divine-cores {
  box-shadow: inset 0 0 0 1px rgba(167, 139, 250, 0.28);
}

.daily-reward-card.divine-fragments {
  box-shadow: inset 0 0 0 1px rgba(196, 181, 253, 0.22);
}

.daily-reward-icon {
  font-size: 1.6rem;
}

.daily-reward-close {
  margin-top: 1.4rem;
  min-width: 160px;
}

.daily-reward-enter-active,
.daily-reward-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.daily-reward-enter-from,
.daily-reward-leave-to {
  opacity: 0;
}

.daily-reward-enter-from .daily-reward-modal,
.daily-reward-leave-to .daily-reward-modal {
  transform: translateY(12px) scale(0.98);
}

.client-update-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 8500;
  padding: 0.85rem 1rem;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.97), rgba(2, 6, 23, 0.99));
  border-top: 1px solid rgba(34, 211, 238, 0.35);
  box-shadow: 0 -8px 32px rgba(2, 6, 23, 0.55);
}

.client-update-banner-inner {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.65rem 1rem;
}

.client-update-banner-text {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: #e2e8f0;
  text-align: center;
  flex: 1 1 260px;
}

.client-update-btn-primary {
  flex-shrink: 0;
  min-width: 120px;
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.25), rgba(56, 189, 248, 0.15));
  border-color: rgba(34, 211, 238, 0.45);
  color: #f0fdfa;
}

.client-update-banner-enter-active,
.client-update-banner-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

.client-update-banner-enter-from,
.client-update-banner-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

/* Mobile layout (< 768px) */
@media (max-width: 768px) {
  .app-header-mobile {
    display: flex;
  }

  .app.app-with-sidebar .app-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 220px;
    height: 100vh;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    z-index: 30;
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
  }

  .app.sidebar-open .app-sidebar {
    transform: translateX(0);
  }

  .app-main {
    padding: 0.5rem 0.75rem;
    padding-top: calc(44px + 0.35rem);
  }

  .app-notification-bell {
    top: 0.5rem;
    right: 1rem;
    left: auto;
  }
}

@media (max-width: 640px) {
  .daily-reward-grid {
    grid-template-columns: 1fr;
  }
}
</style>

