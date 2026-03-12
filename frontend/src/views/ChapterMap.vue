<template>
  <div class="chapter-map" :class="{ 'chapter-map-mobile': isMobile }">
    <svg
      class="map-svg"
      :viewBox="viewBox"
      preserveAspectRatio="xMidYMid meet"
      @mouseleave="hoveredIndex = -1"
    >
      <defs>
        <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(148, 163, 184, 0.3)" />
          <stop offset="50%" stop-color="rgba(0, 255, 255, 0.6)" />
          <stop offset="100%" stop-color="rgba(148, 163, 184, 0.3)" />
        </linearGradient>
        <linearGradient id="linkGradientActive" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(34, 197, 94, 0.5)" />
          <stop offset="100%" stop-color="rgba(0, 255, 255, 0.6)" />
        </linearGradient>
        <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="bossAura" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="nodeAuraGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(0, 255, 150, 0.4)" />
          <stop offset="70%" stop-color="transparent" />
        </radialGradient>
        <radialGradient id="nodeAuraGradientBoss" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(255, 60, 60, 0.4)" />
          <stop offset="70%" stop-color="transparent" />
        </radialGradient>
      </defs>
      <!-- Connexions -->
      <g v-for="(s, i) in stages" :key="'link-' + i">
        <line
          v-if="i < stages.length - 1"
          :x1="nodePos(i).x"
          :y1="nodePos(i).y"
          :x2="nodePos(i + 1).x"
          :y2="nodePos(i + 1).y"
          class="link stage-link"
          :class="{ 'link-active': s.cleared }"
        />
      </g>
      <!-- Nodes -->
      <g
        v-for="(s, i) in stages"
        :key="'node-' + i"
        class="node-wrap"
        :class="nodeClass(s)"
        :style="{ animationDelay: `${i * 80}ms` }"
        @click="onNodeClick(s, i)"
        @mouseenter="onNodeHover(i, $event)"
      >
        <!-- BOSS label au-dessus -->
        <text
          v-if="s.isBoss"
          :x="nodePos(i).x"
          :y="nodePos(i).y - (nodeRadius(s) + 14)"
          class="boss-text"
          text-anchor="middle"
        >
          BOSS
        </text>
        <!-- Aura externe (équivalent ::after, visible au hover) -->
        <circle
          :cx="nodePos(i).x"
          :cy="nodePos(i).y"
          :r="nodeRadius(s) + 6"
          :fill="s.isBoss ? 'url(#nodeAuraGradientBoss)' : 'url(#nodeAuraGradient)'"
          class="node-aura"
          aria-hidden="true"
        />
        <circle
          :cx="nodePos(i).x"
          :cy="nodePos(i).y"
          :r="nodeRadius(s)"
          class="stage-node node"
          :class="nodeClass(s)"
        />
        <g v-if="isLocked(s)" class="node-icon" :transform="`translate(${nodePos(i).x}, ${nodePos(i).y})`">
          <path d="M-6-4h4v-2a2 2 0 014 0v2h4v8h-12v-8zm4 0v-2h-4v2h4z" fill="currentColor" opacity="0.9" />
        </g>
        <text
          :x="nodePos(i).x"
          :y="nodePos(i).y + (s.isBoss ? 2 : 5)"
          class="node-label"
          text-anchor="middle"
        >
          {{ s.stage }}
        </text>
      </g>
    </svg>
    <!-- Tooltip -->
    <Transition name="tooltip">
      <div
        v-if="hoveredIndex >= 0 && stages[hoveredIndex]"
        class="stage-tooltip"
        :style="tooltipStyle"
      >
        <div class="tooltip-title">Stage {{ stages[hoveredIndex].stage }}</div>
        <div class="tooltip-row">Difficulté : {{ mode === 'hard' ? 'Difficile' : 'Normal' }}</div>
        <div class="tooltip-row">Récompenses : XP par unité survivante + loot</div>
        <div class="tooltip-row">XP par unité : {{ getDisplayedModeXp(stages[hoveredIndex]) }}</div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  chapter: number;
  mode: string;
  stages: Array<{ stage: number; isBoss: boolean; cleared: boolean; rewardClaimed: boolean; available: boolean; xpPerUnitNormal?: number; xpPerUnitHard?: number }>;
  seasonKey?: string | null;
}>();

const emit = defineEmits<{
  (e: 'open-stage', payload: { chapter: number; stage: number; stageInfo: any }): void;
}>();

const isMobile = ref(false);
const hoveredIndex = ref(-1);
const tooltipPos = ref({ x: 0, y: 0 });
const MAP_WIDTH = 1180;
const MAP_HEIGHT = 180;
const MOBILE_MAP_HEIGHT = 220;
const MAP_SIDE_PADDING = 80;

const viewBox = computed(() => (isMobile.value ? `0 -40 ${MAP_WIDTH} ${MOBILE_MAP_HEIGHT}` : `0 -28 ${MAP_WIDTH} ${MAP_HEIGHT}`));

function nodePos(index: number) {
  const step = props.stages.length > 1
    ? (MAP_WIDTH - MAP_SIDE_PADDING * 2) / (props.stages.length - 1)
    : 0;
  const x = MAP_SIDE_PADDING + index * step;
  const y = (index % 2 === 0 ? 70 : 30) + 28;
  return { x, y };
}

function nodeRadius(s: { isBoss: boolean }) {
  const base = 22;
  return s.isBoss ? base * 1.25 : base;
}

function isLocked(s: { cleared: boolean; available: boolean }) {
  return !s.available && !s.cleared;
}

function nodeClass(s: { cleared: boolean; available: boolean; isBoss: boolean }) {
  const base = s.cleared ? 'completed' : s.available ? 'available' : 'locked';
  const boss = s.isBoss ? 'boss' : '';
  return [base, boss].filter(Boolean).join(' ');
}

function getDisplayedModeXp(stage: { xpPerUnitNormal?: number; xpPerUnitHard?: number }) {
  return props.mode === 'hard'
    ? (stage.xpPerUnitHard ?? 0)
    : (stage.xpPerUnitNormal ?? 0);
}

const tooltipStyle = computed(() => ({
  left: `${tooltipPos.value.x}px`,
  top: `${tooltipPos.value.y}px`
}));

function onNodeHover(index: number, e?: MouseEvent) {
  hoveredIndex.value = index;
  if (e) {
    tooltipPos.value = { x: e.clientX + 12, y: e.clientY + 12 };
  }
}

function updateTooltipPosition(e: MouseEvent) {
  if (hoveredIndex.value >= 0) {
    tooltipPos.value = { x: e.clientX + 12, y: e.clientY + 12 };
  }
}

function onNodeClick(s: any, index: number) {
  if (isLocked(s)) return;
  emit('open-stage', {
    chapter: props.chapter,
    stage: s.stage,
    stageInfo: props.stages[index]
  });
}

function checkMobile() {
  isMobile.value = typeof window !== 'undefined' && window.innerWidth < 768;
}

onMounted(() => {
  checkMobile();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', checkMobile);
    document.addEventListener('mousemove', updateTooltipPosition);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', checkMobile);
    document.removeEventListener('mousemove', updateTooltipPosition);
  }
});
</script>

<style scoped>
.chapter-map {
  position: relative;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  overflow: visible;
  padding-top: 2px;
}

.chapter-map-mobile {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 1rem;
}

.chapter-map-mobile .map-svg {
  min-width: 980px;
}

.map-svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}

/* ---- Connexions ---- */
.link {
  stroke: url(#linkGradient);
  stroke-width: 2;
  fill: none;
  stroke-dasharray: 6 4;
  animation: linkFlow 2s linear infinite;
}

.link-active {
  stroke: url(#linkGradientActive);
  stroke-dasharray: none;
  stroke-width: 3;
  filter: url(#nodeGlow);
  animation: pulseLink 1.5s ease-in-out infinite alternate;
}

@keyframes pulseLink {
  from {
    opacity: 0.5;
  }
  to {
    opacity: 1;
  }
}

@keyframes linkFlow {
  to {
    stroke-dashoffset: -10;
  }
}


/* ---- Nodes ---- */
.node-wrap {
  cursor: pointer;
  animation: nodeAppear 0.45s ease-out backwards;
}

/* Position 100% fixe : aucun transform, aucun scale. Hover = glow uniquement. */
.node-aura {
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.node-wrap:hover .node-aura {
  opacity: 1;
}

.node-wrap.locked:hover .node-aura {
  opacity: 0;
}

.stage-node,
.node {
  transition: filter 0.2s ease, stroke 0.2s ease;
}

.node-wrap:hover .stage-node,
.node-wrap:hover .node {
  filter: drop-shadow(0 0 8px rgba(2, 6, 23, 0.95))
    drop-shadow(0 0 14px rgba(0, 255, 150, 0.65))
    drop-shadow(0 0 28px rgba(0, 255, 150, 0.35));
}

.node-wrap:hover .node.boss {
  filter: drop-shadow(0 0 16px rgba(255, 60, 60, 0.7))
    drop-shadow(0 0 32px rgba(255, 60, 60, 0.4))
    drop-shadow(0 0 50px rgba(255, 60, 60, 0.2));
}

.node-wrap.locked:hover .stage-node,
.node-wrap.locked:hover .node {
  filter: none;
}

/* LOCKED */
.node.locked {
  fill: rgba(51, 65, 85, 0.9);
  stroke: rgba(100, 116, 139, 0.4);
  stroke-width: 2;
  opacity: 0.5;
}

.node-wrap.locked {
  cursor: not-allowed;
}

/* AVAILABLE */
.node.available {
  fill: rgba(8, 47, 73, 0.72);
  stroke: rgba(103, 232, 249, 0.98);
  stroke-width: 3;
}

/* COMPLETED */
.node.completed {
  fill: rgba(20, 83, 45, 0.8);
  stroke: rgba(74, 222, 128, 1);
  stroke-width: 3;
}

.node-icon {
  pointer-events: none;
}

.node-icon path,
.node-icon line {
  color: #e2e8f0;
}

.node-wrap.completed .node-icon path,
.node-wrap.completed .node-icon line {
  stroke: #dcfce7;
  color: #dcfce7;
}

.node-wrap.locked .node-icon path {
  fill: #94a3b8;
  color: #94a3b8;
}

/* BOSS */
.node.boss {
  fill: rgba(127, 29, 29, 0.82);
  stroke: rgba(248, 113, 113, 1);
  stroke-width: 3;
}

.node.boss.available {
  fill: rgba(127, 29, 29, 0.78);
  stroke: rgba(252, 165, 165, 1);
}

.node.boss.completed {
  fill: rgba(20, 83, 45, 0.8);
  stroke: rgba(134, 239, 172, 1);
}

.boss-text {
  fill: #fca5a5;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-shadow: 0 0 12px rgba(239, 68, 68, 0.6);
  pointer-events: none;
}

@keyframes nodeAppear {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.node-label {
  fill: #f1f5f9;
  font-size: 14px;
  font-weight: 700;
  pointer-events: none;
  paint-order: stroke;
  stroke: rgba(2, 6, 23, 0.92);
  stroke-width: 3px;
  stroke-linejoin: round;
}

.node.boss + .node-label,
.node.boss ~ .node-label {
  font-size: 13px;
}

/* ---- Tooltip ---- */
.stage-tooltip {
  position: fixed;
  z-index: 100;
  padding: 10px 14px;
  background: rgba(15, 23, 42, 0.98);
  border: 1px solid rgba(0, 255, 255, 0.35);
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 255, 255, 0.15);
  font-size: 0.8rem;
  color: #e2e8f0;
  pointer-events: none;
  max-width: 240px;
}

.tooltip-title {
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 6px;
}

.tooltip-row {
  margin-top: 2px;
  color: #94a3b8;
}

.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (max-width: 768px) {
  .node {
    /* nodes déjà plus visibles via viewBox / min-width */
  }

  .stage-tooltip {
    font-size: 0.75rem;
    padding: 8px 12px;
  }
}
</style>
