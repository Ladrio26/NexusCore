<template>
  <section class="admin-campaign admin-fullwidth">
    <div class="admin-page-header">
      <h1 class="admin-title">Campagne Admin</h1>
      <p class="admin-desc">
        Les stages 1–9 sont régénérés automatiquement chaque mois (RNG). Les boss (stage 10) sont des équipes
        définies ici, mélangées entre chapitres chaque mois. Les spécialisations suivent la matrice officielle ;
        les niveaux des unités ennemies peuvent être surchargés par chapitre / stage dans l’onglet Niveaux (Normal et Difficile).
      </p>
    </div>

    <div class="admin-tabs nx-panel">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: mainTab === 'monthly' }"
        @click="mainTab = 'monthly'"
      >
        Mois & boss
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: mainTab === 'levels' }"
        @click="mainTab = 'levels'"
      >
        Niveaux (matrice)
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: mainTab === 'legacy' }"
        @click="mainTab = 'legacy'"
      >
        Legacy (stages DB)
      </button>
    </div>

    <p v-if="errorMessage" class="admin-error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="admin-success">{{ successMessage }}</p>

    <!-- ——— Onglet mensuel ——— -->
    <div v-show="mainTab === 'monthly'" class="monthly-section">
      <div class="nx-panel monthly-toolbar">
        <label class="toolbar-label">Mois (affectations)</label>
        <input v-model="assignmentMonth" type="text" class="nx-input month-input" placeholder="YYYY-MM" />
        <button type="button" class="nx-btn" :disabled="loading" @click="loadMonthlyData">Actualiser</button>
        <button
          type="button"
          class="nx-btn nx-btn-danger"
          :disabled="regenerating"
          @click="confirmRegenerate"
        >
          {{ regenerating ? 'Régénération…' : 'Régénérer la campagne (mois)' }}
        </button>
      </div>

      <div class="boss-mode-tabs nx-panel">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: bossMode === 'normal' }"
          @click="bossMode = 'normal'; loadBossTab()"
        >
          Boss — Normal
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: bossMode === 'hard' }"
          @click="bossMode = 'hard'; loadBossTab()"
        >
          Boss — Hard
        </button>
      </div>

      <div class="nx-panel assignments-block">
        <h2 class="section-title">Affectations du mois (stage 10)</h2>
        <p class="admin-hint">Mode : {{ bossMode }} — {{ assignmentMonth }}</p>
        <div v-if="assignments.length" class="assignments-grid">
          <div v-for="a in assignments" :key="a.chapter" class="assignment-row nx-card">
            <span class="ch-label">Ch. {{ a.chapter }}</span>
            <span class="team-name">{{ a.team_name }}</span>
            <span class="team-id">#{{ a.boss_team_id }}</span>
          </div>
        </div>
        <p v-else-if="!loading" class="admin-hint">Aucune affectation (régénérez ou attendez la génération auto).</p>
      </div>

      <div class="nx-panel boss-teams-block">
        <div class="boss-teams-header">
          <h2 class="section-title">Équipes boss</h2>
          <button type="button" class="nx-btn nx-btn-primary" :disabled="loading" @click="openCreateModal">
            Nouvelle équipe
          </button>
        </div>
        <div v-if="bossTeams.length" class="boss-teams-list">
          <div v-for="t in bossTeams" :key="t.id" class="boss-team-row nx-card">
            <div class="boss-team-main">
              <span class="team-title">{{ t.name }}</span>
              <span v-if="t.fixed_chapter === 10" class="badge-fixed">Ch.10 fixe</span>
              <span v-if="t.active === false" class="badge-inactive">inactive</span>
              <span class="spec-badge" title="Spécialisation au combat selon matrice">{{ specHint(bossMode) }}</span>
            </div>
            <p class="composition-preview">{{ compositionSummary(t.composition) }}</p>
            <div class="boss-team-actions">
              <button type="button" class="nx-btn nx-btn-small" @click="openEditModal(t)">Éditer</button>
              <button type="button" class="nx-btn nx-btn-small" @click="duplicateTeam(t.id)">Dupliquer</button>
              <button type="button" class="nx-btn nx-btn-small nx-btn-danger" @click="deleteTeam(t.id)">Supprimer</button>
            </div>
          </div>
        </div>
        <p v-else-if="!loading" class="admin-hint">Aucune équipe boss. Créez-en ou importez via migration (seed depuis campaign_stages).</p>
      </div>
    </div>

    <!-- ——— Niveaux par chapitre / stage ——— -->
    <div v-show="mainTab === 'levels'" class="levels-section nx-panel">
      <h2 class="section-title">Niveaux ennemis par chapitre et stage</h2>
      <p class="admin-hint">
        Valeurs utilisées au combat pour chaque cellule. Une case surlignée = surcharge manuelle ; sinon niveau issu de la
        matrice code. Mettre le même nombre que la matrice supprime la surcharge.
      </p>
      <div class="level-mode-toolbar nx-panel">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: levelGridMode === 'normal' }"
          @click="levelGridMode = 'normal'"
        >
          Normal
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: levelGridMode === 'hard' }"
          @click="levelGridMode = 'hard'"
        >
          Difficile
        </button>
        <button type="button" class="nx-btn" :disabled="loadingLevels" @click="loadLevelGrid">Actualiser</button>
        <button
          type="button"
          class="nx-btn nx-btn-danger"
          :disabled="loadingLevels"
          @click="confirmResetAllLevelOverrides"
        >
          Tout réinitialiser (ce mode)
        </button>
      </div>
      <p v-if="loadingLevels" class="admin-hint">Chargement de la grille…</p>
      <div v-else-if="levelLevels && levelIsOverride" class="level-grid-scroll">
        <table class="level-grid-table">
          <thead>
            <tr>
              <th class="level-grid-corner" />
              <th v-for="s in 10" :key="'st-h-' + s" class="level-grid-th-num">St {{ s }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in 10" :key="'ch-row-' + c">
              <th class="level-grid-ch-label">Ch. {{ c }}</th>
              <td v-for="s in 10" :key="'cell-' + c + '-' + s" class="level-grid-td">
                <div
                  class="level-cell"
                  :class="{ 'level-cell--override': levelIsOverride[c - 1][s - 1] }"
                >
                  <input
                    type="number"
                    min="1"
                    max="100"
                    class="nx-input level-cell-input"
                    :value="levelLevels[c - 1][s - 1]"
                    @change="onLevelCellChange(c, s, $event)"
                  />
                  <button
                    v-if="levelIsOverride[c - 1][s - 1]"
                    type="button"
                    class="nx-btn nx-btn-small level-cell-reset"
                    title="Revenir au niveau matrice"
                    @click="resetLevelCell(c, s)"
                  >
                    ↺
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ——— Legacy ——— -->
    <div v-show="mainTab === 'legacy'" class="legacy-section">
      <p class="admin-hint">
        Édition directe des lignes <code>campaign_stages</code> (multiplicateurs, secours si données mensuelles absentes).
      </p>
      <div class="admin-toolbar nx-panel">
        <label class="toolbar-label">Chapitre</label>
        <select v-model.number="selectedChapter" class="nx-select" @change="onStageSelect">
          <option v-for="c in 10" :key="c" :value="c">Chapitre {{ c }}</option>
        </select>
        <label class="toolbar-label">Stage</label>
        <select v-model.number="selectedStage" class="nx-select" @change="onStageSelect">
          <option v-for="s in 10" :key="s" :value="s">Stage {{ s }}{{ s === 10 ? ' (Boss)' : '' }}</option>
        </select>
        <button type="button" class="nx-btn" :disabled="loadingLegacy" @click="loadStages">Actualiser</button>
      </div>

      <div v-if="currentStageData" class="campaign-editor nx-panel">
        <h2 class="editor-title">
          Chapitre {{ selectedChapter }} — Stage {{ selectedStage }}{{ currentStageData.is_boss ? ' (Boss)' : '' }}
        </h2>
        <p class="admin-hint">Les champs niveau/spé ci-dessous sont surtout pour secours ; le jeu utilise la matrice + données mensuelles.</p>
        <div class="units-section">
          <h3 class="section-title">Unités ennemies (template DB)</h3>
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
                <option v-for="u in units" :key="u.code" :value="u.code">{{ u.name }} ({{ u.code }})</option>
              </select>
            </label>
          </div>
        </div>

        <div class="save-row">
          <button type="button" class="nx-btn nx-btn-primary" :disabled="saving" @click="saveStage">
            {{ saving ? 'Sauvegarde…' : 'Sauvegarder (legacy)' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal équipe boss -->
    <div v-if="modalOpen" class="modal-overlay" @click.self="modalOpen = false">
      <div class="modal nx-panel">
        <h3 class="modal-title">{{ editingId ? 'Éditer équipe boss' : 'Nouvelle équipe boss' }}</h3>
        <label class="field-group full">
          <span class="field-label">Nom</span>
          <input v-model="modalName" type="text" class="nx-input full-width" />
        </label>
        <label class="field-group full">
          <span class="field-label">Notes internes</span>
          <input v-model="modalNotes" type="text" class="nx-input full-width" />
        </label>
        <label class="field-group">
          <span class="field-label">Actif</span>
          <input v-model="modalActive" type="checkbox" />
        </label>
        <label class="field-group full fixed-ch10">
          <input v-model="modalFixedCh10" type="checkbox" />
          <span class="field-label">Boss final : toujours chapitre 10 (non mélangé entre les mois)</span>
        </label>
        <h4 class="section-title">Composition</h4>
        <div v-for="(u, idx) in modalUnits" :key="idx" class="modal-unit-row">
          <select v-model="u.code" class="nx-select">
            <option value="">— Unité —</option>
            <option v-for="opt in availableUnits" :key="opt.code" :value="opt.code">{{ opt.name }}</option>
          </select>
          <select v-model="u.position" class="nx-select">
            <option value="front">front</option>
            <option value="back">back</option>
          </select>
          <button type="button" class="nx-btn nx-btn-small nx-btn-danger" @click="modalUnits.splice(idx, 1)">×</button>
        </div>
        <button type="button" class="nx-btn nx-btn-small" @click="modalUnits.push({ code: '', position: 'front' })">
          + Unité
        </button>
        <label class="field-group full">
          <span class="field-label">Unité « boss » de l’équipe</span>
          <select v-model="modalBossCode" class="nx-select full-width">
            <option value="">—</option>
            <option v-for="u in units" :key="u.code" :value="u.code">{{ u.name }} ({{ u.code }})</option>
          </select>
        </label>
        <div class="modal-actions">
          <button type="button" class="nx-btn" @click="modalOpen = false">Annuler</button>
          <button type="button" class="nx-btn nx-btn-primary" :disabled="modalSaving" @click="saveModalTeam">
            {{ modalSaving ? '…' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </div>
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
    units?: Array<{ code: string; position?: string }>;
  } | null;
  boss_unit_code: string | null;
};

type BossTeamRow = {
  id: number;
  name: string;
  active: boolean;
  notes: string | null;
  fixed_chapter?: number | null;
  composition: { units?: Array<{ code: string; position?: string }>; boss_unit_code?: string | null };
};

type AssignmentRow = {
  chapter: number;
  boss_team_id: number;
  team_name: string;
};

const mainTab = ref<'monthly' | 'levels' | 'legacy'>('monthly');
const bossMode = ref<'normal' | 'hard'>('normal');
const loading = ref(false);
const loadingLegacy = ref(false);
const regenerating = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const assignmentMonth = ref(currentMonthKey());
const assignments = ref<AssignmentRow[]>([]);
const bossTeams = ref<BossTeamRow[]>([]);

const stages = ref<StageData[]>([]);
const units = ref<Array<{ code: string; name: string; attack_type: string }>>([]);
const selectedChapter = ref(1);
const selectedStage = ref(1);
const unitToAdd = ref('');
const editedUnits = ref<Array<{ code: string; position: string }>>([]);
const editedBossCode = ref<string | null>(null);

const levelGridMode = ref<'normal' | 'hard'>('normal');
const loadingLevels = ref(false);
const levelLevels = ref<number[][] | null>(null);
const levelIsOverride = ref<boolean[][] | null>(null);

const modalOpen = ref(false);
const modalSaving = ref(false);
const editingId = ref<number | null>(null);
const modalName = ref('');
const modalNotes = ref('');
const modalActive = ref(true);
const modalUnits = ref<Array<{ code: string; position: string }>>([]);
const modalBossCode = ref('');
const modalFixedCh10 = ref(false);

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const currentStageData = computed(() =>
  stages.value.find((s) => s.chapter === selectedChapter.value && s.stage === selectedStage.value)
);

/** Minions d’équipe boss : sans unités BOSS_CH (réservées au rôle boss de chapitre classique). */
const availableUnits = computed(() => units.value.filter((u) => !u.code.startsWith('BOSS_CH')));

function specHint(mode: string) {
  return mode === 'hard' ? 'Hard : spécialisé (A/B)' : 'Normal : selon matrice';
}

function compositionSummary(comp: BossTeamRow['composition']) {
  const u = comp?.units ?? [];
  const b = comp?.boss_unit_code ?? '';
  const parts = u.map((x) => x.code).filter(Boolean);
  return `${parts.join(', ')}${b ? ` | boss: ${b}` : ''}` || '—';
}

function getUnitName(code: string): string {
  return units.value.find((u) => u.code === code)?.name ?? code;
}

async function loadMonthlyData() {
  loading.value = true;
  errorMessage.value = '';
  try {
    await Promise.all([loadBossTeams(), loadAssignments()]);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur chargement';
  } finally {
    loading.value = false;
  }
}

async function loadLevelGrid() {
  loadingLevels.value = true;
  errorMessage.value = '';
  try {
    const res = await api.get<{ levels: number[][]; isOverride: boolean[][] }>(
      `/admin/campaign/stage-levels?mode=${levelGridMode.value}`
    );
    levelLevels.value = res.data.levels ?? null;
    levelIsOverride.value = res.data.isOverride ?? null;
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur chargement des niveaux';
    levelLevels.value = null;
    levelIsOverride.value = null;
  } finally {
    loadingLevels.value = false;
  }
}

async function onLevelCellChange(ch: number, st: number, ev: Event) {
  const input = ev.target as HTMLInputElement;
  let v = parseInt(input.value, 10);
  if (!Number.isFinite(v)) {
    await loadLevelGrid();
    return;
  }
  v = Math.max(1, Math.min(100, Math.round(v)));
  input.value = String(v);
  errorMessage.value = '';
  try {
    const res = await api.put<{ resetToDefault?: boolean }>('/admin/campaign/stage-levels', {
      mode: levelGridMode.value,
      chapter: ch,
      stage: st,
      level: v
    });
    if (levelLevels.value && levelIsOverride.value) {
      levelLevels.value[ch - 1][st - 1] = v;
      levelIsOverride.value[ch - 1][st - 1] = !res.data.resetToDefault;
    }
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur sauvegarde niveau';
    await loadLevelGrid();
  }
}

async function resetLevelCell(ch: number, st: number) {
  errorMessage.value = '';
  try {
    const res = await api.delete<{ defaultLevel: number }>(
      `/admin/campaign/stage-levels?mode=${encodeURIComponent(levelGridMode.value)}&chapter=${ch}&stage=${st}`
    );
    if (levelLevels.value && levelIsOverride.value) {
      levelLevels.value[ch - 1][st - 1] = res.data.defaultLevel;
      levelIsOverride.value[ch - 1][st - 1] = false;
    }
    successMessage.value = 'Revenu à la matrice.';
    setTimeout(() => { successMessage.value = ''; }, 2000);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur';
    await loadLevelGrid();
  }
}

async function confirmResetAllLevelOverrides() {
  const label = levelGridMode.value === 'hard' ? 'Difficile' : 'Normal';
  if (!window.confirm(`Supprimer toutes les surcharges de niveau pour le mode « ${label} » ?`)) {
    return;
  }
  errorMessage.value = '';
  try {
    await api.post('/admin/campaign/stage-levels/reset-all', { mode: levelGridMode.value });
    successMessage.value = 'Toutes les surcharges de ce mode ont été supprimées.';
    await loadLevelGrid();
    setTimeout(() => { successMessage.value = ''; }, 4000);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur réinitialisation';
  }
}

async function loadBossTeams() {
  const res = await api.get<{ teams: BossTeamRow[] }>(`/admin/campaign/boss-teams?mode=${bossMode.value}`);
  bossTeams.value = res.data.teams ?? [];
}

async function loadAssignments() {
  const m = encodeURIComponent(assignmentMonth.value.trim());
  const res = await api.get<{ assignments: AssignmentRow[] }>(
    `/admin/campaign/boss-assignments?mode=${bossMode.value}&month=${m}`
  );
  assignments.value = res.data.assignments ?? [];
}

function loadBossTab() {
  loadMonthlyData();
}

async function confirmRegenerate() {
  if (!window.confirm(`Régénérer toute la campagne pour le mois ${assignmentMonth.value} ? Stages 1–9 reroll, boss mélangés.`)) {
    return;
  }
  regenerating.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await api.post('/admin/campaign/regenerate', { month: assignmentMonth.value.trim() });
    successMessage.value = 'Campagne régénérée.';
    await loadMonthlyData();
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur régénération';
  } finally {
    regenerating.value = false;
    setTimeout(() => { successMessage.value = ''; }, 4000);
  }
}

function openCreateModal() {
  editingId.value = null;
  modalName.value = '';
  modalNotes.value = '';
  modalActive.value = true;
  modalFixedCh10.value = false;
  modalUnits.value = [{ code: '', position: 'front' }];
  modalBossCode.value = '';
  modalOpen.value = true;
}

function openEditModal(t: BossTeamRow) {
  editingId.value = t.id;
  modalName.value = t.name;
  modalNotes.value = t.notes ?? '';
  modalActive.value = t.active !== false;
  modalFixedCh10.value = t.fixed_chapter === 10;
  const u = t.composition?.units ?? [];
  modalUnits.value = u.length ? u.map((x) => ({ code: x.code, position: x.position === 'back' ? 'back' : 'front' })) : [{ code: '', position: 'front' }];
  modalBossCode.value = t.composition?.boss_unit_code ?? '';
  modalOpen.value = true;
}

async function saveModalTeam() {
  const name = modalName.value.trim();
  if (!name) {
    errorMessage.value = 'Nom requis';
    return;
  }
  const unitsClean = modalUnits.value
    .filter((x) => x.code)
    .map((x) => ({ code: x.code, position: x.position === 'back' ? 'back' : 'front' }));
  if (!unitsClean.length) {
    errorMessage.value = 'Au moins une unité';
    return;
  }
  if (!modalBossCode.value) {
    errorMessage.value = 'Unité boss requise';
    return;
  }
  const composition = {
    units: unitsClean,
    boss_unit_code: modalBossCode.value
  };
  modalSaving.value = true;
  errorMessage.value = '';
  try {
    const fcPayload = modalFixedCh10.value ? 10 : null;
    if (editingId.value) {
      await api.put(`/admin/campaign/boss-teams/${editingId.value}`, {
        name,
        notes: modalNotes.value || null,
        active: modalActive.value,
        composition,
        fixed_chapter: fcPayload
      });
    } else {
      await api.post('/admin/campaign/boss-teams', {
        mode: bossMode.value,
        name,
        notes: modalNotes.value || null,
        active: modalActive.value,
        composition,
        fixed_chapter: fcPayload
      });
    }
    modalOpen.value = false;
    successMessage.value = 'Équipe enregistrée.';
    await loadBossTeams();
    setTimeout(() => { successMessage.value = ''; }, 3000);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur sauvegarde';
  } finally {
    modalSaving.value = false;
  }
}

async function duplicateTeam(id: number) {
  try {
    await api.post(`/admin/campaign/boss-teams/${id}/duplicate`);
    successMessage.value = 'Équipe dupliquée.';
    await loadBossTeams();
    setTimeout(() => { successMessage.value = ''; }, 3000);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur';
  }
}

async function deleteTeam(id: number) {
  if (!window.confirm('Supprimer cette équipe boss ?')) return;
  try {
    await api.delete(`/admin/campaign/boss-teams/${id}`);
    await loadBossTeams();
    successMessage.value = 'Supprimé.';
    setTimeout(() => { successMessage.value = ''; }, 3000);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur (référencée par une affectation ?)';
  }
}

function buildEditedFromStage(stage: StageData | undefined) {
  if (!stage) {
    editedUnits.value = [];
    editedBossCode.value = null;
    return;
  }
  const template = stage.enemy_template;
  const unitList = template?.units ?? [];
  editedUnits.value = unitList.map((u) => ({
    code: u.code ?? '',
    position: u.position === 'back' ? 'back' : 'front'
  }));
  editedBossCode.value = stage.boss_unit_code ?? null;
}

function onStageSelect() {
  buildEditedFromStage(currentStageData.value);
}

function addUnit() {
  if (!unitToAdd.value) return;
  editedUnits.value.push({
    code: unitToAdd.value,
    position: 'front'
  });
  unitToAdd.value = '';
}

function removeUnit(idx: number) {
  editedUnits.value.splice(idx, 1);
}

async function loadStages() {
  loadingLegacy.value = true;
  errorMessage.value = '';
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
    loadingLegacy.value = false;
  }
}

async function saveStage() {
  if (!currentStageData.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    const template: Record<string, unknown> = {
      units: editedUnits.value.map((u) => ({
        code: u.code,
        position: u.position
      }))
    };
    await api.put(`/admin/campaign-stages/${selectedChapter.value}/${selectedStage.value}`, {
      enemy_template: template,
      boss_unit_code: currentStageData.value.is_boss ? editedBossCode.value : null
    });
    successMessage.value = 'Sauvegardé (legacy).';
    const idx = stages.value.findIndex((s) => s.chapter === selectedChapter.value && s.stage === selectedStage.value);
    if (idx >= 0) {
      stages.value[idx] = {
        ...stages.value[idx],
        enemy_template: template as StageData['enemy_template'],
        boss_unit_code: currentStageData.value.is_boss ? (editedBossCode.value ?? null) : null
      };
    }
    setTimeout(() => { successMessage.value = ''; }, 3000);
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message ?? 'Erreur sauvegarde';
  } finally {
    saving.value = false;
  }
}

watch(currentStageData, (s) => buildEditedFromStage(s), { immediate: true });

watch(bossMode, () => {
  if (mainTab.value === 'monthly') loadMonthlyData();
});

watch(levelGridMode, () => {
  if (mainTab.value === 'levels') loadLevelGrid();
});

watch(mainTab, (t) => {
  if (t === 'levels') loadLevelGrid();
});

onMounted(() => {
  loadMonthlyData();
  loadStages();
});
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
  max-width: 900px;
  line-height: 1.45;
}

.admin-tabs,
.boss-mode-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
}

.tab-btn {
  padding: 8px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(148, 163, 184, 0.25);
  color: #cbd5e1;
  cursor: pointer;
  font-size: 0.9rem;
}

.tab-btn.active {
  background: rgba(0, 255, 200, 0.12);
  border-color: rgba(0, 255, 200, 0.35);
  color: #67e8f9;
}

.monthly-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
}

.month-input {
  width: 110px;
}

.assignments-block,
.boss-teams-block {
  padding: 1rem;
  margin-bottom: 1rem;
}

.section-title {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: #cbd5e1;
}

.assignments-grid {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.assignment-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
}

.ch-label {
  font-weight: 600;
  color: #94a3b8;
  min-width: 64px;
}

.team-name {
  flex: 1;
  color: #f8fafc;
}

.team-id {
  font-size: 0.8rem;
  color: #64748b;
}

.boss-teams-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.boss-team-row {
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
}

.boss-team-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.team-title {
  font-weight: 600;
  color: #f8fafc;
}

.badge-fixed {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #7dd3fc;
}

.badge-inactive {
  font-size: 0.75rem;
  color: #f87171;
}

.fixed-ch10 {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.fixed-ch10 .field-label {
  flex: 1;
  line-height: 1.35;
}

.spec-badge {
  font-size: 0.75rem;
  color: #64748b;
}

.composition-preview {
  margin: 0.35rem 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

.boss-team-actions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  max-width: 520px;
  width: 100%;
  max-height: 90vh;
  overflow: auto;
  padding: 1.25rem;
}

.modal-title {
  margin: 0 0 1rem 0;
  color: #f8fafc;
}

.modal-unit-row {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 0.35rem;
  align-items: center;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.field-group.full {
  display: block;
  margin-bottom: 0.75rem;
}

.full-width {
  width: 100%;
  box-sizing: border-box;
}

.toolbar-label {
  font-size: 0.85rem;
  color: #94a3b8;
}

.nx-panel {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 12px;
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
  margin: 0.5rem 0;
  font-size: 0.85rem;
}

.admin-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
}

.campaign-editor {
  padding: 1rem;
}

.editor-title {
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
  color: #f8fafc;
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

.nx-card {
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(15, 23, 42, 0.4);
}

.levels-section {
  padding: 1rem;
  margin-bottom: 1rem;
}

.level-mode-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
}

.level-grid-scroll {
  overflow-x: auto;
  margin-top: 0.5rem;
}

.level-grid-table {
  border-collapse: collapse;
  font-size: 0.8rem;
}

.level-grid-th-num,
.level-grid-ch-label {
  padding: 4px 6px;
  text-align: center;
  color: #94a3b8;
  font-weight: 600;
  white-space: nowrap;
}

.level-grid-corner {
  min-width: 48px;
}

.level-grid-td {
  padding: 2px;
  vertical-align: middle;
}

.level-cell {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.level-cell--override {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.35);
}

.level-cell-input {
  width: 52px;
  min-width: 0;
  padding: 4px 6px;
  text-align: center;
}

.level-cell-reset {
  flex-shrink: 0;
  padding: 2px 6px;
}
</style>
