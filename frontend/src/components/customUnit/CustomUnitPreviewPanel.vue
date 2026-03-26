<template>
  <aside class="cu-preview">
    <h2 class="cu-preview-title">Aperçu</h2>

    <div class="cu-preview-head">
      <div class="cu-ph-name">{{ name || '—' }}</div>
      <div class="cu-ph-meta">{{ roleDisplay }} · {{ elementLabel }} · {{ attackLabel }}</div>
    </div>

    <div v-if="powerRating" class="cu-rating-row">
      <span class="cu-rating-label">Niveau estimé</span>
      <span class="cu-rating-badge" :class="'cu-rating--' + String(powerRating).toLowerCase()">{{
        ratingLabel
      }}</span>
    </div>

    <div v-if="gameplayPitch" class="cu-pitch">{{ gameplayPitch }}</div>

    <div class="cu-statbars">
      <div v-for="row in statBarRows" :key="row.k" class="cu-sb">
        <div class="cu-sb-top">
          <span class="cu-sb-k">{{ row.k }}</span>
          <span class="cu-sb-v">{{ row.v }}</span>
        </div>
        <div class="cu-sb-track">
          <div class="cu-sb-fill" :style="{ width: row.pct + '%' }" :class="'cu-sb-fill--' + row.tone" />
        </div>
      </div>
    </div>

    <div v-if="gameplayTags.length" class="cu-tags cu-tags--gameplay">
      <span v-for="t in gameplayTags" :key="'g-' + t" class="cu-tag cu-tag--gp">{{ t }}</span>
    </div>
    <div v-if="tags.length" class="cu-tags">
      <span v-for="t in tags" :key="t" class="cu-tag">{{ t }}</span>
    </div>

    <div class="cu-block">
      <h3>Attaque de base</h3>
      <p>{{ basicText }}</p>
    </div>
    <div class="cu-block">
      <h3>Compétence 1</h3>
      <p class="cu-tech">{{ skill1Text }}</p>
      <p v-if="skill1Gameplay" class="cu-gp">{{ skill1Gameplay }}</p>
    </div>
    <div v-if="hasSkill2" class="cu-block">
      <h3>Compétence 2</h3>
      <p class="cu-tech">{{ skill2Text }}</p>
      <p v-if="skill2Gameplay" class="cu-gp">{{ skill2Gameplay }}</p>
    </div>
    <div v-else class="cu-block">
      <h3>Compétence 2</h3>
      <p class="cu-tech cu-tech--muted">Aucune compétence secondaire.</p>
    </div>

    <div v-if="balanceWarnings.length" class="cu-warns cu-warns--balance">
      <p v-for="(w, i) in balanceWarnings" :key="'b-' + i">{{ w }}</p>
    </div>
    <div v-if="warnings.length" class="cu-warns">
      <p v-for="(w, i) in warnings" :key="i">{{ w }}</p>
    </div>
    <div v-if="errors.length" class="cu-errs">
      <p v-for="(e, i) in errors" :key="i">{{ e }}</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{
  name: string;
  role: string;
  element: string;
  preview: Record<string, unknown> | null;
}>();

const ROLE_FR: Record<string, string> = {
  dps: 'DPS',
  tank: 'Tank',
  support: 'Support',
  assassin: 'Assassin'
};
const EL_FR: Record<string, string> = {
  fire: 'Feu',
  water: 'Eau',
  plant: 'Plante',
  light: 'Lumière',
  dark: 'Ténèbres'
};

const roleLabel = computed(() => ROLE_FR[props.role] || props.role);

const roleDisplay = computed(() => {
  const fs = props.preview?.finalStats as Record<string, unknown> | undefined;
  const rf = fs?.role_fr;
  if (typeof rf === 'string' && rf.length) return rf;
  return roleLabel.value;
});
const elementLabel = computed(() => EL_FR[props.element] || props.element);

const attackLabel = computed(() => {
  const fs = props.preview?.finalStats as Record<string, unknown> | undefined;
  const at = fs?.attack_type;
  return at === 'melee' ? 'CAC' : 'Distance';
});

const powerRating = computed(() => (props.preview?.powerRating as string) || '');
const ratingLabel = computed(() => {
  const r = String(powerRating.value || '').toUpperCase();
  if (r === 'HIGH') return 'Élevé';
  if (r === 'MEDIUM') return 'Moyen';
  if (r === 'LOW') return 'Modéré';
  return r || '—';
});

const gameplayPitch = computed(() => (props.preview?.gameplayPitch as string) || '');
const gameplayTags = computed(() => (props.preview?.gameplayTags as string[]) || []);
const hasSkill2 = computed(() => (props.preview?.hasSkill2 as boolean | undefined) !== false);

const skill1Gameplay = computed(() => (props.preview?.skill1Gameplay as string) || '');
const skill2Gameplay = computed(() => (props.preview?.skill2Gameplay as string) || '');
const balanceWarnings = computed(() => (props.preview?.balanceWarnings as string[]) || []);

const statBarRows = computed(() => {
  const fs = props.preview?.finalStats as Record<string, number> | undefined;
  if (!fs) return [];
  const keys: { k: string; key: keyof typeof fs; tone: string }[] = [
    { k: 'PV', key: 'hp', tone: 'hp' },
    { k: 'ATQ', key: 'attack', tone: 'atk' },
    { k: 'DEF', key: 'defense', tone: 'def' },
    { k: 'VIT', key: 'speed', tone: 'spd' },
    { k: 'MAÎTRISE', key: 'mastery', tone: 'mas' }
  ];
  const vals = keys.map((x) => Number(fs[x.key] ?? 0)).filter((n) => Number.isFinite(n));
  const max = Math.max(...vals, 1);
  return keys.map((x) => {
    const v = Number(fs[x.key] ?? 0);
    return {
      k: x.k,
      v: Number.isFinite(v) ? v : '—',
      pct: Number.isFinite(v) ? Math.round((v / max) * 100) : 0,
      tone: x.tone
    };
  });
});

const basicText = computed(() => {
  const s = props.preview?.summary as string[] | undefined;
  return s?.[0] || '—';
});
const skill1Text = computed(() => {
  const s = props.preview?.summary as string[] | undefined;
  return s?.[1] || '—';
});
const skill2Text = computed(() => {
  const s = props.preview?.summary as string[] | undefined;
  return s?.[2] || '—';
});

const tags = computed(() => (props.preview?.tags as string[]) || []);
const warnings = computed(() => (props.preview?.warnings as string[]) || []);
const errors = computed(() => (props.preview?.errors as string[]) || []);
</script>

<style scoped>
.cu-preview {
  padding: 1.25rem;
  border-radius: 20px;
  position: sticky;
  top: 1rem;
  align-self: start;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(200deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.94));
  max-height: calc(100vh - 120px);
  overflow: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}
.cu-preview-title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #fef3c7;
}
.cu-preview-head {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}
.cu-ph-name {
  font-size: 1.2rem;
  font-weight: 700;
  color: #fef3c7;
}
.cu-ph-meta {
  margin-top: 0.35rem;
  font-size: 0.82rem;
  color: rgba(203, 213, 225, 0.9);
}
.cu-rating-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  font-size: 0.82rem;
}
.cu-rating-label {
  color: rgba(148, 163, 184, 0.95);
}
.cu-rating-badge {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.25rem 0.55rem;
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.cu-rating--low {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.35);
}
.cu-rating--medium {
  background: rgba(245, 158, 11, 0.2);
  color: #fcd34d;
  border: 1px solid rgba(245, 158, 11, 0.35);
}
.cu-rating--high {
  background: rgba(239, 68, 68, 0.2);
  color: #fecaca;
  border: 1px solid rgba(239, 68, 68, 0.35);
}
.cu-pitch {
  font-size: 0.85rem;
  line-height: 1.5;
  color: rgba(226, 232, 240, 0.95);
  margin-bottom: 1rem;
  padding: 0.65rem 0.75rem;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.12);
}
.cu-statbars {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-bottom: 1rem;
}
.cu-sb-top {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(148, 163, 184, 0.95);
  margin-bottom: 0.2rem;
}
.cu-sb-v {
  font-weight: 800;
  color: #e2e8f0;
  font-size: 0.8rem;
}
.cu-sb-track {
  height: 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.85);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.15);
}
.cu-sb-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}
.cu-sb-fill--hp {
  background: linear-gradient(90deg, #dc2626, #f87171);
}
.cu-sb-fill--atk {
  background: linear-gradient(90deg, #ea580c, #fb923c);
}
.cu-sb-fill--def {
  background: linear-gradient(90deg, #2563eb, #60a5fa);
}
.cu-sb-fill--spd {
  background: linear-gradient(90deg, #059669, #34d399);
}
.cu-sb-fill--mas {
  background: linear-gradient(90deg, #7c3aed, #c084fc);
}
.cu-block h3 {
  margin: 0 0 0.35rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(148, 163, 184, 0.95);
}
.cu-tech {
  margin: 0 0 0.35rem;
  font-size: 0.88rem;
  line-height: 1.45;
  color: rgba(226, 232, 240, 0.95);
}
.cu-tech--muted {
  color: rgba(148, 163, 184, 0.95);
  font-style: italic;
}
.cu-gp {
  margin: 0 0 0.85rem;
  font-size: 0.82rem;
  line-height: 1.45;
  color: rgba(167, 243, 208, 0.95);
  font-style: italic;
}
.cu-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}
.cu-tags--gameplay {
  margin-bottom: 0.45rem;
}
.cu-tag {
  font-size: 0.72rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  background: rgba(79, 70, 229, 0.35);
  border: 1px solid rgba(165, 180, 252, 0.35);
  color: #e0e7ff;
}
.cu-tag--gp {
  background: rgba(16, 185, 129, 0.22);
  border-color: rgba(52, 211, 153, 0.4);
  color: #a7f3d0;
}
.cu-warns p {
  margin: 0.25rem 0;
  font-size: 0.82rem;
  color: #fcd34d;
}
.cu-warns--balance p {
  color: #fde68a;
}
.cu-errs p {
  margin: 0.25rem 0;
  font-size: 0.82rem;
  color: #fca5a5;
}
</style>
