<template>
  <div class="buff-row">
    <BuffIcon
      v-for="(b, i) in dedupedBuffs"
      :key="buffKey(b, i)"
      :buff="b"
      :icon="iconFor(b.buffType ?? b.type, false)"
    />
    <BuffIcon
      v-for="(d, i) in dedupedDebuffs"
      :key="debuffKey(d, i)"
      :buff="d"
      is-debuff
      :icon="iconFor(d.buffType ?? d.type, true)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import BuffIcon from './BuffIcon.vue';

const props = withDefaults(
  defineProps<{
    buffs?: Array<{ type?: string; buffType?: string; sourceId?: string | null; remainingActions?: number | null }>;
    debuffs?: Array<{ type?: string; buffType?: string; sourceId?: string | null; remainingActions?: number | null }>;
    buffConfig?: Record<string, { icon: string }>;
    debuffConfig?: Record<string, { icon: string }>;
    rowPosition?: 'top' | 'bottom';
  }>(),
  { buffs: () => [], debuffs: () => [], buffConfig: () => ({}), debuffConfig: () => ({}), rowPosition: 'top' }
);

function dedupe(
  list: Array<{ type?: string; buffType?: string; sourceId?: string | null }>,
  isDebuff: boolean
): typeof list {
  const seen = new Set<string>();
  const out: typeof list = [];
  for (const b of list || []) {
    const key = JSON.stringify({
      type: b.type ?? null,
      buffType: b.buffType ?? null,
      sourceId: b.sourceId ?? null,
      isDebuff
    });
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

const dedupedBuffs = computed(() => dedupe(props.buffs ?? [], false));
const dedupedDebuffs = computed(() => dedupe(props.debuffs ?? [], true));

function buffKey(b: { type?: string }, i: number) {
  return `b-${b.type ?? ''}-${i}`;
}
function debuffKey(d: { type?: string }, i: number) {
  return `d-${d.type ?? ''}-${i}`;
}
function iconFor(type: string | undefined, isDebuff: boolean): string {
  if (!type) return '•';
  const key = String(type).toUpperCase();
  const cfg = isDebuff ? props.debuffConfig?.[key] : props.buffConfig?.[key];
  return (cfg?.icon ?? '•') as string;
}
</script>

<style scoped>
.buff-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  pointer-events: none;
}
</style>
