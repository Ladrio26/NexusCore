<template>
  <section class="guild-dashboard-header nx-panel">
    <div class="guild-header-glow" aria-hidden="true" />
    <div class="guild-header-icon" aria-hidden="true">✦</div>
    <div class="guild-header-topline">
      <div class="guild-header-name-row">
        <h1 class="guild-header-title">{{ guild.name }}</h1>
        <Transition name="guild-feedback-fade">
          <span
            v-if="feedback?.message"
            class="guild-header-feedback"
            :class="feedback.success ? 'success' : 'error'"
          >{{ feedback.message }}</span>
        </Transition>
      </div>
      <div class="guild-inline-stats">
        <div class="guild-inline-stat">
          <span class="guild-stat-label">Membres</span>
          <strong>{{ memberCount }} / {{ maxMembers }}</strong>
        </div>
        <div class="guild-inline-stat">
          <span class="guild-stat-label">Ton rôle</span>
          <strong>{{ roleLabel(role) }}</strong>
        </div>
        <div class="guild-inline-stat guild-stat-gold">
          <span class="guild-stat-label">Monnaie de guilde</span>
          <strong>🪙 {{ guildCoins }}</strong>
        </div>
        <div class="guild-inline-stat">
          <span class="guild-stat-label">Créée le</span>
          <strong>{{ formatDate(guild.created_at) }}</strong>
        </div>
      </div>
    </div>
    <nav class="guild-header-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="guild-header-tab"
        :class="{ active: currentTab === tab.id }"
        @click="$emit('switch-tab', tab.id)"
      >
        <span class="guild-tab-label-wrap">
          {{ tab.label }}
          <span v-if="tabNotifications[tab.id]" class="guild-tab-notif-dot" :aria-label="`Nouveaux éléments dans ${tab.label}`" />
        </span>
      </button>
    </nav>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    guild: { id: number; name: string; created_at: string | null };
    role: string | null;
    guildCoins: number;
    memberCount: number;
    maxMembers: number;
    currentTab: 'members' | 'requests' | 'portal' | 'chat';
    tabs: Array<{ id: 'members' | 'requests' | 'portal' | 'chat'; label: string }>;
    tabNotifications?: Record<string, boolean>;
    feedback?: { message: string; success: boolean } | null;
  }>(),
  { tabNotifications: () => ({}), feedback: null }
);

defineEmits<{
  (event: 'switch-tab', tabId: 'members' | 'requests' | 'portal' | 'chat'): void;
}>();

function roleLabel(role: string | null) {
  if (role === 'leader') return 'Leader';
  if (role === 'officer') return 'Officier';
  return 'Membre';
}

function formatDate(value: string | null) {
  if (!value) return 'Inconnue';
  return new Date(value).toLocaleDateString('fr-FR');
}
</script>

<style scoped>
.guild-dashboard-header {
  position: relative;
  overflow: hidden;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 32%),
    radial-gradient(circle at bottom right, rgba(168, 85, 247, 0.2), transparent 28%),
    linear-gradient(145deg, rgba(9, 16, 30, 0.96), rgba(13, 27, 45, 0.92));
  border: 1px solid rgba(125, 211, 252, 0.16);
  box-shadow: 0 30px 70px rgba(2, 6, 23, 0.42);
}

.guild-header-glow {
  position: absolute;
  inset: -40% auto auto -10%;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.16), transparent 70%);
  pointer-events: none;
}

.guild-header-icon {
  position: absolute;
  top: 14px;
  right: 16px;
  font-size: 1.35rem;
  color: rgba(196, 181, 253, 0.45);
  text-shadow: 0 0 18px rgba(168, 85, 247, 0.45);
}

.guild-header-topline,
.guild-header-tabs {
  position: relative;
  z-index: 1;
}

.guild-header-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-right: 28px;
}

.guild-header-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 1 auto;
  min-width: 0;
}

.guild-header-title {
  margin: 0;
  flex: 0 0 auto;
  font-size: clamp(1.1rem, 2vw, 1.5rem);
  line-height: 1.1;
  color: #f8fafc;
}

.guild-header-feedback {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1.4;
}

.guild-header-feedback.success {
  background: rgba(34, 197, 94, 0.18);
  border: 1px solid rgba(74, 222, 128, 0.32);
  color: #bbf7d0;
}

.guild-header-feedback.error {
  background: rgba(239, 68, 68, 0.18);
  border: 1px solid rgba(248, 113, 113, 0.32);
  color: #fecaca;
}

.guild-feedback-fade-enter-active,
.guild-feedback-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.guild-feedback-fade-enter-from,
.guild-feedback-fade-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

.guild-inline-stats {
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
  gap: 8px;
  flex: 1 1 auto;
  flex-wrap: wrap;
}

.guild-inline-stat {
  min-width: 112px;
  padding: 8px 10px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.62);
  border: 1px solid rgba(148, 163, 184, 0.14);
  backdrop-filter: blur(6px);
}

.guild-inline-stat strong {
  display: block;
  margin-top: 4px;
  font-size: 0.9rem;
  line-height: 1.15;
  color: #f8fafc;
}

.guild-stat-gold strong {
  color: #fde68a;
}

.guild-stat-label {
  color: rgba(191, 219, 254, 0.8);
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.guild-header-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px;
  border-radius: 16px;
  background: rgba(8, 13, 24, 0.68);
  border: 1px solid rgba(125, 211, 252, 0.1);
}

.guild-header-tab {
  padding: 9px 13px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: #cbd5e1;
  font-size: 0.88rem;
  font-weight: 700;
  transition: background 180ms ease, color 180ms ease, border-color 180ms ease;
}

.guild-header-tab.active {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.22), rgba(139, 92, 246, 0.22));
  border-color: rgba(125, 211, 252, 0.22);
  color: #f8fafc;
}

.guild-tab-label-wrap {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.guild-tab-notif-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, #fef08a, #f59e0b 60%, #dc2626 100%);
  box-shadow:
    0 0 0 2px rgba(9, 16, 30, 0.9),
    0 0 8px rgba(245, 158, 11, 0.8);
}

@media (max-width: 900px) {
  .guild-header-topline {
    flex-direction: column;
    align-items: flex-start;
    padding-right: 20px;
  }

  .guild-inline-stats {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .guild-header-tabs {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
  }
  .guild-header-tab {
    flex-shrink: 0;
  }
}

@media (max-width: 640px) {
  .guild-inline-stat {
    min-width: calc(50% - 4px);
  }
}
</style>
