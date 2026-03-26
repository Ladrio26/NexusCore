<template>
  <header class="cu-header">
    <div class="cu-header-text">
      <h1 class="cu-title">Unité Custom</h1>
      <p class="cu-sub">Crée ton unité unique en dépensant des points.</p>
      <span class="cu-badge">1 seule unité Custom par joueur</span>
    </div>
    <div class="cu-status-card nx-panel">
      <span class="cu-status-label">État</span>
      <strong class="cu-status-value">{{ statusLabel }}</strong>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  hasCustomUnit: boolean;
  unitName?: string | null;
}>();

const statusLabel = computed(() => {
  if (props.hasCustomUnit) return props.unitName ? `Créée — ${props.unitName}` : 'Créée';
  return 'Non créée';
});
</script>

<style scoped>
.cu-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}
.cu-title {
  font-size: clamp(1.75rem, 3vw, 2.35rem);
  font-weight: 800;
  letter-spacing: 0.04em;
  margin: 0 0 0.5rem;
  background: linear-gradient(135deg, #fef3c7 0%, #fbbf24 45%, #a78bfa 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.cu-sub {
  margin: 0 0 0.75rem;
  max-width: 52ch;
  color: rgba(226, 232, 240, 0.88);
  line-height: 1.55;
  font-size: 0.98rem;
}
.cu-badge {
  display: inline-block;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #fde68a;
  border: 1px solid rgba(251, 191, 36, 0.35);
  background: rgba(120, 53, 15, 0.35);
}
.cu-status-card {
  min-width: 200px;
  padding: 0.85rem 1rem;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.55);
}
.cu-status-label {
  display: block;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(148, 163, 184, 0.9);
  margin-bottom: 0.35rem;
}
.cu-status-value {
  font-size: 1rem;
  color: #e2e8f0;
}
</style>
