<template>
  <section class="dungeon-view">
    <div
      class="dungeon-page-bg"
      :style="dungeonBackgroundStyle"
      aria-hidden="true"
    />
    <div class="dungeon-content nx-panel">
    <p
      v-if="isLightOrDarkDungeon"
      class="dungeon-coming-soon-banner"
      role="status"
    >
      Donjon encore inaccessible, disponible très prochainement
    </p>
    <div class="dungeon-header">
      <h1 class="nx-title">Donjon</h1>
      <div class="dungeon-rewards-info" :key="selectedElement">
        <button
          type="button"
          class="dungeon-prob-toggle nx-btn"
          :aria-expanded="probabilitiesOpen"
          aria-controls="dungeon-probabilities-panel"
          @click="probabilitiesOpen = !probabilitiesOpen"
        >
          Probabilités
          <span class="dungeon-prob-chevron" :class="{ open: probabilitiesOpen }" aria-hidden="true">▼</span>
        </button>
        <div
          v-show="probabilitiesOpen"
          id="dungeon-probabilities-panel"
          class="dungeon-probabilities-panel"
        >
          <p class="dungeon-rewards-kicker">Probabilité de récompense artefact :</p>
          <ul class="dungeon-rewards-prob">
            <li v-for="row in artifactProbRows" :key="row.lv">Niveau {{ row.lv }} : {{ row.pct }}%</li>
          </ul>
          <p class="dungeon-rewards-gold">
            Récompense supplémentaire (100&nbsp;%) pour chaque niveau terminé : <strong>Or = Niveau réussi × 25</strong>.
          </p>
        </div>
        <p class="dungeon-rewards-element">{{ rewardTextForSelectedDungeon }}</p>
      </div>
    </div>

    <div v-if="status && activeRunBanner" class="dungeon-active-run">
      <strong>Série en cours :</strong>
      {{ elementLabel(activeRunBanner.element) }}, niveau {{ activeRunBanner.level }} —
      prochain combat : {{ (activeRunBanner.combats_cleared ?? 0) + 1 }}/3
      <button type="button" class="nx-btn nx-btn-sm" @click="continueSeries">Continuer</button>
      <button type="button" class="nx-btn nx-btn-sm ghost" @click="abandonSeries">Abandonner</button>
    </div>

    <div class="dungeon-elements">
      <button
        v-for="el in status?.elements ?? elements"
        :key="el"
        type="button"
        class="element-tab"
        :class="{ active: selectedElement === el }"
        @click="selectedElement = el"
      >
        {{ elementLabel(el) }}
      </button>
    </div>

    <div class="dungeon-preset">
      <label v-if="presets.length">Preset d’équipe</label>
      <select v-if="presets.length" v-model.number="selectedPresetIndex" class="dungeon-select">
        <option v-for="p in presets" :key="p.preset_index" :value="p.preset_index">
          {{ p.preset_name || 'Preset ' + p.preset_index }}
        </option>
      </select>
      <p v-else class="dungeon-hint">
        Crée un preset dans <router-link to="/team-builder">Mes équipes</router-link>.
      </p>
    </div>

    <div class="dungeon-levels">
      <div v-for="lv in 10" :key="lv" class="level-row">
        <div class="level-label">Niveau {{ lv }}</div>
        <div class="level-actions">
          <template v-if="lv > maxUnlockedForSelected">
            <span class="locked">🔒 Verrouillé</span>
          </template>
          <template v-else>
            <button
              type="button"
              class="nx-btn nx-glow-blue"
              :disabled="loading || !canLaunchCombat1(lv)"
              @click="launchCombat1(lv)"
            >
              Lancer la série (3 combats)
            </button>
            <span v-if="encounterMissing" class="mini-hint">En attente de configuration des ennemis</span>
          </template>
        </div>
      </div>
    </div>

    <p v-if="error" class="dungeon-error">{{ error }}</p>
    </div>

    <StageModal
      v-if="modalOpen && pendingPayload"
      :key="modalKey"
      :show="modalOpen"
      :chapter="1"
      :stage="1"
      mode="normal"
      :stage-info="{ stage: 1, isBoss: false, cleared: false, rewardClaimed: false, available: true }"
      :campaign-team="dungeonTeam"
      :pending-battle="pendingPayload"
      dungeon-mode
      :dungeon-initial-auto-mode="dungeonCombatAutoMode"
      @close="onModalClose"
      @dungeon-combat-next="onDungeonCombatNext"
      @dungeon-replay="onDungeonReplay"
      @battle-finalized="onBattleFinalized"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import api from '../api';
import StageModal from './StageModal.vue';

type DungeonStatus = {
  elements: string[];
  progress: Record<string, number>;
  activeRun: { element: string; level: number; combats_cleared: number } | null;
  maxLevel: number;
  combatsPerLevel: number;
};

type PresetRow = { preset_index: number; preset_name: string | null; front_slots: number[]; back_slots: number[] };

/** Dernier preset d’équipe choisi sur la page Donjon (persiste navigation / rechargement). */
const DUNGEON_PRESET_STORAGE_KEY = 'nexus-dungeon-last-preset-index';

function readStoredDungeonPresetIndex(): number | null {
  try {
    const raw = localStorage.getItem(DUNGEON_PRESET_STORAGE_KEY);
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

const elements = ['fire', 'water', 'plant', 'light', 'dark'];
const ELEMENT_LABELS: Record<string, string> = {
  fire: 'Feu',
  water: 'Eau',
  plant: 'Plante',
  light: 'Lumière',
  dark: 'Ténèbres'
};

/** Affichage (aligné sur les règles serveur `grantDungeonLevelCompleteRewards`). */
const ARTIFACT_DROP_PERCENT_BY_LEVEL = [5, 10, 15, 25, 35, 45, 55, 65, 75, 100];

const artifactProbRows = ARTIFACT_DROP_PERCENT_BY_LEVEL.map((pct, i) => ({
  lv: i + 1,
  pct
}));

const DUNGEON_REWARD_LINES: Record<string, string> = {
  fire:
    'Récompenses Donjon Feu : un artefact parmi : ATQ+10, ou un artefact qui donne une double stat dont l’attaque, ou un artefact Rare (n’importe lequel).',
  water:
    'Récompenses Donjon Eau : un artefact parmi : DEF+10, ou un artefact qui donne une double stat dont la défense, ou un artefact Rare (n’importe lequel).',
  plant:
    'Récompenses Donjon Plante : un artefact parmi : PV Max+50, ou un artefact qui donne une double stat dont les PV Max, ou un artefact Rare (n’importe lequel).',
  light:
    'Récompenses Donjon Lumière : un artefact parmi : VITESSE+10, ou un artefact qui donne une double stat dont la vitesse, ou un artefact Rare (n’importe lequel).',
  dark:
    'Récompenses Donjon Ténèbres : un artefact parmi : Maîtrise+10, ou un artefact qui donne une double stat dont la maîtrise, ou un artefact Rare (n’importe lequel).'
};

const rewardTextForSelectedDungeon = computed(
  () => DUNGEON_REWARD_LINES[selectedElement.value] ?? DUNGEON_REWARD_LINES.fire
);

/** Donjon Ténèbres : contenu / rencontres pas encore prêts — message en tête de panneau. */
const isLightOrDarkDungeon = computed(() => selectedElement.value === 'dark');

/** Fonds (copiés depuis /images vers public/images/dungeon/) — même principe que la campagne. */
const DUNGEON_BACKGROUNDS: Record<string, string> = {
  fire: '/images/dungeon/DonjonFeu.png',
  water: '/images/dungeon/DonjonEau.png',
  plant: '/images/dungeon/DonjonPlante.png',
  light: '/images/dungeon/DonjonLumière.png',
  dark: '/images/dungeon/DonjonTenebres.png'
};

const dungeonBackgroundStyle = computed(() => {
  const imageUrl = DUNGEON_BACKGROUNDS[selectedElement.value];
  if (!imageUrl) return {};
  const safeUrl = encodeURI(imageUrl);
  return {
    backgroundImage: `linear-gradient(180deg, rgba(2, 6, 23, 0.18) 0%, rgba(2, 6, 23, 0.5) 100%), url("${safeUrl}")`
  };
});

const status = ref<DungeonStatus | null>(null);
const selectedElement = ref('fire');
/** Panneau probabilités / or : masqué par défaut. */
const probabilitiesOpen = ref(false);
const presets = ref<PresetRow[]>([]);
const selectedPresetIndex = ref<number | null>(null);
const loading = ref(false);
const error = ref('');
const modalOpen = ref(false);
const modalKey = ref(0);
const pendingPayload = ref<Record<string, unknown> | null>(null);
const dungeonTeam = ref<Array<{ user_unit_id: number; position: 'front' | 'back' }>>([]);
const lastStartBody = ref<Record<string, unknown> | null>(null);
/** Mémorise Auto/Manuel entre les combats d’une même série (Combat suivant). */
const dungeonCombatAutoMode = ref(false);
const encounterMissing = ref(false);

function elementLabel(el: string) {
  return ELEMENT_LABELS[el] ?? el;
}

const maxUnlockedForSelected = computed(() => {
  const p = status.value?.progress?.[selectedElement.value];
  return p != null ? Math.min(10, Math.max(1, Number(p))) : 1;
});

const activeRunBanner = computed(() => status.value?.activeRun ?? null);

function presetToTeam(p: PresetRow | null) {
  if (!p) return [];
  const front = (p.front_slots || []).map((id) => ({ user_unit_id: id, position: 'front' as const }));
  const back = (p.back_slots || []).map((id) => ({ user_unit_id: id, position: 'back' as const }));
  return [...front, ...back];
}

const currentTeam = computed(() => {
  const p = presets.value.find((x) => x.preset_index === selectedPresetIndex.value) ?? null;
  return presetToTeam(p);
});

function canLaunchCombat1(level: number) {
  if (currentTeam.value.length === 0) return false;
  const run = status.value?.activeRun;
  if (!run) return true;
  if (run.element === selectedElement.value && run.level === level && (run.combats_cleared ?? 0) > 0) {
    return false;
  }
  return true;
}

async function refreshStatus() {
  const { data } = await api.get('/dungeon/status');
  status.value = data as DungeonStatus;
}

async function loadPresets() {
  try {
    const { data } = await api.get('/team/presets');
    const list = (data?.presets || []) as PresetRow[];
    presets.value = list.filter((p) => (p.front_slots?.length || 0) + (p.back_slots?.length || 0) > 0);
    if (presets.value.length === 0) {
      selectedPresetIndex.value = null;
      return;
    }
    const stored = readStoredDungeonPresetIndex();
    const hasStored = stored != null && presets.value.some((p) => p.preset_index === stored);
    selectedPresetIndex.value = hasStored && stored != null ? stored : presets.value[0].preset_index;
  } catch {
    presets.value = [];
  }
}

watch(selectedPresetIndex, (v) => {
  if (v == null || !Number.isInteger(v)) return;
  try {
    localStorage.setItem(DUNGEON_PRESET_STORAGE_KEY, String(v));
  } catch {
    /* quota / mode privé */
  }
});

async function launchCombat1(level: number) {
  error.value = '';
  encounterMissing.value = false;
  const p = presets.value.find((x) => x.preset_index === selectedPresetIndex.value);
  const team = presetToTeam(p ?? null);
  if (team.length === 0) {
    error.value = 'Choisis un preset avec au moins une unité.';
    return;
  }
  const selectedNoyauIndex = Number((p as { selected_noyau_index?: number })?.selected_noyau_index ?? 0) || 0;
  loading.value = true;
  try {
    const body = {
      element: selectedElement.value,
      level,
      team,
      selected_noyau_index: selectedNoyauIndex
    };
    const { data } = await api.post('/dungeon/start', body);
    if (!data?.pendingBattle) throw new Error('Pas de combat en attente');
    lastStartBody.value = body;
    dungeonCombatAutoMode.value = false;
    dungeonTeam.value = team;
    pendingPayload.value = data.pendingBattle as Record<string, unknown>;
    modalKey.value++;
    modalOpen.value = true;
    await refreshStatus();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string; error?: string } } };
    const msg = err?.response?.data?.message || err?.response?.data?.error || (e as Error)?.message || 'Erreur';
    if (String(err?.response?.data?.error || '').includes('ENCOUNTER_NOT_CONFIGURED')) {
      encounterMissing.value = true;
    }
    error.value = msg;
  } finally {
    loading.value = false;
  }
}

async function continueSeries() {
  error.value = '';
  loading.value = true;
  try {
    if (lastStartBody.value && Array.isArray(lastStartBody.value.team)) {
      dungeonTeam.value = lastStartBody.value.team as Array<{ user_unit_id: number; position: 'front' | 'back' }>;
    }
    const { data } = await api.post('/dungeon/continue');
    if (!data?.pendingBattle) throw new Error('Impossible de continuer');
    dungeonTeam.value = currentTeam.value;
    pendingPayload.value = data.pendingBattle as Record<string, unknown>;
    modalKey.value++;
    modalOpen.value = true;
    await refreshStatus();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    error.value = err?.response?.data?.message || (e as Error).message || 'Erreur';
  } finally {
    loading.value = false;
  }
}

async function abandonSeries() {
  try {
    await api.post('/battle/abandon');
  } catch { /* ignore */ }
  await refreshStatus();
}

async function onDungeonCombatNext(payload?: { autoMode?: boolean }) {
  if (payload && typeof payload.autoMode === 'boolean') {
    dungeonCombatAutoMode.value = payload.autoMode;
  }
  modalOpen.value = false;
  pendingPayload.value = null;
  if (lastStartBody.value && Array.isArray(lastStartBody.value.team)) {
    dungeonTeam.value = lastStartBody.value.team as Array<{ user_unit_id: number; position: 'front' | 'back' }>;
  }
  await continueSeries();
}

async function onDungeonReplay(payload?: { autoMode?: boolean }) {
  if (!lastStartBody.value) return;
  if (payload && typeof payload.autoMode === 'boolean') {
    dungeonCombatAutoMode.value = payload.autoMode;
  }
  modalOpen.value = false;
  pendingPayload.value = null;
  loading.value = true;
  try {
    const { data } = await api.post('/dungeon/start', lastStartBody.value);
    if (data?.pendingBattle) {
      const bodyTeam = lastStartBody.value.team;
      dungeonTeam.value = Array.isArray(bodyTeam)
        ? (bodyTeam as Array<{ user_unit_id: number; position: 'front' | 'back' }>)
        : presetToTeam(presets.value.find((x) => x.preset_index === selectedPresetIndex.value) ?? null);
      pendingPayload.value = data.pendingBattle as Record<string, unknown>;
      modalKey.value++;
      modalOpen.value = true;
    }
    await refreshStatus();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    error.value = err?.response?.data?.message || (e as Error).message || 'Erreur';
  } finally {
    loading.value = false;
  }
}

function onBattleFinalized(payload?: Record<string, unknown>) {
  void refreshStatus();
  const d = payload?.dungeonFirstClearRewards;
  if (d && typeof d === 'object' && d !== null && 'level' in d) {
    window.dispatchEvent(new CustomEvent('dungeon-first-clear', { detail: d }));
  }
}

async function onModalClose() {
  modalOpen.value = false;
  pendingPayload.value = null;
  try {
    await api.post('/battle/abandon');
  } catch { /* ignore */ }
  await refreshStatus();
}

onMounted(async () => {
  await loadPresets();
  try {
    await refreshStatus();
  } catch {
    error.value = 'Impossible de charger le donjon.';
  }
});
</script>

<style scoped>
.dungeon-view {
  position: relative;
  min-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
  padding: 1.5rem 0;
  z-index: 0;
}

/* Même logique que .campaign-page-bg (fond + overlay ; l’image du donjon vient du :style). */
.dungeon-page-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background:
    linear-gradient(180deg, rgba(2, 6, 23, 0.22) 0%, rgba(2, 6, 23, 0.62) 100%),
    radial-gradient(circle at 50% 20%, rgba(15, 23, 42, 0.08), rgba(2, 6, 23, 0.72) 78%);
  background-position: center top;
  background-repeat: no-repeat;
  background-size: cover;
  filter: saturate(1.02) contrast(1.04);
  pointer-events: none;
}

.dungeon-content {
  position: relative;
  z-index: 1;
  max-width: 920px;
  width: 100%;
  margin: 0 auto;
  padding: 1.25rem 1rem 2rem;
}

.dungeon-coming-soon-banner {
  margin: 0 0 1rem 0;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  text-align: center;
  font-size: 0.95rem;
  font-weight: 600;
  color: #fef3c7;
  background: rgba(180, 83, 9, 0.35);
  border: 1px solid rgba(251, 191, 36, 0.45);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.12);
}

/* Panneau plus transparent pour laisser apparaître le fond (tout en gardant la lisibilité). */
.dungeon-content.nx-panel {
  background: linear-gradient(
    145deg,
    rgba(15, 34, 61, 0.42),
    rgba(19, 40, 68, 0.36)
  ) !important;
  box-shadow:
    0 0 22px rgba(0, 229, 255, 0.06),
    inset 0 0 18px rgba(0, 0, 0, 0.22) !important;
  /* Annule le blur du .nx-panel global pour garder le fond net derrière le panneau. */
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.dungeon-content.nx-panel:hover {
  box-shadow:
    0 0 28px rgba(0, 229, 255, 0.1),
    inset 0 0 18px rgba(0, 0, 0, 0.22) !important;
}
.dungeon-header {
  margin-bottom: 1rem;
}
.dungeon-rewards-info {
  margin-top: 0.5rem;
  color: #cbd5e1;
  font-size: 0.88rem;
  line-height: 1.45;
}
.dungeon-prob-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
  font-size: 0.88rem;
}
.dungeon-prob-chevron {
  display: inline-block;
  font-size: 0.65rem;
  transition: transform 0.2s ease;
  opacity: 0.85;
}
.dungeon-prob-chevron.open {
  transform: rotate(-180deg);
}
.dungeon-probabilities-panel {
  margin-bottom: 0.65rem;
}
.dungeon-rewards-kicker {
  margin: 0 0 0.35rem 0;
  font-weight: 600;
  color: #e2e8f0;
}
.dungeon-rewards-prob {
  margin: 0 0 0.6rem 0;
  padding-left: 1.1rem;
  color: #94a3b8;
  font-size: 0.85rem;
}
.dungeon-rewards-prob li {
  margin: 0.1rem 0;
}
.dungeon-rewards-gold {
  margin: 0 0 0.65rem 0;
  color: #fcd34d;
  font-size: 0.88rem;
}
.dungeon-rewards-element {
  margin: 0;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #e2e8f0;
}
.dungeon-active-run {
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.35);
  margin-bottom: 1rem;
  font-size: 0.9rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.dungeon-elements {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 1rem;
}
.element-tab {
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.6);
  color: #e2e8f0;
  cursor: pointer;
  font-size: 0.85rem;
}
.element-tab.active {
  border-color: rgba(56, 189, 248, 0.7);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25) inset;
}
.dungeon-preset {
  margin-bottom: 1rem;
}
.dungeon-preset label {
  display: block;
  font-size: 0.8rem;
  color: #94a3b8;
  margin-bottom: 0.25rem;
}
.dungeon-select {
  max-width: 320px;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  background: #0f172a;
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.35);
}
.dungeon-hint {
  font-size: 0.9rem;
  color: #94a3b8;
}
.dungeon-levels {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.level-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.28);
  border: 1px solid rgba(51, 65, 85, 0.45);
}
.level-label {
  font-weight: 600;
  min-width: 88px;
}
.level-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.locked {
  color: #64748b;
  font-size: 0.9rem;
}
.mini-hint {
  font-size: 0.75rem;
  color: #94a3b8;
}
.dungeon-error {
  color: #fca5a5;
  margin-top: 0.75rem;
  font-size: 0.9rem;
}
.nx-btn.ghost {
  background: transparent;
  border-color: rgba(148, 163, 184, 0.45);
}
</style>
