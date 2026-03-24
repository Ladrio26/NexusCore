<template>
  <section class="admin-feedback admin-fullwidth">
    <div class="admin-page-header">
      <h1 class="admin-title">Feedback — Gestion des tickets</h1>
      <p class="admin-desc">Classer les tickets (Proposés, Non Prio, Acceptés, En cours, Réalisés, Disponibles) ou Refuser.</p>
    </div>

    <div class="admin-toolbar nx-panel">
      <label>
        Statut :
        <select v-model="statusFilter" class="nx-input">
          <option value="">Tous (hors refusés)</option>
          <option value="proposes">Proposés</option>
          <option value="non_prio">Non Prio</option>
          <option value="acceptes">Acceptés</option>
          <option value="en_cours">En cours</option>
          <option value="realises">Réalisés</option>
          <option value="disponibles">Disponibles</option>
          <option value="refuser">Refusés</option>
        </select>
      </label>
      <label class="admin-toolbar-check">
        <input type="checkbox" v-model="includeRefused" />
        Inclure les refusés
      </label>
      <button type="button" class="nx-btn" :disabled="loading" @click="loadTickets">Actualiser</button>
    </div>

    <p v-if="errorMessage" class="admin-error">{{ errorMessage }}</p>
    <p v-if="loading && tickets.length === 0" class="admin-loading">Chargement…</p>
    <div v-else-if="tickets.length === 0" class="admin-empty">Aucun ticket.</div>

    <div v-else class="admin-feedback-list">
      <div
        v-for="t in tickets"
        :key="t.id"
        class="admin-feedback-ticket nx-panel"
        :class="{ selected: selectedTicket?.id === t.id }"
      >
        <div class="ticket-row">
          <div class="ticket-main" @click="selectTicket(t)">
            <span class="ticket-id">#{{ t.id }}</span>
            <span class="ticket-title">{{ t.title }}</span>
            <span class="ticket-author">{{ t.author_name || '—' }}</span>
            <span class="ticket-date">{{ formatDate(t.created_at) }}</span>
          </div>
          <div class="ticket-status-cell">
            <select
              :value="t.status"
              class="nx-input ticket-status-select"
              @change="(e) => updateStatus(t.id, (e.target as HTMLSelectElement).value)"
              @click.stop
            >
              <option value="proposes">Proposé</option>
              <option value="non_prio">Non Prio</option>
              <option value="acceptes">Accepté</option>
              <option value="en_cours">En cours</option>
              <option value="realises">Réalisé</option>
              <option value="disponibles">Disponible</option>
              <option value="refuser">Refuser</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedTicket" class="admin-feedback-detail nx-panel">
      <h2>Ticket #{{ selectedTicket.id }}</h2>
      <div class="detail-row">
        <span class="detail-label">Titre</span>
        <span class="detail-value">{{ selectedTicket.title }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Auteur</span>
        <span class="detail-value">{{ selectedTicket.author_name || '—' }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Statut</span>
        <span class="detail-value">
          <select
            :value="selectedTicket.status"
            class="nx-input ticket-status-select"
            @change="(e) => { const t = selectedTicket; if (!t) return; updateStatus(t.id, (e.target as HTMLSelectElement).value); }"
          >
            <option value="proposes">Proposé</option>
            <option value="non_prio">Non Prio</option>
            <option value="acceptes">Accepté</option>
            <option value="en_cours">En cours</option>
            <option value="realises">Réalisé</option>
            <option value="disponibles">Disponible</option>
            <option value="refuser">Refuser</option>
          </select>
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Créé le</span>
        <span class="detail-value">{{ formatDate(selectedTicket.created_at) }}</span>
      </div>
      <div class="detail-content">
        <span class="detail-label">Contenu</span>
        <pre class="detail-value content-pre">{{ selectedTicket.content }}</pre>
      </div>
      <button type="button" class="nx-btn" @click="selectedTicket = null">Fermer</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import api from '../api';

type Ticket = {
  id: number;
  user_id: number;
  title: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
};

const tickets = ref<Ticket[]>([]);
const selectedTicket = ref<Ticket | null>(null);
const loading = ref(true);
const errorMessage = ref('');
const statusFilter = ref('');
const includeRefused = ref(false);

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { dateStyle: 'medium' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(dateStr);
  }
}

async function loadTickets() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const params = new URLSearchParams();
    if (includeRefused.value || statusFilter.value === 'refuser') params.set('include_refused', '1');
    if (statusFilter.value) params.set('status', statusFilter.value);
    const url = '/admin/feedback/tickets' + (params.toString() ? '?' + params.toString() : '');
    const { data } = await api.get<Ticket[]>(url);
    tickets.value = Array.isArray(data) ? data : [];
  } catch {
    tickets.value = [];
    errorMessage.value = 'Erreur lors du chargement des tickets.';
  } finally {
    loading.value = false;
  }
}

function selectTicket(t: Ticket) {
  selectedTicket.value = t;
}

async function updateStatus(id: number, status: string) {
  try {
    const { data } = await api.patch<Ticket>(`/admin/feedback/tickets/${id}/status`, { status });
    const idx = tickets.value.findIndex((t) => t.id === id);
    if (idx >= 0) tickets.value[idx] = data;
    if (selectedTicket.value?.id === id) selectedTicket.value = data;
    if (status === 'refuser') {
      if (!includeRefused.value) tickets.value = tickets.value.filter((t) => t.id !== id);
      selectedTicket.value = null;
    }
  } catch {
    errorMessage.value = 'Erreur lors de la mise à jour du statut.';
  }
}

watch([statusFilter, includeRefused], loadTickets);

loadTickets();
</script>

<style scoped>
.admin-feedback {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.admin-feedback-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-feedback-ticket {
  cursor: pointer;
}

.admin-feedback-ticket.selected {
  border-color: #6366f1;
  box-shadow: 0 0 0 1px #6366f1;
}

.ticket-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.ticket-main {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.ticket-id {
  font-weight: 600;
  color: #94a3b8;
}

.ticket-title {
  font-weight: 600;
  color: #e2e8f0;
}

.ticket-author {
  font-size: 0.9rem;
  color: #94a3b8;
}

.ticket-date {
  font-size: 0.85rem;
  color: #64748b;
}

.ticket-status-select {
  min-width: 140px;
}

.admin-feedback-detail {
  max-width: 560px;
}

.detail-row {
  margin-bottom: 12px;
}

.detail-label {
  display: block;
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 4px;
}

.detail-value {
  color: #e2e8f0;
}

.detail-content {
  margin: 20px 0 16px 0;
}

.content-pre {
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 0.9rem;
  line-height: 1.5;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin: 8px 0 0 0;
}

.admin-toolbar-check {
  margin-left: 12px;
}
</style>
