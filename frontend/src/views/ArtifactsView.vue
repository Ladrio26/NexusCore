<template>
  <div class="artifacts-app">
    <!-- HEADER FIXE -->
    <header class="artifacts-topbar" :class="{ 'is-mounted': headerMounted }">
      <div class="topbar-inner">
        <h1 class="topbar-title">Artefacts</h1>

        <div class="topbar-filters-wrap">
          <div class="filters-scroll" aria-label="Stats">
            <button
              type="button"
              class="filter-chip"
              :class="{ active: statFilter === '' }"
              @click="statFilter = ''"
            >
              Toutes stats
            </button>
            <button
              v-for="stat in artifactStatOptions.slice(0, 12)"
              :key="stat"
              type="button"
              class="filter-chip"
              :class="{ active: statFilter === stat }"
              @click="statFilter = stat"
            >
              {{ truncateStat(stat, 16) }}
            </button>
            <select
              v-if="artifactStatOptions.length > 12"
              v-model="statFilter"
              class="filter-stat-select"
              aria-label="Autres stats"
            >
              <option value="">+ Stats…</option>
              <option v-for="stat in artifactStatOptions" :key="'opt-' + stat" :value="stat">
                {{ stat }}
              </option>
            </select>
          </div>
          <div class="filters-scroll filters-scroll--sm" aria-label="Niveaux & rareté">
            <button
              type="button"
              class="filter-chip"
              :class="{ active: levelFilter === '' }"
              @click="levelFilter = ''"
            >
              Tous nv.
            </button>
            <button
              v-for="level in artifactLevelOptions"
              :key="'lv-' + level"
              type="button"
              class="filter-chip"
              :class="{ active: levelFilter === String(level) }"
              @click="levelFilter = String(level)"
            >
              +{{ level }}
            </button>
            <span class="filter-sep" aria-hidden="true" />
            <button
              type="button"
              class="filter-chip"
              :class="{ active: rarityFilter === '' }"
              @click="rarityFilter = ''"
            >
              Toutes raretés
            </button>
            <button
              v-for="r in artifactRarityOptions"
              :key="'r-' + r"
              type="button"
              class="filter-chip"
              :class="['rarity-pill', 'r-' + r, { active: rarityFilter === r }]"
              @click="rarityFilter = rarityFilter === r ? '' : r"
            >
              {{ shortRarity(r) }}
            </button>
          </div>
        </div>

        <div class="topbar-right">
          <div class="view-toggle" role="group" aria-label="Affichage">
            <button
              type="button"
              class="view-btn"
              :class="{ active: viewMode === 'grid' }"
              title="Grille"
              @click="viewMode = 'grid'"
            >
              ▦
            </button>
            <button
              type="button"
              class="view-btn"
              :class="{ active: viewMode === 'list' }"
              title="Liste"
              @click="viewMode = 'list'"
            >
              ☰
            </button>
          </div>
          <select v-model="sortMode" class="sort-compact" aria-label="Tri">
            <option value="level_desc">Niveau ↓</option>
            <option value="level_asc">Niveau ↑</option>
            <option value="stat_asc">Stat A-Z</option>
            <option value="recent">Récents</option>
          </select>
          <button type="button" class="btn-reset" @click="resetFilters">Reset</button>
          <span class="pill-gold">🪙 {{ inventory.wallet.gold }}</span>
          <span class="pill-count">{{ totalArtifacts }}</span>
        </div>
      </div>
    </header>

    <div v-if="feedback" class="artifacts-toast" :class="feedback.type">
      {{ feedback.message }}
    </div>

    <!-- ZONE PRINCIPALE 70 / 30 -->
    <div class="artifacts-main">
      <section class="inv-panel nx-panel" :class="{ 'equip-flash': equipFlash }">
        <div class="inv-head">
          <span class="inv-sub">{{ displayedArtifacts.length }} / {{ availableArtifacts.length }} libres</span>
          <button type="button" class="btn-refresh" :disabled="loading" @click="loadInventory">
            ↻
          </button>
        </div>

        <div v-if="loading" class="inv-empty">Chargement…</div>
        <div v-else-if="!artifacts.length" class="inv-empty">Aucun artefact. Gagne des combats ou ouvre la forge.</div>
        <div v-else-if="!availableArtifacts.length" class="inv-empty">Tous tes artefacts sont équipés.</div>
        <div v-else-if="!displayedArtifacts.length" class="inv-empty">Aucun résultat pour ces filtres.</div>

        <!-- GRILLE -->
        <div
          v-else-if="viewMode === 'grid'"
          class="inv-grid"
          :style="{ contentVisibility: displayedArtifacts.length > 60 ? 'auto' : undefined }"
        >
          <button
            v-for="artifact in displayedArtifactsLimited"
            :key="artifact.id"
            type="button"
            class="art-card"
            :class="[
              'art-rarity--' + (artifact.rarity || 'common'),
              { selected: artifact.id === selectedArtifactId, 'is-hover': hoveredArtifactId === artifact.id }
            ]"
            @click="selectArtifact(artifact.id)"
            @mouseenter="hoveredArtifactId = artifact.id"
            @mouseleave="hoveredArtifactId = null"
          >
            <div class="art-card-glow" aria-hidden="true" />
            <span class="art-card-stat">{{ artifactBadgeLabel(artifact.stat_key, artifact.extra_data) }}</span>
            <span class="art-card-lv">+{{ artifact.level }}</span>
            <div v-if="hoveredArtifactId === artifact.id" class="art-card-pop" @click.stop>
              <p class="art-pop-bonus">{{ artifact.bonus_label }}</p>
              <button type="button" class="art-pop-select" @click="selectArtifact(artifact.id)">Sélectionner</button>
            </div>
          </button>
        </div>

        <!-- LISTE -->
        <div v-else class="inv-list">
          <button
            v-for="artifact in displayedArtifactsLimited"
            :key="'l-' + artifact.id"
            type="button"
            class="art-row"
            :class="['art-rarity--' + (artifact.rarity || 'common'), { selected: artifact.id === selectedArtifactId }]"
            @click="selectArtifact(artifact.id)"
          >
            <span class="art-row-stat">{{ artifactBadgeLabel(artifact.stat_key, artifact.extra_data) }}</span>
            <span class="art-row-lv">+{{ artifact.level }}</span>
            <span class="art-row-rarity">{{ artifactRarityLabel(artifact.rarity) }}</span>
          </button>
        </div>

        <button
          v-if="displayedArtifacts.length > visibleLimit"
          type="button"
          class="btn-load-more"
          @click="visibleLimit += 60"
        >
          Charger plus ({{ displayedArtifacts.length - displayedArtifactsLimited.length }} restants)
        </button>
      </section>

      <!-- PANNEAU DÉTAIL -->
      <aside class="detail-panel nx-panel">
        <Transition name="detail-swap" mode="out-in">
          <div v-if="selectedArtifact" :key="selectedArtifact.id" class="detail-inner">
            <div class="detail-visual" :class="'art-rarity--' + (selectedArtifact.rarity || 'common')">
              <div class="detail-visual-ring" />
              <span class="detail-glyph">{{ artifactBadgeLabel(selectedArtifact.stat_key, selectedArtifact.extra_data) }}</span>
            </div>

            <p class="detail-bonus-line">{{ selectedArtifact.bonus_label }}</p>

            <div class="detail-meta-compact">
              <span>Rareté · {{ artifactRarityLabel(selectedArtifact.rarity) }}</span>
              <span>Niveau · +{{ selectedArtifact.level }}</span>
              <span v-if="selectedArtifact.equipped_user_unit_id">{{ selectedArtifactUnitName }}</span>
            </div>

            <div v-if="canSellSelectedArtifact" class="detail-sell-block">
              <button
                type="button"
                class="btn-sell-artifact"
                :disabled="actionLoading"
                @click="sellSelectedArtifact"
              >
                Vendre pour {{ ARTIFACT_SELL_GOLD.toLocaleString('fr-FR') }} or
              </button>
              <p class="detail-sell-hint">Vente définitive — uniquement les artefacts non équipés.</p>
            </div>

            <div v-if="isUpgradableArtifact" class="detail-upgrade-block">
              <p class="detail-cost">
                Coût {{ selectedArtifact.upgrade_cost }} or · {{ selectedArtifact.upgrade_success_chance }}% de réussite
              </p>
              <button
                type="button"
                class="btn-upgrade"
                :class="{ pulse: canAffordUpgrade }"
                :disabled="actionLoading || inventory.wallet.gold < selectedArtifact.upgrade_cost"
                @click="enhanceSelectedArtifact"
              >
                Améliorer
              </button>
            </div>
            <p v-else class="detail-no-up">Amélioration impossible pour cet artefact.</p>

            <div
              v-if="artifactDetailFeedback"
              class="detail-feedback"
              :class="artifactDetailFeedback.type"
            >
              {{ artifactDetailFeedback.message }}
            </div>
          </div>
          <div v-else class="detail-placeholder">
            <p>Sélectionne un artefact dans l’inventaire.</p>
          </div>
        </Transition>
      </aside>
    </div>

    <!-- UNITÉS — REPLIABLE -->
    <section class="units-shell nx-panel">
      <button type="button" class="units-collapse-trigger" @click="unitsExpanded = !unitsExpanded">
        <span>Équiper aux unités</span>
        <span class="chev" :class="{ open: unitsExpanded }">▼</span>
      </button>

      <div v-show="unitsExpanded" class="units-body">
        <div class="units-toolbar">
          <input
            v-model.trim="unitSearch"
            type="search"
            class="units-search-sticky"
            placeholder="Rechercher une unité…"
          />
          <select v-model="unitRarityFilter" class="units-mini-select">
            <option value="">Rareté</option>
            <option v-for="rarity in unitRarityOptions" :key="rarity" :value="rarity">
              {{ rarityLabel(rarity) }}
            </option>
          </select>
          <select v-model="unitElementFilter" class="units-mini-select">
            <option value="">Élément</option>
            <option v-for="element in unitElementOptions" :key="element" :value="element">
              {{ elementLabel(element) }}
            </option>
          </select>
          <select v-model="unitArtifactStateFilter" class="units-mini-select wide">
            <option value="">État artefacts</option>
            <option value="with_artifacts">Avec artefact</option>
            <option value="without_artifacts">Sans artefact</option>
            <option value="has_slot">Slot libre</option>
            <option value="full">2/2</option>
          </select>
          <select v-model="unitSortMode" class="units-mini-select">
            <option value="level_desc">Niveau ↓</option>
            <option value="level_asc">Niveau ↑</option>
            <option value="name_asc">Nom A-Z</option>
            <option value="rarity_desc">Rareté</option>
          </select>
          <input
            v-model.number="unitMinLevelFilter"
            type="number"
            min="1"
            class="units-lv-in"
            placeholder="Nv min"
          />
          <input
            v-model.number="unitMaxLevelFilter"
            type="number"
            min="1"
            class="units-lv-in"
            placeholder="Nv max"
          />
        </div>

        <div v-if="!filteredUnits.length" class="inv-empty">Aucune unité.</div>
        <div v-else class="units-scroll">
          <div class="units-grid">
            <article
              v-for="unit in filteredUnits"
              :key="unit.user_unit_id"
              class="uu-card"
              :class="{ 'uu-hover': hoveredUnitId === unit.user_unit_id }"
              @mouseenter="hoveredUnitId = unit.user_unit_id"
              @mouseleave="hoveredUnitId = null"
            >
              <div class="uu-top">
                <img v-if="getUnitImageUrl(unit)" :src="getUnitImageUrl(unit) ?? ''" alt="" class="uu-av" />
                <div class="uu-text">
                  <h3>{{ unit.name }}</h3>
                  <p>Nv. {{ unit.level }}</p>
                </div>
              </div>
              <div class="uu-art-icons">
                <button
                  v-for="a in unit.equipped_artifacts"
                  :key="a.id"
                  type="button"
                  class="uu-art-ico"
                  :class="{ on: a.id === selectedArtifactId }"
                  :title="a.bonus_label"
                  @click="selectedArtifactId = a.id"
                >
                  {{ artifactBadgeLabel(a.stat_key, a.extra_data) }}
                </button>
                <span v-for="n in 2 - unit.equipped_artifacts.length" :key="'empty-' + n" class="uu-slot-empty" />
              </div>
              <button
                v-if="selectedArtifact && (unit.equipped_artifacts || []).length < 2"
                type="button"
                class="uu-equip"
                :disabled="actionLoading || !canEquipSelectedArtifact(unit)"
                @click="equipSelectedArtifact(unit.user_unit_id)"
              >
                Équiper
              </button>
              <p v-if="equipBlockReason(unit) && hoveredUnitId === unit.user_unit_id" class="uu-hint">
                {{ equipBlockReason(unit) }}
              </p>
              <div v-if="unit.equipped_artifacts.length" class="uu-manage">
                <button
                  v-for="a in unit.equipped_artifacts"
                  :key="'rm-' + a.id"
                  type="button"
                  class="uu-unequip"
                  :disabled="actionLoading"
                  @click="unequipArtifactById(a.id)"
                >
                  Retirer
                </button>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import api from '../api';
import { artifactBadgeLabel } from '../utils/artifactDisplay';
import { getUnitImageUrl } from '../utils/unitImage';

/** Aligné sur le backend (ARTIFACT_SELL_GOLD). */
const ARTIFACT_SELL_GOLD = 2000;
/** Aligné sur le backend (ARTIFACT_UNEQUIP_GOLD). */
const ARTIFACT_UNEQUIP_GOLD = 500;

const TRAIT_ARTIFACT_TO_TRAIT: Record<string, string> = {
  trait_arcanist: 'ARCANISTS',
  trait_berserker: 'BERSERKERS',
  trait_executioner: 'EXECUTIONERS',
  trait_druid: 'DRUIDS',
  trait_guardian: 'GUARDIANS',
  trait_tactician: 'TACTICIANS'
};

type Artifact = {
  id: number;
  stat_key: string;
  statLabel: string;
  level: number;
  rarity?: string;
  bonus_value: number;
  bonus_label: string;
  upgrade_cost: number;
  upgrade_success_chance: number;
  is_upgradable?: boolean;
  equipped_user_unit_id?: number | null;
  created_at?: string | null;
  extra_data?: unknown | null;
};

type ArtifactUnit = {
  user_unit_id: number;
  name: string;
  rarity: string;
  level: number;
  element?: string;
  image_url?: string | null;
  traits?: string[];
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
const rarityFilter = ref('');
const sortMode = ref<'level_desc' | 'level_asc' | 'stat_asc' | 'recent'>('level_desc');
const unitRarityFilter = ref('');
const unitElementFilter = ref('');
const unitArtifactStateFilter = ref<
  '' | 'with_artifacts' | 'without_artifacts' | 'has_slot' | 'full'
>('');
const unitSortMode = ref<'level_desc' | 'level_asc' | 'name_asc' | 'rarity_desc'>('level_desc');
const unitMinLevelFilter = ref<number | null>(null);
const unitMaxLevelFilter = ref<number | null>(null);

const viewMode = ref<'grid' | 'list'>('grid');
const unitsExpanded = ref(false);
const hoveredArtifactId = ref<number | null>(null);
const hoveredUnitId = ref<number | null>(null);
const headerMounted = ref(false);
const equipFlash = ref(false);
const visibleLimit = ref(120);

const artifacts = computed(() => inventory.value.artifacts);
const availableArtifacts = computed(() => artifacts.value.filter((a) => a.equipped_user_unit_id == null));
const units = computed(() => inventory.value.units);
const totalArtifacts = computed(() => artifacts.value.length);
const selectedArtifact = computed(
  () => artifacts.value.find((a) => a.id === selectedArtifactId.value) || null
);
const canAffordUpgrade = computed(
  () =>
    !!selectedArtifact.value &&
    selectedArtifact.value.is_upgradable === true &&
    inventory.value.wallet.gold >= (selectedArtifact.value.upgrade_cost ?? 0)
);

const selectedArtifactUnitName = computed(() => {
  if (!selectedArtifact.value?.equipped_user_unit_id) return '';
  const owner = units.value.find((u) => u.user_unit_id === selectedArtifact.value?.equipped_user_unit_id);
  return owner ? `${owner.name}` : '';
});

const isUpgradableArtifact = computed(() => selectedArtifact.value?.is_upgradable === true);

const canSellSelectedArtifact = computed(
  () =>
    !!selectedArtifact.value &&
    selectedArtifact.value.equipped_user_unit_id == null
);

const unitRarityOptions = computed(() =>
  [...new Set(units.value.map((u) => String(u.rarity || '').toLowerCase()).filter(Boolean))]
);
const unitElementOptions = computed(() =>
  [...new Set(units.value.map((u) => String(u.element || '').toLowerCase()).filter(Boolean))]
);

const artifactStatOptions = computed(() =>
  [...new Set(availableArtifacts.value.map((a) => a.statLabel))].sort((a, b) => a.localeCompare(b, 'fr'))
);

const artifactLevelOptions = computed(() =>
  [...new Set(availableArtifacts.value.map((a) => a.level))].sort((a, b) => a - b)
);

const artifactRarityOptions = computed(() => {
  const set = new Set<string>();
  for (const a of availableArtifacts.value) {
    set.add(String(a.rarity || 'common').toLowerCase());
  }
  return [...set].sort();
});

const displayedArtifacts = computed(() => {
  let list = [...availableArtifacts.value];

  if (statFilter.value) {
    list = list.filter((a) => a.statLabel === statFilter.value);
  }
  if (levelFilter.value !== '') {
    const targetLevel = Number(levelFilter.value);
    list = list.filter((a) => a.level === targetLevel);
  }
  if (rarityFilter.value) {
    list = list.filter((a) => String(a.rarity || 'common').toLowerCase() === rarityFilter.value);
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

const displayedArtifactsLimited = computed(() => displayedArtifacts.value.slice(0, visibleLimit.value));

watch([statFilter, levelFilter, rarityFilter, sortMode], () => {
  visibleLimit.value = 120;
});

const filteredUnits = computed(() => {
  const searchTerm = unitSearch.value.trim().toLowerCase();
  let list = [...units.value];

  if (searchTerm) {
    list = list.filter((u) => u.name.toLowerCase().includes(searchTerm));
  }
  if (unitRarityFilter.value) {
    list = list.filter((u) => String(u.rarity || '').toLowerCase() === unitRarityFilter.value);
  }
  if (unitElementFilter.value) {
    list = list.filter((u) => String(u.element || '').toLowerCase() === unitElementFilter.value);
  }
  if (unitArtifactStateFilter.value === 'with_artifacts') {
    list = list.filter((u) => (u.equipped_artifacts || []).length > 0);
  } else if (unitArtifactStateFilter.value === 'without_artifacts') {
    list = list.filter((u) => (u.equipped_artifacts || []).length === 0);
  } else if (unitArtifactStateFilter.value === 'has_slot') {
    list = list.filter((u) => (u.equipped_artifacts || []).length < 2);
  } else if (unitArtifactStateFilter.value === 'full') {
    list = list.filter((u) => (u.equipped_artifacts || []).length >= 2);
  }
  if (unitMinLevelFilter.value != null && Number.isFinite(unitMinLevelFilter.value)) {
    list = list.filter((u) => u.level >= Number(unitMinLevelFilter.value));
  }
  if (unitMaxLevelFilter.value != null && Number.isFinite(unitMaxLevelFilter.value)) {
    list = list.filter((u) => u.level <= Number(unitMaxLevelFilter.value));
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
    list.sort(
      (a, b) =>
        (rarityRank[String(b.rarity || '').toLowerCase()] ?? -1) -
          (rarityRank[String(a.rarity || '').toLowerCase()] ?? -1) || b.level - a.level
    );
  } else {
    list.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'fr'));
  }

  return list;
});

function truncateStat(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function shortRarity(r: string) {
  const m: Record<string, string> = {
    common: 'C',
    uncommon: 'PC',
    rare: 'R',
    epic: 'E',
    legendary: 'L',
    mythic: 'M'
  };
  return m[r] || r.slice(0, 2).toUpperCase();
}

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

function artifactRarityLabel(rarity?: string) {
  const labels: Record<string, string> = {
    common: 'Commun',
    uncommon: 'Peu commun',
    rare: 'Rare',
    epic: 'Epique',
    legendary: 'Légendaire',
    mythic: 'Mythique'
  };
  const k = String(rarity || 'common').toLowerCase();
  return labels[k] || rarity || 'Commun';
}

function elementLabel(element: string) {
  const labels: Record<string, string> = {
    water: 'Eau',
    fire: 'Feu',
    plant: 'Plante',
    neutral: 'Neutre',
    light: 'Lumière',
    dark: 'Ténèbres'
  };
  return labels[String(element || '').toLowerCase()] || element;
}

function resetFilters() {
  statFilter.value = '';
  levelFilter.value = '';
  rarityFilter.value = '';
  sortMode.value = 'level_desc';
}

function selectArtifact(id: number) {
  selectedArtifactId.value = id;
}

function updateInventory(data: InventoryPayload) {
  inventory.value = {
    wallet: { gold: Number(data?.wallet?.gold ?? 0) },
    artifacts: Array.isArray(data?.artifacts) ? data.artifacts : [],
    units: Array.isArray(data?.units) ? data.units : []
  };
  const free = inventory.value.artifacts.filter((a) => a.equipped_user_unit_id == null);
  if (selectedArtifactId.value == null && free.length) {
    selectedArtifactId.value = free[0].id;
  } else if (selectedArtifactId.value == null && inventory.value.artifacts.length) {
    selectedArtifactId.value = inventory.value.artifacts[0].id;
  } else if (
    selectedArtifactId.value != null &&
    !inventory.value.artifacts.some((a) => a.id === selectedArtifactId.value)
  ) {
    selectedArtifactId.value = free[0]?.id ?? inventory.value.artifacts[0]?.id ?? null;
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
    ARTIFACT_ALREADY_EQUIPPED: 'Cet artefact est déjà équipé.',
    ARTIFACT_CANNOT_EQUIP_ON_TRAIT: 'Ne peut pas être équipé sur une unité qui possède déjà ce trait.',
    ARTIFACT_NOT_UPGRADABLE: 'Cet artefact ne peut pas être amélioré.',
    ARTIFACT_EQUIPPED: 'Retire l’artefact de l’unité avant de le vendre.'
  };
  return map[code] || 'Une erreur est survenue.';
}

function canEquipSelectedArtifact(unit: ArtifactUnit) {
  if (!selectedArtifact.value) return false;
  if (selectedArtifact.value.equipped_user_unit_id != null) return false;
  if ((unit.equipped_artifacts || []).length >= 2) return false;
  if ((unit.equipped_artifacts || []).some((a) => a.stat_key === selectedArtifact.value?.stat_key)) return false;
  const sk = selectedArtifact.value.stat_key;
  if (sk.startsWith('trait_')) {
    const trait = TRAIT_ARTIFACT_TO_TRAIT[sk];
    const unitTraits = (unit.traits || []).map((t) => String(t).toUpperCase());
    if (trait && unitTraits.includes(trait.toUpperCase())) return false;
  }
  return true;
}

function equipBlockReason(unit: ArtifactUnit) {
  if (!selectedArtifact.value) return '';
  if (selectedArtifact.value.equipped_user_unit_id != null) return 'Déjà équipé.';
  if ((unit.equipped_artifacts || []).length >= 2) return '2/2 artefacts.';
  if ((unit.equipped_artifacts || []).some((a) => a.stat_key === selectedArtifact.value?.stat_key)) {
    return 'Stat déjà couverte.';
  }
  const sk = selectedArtifact.value.stat_key;
  if (sk.startsWith('trait_')) {
    const trait = TRAIT_ARTIFACT_TO_TRAIT[sk];
    const unitTraits = (unit.traits || []).map((t) => String(t).toUpperCase());
    if (trait && unitTraits.includes(trait.toUpperCase())) {
      const labels: Record<string, string> = {
        ARCANISTS: 'Arcaniste',
        BERSERKERS: 'Berserker',
        EXECUTIONERS: 'Bourreau',
        DRUIDS: 'Druide',
        GUARDIANS: 'Gardien',
        TACTICIANS: 'Tacticien'
      };
      return `Incompatible (${labels[trait] || trait}).`;
    }
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
    equipFlash.value = true;
    setTimeout(() => {
      equipFlash.value = false;
    }, 650);
  } catch (error) {
    feedback.value = { type: 'error', message: extractApiError(error) };
  } finally {
    actionLoading.value = false;
  }
}

async function unequipArtifactById(artifactId: number) {
  const confirmed = window.confirm(
    `Retirer cet artefact coûte ${ARTIFACT_UNEQUIP_GOLD.toLocaleString('fr-FR')} or. Confirmer ?`
  );
  if (!confirmed) return;
  actionLoading.value = true;
  feedback.value = null;
  try {
    const { data } = await api.post('/artifacts/unequip', { artifact_id: artifactId });
    updateInventory(data.inventory);
    feedback.value = { type: 'success', message: 'Artefact retiré.' };
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
        ? `Réussi : +${data.new_level}.`
        : `Échec — ${data.cost} or perdus.`
    };
  } catch (error) {
    feedback.value = { type: 'error', message: extractApiError(error) };
  } finally {
    actionLoading.value = false;
  }
}

async function sellSelectedArtifact() {
  if (!selectedArtifact.value) return;
  const id = selectedArtifact.value.id;
  const confirmed = window.confirm(
    `Vendre cet artefact pour ${ARTIFACT_SELL_GOLD.toLocaleString('fr-FR')} or ? Cette action est définitive.`
  );
  if (!confirmed) return;
  actionLoading.value = true;
  feedback.value = null;
  artifactDetailFeedback.value = null;
  try {
    const { data } = await api.post('/artifacts/destroy', { artifact_id: id });
    const gained = Number(data?.gold_gained ?? ARTIFACT_SELL_GOLD);
    updateInventory(data.inventory);
    feedback.value = {
      type: 'success',
      message: `Artefact vendu : +${gained.toLocaleString('fr-FR')} or.`
    };
  } catch (error) {
    feedback.value = { type: 'error', message: extractApiError(error) };
  } finally {
    actionLoading.value = false;
  }
}

onMounted(() => {
  loadInventory();
  nextTick(() => {
    requestAnimationFrame(() => {
      headerMounted.value = true;
    });
  });
});
</script>

<style scoped>
/* ——— Tokens ——— */
.artifacts-app {
  --art-bg: rgba(7, 11, 18, 0.92);
  --art-glass: rgba(15, 23, 42, 0.55);
  --art-border: rgba(148, 163, 184, 0.14);
  --r-common: #94a3b8;
  --r-uncommon: #38bdf8;
  --r-rare: #3b82f6;
  --r-epic: #a855f7;
  --r-legendary: #fb923c;
  --r-mythic: #ef4444;
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 0.75rem 1.5rem;
  min-height: calc(100vh - 4rem);
}

/* HEADER */
.artifacts-topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  min-height: 70px;
  margin: 0 -0.75rem 0.75rem;
  padding: 0.45rem 0.85rem;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.72));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--art-border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  opacity: 0;
  transform: translateY(-12px);
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}
.artifacts-topbar.is-mounted {
  opacity: 1;
  transform: translateY(0);
}

.topbar-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  max-width: 1440px;
  margin: 0 auto;
}

.topbar-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #e2e8f0;
  min-width: 6rem;
}

.topbar-filters-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.filters-scroll {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.35rem;
  overflow-x: auto;
  padding-bottom: 0.15rem;
  scrollbar-width: thin;
}
.filters-scroll--sm {
  opacity: 0.95;
}

.filter-sep {
  width: 1px;
  height: 18px;
  background: rgba(148, 163, 184, 0.28);
  flex-shrink: 0;
}

.filter-stat-select {
  flex-shrink: 0;
  min-width: 108px;
  max-width: 200px;
  border-radius: 999px;
  border: 1px solid var(--art-border);
  background: rgba(15, 23, 42, 0.85);
  color: #e2e8f0;
  font-size: 0.7rem;
  padding: 0.25rem 0.45rem;
}

.filter-chip {
  border: 1px solid var(--art-border);
  background: var(--art-glass);
  color: #cbd5e1;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.28rem 0.55rem;
  border-radius: 999px;
  cursor: pointer;
  transition:
    background 0.2s,
    border-color 0.2s,
    transform 0.15s;
}
.filter-chip:hover {
  transform: scale(1.04);
  border-color: rgba(56, 189, 248, 0.35);
}
.filter-chip.active {
  background: rgba(56, 189, 248, 0.2);
  border-color: rgba(56, 189, 248, 0.55);
  color: #f0f9ff;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.15);
}
.filter-chip.more {
  opacity: 0.75;
  cursor: default;
}

.rarity-pill.r-common.active {
  border-color: var(--r-common);
}
.rarity-pill.r-uncommon.active {
  border-color: var(--r-uncommon);
}
.rarity-pill.r-rare.active {
  border-color: var(--r-rare);
}
.rarity-pill.r-epic.active {
  border-color: var(--r-epic);
}
.rarity-pill.r-legendary.active {
  border-color: var(--r-legendary);
}
.rarity-pill.r-mythic.active {
  border-color: var(--r-mythic);
}

.topbar-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}

.view-toggle {
  display: inline-flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--art-border);
}
.view-btn {
  width: 34px;
  height: 30px;
  border: none;
  background: rgba(15, 23, 42, 0.6);
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.95rem;
}
.view-btn.active {
  background: rgba(56, 189, 248, 0.25);
  color: #e0f2fe;
}

.sort-compact {
  border-radius: 8px;
  border: 1px solid var(--art-border);
  background: rgba(15, 23, 42, 0.75);
  color: #e2e8f0;
  font-size: 0.72rem;
  padding: 0.25rem 0.4rem;
  max-width: 110px;
}

.btn-reset {
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.7rem;
  text-decoration: underline;
  cursor: pointer;
}
.btn-reset:hover {
  color: #94a3b8;
}

.pill-gold,
.pill-count {
  border-radius: 999px;
  padding: 0.25rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  border: 1px solid var(--art-border);
  background: rgba(15, 23, 42, 0.65);
}
.pill-gold {
  color: #fde047;
}
.pill-count {
  color: #bae6fd;
}

.artifacts-toast {
  margin: 0 0 0.5rem;
  padding: 0.45rem 0.75rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.88rem;
}
.artifacts-toast.success {
  background: rgba(20, 83, 45, 0.35);
  border: 1px solid rgba(74, 222, 128, 0.35);
  color: #dcfce7;
}
.artifacts-toast.error {
  background: rgba(127, 29, 29, 0.35);
  border: 1px solid rgba(248, 113, 113, 0.35);
  color: #fee2e2;
}

/* MAIN 70/30 */
.artifacts-main {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(260px, 3fr);
  gap: 1rem;
  align-items: start;
}

.inv-panel {
  padding: 0.75rem 0.85rem 1rem;
  border-radius: 14px;
  background: linear-gradient(165deg, rgba(15, 23, 42, 0.5), rgba(7, 11, 18, 0.65));
  transition: box-shadow 0.35s ease;
}
.inv-panel.equip-flash {
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.45), 0 0 28px rgba(34, 197, 94, 0.25);
}

.inv-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.65rem;
}
.inv-sub {
  font-size: 0.78rem;
  color: #94a3b8;
}
.btn-refresh {
  border: 1px solid var(--art-border);
  background: rgba(15, 23, 42, 0.5);
  color: #cbd5e1;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
}
.btn-refresh:disabled {
  opacity: 0.5;
}

.inv-empty {
  min-height: 120px;
  display: grid;
  place-items: center;
  color: #94a3b8;
  font-size: 0.9rem;
  text-align: center;
  padding: 1rem;
}

/* GRID CARDS */
.inv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 0.55rem;
}

@media (min-width: 1200px) {
  .inv-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

.art-card {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  border: 1px solid var(--art-border);
  background: rgba(15, 23, 42, 0.55);
  cursor: pointer;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  overflow: hidden;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s;
}
.art-card:hover,
.art-card.is-hover {
  transform: scale(1.05);
  z-index: 2;
}
.art-card.selected {
  border-color: rgba(250, 204, 21, 0.65);
  box-shadow: 0 0 20px rgba(250, 204, 21, 0.2);
}

.art-card-glow {
  position: absolute;
  inset: 0;
  opacity: 0.15;
  pointer-events: none;
}

.art-rarity--common .art-card-glow {
  background: radial-gradient(circle at 50% 30%, var(--r-common), transparent 70%);
}
.art-rarity--uncommon .art-card-glow {
  background: radial-gradient(circle at 50% 30%, var(--r-uncommon), transparent 70%);
}
.art-rarity--rare .art-card-glow {
  background: radial-gradient(circle at 50% 30%, var(--r-rare), transparent 70%);
}
.art-rarity--epic .art-card-glow {
  background: radial-gradient(circle at 50% 30%, var(--r-epic), transparent 70%);
}
.art-rarity--legendary .art-card-glow {
  background: radial-gradient(circle at 50% 30%, var(--r-legendary), transparent 70%);
}
.art-rarity--mythic .art-card-glow {
  background: radial-gradient(circle at 50% 30%, var(--r-mythic), transparent 70%);
}

.art-rarity--common {
  border-color: rgba(148, 163, 184, 0.35);
}
.art-rarity--uncommon {
  border-color: rgba(56, 189, 248, 0.45);
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.12);
}
.art-rarity--rare {
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 0 16px rgba(59, 130, 246, 0.18);
}
.art-rarity--epic {
  border-color: rgba(168, 85, 247, 0.55);
  box-shadow: 0 0 18px rgba(168, 85, 247, 0.22);
}
.art-rarity--legendary {
  border-color: rgba(251, 146, 60, 0.55);
  box-shadow: 0 0 20px rgba(251, 146, 60, 0.2);
}
.art-rarity--mythic {
  border-color: rgba(239, 68, 68, 0.55);
  box-shadow: 0 0 22px rgba(239, 68, 68, 0.25);
}

.art-card-stat {
  position: relative;
  z-index: 1;
  font-size: clamp(0.58rem, 2.4vw, 0.72rem);
  font-weight: 800;
  color: #e2e8f0;
  text-align: center;
  line-height: 1.2;
  max-width: 100%;
  padding: 0 4px;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.45);
  word-break: break-word;
  hyphens: auto;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.art-card-lv {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 0.62rem;
  font-weight: 800;
  color: #fef08a;
  background: rgba(0, 0, 0, 0.35);
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
  z-index: 2;
}

.art-card-pop {
  position: absolute;
  inset: 0;
  background: rgba(7, 11, 18, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.35rem;
  z-index: 5;
  animation: popin 0.18s ease;
}
@keyframes popin {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.art-pop-bonus {
  margin: 0;
  font-size: 0.62rem;
  color: #fde047;
  text-align: center;
  line-height: 1.25;
}
.art-pop-select {
  font-size: 0.65rem;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  border: 1px solid rgba(56, 189, 248, 0.45);
  background: rgba(56, 189, 248, 0.2);
  color: #e0f2fe;
  cursor: pointer;
}

/* LIST */
.inv-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  max-height: min(62vh, 720px);
  overflow-y: auto;
  padding-right: 4px;
}
.art-row {
  display: grid;
  grid-template-columns: 1fr 48px 72px;
  gap: 0.5rem;
  align-items: center;
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  border: 1px solid var(--art-border);
  background: rgba(15, 23, 42, 0.45);
  color: inherit;
  cursor: pointer;
  text-align: left;
  font-size: 0.8rem;
  transition: background 0.15s;
}
.art-row:hover {
  background: rgba(30, 41, 59, 0.65);
}
.art-row.selected {
  border-color: rgba(250, 204, 21, 0.55);
  box-shadow: 0 0 12px rgba(250, 204, 21, 0.12);
}
.art-row-stat {
  color: #f1f5f9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.art-row-lv {
  font-weight: 700;
  color: #fde047;
  text-align: right;
}
.art-row-rarity {
  font-size: 0.68rem;
  color: #94a3b8;
  text-align: right;
}

.btn-load-more {
  margin-top: 0.65rem;
  width: 100%;
  padding: 0.45rem;
  border-radius: 10px;
  border: 1px dashed var(--art-border);
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.82rem;
}
.btn-load-more:hover {
  border-color: rgba(56, 189, 248, 0.35);
  color: #e2e8f0;
}

/* DETAIL */
.detail-panel {
  position: sticky;
  top: 78px;
  padding: 1rem 1rem 1.25rem;
  border-radius: 16px;
  background: linear-gradient(160deg, rgba(30, 27, 45, 0.65), rgba(15, 23, 42, 0.85));
  border: 1px solid rgba(148, 163, 184, 0.18);
  min-height: 320px;
  align-self: start;
}

.detail-inner {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.detail-visual {
  position: relative;
  width: 100%;
  aspect-ratio: 1.1;
  max-height: 200px;
  margin: 0 auto;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: rgba(2, 6, 23, 0.55);
  border: 1px solid var(--art-border);
  transition: box-shadow 0.25s ease;
}
.detail-visual.art-rarity--common {
  box-shadow: 0 0 20px rgba(148, 163, 184, 0.08);
}
.detail-visual.art-rarity--uncommon {
  box-shadow: 0 0 24px rgba(56, 189, 248, 0.2);
  border-color: rgba(56, 189, 248, 0.35);
}
.detail-visual.art-rarity--rare {
  box-shadow: 0 0 26px rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.4);
}
.detail-visual.art-rarity--epic {
  box-shadow: 0 0 28px rgba(168, 85, 247, 0.28);
  border-color: rgba(168, 85, 247, 0.45);
}
.detail-visual.art-rarity--legendary {
  box-shadow: 0 0 30px rgba(251, 146, 60, 0.28);
  border-color: rgba(251, 146, 60, 0.45);
}
.detail-visual.art-rarity--mythic {
  box-shadow: 0 0 32px rgba(239, 68, 68, 0.32);
  border-color: rgba(239, 68, 68, 0.5);
}
.detail-visual-ring {
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.08);
  opacity: 0.6;
}
.detail-glyph {
  font-size: clamp(1.25rem, 4.5vw, 2.75rem);
  font-weight: 900;
  color: #fff;
  text-shadow: 0 0 40px rgba(255, 255, 255, 0.25);
  z-index: 1;
  text-align: center;
  line-height: 1.15;
  padding: 0 0.35rem;
  max-width: 95%;
  word-break: break-word;
}

.detail-bonus-line {
  margin: 0;
  text-align: center;
  font-size: 0.95rem;
  font-weight: 700;
  color: #fde047;
}

.detail-meta-compact {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #94a3b8;
}

.detail-upgrade-block {
  margin-top: 0.25rem;
}
.detail-cost {
  margin: 0 0 0.5rem;
  font-size: 0.78rem;
  color: #cbd5e1;
}
.btn-upgrade {
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: 12px;
  border: none;
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  background: linear-gradient(180deg, #facc15, #ca8a04);
  color: #0f172a;
  box-shadow: 0 4px 20px rgba(250, 204, 21, 0.35);
}
.btn-upgrade:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn-upgrade.pulse {
  animation: pulseGlow 2s ease-in-out infinite;
}
@keyframes pulseGlow {
  0%,
  100% {
    box-shadow: 0 4px 20px rgba(250, 204, 21, 0.35);
  }
  50% {
    box-shadow: 0 4px 28px rgba(250, 204, 21, 0.6);
  }
}

.detail-no-up {
  margin: 0;
  font-size: 0.8rem;
  color: #64748b;
}

.detail-sell-block {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.15);
}

.btn-sell-artifact {
  width: 100%;
  padding: 0.55rem 0.85rem;
  border-radius: 10px;
  border: 1px solid rgba(251, 191, 36, 0.45);
  font-weight: 700;
  font-size: 0.88rem;
  cursor: pointer;
  background: rgba(251, 191, 36, 0.12);
  color: #fcd34d;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.btn-sell-artifact:hover:not(:disabled) {
  background: rgba(251, 191, 36, 0.22);
  border-color: rgba(251, 191, 36, 0.65);
}
.btn-sell-artifact:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.detail-sell-hint {
  margin: 0.4rem 0 0 0;
  font-size: 0.72rem;
  color: #64748b;
  line-height: 1.35;
}

.detail-feedback {
  margin-top: 0.35rem;
  padding: 0.4rem 0.55rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
}
.detail-feedback.success {
  background: rgba(20, 83, 45, 0.35);
  border: 1px solid rgba(74, 222, 128, 0.35);
  color: #dcfce7;
}
.detail-feedback.error {
  background: rgba(127, 29, 29, 0.35);
  border: 1px solid rgba(248, 113, 113, 0.35);
  color: #fee2e2;
}

.detail-placeholder {
  min-height: 220px;
  display: grid;
  place-items: center;
  color: #64748b;
  font-size: 0.9rem;
  text-align: center;
  padding: 1rem;
}

.detail-swap-enter-active,
.detail-swap-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}
.detail-swap-enter-from {
  opacity: 0;
  transform: translateX(10px);
}
.detail-swap-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

/* UNITS */
.units-shell {
  margin-top: 1rem;
  padding: 0;
  overflow: hidden;
  border-radius: 14px;
}

.units-collapse-trigger {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.65rem 1rem;
  border: none;
  background: rgba(15, 23, 42, 0.45);
  color: #e2e8f0;
  font-weight: 700;
  font-size: 0.92rem;
  cursor: pointer;
  border-bottom: 1px solid var(--art-border);
}
.chev {
  transition: transform 0.2s;
  font-size: 0.75rem;
  opacity: 0.8;
}
.chev.open {
  transform: rotate(-180deg);
}

.units-body {
  padding: 0.65rem 0.85rem 1rem;
  background: rgba(7, 11, 18, 0.35);
}

.units-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.65rem;
  padding-bottom: 0.35rem;
  background: linear-gradient(180deg, rgba(7, 11, 18, 0.95), transparent);
}

.units-search-sticky {
  flex: 1;
  min-width: 160px;
  border-radius: 10px;
  border: 1px solid var(--art-border);
  background: rgba(15, 23, 42, 0.75);
  color: #f1f5f9;
  padding: 0.4rem 0.65rem;
  font-size: 0.85rem;
}

.units-mini-select {
  border-radius: 8px;
  border: 1px solid var(--art-border);
  background: rgba(15, 23, 42, 0.75);
  color: #e2e8f0;
  font-size: 0.72rem;
  padding: 0.3rem 0.4rem;
  max-width: 120px;
}
.units-mini-select.wide {
  max-width: 140px;
}

.units-lv-in {
  width: 72px;
  border-radius: 8px;
  border: 1px solid var(--art-border);
  background: rgba(15, 23, 42, 0.75);
  color: #e2e8f0;
  font-size: 0.75rem;
  padding: 0.3rem 0.35rem;
}

.units-scroll {
  max-height: min(45vh, 480px);
  overflow-y: auto;
  padding-right: 4px;
}

.units-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.55rem;
}

.uu-card {
  position: relative;
  border-radius: 12px;
  border: 1px solid var(--art-border);
  background: rgba(15, 23, 42, 0.5);
  padding: 0.55rem 0.6rem;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.uu-card.uu-hover {
  border-color: rgba(56, 189, 248, 0.25);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.uu-top {
  display: flex;
  gap: 0.45rem;
  align-items: center;
}
.uu-av {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  object-fit: cover;
  background: rgba(2, 6, 23, 0.6);
}
.uu-text h3 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: #f1f5f9;
}
.uu-text p {
  margin: 0.1rem 0 0;
  font-size: 0.72rem;
  color: #94a3b8;
}

.uu-art-icons {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.45rem;
  min-height: 28px;
  align-items: center;
}
.uu-art-ico {
  min-width: 30px;
  width: auto;
  height: 28px;
  padding: 2px 4px;
  border-radius: 8px;
  border: 1px solid var(--art-border);
  background: rgba(2, 6, 23, 0.55);
  color: #e2e8f0;
  font-size: 0.58rem;
  font-weight: 800;
  cursor: pointer;
  line-height: 1.05;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  letter-spacing: 0.02em;
}
.uu-art-ico.on {
  border-color: rgba(250, 204, 21, 0.55);
  box-shadow: 0 0 10px rgba(250, 204, 21, 0.2);
}
.uu-slot-empty {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px dashed rgba(148, 163, 184, 0.25);
  opacity: 0.5;
}

.uu-equip {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 0.2rem 0.45rem;
  font-size: 0.68rem;
  font-weight: 700;
  border-radius: 6px;
  border: 1px solid rgba(56, 189, 248, 0.45);
  background: rgba(56, 189, 248, 0.2);
  color: #e0f2fe;
  cursor: pointer;
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.uu-card:hover .uu-equip:not(:disabled) {
  opacity: 1;
  transform: translateY(0);
}

.uu-hint {
  margin: 0.25rem 0 0;
  font-size: 0.65rem;
  color: #f87171;
  line-height: 1.2;
}

.uu-manage {
  margin-top: 0.35rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.uu-unequip {
  font-size: 0.62rem;
  padding: 0.15rem 0.35rem;
  border-radius: 6px;
  border: 1px solid rgba(248, 113, 113, 0.35);
  background: transparent;
  color: #fecaca;
  cursor: pointer;
}

@media (max-width: 1024px) {
  .artifacts-main {
    grid-template-columns: 1fr;
  }
  .detail-panel {
    position: relative;
    top: 0;
  }
}

@media (max-width: 768px) {
  .topbar-inner {
    flex-direction: column;
    align-items: stretch;
  }
  .topbar-right {
    margin-left: 0;
    justify-content: flex-start;
  }
  .inv-grid {
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  }
}
</style>
