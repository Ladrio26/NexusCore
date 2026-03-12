<template>
  <section class="guild-panel guild-activity nx-panel">
    <div class="activity-header">
      <div>
        <span class="activity-kicker">Guilde</span>
        <h3 class="activity-title">Activité récente</h3>
      </div>
      <button type="button" class="nx-btn nx-btn-ghost activity-refresh" :disabled="loading" @click="$emit('refresh')">
        Actualiser
      </button>
    </div>

    <p v-if="loading && !notifications.length" class="activity-empty">Chargement...</p>
    <p v-else-if="!notifications.length" class="activity-empty">Aucune activité pour le moment.</p>

    <ul v-else class="activity-list">
      <li
        v-for="notif in displayedNotifications"
        :key="notif.id"
        class="activity-item"
        :class="`type-${notif.type}`"
      >
        <span class="activity-icon" aria-hidden="true">{{ iconFor(notif.type) }}</span>
        <div class="activity-body">
          <p class="activity-text">{{ formatNotification(notif) }}</p>
          <time class="activity-time" :title="formatDateFull(notif.created_at)">
            {{ timeAgo(notif.created_at) }}
          </time>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type GuildNotification = {
  id: number;
  type: string;
  username: string;
  data: Record<string, unknown>;
  created_at: string;
};

const props = defineProps<{
  notifications: GuildNotification[];
  loading: boolean;
}>();

const displayedNotifications = computed(() => props.notifications.slice(0, 50));

defineEmits<{
  (event: 'refresh'): void;
}>();

function iconFor(type: string): string {
  if (type === 'member_join') return '🟢';
  if (type === 'summon_mythic') return '🔮';
  if (type === 'summon_legendary') return '⭐';
  if (type === 'campaign_boss_kill') return '⚔️';
  return '📌';
}

function formatNotification(notif: GuildNotification): string {
  const { type, username, data } = notif;

  if (type === 'member_join') {
    return `${username} a rejoint la guilde.`;
  }

  if (type === 'summon_mythic') {
    const unit = String(data.unit_name ?? 'une unité inconnue');
    return `${username} a invoqué ${unit} (Mythique) !`;
  }

  if (type === 'summon_legendary') {
    const unit = String(data.unit_name ?? 'une unité inconnue');
    return `${username} a invoqué ${unit} (Légendaire).`;
  }

  if (type === 'campaign_boss_kill') {
    const chapter = data.chapter ?? '?';
    const diff = data.difficulty === 'hard' ? 'Difficile' : 'Normal';
    return `${username} a vaincu le Boss du Chapitre ${chapter} (${diff}).`;
  }

  return `${username} a effectué une action.`;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 5) return 'à l\'instant';
  if (diff < 60) return `il y a ${diff}s`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

function formatDateFull(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('fr-FR');
}
</script>

<style scoped>
.guild-panel {
  padding: 16px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.08), transparent 24%),
    linear-gradient(180deg, rgba(8, 13, 24, 0.96), rgba(11, 20, 35, 0.94));
  border: 1px solid rgba(125, 211, 252, 0.12);
}

.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.activity-kicker {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(192, 132, 252, 0.14);
  border: 1px solid rgba(216, 180, 254, 0.18);
  color: #e9d5ff;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.activity-title {
  margin: 0;
  font-size: 1rem;
}

.activity-refresh {
  padding: 5px 12px;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.activity-empty {
  margin: 0;
  color: rgba(203, 213, 225, 0.7);
  font-size: 0.9rem;
  text-align: center;
  padding: 20px 0;
}

.activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.1);
  background: rgba(15, 23, 42, 0.5);
  transition: background 150ms ease;
}

.activity-item:hover {
  background: rgba(15, 23, 42, 0.72);
}

/* Couleur de bordure gauche selon type */
.activity-item.type-member_join {
  border-left: 3px solid rgba(74, 222, 128, 0.55);
}

.activity-item.type-summon_mythic {
  border-left: 3px solid rgba(192, 132, 252, 0.65);
  background: rgba(88, 28, 135, 0.12);
}

.activity-item.type-summon_legendary {
  border-left: 3px solid rgba(250, 204, 21, 0.55);
  background: rgba(120, 80, 0, 0.1);
}

.activity-item.type-campaign_boss_kill {
  border-left: 3px solid rgba(251, 146, 60, 0.55);
}

.activity-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
  margin-top: 1px;
  line-height: 1;
}

.activity-body {
  flex: 1;
  min-width: 0;
}

.activity-text {
  margin: 0 0 3px;
  font-size: 0.88rem;
  color: #e2e8f0;
  line-height: 1.4;
}

.activity-time {
  font-size: 0.75rem;
  color: rgba(148, 163, 184, 0.7);
}
</style>
