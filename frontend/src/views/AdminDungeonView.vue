<template>
  <section class="admin-dungeon admin-fullwidth">
    <div class="admin-page-header">
      <h1 class="admin-title">Donjon Admin</h1>
      <p class="admin-desc">
        Configurez l’équipe ennemie pour chaque combat du donjon : 5 éléments, 10 niveaux, 3 combats par niveau.
        Choisissez donjon, niveau et numéro de combat, puis les unités (position, niveau, spécialisation) et le multiplicateur de stats.
      </p>
    </div>

    <div class="admin-toolbar nx-panel">
      <label class="toolbar-label">Donjon</label>
      <select v-model="selectedElement" class="nx-select" @change="syncEditorFromSelection">
        <option v-for="opt in elementOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <label class="toolbar-label">Niveau</label>
      <select v-model.number="selectedLevel" class="nx-select" @change="syncEditorFromSelection">
        <option v-for="lv in 10" :key="lv" :value="lv">Niveau {{ lv }}</option>
      </select>
      <label class="toolbar-label">Combat</label>
      <select v-model.number="selectedCombat" class="nx-select" @change="syncEditorFromSelection">
        <option v-for="c in 3" :key="c" :value="c">Combat {{ c }} / 3</option>
      </select>
      <button type="button" class="nx-btn" :disabled="loading" @click="loadEncounters">Actualiser</button>
    </div>

    <p v-if="errorMessage" class="admin-error">{{ errorMessage }}</p>
    <p v-if="saveSuccess" class="admin-success">Sauvegardé avec succès.</p>

    <div class="dungeon-editor nx-panel">
      <h2 class="editor-title">{{ currentSelectionLabel }}</h2>

      <div class="multiplier-row">
        <label class="field-group">
          <span class="field-label">Multiplicateur de stats</span>
          <input
            v-model.number="statMultiplier"
            type="number"
            min="0.1"
            step="0.05"
            class="nx-input nx-input-wide"
          />
        </label>
        <p class="field-hint">Appliqué aux PV, attaque, défense, vitesse et maîtrise des ennemis (défaut 1).</p>
      </div>

      <div class="units-section">
        <h3 class="section-title">Unités ennemies</h3>
        <div class="units-list">
          <div v-for="(unit, idx) in editedUnits" :key="idx" class="unit-row nx-card">
            <div class="unit-row-main">
              <span class="unit-name">{{ getUnitName(unit.code) }}</span>
              <span class="unit-code">{{ unit.code }}</span>
            </div>
            <div class="unit-row-fields">
              <label class="field-group">
                <span class="field-label">Position</span>
                <select v-model="unit.position" class="nx-select">
                  <option value="front">CAC (front)</option>
                  <option value="back">Distance (back)</option>
                </select>
              </label>
              <label class="field-group">
                <span class="field-label">Niveau</span>
                <input v-model.number="unit.level" type="number" min="1" max="70" class="nx-input" />
              </label>
              <label class="field-group">
                <span class="field-label">Spécialisation</span>
                <select v-model="unit.specialization" class="nx-select">
                  <option :value="null">—</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                </select>
              </label>
              <button type="button" class="nx-btn nx-btn-small nx-btn-danger" @click="removeUnit(idx)">Supprimer</button>
            </div>
          </div>
        </div>

        <div class="add-unit-row">
          <select v-model="unitToAdd" class="nx-select unit-select">
            <option value="">— Ajouter une unité —</option>
            <option v-for="u in availableUnits" :key="u.code" :value="u.code">{{ u.name }} ({{ u.code }})</option>
          </select>
          <button type="button" class="nx-btn" :disabled="!unitToAdd" @click="addUnit">Ajouter</button>
        </div>
      </div>

      <div class="save-row">
        <button type="button" class="nx-btn nx-btn-primary" :disabled="saving" @click="saveEncounter">
          {{ saving ? 'Sauvegarde…' : 'Sauvegarder' }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import api from '../api';

const ELEMENT_OPTIONS = [
  { value: 'fire', label: 'Feu' },
  { value: 'water', label: 'Eau' },
  { value: 'plant', label: 'Plante' },
  { value: 'light', label: 'Lumière' },
  { value: 'dark', label: 'Ténèbres' }
] as const;

type EncounterRow = {
  element: string;
  level: number;
  combat_index: number;
  enemy_template: { units?: Array<Record<string, unknown>>; stat_multiplier?: number } | null;
};

type UnitOption = { code: string; name: string; attack_type: string; element: string | null };

/** Aligne la valeur `element` BDD avec les clés donjon (fire, water, plant, light, dark). */
function normalizeUnitElement(raw: string | null | undefined): string | null {
  const e = String(raw ?? '')
    .toLowerCase()
    .trim();
  if (e === 'lumiere' || e === 'light') return 'light';
  if (e === 'tenebres' || e === 'tenebre' || e === 'dark') return 'dark';
  if (['fire', 'water', 'plant', 'light', 'dark'].includes(e)) return e;
  return null;
}

const loading = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const saveSuccess = ref(false);
const encounters = ref<EncounterRow[]>([]);
const units = ref<UnitOption[]>([]);

const selectedElement = ref<string>('fire');
const selectedLevel = ref(1);
const selectedCombat = ref(1);
const unitToAdd = ref('');

const editedUnits = ref<
  Array<{
    code: string;
    position: string;
    level: number;
    specialization: string | null;
  }>
>([]);
const statMultiplier = ref(1);

const elementOptions = ELEMENT_OPTIONS;

const currentEncounter = computed(() =>
  encounters.value.find(
    (e) =>
      e.element === selectedElement.value &&
      e.level === selectedLevel.value &&
      e.combat_index === selectedCombat.value
  )
);

const currentSelectionLabel = computed(() => {
  const el = ELEMENT_OPTIONS.find((o) => o.value === selectedElement.value)?.label ?? selectedElement.value;
  return `${el} — Niveau ${selectedLevel.value} — Combat ${selectedCombat.value} / 3`;
});

const availableUnits = computed(() =>
  units.value.filter((u) => normalizeUnitElement(u.element) === selectedElement.value)
);

/** Si on change de donjon, vider le choix d’ajout (code peut ne plus être dans la liste filtrée). */
watch(selectedElement, () => {
  unitToAdd.value = '';
});

function getUnitName(code: string): string {
  return units.value.find((u) => u.code === code)?.name ?? code;
}

function buildEditorFromEncounter(enc: EncounterRow | undefined) {
  const template = enc?.enemy_template;
  const unitList = template?.units;
  if (!Array.isArray(unitList)) {
    editedUnits.value = [];
    statMultiplier.value = Number(template?.stat_multiplier ?? 1) || 1;
    return;
  }
  editedUnits.value = unitList.map((u: Record<string, unknown>) => ({
    code: String(u.code ?? ''),
    position: u.position === 'back' ? 'back' : 'front',
    level: typeof u.level === 'number' ? u.level : Number(u.level) || 20,
    specialization: (u.specialization as string | null) ?? null
  }));
  statMultiplier.value = Number(template?.stat_multiplier ?? 1) || 1;
}

function syncEditorFromSelection() {
  buildEditorFromEncounter(currentEncounter.value);
}

function addUnit() {
  if (!unitToAdd.value) return;
  editedUnits.value.push({
    code: unitToAdd.value,
    position: 'front',
    level: 20,
    specialization: null
  });
  unitToAdd.value = '';
}

function removeUnit(idx: number) {
  editedUnits.value.splice(idx, 1);
}

async function loadEncounters() {
  loading.value = true;
  errorMessage.value = '';
  saveSuccess.value = false;
  try {
    const [encRes, unitsRes] = await Promise.all([
      api.get<{ encounters: EncounterRow[] }>('/admin/dungeon-encounters'),
      api.get<{ units: Array<{ code: string; name: string; attack_type: string }> }>('/admin/units')
    ]);
    encounters.value = encRes.data.encounters ?? [];
    units.value = (unitsRes.data.units ?? []).map((u) => ({
      code: u.code,
      name: u.name,
      attack_type: u.attack_type,
      element: 'element' in u && u.element != null ? String(u.element) : null
    }));
    syncEditorFromSelection();
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur chargement';
  } finally {
    loading.value = false;
  }
}

async function saveEncounter() {
  saving.value = true;
  errorMessage.value = '';
  saveSuccess.value = false;
  try {
    const enemy_template = {
      units: editedUnits.value.map((u) => ({
        code: u.code,
        position: u.position,
        level: u.level,
        specialization: u.specialization
      })),
      stat_multiplier: statMultiplier.value
    };
    const { data } = await api.put<{ encounter: EncounterRow }>(
      `/admin/dungeon-encounters/${selectedElement.value}/${selectedLevel.value}/${selectedCombat.value}`,
      { enemy_template }
    );
    const updated = data.encounter;
    const idx = encounters.value.findIndex(
      (e) =>
        e.element === selectedElement.value &&
        e.level === selectedLevel.value &&
        e.combat_index === selectedCombat.value
    );
    if (idx >= 0) encounters.value[idx] = updated;
    else encounters.value.push(updated);
    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur sauvegarde';
  } finally {
    saving.value = false;
  }
}

onMounted(() => loadEncounters());
</script>

<style scoped>
.admin-dungeon {
  padding: 1rem;
}

.admin-page-header {
  margin-bottom: 1rem;
}

.admin-title {
  margin: 0 0 0.25rem 0;
  font-size: 1.5rem;
  color: #f8fafc;
}

.admin-desc {
  margin: 0;
  font-size: 0.9rem;
  color: #94a3b8;
}

.admin-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
}

.toolbar-label {
  font-size: 0.85rem;
  color: #94a3b8;
}

.nx-select {
  padding: 6px 10px;
  border-radius: 8px;
  background: #1e293b;
  border: 1px solid #475569;
  color: #e2e8f0;
  font-size: 0.9rem;
}

.nx-input {
  padding: 6px 10px;
  border-radius: 8px;
  background: #1e293b;
  border: 1px solid #475569;
  color: #e2e8f0;
  font-size: 0.9rem;
  width: 70px;
}

.nx-input-wide {
  width: 100px;
}

.nx-btn {
  padding: 6px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #e2e8f0;
  font-size: 0.9rem;
  cursor: pointer;
}

.nx-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nx-btn-primary {
  background: rgba(0, 255, 200, 0.15);
  border-color: rgba(0, 255, 200, 0.4);
  color: #67e8f9;
}

.nx-btn-small {
  padding: 4px 10px;
  font-size: 0.8rem;
}

.nx-btn-danger {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
}

.admin-error {
  color: #fca5a5;
  margin: 0 0 1rem 0;
}

.admin-success {
  color: #4ade80;
  margin: 0 0 1rem 0;
}

.dungeon-editor {
  padding: 1rem;
  margin-bottom: 1rem;
}

.editor-title {
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
  color: #f8fafc;
}

.multiplier-row {
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.field-hint {
  margin: 0.35rem 0 0 0;
  font-size: 0.8rem;
  color: #64748b;
}

.section-title {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: #cbd5e1;
}

.units-section {
  margin-bottom: 1.5rem;
}

.units-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.unit-row {
  padding: 0.75rem 1rem;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 10px;
}

.unit-row-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.unit-name {
  font-weight: 600;
  color: #f8fafc;
}

.unit-code {
  font-size: 0.8rem;
  color: #64748b;
}

.unit-row-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.field-label {
  font-size: 0.75rem;
  color: #94a3b8;
}

.add-unit-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.unit-select {
  min-width: 220px;
}

.save-row {
  margin-top: 1rem;
}
</style>
