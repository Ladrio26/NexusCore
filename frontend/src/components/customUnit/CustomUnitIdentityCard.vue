<template>
  <section class="cu-id">
    <h2 class="cu-id-title">Identité</h2>

    <label class="cu-field">
      <span class="cu-field-lbl">Nom de l’unité</span>
      <input
        v-model="nameModel"
        type="text"
        maxlength="64"
        class="cu-input"
        placeholder="Ex. Ombre d’Astre"
        autocomplete="off"
      />
    </label>

    <div class="cu-field">
      <span class="cu-field-lbl">Rôle</span>
      <CustomDropdown v-model="roleModel" :options="roleOpts" label="Rôle" placeholder="Choisir un rôle" />
    </div>

    <div class="cu-field">
      <span class="cu-field-lbl">Élément</span>
      <CustomDropdown
        v-model="elementModel"
        :options="elementOpts"
        label="Élément"
        placeholder="Choisir un élément"
      />
    </div>

    <div class="cu-tags">
      <span class="cu-tag cu-tag--range">{{ rangeTag }}</span>
      <span class="cu-tag cu-tag--gp">{{ gameplayTag }}</span>
    </div>

    <p v-if="gameplayHint" class="cu-hint">{{ gameplayHint }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CustomDropdown, { type CuDropdownOption } from './CustomDropdown.vue';
import { ELEMENT_LABELS, ROLE_LABELS } from './customUnitUiConstants';

const props = defineProps<{
  role: string;
  element: string;
  gameplayHint?: string;
  /** Liste serveur (GET /custom-unit/options) */
  roles?: string[];
  elements?: string[];
}>();

const nameModel = defineModel<string>('name', { default: '' });

const emit = defineEmits<{
  (e: 'update:role', v: string): void;
  (e: 'update:element', v: string): void;
}>();

const roleModel = computed({
  get: () => props.role,
  set: (v: string) => emit('update:role', v)
});

const elementModel = computed({
  get: () => props.element,
  set: (v: string) => emit('update:element', v)
});

const roleList = computed(() =>
  props.roles?.length ? props.roles : ['dps', 'tank', 'support', 'assassin']
);
const elementList = computed(() =>
  props.elements?.length ? props.elements : ['fire', 'water', 'plant', 'light', 'dark']
);

const roleOpts = computed((): CuDropdownOption[] =>
  roleList.value.map((r) => ({
    value: r,
    label: ROLE_LABELS[r] || r,
    category: 'OTHER'
  }))
);

const elementOpts = computed((): CuDropdownOption[] =>
  elementList.value.map((el) => ({
    value: el,
    label: ELEMENT_LABELS[el] || el,
    category: 'OTHER'
  }))
);

const rangeTag = computed(() => {
  const r = props.role;
  if (r === 'tank' || r === 'assassin') return 'CAC';
  return 'Distance';
});

const gameplayTag = computed(() => {
  const map: Record<string, string> = {
    dps: 'Burst',
    tank: 'Tank',
    support: 'Sustain',
    assassin: 'Tempo'
  };
  return map[props.role] || 'Build';
});
</script>

<style scoped>
.cu-id {
  padding: 1.25rem;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: linear-gradient(165deg, rgba(30, 41, 59, 0.55), rgba(15, 23, 42, 0.88));
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
}
.cu-id-title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #fef3c7;
}
.cu-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1rem;
}
.cu-field-lbl {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: rgba(148, 163, 184, 0.95);
}
.cu-input {
  border-radius: 12px;
  border: 1px solid rgba(100, 116, 139, 0.45);
  background: rgba(15, 23, 42, 0.65);
  color: #f8fafc;
  padding: 0.6rem 0.8rem;
  font-size: 0.95rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.cu-input:focus {
  outline: none;
  border-color: rgba(56, 189, 248, 0.55);
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.12);
}
.cu-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.5rem;
}
.cu-tag {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  letter-spacing: 0.04em;
}
.cu-tag--range {
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #bae6fd;
}
.cu-tag--gp {
  background: rgba(52, 211, 153, 0.12);
  border: 1px solid rgba(52, 211, 153, 0.4);
  color: #a7f3d0;
}
.cu-hint {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.5;
  color: rgba(203, 213, 225, 0.92);
}
</style>
