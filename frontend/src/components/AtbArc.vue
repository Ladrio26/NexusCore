<template>
  <svg class="atb-arc" data-tutorial-target="atb-arc" viewBox="0 0 120 120" aria-hidden="true">
    <path class="atb-bg" d="M 10 60 A 50 50 0 0 1 110 60" />
    <path
      class="atb-fill"
      :class="{ ready: (value ?? 0) >= 100 - 1e-6 }"
      :d="arcPath"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ value?: number | null }>(),
  { value: 0 }
);

const arcPath = computed(() => {
  const percent = Math.min(100, props.value ?? 0);
  const angle = (percent / 100) * 180;
  const centerX = 60;
  const centerY = 60;
  const radius = 50;
  const endAngle = (Math.PI * (180 - angle)) / 180;
  const endX = centerX + radius * Math.cos(endAngle);
  const endY = centerY - radius * Math.sin(endAngle);
  const largeArc = angle > 180 ? 1 : 0;
  return `M 10 60 A 50 50 0 ${largeArc} 1 ${endX} ${endY}`;
});
</script>

<style scoped>
.atb-arc {
  position: absolute;
  width: 90px;
  height: 90px;
  pointer-events: none;
  left: 0;
  top: 0;
}
.atb-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 6;
}
.atb-fill {
  fill: none;
  stroke: #ffd000;
  stroke-width: 6;
  transition: stroke-dashoffset 0.15s linear, filter 0.15s ease;
}
.atb-fill.ready {
  filter: drop-shadow(0 0 6px #ffd000);
}
</style>
