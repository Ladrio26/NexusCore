<template>
  <span
    ref="root"
    class="cu-tip"
    @mouseenter="onEnter"
    @mouseleave="show = false"
    @focusin="onEnter"
    @focusout="onFocusOut"
  >
    <span class="cu-tip-trigger" tabindex="0" :aria-describedby="uid">
      <slot />
    </span>
    <Teleport to="body">
      <Transition name="cu-tip-fade">
        <div
          v-if="show && hasContent"
          :id="uid"
          class="cu-tip-pop"
          role="tooltip"
          :style="floatingStyle"
        >
          <div class="cu-tip-inner">
            <slot name="content">
              <div v-if="title" class="cu-tip-title">{{ title }}</div>
              <p v-if="text" class="cu-tip-text">{{ text }}</p>
              <div v-if="cost != null" class="cu-tip-cost">{{ costLabel }}</div>
              <p v-if="hint" class="cu-tip-hint">{{ hint }}</p>
            </slot>
          </div>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, useId, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    text?: string;
    cost?: number | string;
    hint?: string;
  }>(),
  {}
);

const uid = useId();
const show = ref(false);
const root = ref<HTMLElement | null>(null);
const anchor = ref({ top: 0, left: 0 });

const hasContent = computed(
  () => !!(props.title || props.text || props.hint || props.cost != null)
);

const costLabel = computed(() => {
  if (props.cost == null) return '';
  const n = Number(props.cost);
  if (Number.isFinite(n)) return `${n} pt${n > 1 ? 's' : ''}`;
  return String(props.cost);
});

function measure() {
  if (!root.value) return;
  const r = root.value.getBoundingClientRect();
  const left = r.left + r.width / 2;
  const top = r.top - 8;
  anchor.value = { left, top };
}

const floatingStyle = computed(() => ({
  left: `${anchor.value.left}px`,
  top: `${anchor.value.top}px`,
  transform: 'translate(-50%, -100%)'
}));

function onEnter() {
  show.value = true;
  requestAnimationFrame(() => measure());
}

function onFocusOut(e: FocusEvent) {
  const next = e.relatedTarget as Node | null;
  if (root.value && next && root.value.contains(next)) return;
  show.value = false;
}

watch(show, (v) => {
  if (v) requestAnimationFrame(() => measure());
});

function onScroll() {
  if (show.value) measure();
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', measure);
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', measure);
});
</script>

<style scoped>
.cu-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}
.cu-tip-trigger {
  display: inline-flex;
  align-items: center;
  outline: none;
}
.cu-tip-pop {
  position: fixed;
  z-index: 99998;
  pointer-events: none;
  max-width: min(280px, calc(100vw - 24px));
}
.cu-tip-inner {
  padding: 0.55rem 0.7rem;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(10px);
}
.cu-tip-title {
  font-weight: 800;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #fde68a;
  margin-bottom: 0.25rem;
}
.cu-tip-text {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: #e2e8f0;
}
.cu-tip-cost {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #7dd3fc;
}
.cu-tip-hint {
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
  color: #cbd5e1;
  font-style: italic;
}
.cu-tip-fade-enter-active,
.cu-tip-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.cu-tip-fade-enter-from,
.cu-tip-fade-leave-to {
  opacity: 0;
}
</style>
