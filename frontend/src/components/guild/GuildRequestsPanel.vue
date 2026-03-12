<template>
  <section class="guild-panel nx-panel">
    <div class="guild-panel-header">
      <div>
        <span class="guild-panel-kicker">Candidatures</span>
        <h3 class="guild-panel-title">Demandes d’adhésion</h3>
      </div>
    </div>
    <p v-if="requests.length === 0" class="guild-empty">Aucune demande en attente.</p>
    <div v-else class="requests-grid">
      <article v-for="request in requests" :key="request.id" class="request-card">
        <div class="request-card-top">
          <img :src="getAvatarUrl(request)" alt="" class="request-avatar" />
          <div class="request-card-main">
            <strong>{{ request.display_name }}</strong>
            <span>Demande du {{ formatDate(request.created_at) }}</span>
          </div>
        </div>
        <div class="request-actions">
          <button
            type="button"
            class="nx-btn"
            :disabled="loadingRequestId === request.id"
            @click="$emit('accept', request.id)"
          >
            {{ loadingRequestId === request.id ? 'Validation...' : 'Accepter' }}
          </button>
          <button
            type="button"
            class="nx-btn nx-btn-danger"
            :disabled="loadingRequestId === request.id"
            @click="$emit('refuse', request.id)"
          >
            {{ loadingRequestId === request.id ? 'Refus...' : 'Refuser' }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { getAvatarUrl } from '../../utils/avatar';

defineProps<{
  requests: Array<{ id: number; display_name: string; avatar_url?: string | null; created_at: string | null }>;
  loadingRequestId: number | null;
}>();

defineEmits<{
  (event: 'accept', requestId: number): void;
  (event: 'refuse', requestId: number): void;
}>();

function formatDate(value: string | null) {
  if (!value) return 'inconnue';
  return new Date(value).toLocaleString('fr-FR');
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
  margin-bottom: 18px;
}

.guild-panel-kicker {
  display: inline-block;
  margin-bottom: 10px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.14);
  border: 1px solid rgba(74, 222, 128, 0.18);
  color: #bbf7d0;
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
}

.guild-empty {
  color: #cbd5e1;
}

.requests-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.request-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.66);
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 18px 34px rgba(2, 6, 23, 0.2);
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.request-card:hover {
  transform: translateY(-3px);
  border-color: rgba(74, 222, 128, 0.24);
  box-shadow: 0 24px 40px rgba(2, 6, 23, 0.28);
}

.request-card-top {
  display: flex;
  align-items: center;
  gap: 14px;
}

.request-avatar {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  object-fit: cover;
  background: rgba(30, 41, 59, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.request-card-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.request-card-main span {
  color: #cbd5e1;
}

.request-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .request-actions :deep(button) {
    width: 100%;
  }
}
</style>
