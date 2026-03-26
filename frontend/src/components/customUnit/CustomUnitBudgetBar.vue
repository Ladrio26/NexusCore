<template>
  <div class="cu-budget" :class="barClass">
    <div class="cu-budget-head">
      <span class="cu-budget-label">{{ label }}</span>
      <span class="cu-budget-num">{{ total }} / {{ max }} points</span>
    </div>
    <div class="cu-budget-track" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100">
      <div class="cu-budget-fill" :style="{ width: fillWidth }" />
    </div>
    <p v-if="hint" class="cu-budget-hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    total: number;
    max: number;
    label?: string;
    hint?: string;
  }>(),
  {
    label: 'Budget'
  }
);

const pct = computed(() => {
  const m = props.max || 1;
  return Math.min(100, Math.round(((props.total || 0) / m) * 100));
});

const fillWidth = computed(() => `${Math.min(100, pct.value)}%`);

const overflow = computed(() => {
  const m = props.max || 1;
  return (props.total || 0) / m;
});

const barClass = computed(() => {
  const r = overflow.value;
  if (r > 1) return 'cu-budget--over';
  if (r >= 0.7) return 'cu-budget--high';
  return 'cu-budget--ok';
});
</script>

<style scoped>
.cu-budget {
  padding: 0.65rem 0.85rem;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.2);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
.cu-budget-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.4rem;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(148, 163, 184, 0.95);
}
.cu-budget-num {
  font-weight: 800;
  font-size: 0.78rem;
  text-transform: none;
  letter-spacing: 0.04em;
  color: #fde68a;
}
.cu-budget-track {
  height: 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.85);
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.2);
}
.cu-budget-fill {
  height: 100%;
  border-radius: 999px;
  transition:
    width 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.3s ease;
}
.cu-budget--ok .cu-budget-fill {
  background: linear-gradient(90deg, #22c55e, #4ade80);
  box-shadow: 0 0 16px rgba(34, 197, 94, 0.35);
}
.cu-budget--high .cu-budget-fill {
  background: linear-gradient(90deg, #ea580c, #fb923c);
  box-shadow: 0 0 16px rgba(251, 146, 60, 0.35);
}
.cu-budget--over .cu-budget-fill {
  background: linear-gradient(90deg, #b91c1c, #f87171);
  box-shadow: 0 0 16px rgba(248, 113, 113, 0.45);
}
.cu-budget-hint {
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
  color: #cbd5e1;
}
</style>
