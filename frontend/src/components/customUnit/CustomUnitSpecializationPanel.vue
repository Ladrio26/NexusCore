<template>
  <section class="cu-spec" aria-labelledby="cu-spec-title">
    <h3 id="cu-spec-title" class="cu-spec-title">Spécialisation</h3>
    <p class="cu-spec-intro">
      Comme toute unité : <strong>+10 %</strong> sur une stat en <span class="cu-spec-tag">Spé A</span> et une autre en
      <span class="cu-spec-tag">Spé B</span>. Un <strong>effet bonus</strong> sur ta première compétence (sur toi) est
      ajouté <strong>sans coût de budget</strong>.
    </p>
    <div class="cu-spec-grid">
      <div class="cu-field">
        <span class="cu-field-lbl">Spé A — stat +10 %</span>
        <CustomDropdown
          :model-value="modelValue.specAStat"
          :options="statOptions"
          label="Spé A"
          @update:model-value="patch({ specAStat: $event as SpecBonusStatKey })"
        />
      </div>
      <div class="cu-field">
        <span class="cu-field-lbl">Spé B — stat +10 %</span>
        <CustomDropdown
          :model-value="modelValue.specBStat"
          :options="statOptions"
          label="Spé B"
          @update:model-value="patch({ specBStat: $event as SpecBonusStatKey })"
        />
      </div>
      <div class="cu-field cu-field--full">
        <span class="cu-field-lbl">Bonus compétence I (sur toi, gratuit)</span>
        <CustomDropdown
          :model-value="modelValue.skill1SpecBonus"
          :options="bonusOptions"
          label="Effet bonus"
          @update:model-value="patch({ skill1SpecBonus: $event as Skill1SpecBonusKind })"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CustomDropdown, { type CuDropdownOption } from './CustomDropdown.vue';
import type { Skill1SpecBonusKind, SpecBonusStatKey } from './effectSlotTypes';

export type SpecBlock = {
  specAStat?: SpecBonusStatKey;
  specBStat?: SpecBonusStatKey;
  skill1SpecBonus?: Skill1SpecBonusKind;
};

const props = defineProps<{
  modelValue: SpecBlock;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: SpecBlock): void;
}>();

const STAT_LABELS: Record<string, string> = {
  attack: 'Attaque',
  defense: 'Défense',
  speed: 'Vitesse',
  mastery: 'Maîtrise',
  maxHp: 'PV max'
};

const BONUS_LABELS: Record<string, string> = {
  SELF_ATK: '+ Attaque sur soi (comp. I)',
  SELF_DEF: '+ Défense sur soi (comp. I)',
  SELF_SPEED: '+ Vitesse sur soi (comp. I)'
};

function patch(p: Partial<SpecBlock>) {
  emit('update:modelValue', { ...props.modelValue, ...p });
}

const statOptions = computed((): CuDropdownOption[] => {
  const keys = ['attack', 'defense', 'speed', 'mastery', 'maxHp'] as const;
  return keys.map((k) => ({
    value: k,
    label: `${STAT_LABELS[k] ?? k} +10 %`,
    category: 'OTHER'
  }));
});

const bonusOptions = computed((): CuDropdownOption[] =>
  (['SELF_ATK', 'SELF_DEF', 'SELF_SPEED'] as const).map((k) => ({
    value: k,
    label: BONUS_LABELS[k] ?? k,
    category: 'OTHER'
  }))
);
</script>

<style scoped>
.cu-spec {
  padding: 0.85rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.35);
  margin-bottom: 1rem;
}
.cu-spec-title {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #e2e8f0;
}
.cu-spec-intro {
  margin: 0 0 0.85rem;
  font-size: 0.78rem;
  line-height: 1.45;
  color: rgba(148, 163, 184, 0.95);
}
.cu-spec-intro strong {
  color: #fbbf24;
  font-weight: 700;
}
.cu-spec-tag {
  color: #38bdf8;
  font-weight: 700;
}
.cu-spec-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 1rem;
}
.cu-field--full {
  grid-column: 1 / -1;
}
.cu-field-lbl {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgba(148, 163, 184, 0.95);
  margin-bottom: 0.35rem;
}
@media (max-width: 640px) {
  .cu-spec-grid {
    grid-template-columns: 1fr;
  }
}
</style>
