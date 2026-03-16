<template>
  <section class="guild-panel nx-panel">
    <div class="guild-panel-header">
      <div>
        <span class="guild-panel-kicker">Roster</span>
        <h3 class="guild-panel-title">Membres de {{ guild.name }}</h3>
      </div>
      <div class="guild-coins-pill">🪙 {{ guildCoins }} pièces de guilde</div>
    </div>

    <div class="leave-guild-row">
      <button
        type="button"
        class="nx-btn nx-btn-leave-guild"
        :disabled="leaveLoading"
        @click="$emit('leave')"
      >
        {{ leaveLoading ? '...' : 'Quitter la Guilde' }}
      </button>
    </div>

    <div class="members-grid">
      <article v-for="member in members" :key="member.user_id" class="member-card" :class="`role-${member.role}`">
        <div class="member-card-row">
          <img :src="getAvatarUrl(member)" alt="" class="member-avatar" />
          <div class="member-info">
            <strong>{{ member.display_name }}</strong>
            <span class="member-role">{{ roleLabel(member.role) }}</span>
            <span v-if="member.joined_at" class="member-date">Arrivé le {{ formatDate(member.joined_at) }}</span>
          </div>
          <div v-if="currentRole === 'leader' && member.role !== 'leader'" class="member-actions">
            <button
              v-if="member.role === 'member'"
              type="button"
              class="nx-btn nx-btn-small"
              :disabled="loadingRoleUserId === member.user_id"
              @click="$emit('change-role', { userId: member.user_id, role: 'officer' })"
            >
              {{ loadingRoleUserId === member.user_id ? '...' : 'Promouvoir' }}
            </button>
            <button
              v-else
              type="button"
              class="nx-btn nx-btn-secondary nx-btn-small"
              :disabled="loadingRoleUserId === member.user_id"
              @click="$emit('change-role', { userId: member.user_id, role: 'member' })"
            >
              {{ loadingRoleUserId === member.user_id ? '...' : 'Rétrograder' }}
            </button>
            <button
              type="button"
              class="nx-btn nx-btn-kick nx-btn-small"
              :disabled="kickLoadingUserId === member.user_id"
              @click="confirmKick(member)"
            >
              {{ kickLoadingUserId === member.user_id ? '...' : 'Expulser' }}
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { getAvatarUrl } from '../../utils/avatar';

defineProps<{
  guild: { id: number; name: string };
  members: Array<{ user_id: number; display_name: string; avatar_url?: string | null; role: string; joined_at: string | null }>;
  currentRole: string | null;
  guildCoins: number;
  loadingRoleUserId: number | null;
  kickLoadingUserId: number | null;
  leaveLoading?: boolean;
}>();

const emit = defineEmits<{
  (event: 'change-role', payload: { userId: number; role: 'officer' | 'member' }): void;
  (event: 'kick', payload: { userId: number }): void;
  (event: 'leave'): void;
}>();

function confirmKick(member: { user_id: number; display_name: string }) {
  if (window.confirm(`Expulser ${member.display_name} de la guilde ?`)) {
    emit('kick', { userId: member.user_id });
  }
}

function roleLabel(role: string) {
  if (role === 'leader') return 'Leader';
  if (role === 'officer') return 'Officier';
  return 'Membre';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR');
}
</script>

<style scoped>
.guild-panel {
  padding: 22px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(8, 13, 24, 0.95), rgba(11, 20, 35, 0.92));
  border: 1px solid rgba(125, 211, 252, 0.12);
}

.guild-panel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.guild-panel-kicker {
  display: inline-block;
  margin-bottom: 10px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.14);
  border: 1px solid rgba(96, 165, 250, 0.18);
  color: #bfdbfe;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.guild-panel-title {
  margin: 0 0 8px;
}

.guild-panel-text {
  margin: 0;
  color: #cbd5e1;
  max-width: 720px;
}

.guild-coins-pill {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(250, 204, 21, 0.2);
  color: #fde68a;
  font-weight: 600;
}

.leave-guild-row {
  margin-bottom: 18px;
}

.nx-btn-leave-guild {
  background: rgba(220, 38, 38, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.5);
  color: #fca5a5;
  font-weight: 600;
  padding: 10px 18px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
}

.nx-btn-leave-guild:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.35);
  border-color: rgba(239, 68, 68, 0.7);
  color: #fecaca;
}

.nx-btn-leave-guild:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
}

.member-card {
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.66);
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 8px 20px rgba(2, 6, 23, 0.18);
  transition: transform 180ms ease, border-color 180ms ease;
}

.member-card:hover {
  transform: translateY(-2px);
  border-color: rgba(125, 211, 252, 0.26);
}

.member-card.role-leader {
  background: linear-gradient(180deg, rgba(69, 26, 3, 0.42), rgba(15, 23, 42, 0.78));
}

.member-card.role-officer {
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.14), rgba(15, 23, 42, 0.72));
}

.member-card-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.member-avatar {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  object-fit: cover;
  background: rgba(30, 41, 59, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.member-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
}

.member-info strong {
  color: #f8fafc;
  font-size: 0.95rem;
}

.member-role {
  color: #cbd5e1;
  font-size: 0.85rem;
}

.member-date {
  color: #64748b;
  font-size: 0.78rem;
  width: 100%;
}

.member-actions {
  flex-shrink: 0;
}

.member-actions :deep(.nx-btn-small) {
  padding: 4px 10px;
  font-size: 0.78rem;
}

.nx-btn-kick {
  background: rgba(220, 38, 38, 0.18);
  border: 1px solid rgba(239, 68, 68, 0.45);
  color: #fca5a5;
}

.nx-btn-kick:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.32);
  border-color: rgba(239, 68, 68, 0.7);
  color: #fecaca;
}

@media (max-width: 640px) {
  .member-card-row {
    flex-wrap: wrap;
  }
  .member-actions {
    width: 100%;
    margin-left: 52px;
  }
}
</style>
