<template>
  <section class="guild-view">
    <p v-if="loading && !guildState" class="guild-loading">Chargement de la guilde...</p>

    <template v-else-if="guildState && !guildState.in_guild">
      <div v-if="feedback.message" class="guild-feedback" :class="feedback.success ? 'success' : 'error'">
        {{ feedback.message }}
      </div>
      <section class="guild-empty-hero nx-panel">
        <div>
          <span class="guild-hero-kicker">Sans guilde</span>
          <h3>Entre dans une alliance</h3>
          <p>Fonde ta propre guilde ou rejoins une communauté existante pour accéder au portail hebdomadaire et au chat social.</p>
        </div>
      </section>

      <div class="guild-empty-layout">
        <GuildCreatePanel :name="guildName" :loading="createLoading" @update:name="guildName = $event" @create="handleCreateGuild" />
        <GuildListPanel
          :guilds="guilds"
          :active-request="guildState.active_join_request"
          :loading="guildListLoading"
          :cancel-loading="cancelRequestLoading"
          :request-loading-guild-id="requestJoinLoadingGuildId"
          @request-join="handleRequestJoin"
          @cancel-request="handleCancelJoinRequest"
        />
      </div>
    </template>

    <template v-else-if="guildState?.guild">
      <GuildDashboardHeader
        :guild="guildState.guild"
        :role="guildState.role"
        :guild-coins="guildState.guild_coins"
        :member-count="guildState.members.length"
        :max-members="guildMaxMembers"
        :current-tab="activeTab"
        :tabs="availableTabs"
        :tab-notifications="tabNotifications"
        :feedback="feedback"
        @switch-tab="activeTab = $event"
      />

      <Transition name="guild-tab-fade" mode="out-in">
        <section :key="activeTab" class="guild-tab-panel">
          <GuildMembersPanel
            v-if="activeTab === 'members'"
            :guild="guildState.guild"
            :members="guildState.members"
            :current-role="guildState.role"
            :guild-coins="guildState.guild_coins"
            :loading-role-user-id="roleUpdateLoadingUserId"
            :kick-loading-user-id="kickLoadingUserId"
            :leave-loading="leaveLoading"
            @change-role="handleRoleChange"
            @kick="handleKickMember"
            @leave="handleLeaveGuild"
          />

          <GuildRequestsPanel
            v-else-if="activeTab === 'requests'"
            :requests="guildRequests"
            :loading-request-id="requestActionLoadingId"
            @accept="handleAcceptRequest"
            @refuse="handleRefuseRequest"
          />

          <GuildPortalPanel
            v-else-if="activeTab === 'portal'"
            :rotation="portalState?.rotation ?? null"
            :owned-unit-ids="portalState?.ownedUnitIds ?? []"
            :guild-coins="portalState?.guild_coins ?? guildState.guild_coins"
            :summon-cost="portalState?.summon_cost ?? 100"
            :loading="portalLoading"
            :summon-loading="summonLoading"
            :result="summonResult"
            @summon="handleGuildPortalSummon"
            @close-result="summonResult = null"
          />

          <GuildActivityPanel
            v-else-if="activeTab === 'activity'"
            :notifications="guildNotifications"
            :loading="activityLoading"
            @refresh="fetchGuildNotifications()"
          />

          <GuildWarView
            v-else-if="activeTab === 'war'"
          />

          <GuildFAQPanel v-else-if="activeTab === 'faq'" />

          <GuildChatPanel
            v-else
            :messages="guildMessages"
            :draft="chatDraft"
            :current-user-id="currentUserId"
            :loading="chatLoading"
            :sending="chatSending"
            @update:draft="chatDraft = $event"
            @send="handleSendGuildMessage"
          />
        </section>
      </Transition>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import api from '../api';

const route = useRoute();
import GuildActivityPanel from '../components/guild/GuildActivityPanel.vue';
import GuildWarView from './GuildWarView.vue';
import GuildChatPanel from '../components/guild/GuildChatPanel.vue';
import GuildCreatePanel from '../components/guild/GuildCreatePanel.vue';
import GuildDashboardHeader from '../components/guild/GuildDashboardHeader.vue';
import GuildListPanel from '../components/guild/GuildListPanel.vue';
import GuildMembersPanel from '../components/guild/GuildMembersPanel.vue';
import GuildPortalPanel from '../components/guild/GuildPortalPanel.vue';
import GuildRequestsPanel from '../components/guild/GuildRequestsPanel.vue';
import GuildFAQPanel from '../components/guild/GuildFAQPanel.vue';

type GuildSummary = { id: number; name: string; member_count: number; created_at: string | null };
type GuildMember = { user_id: number; display_name: string; avatar_url?: string | null; role: string; joined_at: string | null };
type ActiveJoinRequest = { id: number; guild_id: number; guild_name: string; created_at: string | null } | null;
type GuildRequest = { id: number; display_name: string; avatar_url?: string | null; created_at: string | null };
type GuildChatMessage = {
  message_id: number;
  user_id: number;
  username: string;
  avatar_url?: string | null;
  message: string;
  created_at: string | null;
};
type GuildNotification = {
  id: number;
  type: string;
  username: string;
  data: Record<string, unknown>;
  created_at: string;
};
type GuildState = {
  in_guild: boolean;
  guild: { id: number; name: string; owner_user_id: number; created_at: string | null } | null;
  role: string | null;
  permissions: { canManageRequests: boolean; canManageMembers: boolean; canUsePortal: boolean };
  members: GuildMember[];
  guild_coins: number;
  active_join_request: ActiveJoinRequest;
};
type PortalState = {
  guild_coins: number;
  summon_cost: number;
  rotation: {
    week_year: number;
    week_number: number;
    ends_at: string | null;
    units: Array<{
      slot_index: number;
      unit_id?: number;
      rarity: string;
      name: string;
      role: string;
      element: string;
      image_url?: string | null;
    }>;
  } | null;
  ownedUnitIds?: number[];
};

const guildMaxMembers = 30;
const chatPollDelayMs = 3000;
const chatBackgroundPollDelayMs = 15000;
const requestsBackgroundPollDelayMs = 15000;
const activityPollDelayMs = 10000;
const chatSendCooldownMs = 1000;

const loading = ref(false);
const guildListLoading = ref(false);
const createLoading = ref(false);
const cancelRequestLoading = ref(false);
const requestJoinLoadingGuildId = ref<number | null>(null);
const roleUpdateLoadingUserId = ref<number | null>(null);
const leaveLoading = ref(false);
const requestActionLoadingId = ref<number | null>(null);
const portalLoading = ref(false);
const summonLoading = ref(false);
const chatLoading = ref(false);
const chatSending = ref(false);
const activityLoading = ref(false);

const currentUserId = ref<number | null>(null);
const guildName = ref('');
const guilds = ref<GuildSummary[]>([]);
const guildState = ref<GuildState | null>(null);
const guildRequests = ref<GuildRequest[]>([]);
const guildMessages = ref<GuildChatMessage[]>([]);
const guildNotifications = ref<GuildNotification[]>([]);
const portalState = ref<PortalState | null>(null);
const summonResult = ref<{ rarity: string; guild_coins: number; unit: { name?: string | null; image_url?: string | null; element?: string | null; role?: string | null } | null } | null>(null);
const chatDraft = ref('');
const feedback = ref({ success: true, message: '' });
const activeTab = ref<'members' | 'requests' | 'portal' | 'chat' | 'activity' | 'war' | 'faq'>('members');
const kickLoadingUserId = ref<number | null>(null);

// Notifications d'onglet
const lastSeenChatMessageId = ref<number>(-1);
let chatPollTimer: ReturnType<typeof setInterval> | null = null;
let chatBackgroundPollTimer: ReturnType<typeof setInterval> | null = null;
let requestsBackgroundPollTimer: ReturnType<typeof setInterval> | null = null;
let activityPollTimer: ReturnType<typeof setInterval> | null = null;
let lastChatSendAt = 0;

const hasChatNotif = computed(
  () => activeTab.value !== 'chat' && guildMessages.value.some((m) => m.message_id > lastSeenChatMessageId.value)
);
const hasRequestsNotif = computed(
  () => activeTab.value !== 'requests' && guildRequests.value.length > 0
);
const tabNotifications = computed<Record<string, boolean>>(() => ({
  requests: hasRequestsNotif.value,
  chat: hasChatNotif.value
}));

function markChatSeen() {
  const maxId = guildMessages.value.reduce((acc, m) => Math.max(acc, m.message_id), -1);
  if (maxId > lastSeenChatMessageId.value) {
    lastSeenChatMessageId.value = maxId;
  }
}

const availableTabs = computed(() => {
  const tabs: Array<{ id: 'members' | 'requests' | 'portal' | 'chat' | 'activity' | 'war' | 'faq'; label: string }> = [
    { id: 'members', label: 'Membres' },
    { id: 'portal', label: 'Portail de Guilde' },
    { id: 'activity', label: 'Activité' },
    { id: 'war', label: 'Guerre de Guilde' },
    { id: 'chat', label: 'Chat de Guilde' },
    { id: 'faq', label: 'Guide & FAQ' },
  ];
  if (guildState.value?.permissions?.canManageRequests) {
    tabs.splice(1, 0, { id: 'requests', label: 'Demandes' });
  }
  return tabs;
});

watch(availableTabs, (tabs) => {
  if (!tabs.some((tab) => tab.id === activeTab.value)) {
    activeTab.value = tabs[0]?.id ?? 'members';
  }
});

watch(activeTab, async (tab) => {
  if (tab === 'requests' && guildState.value?.permissions?.canManageRequests) {
    stopRequestsBackgroundPolling();
    await loadGuildRequests();
  } else if (tab !== 'requests') {
    startRequestsBackgroundPolling();
  }
  if (tab === 'portal' && guildState.value?.in_guild) {
    await loadPortalState();
  }
  if (tab === 'activity' && guildState.value?.in_guild) {
    stopActivityPolling();
    await fetchGuildNotifications();
    startActivityPolling();
  } else {
    stopActivityPolling();
  }
  if (tab === 'chat' && guildState.value?.in_guild) {
    stopChatBackgroundPolling();
    startChatPolling();
    await fetchGuildMessages();
    markChatSeen();
  } else if (tab !== 'chat') {
    stopChatPolling();
    if (guildState.value?.in_guild) {
      startChatBackgroundPolling();
    }
  }
});

watch(
  () => guildState.value?.in_guild,
  (inGuild) => {
    if (!inGuild) {
      stopChatPolling();
      stopChatBackgroundPolling();
      stopRequestsBackgroundPolling();
      stopActivityPolling();
      guildMessages.value = [];
      guildRequests.value = [];
      guildNotifications.value = [];
      chatDraft.value = '';
      lastSeenChatMessageId.value = -1;
    }
  }
);

let feedbackClearTimer: ReturnType<typeof setTimeout> | null = null;

function setFeedback(message: string, success = true) {
  feedback.value = { message, success };
  if (feedbackClearTimer) clearTimeout(feedbackClearTimer);
  feedbackClearTimer = setTimeout(() => {
    feedback.value = { message: '', success: true };
    feedbackClearTimer = null;
  }, 4000);
}

function clearFeedback() {
  if (feedbackClearTimer) {
    clearTimeout(feedbackClearTimer);
    feedbackClearTimer = null;
  }
  feedback.value = { message: '', success: true };
}

async function loadCurrentUser() {
  try {
    const { data } = await api.get('/auth/me');
    currentUserId.value = Number(data?.user?.id ?? 0) || null;
  } catch {
    currentUserId.value = null;
  }
}

async function loadGuildState() {
  loading.value = true;
  try {
    const { data } = await api.get('/guild/me');
    guildState.value = {
      in_guild: !!data.in_guild,
      guild: data.guild ?? null,
      role: data.role ?? null,
      permissions: data.permissions ?? { canManageRequests: false, canManageMembers: false, canUsePortal: false },
      members: Array.isArray(data.members) ? data.members : [],
      guild_coins: Number(data.guild_coins ?? 0),
      active_join_request: data.active_join_request ?? null
    };
  } catch (error: any) {
    setFeedback(error.response?.data?.message || 'Impossible de charger la guilde.', false);
  } finally {
    loading.value = false;
  }
}

async function loadGuildList() {
  guildListLoading.value = true;
  try {
    const { data } = await api.get('/guild/list');
    guilds.value = Array.isArray(data.guilds) ? data.guilds : [];
  } catch (error: any) {
    setFeedback(error.response?.data?.message || 'Impossible de charger la liste des guildes.', false);
  } finally {
    guildListLoading.value = false;
  }
}

async function loadGuildRequests() {
  if (!guildState.value?.permissions?.canManageRequests) return;
  try {
    const { data } = await api.get('/guild/requests');
    guildRequests.value = Array.isArray(data.requests) ? data.requests : [];
  } catch (error: any) {
    setFeedback(error.response?.data?.message || 'Impossible de charger les demandes.', false);
  }
}

async function loadPortalState() {
  if (!guildState.value?.in_guild) return;
  portalLoading.value = true;
  try {
    const { data } = await api.get('/guild/portal/rotation');
    portalState.value = {
      guild_coins: Number(data.guild_coins ?? 0),
      summon_cost: Number(data.summon_cost ?? 100),
      rotation: data.rotation ?? null,
      ownedUnitIds: Array.isArray(data.ownedUnitIds) ? data.ownedUnitIds.map(Number) : []
    };
    if (guildState.value) {
      guildState.value.guild_coins = Number(data.guild_coins ?? guildState.value.guild_coins ?? 0);
    }
  } catch (error: any) {
    setFeedback(error.response?.data?.message || 'Impossible de charger le portail de guilde.', false);
  } finally {
    portalLoading.value = false;
  }
}

async function fetchGuildMessages(silent = false) {
  if (!guildState.value?.in_guild) return;
  if (!silent) {
    if (chatLoading.value && guildMessages.value.length > 0) return;
    chatLoading.value = true;
  }
  try {
    const { data } = await api.get('/guild/chat/messages');
    guildMessages.value = Array.isArray(data.messages) ? data.messages : [];
    if (activeTab.value === 'chat') {
      markChatSeen();
    }
  } catch (error: any) {
    if (!silent) {
      setFeedback(error.response?.data?.message || 'Impossible de charger le chat de guilde.', false);
    }
  } finally {
    if (!silent) chatLoading.value = false;
  }
}

function stopChatPolling() {
  if (!chatPollTimer) return;
  clearInterval(chatPollTimer);
  chatPollTimer = null;
}

function startChatPolling() {
  stopChatPolling();
  chatPollTimer = setInterval(() => {
    if (activeTab.value === 'chat' && guildState.value?.in_guild) {
      void fetchGuildMessages();
    }
  }, chatPollDelayMs);
}

function stopChatBackgroundPolling() {
  if (!chatBackgroundPollTimer) return;
  clearInterval(chatBackgroundPollTimer);
  chatBackgroundPollTimer = null;
}

function startChatBackgroundPolling() {
  stopChatBackgroundPolling();
  chatBackgroundPollTimer = setInterval(() => {
    if (activeTab.value !== 'chat' && guildState.value?.in_guild) {
      void fetchGuildMessages(true);
    }
  }, chatBackgroundPollDelayMs);
}

function stopRequestsBackgroundPolling() {
  if (!requestsBackgroundPollTimer) return;
  clearInterval(requestsBackgroundPollTimer);
  requestsBackgroundPollTimer = null;
}

function startRequestsBackgroundPolling() {
  if (!guildState.value?.permissions?.canManageRequests) return;
  stopRequestsBackgroundPolling();
  requestsBackgroundPollTimer = setInterval(() => {
    if (activeTab.value !== 'requests' && guildState.value?.permissions?.canManageRequests) {
      void loadGuildRequests();
    }
  }, requestsBackgroundPollDelayMs);
}

function stopActivityPolling() {
  if (!activityPollTimer) return;
  clearInterval(activityPollTimer);
  activityPollTimer = null;
}

function startActivityPolling() {
  stopActivityPolling();
  activityPollTimer = setInterval(() => {
    if (activeTab.value === 'activity' && guildState.value?.in_guild) {
      void fetchGuildNotifications(true);
    }
  }, activityPollDelayMs);
}

async function fetchGuildNotifications(silent = false) {
  if (!guildState.value?.in_guild) return;
  if (!silent) activityLoading.value = true;
  try {
    const { data } = await api.get('/guild/notifications');
    guildNotifications.value = Array.isArray(data.notifications) ? data.notifications : [];
  } catch {
    // Silencieux si le polling échoue
  } finally {
    if (!silent) activityLoading.value = false;
  }
}

async function refreshGuildArea() {
  await loadGuildState();
  if (guildState.value?.in_guild) {
    if (guildState.value.permissions.canManageRequests) {
      await loadGuildRequests();
    }
    if (activeTab.value === 'portal') {
      await loadPortalState();
    }
    if (activeTab.value === 'chat') {
      await fetchGuildMessages();
    }
  } else {
    await loadGuildList();
    portalState.value = null;
    guildRequests.value = [];
    guildMessages.value = [];
  }
}

async function handleCreateGuild() {
  createLoading.value = true;
  clearFeedback();
  try {
    const { data } = await api.post('/guild/create', { name: guildName.value });
    guildName.value = '';
    setFeedback(data.message || 'Guilde créée.');
    await refreshGuildArea();
  } catch (error: any) {
    setFeedback(error.response?.data?.message || 'Création impossible.', false);
  } finally {
    createLoading.value = false;
  }
}

async function handleRequestJoin(guildId: number) {
  requestJoinLoadingGuildId.value = guildId;
  clearFeedback();
  try {
    const { data } = await api.post('/guild/request-join', { guild_id: guildId });
    setFeedback(data.message || 'Demande envoyée.');
    await refreshGuildArea();
  } catch (error: any) {
    setFeedback(error.response?.data?.message || 'Demande impossible.', false);
  } finally {
    requestJoinLoadingGuildId.value = null;
  }
}

async function handleCancelJoinRequest() {
  cancelRequestLoading.value = true;
  clearFeedback();
  try {
    const { data } = await api.post('/guild/request-cancel');
    setFeedback(data.message || 'Demande annulée.');
    await refreshGuildArea();
  } catch (error: any) {
    setFeedback(error.response?.data?.message || 'Annulation impossible.', false);
  } finally {
    cancelRequestLoading.value = false;
  }
}

async function handleAcceptRequest(requestId: number) {
  requestActionLoadingId.value = requestId;
  clearFeedback();
  try {
    const { data } = await api.post(`/guild/requests/${requestId}/accept`);
    guildRequests.value = Array.isArray(data.requests) ? data.requests : guildRequests.value;
    setFeedback(data.message || 'Demande acceptée.');
    await refreshGuildArea();
  } catch (error: any) {
    setFeedback(error.response?.data?.message || 'Action impossible.', false);
  } finally {
    requestActionLoadingId.value = null;
  }
}

async function handleRefuseRequest(requestId: number) {
  requestActionLoadingId.value = requestId;
  clearFeedback();
  try {
    const { data } = await api.post(`/guild/requests/${requestId}/refuse`);
    guildRequests.value = Array.isArray(data.requests) ? data.requests : guildRequests.value;
    setFeedback(data.message || 'Demande refusée.');
  } catch (error: any) {
    setFeedback(error.response?.data?.message || 'Action impossible.', false);
  } finally {
    requestActionLoadingId.value = null;
  }
}

async function handleRoleChange(payload: { userId: number; role: 'officer' | 'member' }) {
  roleUpdateLoadingUserId.value = payload.userId;
  clearFeedback();
  try {
    const { data } = await api.post(`/guild/members/${payload.userId}/role`, { role: payload.role });
    if (guildState.value) {
      guildState.value.members = Array.isArray(data.members) ? data.members : guildState.value.members;
    }
    setFeedback(data.message || 'Rôle mis à jour.');
  } catch (error: any) {
    setFeedback(error.response?.data?.message || 'Changement de rôle impossible.', false);
  } finally {
    roleUpdateLoadingUserId.value = null;
  }
}

async function handleKickMember(payload: { userId: number }) {
  kickLoadingUserId.value = payload.userId;
  clearFeedback();
  try {
    const { data } = await api.post(`/guild/members/${payload.userId}/kick`);
    if (guildState.value) {
      guildState.value.members = Array.isArray(data.members) ? data.members : guildState.value.members;
    }
    setFeedback(data.message || 'Membre expulsé.');
  } catch (error: any) {
    setFeedback(error.response?.data?.message || 'Expulsion impossible.', false);
  } finally {
    kickLoadingUserId.value = null;
  }
}

async function handleLeaveGuild() {
  leaveLoading.value = true;
  clearFeedback();
  try {
    const { data } = await api.post('/guild/leave');
    if (data.overview) {
      guildState.value = data.overview;
    }
    setFeedback(data.message || 'Vous avez quitté la guilde.');
  } catch (error: any) {
    setFeedback(error.response?.data?.message || 'Impossible de quitter la guilde.', false);
  } finally {
    leaveLoading.value = false;
  }
}

async function handleGuildPortalSummon() {
  summonLoading.value = true;
  clearFeedback();
  try {
    const { data } = await api.post('/guild/portal/summon');
    summonResult.value = {
      rarity: data.rarity,
      guild_coins: Number(data.guild_coins ?? 0),
      unit: data.unit ? {
        name: data.unit.name ?? null,
        image_url: data.unit.image_url ?? null,
        element: data.unit.element ?? null,
        role: data.unit.role ?? null
      } : null
    };
    if (portalState.value) {
      portalState.value.guild_coins = Number(data.guild_coins ?? portalState.value.guild_coins ?? 0);
    }
    if (guildState.value) {
      guildState.value.guild_coins = Number(data.guild_coins ?? guildState.value.guild_coins ?? 0);
    }
    setFeedback(data.message || 'Invocation réussie.');
  } catch (error: any) {
    setFeedback(error.response?.data?.message || "Invocation de guilde impossible.", false);
  } finally {
    summonLoading.value = false;
  }
}

async function handleSendGuildMessage() {
  if (!chatDraft.value.trim()) return;
  const now = Date.now();
  if (now - lastChatSendAt < chatSendCooldownMs) {
    setFeedback('Patiente une seconde avant de renvoyer un message.', false);
    return;
  }

  chatSending.value = true;
  clearFeedback();
  try {
    await api.post('/guild/chat/send', { message: chatDraft.value });
    chatDraft.value = '';
    lastChatSendAt = now;
    await fetchGuildMessages();
  } catch (error: any) {
    setFeedback(error.response?.data?.message || 'Envoi du message impossible.', false);
  } finally {
    chatSending.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadCurrentUser(), loadGuildState()]);
  if (route.query.tab === 'war' && guildState.value?.in_guild) {
    activeTab.value = 'war';
  }
  if (guildState.value?.in_guild) {
    await loadPortalState();
    // Chargement initial : on marque tout comme "déjà vu" pour ne notifier
    // que les messages qui arrivent APRÈS le chargement de la page.
    await fetchGuildMessages(true);
    markChatSeen();
    if (guildState.value.permissions.canManageRequests) {
      await loadGuildRequests();
    }
    // Polling de fond pour les notifications quand on n'est pas sur ces onglets
    if (activeTab.value !== 'chat') startChatBackgroundPolling();
    if (activeTab.value !== 'requests') startRequestsBackgroundPolling();
  } else {
    await loadGuildList();
  }
});

onUnmounted(() => {
  stopChatPolling();
  stopChatBackgroundPolling();
  stopRequestsBackgroundPolling();
  stopActivityPolling();
  if (feedbackClearTimer) clearTimeout(feedbackClearTimer);
});
</script>

<style scoped>
.guild-view {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 1400px;
  margin: 0 auto;
}

.guild-empty-hero {
  padding: 24px;
  border-radius: 24px;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.16), transparent 26%),
    radial-gradient(circle at right, rgba(139, 92, 246, 0.16), transparent 24%),
    linear-gradient(145deg, rgba(9, 16, 30, 0.96), rgba(13, 27, 45, 0.92));
  border: 1px solid rgba(125, 211, 252, 0.14);
  box-shadow: 0 24px 54px rgba(2, 6, 23, 0.28);
}

.guild-hero-kicker {
  display: inline-block;
  margin-bottom: 10px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(125, 211, 252, 0.12);
  border: 1px solid rgba(125, 211, 252, 0.18);
  color: #bae6fd;
  font-size: 0.76rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.guild-hero-text,
.guild-empty-hero p {
  margin: 10px 0 0;
  color: #cbd5e1;
  max-width: 760px;
  line-height: 1.6;
}

.guild-empty-hero h3 {
  margin: 0;
  font-size: 1.55rem;
}

.guild-feedback {
  padding: 14px 16px;
  border-radius: 16px;
  font-weight: 600;
}

.guild-feedback.success {
  background: rgba(34, 197, 94, 0.16);
  border: 1px solid rgba(74, 222, 128, 0.28);
  color: #bbf7d0;
}

.guild-feedback.error {
  background: rgba(239, 68, 68, 0.16);
  border: 1px solid rgba(248, 113, 113, 0.28);
  color: #fecaca;
}

.guild-loading {
  margin: 0;
  color: #cbd5e1;
}

.guild-empty-layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 18px;
}

.guild-tab-panel {
  min-height: 260px;
}

.guild-tab-fade-enter-active,
.guild-tab-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.guild-tab-fade-enter-from,
.guild-tab-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 768px) {
  .guild-view {
    gap: 12px;
    padding: 0 1rem;
  }
  .guild-empty-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .guild-view {
    gap: 16px;
  }
}
</style>
