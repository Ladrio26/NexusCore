<template>
  <section class="admin-campaign admin-fullwidth">
    <div class="admin-page-header">
      <h1 class="admin-title">Campagne Admin</h1>
      <p class="admin-desc">Configurez les unités ennemies pour chaque stage. Choisissez chapitre et stage, modifiez les unités (CAC/Distance, niveau, spécialisation), puis sauvegardez.</p>
    </div>

    <div class="admin-toolbar nx-panel">
      <label class="toolbar-label">Chapitre</label>
      <select v-model.number="selectedChapter" class="nx-select" @change="onStageSelect">
        <option v-for="c in 10" :key="c" :value="c">Chapitre {{ c }}</option>
      </select>
      <label class="toolbar-label">Stage</label>
      <select v-model.number="selectedStage" class="nx-select" @change="onStageSelect">
        <option v-for="s in 10" :key="s" :value="s">Stage {{ s }}{{ s === 10 ? ' (Boss)' : '' }}</option>
      </select>
      <button type="button" class="nx-btn" :disabled="loading" @click="loadStages">Actualiser</button>
    </div>

    <p v-if="errorMessage" class="admin-error">{{ errorMessage }}</p>
    <p v-if="saveSuccess" class="admin-success">Sauvegardé avec succès.</p>

    <div v-if="currentStageData" class="campaign-editor nx-panel">
      <h2 class="editor-title">Chapitre {{ selectedChapter }} — Stage {{ selectedStage }}{{ currentStageData.is_boss ? ' (Boss)' : '' }}</h2>

      <div class="units-section">
        <h3 class="section-title">Unités ennemies</h3>
        <div class="units-list">
          <div
            v-for="(unit, idx) in editedUnits"
            :key="idx"
            class="unit-row nx-card"
          >
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
                <span class="field-label">Niveau Normal</span>
                <input v-model.number="unit.level" type="number" min="1" max="70" class="nx-input" />
              </label>
              <label class="field-group">
                <span class="field-label">Niveau Hard</span>
                <input v-model.number="unit.hard_level" type="number" min="1" max="70" class="nx-input" />
              </label>
              <label class="field-group">
                <span class="field-label">Spé Normal</span>
                <select v-model="unit.specialization" class="nx-select">
                  <option :value="null">—</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                </select>
              </label>
              <label class="field-group">
                <span class="field-label">Spé Hard</span>
                <select v-model="unit.hard_specialization" class="nx-select">
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

      <div v-if="currentStageData.is_boss" class="boss-section">
        <h3 class="section-title">Boss</h3>
        <div class="boss-fields">
          <label class="field-group">
            <span class="field-label">Unité boss</span>
            <select v-model="editedBossCode" class="nx-select">
              <option value="">— Aucun —</option>
              <option v-for="u in bossUnits" :key="u.code" :value="u.code">{{ u.name }} ({{ u.code }})</option>
            </select>
          </label>
          <label class="field-group">
            <span class="field-label">Niveau Normal</span>
            <input v-model.number="editedBossLevel" type="number" min="1" max="70" class="nx-input" />
          </label>
          <label class="field-group">
            <span class="field-label">Niveau Hard</span>
            <input v-model.number="editedBossHardLevel" type="number" min="1" max="70" class="nx-input" />
          </label>
          <label class="field-group">
            <span class="field-label">Spé Normal</span>
            <select v-model="editedBossSpec" class="nx-select">
              <option value="">—</option>
              <option value="A">A</option>
              <option value="B">B</option>
            </select>
          </label>
          <label class="field-group">
            <span class="field-label">Spé Hard</span>
            <select v-model="editedBossHardSpec" class="nx-select">
              <option value="">—</option>
              <option value="A">A</option>
              <option value="B">B</option>
            </select>
          </label>
        </div>
      </div>

      <div class="save-row">
        <button type="button" class="nx-btn nx-btn-primary" :disabled="saving" @click="saveStage">
          {{ saving ? 'Sauvegarde…' : 'Sauvegarder' }}
        </button>
      </div>
    </div>

    <p v-else-if="!loading && stages.length === 0" class="admin-hint">Aucun stage trouvé. Exécutez le script apply-generated-campaign.</p>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import api from '../api';

type StageData = {
  chapter: number;
  stage: number;
  is_boss: boolean;
  enemy_template: {
    units?: Array<{
      code: string;
      position?: string;
      level?: number;
      hard_level?: number;
      specialization?: string | null;
      hard_specialization?: string | null;
    }>;
    boss_level?: number;
    boss_hard_level?: number;
    boss_specialization?: string | null;
    boss_hard_specialization?: string | null;
  } | null;
  boss_unit_code: string | null;
};

type UnitOption = { code: string; name: string; attack_type: string };

const loading = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const saveSuccess = ref(false);
const stages = ref<StageData[]>([]);
const units = ref<UnitOption[]>([]);
const selectedChapter = ref(1);
const selectedStage = ref(1);
const unitToAdd = ref('');

const editedUnits = ref<Array<{
  code: string;
  position: string;
  level: number;
  hard_level: number;
  specialization: string | null;
  hard_specialization: string | null;
}>>([]);
const editedBossCode = ref<string | null>(null);
const editedBossLevel = ref(20);
const editedBossHardLevel = ref(40);
const editedBossSpec = ref<string | null>(null);
const editedBossHardSpec = ref<string | null>(null);

const currentStageData = computed(() =>
  stages.value.find((s) => s.chapter === selectedChapter.value && s.stage === selectedStage.value)
);

const availableUnits = computed(() =>
  units.value.filter((u) => !u.code.startsWith('BOSS_CH'))
);

const bossUnits = computed(() =>
  units.value.filter((u) => u.code.startsWith('BOSS_CH'))
);

function getUnitName(code: string): string {
  return units.value.find((u) => u.code === code)?.name ?? code;
}

function buildEditedFromStage(stage: StageData | undefined) {
  if (!stage) {
    editedUnits.value = [];
    editedBossCode.value = null;
    editedBossLevel.value = 20;
    editedBossHardLevel.value = 40;
    editedBossSpec.value = null;
    editedBossHardSpec.value = null;
    return;
  }
  const template = stage.enemy_template;
  const unitList = template?.units ?? [];
  editedUnits.value = unitList.map((u) => ({
    code: u.code ?? '',
    position: u.position === 'back' ? 'back' : 'front',
    level: u.level ?? 20,
    hard_level: u.hard_level ?? u.level ?? 40,
    specialization: u.specialization ?? null,
    hard_specialization: u.hard_specialization ?? null
  }));
  editedBossCode.value = stage.boss_unit_code ?? null;
  editedBossLevel.value = template?.boss_level ?? 20;
  editedBossHardLevel.value = template?.boss_hard_level ?? template?.boss_level ?? 40;
  editedBossSpec.value = template?.boss_specialization ?? null;
  editedBossHardSpec.value = template?.boss_hard_specialization ?? null;
}

function onStageSelect() {
  buildEditedFromStage(currentStageData.value);
}

function addUnit() {
  if (!unitToAdd.value) return;
  editedUnits.value.push({
    code: unitToAdd.value,
    position: 'front',
    level: 20,
    hard_level: 40,
    specialization: null,
    hard_specialization: null
  });
  unitToAdd.value = '';
}

function removeUnit(idx: number) {
  editedUnits.value.splice(idx, 1);
}

async function loadStages() {
  loading.value = true;
  errorMessage.value = '';
  saveSuccess.value = false;
  try {
    const [stagesRes, unitsRes] = await Promise.all([
      api.get<{ stages: StageData[] }>('/admin/campaign-stages'),
      api.get<{ units: Array<{ code: string; name: string; attack_type: string }> }>('/admin/units')
    ]);
    stages.value = stagesRes.data.stages ?? [];
    units.value = (unitsRes.data.units ?? []).map((u) => ({ code: u.code, name: u.name, attack_type: u.attack_type }));
    buildEditedFromStage(currentStageData.value);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur chargement';
  } finally {
    loading.value = false;
  }
}

async function saveStage() {
  if (!currentStageData.value) return;
  saving.value = true;
  errorMessage.value = '';
  saveSuccess.value = false;
  try {
    const template: StageData['enemy_template'] = {
      units: editedUnits.value.map((u) => ({
        code: u.code,
        position: u.position,
        level: u.level,
        hard_level: u.hard_level,
        specialization: u.specialization,
        hard_specialization: u.hard_specialization
      }))
    };
    if (currentStageData.value.is_boss) {
      template.boss_level = editedBossLevel.value;
      template.boss_hard_level = editedBossHardLevel.value;
      template.boss_specialization = editedBossSpec.value || null;
      template.boss_hard_specialization = editedBossHardSpec.value || null;
    }
    await api.put(`/admin/campaign-stages/${selectedChapter.value}/${selectedStage.value}`, {
      enemy_template: template,
      boss_unit_code: currentStageData.value.is_boss ? editedBossCode.value : null
    });
    saveSuccess.value = true;
    const idx = stages.value.findIndex((s) => s.chapter === selectedChapter.value && s.stage === selectedStage.value);
    if (idx >= 0) {
      stages.value[idx] = {
        ...stages.value[idx],
        enemy_template: template,
        boss_unit_code: currentStageData.value.is_boss ? (editedBossCode.value ?? null) : null
      };
    }
    setTimeout(() => { saveSuccess.value = false; }, 3000);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur sauvegarde';
  } finally {
    saving.value = false;
  }
}

watch(currentStageData, (s) => buildEditedFromStage(s), { immediate: true });

onMounted(() => loadStages());
</script>

<style scoped>
.admin-campaign {
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

.admin-hint {
  color: #94a3b8;
  margin: 1rem 0;
}

.campaign-editor {
  padding: 1rem;
  margin-bottom: 1rem;
}

.editor-title {
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
  color: #f8fafc;
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

.boss-section {
  margin-bottom: 1.5rem;
}

.boss-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.save-row {
  margin-top: 1rem;
}
</style>
