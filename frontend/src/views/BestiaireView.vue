<template>
  <section class="bestiaire">
    <div v-if="loading" class="loading">Chargement...</div>
    <template v-else>
      <!-- Filtres -->
      <div class="filters">
        <div class="filter-group">
          <span class="filter-label">Éléments</span>
          <label v-for="el in elementOptions" :key="el.id" class="filter-check">
            <input type="checkbox" v-model="filterElements[el.id]" />
            {{ el.label }}
          </label>
        </div>
        <div class="filter-group">
          <span class="filter-label">Type d'attaque</span>
          <label v-for="at in attackTypeOptions" :key="at.id" class="filter-check">
            <input type="checkbox" v-model="filterAttackTypes[at.id]" />
            {{ at.label }}
          </label>
        </div>
        <div class="filter-group">
          <span class="filter-label">Rareté</span>
          <label v-for="r in rarityOptions" :key="r.id" class="filter-check">
            <input type="checkbox" v-model="filterRarities[r.id]" />
            {{ r.label }}
          </label>
        </div>
        <div class="filter-group">
          <span class="filter-label">Traits</span>
          <label v-for="t in traitOptions" :key="t.id" class="filter-check">
            <input type="checkbox" v-model="filterTraits[t.id]" />
            {{ t.label }}
          </label>
        </div>
        <div class="filter-group sort-group">
          <span class="filter-label">Trier par</span>
          <select v-model="sortBy" class="sort-select">
            <option value="">—</option>
            <option value="base_hp">PV</option>
            <option value="base_attack">Attaque</option>
            <option value="base_defense">Défense</option>
            <option value="base_speed">Vitesse</option>
            <option value="mastery">Maîtrise</option>
          </select>
          <select v-if="sortBy" v-model="sortOrder" class="sort-order">
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
      </div>

      <!-- 3 colonnes Eau / Feu / Plante (+ Neutre) -->
      <div class="columns">
        <div v-for="col in elementColumns" :key="col.id" class="column">
          <h3 class="column-title nx-subtitle">{{ col.label }}</h3>
          <div class="column-cards bestiary-units">
            <button
              v-for="unit in col.units"
              :key="unit.id"
              type="button"
              class="unit-card nx-card bestiary-card"
              :class="[
                'rarity-' + (unit.rarity || 'common').toLowerCase(),
                { owned: isOwned(unit.id), locked: !isOwned(unit.id) },
                { 'unit-card-has-image': getUnitImageUrl(unit) }
              ]"
              :style="unitCardBgStyle(unit)"
              @click="openDetail(unit)"
            >
              <div class="row1">
                <span class="card-name">{{ unit.name }}</span>
                <span class="rarity-badge nx-badge" :class="'rarity-' + (unit.rarity || 'common').toLowerCase()">{{ toRarityFr(unit.rarity) }}</span>
              </div>
              <div class="row2">
                <span class="pill">{{ toAttackTypeFr(unit.attack_type) }}</span>
                <span v-if="formatTraits(unit.traits)" class="pill">{{ formatTraits(unit.traits) }}</span>
                <span v-if="hasNoyau(unit)" class="pill pill-noyau">Noyau</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Popup fiche unité (style jeu) -->
    <div v-if="detailUnit" class="nexus-modal-overlay" @click.self="detailUnit = null">
      <div class="nexus-modal" @click.stop>
        <div class="nexus-modal-header">
          <div class="modal-title">
            <div class="unit-name">{{ detailUnit.name }}</div>
            <div class="unit-badges">
              <span class="badge nx-badge" :class="'rarity-' + (detailUnit.rarity || 'common').toLowerCase()">
                {{ toRarityFr(detailUnit.rarity) }}
              </span>
              <span class="badge nx-badge" :class="'element-' + (detailUnit.element || 'neutral').toLowerCase()">
                {{ toElementFr(detailUnit.element) }}
              </span>
              <span v-if="noyauDescription" class="badge badge-noyau nx-badge" title="Possède un noyau">Noyau</span>
            </div>
          </div>
          <button type="button" class="modal-close" @click="detailUnit = null" aria-label="Fermer">×</button>
        </div>
        <div class="nexus-modal-body modal-body-with-image">
          <div v-if="detailUnitImageUrl" class="modal-unit-image-wrap" :class="{ 'modal-unit-image-blurred': detailUnit && !isOwned(detailUnit.id) }">
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
                  <div class="stat-row"><span :title="TOOLTIP_HP">{{ STAT_FR.HP }}</span><span>{{ detailUnit.base_hp }}</span></div>
                  <div class="stat-row"><span :title="TOOLTIP_ATK">{{ STAT_FR.ATK }}</span><span>{{ detailUnit.base_attack }}</span></div>
                  <div class="stat-row"><span :title="TOOLTIP_DEF">{{ STAT_FR.DEF }}</span><span>{{ detailUnit.base_defense }}</span></div>
                  <div class="stat-row"><span :title="TOOLTIP_SPD">{{ STAT_FR.SPD }}</span><span>{{ detailUnit.base_speed }}</span></div>
                  <div class="stat-row"><span :title="TOOLTIP_MASTERY">{{ STAT_FR.MASTERY }}</span><span>{{ detailUnit.mastery }}</span></div>
                </div>
              </section>
            </div>
            <div class="modal-grid-2 modal-grid-compact">
              <section class="modal-card nx-panel unit-skill-section">
                <h3 class="skill-section-title nx-subtitle">⚡ Compétence</h3>
                <p v-if="skillCooldown != null" class="skill-cd-badge" :title="TOOLTIP_CD">CD : {{ skillCooldown }} action{{ skillCooldown > 1 ? 's' : '' }}</p>
                <p class="skill-description-text">{{ descriptionSkill }}</p>
                <div class="unit-spec-section">
                  <p class="spec-section-title" :title="TOOLTIP_SPEC">Spécialisations</p>
                  <template v-if="hasSpecs">
                    <div v-if="specALabel || specAModifierText || descriptionSpecA" class="spec-block">
                      <p class="spec-line"><strong>Spécialisation A</strong> {{ specALabel }} {{ specAModifierText }}</p>
                      <p v-if="descriptionSpecA" class="spec-line spec-desc">{{ descriptionSpecA }}</p>
                    </div>
                    <div v-if="specBLabel || specBModifierText || descriptionSpecB" class="spec-block">
                      <p class="spec-line"><strong>Spécialisation B</strong> {{ specBLabel }} {{ specBModifierText }}</p>
                      <p v-if="descriptionSpecB" class="spec-line spec-desc">{{ descriptionSpecB }}</p>
                    </div>
                    <p v-if="!specALabel && !specAModifierText && !descriptionSpecA && !specBLabel && !specBModifierText && !descriptionSpecB" class="spec-line spec-empty">—</p>
                  </template>
                  <p v-else class="spec-line spec-empty">—</p>
                </div>
              </section>
              <section class="modal-card nx-panel modal-card-owned">
                <div class="card-title nx-subtitle">Statut</div>
                <div class="kv" v-if="isOwned(detailUnit.id)"><span>Possession</span><span class="owned-badge-inline">Vous possédez cette unité</span></div>
                <div class="kv" v-else><span>Possession</span><span class="locked-badge-inline">Non acquise</span></div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../api';
import {
  toRarityFr,
  toAttackTypeFr,
  toRoleFr,
  toElementFr,
  toArchetypeFr,
  toSkillKeyFr,
  toStatFr,
  toTraitFr,
  STAT_FR
} from '../utils/i18nFr';
import { normalizeSkillDescription, getBestiaryMultiSkillDescriptions } from '../utils/skillDescription';
import { getSkillTooltipPlainText } from '@engine/skillDescriptionTooltip.js';
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
  TOOLTIP_SPEC
} from '../utils/unitPopupTooltips';

type Unit = {
  id: number;
  code: string;
  name: string;
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
  traits?: string[] | null;
  skill_data?: Record<string, unknown> | null;
  specA_bonus_stat?: string | null;
  specB_bonus_stat?: string | null;
  specA_skill_modifier?: Record<string, unknown> | null;
  specB_skill_modifier?: Record<string, unknown> | null;
  specA_passive?: Record<string, unknown> | string | null;
  specB_passive?: Record<string, unknown> | string | null;
};

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const ELEMENT_COLUMNS = [
  { id: 'water', label: 'Eau' },
  { id: 'fire', label: 'Feu' },
  { id: 'plant', label: 'Plante' },
  { id: 'light', label: 'Lumière' },
  { id: 'dark', label: 'Ténèbres' }
];

const loading = ref(true);
const units = ref<Unit[]>([]);
const ownedUnitIds = ref<Set<number>>(new Set());
const detailUnit = ref<Unit | null>(null);

const filterElements = ref<Record<string, boolean>>({
  water: true, fire: true, plant: true, light: true, dark: true, neutral: true
});
const filterAttackTypes = ref<Record<string, boolean>>({
  melee: true, ranged: true
});
const filterRarities = ref<Record<string, boolean>>({
  common: true, uncommon: true, rare: true, epic: true, legendary: true, mythic: true
});
const filterTraits = ref<Record<string, boolean>>({
  GUARDIANS: false, DRUIDS: false, ARCANISTS: false, EXECUTIONERS: false, BERSERKERS: false, TACTICIANS: false
});
const sortBy = ref<string>('');
const sortOrder = ref<'asc' | 'desc'>('desc');

const elementOptions = [
  { id: 'water', label: 'Eau' },
  { id: 'fire', label: 'Feu' },
  { id: 'plant', label: 'Plante' },
  { id: 'light', label: 'Lumière' },
  { id: 'dark', label: 'Ténèbres' },
  { id: 'neutral', label: 'Neutre' }
];
const attackTypeOptions = [
  { id: 'melee', label: 'CAC' },
  { id: 'ranged', label: 'Distance' }
];
const rarityOptions = [
  { id: 'common', label: 'Commune' },
  { id: 'uncommon', label: 'Peu commune' },
  { id: 'rare', label: 'Rare' },
  { id: 'epic', label: 'Épique' },
  { id: 'legendary', label: 'Légendaire' },
  { id: 'mythic', label: 'Mythique' }
];
const traitOptions = [
  { id: 'GUARDIANS', label: 'Gardien' },
  { id: 'DRUIDS', label: 'Druide' },
  { id: 'ARCANISTS', label: 'Arcaniste' },
  { id: 'EXECUTIONERS', label: 'Bourreau' },
  { id: 'BERSERKERS', label: 'Berserker' },
  { id: 'TACTICIANS', label: 'Tacticien' }
];

function isOwned(unitId: number): boolean {
  return ownedUnitIds.value.has(unitId);
}

function rarityClass(r: string): string {
  return (r || 'common').toLowerCase();
}

function formatTraits(traits: Unit['traits']): string {
  if (!traits) return '';
  const arr = Array.isArray(traits) ? traits : (typeof traits === 'string' ? JSON.parse(traits || '[]') : []);
  return arr.map(toTraitFr).join(', ');
}

function formatStatKey(key: string): string {
  return toStatFr(key) || key;
}

function parseSkillData(skillData: Unit['skill_data']): Record<string, unknown> | null {
  if (skillData == null) return null;
  if (typeof skillData === 'object') return skillData as Record<string, unknown>;
  if (typeof skillData === 'string') {
    try {
      return JSON.parse(skillData) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function buildSkillDescription(skillData: Unit['skill_data']): string {
  const data = parseSkillData(skillData);
  if (!data) return '—';
  const basic = data.basic;
  if (basic && typeof basic === 'object') return toSkillKeyFr('BASIC');
  const skill = data.skill ?? data;
  if (!skill || typeof skill !== 'object') return '—';
  const s = skill as Record<string, unknown>;
  const type = String(s.type || '');
  const label = toSkillKeyFr(type);
  const parts: string[] = [label];
  if (s.mult != null) parts.push(`×${s.mult}`);
  if (s.cd_actions != null) parts.push(`CD ${s.cd_actions} actions`);
  if (s.debuff) parts.push(`débuff: ${String(s.debuff)}`);
  if (s.duration_actions != null) parts.push(`durée ${s.duration_actions} actions`);
  return parts.length > 1 ? `${parts[0]} (${parts.slice(1).join(', ')})` : parts[0] || '—';
}

function parseSpecModifier(mod: unknown): Record<string, unknown> | null {
  if (mod == null) return null;
  if (typeof mod === 'object') return mod as Record<string, unknown>;
  if (typeof mod === 'string') {
    try {
      return JSON.parse(mod) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function formatSpecModifier(mod: unknown): string {
  const m = parseSpecModifier(mod);
  if (!m) return '';
  const parts: string[] = [];
  const effects = m.effects as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(effects) && effects.length > 0) {
    const descs = effects.map((e) => {
      const t = String(e?.type ?? '').toUpperCase();
      const label = toSkillKeyFr(t) || t || 'Effet';
      if (t === 'DAMAGE') {
        const mult = e.mult ?? e.multiplier;
        return mult != null ? `${label} ×${mult}` : label;
      }
      if (t === 'HEAL') return e.percentMaxHp != null ? `${label} ${e.percentMaxHp}% PV` : (e.value != null ? `${label} ${e.value}` : label);
      if (t === 'APPLY_BUFF') {
        if ((e.buffType ?? '').toString().toUpperCase() === 'SHIELD') return e.percentMaxHpCaster != null ? `${label} ${e.percentMaxHpCaster}% PV` : (e.percentMaxHp != null ? `${label} ${e.percentMaxHp}% PV` : (e.value != null ? `${label} ${e.value}` : label));
        return e.buffType ? `${label} ${e.buffType}` : label;
      }
      if (t === 'APPLY_DEBUFF') return e.debuffType ? `${label} ${e.debuffType}` : label;
      return label;
    });
    parts.push(`Ajoute : ${descs.join(', ')}`);
  }
  if (m.mult != null) parts.push(`mult ×${m.mult}`);
  if (m.cd_actions != null) parts.push(`CD ${m.cd_actions} actions`);
  return parts.join(' · ');
}

function formatPassive(p: Unit['specA_passive']): string {
  if (p == null) return '';
  if (typeof p === 'string') return normalizeSkillDescription(p);
  if (typeof p === 'object' && p !== null && 'description' in p) return normalizeSkillDescription(String((p as { description?: string }).description || ''));
  return '';
}

const skillDescription = computed(() => buildSkillDescription(detailUnit.value?.skill_data));

function getMainSkillCooldown(skillData: Unit['skill_data']): number | null {
  const data = parseSkillData(skillData);
  if (!data) return null;
  const skills = data.skills as Array<{ type?: string; cd_actions?: number }> | undefined;
  if (Array.isArray(skills) && skills.length > 0) {
    const active = skills.find((s) => s && String(s?.type ?? '').toUpperCase() === 'ACTIVE');
    if (active && typeof active.cd_actions === 'number') return active.cd_actions;
  }
  const skill = (data.skill ?? data) as Record<string, unknown>;
  if (skill && typeof skill === 'object' && typeof skill.cd_actions === 'number') return skill.cd_actions;
  return null;
}

const skillCooldown = computed(() => getMainSkillCooldown(detailUnit.value?.skill_data ?? null));

function getDescriptionFromSkillData(skillData: Unit['skill_data']): { skill?: string; specA?: string; specB?: string } | null {
  if (!skillData || typeof skillData !== 'object') return null;
  const d = (skillData as Record<string, unknown>).description;
  if (!d || typeof d !== 'object') return null;
  return d as { skill?: string; specA?: string; specB?: string };
}

const descriptionSkill = computed(() => {
  const u = detailUnit.value;
  if (!u) return '—';
  const sd = u.skill_data;
  if (sd && typeof sd === 'object') {
    const multi = getBestiaryMultiSkillDescriptions(sd as Record<string, unknown>);
    if (multi.trim()) return multi.trim();
    const t = getSkillTooltipPlainText(sd as Record<string, unknown>);
    if (t.trim()) return normalizeSkillDescription(t);
  }
  return buildSkillDescription(u.skill_data ?? null) || '—';
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

function hasNoyau(unit: Unit): boolean {
  if (!unit.skill_data || typeof unit.skill_data !== 'object') return false;
  const sd = unit.skill_data as Record<string, unknown>;
  const noyau = sd.noyau;
  return noyau != null && typeof noyau === 'object' && typeof (noyau as { description?: string }).description === 'string';
}

const hasSpecs = computed(() => {
  const u = detailUnit.value;
  return !!(u?.specA_bonus_stat || u?.specB_bonus_stat || u?.specA_skill_modifier || u?.specB_skill_modifier || u?.specA_passive || u?.specB_passive);
});

const specALabel = computed(() => {
  const stat = detailUnit.value?.specA_bonus_stat;
  return stat ? `Bonus : ${formatStatKey(stat)}` : '';
});
const specBLabel = computed(() => {
  const stat = detailUnit.value?.specB_bonus_stat;
  return stat ? `Bonus : ${formatStatKey(stat)}` : '';
});
const specAModifierText = computed(() => formatSpecModifier(detailUnit.value?.specA_skill_modifier ?? null));
const specBModifierText = computed(() => formatSpecModifier(detailUnit.value?.specB_skill_modifier ?? null));
const specAPassiveText = computed(() => formatPassive(detailUnit.value?.specA_passive));
const specBPassiveText = computed(() => formatPassive(detailUnit.value?.specB_passive));
const detailUnitImageUrl = computed(() => getUnitImageUrl(detailUnit.value) ?? null);

function parseUnitTraits(traits: Unit['traits']): string[] {
  if (!traits) return [];
  if (Array.isArray(traits)) return traits.map((t) => String(t).toUpperCase());
  return [String(traits).toUpperCase()];
}

const filteredUnits = computed(() => {
  const u = units.value;
  const fe = filterElements.value;
  const fa = filterAttackTypes.value;
  const fr = filterRarities.value;
  const ft = filterTraits.value;
  const selectedTraits = Object.entries(ft).filter(([, v]) => v).map(([k]) => k);
  return u.filter((unit) => {
    const el = (unit.element || 'neutral').toLowerCase();
    const at = (unit.attack_type || 'melee').toLowerCase();
    const atKey = at === 'magic' ? 'ranged' : at; // magie → Distance
    const ra = (unit.rarity || 'common').toLowerCase();
    if (!fe[el] || !fa[atKey] || !fr[ra]) return false;
    if (selectedTraits.length === 0) return true;
    const unitTraits = parseUnitTraits(unit.traits);
    return selectedTraits.some((t) => unitTraits.includes(t));
  });
});

const sortedUnits = computed(() => {
  const list = [...filteredUnits.value];
  const key = sortBy.value as keyof Unit;
  const order = sortOrder.value;
  const statKeys = { base_hp: 1, base_attack: 1, base_defense: 1, base_speed: 1, mastery: 1 };
  if (!key || !(key in statKeys)) {
    list.sort((a, b) => {
      const ra = RARITY_ORDER.indexOf((a.rarity || 'common').toLowerCase());
      const rb = RARITY_ORDER.indexOf((b.rarity || 'common').toLowerCase());
      if (ra !== rb) return rb - ra;
      return (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
    });
    return list;
  }
  /* Tri par stat uniquement, sans regroupement par rareté */
  list.sort((a, b) => {
    const va = Number((a as Record<string, unknown>)[key]) || 0;
    const vb = Number((b as Record<string, unknown>)[key]) || 0;
    const diff = order === 'asc' ? va - vb : vb - va;
    if (diff !== 0) return diff;
    return (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
  });
  return list;
});

const elementColumns = computed(() => {
  const list = sortedUnits.value;
  return ELEMENT_COLUMNS.map((col) => {
    if (col.id === 'plant') {
      return { ...col, units: list.filter((u) => ['plant', 'neutral'].includes((u.element || 'neutral').toLowerCase())) };
    }
    return { ...col, units: list.filter((u) => (u.element || 'neutral').toLowerCase() === col.id) };
  });
});

function unitCardBgStyle(unit: Unit): Record<string, string> {
  const url = getUnitImageUrl(unit);
  if (!url) return {};
  return { '--unit-bg-image': `url(${url})` };
}

function openDetail(unit: Unit) {
  detailUnit.value = unit;
}

onMounted(async () => {
  loading.value = true;
  try {
    const { data } = await api.get('/bestiary');
    units.value = data.units || [];
    ownedUnitIds.value = new Set((data.ownedUnitIds || []).map(Number));
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.bestiaire {
  max-width: 100%;
  margin: 0 2px;
  background: #0f172a;
  padding: 0.3rem;
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.loading {
  padding: 2rem;
  color: #94a3b8;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding: 0.4rem 0;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.3);
}

.filter-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
}

.filter-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #94a3b8;
  width: 100%;
  margin-bottom: 0.25rem;
}

.filter-check {
  font-size: 0.85rem;
  color: #e5e7eb;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.filter-check input {
  cursor: pointer;
}

.sort-group {
  margin-left: auto;
}

.sort-select,
.sort-order {
  padding: 0.35rem 0.5rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: #1e293b;
  color: #e5e7eb;
  font-size: 0.85rem;
}

.columns {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.35rem;
}

.column {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.column-title {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #94a3b8;
  padding-bottom: 0.25rem;
  border-bottom: 2px solid rgba(148, 163, 184, 0.3);
}

.column-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bestiary-units {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 8px;
  align-items: stretch;
}

.unit-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.5rem 0.7rem;
  border-radius: 0.4rem;
  border: 2px solid rgba(0, 0, 0, 0.2);
  color: #e5e7eb;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.unit-card.bestiary-card {
  position: relative;
  overflow: hidden;
  height: 82px;
  border-radius: 10px;
  padding: 6px 10px;
  line-height: 1.15;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.unit-card.bestiary-card.unit-card-has-image::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--unit-bg-image);
  background-size: contain;
  background-position: right center;
  background-repeat: no-repeat;
  opacity: 0.35;
  pointer-events: none;
  z-index: 0;
}

.unit-card.bestiary-card.unit-card-has-image .row1,
.unit-card.bestiary-card.unit-card-has-image .row2 {
  position: relative;
  z-index: 1;
}

.unit-card.bestiary-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
}

.bestiary-card .row1 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.bestiary-card .row2 {
  display: flex;
  gap: 6px;
  flex-wrap: nowrap;
  overflow: hidden;
  opacity: 0.9;
  min-width: 0;
}

.bestiary-card .pill {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.bestiary-card .rarity-badge {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
}

.rarity-badge.rarity-common { background: rgba(120, 113, 108, 0.8); color: #fff; }
.rarity-badge.rarity-uncommon { background: rgba(34, 197, 94, 0.8); color: #fff; }
.rarity-badge.rarity-rare { background: rgba(59, 130, 246, 0.8); color: #fff; }
.rarity-badge.rarity-epic { background: rgba(168, 85, 247, 0.8); color: #fff; }
.rarity-badge.rarity-legendary { background: rgba(234, 179, 8, 0.9); color: #1f2937; }
.rarity-badge.rarity-mythic { background: rgba(220, 38, 38, 0.8); color: #fff; }

.unit-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.unit-card.owned {
  position: relative;
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.4);
}

/* Encoche verte en ::after pour ne pas écraser ::before (image) sur les cartes avec image */
.unit-card.owned::after {
  content: '✓';
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: #22c55e;
  color: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.9);
  z-index: 2;
  pointer-events: none;
}

.unit-card.locked {
  opacity: 0.9;
}

.unit-card.locked:hover {
  opacity: 1;
}

.unit-card.rarity-common { background: rgba(120, 113, 108, 0.92); border-color: rgba(120, 113, 108, 0.8); }
.unit-card.rarity-uncommon { background: rgba(34, 197, 94, 0.9); border-color: rgba(34, 197, 94, 0.8); }
.unit-card.rarity-rare { background: rgba(59, 130, 246, 0.9); border-color: rgba(59, 130, 246, 0.8); }
.unit-card.rarity-epic { background: rgba(168, 85, 247, 0.9); border-color: rgba(168, 85, 247, 0.8); }
.unit-card.rarity-legendary { background: rgba(234, 179, 8, 0.92); border-color: rgba(234, 179, 8, 0.85); color: #1f2937; }
.unit-card.rarity-mythic { background: rgba(220, 38, 38, 0.9); border-color: rgba(220, 38, 38, 0.8); }

.card-name {
  font-weight: 700;
  font-size: 0.85rem;
  line-height: 1.2;
}

.bestiary-card .card-name {
  font-size: 0.85rem;
  font-weight: 800;
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-attack,
.card-traits,
.card-rarity {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.85);
}

.unit-card.rarity-legendary .card-attack,
.unit-card.rarity-legendary .card-traits,
.unit-card.rarity-legendary .card-rarity {
  color: rgba(0, 0, 0, 0.75);
}

.unit-card.owned .card-attack,
.unit-card.owned .card-traits,
.unit-card.owned .card-rarity {
  color: #cbd5e1;
}

.unit-card.owned.rarity-legendary .card-attack,
.unit-card.owned.rarity-legendary .card-traits,
.unit-card.owned.rarity-legendary .card-rarity {
  color: #1e293b;
}

.badge-noyau {
  background: rgba(168, 85, 247, 0.35);
  color: #e9d5ff;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.pill-noyau {
  background: rgba(168, 85, 247, 0.35);
  color: #e9d5ff;
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

.skill-description-text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
  color: #cbd5e1;
  white-space: pre-line;
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

.spec-block {
  margin-top: 8px;
  padding: 6px 0;
  border-left: 3px solid rgba(148, 163, 184, 0.3);
  padding-left: 8px;
}
.spec-line.spec-stat { color: #94a3b8; font-size: 0.85rem; }
.spec-line.spec-mod { color: #a5b4fc; font-size: 0.85rem; }
.spec-line.spec-desc { color: #cbd5e1; }

/* Modal */
.nexus-modal .spec-passive {
  font-style: italic;
  color: rgba(148, 163, 184, 0.9);
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

.modal-unit-image {
  width: 100%;
  height: auto;
  max-height: 280px;
  object-fit: contain;
  object-position: center bottom;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.2);
  transition: filter 0.3s ease;
}

.modal-unit-image-wrap.modal-unit-image-blurred .modal-unit-image {
  filter: blur(10px);
  user-select: none;
  pointer-events: none;
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

@media (max-width: 1200px) {
  .columns {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .bestiaire {
    padding: 0.5rem;
  }
  .columns {
    grid-template-columns: repeat(2, 1fr);
  }
  .bestiaire-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

@media (max-width: 500px) {
  .columns {
    grid-template-columns: 1fr;
  }
}
</style>
