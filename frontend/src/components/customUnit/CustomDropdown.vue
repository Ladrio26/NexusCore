<template>
  <div ref="root" class="cu-dd" :class="{ 'cu-dd--open': open, 'cu-dd--disabled': disabled }">
    <button
      type="button"
      class="cu-dd-btn"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
    >
      <span class="cu-dd-btn-main">
        <span
          v-if="selectedCategory && selectedOption?.value"
          class="cu-dd-dot"
          :class="'cu-dd-dot--' + String(selectedCategory).toLowerCase()"
          aria-hidden="true"
        />
        <span class="cu-dd-btn-text">{{ displayText }}</span>
      </span>
      <span class="cu-dd-chev" aria-hidden="true">▾</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        class="cu-dd-backdrop"
        :class="{ 'cu-dd-backdrop--fs': fullscreen }"
        @click="close"
      />
    </Teleport>

    <Teleport to="body">
      <Transition name="cu-dd-panel">
        <div
          v-if="open"
          ref="panel"
          class="cu-dd-panel"
          :class="{ 'cu-dd-panel--fs': fullscreen }"
          :style="panelStyle"
          @click.stop
        >
          <div v-if="fullscreen" class="cu-dd-fs-head">
            <span class="cu-dd-fs-title">{{ label || 'Choisir' }}</span>
            <button type="button" class="cu-dd-fs-close" @click="close">✕</button>
          </div>
          <ul class="cu-dd-list" role="listbox">
            <li v-for="opt in options" :key="String(opt.value)">
              <CustomTooltip
                v-if="opt.disabled"
                :text="opt.disabledReason || 'Non disponible pour ce rôle'"
                title="Indisponible"
              >
                <span class="cu-dd-opt-wrap">
                  <button
                    type="button"
                    class="cu-dd-opt is-disabled"
                    disabled
                  >
                    <span class="cu-dd-dot" :class="'cu-dd-dot--' + String(opt.category || 'other').toLowerCase()" />
                    <span class="cu-dd-opt-label">{{ formatOpt(opt) }}</span>
                  </button>
                </span>
              </CustomTooltip>
              <button
                v-else
                type="button"
                class="cu-dd-opt"
                :class="{ 'is-active': modelValue === opt.value }"
                @click="pick(opt)"
              >
                <span class="cu-dd-dot" :class="'cu-dd-dot--' + String(opt.category || 'other').toLowerCase()" />
                <span class="cu-dd-opt-label">{{ formatOpt(opt) }}</span>
              </button>
            </li>
          </ul>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { EffectCategory } from './customUnitUiConstants';
import CustomTooltip from './CustomTooltip.vue';

export type CuDropdownOption = {
  value: string;
  label?: string;
  cost?: number;
  category?: EffectCategory | 'OTHER';
  disabled?: boolean;
  disabledReason?: string;
};

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: CuDropdownOption[];
    placeholder?: string;
    label?: string;
    disabled?: boolean;
  }>(),
  {
    placeholder: '—',
    label: ''
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void;
  (e: 'select', v: string): void;
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string>>({});
const fullscreen = ref(false);

const selectedOption = computed(() => props.options.find((o) => o.value === props.modelValue));

const selectedCategory = computed(() => selectedOption.value?.category);

const displayText = computed(() => {
  if (selectedOption.value) return formatOpt(selectedOption.value);
  return props.placeholder;
});

function formatOpt(opt: CuDropdownOption) {
  const base = opt.label || opt.value || props.placeholder;
  if (opt.cost != null && Number.isFinite(Number(opt.cost))) {
    return `${base} (${opt.cost} pt${Number(opt.cost) > 1 ? 's' : ''})`;
  }
  return base;
}

function pick(opt: CuDropdownOption) {
  if (opt.disabled) return;
  emit('update:modelValue', opt.value);
  emit('select', opt.value);
  open.value = false;
}

function close() {
  open.value = false;
}

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
}

function layoutPanel() {
  fullscreen.value = typeof window !== 'undefined' && window.innerWidth <= 768;
  if (fullscreen.value) {
    panelStyle.value = {
      position: 'fixed',
      left: '0',
      right: '0',
      bottom: '0',
      top: 'auto',
      width: '100%',
      maxHeight: 'min(70vh, 520px)',
      borderRadius: '20px 20px 0 0'
    };
    return;
  }
  if (!root.value) return;
  const r = root.value.getBoundingClientRect();
  const maxH = Math.min(320, window.innerHeight - r.bottom - 16);
  panelStyle.value = {
    position: 'fixed',
    left: `${r.left}px`,
    top: `${r.bottom + 4}px`,
    width: `${Math.max(r.width, 220)}px`,
    maxHeight: `${maxH}px`
  };
}

watch(open, async (v) => {
  if (v) {
    await nextTick();
    layoutPanel();
  }
});

function onWin() {
  if (open.value) layoutPanel();
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}

onMounted(() => {
  window.addEventListener('resize', onWin);
  window.addEventListener('keydown', onKey);
});

onUnmounted(() => {
  window.removeEventListener('resize', onWin);
  window.removeEventListener('keydown', onKey);
});
</script>

<style scoped>
.cu-dd {
  position: relative;
  width: 100%;
  min-width: 0;
}
.cu-dd--disabled {
  opacity: 0.55;
  pointer-events: none;
}
.cu-dd-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.75rem;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95));
  color: #f1f5f9;
  font-size: 0.82rem;
  text-align: left;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.15s ease;
}
.cu-dd-btn:hover:not(:disabled) {
  border-color: rgba(251, 191, 36, 0.45);
  box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.12);
}
.cu-dd--open .cu-dd-btn {
  border-color: rgba(56, 189, 248, 0.55);
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.15);
}
.cu-dd-btn-main {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}
.cu-dd-btn-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cu-dd-chev {
  flex-shrink: 0;
  opacity: 0.65;
  font-size: 0.7rem;
}
.cu-dd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99990;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
}
.cu-dd-backdrop--fs {
  background: rgba(0, 0, 0, 0.55);
}
.cu-dd-panel {
  z-index: 99991;
  overflow: auto;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 23, 42, 0.98);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(12px);
}
.cu-dd-panel--fs {
  padding-bottom: env(safe-area-inset-bottom);
}
.cu-dd-fs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  position: sticky;
  top: 0;
  background: rgba(15, 23, 42, 0.98);
  z-index: 1;
}
.cu-dd-fs-title {
  font-weight: 800;
  font-size: 0.9rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #fde68a;
}
.cu-dd-fs-close {
  border: none;
  background: rgba(148, 163, 184, 0.2);
  color: #e2e8f0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-size: 1rem;
}
.cu-dd-list {
  list-style: none;
  margin: 0;
  padding: 0.35rem;
}
.cu-dd-opt {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.55rem;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #e2e8f0;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.12s ease;
}
.cu-dd-opt:hover:not(:disabled):not(.is-disabled) {
  background: rgba(56, 189, 248, 0.12);
}
.cu-dd-opt.is-active {
  background: rgba(251, 191, 36, 0.15);
  outline: 1px solid rgba(251, 191, 36, 0.35);
}
.cu-dd-opt-wrap {
  display: block;
  width: 100%;
}
.cu-dd-opt.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.cu-dd-opt-label {
  flex: 1;
  min-width: 0;
}
.cu-dd-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
}
.cu-dd-dot--damage {
  color: #f87171;
  background: #ef4444;
}
.cu-dd-dot--heal {
  color: #4ade80;
  background: #22c55e;
}
.cu-dd-dot--buff {
  color: #60a5fa;
  background: #3b82f6;
}
.cu-dd-dot--debuff {
  color: #c084fc;
  background: #a855f7;
}
.cu-dd-dot--control {
  color: #fb923c;
  background: #f97316;
}
.cu-dd-dot--other {
  color: #94a3b8;
  background: #64748b;
}
.cu-dd-panel-enter-active,
.cu-dd-panel-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.cu-dd-panel-enter-from,
.cu-dd-panel-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
