<template>
  <section class="admin-player-artifacts admin-fullwidth">
    <div class="admin-page-header">
      <h1 class="admin-title">Gestion artefacts joueurs</h1>
      <p class="admin-desc">Sélectionnez un joueur pour voir, ajouter, modifier, équiper ou supprimer ses artefacts.</p>
    </div>

    <div class="admin-toolbar nx-panel">
      <label class="toolbar-label">Joueur</label>
      <select v-model="selectedPlayerId" class="nx-select" @change="onPlayerChange">
        <option value="">— Choisir un joueur —</option>
        <option v-for="p in players" :key="p.id" :value="String(p.id)">{{ p.display_name }} ({{ p.id }})</option>
      </select>

      <div class="toolbar-spacer" />
      <div class="gold-badge">🪙 Or : {{ playerGold }}</div>
      <button type="button" class="nx-btn" :disabled="loading || !selectedPlayerId" @click="loadArtifacts">Actualiser</button>
    </div>

    <div v-if="selectedPlayerId" class="add-panel nx-panel">
      <h2>Ajouter des artefacts</h2>
      <div class="add-grid">
        <div class="form-block">
          <label>Stat</label>
          <select v-model="addForm.stat_key" class="nx-select">
            <option value="">— Stat —</option>
            <option v-for="stat in statOptions" :key="stat.key" :value="stat.key">{{ stat.label }}</option>
          </select>
        </div>
        <div class="form-block">
          <label>Niveau</label>
          <input v-model.number="addForm.level" type="number" min="0" class="nx-input" />
        </div>
        <div class="form-block">
          <label>Quantité</label>
          <input v-model.number="addForm.count" type="number" min="1" max="100" class="nx-input" />
        </div>
        <div class="form-block">
          <label>Equiper sur</label>
          <select v-model="addForm.equipped_user_unit_id" class="nx-select">
            <option value="">— Aucun —</option>
            <option v-for="unit in units" :key="unit.user_unit_id" :value="String(unit.user_unit_id)">
              {{ unit.name }} (#{{ unit.user_unit_id }})
            </option>
          </select>
        </div>
        <button
          type="button"
          class="nx-btn"
          :disabled="adding || !addForm.stat_key || !selectedPlayerId"
          @click="addArtifacts"
        >
          {{ adding ? 'Ajout…' : 'Ajouter' }}
        </button>
      </div>
      <p class="add-note">Un artefact équipé à l’ajout doit être créé seul. Les règles de 2 slots max et de non-duplication de stat restent actives.</p>
    </div>

    <p v-if="errorMessage" class="admin-error">{{ errorMessage }}</p>
    <p v-if="!selectedPlayerId" class="admin-hint">Sélectionnez un joueur pour afficher ses artefacts.</p>
    <div v-else-if="loading && artifacts.length === 0" class="admin-loading">Chargement…</div>
    <div v-else-if="artifacts.length === 0" class="admin-empty">Aucun artefact pour ce joueur.</div>

    <div v-else class="admin-table-wrap">
      <table class="admin-artifacts-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Stat</th>
            <th>Niveau</th>
            <th>Equipé sur</th>
            <th>Créé</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in artifacts" :key="row.id" :class="{ 'row-saving': savingId === row.id }">
            <td>#{{ row.id }}</td>
            <td>
              <span class="artifact-stat-pill">{{ row.stat_label }}</span>
            </td>
            <td>
              <input v-model.number="row.editLevel" type="number" min="0" class="nx-input cell-input" />
            </td>
            <td>
              <select v-model="row.editEquippedUserUnitId" class="nx-select cell-select">
                <option value="">— Aucun —</option>
                <option v-for="unit in units" :key="unit.user_unit_id" :value="String(unit.user_unit_id)">
                  {{ unit.name }} (#{{ unit.user_unit_id }})
                </option>
              </select>
            </td>
            <td>{{ formatDate(row.created_at) }}</td>
            <td class="cell-actions">
              <button type="button" class="nx-btn nx-btn-small" :disabled="savingId === row.id" @click="saveRow(row)">
                {{ savingId === row.id ? '…' : 'Sauvegarder' }}
              </button>
              <button type="button" class="nx-btn nx-btn-small" :disabled="savingId === row.id" @click="stepLevel(row, +1)">
                +1
              </button>
              <button type="button" class="nx-btn nx-btn-small" :disabled="savingId === row.id || row.editLevel <= 0" @click="stepLevel(row, -1)">
                -1
              </button>
              <button
                type="button"
                class="nx-btn nx-btn-small nx-btn-danger"
                :disabled="deletingId === row.id"
                @click="deleteRow(row)"
              >
                {{ deletingId === row.id ? '…' : 'Supprimer' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import api from '../api';

type Player = { id: number; display_name: string };
type UnitOption = { user_unit_id: number; name: string; level: number };
type StatOption = { key: string; label: string };

type ArtifactRow = {
  id: number;
  stat_key: string;
  stat_label: string;
  level: number;
  equipped_user_unit_id: number | null;
  equipped_unit_name: string | null;
  created_at: string | null;
  editLevel: number;
  editEquippedUserUnitId: string;
};

const players = ref<Player[]>([]);
const selectedPlayerId = ref('');
const playerGold = ref(0);
const units = ref<UnitOption[]>([]);
const statOptions = ref<StatOption[]>([]);
const artifacts = ref<ArtifactRow[]>([]);
const loading = ref(false);
const adding = ref(false);
const savingId = ref<number | null>(null);
const deletingId = ref<number | null>(null);
const errorMessage = ref('');

const addForm = ref({
  stat_key: '',
  level: 0,
  count: 1,
  equipped_user_unit_id: ''
});

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function applyPayload(data: {
  wallet?: { gold?: number };
  units?: UnitOption[];
  artifacts?: Array<Record<string, unknown>>;
  stat_keys?: StatOption[];
}) {
  playerGold.value = Number(data?.wallet?.gold ?? 0);
  units.value = Array.isArray(data?.units) ? data.units.map((unit) => ({
    user_unit_id: Number(unit.user_unit_id),
    name: String(unit.name ?? ''),
    level: Number(unit.level ?? 1)
  })) : [];
  statOptions.value = Array.isArray(data?.stat_keys) ? data.stat_keys.map((stat) => ({
    key: String(stat.key),
    label: String(stat.label)
  })) : [];
  artifacts.value = Array.isArray(data?.artifacts)
    ? data.artifacts.map((artifact) => ({
        id: Number(artifact.id),
        stat_key: String(artifact.stat_key ?? ''),
        stat_label: String(artifact.stat_label ?? artifact.stat_key ?? ''),
        level: Number(artifact.level ?? 0),
        equipped_user_unit_id: artifact.equipped_user_unit_id != null ? Number(artifact.equipped_user_unit_id) : null,
        equipped_unit_name: artifact.equipped_unit_name != null ? String(artifact.equipped_unit_name) : null,
        created_at: artifact.created_at != null ? String(artifact.created_at) : null,
        editLevel: Number(artifact.level ?? 0),
        editEquippedUserUnitId: artifact.equipped_user_unit_id != null ? String(artifact.equipped_user_unit_id) : ''
      }))
    : [];
}

function apiErrorMessage(error: unknown, fallback: string) {
  const ax = error as { response?: { data?: { error?: string; message?: string } } };
  const code = ax?.response?.data?.error || '';
  const messageMap: Record<string, string> = {
    USER_UNIT_NOT_FOUND: 'L’unité cible est introuvable.',
    ARTIFACT_SLOTS_FULL: 'Cette unité a déjà 2 artefacts équipés.',
    DUPLICATE_ARTIFACT_STAT: 'Cette unité a déjà un artefact sur cette stat.',
    EQUIPPED_ARTIFACT_COUNT_MUST_BE_ONE: 'Un artefact équipé à l’ajout doit être créé seul.',
    INVALID_ARTIFACT_LEVEL: 'Le niveau doit être un entier supérieur ou égal à 0.',
    INVALID_ARTIFACT_STAT: 'Stat d’artefact invalide.'
  };
  return messageMap[code] || ax?.response?.data?.message || fallback;
}

async function loadPlayers() {
  try {
    const { data } = await api.get<{ players: Player[] }>('/admin/players');
    players.value = Array.isArray(data.players) ? data.players : [];
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Impossible de charger la liste des joueurs.');
  }
}

function onPlayerChange() {
  if (!selectedPlayerId.value) {
    artifacts.value = [];
    units.value = [];
    playerGold.value = 0;
    return;
  }
  void loadArtifacts();
}

async function loadArtifacts() {
  if (!selectedPlayerId.value) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    const { data } = await api.get(`/admin/users/${selectedPlayerId.value}/artifacts`);
    applyPayload(data);
  } catch (error) {
    artifacts.value = [];
    errorMessage.value = apiErrorMessage(error, 'Impossible de charger les artefacts de ce joueur.');
  } finally {
    loading.value = false;
  }
}

async function addArtifacts() {
  if (!selectedPlayerId.value || !addForm.value.stat_key) return;
  adding.value = true;
  errorMessage.value = '';
  try {
    const { data } = await api.post(`/admin/users/${selectedPlayerId.value}/artifacts`, {
      stat_key: addForm.value.stat_key,
      level: Math.max(0, Number(addForm.value.level) || 0),
      count: Math.max(1, Math.min(100, Number(addForm.value.count) || 1)),
      equipped_user_unit_id: addForm.value.equipped_user_unit_id ? Number(addForm.value.equipped_user_unit_id) : null
    });
    applyPayload(data);
    addForm.value.level = 0;
    addForm.value.count = 1;
    addForm.value.equipped_user_unit_id = '';
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Erreur lors de l’ajout des artefacts.');
  } finally {
    adding.value = false;
  }
}

async function saveRow(row: ArtifactRow) {
  savingId.value = row.id;
  errorMessage.value = '';
  try {
    const { data } = await api.patch(`/admin/user-artifacts/${row.id}`, {
      level: Math.max(0, Number(row.editLevel) || 0),
      equipped_user_unit_id: row.editEquippedUserUnitId ? Number(row.editEquippedUserUnitId) : null
    });
    applyPayload(data);
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Erreur lors de la sauvegarde de l’artefact.');
  } finally {
    savingId.value = null;
  }
}

async function stepLevel(row: ArtifactRow, delta: number) {
  row.editLevel = Math.max(0, row.editLevel + delta);
  await saveRow(row);
}

async function deleteRow(row: ArtifactRow) {
  if (!window.confirm(`Supprimer l’artefact #${row.id} ?`)) return;
  deletingId.value = row.id;
  errorMessage.value = '';
  try {
    const { data } = await api.delete(`/admin/user-artifacts/${row.id}`);
    applyPayload(data);
  } catch (error) {
    errorMessage.value = apiErrorMessage(error, 'Erreur lors de la suppression de l’artefact.');
  } finally {
    deletingId.value = null;
  }
}

onMounted(() => {
  loadPlayers();
});
</script>

<style scoped>
.admin-player-artifacts {
  padding: 24px 32px;
  max-width: 1400px;
  margin: 0 auto;
}

.admin-page-header {
  margin-bottom: 18px;
}

.admin-title {
  margin: 0 0 6px;
}

.admin-desc {
  margin: 0;
  color: #cbd5e1;
}

.admin-toolbar,
.add-panel {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.toolbar-label {
  color: #cbd5e1;
  font-weight: 600;
}

.toolbar-spacer {
  flex: 1;
}

.gold-badge {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.14);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #fbbf24;
  font-weight: 700;
}

.add-panel {
  flex-direction: column;
  align-items: stretch;
}

.add-panel h2 {
  margin: 0;
}

.add-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  align-items: end;
}

.form-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.add-note,
.admin-hint,
.admin-loading,
.admin-empty,
.admin-error {
  margin: 12px 0;
}

.add-note,
.admin-hint,
.admin-loading,
.admin-empty {
  color: #cbd5e1;
}

.admin-error {
  color: #fca5a5;
}

.admin-table-wrap {
  overflow-x: auto;
  border-radius: 16px;
}

.admin-artifacts-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.admin-artifacts-table th,
.admin-artifacts-table td {
  padding: 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  text-align: left;
}

.artifact-stat-pill {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.14);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #bfdbfe;
  font-weight: 700;
}

.cell-input {
  width: 96px;
}

.cell-select {
  min-width: 200px;
}

.cell-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.row-saving {
  opacity: 0.7;
}

@media (max-width: 900px) {
  .admin-player-artifacts {
    padding: 20px 16px;
  }
}
</style>
