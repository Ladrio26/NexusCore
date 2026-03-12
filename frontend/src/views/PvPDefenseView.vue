<template>
  <section class="pvp-defense-page">
    <div class="card nx-panel">
      <div class="page-header">
        <router-link to="/pvp" class="back-link">← PvP</router-link>
        <h1 class="nx-title">Défense PvP</h1>
      </div>

      <p class="page-desc">
        Choisissez un preset d'équipe qui défendra votre rang lorsque vous êtes attaqué. Les unités en défense ne gagnent pas de fatigue.
      </p>

      <div v-if="currentDefensePresetId" class="current-defense nx-panel">
        <h2>Défense actuelle</h2>
        <p class="current-preset-name">{{ currentDefensePresetName }}</p>
      </div>

      <div v-if="presets.length === 0" class="no-presets">
        <p>Vous n'avez aucun preset d'équipe.</p>
        <p>Créez-en un dans le <router-link to="/team-builder">Team Builder</router-link>, puis revenez ici pour le définir comme défense PvP.</p>
        <router-link to="/team-builder" class="nx-btn">Aller au Team Builder</router-link>
      </div>

      <template v-else>
        <h2 class="presets-title">Choisir un preset comme défense</h2>
        <ul class="preset-list">
          <li
            v-for="p in presets"
            :key="p.preset_index"
            class="preset-item nx-panel"
            :class="{ 'is-current': p.preset_index === currentDefensePresetId }"
          >
            <div class="preset-info">
              <span class="preset-name">{{ p.preset_name || `Preset ${p.preset_index}` }}</span>
              <span class="preset-slots">{{ slotSummary(p) }}</span>
              <div class="preset-visual">
                <div class="preset-row">
                  <span class="preset-row-label">CAC</span>
                  <div class="preset-units">
                    <div v-for="unit in p.front_units" :key="`front-${p.preset_index}-${unit.user_unit_id}`" class="preset-unit-card">
                      <img :src="unitImage(unit)" :alt="unit.name" class="preset-unit-avatar" />
                      <span class="preset-unit-name">{{ unit.name }}</span>
                      <span class="preset-unit-level">Nv.{{ unit.level }}</span>
                    </div>
                    <span v-if="!p.front_units.length" class="preset-row-empty">Aucune unité CAC</span>
                  </div>
                </div>
                <div class="preset-row">
                  <span class="preset-row-label">Distance</span>
                  <div class="preset-units">
                    <div v-for="unit in p.back_units" :key="`back-${p.preset_index}-${unit.user_unit_id}`" class="preset-unit-card">
                      <img :src="unitImage(unit)" :alt="unit.name" class="preset-unit-avatar" />
                      <span class="preset-unit-name">{{ unit.name }}</span>
                      <span class="preset-unit-level">Nv.{{ unit.level }}</span>
                    </div>
                    <span v-if="!p.back_units.length" class="preset-row-empty">Aucune unité distance</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="preset-actions">
              <button
                v-if="p.preset_index === currentDefensePresetId"
                type="button"
                class="nx-btn preset-btn current"
                disabled
              >
                Défense actuelle
              </button>
              <button
                v-else
                type="button"
                class="nx-btn preset-btn"
                :disabled="savingPresetId === p.preset_index"
                @click="setDefense(p.preset_index)"
              >
                {{ savingPresetId === p.preset_index ? 'Enregistrement…' : 'Définir comme défense' }}
              </button>
            </div>
          </li>
        </ul>
        <p v-if="saveError" class="save-error">{{ saveError }}</p>
        <p v-if="saveSuccess" class="save-success">{{ saveSuccess }}</p>
      </template>

      <div class="page-footer">
        <router-link to="/team-builder" class="link-secondary">Créer ou modifier un preset dans le Team Builder</router-link>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../api';
import { getUnitImageUrl } from '@/utils/unitImage';

type PresetUnit = {
  user_unit_id: number;
  name: string;
  level: number;
  image_url?: string | null;
};

interface Preset {
  preset_index: number;
  preset_name: string | null;
  front_slots: number[];
  back_slots: number[];
  front_units: PresetUnit[];
  back_units: PresetUnit[];
}

const presets = ref<Preset[]>([]);
const currentDefensePresetId = ref<number | null>(null);
const savingPresetId = ref<number | null>(null);
const saveError = ref('');
const saveSuccess = ref('');

const currentDefensePresetName = computed(() => {
  if (!currentDefensePresetId.value) return '';
  const p = presets.value.find((x) => x.preset_index === currentDefensePresetId.value);
  return p ? (p.preset_name || `Preset ${p.preset_index}`) : '';
});

function slotSummary(p: Preset): string {
  const front = p.front_slots?.length ?? 0;
  const back = p.back_slots?.length ?? 0;
  const total = front + back;
  return `${total} unité${total !== 1 ? 's' : ''} (${front} front, ${back} arrière)`;
}

function unitImage(unit: PresetUnit): string {
  return getUnitImageUrl(unit) || '/images/default-avatar.svg';
}

async function loadPvpMe() {
  try {
    const { data } = await api.get('/pvp/me');
    currentDefensePresetId.value = data?.defense?.preset_id ?? null;
  } catch {
    currentDefensePresetId.value = null;
  }
}

async function loadPresets() {
  try {
    const { data } = await api.get('/team/presets');
    const raw = data.presets || [];
    presets.value = raw.map((row: any) => ({
      preset_index: row.preset_index,
      preset_name: row.preset_name ?? null,
      front_slots: Array.isArray(row.front_slots) ? row.front_slots : (row.front_slots ? JSON.parse(row.front_slots) : []),
      back_slots: Array.isArray(row.back_slots) ? row.back_slots : (row.back_slots ? JSON.parse(row.back_slots) : []),
      front_units: Array.isArray(row.front_units) ? row.front_units : [],
      back_units: Array.isArray(row.back_units) ? row.back_units : []
    }));
  } catch {
    presets.value = [];
  }
}

async function setDefense(presetId: number) {
  saveError.value = '';
  saveSuccess.value = '';
  savingPresetId.value = presetId;
  try {
    await api.post('/pvp/set-defense', { preset_id: presetId });
    currentDefensePresetId.value = presetId;
    saveSuccess.value = 'Défense PvP enregistrée.';
    setTimeout(() => { saveSuccess.value = ''; }, 3000);
  } catch (e: any) {
    saveError.value = e.response?.data?.message || 'Erreur lors de l\'enregistrement.';
  } finally {
    savingPresetId.value = null;
  }
}

onMounted(() => {
  loadPvpMe();
  loadPresets();
});
</script>

<style scoped>
.pvp-defense-page {
  padding: 1rem;
}
.card {
  max-width: 560px;
  margin: 0 auto;
  background: rgba(15, 23, 42, 0.95);
  border-radius: 1rem;
  padding: 1.5rem 2rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
}
.page-header {
  margin-bottom: 1rem;
}
.back-link {
  display: inline-block;
  color: rgba(148, 163, 184, 0.9);
  text-decoration: none;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}
.back-link:hover {
  color: #e2e8f0;
}
.page-desc {
  color: rgba(148, 163, 184, 0.9);
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
  line-height: 1.4;
}
.current-defense {
  padding: 1rem;
  margin-bottom: 1.5rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(74, 222, 128, 0.3);
  background: rgba(74, 222, 128, 0.08);
}
.current-defense h2 {
  margin: 0 0 0.35rem 0;
  font-size: 1rem;
  color: rgba(148, 163, 184, 0.9);
}
.current-preset-name {
  margin: 0;
  font-weight: 600;
  color: #86efac;
}
.no-presets {
  padding: 1.5rem;
  text-align: center;
  background: rgba(100, 116, 139, 0.15);
  border-radius: 0.75rem;
  margin-bottom: 1rem;
}
.no-presets p {
  margin: 0 0 0.75rem 0;
}
.no-presets .nx-btn {
  margin-top: 0.5rem;
}
.presets-title {
  font-size: 1.1rem;
  margin: 0 0 1rem 0;
}
.preset-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem 0;
}
.preset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 1rem;
  margin-bottom: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
}
.preset-item.is-current {
  border-color: rgba(74, 222, 128, 0.4);
  background: rgba(74, 222, 128, 0.06);
}
.preset-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 240px;
}
.preset-name {
  font-weight: 600;
}
.preset-slots {
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.8);
}
.preset-visual {
  margin-top: 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.preset-row {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
}
.preset-row-label {
  width: 72px;
  flex: 0 0 72px;
  font-size: 0.74rem;
  color: #93c5fd;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-top: 0.35rem;
}
.preset-units {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}
.preset-unit-card {
  width: 84px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.55rem;
  background: rgba(15, 23, 42, 0.68);
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}
.preset-unit-avatar {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  object-fit: cover;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(2, 6, 23, 0.75);
}
.preset-unit-name {
  max-width: 100%;
  font-size: 0.68rem;
  line-height: 1.1;
  text-align: center;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.preset-unit-level {
  font-size: 0.66rem;
  color: #94a3b8;
}
.preset-row-empty {
  color: #64748b;
  font-size: 0.76rem;
  padding-top: 0.35rem;
}
.preset-btn.current {
  opacity: 0.9;
  cursor: default;
}
.save-error {
  color: #f87171;
  font-size: 0.9rem;
  margin: 0 0 1rem 0;
}
.save-success {
  color: #86efac;
  font-size: 0.9rem;
  margin: 0 0 1rem 0;
}
.page-footer {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}
.link-secondary {
  font-size: 0.9rem;
  color: rgba(148, 163, 184, 0.8);
  text-decoration: none;
}
.link-secondary:hover {
  color: #e2e8f0;
}
</style>
