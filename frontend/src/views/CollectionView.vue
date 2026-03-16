<template>
  <section class="collection page-content">
    <div class="collection-header">
      <h1 class="page-title nx-title">
        {{ collectionTitle }}
        <span class="page-title-count">
          — {{ totalUnits }} unité<span v-if="totalUnits > 1">s</span>
        </span>
      </h1>
      <div class="collection-toolbar">
        <label class="collection-sort-label">Afficher les unités</label>
        <select v-model="collectionSortMode" class="collection-sort-select nexus-input">
          <option value="rarity">Par rareté</option>
          <option value="level">Par niveau</option>
        </select>
      </div>
    </div>
    <div v-if="loading">Chargement...</div>
    <div v-else-if="errorMessage" class="state-text state-error">{{ errorMessage }}</div>
    <div v-else class="collection-wrapper">
        <div class="element-column">
          <h3 class="element-title nx-subtitle element-title-water">
            EAU <span class="element-count-inline">({{ eauUnits.length }})</span>
          </h3>
          <div class="element-list">
            <button
              v-for="unit in eauUnits"
              :key="unit.user_unit_id"
              type="button"
              class="unit-card nx-card"
              :class="['rarity-' + (unit.rarity || 'common').toLowerCase(), { 'unit-card-has-image': getUnitImageUrl(unit), 'unit-card-blurred': isUnitBlurred(unit) }]"
              :style="unitCardBgStyle(unit)"
              @click="openDetail(unit)"
            >
              <header>
                <h3>{{ unit.name }}</h3>
                <span v-if="hasSpec(unit)" class="badge-spec-inline" title="Spécialisée">★</span>
                <span class="rarity">{{ toRarityFr(unit.rarity) }}</span>
                <span class="badge-power-inline nx-badge">P{{ unit.power_level ?? 1 }}</span>
                <span v-if="hasNoyau(unit)" class="badge-noyau-inline nx-badge" title="Noyau">Noyau</span>
              </header>
              <p class="meta">
                Niveau {{ unit.level }} • Puissance {{ unit.power_level ?? 1 }} • {{ toRoleFr(unit.role) }} • {{ toAttackTypeFr(unit.attack_type) }}
              </p>
              <div class="stats-grid">
                <div class="stat">
                  <span class="stat-label">❤ PV</span>
                  <span class="stat-value">{{ unit.maxHp ?? unit.base_hp }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">⚔ ATQ</span>
                  <span class="stat-value">{{ unit.attack ?? unit.base_attack }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">🛡 DEF</span>
                  <span class="stat-value">{{ unit.defense ?? unit.base_defense }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">⚡ VIT</span>
                  <span class="stat-value">{{ (unit.fatigue ?? 0) > 0 ? effectiveSpeed(unit) : (unit.speed ?? unit.base_speed) }}</span>
                  <span v-if="(unit.fatigue ?? 0) > 0" class="speed-fatigue-hint" :title="'Vitesse réduite de ' + speedReductionPercent(unit) + '% en combat (fatigue)'"> (-{{ speedReductionPercent(unit) }}%)</span>
                </div>
              </div>
              <div class="state-grid">
                <div class="stat">
                  <span class="stat-label">✨ Maîtrise</span>
                  <span class="stat-value">{{ unit.mastery }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">😴 Fatigue</span>
                  <span class="stat-value">{{ unit.fatigue }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">💥 Blessure</span>
                  <span class="stat-value">{{ unit.injury_level }}</span>
                </div>
              </div>
            </button>
          </div>
        </div>
        <div class="element-column">
          <h3 class="element-title nx-subtitle element-title-fire">
            FEU <span class="element-count-inline">({{ feuUnits.length }})</span>
          </h3>
          <div class="element-list">
            <button
              v-for="unit in feuUnits"
              :key="unit.user_unit_id"
              type="button"
              class="unit-card nx-card"
              :class="['rarity-' + (unit.rarity || 'common').toLowerCase(), { 'unit-card-has-image': getUnitImageUrl(unit), 'unit-card-blurred': isUnitBlurred(unit) }]"
              :style="unitCardBgStyle(unit)"
              @click="openDetail(unit)"
            >
              <header>
                <h3>{{ unit.name }}</h3>
                <span v-if="hasSpec(unit)" class="badge-spec-inline" title="Spécialisée">★</span>
                <span class="rarity">{{ toRarityFr(unit.rarity) }}</span>
                <span class="badge-power-inline nx-badge">P{{ unit.power_level ?? 1 }}</span>
                <span v-if="hasNoyau(unit)" class="badge-noyau-inline nx-badge" title="Noyau">Noyau</span>
              </header>
              <p class="meta">
                Niveau {{ unit.level }} • Puissance {{ unit.power_level ?? 1 }} • {{ toRoleFr(unit.role) }} • {{ toAttackTypeFr(unit.attack_type) }}
              </p>
              <div class="stats-grid">
                <div class="stat">
                  <span class="stat-label">❤ PV</span>
                  <span class="stat-value">{{ unit.maxHp ?? unit.base_hp }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">⚔ ATQ</span>
                  <span class="stat-value">{{ unit.attack ?? unit.base_attack }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">🛡 DEF</span>
                  <span class="stat-value">{{ unit.defense ?? unit.base_defense }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">⚡ VIT</span>
                  <span class="stat-value">{{ (unit.fatigue ?? 0) > 0 ? effectiveSpeed(unit) : (unit.speed ?? unit.base_speed) }}</span>
                  <span v-if="(unit.fatigue ?? 0) > 0" class="speed-fatigue-hint" :title="'Vitesse réduite de ' + speedReductionPercent(unit) + '% en combat (fatigue)'"> (-{{ speedReductionPercent(unit) }}%)</span>
                </div>
              </div>
              <div class="state-grid">
                <div class="stat">
                  <span class="stat-label">✨ Maîtrise</span>
                  <span class="stat-value">{{ unit.mastery }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">😴 Fatigue</span>
                  <span class="stat-value">{{ unit.fatigue }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">💥 Blessure</span>
                  <span class="stat-value">{{ unit.injury_level }}</span>
                </div>
              </div>
            </button>
          </div>
        </div>
        <div class="element-column">
          <h3 class="element-title nx-subtitle element-title-plant">
            PLANTE <span class="element-count-inline">({{ planteUnits.length }})</span>
          </h3>
          <div class="element-list">
            <button
              v-for="unit in planteUnits"
              :key="unit.user_unit_id"
              type="button"
              class="unit-card nx-card"
              :class="['rarity-' + (unit.rarity || 'common').toLowerCase(), { 'unit-card-has-image': getUnitImageUrl(unit), 'unit-card-blurred': isUnitBlurred(unit) }]"
              :style="unitCardBgStyle(unit)"
              @click="openDetail(unit)"
            >
<header>
                <h3>{{ unit.name }}</h3>
                <span v-if="hasSpec(unit)" class="badge-spec-inline" title="Spécialisée">★</span>
                <span class="rarity">{{ toRarityFr(unit.rarity) }}</span>
                <span class="badge-power-inline nx-badge">P{{ unit.power_level ?? 1 }}</span>
                <span v-if="hasNoyau(unit)" class="badge-noyau-inline nx-badge" title="Noyau">Noyau</span>
              </header>
              <p class="meta">
                Niveau {{ unit.level }} • Puissance {{ unit.power_level ?? 1 }} • {{ toRoleFr(unit.role) }} • {{ toAttackTypeFr(unit.attack_type) }}
              </p>
              <div class="stats-grid">
                <div class="stat">
                  <span class="stat-label">❤ PV</span>
                  <span class="stat-value">{{ unit.maxHp ?? unit.base_hp }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">⚔ ATQ</span>
                  <span class="stat-value">{{ unit.attack ?? unit.base_attack }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">🛡 DEF</span>
                  <span class="stat-value">{{ unit.defense ?? unit.base_defense }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">⚡ VIT</span>
                  <span class="stat-value">{{ (unit.fatigue ?? 0) > 0 ? effectiveSpeed(unit) : (unit.speed ?? unit.base_speed) }}</span>
                  <span v-if="(unit.fatigue ?? 0) > 0" class="speed-fatigue-hint" :title="'Vitesse réduite de ' + speedReductionPercent(unit) + '% en combat (fatigue)'"> (-{{ speedReductionPercent(unit) }}%)</span>
                </div>
              </div>
              <div class="state-grid">
                <div class="stat">
                  <span class="stat-label">✨ Maîtrise</span>
                  <span class="stat-value">{{ unit.mastery }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">😴 Fatigue</span>
                  <span class="stat-value">{{ unit.fatigue }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">💥 Blessure</span>
                  <span class="stat-value">{{ unit.injury_level }}</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

    <!-- Popup fiche unité (style jeu) -->
    <div v-if="detailUnit" class="nexus-modal-overlay" @click.self="closeDetail">
      <div class="nexus-modal" @click.stop>
        <div class="nexus-modal-header">
          <p v-if="isOtherUserCollection" class="modal-view-only">Consultation seule — vous ne pouvez pas modifier les unités d'un autre joueur.</p>
          <div class="modal-title">
            <div class="unit-name">{{ detailUnit.name }}</div>
            <div class="unit-badges">
              <span class="badge nx-badge" :class="'rarity-' + (detailUnit.rarity || 'common').toLowerCase()">
                {{ toRarityFr(detailUnit.rarity) }}
              </span>
              <span class="badge nx-badge" :class="'element-' + (detailUnit.element || 'neutral').toLowerCase()">
                {{ toElementFr(detailUnit.element) }}
              </span>
              <span class="badge badge-power nx-badge">
                Puissance {{ detailUnit.power_level ?? 1 }}
              </span>
              <span v-if="noyauDescription" class="badge badge-noyau nx-badge" title="Possède un noyau">Noyau</span>
            </div>
          </div>
          <button type="button" class="modal-close" @click="closeDetail" aria-label="Fermer">×</button>
        </div>
        <div class="nexus-modal-body modal-body-with-image">
          <div
            v-if="detailUnitImageUrl"
            class="modal-unit-image-wrap modal-unit-image-clickable"
            :class="{ 'modal-unit-image-blurred': detailUnit && isUnitBlurred(detailUnit) }"
            role="button"
            tabindex="0"
            aria-label="Agrandir l'image"
            @click="showImageFullscreen = true"
            @keydown.enter="showImageFullscreen = true"
          >
            <img :src="detailUnitImageUrl" :alt="detailUnit.name" class="modal-unit-image" />
          </div>
          <div class="modal-body-infos">
            <div class="modal-grid modal-grid-compact">
              <section class="modal-card nx-panel">
                <div class="card-title nx-subtitle">Profil</div>
                <div class="kv"><span>Rôle</span><span>{{ toRoleFr(detailUnit.role) }}</span></div>
                <div class="kv"><span :title="TOOLTIP_TYPE">Type</span><span>{{ toAttackTypeFr(detailUnit.attack_type) }}</span></div>
                <div class="kv"><span :title="TOOLTIP_ELEMENT">Élément</span><span>{{ toElementFr(detailUnit.element) }}</span></div>
                <div class="kv"><span :title="TOOLTIP_TRAITS">Traits</span><span>{{ formatTraits(detailUnit.traits) || '—' }}</span></div>
                <div v-if="noyauDescription" class="kv noyau-kv"><span :title="TOOLTIP_NOYAU">Noyau</span><span class="noyau-desc">{{ noyauDescription }}</span></div>
              </section>
              <section class="modal-card nx-panel">
                <div class="card-title nx-subtitle">Stats</div>
                <div class="stats-rows stats-rows-compact">
                  <div class="stat-row"><span :title="TOOLTIP_HP">{{ STAT_FR.HP }}</span><span>{{ detailUnit.maxHp ?? detailUnit.base_hp }}</span></div>
                  <div class="stat-row"><span :title="TOOLTIP_ATK">{{ STAT_FR.ATK }}</span><span>{{ detailUnit.attack ?? detailUnit.base_attack }}</span></div>
                  <div class="stat-row"><span :title="TOOLTIP_DEF">{{ STAT_FR.DEF }}</span><span>{{ detailUnit.defense ?? detailUnit.base_defense }}</span></div>
                  <div class="stat-row"><span :title="TOOLTIP_SPD">{{ STAT_FR.SPD }}</span><span>{{ (detailUnit.fatigue ?? 0) > 0 ? effectiveSpeed(detailUnit) : (detailUnit.speed ?? detailUnit.base_speed) }}{{ (detailUnit.fatigue ?? 0) > 0 ? ` (-${speedReductionPercent(detailUnit)}%)` : '' }}</span></div>
                  <div class="stat-row"><span :title="TOOLTIP_MASTERY">{{ STAT_FR.MASTERY }}</span><span>{{ detailUnit.mastery }}</span></div>
                </div>
              </section>
            </div>
            <div class="modal-grid-2 modal-grid-compact">
              <section class="modal-card nx-panel">
                <div class="card-title nx-subtitle">État</div>
                <div class="kv"><span :title="TOOLTIP_XP">XP</span><span>{{ detailUnit.xp }} / {{ detailUnit.xpRequired }}</span></div>
                <div class="kv"><span :title="TOOLTIP_PUISSANCE">Puissance</span><span>{{ detailUnit.power_level ?? 1 }} (+{{ Math.max(0, ((detailUnit.power_level ?? 1) - 1) * 5) }}%)</span></div>
                <div class="kv"><span>Doublons obtenus</span><span>{{ duplicateCount(detailUnit) }}</span></div>
                <div class="kv"><span :title="TOOLTIP_OUVERTURES_TOTALES">Ouvertures totales</span><span>{{ detailUnit.power_openings ?? 1 }}</span></div>
                <div class="kv"><span :title="TOOLTIP_PROGRESSION_PUISSANCE">Progression puissance</span><span>{{ powerProgressLabel(detailUnit) }}</span></div>
                <div class="kv"><span :title="TOOLTIP_FATIGUE">Fatigue</span><span>{{ detailUnit.fatigue }}</span></div>
                <div class="kv"><span>Blessure</span><span>{{ detailUnit.injury_level ?? '—' }}</span></div>
              </section>
              <section v-if="canAscend" class="modal-card nx-panel ascend-section">
                <div class="card-title nx-subtitle" :title="TOOLTIP_SPEC">✨ Spécialisation</div>
                <p class="ascend-desc">Niveau 50 sans spé. Choisir la spécialisation A ou B (coût : 1 essence).</p>
                <div class="ascend-choices">
                  <label class="ascend-choice"><input type="radio" v-model="pendingSpecChoice" value="A" /> Spé A</label>
                  <label class="ascend-choice"><input type="radio" v-model="pendingSpecChoice" value="B" /> Spé B</label>
                </div>
                <p v-if="ascendError" class="ascend-error">{{ ascendError }}</p>
                <button type="button" class="nx-btn ascend-validate" :disabled="ascendLoading" @click="validateAscend">
                  {{ ascendLoading ? '…' : 'Valider' }}
                </button>
              </section>
              <section class="modal-card nx-panel unit-skill-section">
                <h3 class="skill-section-title nx-subtitle">
                  ⚡ Compétence
                  <span v-if="detailUnit && hasSpec(detailUnit) && detailUnit.specialization" class="spec-badge-chosen">
                    — Spécialisation {{ String(detailUnit.specialization).toUpperCase() }}
                  </span>
                </h3>
                <p v-if="skillCooldown != null" class="skill-cd-badge" :title="TOOLTIP_CD">CD : {{ skillCooldown }} action{{ skillCooldown > 1 ? 's' : '' }}</p>
                <p class="skill-description-text">{{ descriptionSkill }}</p>
                <div class="unit-spec-section">
                  <p v-if="detailUnit && !hasSpec(detailUnit)" class="spec-section-title" :title="TOOLTIP_SPEC">Spécialisations</p>
                  <p v-if="descriptionSpecA && (!detailUnit || !hasSpec(detailUnit) || (detailUnit.specialization && String(detailUnit.specialization).toUpperCase() === 'A'))" class="spec-line"><strong>Spécialisation A</strong> — {{ descriptionSpecA }}</p>
                  <p v-if="descriptionSpecB && (!detailUnit || !hasSpec(detailUnit) || (detailUnit.specialization && String(detailUnit.specialization).toUpperCase() === 'B'))" class="spec-line"><strong>Spécialisation B</strong> — {{ descriptionSpecB }}</p>
                  <p v-if="!descriptionSpecA && !descriptionSpecB" class="spec-line spec-empty">—</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Image en grand (clic sur l'image dans la popup) -->
    <Teleport to="body">
      <div
        v-if="showImageFullscreen && detailUnitImageUrl"
        class="image-fullscreen-overlay"
        aria-label="Image agrandie"
        @click.self="showImageFullscreen = false"
      >
        <button type="button" class="image-fullscreen-close" aria-label="Fermer" @click="showImageFullscreen = false">×</button>
        <div class="image-fullscreen-stage" :class="{ 'image-fullscreen-blurred': detailUnit && isUnitBlurred(detailUnit) }" @click.stop>
          <img
            ref="fullscreenImageEl"
            :src="detailUnitImageUrl"
            :alt="detailUnit?.name ?? ''"
            class="image-fullscreen-img"
            @load="syncFullscreenImageWidth"
          />
          <div class="image-name-scroll" :class="detailUnitRarityClass" :style="imageNameScrollStyle">
            <span class="image-name-scroll-cap left" aria-hidden="true" />
            <div class="image-name-scroll-body">
              <strong class="image-name-scroll-title">{{ detailUnit?.name ?? '' }}</strong>
            </div>
            <span class="image-name-scroll-cap right" aria-hidden="true" />
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import api from '../api';
import {
  toRarityFr,
  toAttackTypeFr,
  toRoleFr,
  toElementFr,
  toArchetypeFr,
  toSkillKeyFr,
  toTraitFr,
  STAT_FR
} from '../utils/i18nFr';
import { normalizeSkillDescription } from '../utils/skillDescription';
import { getUnitImageUrl } from '../utils/unitImage';
import {
  TOOLTIP_TYPE,
  TOOLTIP_ELEMENT,
  TOOLTIP_TRAITS,
  TOOLTIP_NOYAU,
  TOOLTIP_HP,
  TOOLTIP_ATK,
  TOOLTIP_DEF,
  TOOLTIP_SPD,
  TOOLTIP_MASTERY,
  TOOLTIP_CD,
  TOOLTIP_SPEC,
  TOOLTIP_XP,
  TOOLTIP_PUISSANCE,
  TOOLTIP_OUVERTURES_TOTALES,
  TOOLTIP_PROGRESSION_PUISSANCE,
  TOOLTIP_FATIGUE
} from '../utils/unitPopupTooltips';

type CollectionUnit = {
  user_unit_id: number;
  unit_id: number;
  name: string;
  code: string;
  rarity: string;
  role: string;
  attack_type: string;
  element: string;
  archetype: string;
  base_hp: number;
  base_attack: number;
  base_defense: number;
  base_speed: number;
  mastery: number;
  traits?: string[] | string | null;
  synergy_tag?: string | null;
  core_type?: string | null;
  skill_data?: Record<string, unknown> | string | null;
  level: number;
  xp: number;
  xpRequired: number;
  specialization?: string | null;
  power_level?: number;
  power_openings?: number;
  ascension_count: number;
  fatigue: number;
  injury_level: number;
};

const route = useRoute();

const units = ref<CollectionUnit[]>([]);
const loading = ref(false);
const errorMessage = ref('');
const detailUnit = ref<CollectionUnit | null>(null);
const showImageFullscreen = ref(false);
const fullscreenImageEl = ref<HTMLImageElement | null>(null);
const fullscreenImageWidth = ref<number | null>(null);
const ownerDisplayName = ref<string | null>(null);
const viewerOwnedUnitIds = ref<Set<number>>(new Set());
const pendingSpecChoice = ref<'A' | 'B'>('A');
const ascendLoading = ref(false);
const ascendError = ref('');

const isOtherUserCollection = computed(() => !!route.params.userId);
function isUnitBlurred(unit: CollectionUnit): boolean {
  return isOtherUserCollection.value && !viewerOwnedUnitIds.value.has(Number(unit.unit_id));
}
const collectionTitle = computed(() =>
  isOtherUserCollection.value
    ? `Collection de ${ownerDisplayName.value || route.params.userId || 'Joueur'}`
    : 'Ma Collection'
);
const totalUnits = computed(() => units.value.length);

const canAscend = computed(() => {
  const u = detailUnit.value;
  if (!u || isOtherUserCollection.value) return false;
  return (u.level ?? 0) >= 50 && !hasSpec(u);
});

/** Mode de tri : Par rareté (rarité + niveau + nom), Par niveau (niveau + rareté + nom). */
const collectionSortMode = ref<'rarity' | 'level'>('rarity');

const rarityOrderMap: Record<string, number> = {
  mythic: 6,
  legendary: 5,
  epic: 4,
  rare: 3,
  uncommon: 2,
  common: 1
};

onMounted(() => {
  window.addEventListener('resize', syncFullscreenImageWidth);
  loadCollection();
});

onUnmounted(() => {
  window.removeEventListener('resize', syncFullscreenImageWidth);
});

function sortUnits(list: CollectionUnit[], mode: 'rarity' | 'level'): CollectionUnit[] {
  return [...list].sort((a, b) => {
    const ra = rarityOrderMap[(a.rarity || '').toLowerCase()] ?? 0;
    const rb = rarityOrderMap[(b.rarity || '').toLowerCase()] ?? 0;
    const lvlA = a.level ?? 1;
    const lvlB = b.level ?? 1;
    if (mode === 'level') {
      if (lvlB !== lvlA) return lvlB - lvlA;
      if (ra !== rb) return rb - ra;
      return (a.name || '').localeCompare(b.name || '');
    }
    // rarity
    if (ra !== rb) return rb - ra;
    if (lvlB !== lvlA) return lvlB - lvlA;
    return (a.name || '').localeCompare(b.name || '');
  });
}

const eauUnits = computed(() =>
  sortUnits(units.value.filter((u) => (u.element || '').toLowerCase() === 'water'), collectionSortMode.value)
);
const feuUnits = computed(() =>
  sortUnits(units.value.filter((u) => (u.element || '').toLowerCase() === 'fire'), collectionSortMode.value)
);
const planteUnits = computed(() =>
  sortUnits(units.value.filter((u) => (u.element || '').toLowerCase() === 'plant'), collectionSortMode.value)
);

function hasSpec(unit: CollectionUnit): boolean {
  const s = unit.specialization;
  return s != null && String(s).trim() !== '';
}

/** Vitesse effective en combat (réduite par la fatigue). 1 fatigue = 1% de réduction. */
function effectiveSpeed(unit: { speed?: number; base_speed?: number; fatigue?: number }): number {
  const speed = unit.speed ?? unit.base_speed ?? 0;
  const fatigue = Math.min(100, Math.max(0, unit.fatigue ?? 0));
  const factor = 1 - 0.01 * fatigue;
  return Math.max(1, Math.round(speed * factor));
}

/** Pourcentage de réduction de vitesse (pour affichage). 1 fatigue = 1%. */
function speedReductionPercent(unit: { fatigue?: number }): number {
  return Math.min(100, Math.round(unit.fatigue ?? 0));
}

function hasNoyau(unit: CollectionUnit): boolean {
  if (!unit.skill_data || typeof unit.skill_data !== 'object') return false;
  const sd = unit.skill_data as Record<string, unknown>;
  const noyau = sd.noyau;
  return noyau != null && typeof noyau === 'object' && typeof (noyau as { description?: string }).description === 'string';
}

function duplicateCount(unit: CollectionUnit): number {
  return Math.max(0, (unit.power_openings ?? 1) - 1);
}

function powerProgressLabel(unit: CollectionUnit): string {
  const level = Number(unit.power_level ?? 1);
  const openings = Number(unit.power_openings ?? 1);
  if (level >= 5) return 'Max';
  const currentThresholds: Record<number, number> = { 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 };
  const nextThreshold = currentThresholds[level + 1] ?? 15;
  const currentThreshold = currentThresholds[level] ?? 1;
  const progress = Math.max(0, openings - currentThreshold);
  const required = Math.max(1, nextThreshold - currentThreshold);
  return `${progress} / ${required} vers Puissance ${level + 1}`;
}

function unitCardBgStyle(unit: CollectionUnit): Record<string, string> {
  const url = getUnitImageUrl(unit);
  if (!url) return {};
  return { '--unit-bg-image': `url(${url})` };
}

function openDetail(unit: CollectionUnit) {
  detailUnit.value = unit;
  pendingSpecChoice.value = 'A';
  ascendError.value = '';
}

async function loadCollection() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const userId = route.params.userId as string | undefined;
    const url = userId ? `/collection?userId=${encodeURIComponent(userId)}` : '/collection';
    const { data } = await api.get(url);
    units.value = (data.units || []) as CollectionUnit[];
    ownerDisplayName.value = data.owner_display_name ?? null;
    viewerOwnedUnitIds.value = new Set(
      (Array.isArray(data.viewer_owned_unit_ids) ? data.viewer_owned_unit_ids : []).map(Number)
    );
  } catch (err: unknown) {
    const ax = err as { response?: { status?: number; data?: { message?: string } } };
    errorMessage.value = ax?.response?.data?.message
      || (ax?.response?.status === 503 ? 'Service temporairement indisponible.' : 'Impossible de charger la collection.');
    units.value = [];
  } finally {
    loading.value = false;
  }
}

async function validateAscend() {
  if (isOtherUserCollection.value) return;
  const u = detailUnit.value;
  if (!u || !canAscend.value) return;
  ascendError.value = '';
  ascendLoading.value = true;
  try {
    const { data } = await api.post('/units/ascend', {
      userUnitId: u.user_unit_id,
      specChoice: pendingSpecChoice.value
    });
    if (data.success && data.userUnit) {
      if (!isOtherUserCollection.value) await loadCollection();
      const updated = units.value.find((x) => x.user_unit_id === u.user_unit_id);
      if (updated) detailUnit.value = updated;
      ascendError.value = '';
    }
  } catch (err: unknown) {
    const ax = err as { response?: { data?: { message?: string; error?: string } } };
    ascendError.value = ax?.response?.data?.message ?? 'Erreur lors de l\'ascension.';
  } finally {
    ascendLoading.value = false;
  }
}

function closeDetail() {
  detailUnit.value = null;
  showImageFullscreen.value = false;
}

function formatTraits(t: CollectionUnit['traits']): string {
  if (!t) return '';
  const arr = Array.isArray(t) ? t : (typeof t === 'string' ? [t] : []);
  return arr.map(toTraitFr).join(', ');
}

function getMainSkillCooldown(skillData: CollectionUnit['skill_data']): number | null {
  if (!skillData) return null;
  let data: Record<string, unknown>;
  if (typeof skillData === 'string') {
    try {
      data = JSON.parse(skillData) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else {
    data = skillData as Record<string, unknown>;
  }
  const skills = data.skills as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(skills)) {
    const active = skills.find((s) => String(s?.type ?? '').toUpperCase() === 'ACTIVE');
    const cd = active && typeof active.cd_actions === 'number' ? active.cd_actions : null;
    if (cd != null) return cd;
  }
  const skill = (data.skill ?? data.basic ?? data) as Record<string, unknown> | undefined;
  if (skill && typeof skill.cd_actions === 'number') return skill.cd_actions;
  return null;
}

function buildSkillDescription(skillData: CollectionUnit['skill_data']): string {
  if (!skillData) return 'Compétence de base sans effet particulier.';
  let data: Record<string, unknown>;
  if (typeof skillData === 'string') {
    try {
      data = JSON.parse(skillData) as Record<string, unknown>;
    } catch {
      return String(skillData);
    }
  } else {
    data = skillData as Record<string, unknown>;
  }
  const s = (data.skill ?? data.basic ?? data) as Record<string, unknown>;
  const type = String(s.type || 'BASIC');
  const label = toSkillKeyFr(type);
  const mult = s.mult != null ? `×${s.mult}` : '';
  const cd = s.cd_actions != null ? `CD ${s.cd_actions}` : '';
  return [label, mult, cd].filter(Boolean).join(' • ') || label;
}

const skillCooldown = computed(() => getMainSkillCooldown(detailUnit.value?.skill_data ?? null));

const skillDescription = computed(() =>
  detailUnit.value ? buildSkillDescription(detailUnit.value.skill_data ?? null) : ''
);

function getDescriptionFromSkillData(skillData: CollectionUnit['skill_data']): { skill?: string; specA?: string; specB?: string } | null {
  if (!skillData || typeof skillData !== 'object') return null;
  const d = (skillData as Record<string, unknown>).description;
  if (!d || typeof d !== 'object') return null;
  return d as { skill?: string; specA?: string; specB?: string };
}

const descriptionSkill = computed(() => {
  const u = detailUnit.value;
  if (!u) return '—';
  const desc = getDescriptionFromSkillData(u.skill_data ?? null);
  const text = desc?.skill;
  return typeof text === 'string' && text.trim() ? normalizeSkillDescription(text) : (detailUnit.value ? buildSkillDescription(detailUnit.value.skill_data ?? null) : '—');
});

const descriptionSpecA = computed(() => {
  const u = detailUnit.value;
  if (!u) return '';
  const desc = getDescriptionFromSkillData(u.skill_data ?? null);
  const text = desc?.specA;
  return typeof text === 'string' && text.trim() ? normalizeSkillDescription(text) : '';
});

const descriptionSpecB = computed(() => {
  const u = detailUnit.value;
  if (!u) return '';
  const desc = getDescriptionFromSkillData(u.skill_data ?? null);
  const text = desc?.specB;
  return typeof text === 'string' && text.trim() ? normalizeSkillDescription(text) : '';
});

const noyauDescription = computed(() => {
  const u = detailUnit.value;
  if (!u?.skill_data || typeof u.skill_data !== 'object') return '';
  const sd = u.skill_data as Record<string, unknown>;
  const noyau = sd.noyau;
  if (!noyau || typeof noyau !== 'object') return '';
  const desc = (noyau as { description?: string }).description;
  return typeof desc === 'string' ? normalizeSkillDescription(desc) : '';
});

const detailUnitImageUrl = computed(() => getUnitImageUrl(detailUnit.value) ?? null);
const detailUnitRarityClass = computed(() => `rarity-${String(detailUnit.value?.rarity || 'common').toLowerCase()}`);
const imageNameScrollStyle = computed(() => (
  fullscreenImageWidth.value != null
    ? { width: `${fullscreenImageWidth.value}px` }
    : {}
));

function syncFullscreenImageWidth() {
  fullscreenImageWidth.value = fullscreenImageEl.value?.clientWidth ?? null;
}

watch([showImageFullscreen, detailUnitImageUrl], async ([show, imageUrl]) => {
  if (!show || !imageUrl) {
    fullscreenImageWidth.value = null;
    return;
  }
  await nextTick();
  syncFullscreenImageWidth();
});

function formatStatKey(key: string): string {
  const map: Record<string, string> = {
    base_hp: STAT_FR.HP,
    base_attack: STAT_FR.ATK,
    base_defense: STAT_FR.DEF,
    base_speed: STAT_FR.SPD,
    mastery: STAT_FR.MASTERY
  };
  return map[key] || key;
}

const specALabel = computed(() => {
  const stat = detailUnit.value?.specA_bonus_stat as string | undefined;
  return stat ? `Bonus : ${formatStatKey(stat)}` : '';
});

const specBLabel = computed(() => {
  const stat = detailUnit.value?.specB_bonus_stat as string | undefined;
  return stat ? `Bonus : ${formatStatKey(stat)}` : '';
});

function formatSpecModifier(mod: unknown): string {
  if (!mod || typeof mod !== 'object') return '';
  const m = mod as Record<string, unknown>;
  if (m.type === 'DAMAGE_SINGLE') {
    return `Modifie la compétence : Dégâts simples (mult. ${m.mult ?? 1})`;
  }
  return '';
}

const specAModifierText = computed(() =>
  detailUnit.value ? formatSpecModifier((detailUnit.value as any).specA_skill_modifier) : ''
);
const specBModifierText = computed(() =>
  detailUnit.value ? formatSpecModifier((detailUnit.value as any).specB_skill_modifier) : ''
);
</script>

<style scoped>
.collection {
  width: 100%;
  padding: 30px 50px;
}

.collection-header {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  margin: 0;
  color: #f8fafc;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.page-title::after {
  content: '';
  display: block;
  height: 2px;
  width: 120px;
  margin-top: 10px;
  background: linear-gradient(to right, rgba(0, 255, 255, 0.65), rgba(138, 43, 226, 0));
  filter: blur(0.2px);
}

.page-title-count {
  font-weight: 700;
  opacity: 0.85;
  color: rgba(0, 255, 255, 0.85);
  margin-left: 8px;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.15);
}


.collection-wrapper {
  display: grid;
  grid-template-columns: repeat(3, minmax(280px, 1fr));
  gap: 30px;
  align-items: flex-start;
  overflow-x: auto;
}

.collection-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.collection-sort-label {
  font-size: 0.95rem;
  color: rgba(203, 213, 225, 0.9);
  white-space: nowrap;
}

.collection-sort-select {
  min-width: 160px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #e2e8f0;
  font-size: 0.95rem;
  cursor: pointer;
}

@media (max-width: 1200px) {
  .collection-wrapper {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .collection {
    padding: 1rem;
  }
  .collection-header {
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .page-title {
    font-size: 1.35rem;
  }
  .collection-wrapper {
    gap: 1rem;
  }
  .element-column {
    padding: 1rem;
  }
  .collection-sort-select {
    min-width: 120px;
  }
}

.element-column {
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 22px;
  padding-top: 26px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  position: relative;
  isolation: isolate;
}

.element-title {
  font-size: 1.1rem;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.15em;
  margin: 0 0 12px 0;
}

.element-title-water {
  color: rgba(34, 211, 238, 0.9);
  text-shadow: 0 0 14px rgba(34, 211, 238, 0.15);
}

.element-title-fire {
  color: rgba(249, 115, 22, 0.9);
  text-shadow: 0 0 14px rgba(249, 115, 22, 0.15);
}

.element-title-plant {
  color: rgba(34, 197, 94, 0.9);
  text-shadow: 0 0 14px rgba(34, 197, 94, 0.15);
}

.element-count-inline {
  font-size: 0.9rem;
  opacity: 0.85;
  margin-left: 6px;
}

.element-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 6px 4px 6px 6px;
  padding-top: 10px;
  margin-top: -10px;
}

.element-list::-webkit-scrollbar {
  width: 4px;
}

.element-list::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.6);
  border-radius: 999px;
}

.unit-card {
  cursor: pointer;
  position: relative;
  overflow: hidden;
  background: linear-gradient(160deg, #0f172a, #0b1120);
  border-radius: 18px;
  padding: 14px 16px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.6),
    inset 0 0 20px rgba(0, 255, 255, 0.05);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease,
    background 180ms ease;
  will-change: transform;
  transform-origin: center;
  color: #f8fafc;
}

.unit-card * {
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.6);
}

.unit-card.unit-card-has-image::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--unit-bg-image);
  background-size: contain;
  background-position: right bottom;
  background-repeat: no-repeat;
  opacity: 0.35;
  pointer-events: none;
  z-index: 0;
}

.unit-card.unit-card-blurred.unit-card-has-image::before {
  filter: blur(10px);
}

.unit-card.unit-card-has-image header,
.unit-card.unit-card-has-image .meta,
.unit-card.unit-card-has-image .stats-grid,
.unit-card.unit-card-has-image .state-grid {
  position: relative;
  z-index: 1;
}

.unit-card:hover {
  position: relative;
  z-index: 5;
  transform: translateY(-6px) scale(1.02);
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.7),
    0 0 20px rgba(0, 255, 255, 0.15);
}

.unit-card.rarity-common {
  border-color: rgba(200, 200, 200, 0.5);
}

.unit-card.rarity-uncommon {
  border-color: #00ff88;
  box-shadow: 0 0 8px rgba(0, 255, 136, 0.4);
}

.unit-card.rarity-rare {
  border-color: #00aaff;
  box-shadow: 0 0 10px rgba(0, 170, 255, 0.5);
}

.unit-card.rarity-epic {
  border-color: #a855f7;
  box-shadow: 0 0 12px rgba(168, 85, 247, 0.6);
}

@keyframes legendaryGlow {
  0% {
    box-shadow: 0 0 10px rgba(250, 204, 21, 0.4);
  }
  50% {
    box-shadow: 0 0 18px rgba(250, 204, 21, 0.8);
  }
  100% {
    box-shadow: 0 0 10px rgba(250, 204, 21, 0.4);
  }
}

.unit-card.rarity-legendary {
  border-color: #facc15;
  animation: legendaryGlow 3s infinite ease-in-out;
}

@keyframes mythicPulse {
  0% {
    box-shadow:
      0 0 15px rgba(255, 0, 100, 0.6),
      0 0 30px rgba(150, 0, 255, 0.3);
  }
  50% {
    box-shadow:
      0 0 25px rgba(255, 0, 150, 0.9),
      0 0 50px rgba(150, 0, 255, 0.6);
  }
  100% {
    box-shadow:
      0 0 15px rgba(255, 0, 100, 0.6),
      0 0 30px rgba(150, 0, 255, 0.3);
  }
}

.unit-card.rarity-mythic {
  border-color: #ff0066;
  animation: mythicPulse 4s infinite ease-in-out;
}

.unit-card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.3rem;
}

.unit-card h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.rarity {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #facc15;
}

.meta {
  margin: 0.15rem 0 0.4rem 0;
  font-size: 0.85rem;
  color: #cbd5e1;
}

.state-text {
  padding: 1rem;
  text-align: center;
  color: #e2e8f0;
}
.state-error {
  color: #fca5a5;
}

.stats-grid,
.state-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.2rem 0.75rem;
  margin-top: 0.15rem;
}

.stat {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  opacity: 0.95;
}

.stat-label {
  color: #cbd5e1;
}

.stat-value {
  color: #ffffff;
  font-weight: 600;
}

.badge-noyau {
  background: rgba(168, 85, 247, 0.35);
  color: #e9d5ff;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.badge-power,
.badge-power-inline {
  background: rgba(250, 204, 21, 0.22);
  color: #fef08a;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.badge-spec-inline {
  font-size: 0.9rem;
  color: #fbbf24;
  text-shadow: 0 0 8px rgba(251, 191, 36, 0.6);
  margin-left: 6px;
  line-height: 1;
}

.badge-noyau-inline {
  font-size: 0.65rem;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(168, 85, 247, 0.3);
  color: #e9d5ff;
  margin-left: 6px;
}

.modal-view-only {
  margin: 0 0 10px 0;
  padding: 8px 12px;
  font-size: 0.9rem;
  color: rgba(226, 232, 240, 0.9);
  background: rgba(100, 116, 139, 0.2);
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.ascend-section {
  border-color: rgba(251, 191, 36, 0.35);
  background: rgba(251, 191, 36, 0.06);
}
.ascend-desc {
  font-size: 0.9rem;
  color: rgba(226, 232, 240, 0.9);
  margin: 0 0 12px 0;
  line-height: 1.4;
}
.ascend-choices {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}
.ascend-choice {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #e2e8f0;
}
.ascend-choice input { cursor: pointer; }
.ascend-error {
  color: #fca5a5;
  font-size: 0.9rem;
  margin: 0 0 10px 0;
}
.ascend-validate {
  margin-top: 4px;
}

.noyau-kv .noyau-desc {
  color: #e2e8f0;
  font-style: italic;
}

.unit-skill-section {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.skill-section-title,
.spec-section-title {
  margin: 0 0 8px 0;
  font-size: 0.95rem;
  color: #e2e8f0;
}

.spec-badge-chosen {
  font-weight: 600;
  color: rgba(0, 255, 200, 0.95);
}

.skill-cd-badge {
  display: inline-block;
  margin: 0 0 8px 0;
  padding: 4px 10px;
  background: rgba(99, 102, 241, 0.3);
  border-radius: 6px;
  font-size: 0.85rem;
  color: #c7d2fe;
}

.skill-description-text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
  color: #cbd5e1;
}

.skill-cd-badge {
  display: inline-block;
  margin: 0 0 8px 0;
  padding: 4px 10px;
  background: rgba(99, 102, 241, 0.3);
  border-radius: 6px;
  font-size: 0.85rem;
  color: #c7d2fe;
}

.unit-spec-section {
  margin-top: 8px;
  font-size: 0.9rem;
  opacity: 0.9;
}

.spec-line {
  margin: 4px 0 0 0;
  color: #cbd5e1;
  line-height: 1.35;
}

.spec-line.spec-empty {
  color: #64748b;
}

/* Modal avec image unité + infos compactes */
.modal-body-with-image {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.modal-unit-image-wrap {
  flex-shrink: 0;
  width: 200px;
  min-height: 200px;
}

.modal-unit-image-clickable {
  cursor: pointer;
  border-radius: 12px;
  outline: none;
}
.modal-unit-image-clickable:hover {
  outline: 2px solid rgba(148, 163, 184, 0.5);
  outline-offset: 4px;
}

.modal-unit-image {
  width: 100%;
  height: auto;
  max-height: 280px;
  object-fit: contain;
  object-position: center bottom;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.2);
}

.modal-unit-image-wrap.modal-unit-image-blurred .modal-unit-image {
  filter: blur(10px);
  user-select: none;
}

.modal-body-infos {
  flex: 1;
  min-width: 0;
}

.modal-grid-compact .modal-card {
  padding: 10px 12px;
}

.modal-grid-compact .card-title {
  font-size: 0.8rem;
  margin-bottom: 6px;
}

.modal-grid-compact .kv {
  padding: 3px 0;
  font-size: 0.85rem;
}

.stats-rows-compact .stat-row {
  padding: 3px 0;
  font-size: 0.85rem;
}

@media (max-width: 780px) {
  .modal-body-with-image {
    flex-direction: column;
    align-items: center;
  }
  .modal-unit-image-wrap {
    width: 160px;
  }
}

/* Image en grand (overlay plein écran) */
.image-fullscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.9);
  padding: 40px;
}

.image-fullscreen-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.image-fullscreen-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.image-fullscreen-close:hover {
  background: rgba(255, 255, 255, 0.25);
}

.image-fullscreen-img {
  max-width: 90vw;
  max-height: calc(90vh - 120px);
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
}

.image-fullscreen-stage.image-fullscreen-blurred .image-fullscreen-img {
  filter: blur(10px);
  user-select: none;
}

.image-name-scroll {
  --scroll-main: #c9b48a;
  --scroll-dark: #6f5432;
  --scroll-edge: #4a3320;
  --scroll-ink: #2f1d11;
  --scroll-glow: rgba(201, 180, 138, 0.18);
  position: relative;
  display: flex;
  align-items: stretch;
  justify-content: center;
  margin-top: -6px;
  filter: drop-shadow(0 16px 18px rgba(0, 0, 0, 0.42));
  animation: scrollUnfurl 0.42s ease-out;
  transform-origin: top center;
}

.image-name-scroll-body {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
  flex: 1;
  padding: 0.95rem 1.5rem 1rem;
  background:
    radial-gradient(circle at 18% 28%, rgba(255, 246, 214, 0.55), transparent 18%),
    radial-gradient(circle at 82% 68%, rgba(120, 84, 48, 0.18), transparent 22%),
    repeating-linear-gradient(
      90deg,
      rgba(88, 62, 36, 0.045) 0 2px,
      rgba(233, 220, 188, 0.02) 2px 7px
    ),
    linear-gradient(180deg, #ebddb6 0%, var(--scroll-main) 45%, #b99663 100%);
  border: 1px solid rgba(74, 51, 32, 0.55);
  border-bottom: 4px solid var(--scroll-edge);
  clip-path: polygon(3% 0, 97% 0, 100% 18%, 98% 100%, 2% 100%, 0 18%);
  overflow: hidden;
}

.image-name-scroll-body::before,
.image-name-scroll-body::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.image-name-scroll-body::before {
  background:
    linear-gradient(180deg, rgba(255, 248, 225, 0.22), transparent 24%, rgba(60, 35, 18, 0.05) 100%),
    radial-gradient(circle at 50% 120%, rgba(72, 44, 24, 0.16), transparent 42%);
}

.image-name-scroll-body::after {
  background:
    radial-gradient(circle at 12% 82%, rgba(89, 51, 24, 0.18), transparent 14%),
    radial-gradient(circle at 88% 18%, rgba(89, 51, 24, 0.16), transparent 12%),
    radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.05), transparent 48%);
  opacity: 0.7;
}

.image-name-scroll-cap {
  position: relative;
  width: 28px;
  flex: 0 0 28px;
  background:
    radial-gradient(circle at center, rgba(255, 245, 214, 0.28), transparent 52%),
    linear-gradient(180deg, color-mix(in srgb, var(--scroll-main) 70%, #f8ecd1), var(--scroll-dark));
  border-radius: 999px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 245, 214, 0.15),
    inset 0 -8px 14px rgba(62, 37, 18, 0.3),
    0 0 10px var(--scroll-glow);
}

.image-name-scroll-cap.left {
  margin-right: 0;
}

.image-name-scroll-cap.right {
  margin-left: 0;
}

.image-name-scroll-title {
  position: relative;
  z-index: 1;
  max-width: 100%;
  text-align: center;
  font-size: clamp(0.95rem, 1.8vw, 1.25rem);
  line-height: 1.2;
  color: var(--scroll-ink);
  text-shadow:
    0 1px 0 rgba(255, 244, 214, 0.3),
    0 0 10px rgba(255, 239, 194, 0.16);
}

.image-name-scroll.rarity-common {
  --scroll-main: #c7ced8;
  --scroll-dark: #6b7280;
  --scroll-edge: #4b5563;
  --scroll-ink: #1f2937;
  --scroll-glow: rgba(199, 206, 216, 0.22);
}

.image-name-scroll.rarity-uncommon {
  --scroll-main: #6dd79b;
  --scroll-dark: #15803d;
  --scroll-edge: #166534;
  --scroll-ink: #092617;
  --scroll-glow: rgba(109, 215, 155, 0.26);
}

.image-name-scroll.rarity-rare {
  --scroll-main: #6bc6ff;
  --scroll-dark: #0369a1;
  --scroll-edge: #075985;
  --scroll-ink: #082032;
  --scroll-glow: rgba(107, 198, 255, 0.3);
}

.image-name-scroll.rarity-epic {
  --scroll-main: #c084fc;
  --scroll-dark: #7e22ce;
  --scroll-edge: #6b21a8;
  --scroll-ink: #240a3d;
  --scroll-glow: rgba(192, 132, 252, 0.34);
}

.image-name-scroll.rarity-legendary {
  --scroll-main: #f7c65b;
  --scroll-dark: #d97706;
  --scroll-edge: #b45309;
  --scroll-ink: #3a2205;
  --scroll-glow: rgba(247, 198, 91, 0.36);
}

.image-name-scroll.rarity-mythic {
  --scroll-main: #ff6cab;
  --scroll-dark: #c026d3;
  --scroll-edge: #9d174d;
  --scroll-ink: #3b0a24;
  --scroll-glow: rgba(255, 108, 171, 0.42);
}

@keyframes scrollUnfurl {
  0% {
    opacity: 0;
    transform: scaleY(0.15) translateY(-18px);
  }
  65% {
    opacity: 1;
    transform: scaleY(1.04) translateY(0);
  }
  100% {
    opacity: 1;
    transform: scaleY(1) translateY(0);
  }
}

</style>

