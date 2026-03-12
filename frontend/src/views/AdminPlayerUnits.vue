<template>
  <section class="admin-player-units admin-fullwidth">
    <div class="admin-page-header">
      <h1 class="admin-title">Gestion des unités joueurs</h1>
      <p class="admin-desc">Réservé à Ladrio. Sélectionnez un joueur puis modifiez niveau, XP, spé et fatigue des unités.</p>
    </div>

    <div class="admin-toolbar nx-panel">
      <label class="toolbar-label">Joueur</label>
      <select v-model="selectedPlayerId" class="nx-select" @change="onPlayerChange">
        <option value="">— Choisir un joueur —</option>
        <option v-for="p in players" :key="p.id" :value="String(p.id)">{{ p.display_name }} ({{ p.id }})</option>
      </select>
      <label class="toolbar-label">Unité à ajouter</label>
      <select v-model="selectedUnitToAdd" class="nx-select unit-select" :disabled="!selectedPlayerId || addingUnit">
        <option value="">— Choisir une unité —</option>
        <option v-for="u in availableUnits" :key="u.id" :value="String(u.id)">{{ u.name }} ({{ u.rarity }})</option>
      </select>
      <input v-model.number="addCount" type="number" min="1" max="50" class="nx-input" :disabled="!selectedPlayerId || addingUnit" />
      <button type="button" class="nx-btn" :disabled="!selectedPlayerId || !selectedUnitToAdd || addingUnit" @click="addUnitToPlayer">
        {{ addingUnit ? 'Ajout…' : 'Ajouter l’unité' }}
      </button>
      <button type="button" class="nx-btn" :disabled="loading" @click="loadUnits">Actualiser</button>
    </div>

    <p v-if="errorMessage" class="admin-error">{{ errorMessage }}</p>
    <p v-if="!selectedPlayerId" class="admin-hint">Sélectionnez un joueur pour afficher ses unités.</p>

    <div v-else-if="loading && units.length === 0" class="admin-loading">Chargement…</div>

    <div v-else-if="units.length === 0" class="admin-empty">Aucune unité pour ce joueur.</div>

    <div v-else class="admin-table-wrap">
      <table class="admin-units-table">
        <thead>
          <tr>
            <th>Unité</th>
            <th>Niveau</th>
            <th>XP</th>
            <th>Spé</th>
            <th>Fatigue</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in units" :key="row.user_unit_id" :class="{ 'row-saving': savingId === row.user_unit_id }">
            <td class="cell-name">
              <span class="badge rarity" :class="'rarity-' + (row.rarity || 'common').toLowerCase()">{{ row.name }}</span>
            </td>
            <td>
              <input v-model.number="row.editLevel" type="number" min="1" max="50" class="nx-input cell-input" />
            </td>
            <td>
              <input v-model.number="row.editXp" type="number" min="0" class="nx-input cell-input" />
            </td>
            <td>
              <select v-model="row.editSpec" class="nx-select cell-select">
                <option value="">—</option>
                <option value="A">A</option>
                <option value="B">B</option>
              </select>
            </td>
            <td>
              <input v-model.number="row.editFatigue" type="number" min="0" max="100" class="nx-input cell-input" />
            </td>
            <td>
              <button
                type="button"
                class="nx-btn nx-btn-small"
                :disabled="savingId === row.user_unit_id"
                @click="saveRow(row)"
              >
                {{ savingId === row.user_unit_id ? '…' : 'Sauvegarder' }}
              </button>
              <button
                type="button"
                class="nx-btn nx-btn-small nx-btn-danger"
                :disabled="savingId === row.user_unit_id || deletingId === row.user_unit_id"
                @click="deleteRow(row)"
              >
                {{ deletingId === row.user_unit_id ? '…' : 'Supprimer' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../api';

type Player = { id: number; display_name: string };
type UnitOption = { id: number; name: string; rarity: string };

type UnitRow = {
  user_unit_id: number;
  unit_id?: number;
  name: string;
  rarity: string;
  level: number;
  xp: number;
  specialization?: string | null;
  fatigue: number;
  editLevel: number;
  editXp: number;
  editSpec: string;
  editFatigue: number;
};

const players = ref<Player[]>([]);
const availableUnits = ref<UnitOption[]>([]);
const selectedPlayerId = ref('');
const selectedUnitToAdd = ref('');
const addCount = ref(1);
const units = ref<UnitRow[]>([]);
const loading = ref(false);
const errorMessage = ref('');
const savingId = ref<number | null>(null);
const deletingId = ref<number | null>(null);
const addingUnit = ref(false);

async function loadPlayers() {
  try {
    const { data } = await api.get<{ players: Player[] }>('/admin/players');
    players.value = data.players || [];
  } catch (err) {
    errorMessage.value = 'Impossible de charger la liste des joueurs.';
    console.error(err);
  }
}

async function loadAvailableUnits() {
  try {
    const { data } = await api.get<{ units: UnitOption[] }>('/admin/units');
    availableUnits.value = Array.isArray(data.units)
      ? data.units.map((u) => ({
          id: Number(u.id),
          name: String(u.name ?? ''),
          rarity: String(u.rarity ?? 'common')
        }))
      : [];
  } catch (err) {
    console.error(err);
    errorMessage.value = 'Impossible de charger la liste des unités.';
  }
}

function onPlayerChange() {
  if (selectedPlayerId.value) loadUnits();
  else units.value = [];
}

async function loadUnits() {
  const userId = selectedPlayerId.value;
  if (!userId) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    const { data } = await api.get<{ units: unknown[] }>('/collection', { params: { userId } });
    const list = Array.isArray(data.units) ? data.units : [];
    units.value = list.map((u: Record<string, unknown>) => ({
      user_unit_id: Number(u.user_unit_id),
      unit_id: Number(u.unit_id ?? 0),
      name: String(u.name ?? ''),
      rarity: String(u.rarity ?? 'common'),
      level: Number(u.level ?? 1),
      xp: Number(u.xp ?? 0),
      specialization: u.specialization != null && u.specialization !== '' ? String(u.specialization) : null,
      fatigue: Number(u.fatigue ?? 0),
      editLevel: Number(u.level ?? 1),
      editXp: Number(u.xp ?? 0),
      editSpec: u.specialization != null && u.specialization !== '' ? String(u.specialization) : '',
      editFatigue: Number(u.fatigue ?? 0)
    }));
  } catch (err) {
    errorMessage.value = 'Impossible de charger les unités de ce joueur.';
    units.value = [];
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function addUnitToPlayer() {
  if (!selectedPlayerId.value || !selectedUnitToAdd.value) return;
  addingUnit.value = true;
  errorMessage.value = '';
  try {
    await api.post(`/admin/users/${selectedPlayerId.value}/units`, {
      unit_id: Number(selectedUnitToAdd.value),
      count: Math.max(1, Math.min(50, Number(addCount.value) || 1))
    });
    await loadUnits();
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string; error?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? ax?.response?.data?.error ?? 'Erreur lors de l’ajout de l’unité.';
  } finally {
    addingUnit.value = false;
  }
}

async function saveRow(row: UnitRow) {
  savingId.value = row.user_unit_id;
  errorMessage.value = '';
  try {
    const payload: Record<string, unknown> = {};
    if (row.editLevel !== row.level) payload.level = row.editLevel;
    if (row.editXp !== row.xp) payload.xp = row.editXp;
    const specVal = row.editSpec === '' ? null : row.editSpec;
    if (specVal !== (row.specialization ?? null)) payload.specialization = specVal;
    if (row.editFatigue !== row.fatigue) payload.fatigue = row.editFatigue;
    if (Object.keys(payload).length === 0) {
      savingId.value = null;
      return;
    }
    await api.patch(`/admin/user-units/${row.user_unit_id}`, payload);
    row.level = row.editLevel;
    row.xp = row.editXp;
    row.specialization = specVal;
    row.fatigue = row.editFatigue;
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur lors de la sauvegarde.';
    console.error(err);
  } finally {
    savingId.value = null;
  }
}

async function deleteRow(row: UnitRow) {
  const confirmed = window.confirm(`Supprimer l'unité "${row.name}" de ce joueur ?`);
  if (!confirmed) return;
  deletingId.value = row.user_unit_id;
  errorMessage.value = '';
  try {
    await api.delete(`/admin/user-units/${row.user_unit_id}`);
    units.value = units.value.filter((u) => u.user_unit_id !== row.user_unit_id);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string; error?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? ax?.response?.data?.error ?? 'Erreur lors de la suppression.';
  } finally {
    deletingId.value = null;
  }
}

onMounted(() => {
  loadPlayers();
  loadAvailableUnits();
});
</script>

<style scoped>
.admin-player-units {
  padding: 24px 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.admin-page-header {
  margin-bottom: 24px;
}

.admin-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #f8fafc;
  margin: 0 0 8px 0;
}

.admin-desc {
  font-size: 0.95rem;
  color: rgba(226, 232, 240, 0.85);
  margin: 0;
}

.admin-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.toolbar-label {
  font-weight: 600;
  color: #e2e8f0;
}

.nx-select {
  min-width: 220px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.8);
  color: #e2e8f0;
  font-size: 0.95rem;
}

.unit-select {
  min-width: 280px;
}

.nx-input {
  width: 72px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.8);
  color: #e2e8f0;
  font-size: 0.9rem;
}

.cell-select {
  width: 64px;
  padding: 6px 8px;
}

.admin-error {
  color: #fca5a5;
  margin: 0 0 16px 0;
}

.admin-hint,
.admin-loading,
.admin-empty {
  color: rgba(226, 232, 240, 0.8);
  margin: 16px 0;
}

.admin-table-wrap {
  overflow-x: auto;
}

.admin-units-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  overflow: hidden;
}

.admin-units-table th,
.admin-units-table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.admin-units-table th {
  background: rgba(30, 41, 59, 0.8);
  color: #94a3b8;
  font-weight: 600;
  font-size: 0.85rem;
}

.admin-units-table tbody tr:hover {
  background: rgba(30, 41, 59, 0.4);
}

.admin-units-table tbody tr.row-saving {
  background: rgba(251, 191, 36, 0.08);
}

.cell-name .badge.rarity {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.9rem;
}

.badge.rarity-common { background: rgba(148, 163, 184, 0.3); color: #e2e8f0; }
.badge.rarity-uncommon { background: rgba(34, 197, 94, 0.25); color: #86efac; }
.badge.rarity-rare { background: rgba(59, 130, 246, 0.3); color: #93c5fd; }
.badge.rarity-epic { background: rgba(168, 85, 247, 0.3); color: #e9d5ff; }
.badge.rarity-legendary { background: rgba(245, 158, 11, 0.3); color: #fde68a; }
.badge.rarity-mythic { background: rgba(239, 68, 68, 0.25); color: #fecaca; }

.nx-btn-small {
  padding: 6px 12px;
  font-size: 0.85rem;
  margin-right: 8px;
}

.nx-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
