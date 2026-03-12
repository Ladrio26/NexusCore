<template>
  <section class="guild-panel nx-panel">
    <div class="guild-panel-header">
      <div>
        <span class="guild-panel-kicker">Recrutement</span>
        <h3 class="guild-panel-title">Rejoindre une guilde</h3>
        <p class="guild-panel-text">Consulte les guildes disponibles et envoie une demande d’adhésion.</p>
      </div>
      <button
        v-if="activeRequest"
        type="button"
        class="nx-btn nx-btn-secondary"
        :disabled="cancelLoading"
        @click="$emit('cancel-request')"
      >
        {{ cancelLoading ? 'Annulation...' : 'Annuler ma demande' }}
      </button>
    </div>

    <div v-if="activeRequest" class="guild-request-banner">
      Demande en attente : <strong>{{ activeRequest.guild_name }}</strong>
    </div>

    <p v-if="loading" class="guild-empty">Chargement des guildes...</p>
    <p v-else-if="guilds.length === 0" class="guild-empty">Aucune guilde disponible pour le moment.</p>
    <div v-else class="guild-list">
      <article v-for="guild in guilds" :key="guild.id" class="guild-card">
        <div class="guild-card-main">
          <strong>{{ guild.name }}</strong>
          <span>{{ guild.member_count }} membre{{ guild.member_count > 1 ? 's' : '' }}</span>
          <small v-if="guild.created_at">Créée le {{ formatDate(guild.created_at) }}</small>
        </div>
        <button
          type="button"
          class="nx-btn"
          :disabled="!!activeRequest || requestLoadingGuildId === guild.id"
          @click="$emit('request-join', guild.id)"
        >
          {{ requestLoadingGuildId === guild.id ? 'Envoi...' : 'Demander à rejoindre' }}
        </button>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  guilds: Array<{ id: number; name: string; member_count: number; created_at?: string | null }>;
  activeRequest: { id: number; guild_id: number; guild_name: string } | null;
  loading: boolean;
  cancelLoading: boolean;
  requestLoadingGuildId: number | null;
}>();

defineEmits<{
  (event: 'request-join', guildId: number): void;
  (event: 'cancel-request'): void;
}>();

function formatDate(value: string | null | undefined) {
  if (!value) return 'Inconnue';
  return new Date(value).toLocaleDateString('fr-FR');
}
</script>

<style scoped>
.guild-panel {
  padding: 22px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(16, 185, 129, 0.12), transparent 28%),
    linear-gradient(180deg, rgba(8, 13, 24, 0.95), rgba(11, 20, 35, 0.92));
  border: 1px solid rgba(125, 211, 252, 0.12);
}

.guild-panel-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-bottom: 14px;
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
  margin: 0 0 6px;
}

.guild-panel-text {
  margin: 0;
  color: #cbd5e1;
}

.guild-request-banner {
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(96, 165, 250, 0.3);
  color: #dbeafe;
}

.guild-list {
  display: grid;
  gap: 14px;
}

.guild-card {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.64);
  border: 1px solid rgba(148, 163, 184, 0.16);
  transition: transform 180ms ease, border-color 180ms ease;
}

.guild-card:hover {
  transform: translateY(-2px);
  border-color: rgba(74, 222, 128, 0.24);
}

.guild-card-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.guild-card-main span,
.guild-card-main small,
.guild-empty {
  color: #cbd5e1;
}
</style>
