<template>
  <span
    class="status-icon"
    :class="isDebuff ? 'debuff' : 'buff'"
    :data-effect="buff?.type ?? buff?.buffType"
  >
    <span class="status-emoji">{{ icon }}</span>
    <span v-if="durationDisplay != null" class="status-duration">{{ durationDisplay }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  buff: { type?: string; buffType?: string; remainingActions?: number | null; value?: number | null } | undefined;
  isDebuff?: boolean;
  icon?: string;
}>();

const icon = computed(() => (typeof props.icon === 'string' ? props.icon : '•'));
const durationDisplay = computed(() => {
  const r = props.buff?.remainingActions;
  if (r == null) return null;
  const n = Number(r);
  if (Number.isNaN(n) || n < 1) return null;
  return Math.round(n);
});
</script>

<style scoped>
.status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 16px;
  height: 16px;
  font-size: 0.7rem;
  flex-shrink: 0;
}
.status-emoji {
  line-height: 1;
}
.status-duration {
  font-size: 0.55rem;
  opacity: 0.9;
}
</style>
