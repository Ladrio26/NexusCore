<template>
  <section class="guild-panel nx-panel">
    <span class="guild-panel-kicker">Fonder une alliance</span>
    <h3 class="guild-panel-title">Créer une guilde</h3>
    <p class="guild-panel-text">Choisis un nom unique entre 3 et 30 caractères et ouvre ton propre sanctuaire de guilde.</p>
    <div class="guild-create-form">
      <input
        :value="name"
        type="text"
        maxlength="30"
        class="guild-input"
        placeholder="Nom de guilde"
        @input="handleInput"
      />
      <button type="button" class="nx-btn" :disabled="loading || !canSubmit" @click="$emit('create')">
        {{ loading ? 'Création...' : 'Créer la guilde' }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  name: string;
  loading: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:name', value: string): void;
  (event: 'create'): void;
}>();

const canSubmit = computed(() => props.name.trim().length >= 3);

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  emit('update:name', target.value);
}
</script>

<style scoped>
.guild-panel {
  padding: 22px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.12), transparent 28%),
    linear-gradient(180deg, rgba(8, 13, 24, 0.95), rgba(11, 20, 35, 0.92));
  border: 1px solid rgba(125, 211, 252, 0.12);
}

.guild-panel-kicker {
  display: inline-block;
  margin-bottom: 10px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.14);
  border: 1px solid rgba(125, 211, 252, 0.18);
  color: #bae6fd;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.guild-panel-title {
  margin: 0 0 8px;
}

.guild-panel-text {
  margin: 0 0 14px;
  color: #cbd5e1;
  font-size: 0.95rem;
}

.guild-create-form {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.guild-input {
  min-width: 240px;
  flex: 1 1 260px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.72);
  color: #f8fafc;
}
</style>
