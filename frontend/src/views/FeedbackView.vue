<template>
  <section class="feedback-page page-content">
    <div class="feedback-header">
      <h1 class="page-title nx-title">Feedback</h1>
      <button type="button" class="nx-btn nx-glow-blue btn-new-ticket" @click="showForm = true">
        <span class="btn-icon">+</span> Nouveau
      </button>
    </div>

    <!-- Modal formulaire nouveau ticket -->
    <div v-if="showForm" class="feedback-modal-overlay" @click.self="showForm = false">
      <div class="feedback-modal nx-panel">
        <h2 class="nx-subtitle">Nouveau ticket</h2>
        <form @submit.prevent="submitTicket" class="feedback-form">
          <div class="form-row">
            <label for="ticket-title">Titre</label>
            <input
              id="ticket-title"
              v-model="formTitle"
              type="text"
              class="nx-input full"
              placeholder="Ex : Mode 2v2"
              maxlength="255"
              required
            />
          </div>
          <div class="form-row">
            <label for="ticket-content">Description</label>
            <textarea
              id="ticket-content"
              v-model="formContent"
              class="nx-input full"
              rows="5"
              placeholder="Décris le problème ou ta suggestion..."
              required
            />
          </div>
          <p v-if="submitError" class="feedback-error">{{ submitError }}</p>
          <p v-if="submitSuccess" class="feedback-success">{{ submitSuccess }}</p>
          <div class="form-actions">
            <button type="button" class="nx-btn" @click="showForm = false">Annuler</button>
            <button type="submit" class="nx-btn nx-glow-blue" :disabled="submitLoading">
              {{ submitLoading ? 'Envoi…' : 'Envoyer' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Tableau Kanban -->
    <div v-if="loading && tickets.length === 0" class="feedback-loading">Chargement…</div>
    <div v-else class="feedback-kanban">
      <div
        v-for="col in columns"
        :key="col.status"
        class="kanban-column"
        :class="`column-${col.status}`"
      >
        <div class="kanban-column-header">
          <span class="column-icon">{{ col.icon }}</span>
          <span class="column-label">{{ col.label }}</span>
          <span class="column-count">({{ getTicketsForStatus(col.status).length }})</span>
        </div>
        <div class="kanban-cards">
          <div
            v-for="t in getTicketsForStatus(col.status)"
            :key="t.id"
            class="kanban-card nx-card"
            @click="selectedTicket = t"
          >
            <div class="card-title">{{ t.title }}</div>
            <div class="card-author">{{ t.author_name || 'Anonyme' }}</div>
            <span v-if="t.user_id === currentUserId" class="card-badge-mine">Moi</span>
          </div>
          <p v-if="getTicketsForStatus(col.status).length === 0" class="kanban-empty">Aucun ticket</p>
        </div>
      </div>
    </div>

    <!-- Détail ticket (modal) -->
    <div v-if="selectedTicket" class="feedback-modal-overlay" @click.self="selectedTicket = null">
      <div class="feedback-detail-modal nx-panel">
        <h2 class="detail-title">{{ selectedTicket.title }}</h2>
        <div class="detail-meta">
          <span class="detail-author">{{ selectedTicket.author_name || 'Anonyme' }}</span>
          <span class="detail-date">{{ formatDate(selectedTicket.created_at) }}</span>
          <span class="detail-status" :class="`badge-${selectedTicket.status}`">{{ statusLabel(selectedTicket.status) }}</span>
        </div>
        <pre class="detail-content">{{ selectedTicket.content }}</pre>
        <button type="button" class="nx-btn" @click="selectedTicket = null">Fermer</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../api';
import { getCurrentUserFromToken } from '../api';

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

const COLUMNS = [
  { status: 'non_prio', label: 'NON PRIO', icon: '⚠' },
  { status: 'acceptes', label: 'ACCEPTÉ', icon: '✓' },
  { status: 'en_cours', label: 'EN COURS', icon: '⚙' },
  { status: 'realises', label: 'RÉALISÉ', icon: '✓' },
  { status: 'disponibles', label: 'DISPONIBLE', icon: '★' }
];

// Inclure "proposes" en première colonne
const columns = [
  { status: 'proposes', label: 'PROPOSÉ', icon: '💬' },
  ...COLUMNS
];

const STATUS_LABELS: Record<string, string> = {
  proposes: 'Proposé',
  non_prio: 'Non prioritaire',
  acceptes: 'Accepté',
  en_cours: 'En cours',
  realises: 'Réalisé',
  disponibles: 'Disponible',
  refuser: 'Refusé'
};

const tickets = ref<Ticket[]>([]);
const loading = ref(true);
const showForm = ref(false);
const selectedTicket = ref<Ticket | null>(null);
const formTitle = ref('');
const formContent = ref('');
const submitLoading = ref(false);
const submitError = ref('');
const submitSuccess = ref('');

const currentUserId = computed(() => (getCurrentUserFromToken() as { id?: number } | null)?.id ?? null);

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}

function getTicketsForStatus(status: string): Ticket[] {
  return tickets.value.filter((t) => t.status === status);
}

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
  try {
    const { data } = await api.get<Ticket[]>('/feedback/browse');
    tickets.value = Array.isArray(data) ? data : [];
  } catch {
    tickets.value = [];
  } finally {
    loading.value = false;
  }
}

async function submitTicket() {
  submitError.value = '';
  submitSuccess.value = '';
  const title = formTitle.value.trim();
  const content = formContent.value.trim();
  if (!title || !content) {
    submitError.value = 'Le titre et la description sont requis.';
    return;
  }
  submitLoading.value = true;
  try {
    await api.post('/feedback/tickets', { title, content });
    formTitle.value = '';
    formContent.value = '';
    submitSuccess.value = 'Ticket envoyé avec succès.';
    showForm.value = false;
    await loadTickets();
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    submitError.value = msg ?? 'Erreur lors de l\'envoi du ticket.';
  } finally {
    submitLoading.value = false;
  }
}

onMounted(loadTickets);
</script>

<style scoped>
.feedback-page {
  padding-bottom: 32px;
}

.feedback-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
}

.btn-new-ticket {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-icon {
  font-size: 1.1em;
  font-weight: 700;
}

.feedback-intro {
  margin-bottom: 24px;
  color: #94a3b8;
  font-size: 0.95rem;
}

.feedback-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.feedback-modal,
.feedback-detail-modal {
  max-width: 520px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.feedback-form .form-row {
  margin-bottom: 16px;
}

.feedback-form label {
  display: block;
  margin-bottom: 6px;
  color: #e2e8f0;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.feedback-kanban {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 16px;
  min-height: 400px;
}

.kanban-column {
  flex: 0 0 220px;
  min-width: 200px;
  background: rgba(0, 0, 0, 0.22);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.kanban-column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 0.9rem;
  color: #d4af37;
}

.column-icon {
  font-size: 1.1em;
  color: inherit;
}

.column-count {
  color: #c9a227;
  font-weight: 500;
}

.kanban-cards {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 80px;
}

.kanban-card {
  padding: 12px;
  cursor: pointer;
  text-align: left;
  transition: box-shadow 0.2s, transform 0.15s;
}

.kanban-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transform: translateY(-1px);
}

.card-title {
  font-weight: 600;
  color: #e2e8f0;
  margin-bottom: 6px;
}

.card-author {
  font-size: 0.85rem;
  color: #86efac;
}

.card-badge-mine {
  display: inline-block;
  margin-top: 6px;
  font-size: 0.75rem;
  padding: 2px 6px;
  background: rgba(99, 102, 241, 0.4);
  border-radius: 4px;
  color: #c7d2fe;
}

.kanban-empty {
  margin: 16px 0;
  color: #64748b;
  font-size: 0.9rem;
}

.column-proposes .column-icon { color: #94a3b8; }
.column-non_prio .column-icon { color: #f97316; }
.column-acceptes .column-icon { color: #3b82f6; }
.column-en_cours .column-icon { color: #a855f7; }
.column-realises .column-icon { color: #22c55e; }
.column-disponibles .column-icon { color: #ec4899; }

.detail-title {
  font-size: 1.25rem;
  margin-bottom: 12px;
  color: #e2e8f0;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 0.9rem;
}

.detail-author {
  color: #86efac;
}

.detail-date {
  color: #64748b;
}

.detail-status {
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 6px;
}

.badge-proposes { background: rgba(99, 102, 241, 0.3); color: #c7d2fe; }
.badge-non_prio { background: rgba(249, 115, 22, 0.3); color: #fdba74; }
.badge-acceptes { background: rgba(59, 130, 246, 0.3); color: #93c5fd; }
.badge-en_cours { background: rgba(168, 85, 247, 0.3); color: #e9d5ff; }
.badge-realises { background: rgba(34, 197, 94, 0.3); color: #86efac; }
.badge-disponibles { background: rgba(236, 72, 153, 0.3); color: #f9a8d4; }

.detail-content {
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #cbd5e1;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 20px;
  max-height: 300px;
  overflow-y: auto;
}

.feedback-loading {
  color: #94a3b8;
  padding: 40px;
  text-align: center;
}

.feedback-error { color: #f87171; margin-top: 8px; }
.feedback-success { color: #86efac; margin-top: 8px; }

@media (max-width: 768px) {
  .feedback-page {
    padding: 0 0.5rem 24px;
  }
  .feedback-header {
    flex-direction: column;
    align-items: stretch;
  }
  .feedback-modal-overlay {
    padding: 1rem;
  }
  .feedback-modal,
  .feedback-detail-modal {
    max-width: 100%;
  }
}
</style>
