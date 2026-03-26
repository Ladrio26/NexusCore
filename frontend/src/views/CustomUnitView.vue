<template>
  <section class="cu-page" :class="elementClass">
    <div class="cu-bg" aria-hidden="true" />

    <div v-if="budgetHud" class="cu-budget-fixed" aria-live="polite">
      <CustomUnitBudgetBar
        :total="budgetHud.total"
        :max="budgetHud.max"
        label="Budget"
        :hint="budgetHudHint"
      />
    </div>

    <div class="cu-wrap">
      <CustomUnitHeader :has-custom-unit="hasUnit" :unit-name="existingName" />

      <p v-if="legacyNotice" class="cu-legacy-banner">
        {{ legacyNotice }}
      </p>
      <p v-if="roleStripNotice" class="cu-role-strip-banner">
        {{ roleStripNotice }}
      </p>

      <div class="cu-main-grid">
        <div class="cu-col-left">
          <CustomUnitIdentityCard
            v-model:name="name"
            :role="role"
            :element="element"
            :gameplay-hint="gameplayHint"
            :roles="roles"
            :elements="elements"
            @update:role="onRole"
            @update:element="onElement"
          />
          <CustomUnitSpecializationPanel
            :model-value="specBlock"
            @update:model-value="onSpecBlock"
          />
        </div>

        <div class="cu-col-center">
          <CustomUnitSkillBuilder
            v-if="uiOptions"
            v-model="unitConfig"
            :role="role"
            :options="uiOptions"
          />
          <p v-else class="cu-loading">Chargement des options…</p>
        </div>

        <div class="cu-col-right">
          <CustomUnitPreviewPanel :name="name" :role="role" :element="element" :preview="preview" />
        </div>
      </div>

      <p v-if="pageError" class="cu-page-err">{{ pageError }}</p>
    </div>

    <CustomUnitStickyActions
      :loading="loading"
      :valid="!!preview?.valid"
      :has-unit="hasUnit"
      :message="stickyMessage"
      :status="stickyStatus"
      @reset="resetAll"
      @preview="refreshPreview"
      @save="saveUpdate"
      @create="createUnit"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import api from '../api';
import CustomUnitHeader from '../components/customUnit/CustomUnitHeader.vue';
import CustomUnitIdentityCard from '../components/customUnit/CustomUnitIdentityCard.vue';
import CustomUnitSkillBuilder from '../components/customUnit/CustomUnitSkillBuilder.vue';
import type { EffectSlot, UnitConfig } from '../components/customUnit/effectSlotTypes';
import CustomUnitSpecializationPanel, {
  type SpecBlock
} from '../components/customUnit/CustomUnitSpecializationPanel.vue';
import { migrateSkillBlock } from '../components/customUnit/customUnitConfigMigrate';
import CustomUnitPreviewPanel from '../components/customUnit/CustomUnitPreviewPanel.vue';
import CustomUnitStickyActions from '../components/customUnit/CustomUnitStickyActions.vue';
import CustomUnitBudgetBar from '../components/customUnit/CustomUnitBudgetBar.vue';
import { sanitizeUnitConfigForRole } from '../components/customUnit/customUnitRoleRules';

function defaultConfig(): UnitConfig {
  return {
    specAStat: 'attack',
    specBStat: 'defense',
    skill1SpecBonus: 'SELF_ATK',
    hasSkill2: false,
    skill1: {
      effects: [
        { id: 'DAMAGE', target: 'ENEMY_SINGLE', modifiers: [] },
        { id: '', target: 'ENEMY_SINGLE', modifiers: [] },
        { id: '', target: 'ENEMY_SINGLE', modifiers: [] }
      ],
      cooldownModifier: 0
    },
    skill2: {
      type: 'ACTIVE',
      effects: [
        { id: 'ATK_UP', target: 'ALLY_SINGLE', modifiers: [] },
        { id: '', target: 'ALLY_SINGLE', modifiers: [] },
        { id: '', target: 'ALLY_SINGLE', modifiers: [] }
      ],
      cooldownModifier: 0
    }
  };
}

function mergeServerConfig(raw: unknown): UnitConfig {
  const d = defaultConfig();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const s2raw = r.skill2 && typeof r.skill2 === 'object' ? (r.skill2 as Record<string, unknown>) : {};
  const wasPassive = String(s2raw.type || '').toUpperCase() === 'PASSIVE';
  const s1 = migrateSkillBlock(r.skill1 && typeof r.skill1 === 'object' ? (r.skill1 as object) : {}, 'ENEMY_SINGLE', 3);
  const s2m = migrateSkillBlock(s2raw, wasPassive ? 'SELF' : 'ENEMY_SINGLE', wasPassive ? 2 : 3);
  const hasSkill2 = r.hasSkill2 === false ? false : true;
  const fx = (s2m.effects || []) as EffectSlot[];
  const effects3: EffectSlot[] = [];
  for (let i = 0; i < 3; i++) {
    effects3.push(
      fx[i] ?? {
        id: '',
        target: 'ENEMY_SINGLE',
        modifiers: []
      }
    );
  }
  const specA = (r.specAStat as UnitConfig['specAStat']) || d.specAStat;
  const specB = (r.specBStat as UnitConfig['specBStat']) || d.specBStat;
  const specBonus = (r.skill1SpecBonus as UnitConfig['skill1SpecBonus']) || d.skill1SpecBonus;
  return {
    specAStat: specA,
    specBStat: specB,
    skill1SpecBonus: specBonus,
    hasSkill2,
    skill1: { ...d.skill1, ...s1 },
    skill2: {
      type: 'ACTIVE',
      effects: effects3,
      cooldownModifier: s2m.cooldownModifier ?? 0
    }
  };
}

const name = ref('');
const role = ref('dps');
const element = ref('fire');
const unitConfig = ref<UnitConfig>(defaultConfig());
const uiOptions = ref<Record<string, unknown> | null>(null);
const preview = ref<Record<string, unknown> | null>(null);
const loading = ref(false);
const pageError = ref('');
const hasUnit = ref(false);
const existingName = ref<string | null>(null);
const legacyNotice = ref('');
const roleStripNotice = ref('');

const roles = computed(() => (uiOptions.value?.roles as string[]) || []);
const elements = computed(() => (uiOptions.value?.elements as string[]) || []);

const budgetHud = computed(() => {
  const b = preview.value?.budget as Record<string, unknown> | undefined;
  if (!b || b.totalCost == null || b.maxBudget == null) return null;
  return {
    total: Number(b.totalCost),
    max: Number(b.maxBudget),
    remainingPoints: b.remainingPoints != null ? Number(b.remainingPoints) : undefined
  };
});

const budgetHudHint = computed(() => {
  const r = budgetHud.value?.remainingPoints;
  if (r == null) return '';
  if (r < 0) return 'Budget dépassé : retirez des effets ou modificateurs.';
  if (r === 0) return 'Budget utilisé au maximum.';
  return `Il reste ${r} point${r > 1 ? 's' : ''}.`;
});

const gameplayHint = computed(() => {
  const hints: Record<string, string> = {
    dps: 'DPS — unité distance orientée dégâts et tempo.',
    tank: 'Tank — unité CAC, PV et défense.',
    support: 'Support — distance, vitesse et maîtrise.',
    assassin: 'Assassin — CAC, attaque et défense.'
  };
  return hints[role.value] || '';
});

const elementClass = computed(() => `cu-el--${element.value}`);

const specBlock = computed<SpecBlock>(() => ({
  specAStat: unitConfig.value.specAStat ?? 'attack',
  specBStat: unitConfig.value.specBStat ?? 'defense',
  skill1SpecBonus: unitConfig.value.skill1SpecBonus ?? 'SELF_ATK'
}));

function onSpecBlock(s: SpecBlock) {
  unitConfig.value = {
    ...unitConfig.value,
    specAStat: s.specAStat,
    specBStat: s.specBStat,
    skill1SpecBonus: s.skill1SpecBonus
  };
}

const stickyMessage = computed(() => {
  const p = preview.value;
  if (!p) return '';
  if (p.valid) {
    const w = (p.warnings as string[]) || [];
    const bw = (p.balanceWarnings as string[]) || [];
    const all = [...w, ...bw];
    if (all.length) return all[0];
    return '';
  }
  const err = (p.errors as string[]) || [];
  return err[0] || '';
});

const stickyStatus = computed((): 'incomplete' | 'valid' | 'error' | 'warning' => {
  const p = preview.value;
  if (!p) return 'incomplete';
  if (p.valid) {
    const w = (p.warnings as string[]) || [];
    const bw = (p.balanceWarnings as string[]) || [];
    if (w.length || bw.length) return 'warning';
    return 'valid';
  }
  if ((p.errors as string[])?.length) return 'error';
  return 'incomplete';
});

function onRole(r: string) {
  const prev = role.value;
  if (prev === r) return;
  role.value = r;
  const next = sanitizeUnitConfigForRole(unitConfig.value, r) as UnitConfig;
  if (JSON.stringify(next) !== JSON.stringify(unitConfig.value)) {
    unitConfig.value = next;
    roleStripNotice.value = 'Certains effets ont été retirés car incompatibles avec le rôle';
  }
}

function onElement(e: string) {
  element.value = e;
}

async function loadOptions() {
  try {
    const { data } = await api.get('/custom-unit/options');
    uiOptions.value = data;
  } catch (e: unknown) {
    pageError.value = 'Impossible de charger les options de budget.';
    console.error(e);
  }
}

let previewTimer: ReturnType<typeof setTimeout> | null = null;
async function refreshPreview() {
  if (!uiOptions.value) return;
  loading.value = true;
  pageError.value = '';
  try {
    const { data } = await api.post('/custom-unit/preview', {
      role: role.value,
      element: element.value,
      config: unitConfig.value
    });
    preview.value = data;
  } catch (e: unknown) {
    pageError.value = 'Erreur de prévisualisation.';
    console.error(e);
  } finally {
    loading.value = false;
  }
}

watch([role, element, unitConfig], () => {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    void refreshPreview();
  }, 200);
});

function resetAll() {
  unitConfig.value = sanitizeUnitConfigForRole(defaultConfig(), role.value) as UnitConfig;
  roleStripNotice.value = '';
  void refreshPreview();
}

async function loadMe() {
  try {
    await loadOptions();
    const { data } = await api.get('/custom-unit/me');
    const cu = data.customUnit;
    if (cu) {
      hasUnit.value = true;
      existingName.value = cu.name;
      name.value = cu.name;
      role.value = cu.role;
      element.value = cu.element;
      if (cu.config) {
        unitConfig.value = sanitizeUnitConfigForRole(mergeServerConfig(cu.config), cu.role) as UnitConfig;
        legacyNotice.value = '';
      } else if (Array.isArray(cu.selectedKeys) && cu.selectedKeys.length > 0) {
        unitConfig.value = sanitizeUnitConfigForRole(defaultConfig(), cu.role) as UnitConfig;
        legacyNotice.value =
          'Cette unité a été créée avec l’ancien arbre. Reconfigure-la ici puis enregistre pour passer au budget de points.';
      } else {
        unitConfig.value = sanitizeUnitConfigForRole(defaultConfig(), cu.role) as UnitConfig;
        legacyNotice.value = '';
      }
      await nextTick();
      await refreshPreview();
    } else {
      hasUnit.value = false;
      legacyNotice.value = '';
      unitConfig.value = sanitizeUnitConfigForRole(defaultConfig(), role.value) as UnitConfig;
      await nextTick();
      await refreshPreview();
    }
  } catch (e) {
    console.error(e);
  }
}

async function createUnit() {
  loading.value = true;
  pageError.value = '';
  try {
    await api.post('/custom-unit/create', {
      name: name.value,
      role: role.value,
      element: element.value,
      config: unitConfig.value
    });
    await loadMe();
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { message?: string } } };
    pageError.value = ax.response?.data?.message || 'Création impossible.';
  } finally {
    loading.value = false;
  }
}

async function saveUpdate() {
  loading.value = true;
  pageError.value = '';
  try {
    await api.post('/custom-unit/update', {
      name: name.value,
      role: role.value,
      element: element.value,
      config: unitConfig.value
    });
    await loadMe();
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { message?: string } } };
    pageError.value = ax.response?.data?.message || 'Mise à jour impossible.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadMe();
});
</script>

<style scoped>
.cu-page {
  min-height: 100vh;
  padding: 1.25rem 1rem 6.5rem;
  position: relative;
  overflow-x: hidden;
  transition:
    background 0.35s ease,
    --cu-accent 0.35s ease;
  font-family:
    'Outfit',
    system-ui,
    -apple-system,
    sans-serif;
}
.cu-page :deep(.cu-title),
.cu-page :deep(.cu-skill-title),
.cu-page :deep(.cu-preview-title),
.cu-page :deep(.cu-id-title) {
  font-family:
    'Orbitron',
    system-ui,
    sans-serif;
}
.cu-el--fire {
  --cu-glow: rgba(249, 115, 22, 0.14);
  --cu-accent: #f97316;
}
.cu-el--water {
  --cu-glow: rgba(56, 189, 248, 0.14);
  --cu-accent: #38bdf8;
}
.cu-el--plant {
  --cu-glow: rgba(74, 222, 128, 0.14);
  --cu-accent: #4ade80;
}
.cu-el--light {
  --cu-glow: rgba(253, 224, 71, 0.12);
  --cu-accent: #fde047;
}
.cu-el--dark {
  --cu-glow: rgba(167, 139, 250, 0.14);
  --cu-accent: #a78bfa;
}
.cu-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse 90% 55% at 50% -15%, var(--cu-glow), transparent 55%),
    radial-gradient(ellipse 60% 40% at 100% 0%, rgba(15, 23, 42, 0.5), transparent 50%);
  z-index: 0;
}
/* Aligné sur App.vue : barre mobile 44px sous 768px */
.cu-budget-fixed {
  position: fixed;
  top: max(0.65rem, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  width: min(20rem, calc(100vw - 1.5rem));
  pointer-events: auto;
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(148, 163, 184, 0.12);
  border-radius: 14px;
  backdrop-filter: blur(10px);
}
@media (max-width: 768px) {
  .cu-budget-fixed {
    top: calc(44px + env(safe-area-inset-top, 0px) + 0.35rem);
  }
}
.cu-budget-fixed :deep(.cu-budget) {
  margin: 0;
}
.cu-wrap {
  position: relative;
  z-index: 1;
  max-width: 1320px;
  margin: 0 auto;
}
.cu-main-grid {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr) minmax(280px, 320px);
  gap: 1.25rem;
  align-items: start;
}
@media (max-width: 1100px) {
  .cu-main-grid {
    grid-template-columns: 1fr;
  }
}
.cu-col-left,
.cu-col-center,
.cu-col-right {
  min-width: 0;
}
.cu-page-err {
  color: #fca5a5;
  margin-top: 1rem;
  font-size: 0.9rem;
}
.cu-legacy-banner {
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.35);
  color: #fde68a;
  padding: 0.65rem 0.85rem;
  border-radius: 12px;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}
.cu-role-strip-banner {
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #bae6fd;
  padding: 0.55rem 0.85rem;
  border-radius: 12px;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}
.cu-loading {
  color: #94a3b8;
  font-size: 0.9rem;
  padding: 1rem;
}
</style>
