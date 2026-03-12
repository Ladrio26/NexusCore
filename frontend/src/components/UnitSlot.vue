<template>
  <div class="unit-slot" :class="{ actor: isActor, target: isTarget }">
    <div class="name">{{ unit.name }}</div>
    <div class="hp-bar">
      <div class="hp-inner" :style="{ width: hpPercent + '%' }"></div>
    </div>
    <div class="atb">ATB: {{ Math.round(atb) }}</div>
    <div class="tags">
      <span class="tag">{{ unit.position }}</span>
      <span class="tag">{{ unit.rangeType }}</span>
    </div>
    <div class="effects" v-if="buffs.length || debuffs.length">
      <div class="line buffs" v-if="buffs.length">
        <span
          v-for="b in buffs"
          :key="b.type"
          class="effect-tag buff"
          :title="b.type"
        >
          {{ shortType(b.type) }} ({{ b.remainingActions }})
        </span>
      </div>
      <div class="line debuffs" v-if="debuffs.length">
        <span
          v-for="d in debuffs"
          :key="d.type"
          class="effect-tag debuff"
          :title="d.type"
        >
          {{ shortType(d.type) }} ({{ d.remainingActions }})
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  unit: any;
  position: 'front' | 'back';
  buffs?: { type: string; remainingActions: number }[];
  debuffs?: { type: string; remainingActions: number }[];
  isActor?: boolean;
  isTarget?: boolean;
  atb?: number;
}>();

const hpPercent = computed(() => {
  if (!props.unit.maxHp) return 0;
  const current = props.unit.hp ?? props.unit.maxHp;
  return Math.max(0, Math.min(100, Math.round((current / props.unit.maxHp) * 100)));
});

const atb = computed(() => props.atb ?? props.unit.atb ?? 0);

const buffs = computed(() => props.buffs || []);
const debuffs = computed(() => props.debuffs || []);

function shortType(type: string): string {
  return type
    .replace('EffectType.', '')
    .replace(/_/g, ' ')
    .slice(0, 4)
    .toUpperCase();
}
</script>

<style scoped>
.unit-slot {
  width: 130px;
  padding: 0.4rem;
  border-radius: 0.6rem;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(55, 65, 81, 0.9);
  font-size: 0.75rem;
}

.unit-slot.actor {
  box-shadow: 0 0 0 2px #38bdf8;
}

.unit-slot.target {
  box-shadow: 0 0 0 2px #f97373;
}

.name {
  text-align: center;
  margin-bottom: 0.25rem;
}

.hp-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.7);
  overflow: hidden;
}

.hp-inner {
  height: 100%;
  background: linear-gradient(to right, #22c55e, #16a34a);
}

.atb {
  margin-top: 0.15rem;
  text-align: center;
  font-size: 0.7rem;
  color: #e5e7eb;
}

.tags {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.tag {
  padding: 0.05rem 0.3rem;
  border-radius: 999px;
  background: rgba(30, 64, 175, 0.4);
  font-size: 0.65rem;
  text-transform: uppercase;
}

.effects {
  margin-top: 0.2rem;
}

.line {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem;
}

.effect-tag {
  padding: 0.05rem 0.25rem;
  border-radius: 999px;
  font-size: 0.6rem;
}

.buff {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid rgba(34, 197, 94, 0.6);
}

.debuff {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.6);
}
</style>

