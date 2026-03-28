<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="ct-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ct-title"
    >
      <div class="ct-backdrop" aria-hidden="true" />
      <div v-if="highlightBox.visible" class="ct-spotlight" :style="highlightBox.style" aria-hidden="true" />
      <div class="ct-panel nx-panel">
        <h2 id="ct-title" class="ct-title">Tutoriel combat</h2>
        <p class="ct-text">{{ panelText }}</p>
        <div class="ct-actions">
          <button v-if="showNext" type="button" class="nx-btn ct-btn-primary" @click="emitNext">
            Suivant
          </button>
          <button
            v-if="showVictoryClose"
            type="button"
            class="nx-btn ct-btn-primary"
            @click="$emit('finish')"
          >
            Fermer
          </button>
          <button
            v-if="!showVictoryClose"
            type="button"
            class="nx-btn ghost ct-btn-skip"
            @click="$emit('skip')"
          >
            Passer le tutoriel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

export type CombatTutorialStep = {
  id?: string;
  type?: string;
  target?: string;
  text?: string;
  requireVictory?: boolean;
};

const props = defineProps<{
  /** Affiche l’overlay (masqué en jeu libre après l’étape « free »). */
  active: boolean;
  steps: CombatTutorialStep[];
  stepIndex: number;
  /** Après l’étape « free », le joueur joue sans masque. */
  freePlay: boolean;
  battleWon: boolean;
  /** Index combat de l’unité active (decisionRequest). */
  actorCombatIndex: number | null;
}>();

const emit = defineEmits<{
  (e: 'next'): void;
  (e: 'skip'): void;
  (e: 'finish'): void;
  (e: 'update:stepIndex', v: number): void;
}>();

const highlightBox = ref<{ visible: boolean; style: Record<string, string> }>({
  visible: false,
  style: {}
});

const visible = computed(() => {
  if (!props.active || props.freePlay) return false;
  const step = props.steps[props.stepIndex];
  if (!step) return false;
  if (step.requireVictory) return props.battleWon;
  return true;
});

const panelText = computed(() => {
  const step = props.steps[props.stepIndex];
  return step?.text ?? '';
});

const showNext = computed(() => {
  const step = props.steps[props.stepIndex];
  if (!step || step.requireVictory) return false;
  return step.type === 'message' || step.type === 'highlight' || step.type === 'free';
});

const showVictoryClose = computed(() => {
  const step = props.steps[props.stepIndex];
  return !!(step?.requireVictory && props.battleWon);
});

function emitNext() {
  emit('next');
}

function resolveSelector(target: string | undefined): string | null {
  if (!target) return null;
  const map: Record<string, string> = {
    atb_bar: '#battlefield .atb-arc',
    active_unit: '#battlefield .unit-slot.unit-active',
    targeting: '#battlefield .unit-slot.unit-targetable',
    skills_panel: '[data-tutorial-target="skills-panel"]',
    buff_icons: '#battlefield .buff-container'
  };
  return map[target] ?? null;
}

function updateHighlight() {
  if (!visible.value) {
    highlightBox.value = { visible: false, style: {} };
    return;
  }
  const step = props.steps[props.stepIndex];
  if (!step || step.type !== 'highlight' || !step.target) {
    highlightBox.value = { visible: false, style: {} };
    return;
  }
  let sel = resolveSelector(step.target);
  if (step.target === 'active_unit' && props.actorCombatIndex != null) {
    sel = `#unit-${props.actorCombatIndex}`;
  }
  if (!sel) {
    highlightBox.value = { visible: false, style: {} };
    return;
  }
  nextTick(() => {
    const el = document.querySelector(sel!) as HTMLElement | null;
    if (!el) {
      highlightBox.value = { visible: false, style: {} };
      return;
    }
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    const pad = 8;
    const top = r.top - pad;
    const left = r.left - pad;
    const w = r.width + pad * 2;
    const h = r.height + pad * 2;
    highlightBox.value = {
      visible: true,
      style: {
        top: `${Math.max(8, top)}px`,
        left: `${Math.max(8, left)}px`,
        width: `${w}px`,
        height: `${h}px`
      }
    };
  });
}

watch(
  () => [visible.value, props.stepIndex, props.actorCombatIndex, props.steps] as const,
  () => updateHighlight(),
  { deep: true }
);

function onResize() {
  updateHighlight();
}

onMounted(() => {
  window.addEventListener('resize', onResize);
  updateHighlight();
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
});
</script>

<style scoped>
/* Panneau à gauche pour laisser le champ de bataille lisible au centre / à droite */
.ct-root {
  position: fixed;
  inset: 0;
  z-index: 4500;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 16px 20px 16px max(16px, env(safe-area-inset-left));
  box-sizing: border-box;
}

.ct-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(2, 6, 23, 0.72);
  pointer-events: auto;
}

.ct-spotlight {
  position: fixed;
  border-radius: 14px;
  box-shadow:
    0 0 0 9999px rgba(2, 6, 23, 0.78),
    0 0 28px rgba(250, 204, 21, 0.45),
    inset 0 0 0 2px rgba(253, 224, 71, 0.85);
  pointer-events: none;
  z-index: 1;
  animation: ct-pulse 2.2s ease-in-out infinite;
}

@keyframes ct-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 9999px rgba(2, 6, 23, 0.78),
      0 0 22px rgba(250, 204, 21, 0.35),
      inset 0 0 0 2px rgba(253, 224, 71, 0.75);
  }
  50% {
    box-shadow:
      0 0 0 9999px rgba(2, 6, 23, 0.78),
      0 0 36px rgba(250, 204, 21, 0.55),
      inset 0 0 0 2px rgba(253, 230, 138, 0.95);
  }
}

.ct-panel {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  width: min(320px, 38vw);
  max-width: 100%;
  max-height: min(520px, 85vh);
  overflow-y: auto;
  padding: 18px 20px;
  pointer-events: auto;
}

.ct-title {
  margin: 0 0 10px;
  font-size: 1.05rem;
  font-weight: 700;
  color: #f8fafc;
}

.ct-text {
  margin: 0 0 16px;
  line-height: 1.5;
  color: #cbd5e1;
  font-size: 0.95rem;
}

.ct-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-start;
}

.ct-btn-primary {
  min-width: 110px;
}

.ct-btn-skip {
  opacity: 0.85;
}
</style>
