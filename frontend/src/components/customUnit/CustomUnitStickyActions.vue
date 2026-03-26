<template>
  <footer class="cu-sticky">
    <div class="cu-sticky-inner nx-panel" :class="innerClass">
      <div class="cu-sticky-status">
        <span v-if="loading">Chargement…</span>
        <template v-else>
          <span v-if="status === 'error'" class="cu-msg err">{{ message || 'Configuration invalide.' }}</span>
          <span v-else-if="status === 'warning'" class="cu-msg warn">{{ message || 'Valide avec avertissements.' }}</span>
          <span v-else-if="status === 'valid'" class="cu-msg ok">Prêt à enregistrer</span>
          <span v-else class="cu-msg">Choix incomplets ou invalides</span>
        </template>
      </div>
      <div class="cu-sticky-btns">
        <button type="button" class="nx-btn ghost" :disabled="loading" @click="$emit('reset')">Réinitialiser</button>
        <button type="button" class="nx-btn" :disabled="loading" @click="$emit('preview')">Prévisualiser</button>
        <button
          v-if="hasUnit"
          type="button"
          class="nx-btn nx-glow-blue"
          :class="{ 'nx-glow-warn': status === 'warning' && valid }"
          :disabled="loading || !valid"
          @click="$emit('save')"
        >
          Enregistrer
        </button>
        <button
          v-else
          type="button"
          class="nx-btn nx-glow-blue"
          :class="{ 'nx-glow-warn': status === 'warning' && valid }"
          :disabled="loading || !valid"
          @click="$emit('create')"
        >
          Créer l’unité
        </button>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    loading: boolean;
    valid: boolean;
    hasUnit: boolean;
    message?: string;
    /** incomplete | valid | error | warning */
    status?: 'incomplete' | 'valid' | 'error' | 'warning';
  }>(),
  { status: 'incomplete' }
);

const innerClass = computed(() => {
  const s = props.status;
  if (s === 'valid') return 'cu-sticky--valid';
  if (s === 'error') return 'cu-sticky--error';
  if (s === 'warning') return 'cu-sticky--warn';
  return '';
});

defineEmits<{
  (e: 'reset'): void;
  (e: 'preview'): void;
  (e: 'save'): void;
  (e: 'create'): void;
}>();
</script>

<style scoped>
.cu-sticky {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  padding: 0.65rem 1rem calc(0.65rem + env(safe-area-inset-bottom));
  pointer-events: none;
}
.cu-sticky-inner {
  pointer-events: auto;
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(12px);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.45);
  transition:
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}
.cu-sticky--valid {
  border-color: rgba(34, 197, 94, 0.35);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(34, 197, 94, 0.12);
}
.cu-sticky--error {
  border-color: rgba(239, 68, 68, 0.45);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(239, 68, 68, 0.15);
}
.cu-sticky--warn {
  border-color: rgba(245, 158, 11, 0.45);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(245, 158, 11, 0.18);
}
.cu-sticky-status {
  font-size: 0.88rem;
  color: rgba(203, 213, 225, 0.95);
}
.cu-msg.ok {
  color: #86efac;
}
.cu-msg.err {
  color: #fca5a5;
}
.cu-msg.warn {
  color: #fcd34d;
}
.cu-sticky-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.nx-glow-warn {
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.35) !important;
}
@media (max-width: 768px) {
  .cu-sticky-btns {
    width: 100%;
  }
  .cu-sticky-btns .nx-btn {
    flex: 1;
    min-width: 120px;
  }
}
</style>
