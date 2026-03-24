<template>
  <div ref="wrapRef" class="notification-bell-wrap" v-click-outside="closePanel">
    <button
      type="button"
      class="notification-bell-btn"
      :aria-label="`${unreadCount} notification${unreadCount !== 1 ? 's' : ''} non lue${unreadCount !== 1 ? 's' : ''}`"
      @click="togglePanel"
    >
      <span class="notification-bell-icon">🔔</span>
      <span v-if="unreadCount > 0" class="notification-bell-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>
    <Transition name="notification-panel">
      <div
        v-show="panelOpen"
        class="notification-panel nx-panel"
      >
        <div class="notification-panel-header">
          <span class="notification-panel-title">Notifications</span>
        </div>
        <div v-if="loading" class="notification-panel-loading">Chargement…</div>
        <div v-else-if="!notifications.length" class="notification-panel-empty">Aucune notification.</div>
        <ul v-else class="notification-list">
          <li
            v-for="n in notifications"
            :key="n.id"
            class="notification-item"
            :class="{
              'notification-item--win': n.data?.result === 'win',
              'notification-item--loss': n.data?.result === 'loss',
              'notification-item--unread': !n.is_read
            }"
          >
            <span class="notification-item-text">{{ formatPvpMessage(n) }}</span>
            <span class="notification-item-date" :title="formatDateFull(n.created_at)">{{ formatDate(n.created_at) }}</span>
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import api, { authToken } from '@/api';

type Notification = {
  id: number;
  type: string;
  message: string;
  data?: { result?: 'win' | 'loss' | 'draw'; elo_delta?: number } | null;
  created_at: string;
  is_read: boolean;
};

const panelOpen = ref(false);
const loading = ref(false);
const notifications = ref<Notification[]>([]);
const unreadCount = ref(0);

function formatPvpMessage(n: Notification): string {
  const msg = n.message ?? '';
  if (n.type !== 'pvp_attack' || !n.data?.result) return msg;
  if (msg.includes('Victoire') || msg.includes('Défaite') || msg.includes('Match nul')) return msg;
  const base = msg.replace(/\.\s*$/, '').trim();
  if (n.data.result === 'draw') return `${base} — Match nul.`;
  const sign = (n.data.elo_delta ?? 0) >= 0 ? '+' : '';
  const resultText = n.data.result === 'win' ? 'Victoire' : 'Défaite';
  const eloPart = n.data.elo_delta != null ? ` ${sign}${n.data.elo_delta} Elo` : '';
  return `${base} — ${resultText}${eloPart}.`;
}

function formatDate(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
}

function formatDateFull(raw: string): string {
  if (!raw) return '';
  return new Date(raw).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' });
}

async function fetchNotifications() {
  if (!authToken.value) return;
  loading.value = true;
  try {
    const { data } = await api.get('/notifications');
    notifications.value = (data.notifications ?? []).slice(0, 20);
    unreadCount.value = Number(data.unreadCount ?? 0);
  } catch {
    notifications.value = [];
    unreadCount.value = 0;
  } finally {
    loading.value = false;
  }
}

async function markAsRead() {
  const unreadIds = notifications.value.filter((n) => !n.is_read).map((n) => n.id);
  if (unreadIds.length === 0) return;
  try {
    await api.post('/notifications/mark-read', { ids: unreadIds });
    notifications.value = notifications.value.map((n) => ({ ...n, is_read: true }));
    unreadCount.value = 0;
  } catch {
    // ignore
  }
}

async function togglePanel() {
  panelOpen.value = !panelOpen.value;
  if (panelOpen.value) {
    await fetchNotifications();
    await markAsRead();
  }
}

function closePanel() {
  panelOpen.value = false;
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target as Node;
  if (panelOpen.value && !(e.currentTarget as Element)?.contains(target)) {
    closePanel();
  }
}

const clickOutsideByEl = new WeakMap<HTMLElement, (event: MouseEvent) => void>();

const vClickOutside = {
  mounted(el: HTMLElement, binding: { value?: () => void }) {
    const handler = (event: MouseEvent) => {
      if (!el.contains(event.target as Node)) {
        binding.value?.();
      }
    };
    clickOutsideByEl.set(el, handler);
    document.addEventListener('click', handler);
  },
  unmounted(el: HTMLElement) {
    const handler = clickOutsideByEl.get(el);
    if (handler) {
      document.removeEventListener('click', handler);
      clickOutsideByEl.delete(el);
    }
  }
};

watch(authToken, (t) => {
  if (!t) {
    notifications.value = [];
    unreadCount.value = 0;
    panelOpen.value = false;
    return;
  }
  fetchNotifications();
}, { immediate: true });

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && authToken.value) {
    void fetchNotifications();
  }
}

onMounted(() => {
  window.addEventListener('notifications-refresh', fetchNotifications);
  document.addEventListener('visibilitychange', onVisibilityChange);
});

onUnmounted(() => {
  window.removeEventListener('notifications-refresh', fetchNotifications);
  document.removeEventListener('visibilitychange', onVisibilityChange);
});
</script>

<style scoped>
.notification-bell-wrap {
  position: relative;
  display: inline-block;
}

.notification-bell-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #e5e7eb;
  cursor: pointer;
  position: relative;
  transition: background 0.2s, border-color 0.2s;
}

.notification-bell-btn:hover {
  background: rgba(0, 255, 200, 0.12);
  border-color: rgba(0, 255, 200, 0.4);
}

.notification-bell-icon {
  font-size: 1.25rem;
}

.notification-bell-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 340px;
  max-width: calc(100vw - 2rem);
  max-height: 420px;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.99));
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.notification-panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
}

.notification-panel-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: #e5e7eb;
}

.notification-panel-loading,
.notification-panel-empty {
  padding: 24px 16px;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
}

.notification-list {
  list-style: none;
  margin: 0;
  padding: 8px 0;
  max-height: 360px;
  overflow-y: auto;
}

.notification-item {
  padding: 10px 16px;
  margin: 0 8px 6px;
  border-radius: 8px;
  border-left: 3px solid transparent;
  font-size: 0.85rem;
  line-height: 1.4;
  transition: background 0.2s;
}

.notification-item--win {
  background: rgba(74, 222, 128, 0.15);
  border-left-color: rgba(74, 222, 128, 0.6);
}

.notification-item--loss {
  background: rgba(248, 113, 113, 0.15);
  border-left-color: rgba(248, 113, 113, 0.6);
}

.notification-item:not(.notification-item--win):not(.notification-item--loss) {
  background: rgba(148, 163, 184, 0.08);
}

.notification-item-text {
  display: block;
  color: #e2e8f0;
}

.notification-item-date {
  display: block;
  margin-top: 4px;
  font-size: 0.75rem;
  color: #94a3b8;
}

.notification-panel-enter-active,
.notification-panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.notification-panel-enter-from,
.notification-panel-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 768px) {
  .notification-bell-wrap {
    max-width: 100%;
  }

  .notification-panel {
    width: min(340px, calc(100vw - 2rem));
  }
}
</style>
