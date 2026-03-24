<template>
  <section class="rest-center" aria-label="Centre de Repos">
    <div class="rest-bg-layer" aria-hidden="true">
      <div class="rest-bg-gradient" />
      <div class="rest-bg-noise" />
      <div class="rest-bg-orb rest-bg-orb-1" />
      <div class="rest-bg-orb rest-bg-orb-2" />
      <div class="rest-floating-dust">
        <span v-for="n in 24" :key="n" class="dust" :style="dustStyle(n)" />
      </div>
    </div>

    <div class="rest-inner">
      <header class="rest-header">
        <h1 class="rest-title">Centre de Repos</h1>
        <p class="rest-subtitle">Place tes unités ici pour accélérer leur récupération.</p>
      </header>

      <div v-if="loading" class="rest-state">Chargement du sanctuaire…</div>
      <div v-else-if="loadError" class="rest-state rest-error">{{ loadError }}</div>
      <template v-else>
        <div class="rest-slots-grid">
          <button
            v-for="(slot, idx) in localSlots"
            :key="idx"
            type="button"
            class="rest-slot"
            :class="{
              'rest-slot-empty': !slot,
              'rest-slot-filled': !!slot,
              'rest-slot-droptarget': dragUserUnitId != null
            }"
            :aria-label="slot ? `Emplacement ${idx + 1}, ${unitLabel(slot)}` : `Emplacement ${idx + 1}, vide`"
            @click="onSlotClick(idx)"
            @dragover.prevent="onDragOver"
            @drop.prevent="onDrop(idx)"
          >
            <div class="rest-slot-aura" aria-hidden="true" />
            <div class="rest-slot-mist" aria-hidden="true" />
            <div class="rest-slot-particles" aria-hidden="true">
              <span v-for="p in 6" :key="p" class="p-orb" />
            </div>
            <template v-if="!slot">
              <span class="rest-slot-plus" aria-hidden="true">+</span>
              <span class="rest-slot-hint">Assigner</span>
            </template>
            <template v-else>
              <img
                v-if="getUnitImageUrl(unitsById.get(slot) ?? null)"
                :src="getUnitImageUrl(unitsById.get(slot) ?? null) || ''"
                :alt="unitLabel(slot)"
                class="rest-slot-portrait"
                draggable="false"
              />
              <div v-else class="rest-slot-fallback">{{ initials(slot) }}</div>
              <span class="rest-slot-name">{{ unitLabel(slot) }}</span>
              <button
                type="button"
                class="rest-slot-clear"
                title="Retirer"
                aria-label="Retirer l'unité de cet emplacement"
                @click.stop="clearSlot(idx)"
              >
                ×
              </button>
            </template>
          </button>
        </div>

        <div class="rest-bonus-panel">
          <div class="rest-bonus-badge">
            <span class="rest-bonus-icon" aria-hidden="true">⚡</span>
            <div>
              <strong>Récupération ×2 active</strong>
              <p class="rest-bonus-detail">Les unités placées perdent <strong>2</strong> points de fatigue par minute au lieu d’1.</p>
            </div>
          </div>
          <div class="rest-count-pill">
            {{ occupiedCount }} / {{ maxSlots }} unités au repos
          </div>
        </div>

        <div class="rest-actions">
          <p v-if="saveMessage" class="rest-save-msg" :class="{ error: saveError }">{{ saveMessage }}</p>
          <button
            type="button"
            class="rest-save-btn"
            :disabled="saving || !dirty"
            @click="save"
          >
            {{ saving ? 'Enregistrement…' : 'Sauvegarder la composition' }}
          </button>
        </div>

        <aside class="rest-roster" aria-label="Collection">
          <h2 class="rest-roster-title">Ta collection</h2>
          <p class="rest-roster-hint">Glisse une unité vers un emplacement ou clique sur un « + » puis choisis ci-dessous.</p>
          <div class="rest-roster-scroll">
            <button
              v-for="u in rosterSorted"
              :key="u.user_unit_id"
              type="button"
              class="rest-roster-card"
              :class="{ 'is-in-slot': isInSlots(u.user_unit_id) }"
              draggable="true"
              @dragstart="onRosterDragStart(u.user_unit_id, $event)"
              @dragend="onRosterDragEnd"
              @click="assignFromRoster(u.user_unit_id)"
            >
              <img
                v-if="getUnitImageUrl(u)"
                :src="getUnitImageUrl(u) || ''"
                :alt="u.name"
                class="rest-roster-img"
              />
              <div v-else class="rest-roster-initials">{{ (u.name || '?').slice(0, 2) }}</div>
              <span class="rest-roster-name">{{ u.name }}</span>
              <span class="rest-roster-fatigue" title="Fatigue">😴 {{ unitFatigue(u) }}</span>
              <span v-if="u.in_rest_center" class="rest-roster-tag">Au centre</span>
            </button>
          </div>
        </aside>
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="pickerOpen"
        class="rest-picker-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Choisir une unité"
        @click.self="closePicker"
      >
        <div class="rest-picker">
          <h3>Choisir une unité</h3>
          <p class="rest-picker-sub">Emplacement {{ (pickerSlotIndex ?? 0) + 1 }} — tri : fatigue décroissante</p>
          <label class="rest-picker-search">
            <span class="sr-only">Rechercher par nom</span>
            <input
              ref="pickerSearchInput"
              v-model="pickerSearchQuery"
              type="search"
              class="rest-picker-search-input"
              placeholder="Rechercher par nom…"
              autocomplete="off"
              @keydown.esc="pickerSearchQuery = ''"
            />
          </label>
          <div class="rest-picker-list">
            <p v-if="pickerCandidates.length === 0" class="rest-picker-empty">
              <template v-if="pickerSearchQuery.trim()">
                Aucune unité ne correspond à « {{ pickerSearchQuery.trim() }} ».
              </template>
              <template v-else>Aucune unité disponible pour cet emplacement.</template>
            </p>
            <button
              v-for="u in pickerCandidates"
              :key="u.user_unit_id"
              type="button"
              class="rest-picker-row"
              @click="pickUnit(u.user_unit_id)"
            >
              <img v-if="getUnitImageUrl(u)" :src="getUnitImageUrl(u) || ''" alt="" class="rest-picker-img" />
              <span class="rest-picker-row-name">{{ u.name }}</span>
              <span class="rest-picker-fatigue" title="Fatigue actuelle">😴 {{ unitFatigue(u) }}</span>
              <span v-if="u.in_rest_center" class="rest-picker-note">Déjà au centre</span>
            </button>
          </div>
          <button type="button" class="rest-picker-cancel" @click="closePicker">Fermer</button>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import api from '../api';
import { getUnitImageUrl } from '../utils/unitImage';

const MAX_SLOTS = 6;

type CollUnit = {
  user_unit_id: number;
  name?: string;
  fatigue?: number;
  in_rest_center?: boolean;
};

const loading = ref(true);
const loadError = ref('');
const localSlots = ref<(number | null)[]>(Array(MAX_SLOTS).fill(null));
const unitsById = ref<Map<number, CollUnit>>(new Map());
const dirty = ref(false);
const saving = ref(false);
const saveMessage = ref('');
const saveError = ref(false);

const dragUserUnitId = ref<number | null>(null);
const pickerOpen = ref(false);
const pickerSlotIndex = ref<number | null>(null);
const pickerSearchQuery = ref('');
const pickerSearchInput = ref<HTMLInputElement | null>(null);

const maxSlots = MAX_SLOTS;
const occupiedCount = computed(() => localSlots.value.filter((x) => x != null).length);

function unitFatigue(u: CollUnit): number {
  const f = Number(u.fatigue);
  return Number.isFinite(f) ? Math.min(100, Math.max(0, f)) : 0;
}

/** Plus fatiguées en premier, puis ordre alphabétique. */
const rosterSorted = computed(() => {
  const list = [...unitsById.value.values()];
  return list.sort((a, b) => {
    const df = unitFatigue(b) - unitFatigue(a);
    if (df !== 0) return df;
    return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
  });
});

const pickerCandidates = computed(() => {
  const taken = new Set(localSlots.value.filter((x): x is number => x != null));
  if (pickerSlotIndex.value != null && localSlots.value[pickerSlotIndex.value]) {
    taken.delete(localSlots.value[pickerSlotIndex.value]!);
  }
  let list = rosterSorted.value.filter((u) => !taken.has(u.user_unit_id));
  const q = pickerSearchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter((u) => String(u.name || '').toLowerCase().includes(q));
  }
  return list;
});

function dustStyle(n: number) {
  const left = ((n * 37) % 100);
  const delay = (n * 0.7) % 8;
  const dur = 10 + (n % 7);
  return {
    left: `${left}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${dur}s`
  };
}

function unitLabel(id: number) {
  return unitsById.value.get(id)?.name || `Unité #${id}`;
}

function initials(id: number) {
  const n = unitLabel(id);
  return n.slice(0, 2).toUpperCase();
}

function isInSlots(userUnitId: number) {
  return localSlots.value.includes(userUnitId);
}

function markDirty() {
  dirty.value = true;
  saveMessage.value = '';
  saveError.value = false;
}

function assignToSlot(slotIndex: number, userUnitId: number) {
  const u = Number(userUnitId);
  if (!Number.isInteger(u) || u <= 0) return;
  if (!unitsById.value.has(u)) return;
  const next = [...localSlots.value];
  const prevIdx = next.indexOf(u);
  if (prevIdx !== -1) next[prevIdx] = null;
  next[slotIndex] = u;
  localSlots.value = next;
  markDirty();
}

function clearSlot(slotIndex: number) {
  const next = [...localSlots.value];
  next[slotIndex] = null;
  localSlots.value = next;
  markDirty();
}

function assignFromRoster(userUnitId: number) {
  const empty = localSlots.value.findIndex((s) => s == null);
  if (empty === -1) {
    saveMessage.value = 'Les 6 emplacements sont pleins. Retire une unité d’abord.';
    saveError.value = true;
    return;
  }
  if (isInSlots(userUnitId)) {
    saveMessage.value = 'Cette unité est déjà placée.';
    saveError.value = true;
    return;
  }
  assignToSlot(empty, userUnitId);
  saveMessage.value = '';
}

function onSlotClick(idx: number) {
  if (localSlots.value[idx]) return;
  pickerSlotIndex.value = idx;
  pickerSearchQuery.value = '';
  pickerOpen.value = true;
  void nextTick(() => pickerSearchInput.value?.focus());
}

function closePicker() {
  pickerOpen.value = false;
  pickerSlotIndex.value = null;
  pickerSearchQuery.value = '';
}

function pickUnit(userUnitId: number) {
  const idx = pickerSlotIndex.value;
  if (idx == null) return;
  assignToSlot(idx, userUnitId);
  closePicker();
}

function onRosterDragStart(userUnitId: number, ev: DragEvent) {
  dragUserUnitId.value = userUnitId;
  ev.dataTransfer?.setData('text/plain', String(userUnitId));
  ev.dataTransfer!.effectAllowed = 'copyMove';
}

function onRosterDragEnd() {
  dragUserUnitId.value = null;
}

function onDragOver(ev: DragEvent) {
  ev.preventDefault();
}

function onDrop(slotIndex: number) {
  const raw = dragUserUnitId.value;
  dragUserUnitId.value = null;
  if (raw == null || !Number.isInteger(raw)) return;
  assignToSlot(slotIndex, raw);
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const [rc, coll] = await Promise.all([api.get('/rest-center'), api.get('/collection')]);
    const slots = rc.data?.slots;
    if (Array.isArray(slots)) {
      const norm = Array(MAX_SLOTS)
        .fill(null)
        .map((_, i) => {
          const v = slots[i];
          if (v == null || v === '') return null;
          const n = Number(v);
          return Number.isInteger(n) && n > 0 ? n : null;
        });
      localSlots.value = norm;
    } else {
      localSlots.value = Array(MAX_SLOTS).fill(null);
    }
    const units: CollUnit[] = coll.data?.units || [];
    const m = new Map<number, CollUnit>();
    for (const u of units) {
      m.set(Number(u.user_unit_id), u);
    }
    unitsById.value = m;
    dirty.value = false;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } };
    loadError.value = err.response?.data?.message || 'Impossible de charger le centre de repos.';
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  saveMessage.value = '';
  saveError.value = false;
  try {
    await api.put('/rest-center', { slots: localSlots.value });
    dirty.value = false;
    saveMessage.value = 'Composition enregistrée. Tes unités récupèrent plus vite.';
    await load();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string; error?: string } } };
    saveError.value = true;
    saveMessage.value = err.response?.data?.message || 'Erreur à l’enregistrement.';
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.rest-center {
  position: relative;
  min-height: calc(100vh - 3rem);
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 0.75rem 3rem;
  box-sizing: border-box;
  animation: restFadeIn 1.2s ease-out both;
}

@keyframes restFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.rest-bg-layer {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.rest-bg-gradient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 120% 80% at 50% 20%, rgba(147, 197, 168, 0.22), transparent 55%),
    radial-gradient(ellipse 90% 60% at 80% 60%, rgba(99, 102, 241, 0.12), transparent 50%),
    radial-gradient(ellipse 70% 50% at 15% 70%, rgba(167, 139, 250, 0.1), transparent 45%),
    linear-gradient(180deg, #0f1729 0%, #162032 35%, #1a2744 100%);
  filter: saturate(1.05);
}

.rest-bg-noise {
  position: absolute;
  inset: 0;
  opacity: 0.04;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.rest-bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.35;
  animation: orbFloat 18s ease-in-out infinite alternate;
}

.rest-bg-orb-1 {
  width: min(50vw, 420px);
  height: min(50vw, 420px);
  left: 10%;
  top: 15%;
  background: radial-gradient(circle, rgba(134, 239, 172, 0.35), transparent 70%);
}

.rest-bg-orb-2 {
  width: min(40vw, 360px);
  height: min(40vw, 360px);
  right: 5%;
  bottom: 10%;
  background: radial-gradient(circle, rgba(129, 140, 248, 0.3), transparent 70%);
  animation-delay: -6s;
}

@keyframes orbFloat {
  from {
    transform: translate(0, 0) scale(1);
  }
  to {
    transform: translate(20px, -16px) scale(1.05);
  }
}

.rest-floating-dust {
  position: absolute;
  inset: 0;
}

.dust {
  position: absolute;
  bottom: -5%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(226, 245, 236, 0.55);
  box-shadow: 0 0 8px rgba(186, 230, 253, 0.5);
  animation-name: dustRise;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes dustRise {
  0% {
    transform: translateY(0) scale(1);
    opacity: 0;
  }
  12% {
    opacity: 0.7;
  }
  100% {
    transform: translateY(-110vh) scale(0.4);
    opacity: 0;
  }
}

.rest-inner {
  position: relative;
  z-index: 1;
}

.rest-header {
  text-align: center;
  margin-bottom: 1.75rem;
}

.rest-title {
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 500;
  font-size: clamp(1.75rem, 4vw, 2.35rem);
  letter-spacing: 0.04em;
  color: #e8f4f0;
  text-shadow:
    0 0 24px rgba(167, 243, 208, 0.35),
    0 0 48px rgba(99, 102, 241, 0.15);
  margin: 0 0 0.5rem;
  animation: titleShimmer 10s ease-in-out infinite;
}

@keyframes titleShimmer {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.08);
  }
}

.rest-subtitle {
  margin: 0;
  font-size: 1rem;
  color: rgba(200, 220, 215, 0.88);
  max-width: 28rem;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.5;
}

.rest-state {
  text-align: center;
  color: rgba(200, 220, 215, 0.9);
  padding: 2rem;
}

.rest-error {
  color: #fca5a5;
}

.rest-slots-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  max-width: 720px;
  margin: 0 auto 1.5rem;
}

@media (max-width: 640px) {
  .rest-slots-grid {
    grid-template-columns: repeat(2, 1fr);
    max-width: 440px;
  }
}

.rest-slot {
  position: relative;
  aspect-ratio: 1;
  max-height: 200px;
  border: 1px solid rgba(148, 214, 191, 0.28);
  border-radius: 18px;
  background: rgba(15, 35, 45, 0.45);
  backdrop-filter: blur(8px);
  cursor: pointer;
  overflow: hidden;
  transition:
    transform 0.45s cubic-bezier(0.25, 0.8, 0.25, 1),
    box-shadow 0.45s ease,
    border-color 0.4s ease;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(224, 242, 232, 0.95);
}

.rest-slot:hover {
  transform: scale(1.03);
  border-color: rgba(186, 230, 253, 0.45);
  box-shadow:
    0 0 0 1px rgba(167, 243, 208, 0.2),
    0 12px 40px rgba(15, 25, 50, 0.45),
    0 0 32px rgba(129, 140, 248, 0.2);
}

.rest-slot-empty .rest-slot-aura {
  opacity: 0.15;
}

.rest-slot-filled .rest-slot-aura {
  opacity: 0.55;
  animation: slotPulse 4.5s ease-in-out infinite;
}

@keyframes slotPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.45;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.65;
  }
}

.rest-slot-aura {
  position: absolute;
  inset: -20%;
  background: radial-gradient(circle at 50% 60%, rgba(110, 231, 183, 0.25), transparent 62%);
  pointer-events: none;
}

.rest-slot-mist {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 45%;
  background: linear-gradient(0deg, rgba(99, 102, 241, 0.12), transparent);
  pointer-events: none;
  opacity: 0.8;
  animation: mistBreath 6s ease-in-out infinite;
}

@keyframes mistBreath {
  0%,
  100% {
    opacity: 0.55;
    transform: translateY(4px);
  }
  50% {
    opacity: 0.85;
    transform: translateY(0);
  }
}

.rest-slot-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.rest-slot-filled .p-orb {
  opacity: 0.45;
}

.p-orb {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(207, 250, 254, 0.9);
  left: calc(20% + var(--i, 0) * 12%);
  bottom: 15%;
  animation: particleFloat 5s ease-in-out infinite;
  opacity: 0;
}

.rest-slot-filled .p-orb:nth-child(1) {
  --i: 0;
  left: 25%;
  animation-delay: 0s;
}
.rest-slot-filled .p-orb:nth-child(2) {
  --i: 1;
  left: 45%;
  animation-delay: 0.8s;
}
.rest-slot-filled .p-orb:nth-child(3) {
  --i: 2;
  left: 65%;
  animation-delay: 1.6s;
}
.rest-slot-filled .p-orb:nth-child(4) {
  --i: 3;
  left: 35%;
  animation-delay: 2.2s;
}
.rest-slot-filled .p-orb:nth-child(5) {
  --i: 4;
  left: 55%;
  animation-delay: 3s;
}
.rest-slot-filled .p-orb:nth-child(6) {
  --i: 5;
  left: 75%;
  animation-delay: 3.8s;
}

@keyframes particleFloat {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0;
  }
  20% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(-70px);
    opacity: 0;
  }
}

.rest-slot-plus {
  font-size: 2.5rem;
  font-weight: 300;
  color: rgba(167, 243, 208, 0.65);
  line-height: 1;
}

.rest-slot-hint {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(186, 230, 253, 0.55);
  margin-top: 0.35rem;
}

.rest-slot-portrait {
  width: 68%;
  height: 68%;
  object-fit: cover;
  object-position: top center;
  border-radius: 12px;
  border: 1px solid rgba(186, 230, 253, 0.25);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  z-index: 1;
}

.rest-slot-fallback {
  width: 68%;
  aspect-ratio: 1;
  border-radius: 12px;
  background: rgba(51, 65, 85, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  z-index: 1;
}

.rest-slot-name {
  position: absolute;
  bottom: 0.35rem;
  left: 0.35rem;
  right: 0.35rem;
  font-size: 0.7rem;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  z-index: 2;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}

.rest-slot-clear {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 50%;
  border: none;
  background: rgba(15, 23, 42, 0.65);
  color: rgba(226, 232, 240, 0.95);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  z-index: 3;
  transition: background 0.2s;
}

.rest-slot-clear:hover {
  background: rgba(51, 65, 85, 0.9);
}

.rest-bonus-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.rest-bonus-badge {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(34, 80, 72, 0.5), rgba(49, 46, 129, 0.35));
  border: 1px solid rgba(129, 230, 217, 0.28);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
  max-width: min(100%, 420px);
}

.rest-bonus-icon {
  font-size: 1.4rem;
  filter: drop-shadow(0 0 10px rgba(250, 204, 21, 0.25));
}

.rest-bonus-badge strong {
  color: #d1fae5;
  display: block;
  margin-bottom: 0.25rem;
}

.rest-bonus-detail {
  margin: 0;
  font-size: 0.88rem;
  color: rgba(204, 228, 220, 0.88);
  line-height: 1.45;
}

.rest-count-pill {
  padding: 0.5rem 1rem;
  border-radius: 999px;
  background: rgba(79, 70, 229, 0.22);
  border: 1px solid rgba(165, 180, 252, 0.35);
  color: rgba(224, 231, 255, 0.95);
  font-size: 0.9rem;
}

.rest-actions {
  text-align: center;
  margin-bottom: 2rem;
}

.rest-save-msg {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  color: rgba(167, 243, 208, 0.95);
}

.rest-save-msg.error {
  color: #fecaca;
}

.rest-save-btn {
  appearance: none;
  border: 1px solid rgba(167, 243, 208, 0.45);
  background: linear-gradient(180deg, rgba(45, 95, 88, 0.85), rgba(30, 58, 75, 0.9));
  color: #ecfdf5;
  font-size: 1rem;
  padding: 0.75rem 1.75rem;
  border-radius: 999px;
  cursor: pointer;
  box-shadow:
    0 0 20px rgba(52, 211, 153, 0.2),
    0 6px 20px rgba(0, 0, 0, 0.3);
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    filter 0.25s ease;
}

.rest-save-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow:
    0 0 28px rgba(52, 211, 153, 0.35),
    0 10px 28px rgba(0, 0, 0, 0.35);
  filter: brightness(1.06);
}

.rest-save-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.rest-roster {
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem;
  border-radius: 16px;
  background: rgba(15, 30, 45, 0.42);
  border: 1px solid rgba(100, 116, 139, 0.25);
}

.rest-roster-title {
  margin: 0 0 0.35rem;
  font-size: 1.1rem;
  color: rgba(226, 245, 236, 0.95);
}

.rest-roster-hint {
  margin: 0 0 0.75rem;
  font-size: 0.82rem;
  color: rgba(148, 163, 184, 0.95);
  line-height: 1.4;
}

.rest-roster-scroll {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.6rem;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.rest-roster-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem;
  border-radius: 12px;
  border: 1px solid rgba(99, 102, 241, 0.22);
  background: rgba(30, 41, 59, 0.55);
  cursor: grab;
  color: rgba(226, 232, 240, 0.95);
  transition:
    border-color 0.25s,
    box-shadow 0.25s,
    transform 0.2s;
}

.rest-roster-card:hover {
  border-color: rgba(167, 243, 208, 0.45);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  transform: translateY(-1px);
}

.rest-roster-card.is-in-slot {
  border-color: rgba(52, 211, 153, 0.45);
  box-shadow: 0 0 12px rgba(52, 211, 153, 0.15);
}

.rest-roster-img {
  width: 56px;
  height: 56px;
  object-fit: cover;
  object-position: top center;
  border-radius: 10px;
}

.rest-roster-initials {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  background: rgba(51, 65, 85, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
}

.rest-roster-name {
  font-size: 0.68rem;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rest-roster-tag {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 0.55rem;
  padding: 0.1rem 0.25rem;
  border-radius: 4px;
  background: rgba(52, 211, 153, 0.25);
  color: #a7f3d0;
}

.rest-roster-fatigue {
  font-size: 0.62rem;
  color: rgba(165, 180, 252, 0.95);
  line-height: 1.2;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.rest-picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.rest-picker {
  width: min(100%, 440px);
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1e293b, #0f172a);
  border: 1px solid rgba(129, 140, 248, 0.35);
  border-radius: 16px;
  padding: 1rem;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
}

.rest-picker h3 {
  margin: 0 0 0.25rem;
  color: #e2e8f0;
}

.rest-picker-sub {
  margin: 0 0 0.6rem;
  font-size: 0.85rem;
  color: #94a3b8;
}

.rest-picker-search {
  display: block;
  margin-bottom: 0.65rem;
}

.rest-picker-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  border: 1px solid rgba(100, 116, 139, 0.55);
  background: rgba(15, 23, 42, 0.65);
  color: #e2e8f0;
  font-size: 0.9rem;
}

.rest-picker-search-input::placeholder {
  color: rgba(148, 163, 184, 0.8);
}

.rest-picker-search-input:focus {
  outline: none;
  border-color: rgba(167, 243, 208, 0.45);
  box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.15);
}

.rest-picker-empty {
  margin: 0.5rem 0;
  font-size: 0.88rem;
  color: #94a3b8;
  text-align: center;
  padding: 0.5rem;
}

.rest-picker-list {
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.rest-picker-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.65rem;
  border-radius: 10px;
  border: 1px solid rgba(71, 85, 105, 0.5);
  background: rgba(30, 41, 59, 0.6);
  color: #e2e8f0;
  cursor: pointer;
  text-align: left;
}

.rest-picker-row:hover {
  border-color: rgba(167, 243, 208, 0.4);
}

.rest-picker-row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rest-picker-fatigue {
  flex-shrink: 0;
  font-size: 0.72rem;
  color: #c7d2fe;
  white-space: nowrap;
}

.rest-picker-img {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  object-fit: cover;
  object-position: top center;
  border-radius: 8px;
}

.rest-picker-note {
  flex-shrink: 0;
  margin-left: 0.25rem;
  font-size: 0.7rem;
  color: #86efac;
}

.rest-picker-cancel {
  margin-top: 0.75rem;
  align-self: center;
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.45);
  color: #cbd5e1;
  padding: 0.4rem 1rem;
  border-radius: 999px;
  cursor: pointer;
}
</style>
