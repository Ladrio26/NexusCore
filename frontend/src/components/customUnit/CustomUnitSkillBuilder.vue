<template>
  <div class="cu-skill">
    <section class="cu-skill-block cu-skill-block--accent">
      <header class="cu-skill-h">
        <span class="cu-skill-badge">1</span>
        <div>
          <h3 class="cu-skill-title">Compétence I</h3>
          <p class="cu-skill-sub">Active — chaque effet a sa cible et ses modificateurs</p>
        </div>
      </header>

      <div class="cu-skill-fields">
        <div class="cu-field cu-field--full">
          <span class="cu-field-lbl">Filtrer par type</span>
          <CustomDropdown
            v-model="principalType1"
            :options="principalTypeOptions"
            label="Type principal"
            placeholder="Tous les types"
          />
        </div>

        <div
          v-for="idx in S1_COUNT"
          :key="'s1-' + (idx - 1)"
          class="cu-effect-block"
        >
          <div class="cu-effect-row-grid">
            <div class="cu-effect-col">
              <span class="cu-field-lbl">Effet {{ idx }}</span>
              <CustomDropdown
                v-model="local.skill1.effects[idx - 1].id"
                :options="effectOpts('skill1', idx - 1, principalType1)"
                :label="'Effet ' + idx"
                placeholder="— Aucun —"
                @update:model-value="onEffectChanged('skill1', idx - 1)"
              />
            </div>
            <div class="cu-effect-col">
              <span class="cu-field-lbl">Cible</span>
              <div class="cu-target-wrap">
                <CustomDropdown
                  v-model="local.skill1.effects[idx - 1].target"
                  :options="targetOptionsFor('skill1', idx - 1)"
                  label="Cible"
                  @update:model-value="onTargetChanged('skill1', idx - 1)"
                />
                <span
                  v-if="isTeamAoeTarget(local.skill1.effects[idx - 1].target)"
                  class="cu-target-cost-hint"
                >Coût ×3</span>
              </div>
            </div>
          </div>
          <div class="cu-effect-mods">
            <span class="cu-field-lbl">Modificateurs (effet {{ idx }})</span>
            <div class="cu-mod-grid">
              <button
                v-for="m in modifierKeysForRow('skill1', idx - 1)"
                :key="'s1-' + idx + '-' + m"
                type="button"
                class="cu-mod-pill"
                :class="{ 'is-on': local.skill1.effects[idx - 1].modifiers.includes(m) }"
                @click="toggleModSlot('skill1', idx - 1, m)"
              >
                <CustomTooltip :title="MODIFIER_LABELS[m] || m" :cost="modifierCosts[m]">
                  <span>{{ shortMod(m) }}</span>
                </CustomTooltip>
              </button>
            </div>
          </div>
        </div>

        <div class="cu-field">
          <span class="cu-field-lbl">Recharge (compétence)</span>
          <CustomDropdown v-model="cd1" :options="cooldownSelectOptions" label="Cooldown" @update:model-value="onCd1" />
        </div>
      </div>
    </section>

    <section class="cu-skill-block">
      <header class="cu-skill-h">
        <span class="cu-skill-badge cu-skill-badge--2">2</span>
        <div>
          <h3 class="cu-skill-title">Compétence II</h3>
          <p class="cu-skill-sub">Optionnelle — compétence active uniquement</p>
        </div>
      </header>

      <div class="cu-toggle-row">
        <span class="cu-field-lbl">Inclure une 2ᵉ compétence</span>
        <div class="cu-seg">
          <button
            type="button"
            class="cu-seg-btn"
            :class="{ active: !local.hasSkill2 }"
            @click="setHasSkill2(false)"
          >
            Non
          </button>
          <button
            type="button"
            class="cu-seg-btn"
            :class="{ active: local.hasSkill2 }"
            @click="setHasSkill2(true)"
          >
            Oui
          </button>
        </div>
      </div>

      <p v-if="!local.hasSkill2" class="cu-skill-off-hint">
        L’unité n’aura qu’une seule compétence active (la compétence I) en combat et dans la collection.
      </p>

      <template v-if="local.hasSkill2">
      <div class="cu-skill-fields">
        <div class="cu-field cu-field--full">
          <span class="cu-field-lbl">Filtrer par type</span>
          <CustomDropdown
            v-model="principalType2"
            :options="principalTypeOptions"
            label="Type principal"
            placeholder="Tous les types"
          />
        </div>

        <div
          v-for="idx in S2_ACTIVE_COUNT"
          :key="'s2a-' + (idx - 1)"
          class="cu-effect-block"
        >
          <div class="cu-effect-row-grid">
            <div class="cu-effect-col">
              <span class="cu-field-lbl">Effet {{ idx }}</span>
              <CustomDropdown
                v-model="local.skill2.effects[idx - 1].id"
                :options="effectOpts('skill2', idx - 1, principalType2)"
                :label="'Effet ' + idx"
                placeholder="— Aucun —"
                @update:model-value="onEffectChanged('skill2', idx - 1)"
              />
            </div>
            <div class="cu-effect-col">
              <span class="cu-field-lbl">Cible</span>
              <div class="cu-target-wrap">
                <CustomDropdown
                  v-model="local.skill2.effects[idx - 1].target"
                  :options="targetOptionsFor('skill2', idx - 1)"
                  label="Cible"
                  @update:model-value="onTargetChanged('skill2', idx - 1)"
                />
                <span
                  v-if="isTeamAoeTarget(local.skill2.effects[idx - 1].target)"
                  class="cu-target-cost-hint"
                >Coût ×3</span>
              </div>
            </div>
          </div>
          <div class="cu-effect-mods">
            <span class="cu-field-lbl">Modificateurs (effet {{ idx }})</span>
            <div class="cu-mod-grid">
              <button
                v-for="m in modifierKeysForRow('skill2', idx - 1)"
                :key="'s2a-' + idx + '-' + m"
                type="button"
                class="cu-mod-pill"
                :class="{ 'is-on': local.skill2.effects[idx - 1].modifiers.includes(m) }"
                @click="toggleModSlot('skill2', idx - 1, m)"
              >
                <CustomTooltip :title="MODIFIER_LABELS[m] || m" :cost="modifierCosts[m]">
                  <span>{{ shortMod(m) }}</span>
                </CustomTooltip>
              </button>
            </div>
          </div>
        </div>

        <div class="cu-field">
          <span class="cu-field-lbl">Recharge (compétence)</span>
          <CustomDropdown v-model="cd2" :options="cooldownSelectOptions" label="Cooldown" @update:model-value="onCd2" />
        </div>
      </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import CustomDropdown, { type CuDropdownOption } from './CustomDropdown.vue';
import CustomTooltip from './CustomTooltip.vue';
import type { EffectSlot, SkillBlock, UnitConfig } from './effectSlotTypes';
import {
  COOLDOWN_OPTIONS,
  MODIFIER_LABELS,
  PRINCIPAL_TYPES,
  formatEffectDisplayLabel,
  formatTargetLabel,
  getEffectCategory
} from './customUnitUiConstants';
import { isEffectDisabledForSlot, type SlotBrief } from './customUnitUiRules';
import { allowedTargetsForEffectAndRole, roleRuleDisabledReason } from './customUnitRoleRules';
import {
  clampCooldownModifier,
  effectAllowsDurationModifier,
  effectSupportsDamage20Percent,
  pickDefaultTargetForEffect,
  sanitizeModifiersForEffect
} from './customUnitTargeting';

export type { EffectSlot, SkillBlock, UnitConfig } from './effectSlotTypes';

const S1_COUNT = 3;
const S2_ACTIVE_COUNT = 3;

const props = defineProps<{
  modelValue: UnitConfig;
  role: string;
  options: {
    effectCosts?: Record<string, number>;
    modifierCosts?: Record<string, number>;
  } | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: UnitConfig): void;
}>();

const principalType1 = ref('ALL');
const principalType2 = ref('ALL');

const effectCosts = computed(() => props.options?.effectCosts || {});
const modifierCosts = computed(() => {
  const raw = props.options?.modifierCosts || {};
  const out: Record<string, number> = { ...raw };
  delete out.CD_MINUS_1;
  return out;
});

function targetOptionsFor(sk: 'skill1' | 'skill2', slot: number): CuDropdownOption[] {
  const row = local[sk].effects[slot];
  const id = row?.id || '';
  return allowedTargetsForEffectAndRole(id, props.role, local[sk]).map((t) => ({
    value: t,
    label: formatTargetLabel(t),
    category: 'OTHER'
  }));
}

function clampAllTargetsForRole() {
  for (const sk of ['skill1', 'skill2'] as const) {
    for (let slot = 0; slot < local[sk].effects.length; slot++) {
      const row = local[sk].effects[slot];
      if (!row?.id) continue;
      const allowed = allowedTargetsForEffectAndRole(row.id, props.role, local[sk]);
      const cur = String(row.target || '')
        .trim()
        .toUpperCase();
      if (!allowed.includes(cur)) {
        row.target = allowed[0] ?? pickDefaultTargetForEffect(row.id);
      }
      row.modifiers = sanitizeModifiersForEffect(row.id, row.modifiers || [], row.target);
    }
  }
}

/** Équipe ennemie / équipe alliée : multiplicateur de coût ×3 (aligné backend). */
function isTeamAoeTarget(target: string | undefined): boolean {
  const u = String(target || '')
    .trim()
    .toUpperCase();
  return u === 'TEAM_ENEMY' || u === 'TEAM_ALLY';
}

function modifierKeysForRow(sk: 'skill1' | 'skill2', slot: number): string[] {
  const row = local[sk].effects[slot];
  const id = row?.id || '';
  const tgt = String(row?.target || '')
    .trim()
    .toUpperCase();
  return Object.keys(modifierCosts.value)
    .filter((k) => {
      if (k === 'DURATION_1' || k === 'DURATION_2') {
        return effectAllowsDurationModifier(id, k, tgt);
      }
      if (k === 'DAMAGE_20_PERCENT') return effectSupportsDamage20Percent(id);
      return true;
    })
    .sort();
}

const principalTypeOptions = computed((): CuDropdownOption[] =>
  PRINCIPAL_TYPES.map((p) => ({
    value: p.id,
    label: p.label,
    category: 'OTHER'
  }))
);

const cooldownSelectOptions = computed((): CuDropdownOption[] =>
  COOLDOWN_OPTIONS.map((o) => ({
    value: String(o.value),
    label: o.label,
    category: 'OTHER'
  }))
);

function emptySlot(defaultT: string): EffectSlot {
  return { id: '', target: defaultT, modifiers: [] };
}

function ensureSkillEffects(sk: SkillBlock, count: number, defaultT: string): EffectSlot[] {
  const arr = [...(sk.effects || [])];
  while (arr.length < count) arr.push(emptySlot(defaultT));
  return arr.slice(0, count).map((e) => ({
    id: e.id || '',
    target: e.target || defaultT,
    modifiers: [...(e.modifiers || [])]
  }));
}

function normalizeIncoming(v: UnitConfig): UnitConfig {
  const s2 = { ...v.skill2, type: 'ACTIVE' as const };
  delete (s2 as { passiveTrigger?: string }).passiveTrigger;
  return {
    hasSkill2: v.hasSkill2 !== false,
    skill1: {
      ...v.skill1,
      effects: ensureSkillEffects(v.skill1, S1_COUNT, 'ENEMY_SINGLE')
    },
    skill2: {
      ...s2,
      effects: ensureSkillEffects(s2, S2_ACTIVE_COUNT, 'ENEMY_SINGLE')
    }
  };
}

const local = reactive(normalizeIncoming(JSON.parse(JSON.stringify(props.modelValue)) as UnitConfig));

const cd1 = ref('0');
const cd2 = ref('0');

function shortMod(m: string) {
  if (m === 'DURATION_1') return 'Durée +1';
  if (m === 'DURATION_2') return 'Durée +2';
  if (m === 'DAMAGE_20_PERCENT') return 'Dégâts +20%';
  return m;
}

function syncCdFromLocal() {
  cd1.value = String(clampCooldownModifier(Number(local.skill1.cooldownModifier ?? 0)));
  cd2.value = String(clampCooldownModifier(Number(local.skill2.cooldownModifier ?? 0)));
}

watch(
  () => props.modelValue,
  (v) => {
    const n = normalizeIncoming(v);
    const s = JSON.stringify(n);
    if (s !== JSON.stringify(local)) {
      Object.assign(local, JSON.parse(s));
      syncCdFromLocal();
      clampAllTargetsForRole();
    }
  },
  { deep: true }
);

watch(
  () => props.role,
  () => {
    clampAllTargetsForRole();
    emitUp();
  }
);

syncCdFromLocal();

function emitUp() {
  emit('update:modelValue', JSON.parse(JSON.stringify(local)) as UnitConfig);
}

onMounted(() => {
  const snap = JSON.stringify(local);
  clampAllTargetsForRole();
  if (JSON.stringify(local) !== snap) {
    emitUp();
  }
});

function onCd1(v: string) {
  const n = Number(v);
  local.skill1.cooldownModifier = clampCooldownModifier(Number.isFinite(n) ? n : 0);
  emitUp();
}

function onCd2(v: string) {
  const n = Number(v);
  local.skill2.cooldownModifier = clampCooldownModifier(Number.isFinite(n) ? n : 0);
  emitUp();
}

function onTargetChanged(sk: 'skill1' | 'skill2', slot: number) {
  const row = local[sk].effects[slot];
  if (!row) return;
  row.modifiers = sanitizeModifiersForEffect(row.id, row.modifiers || [], row.target);
  emitUp();
}

function onEffectChanged(sk: 'skill1' | 'skill2', slot: number) {
  const row = local[sk].effects[slot];
  if (!row) return;
  const allowed = allowedTargetsForEffectAndRole(row.id, props.role, local[sk]);
  const cur = String(row.target || '')
    .trim()
    .toUpperCase();
  if (!allowed.includes(cur)) {
    row.target = allowed[0] ?? pickDefaultTargetForEffect(row.id);
  }
  row.modifiers = sanitizeModifiersForEffect(row.id, row.modifiers || [], row.target);
  emitUp();
}

function toggleModSlot(sk: 'skill1' | 'skill2', slot: number, m: string) {
  const row = local[sk].effects[slot];
  if (!row) return;
  const arr = row.modifiers;
  const i = arr.indexOf(m);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(m);
  emitUp();
}

function setHasSkill2(on: boolean) {
  local.hasSkill2 = on;
  emitUp();
}

/** Réduction de CD alliée : visible sous Buffs et Contrôle / tempo (un seul getEffectCategory = BUFF). */
const CD_DOWN_IDS = new Set(['CD_DOWN_1', 'CD_DOWN_2']);

function buildEffectList(principal: string) {
  const ec = effectCosts.value;
  return Object.keys(ec)
    .sort((a, b) => a.localeCompare(b))
    .filter((id) => {
      if (principal === 'ALL') return true;
      if (CD_DOWN_IDS.has(id) && (principal === 'BUFF' || principal === 'CONTROL')) return true;
      return getEffectCategory(id) === principal;
    });
}

/** Cible utilisée pour la règle de rôle : hypothèse valide pour tester si l’effet est autorisé pour le rôle. */
function targetForRoleRuleCheck(
  effectId: string,
  rowTarget: string,
  skillKey: 'skill1' | 'skill2'
): string {
  const allowed = allowedTargetsForEffectAndRole(effectId, props.role, local[skillKey]);
  const t = String(rowTarget || '')
    .trim()
    .toUpperCase();
  if (allowed.includes(t)) return t;
  return allowed[0] ?? pickDefaultTargetForEffect(effectId);
}

function slotBriefs(skillKey: 'skill1' | 'skill2'): SlotBrief[] {
  const sk = local[skillKey];
  return sk.effects.map((e) => ({ id: e.id, target: e.target }));
}

/** Effet affiché dans la liste : sélectionnable, ou bien déjà choisi sur cette ligne (pour garder le libellé). */
function shouldIncludeEffectInList(
  id: string,
  skillKey: 'skill1' | 'skill2',
  slot: number,
  rowTarget: string
): boolean {
  const row = local[skillKey].effects[slot];
  const current = String(row?.id || '').trim();
  if (id === current) return true;
  const { disabled } = isEffectDisabledForSlot(id, slot, slotBriefs(skillKey), rowTarget);
  if (disabled) return false;
  const roleReason = roleRuleDisabledReason(
    local[skillKey],
    id,
    props.role,
    targetForRoleRuleCheck(id, rowTarget, skillKey)
  );
  return !roleReason;
}

function toEffectOption(id: string): CuDropdownOption {
  const cost = effectCosts.value[id];
  const cat = getEffectCategory(id);
  return {
    value: id,
    label: formatEffectDisplayLabel(id),
    cost,
    category: cat
  };
}

function effectOpts(skillKey: 'skill1' | 'skill2', slot: number, principal: string) {
  const row = local[skillKey].effects[slot];
  const rowTarget = row?.target || 'ENEMY_SINGLE';
  const ids = buildEffectList(principal);
  const opts: CuDropdownOption[] = [
    { value: '', label: slot === 0 && skillKey === 'skill1' ? '— Choisir —' : '— Aucun —', category: 'OTHER' }
  ];
  for (const id of ids) {
    if (!shouldIncludeEffectInList(id, skillKey, slot, rowTarget)) continue;
    opts.push(toEffectOption(id));
  }
  return opts;
}

</script>

<style scoped>
.cu-skill {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.cu-skill-block {
  padding: 1rem 1.1rem;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(165deg, rgba(30, 41, 59, 0.45), rgba(15, 23, 42, 0.88));
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
  transition:
    border-color 0.22s ease,
    box-shadow 0.22s ease;
}
.cu-skill-block--accent {
  border-color: rgba(251, 191, 36, 0.22);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35), 0 0 40px rgba(251, 191, 36, 0.06);
}
.cu-skill-h {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.cu-skill-badge {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 1rem;
  background: linear-gradient(145deg, rgba(251, 191, 36, 0.35), rgba(120, 53, 15, 0.5));
  border: 1px solid rgba(251, 191, 36, 0.45);
  color: #fffbeb;
}
.cu-skill-badge--2 {
  background: linear-gradient(145deg, rgba(56, 189, 248, 0.3), rgba(30, 58, 138, 0.55));
  border-color: rgba(56, 189, 248, 0.45);
}
.cu-skill-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.cu-skill-sub {
  margin: 0.15rem 0 0;
  font-size: 0.78rem;
  color: rgba(148, 163, 184, 0.95);
}
.cu-skill-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.cu-effect-block {
  padding: 0.75rem 0.85rem;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.35);
  border: 1px solid rgba(148, 163, 184, 0.12);
}
.cu-effect-row-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1rem;
  align-items: start;
}
@media (max-width: 640px) {
  .cu-effect-row-grid {
    grid-template-columns: 1fr;
  }
}
.cu-effect-mods {
  margin-top: 0.65rem;
  padding-top: 0.65rem;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
}
.cu-field--full {
  width: 100%;
}
.cu-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.cu-field-lbl {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: rgba(148, 163, 184, 0.95);
}
.cu-target-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  width: 100%;
}
.cu-target-wrap :deep(.cu-dd) {
  flex: 1;
  min-width: 0;
}
.cu-target-cost-hint {
  flex-shrink: 0;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fbbf24;
  white-space: nowrap;
  text-shadow: 0 0 12px rgba(251, 191, 36, 0.35);
}
.cu-mod-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.cu-mod-pill {
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.65);
  color: #e2e8f0;
  font-size: 0.72rem;
  padding: 0.4rem 0.75rem;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}
.cu-mod-pill.is-on {
  border-color: rgba(52, 211, 153, 0.55);
  background: rgba(16, 185, 129, 0.18);
  box-shadow: 0 0 14px rgba(52, 211, 153, 0.2);
}
.cu-toggle-row {
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.cu-seg {
  display: flex;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.3);
}
.cu-seg-btn {
  flex: 1;
  padding: 0.55rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 700;
  border: none;
  background: rgba(15, 23, 42, 0.6);
  color: #94a3b8;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}
.cu-seg-btn.active {
  background: linear-gradient(180deg, rgba(56, 189, 248, 0.25), rgba(30, 41, 59, 0.95));
  color: #f0f9ff;
}
.cu-skill-off-hint {
  margin: 0 0 0.25rem;
  font-size: 0.82rem;
  line-height: 1.45;
  color: rgba(148, 163, 184, 0.95);
}
</style>
