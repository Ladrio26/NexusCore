<template>
  <div class="artifacts-page">
    <section class="artifacts-header nx-panel">
      <div>
        <span class="artifacts-kicker">Forge</span>
        <h1 class="artifacts-title">Artefacts</h1>
        <p class="artifacts-subtitle">
          Sélectionne un artefact précis pour l’améliorer, l’équiper ou le détruire.
        </p>
      </div>
      <div class="artifacts-wallet">
        <span class="wallet-pill gold">🪙 {{ inventory.wallet.gold }}</span>
        <span class="wallet-pill total">Artefacts : {{ totalArtifacts }}</span>
      </div>
    </section>

    <div v-if="feedback" class="artifacts-feedback" :class="feedback.type">
      {{ feedback.message }}
    </div>

    <div class="artifacts-layout">
      <section class="artifact-list nx-panel">
        <div class="panel-heading">
          <div>
            <h2>Inventaire</h2>
            <p>{{ displayedArtifacts.length }} / {{ availableArtifacts.length }} artefact{{ availableArtifacts.length > 1 ? 's' : '' }}</p>
          </div>
          <button type="button" class="nx-btn nx-btn-ghost" @click="loadInventory" :disabled="loading">
            Actualiser
          </button>
        </div>

        <div v-if="availableArtifacts.length" class="artifact-filters">
          <select v-model="statFilter" class="artifact-filter-select">
            <option value="">Toutes les stats</option>
            <option v-for="stat in artifactStatOptions" :key="stat" :value="stat">
              {{ stat }}
            </option>
          </select>
          <select v-model="levelFilter" class="artifact-filter-select">
            <option value="">Tous les niveaux</option>
            <option v-for="level in artifactLevelOptions" :key="level" :value="String(level)">
              Niveau +{{ level }}
            </option>
          </select>
          <select v-model="sortMode" class="artifact-filter-select">
            <option value="level_desc">Tri : niveau décroissant</option>
            <option value="level_asc">Tri : niveau croissant</option>
            <option value="stat_asc">Tri : stat A-Z</option>
            <option value="recent">Tri : plus récents</option>
          </select>
        </div>

        <div v-if="loading" class="artifact-empty">Chargement des artefacts...</div>
        <div v-else-if="!artifacts.length" class="artifact-empty">
          Aucun artefact pour le moment. Gagne des combats pour tenter d’en obtenir.
        </div>
        <div v-else-if="!availableArtifacts.length" class="artifact-empty">
          Tous tes artefacts sont actuellement équipés.
        </div>
        <div v-else-if="!displayedArtifacts.length" class="artifact-empty">
          Aucun artefact ne correspond aux filtres sélectionnés.
        </div>
        <div v-else class="artifact-grid">
          <button
            v-for="artifact in displayedArtifacts"
            :key="artifact.id"
            type="button"
            class="artifact-card"
            :class="{ selected: artifact.id === selectedArtifactId, equipped: artifact.equipped_user_unit_id != null }"
            @click="selectedArtifactId = artifact.id"
          >
            <div class="artifact-card-top">
              <span class="artifact-stat">{{ artifact.statLabel }}</span>
              <span class="artifact-level">+{{ artifact.level }}</span>
            </div>
            <div class="artifact-bonus">{{ artifact.bonus_label }}</div>
            <div class="artifact-meta">
              <span>#{{ artifact.id }}</span>
              <span>{{ artifact.equipped_user_unit_id != null ? 'Équipé' : 'Libre' }}</span>
            </div>
          </button>
        </div>
      </section>

      <section class="artifact-detail nx-panel">
        <div v-if="selectedArtifact" class="detail-card">
          <div class="detail-top">
            <div>
              <span class="detail-kicker">Artefact sélectionné</span>
              <h2>{{ selectedArtifact.statLabel }}</h2>
            </div>
            <span class="detail-level">+{{ selectedArtifact.level }}</span>
          </div>

          <div class="detail-bonus">{{ selectedArtifact.bonus_label }}</div>

          <div class="detail-stats">
            <div><strong>ID :</strong> #{{ selectedArtifact.id }}</div>
            <div><strong>Stat :</strong> {{ selectedArtifact.statLabel }}</div>
            <div><strong>Coût amélioration :</strong> {{ selectedArtifact.upgrade_cost }} Or</div>
            <div><strong>Chance :</strong> {{ selectedArtifact.upgrade_success_chance }}%</div>
            <div><strong>Etat :</strong> {{ selectedArtifact.equipped_user_unit_id != null ? 'Équipé' : 'Non équipé' }}</div>
            <div v-if="selectedArtifact.equipped_user_unit_id != null"><strong>Equipé sur :</strong> {{ selectedArtifactUnitName }}</div>
          </div>

          <div class="detail-actions">
            <button
              type="button"
              class="nx-btn"
              :disabled="actionLoading || inventory.wallet.gold < selectedArtifact.upgrade_cost"
              @click="enhanceSelectedArtifact"
            >
              Améliorer
            </button>
            <button
              type="button"
              class="nx-btn nx-btn-danger"
              :disabled="actionLoading"
              @click="destroySelectedArtifact"
            >
              Détruire (+50 Or)
            </button>
          </div>

          <div
            v-if="artifactDetailFeedback"
            class="artifact-detail-feedback"
            :class="artifactDetailFeedback.type"
          >
            {{ artifactDetailFeedback.message }}
          </div>

          <p class="detail-note">
            Probabilité de réussite actuelle : {{ selectedArtifact.upgrade_success_chance }}%
          </p>
        </div>
        <div v-else class="artifact-empty">
          Sélectionne un artefact pour le voir, l’améliorer, l’équiper ou le détruire.
        </div>
      </section>
    </div>

    <section class="artifact-units nx-panel">
      <div class="panel-heading units-heading">
        <div>
          <h2>Equiper aux unités</h2>
          <p>{{ filteredUnits.length }} / {{ units.length }} unités. Maximum 2 artefacts par unité, jamais deux fois la même statistique.</p>
        </div>
        <input
          v-model.trim="unitSearch"
          type="text"
          class="units-search"
          placeholder="Rechercher une unité"
        />
      </div>

      <div v-if="units.length" class="unit-filters">
        <select v-model="unitRarityFilter" class="artifact-filter-select">
          <option value="">Toutes les raretés</option>
          <option v-for="rarity in unitRarityOptions" :key="rarity" :value="rarity">
            {{ rarityLabel(rarity) }}
          </option>
        </select>
        <select v-model="unitElementFilter" class="artifact-filter-select">
          <option value="">Tous les éléments</option>
          <option v-for="element in unitElementOptions" :key="element" :value="element">
            {{ elementLabel(element) }}
          </option>
        </select>
        <select v-model="unitArtifactStateFilter" class="artifact-filter-select">
          <option value="">Tous les états</option>
          <option value="with_artifacts">Avec artefact</option>
          <option value="without_artifacts">Sans artefact</option>
          <option value="has_slot">A au moins 1 slot libre</option>
          <option value="full">2 artefacts équipés</option>
        </select>
        <select v-model="unitSortMode" class="artifact-filter-select">
          <option value="level_desc">Tri : niveau décroissant</option>
          <option value="level_asc">Tri : niveau croissant</option>
          <option value="name_asc">Tri : nom A-Z</option>
          <option value="rarity_desc">Tri : rareté</option>
        </select>
        <input
          v-model.number="unitMinLevelFilter"
          type="number"
          min="1"
          class="artifact-filter-select unit-level-input"
          placeholder="Niveau min"
        />
        <input
          v-model.number="unitMaxLevelFilter"
          type="number"
          min="1"
          class="artifact-filter-select unit-level-input"
          placeholder="Niveau max"
        />
      </div>

      <div v-if="!filteredUnits.length" class="artifact-empty">
        Aucune unité ne correspond à la recherche.
      </div>
      <div v-else class="unit-grid">
        <article v-for="unit in filteredUnits" :key="unit.user_unit_id" class="unit-card">
          <div class="unit-card-top">
            <img v-if="getUnitImageUrl(unit)" :src="getUnitImageUrl(unit) ?? ''" alt="" class="unit-avatar" />
            <div>
              <h3>{{ unit.name }}</h3>
              <p>Niv. {{ unit.level }} · {{ rarityLabel(unit.rarity) }}</p>
            </div>
          </div>

          <div class="equipped-list">
            <div v-if="!unit.equipped_artifacts.length" class="equipped-empty">Aucun artefact équipé</div>
            <div
              v-for="artifact in unit.equipped_artifacts"
              :key="artifact.id"
              class="equipped-chip"
              :class="{ selected: artifact.id === selectedArtifactId }"
            >
              <button type="button" class="equipped-chip-select" @click="selectedArtifactId = artifact.id">
                {{ artifact.bonus_label }}
              </button>
              <button type="button" class="chip-remove" :disabled="actionLoading" @click="unequipArtifactById(artifact.id)">
                Retirer
              </button>
            </div>
          </div>

          <template v-if="selectedArtifact && (unit.equipped_artifacts || []).length < 2">
            <button
              type="button"
              class="nx-btn nx-btn-secondary equip-button"
              :disabled="actionLoading || !canEquipSelectedArtifact(unit)"
              @click="equipSelectedArtifact(unit.user_unit_id)"
            >
              Equiper {{ selectedArtifact.statLabel }} +{{ selectedArtifact.bonus_value }}
            </button>
            <p v-if="equipBlockReason(unit)" class="equip-hint">
              {{ equipBlockReason(unit) }}
            </p>
          </template>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import api from '../api';
import { getUnitImageUrl } from '../utils/unitImage';

type Artifact = {
  id: number;
  stat_key: string;
  statLabel: string;
  level: number;
  bonus_value: number;
  bonus_label: string;
  upgrade_cost: number;
  upgrade_success_chance: number;
  equipped_user_unit_id?: number | null;
  created_at?: string | null;
};

type ArtifactUnit = {
  user_unit_id: number;
  name: string;
  rarity: string;
  level: number;
  element?: string;
  image_url?: string | null;
  equipped_artifacts: Artifact[];
};

type InventoryPayload = {
  wallet: { gold: number };
  artifacts: Artifact[];
  stacks?: unknown[];
  units: ArtifactUnit[];
};

const inventory = ref<InventoryPayload>({
  wallet: { gold: 0 },
  artifacts: [],
  units: []
});
const loading = ref(false);
const actionLoading = ref(false);
const selectedArtifactId = ref<number | null>(null);
const unitSearch = ref('');
const feedback = ref<{ type: 'success' | 'error'; message: string } | null>(null);
const artifactDetailFeedback = ref<{ type: 'success' | 'error'; message: string } | null>(null);
const statFilter = ref('');
const levelFilter = ref('');
const sortMode = ref<'level_desc' | 'level_asc' | 'stat_asc' | 'recent'>('level_desc');
const unitRarityFilter = ref('');
const unitElementFilter = ref('');
const unitArtifactStateFilter = ref<''
  | 'with_artifacts'
  | 'without_artifacts'
  | 'has_slot'
  | 'full'>('');
const unitSortMode = ref<'level_desc' | 'level_asc' | 'name_asc' | 'rarity_desc'>('level_desc');
const unitMinLevelFilter = ref<number | null>(null);
const unitMaxLevelFilter = ref<number | null>(null);

const artifacts = computed(() => inventory.value.artifacts);
const availableArtifacts = computed(() => artifacts.value.filter((artifact) => artifact.equipped_user_unit_id == null));
const units = computed(() => inventory.value.units);
const totalArtifacts = computed(() => artifacts.value.length);
const selectedArtifact = computed(() => artifacts.value.find((artifact) => artifact.id === selectedArtifactId.value) || null);
const selectedArtifactUnitName = computed(() => {
  if (!selectedArtifact.value?.equipped_user_unit_id) return '';
  const owner = units.value.find((unit) => unit.user_unit_id === selectedArtifact.value?.equipped_user_unit_id);
  return owner ? `${owner.name} (#${owner.user_unit_id})` : `Unité #${selectedArtifact.value.equipped_user_unit_id}`;
});
const unitRarityOptions = computed(() =>
  [...new Set(units.value.map((unit) => String(unit.rarity || '').toLowerCase()).filter(Boolean))]
);
const unitElementOptions = computed(() =>
  [...new Set(units.value.map((unit) => String(unit.element || '').toLowerCase()).filter(Boolean))]
);
const artifactStatOptions = computed(() =>
  [...new Set(availableArtifacts.value.map((artifact) => artifact.statLabel))].sort((a, b) => a.localeCompare(b, 'fr'))
);
const artifactLevelOptions = computed(() =>
  [...new Set(availableArtifacts.value.map((artifact) => artifact.level))].sort((a, b) => a - b)
);
const displayedArtifacts = computed(() => {
  let list = [...availableArtifacts.value];

  if (statFilter.value) {
    list = list.filter((artifact) => artifact.statLabel === statFilter.value);
  }

  if (levelFilter.value !== '') {
    const targetLevel = Number(levelFilter.value);
    list = list.filter((artifact) => artifact.level === targetLevel);
  }

  if (sortMode.value === 'level_asc') {
    list.sort((a, b) => a.level - b.level || a.id - b.id);
  } else if (sortMode.value === 'stat_asc') {
    list.sort((a, b) => a.statLabel.localeCompare(b.statLabel, 'fr') || b.level - a.level || a.id - b.id);
  } else if (sortMode.value === 'recent') {
    list.sort((a, b) => b.id - a.id);
  } else {
    list.sort((a, b) => b.level - a.level || a.id - b.id);
  }

  return list;
});
const filteredUnits = computed(() => {
  const searchTerm = unitSearch.value.trim().toLowerCase();
  let list = [...units.value];

  if (searchTerm) {
    list = list.filter((unit) => unit.name.toLowerCase().includes(searchTerm));
  }
  if (unitRarityFilter.value) {
    list = list.filter((unit) => String(unit.rarity || '').toLowerCase() === unitRarityFilter.value);
  }
  if (unitElementFilter.value) {
    list = list.filter((unit) => String(unit.element || '').toLowerCase() === unitElementFilter.value);
  }
  if (unitArtifactStateFilter.value === 'with_artifacts') {
    list = list.filter((unit) => (unit.equipped_artifacts || []).length > 0);
  } else if (unitArtifactStateFilter.value === 'without_artifacts') {
    list = list.filter((unit) => (unit.equipped_artifacts || []).length === 0);
  } else if (unitArtifactStateFilter.value === 'has_slot') {
    list = list.filter((unit) => (unit.equipped_artifacts || []).length < 2);
  } else if (unitArtifactStateFilter.value === 'full') {
    list = list.filter((unit) => (unit.equipped_artifacts || []).length >= 2);
  }
  if (unitMinLevelFilter.value != null && Number.isFinite(unitMinLevelFilter.value)) {
    list = list.filter((unit) => unit.level >= Number(unitMinLevelFilter.value));
  }
  if (unitMaxLevelFilter.value != null && Number.isFinite(unitMaxLevelFilter.value)) {
    list = list.filter((unit) => unit.level <= Number(unitMaxLevelFilter.value));
  }

  if (unitSortMode.value === 'level_asc') {
    list.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'fr'));
  } else if (unitSortMode.value === 'name_asc') {
    list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  } else if (unitSortMode.value === 'rarity_desc') {
    const rarityRank: Record<string, number> = {
      common: 0,
      uncommon: 1,
      rare: 2,
      epic: 3,
      legendary: 4,
      mythic: 5
    };
    list.sort((a, b) => (rarityRank[String(b.rarity || '').toLowerCase()] ?? -1) - (rarityRank[String(a.rarity || '').toLowerCase()] ?? -1) || b.level - a.level);
  } else {
    list.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'fr'));
  }

  return list;
});

function rarityLabel(rarity: string) {
  const labels: Record<string, string> = {
    common: 'Commun',
    uncommon: 'Peu commune',
    rare: 'Rare',
    epic: 'Epique',
    legendary: 'Legendaire',
    mythic: 'Mythique'
  };
  return labels[String(rarity || '').toLowerCase()] || rarity;
}

function elementLabel(element: string) {
  const labels: Record<string, string> = {
    water: 'Eau',
    fire: 'Feu',
    plant: 'Plante',
    neutral: 'Neutre'
  };
  return labels[String(element || '').toLowerCase()] || element;
}

function updateInventory(data: InventoryPayload) {
  inventory.value = {
    wallet: { gold: Number(data?.wallet?.gold ?? 0) },
    artifacts: Array.isArray(data?.artifacts) ? data.artifacts : [],
    units: Array.isArray(data?.units) ? data.units : []
  };
  const currentAvailableArtifacts = inventory.value.artifacts.filter((artifact) => artifact.equipped_user_unit_id == null);
  if (selectedArtifactId.value == null && currentAvailableArtifacts.length) {
    selectedArtifactId.value = currentAvailableArtifacts[0].id;
  } else if (selectedArtifactId.value == null && inventory.value.artifacts.length) {
    selectedArtifactId.value = inventory.value.artifacts[0].id;
  } else if (
    selectedArtifactId.value != null &&
    !inventory.value.artifacts.some((artifact) => artifact.id === selectedArtifactId.value)
  ) {
    selectedArtifactId.value = currentAvailableArtifacts[0]?.id ?? inventory.value.artifacts[0]?.id ?? null;
  }
  window.dispatchEvent(new CustomEvent('wallet-updated', { detail: inventory.value.wallet }));
}

watch(selectedArtifactId, () => {
  artifactDetailFeedback.value = null;
});

function extractApiError(error: unknown) {
  const apiError = error as { response?: { data?: { error?: string } } };
  const code = apiError?.response?.data?.error || '';
  const map: Record<string, string> = {
    INSUFFICIENT_GOLD: 'Pas assez d’Or pour cette amélioration.',
    ARTIFACT_SLOTS_FULL: 'Cette unité a déjà 2 artefacts équipés.',
    DUPLICATE_ARTIFACT_STAT: 'Cette unité possède déjà un artefact sur cette statistique.',
    USER_UNIT_NOT_FOUND: 'Unité introuvable.',
    ARTIFACT_NOT_EQUIPPED: 'Cet artefact n’est pas équipé.',
    ARTIFACT_NOT_FOUND: 'Artefact introuvable.',
    ARTIFACT_ALREADY_EQUIPPED: 'Cet artefact est déjà équipé.'
  };
  return map[code] || 'Une erreur est survenue.';
}

function canEquipSelectedArtifact(unit: ArtifactUnit) {
  if (!selectedArtifact.value) return false;
  if (selectedArtifact.value.equipped_user_unit_id != null) return false;
  if ((unit.equipped_artifacts || []).length >= 2) return false;
  return !(unit.equipped_artifacts || []).some((artifact) => artifact.stat_key === selectedArtifact.value?.stat_key);
}

function equipBlockReason(unit: ArtifactUnit) {
  if (!selectedArtifact.value) return '';
  if (selectedArtifact.value.equipped_user_unit_id != null) return 'Cet artefact est déjà équipé.';
  if ((unit.equipped_artifacts || []).length >= 2) return 'Cette unité a déjà 2 artefacts équipés.';
  if ((unit.equipped_artifacts || []).some((artifact) => artifact.stat_key === selectedArtifact.value?.stat_key)) {
    return 'Impossible de cumuler deux bonus sur la même statistique.';
  }
  return '';
}

async function loadInventory() {
  loading.value = true;
  feedback.value = null;
  try {
    const { data } = await api.get('/artifacts');
    updateInventory(data);
  } catch {
    feedback.value = { type: 'error', message: 'Impossible de charger les artefacts.' };
  } finally {
    loading.value = false;
  }
}

async function equipSelectedArtifact(userUnitId: number) {
  if (!selectedArtifact.value) return;
  actionLoading.value = true;
  feedback.value = null;
  try {
    const { data } = await api.post('/artifacts/equip', {
      artifact_id: selectedArtifact.value.id,
      user_unit_id: userUnitId
    });
    updateInventory(data);
    feedback.value = { type: 'success', message: 'Artefact équipé.' };
  } catch (error) {
    feedback.value = { type: 'error', message: extractApiError(error) };
  } finally {
    actionLoading.value = false;
  }
}

async function unequipArtifactById(artifactId: number) {
  const confirmed = window.confirm('Retirer cet artefact coute 5000 Or. Confirmer ?');
  if (!confirmed) return;
  actionLoading.value = true;
  feedback.value = null;
  try {
    const { data } = await api.post('/artifacts/unequip', { artifact_id: artifactId });
    updateInventory(data.inventory);
    feedback.value = { type: 'success', message: 'Artefact retiré. 5000 Or dépensés.' };
  } catch (error) {
    feedback.value = { type: 'error', message: extractApiError(error) };
  } finally {
    actionLoading.value = false;
  }
}

async function enhanceSelectedArtifact() {
  if (!selectedArtifact.value) return;
  const artifactId = selectedArtifact.value.id;
  actionLoading.value = true;
  feedback.value = null;
  artifactDetailFeedback.value = null;
  try {
    const { data } = await api.post('/artifacts/enhance', {
      artifact_id: artifactId
    });
    updateInventory(data.inventory);
    selectedArtifactId.value = artifactId;
    artifactDetailFeedback.value = {
      type: data.success ? 'success' : 'error',
      message: data.success
        ? `Amélioration réussie : artefact passé à +${data.new_level}.`
        : `Amélioration ratée. ${data.cost} Or perdu.`
    };
  } catch (error) {
    feedback.value = { type: 'error', message: extractApiError(error) };
  } finally {
    actionLoading.value = false;
  }
}

async function destroySelectedArtifact() {
  if (!selectedArtifact.value) return;
  const artifactId = selectedArtifact.value.id;
  actionLoading.value = true;
  feedback.value = null;
  try {
    const { data } = await api.post('/artifacts/destroy', {
      artifact_id: artifactId
    });
    updateInventory(data.inventory);
    feedback.value = { type: 'success', message: 'Artefact détruit. +50 Or récupérés.' };
  } catch (error) {
    feedback.value = { type: 'error', message: extractApiError(error) };
  } finally {
    actionLoading.value = false;
  }
}

onMounted(() => {
  loadInventory();
});
</script>

<style scoped>
.artifacts-page {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.3rem 0 0.6rem;
}

.artifacts-header,
.artifact-list,
.artifact-detail,
.artifact-units {
  position: relative;
  overflow: hidden;
}

.artifacts-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.artifacts-kicker,
.detail-kicker {
  display: inline-block;
  margin-bottom: 0.15rem;
  color: #facc15;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.65rem;
}

.artifacts-title {
  margin: 0;
  font-size: clamp(1.1rem, 2vw, 1.5rem);
}

.artifacts-subtitle {
  display: none;
}

.artifacts-wallet {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.wallet-pill {
  border-radius: 999px;
  padding: 0.3rem 0.65rem;
  background: rgba(15, 23, 42, 0.58);
  border: 1px solid rgba(148, 163, 184, 0.18);
  font-weight: 700;
  font-size: 0.88rem;
}

.wallet-pill.gold {
  color: #facc15;
}

.artifacts-feedback {
  border-radius: 10px;
  padding: 0.45rem 0.75rem;
  font-weight: 600;
  font-size: 0.9rem;
}

.artifacts-feedback.success {
  background: rgba(20, 83, 45, 0.28);
  border: 1px solid rgba(74, 222, 128, 0.35);
  color: #dcfce7;
}

.artifacts-feedback.error {
  background: rgba(127, 29, 29, 0.26);
  border: 1px solid rgba(248, 113, 113, 0.35);
  color: #fee2e2;
}

.artifacts-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.9fr);
  gap: 0.55rem;
}

.panel-heading {
  display: flex;
  justify-content: space-between;
  gap: 0.65rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.panel-heading h2,
.units-heading h2,
.detail-card h2 {
  margin: 0;
  font-size: 1rem;
}

.panel-heading p,
.units-heading p {
  margin: 0.12rem 0 0;
  font-size: 0.8rem;
  color: rgba(226, 232, 240, 0.72);
}

.artifact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.4rem;
}

.artifact-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.unit-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.artifact-filter-select {
  min-width: 148px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.58);
  color: #f8fafc;
  padding: 0.3rem 0.5rem;
  font-size: 0.85rem;
}

.unit-level-input {
  max-width: 140px;
}

.artifact-card {
  text-align: left;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(15, 23, 42, 0.58);
  padding: 0.38rem 0.5rem;
  color: inherit;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.artifact-card:hover,
.artifact-card.selected {
  transform: translateY(-1px);
  border-color: rgba(250, 204, 21, 0.45);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.18);
}

.artifact-card.equipped {
  border-color: rgba(96, 165, 250, 0.35);
}

.artifact-card-top,
.artifact-meta,
.detail-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.artifact-stat,
.detail-level {
  font-weight: 800;
  color: #f8fafc;
}

.artifact-level {
  color: #facc15;
  font-weight: 700;
  font-size: 0.86rem;
}

.artifact-bonus,
.detail-bonus {
  margin: 0.12rem 0;
  font-size: 0.82rem;
  font-weight: 800;
  color: #facc15;
}

.artifact-meta {
  color: rgba(226, 232, 240, 0.64);
  font-size: 0.78rem;
}

.artifact-empty {
  min-height: 70px;
  display: grid;
  place-items: center;
  text-align: center;
  color: rgba(226, 232, 240, 0.72);
  font-size: 0.88rem;
}

.detail-card {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  height: 100%;
}

.detail-stats {
  display: grid;
  gap: 0.25rem;
  color: rgba(226, 232, 240, 0.88);
  font-size: 0.88rem;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.artifact-detail-feedback {
  border-radius: 8px;
  padding: 0.35rem 0.6rem;
  font-weight: 600;
  font-size: 0.88rem;
}

.artifact-detail-feedback.success {
  background: rgba(20, 83, 45, 0.28);
  border: 1px solid rgba(74, 222, 128, 0.35);
  color: #dcfce7;
}

.artifact-detail-feedback.error {
  background: rgba(127, 29, 29, 0.26);
  border: 1px solid rgba(248, 113, 113, 0.35);
  color: #fee2e2;
}

.detail-note {
  margin: 0;
  color: rgba(226, 232, 240, 0.7);
  font-size: 0.8rem;
}

.units-heading {
  align-items: flex-end;
}

.units-search {
  min-width: 200px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.58);
  color: #f8fafc;
  padding: 0.3rem 0.55rem;
  font-size: 0.85rem;
}

.unit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.55rem;
}

.unit-card {
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.54);
  border: 1px solid rgba(148, 163, 184, 0.16);
  padding: 0.55rem;
}

.unit-card-top {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.unit-card-top h3 {
  margin: 0;
  font-size: 0.9rem;
}

.unit-card-top p {
  margin: 0.1rem 0 0;
  font-size: 0.78rem;
  color: rgba(226, 232, 240, 0.7);
}

.unit-avatar {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  object-fit: cover;
  background: rgba(15, 23, 42, 0.72);
  flex-shrink: 0;
}

.equipped-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0.45rem 0;
}

.equipped-empty {
  color: rgba(226, 232, 240, 0.6);
  font-size: 0.92rem;
}

.equipped-chip {
  display: flex;
  justify-content: space-between;
  gap: 0.45rem;
  align-items: center;
  border-radius: 8px;
  padding: 0.25rem 0.45rem;
  background: rgba(30, 41, 59, 0.66);
  border: 1px solid rgba(148, 163, 184, 0.16);
  font-size: 0.82rem;
}

.equipped-chip.selected {
  border-color: rgba(250, 204, 21, 0.45);
  box-shadow: 0 0 0 1px rgba(250, 204, 21, 0.18) inset;
}

.equipped-chip-select {
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 0;
  cursor: pointer;
  font: inherit;
  flex: 1;
}

.chip-remove {
  border: none;
  background: transparent;
  color: #fda4af;
  cursor: pointer;
  font-weight: 700;
}

.equip-button {
  width: 100%;
  padding: 0.28rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.equip-hint {
  margin: 0.6rem 0 0;
  color: rgba(226, 232, 240, 0.66);
  font-size: 0.9rem;
}

@media (max-width: 980px) {
  .artifacts-layout {
    grid-template-columns: 1fr;
  }

  .artifacts-header,
  .panel-heading,
  .units-heading {
    flex-direction: column;
    align-items: stretch;
  }

  .artifact-filters {
    flex-direction: column;
  }

  .unit-filters {
    flex-direction: column;
  }

  .artifact-filter-select {
    min-width: 0;
    width: 100%;
  }

  .units-search {
    min-width: 0;
    width: 100%;
  }
}
</style>
