<template>
  <section class="guild-panel nx-panel">
    <div class="guild-portal-header">
      <div class="guild-portal-title-block">
        <span class="guild-panel-kicker">Invocation hebdomadaire</span>
        <h3 class="guild-panel-title">Portail de Guilde</h3>
      </div>
      <div class="guild-portal-header-right">
        <div class="guild-portal-meta">
          <div class="guild-portal-pill">🪙 {{ guildCoins }}</div>
          <div class="guild-portal-pill guild-portal-pill--cost">{{ summonCost }} / invoc.</div>
        </div>
        <div class="guild-portal-summon-wrap">
          <button
            type="button"
            class="guild-summon-button"
            :disabled="loading || summonLoading || !canSummon"
            @click="$emit('summon')"
          >
            <span v-if="summonLoading" class="summon-spinner" />
            {{ summonLoading ? 'Invocation...' : 'Invoquer' }}
          </button>
          <span v-if="!canSummon && !summonLoading" class="guild-portal-warning">🪙 {{ summonCost }} requis</span>
        </div>
      </div>
    </div>

    <p v-if="loading" class="guild-empty">Chargement de la rotation...</p>
    <div v-else-if="rotation" class="guild-rotation">
      <div class="guild-rotation-summary">
        <span>Semaine {{ rotation.week_number }} / {{ rotation.week_year }}</span>
        <span v-if="rotation.ends_at">Fin : {{ formatDate(rotation.ends_at) }}</span>
      </div>
      <div class="guild-rotation-grid">
        <article
          v-for="unit in displayedUnits"
          :key="unit.slot_index"
          class="guild-unit-card"
          :class="`rarity-${unit.rarity}`"
        >
          <div class="guild-unit-image-wrap" :class="{ 'guild-unit-image-blurred': !isOwned(unit) }">
            <img :src="getUnitImageUrl(unit) || ''" :alt="unit.name" class="guild-unit-image" />
          </div>
          <div class="guild-unit-body">
            <strong>{{ unit.name }}</strong>
            <span>{{ rarityLabel(unit.rarity) }}</span>
            <small>{{ elementLabel(unit.element) }} · {{ roleLabel(unit.role) }}</small>
          </div>
        </article>
      </div>
    </div>
    <p v-else class="guild-empty">Aucune rotation disponible.</p>

    <!-- Overlay animation (Sanctuary style) -->
    <Teleport to="body">
      <Transition name="overlay">
        <div
          v-if="showOverlay"
          class="gacha-overlay invoke-camera-wrap"
          :class="[overlayClass, cameraClass, screenShakeClass]"
          @click.self="canClose && phase === 'reveal' && closeOverlay()"
        >
          <div class="overlay-backdrop" />

          <!-- 1–4) Portail + vortex + orb -->
          <div
            v-if="phase !== 'reveal'"
            class="portal-center portal-active"
            :class="[portalRarityClass, phase, { 'portal-vortex': phase !== 'portal' }]"
          >
            <div class="portal-hex" />
            <div v-if="phase !== 'portal'" class="vortex-particles">
              <span v-for="n in 12" :key="n" class="vortex-particle" :style="vortexParticleStyle(n)" />
            </div>
            <div
              v-if="showOrb"
              class="rarity-orb orb-premium"
              :class="[orbRarityClass, { 'orb-shake': phase === 'shake' }]"
              :style="orbStyle"
            >
              <div class="orb-outer-glow" />
              <div class="orb-inner-glow" />
              <div class="orb-ring orb-ring-1" />
              <div class="orb-ring orb-ring-2" />
              <div class="orb-core" />
              <div class="orb-vortex-inner" />
              <div class="orb-particles">
                <span v-for="n in orbParticleCount" :key="n" class="orb-particle" :style="orbParticleStyle(n)" />
              </div>
              <div class="orb-sparks">
                <span v-for="n in 6" :key="n" class="orb-spark" :style="orbSparkStyle(n)" />
              </div>
            </div>
          </div>

          <!-- 5) Explosion -->
          <div v-if="showExplosion" class="explosion-flash" :class="rarityClass" />

          <!-- 6) Révélation -->
          <div
            v-if="phase === 'reveal'"
            class="reveal-wrap unit-reveal"
            :class="[rarityClass, elementEffectClass]"
          >
            <div v-if="elementSlug && elementSlug !== 'neutral'" class="element-effect" :class="`element-${elementSlug}`" />
            <div v-if="animResultRarity === 'epic'" class="epic-lightning" />
            <div v-if="animResultRarity === 'legendary'" class="legendary-halo" />
            <div v-if="animResultRarity === 'legendary'" class="legendary-particles">
              <span v-for="n in 10" :key="n" class="legendary-particle" :style="particleStyle(n)" />
            </div>
            <div v-if="animResultRarity === 'mythic'" class="mythic-bg" />
            <div v-if="animResultRarity === 'mythic'" class="mythic-halo" />
            <div v-if="animResultRarity === 'mythic'" class="mythic-crack" />

            <div class="reveal-card unit-reveal-card nx-card" :class="[rarityClass, revealCardRarityClass]">
              <div
                v-if="animUnit"
                class="reveal-portrait-wrap unit-reveal-portrait"
                :class="{ 'reveal-portrait-clickable': !!revealPortraitUrl }"
                role="button"
                tabindex="0"
                title="Agrandir l'image"
                @click="openFullscreenImage(revealPortraitUrl, animUnit?.name)"
                @keydown.enter="openFullscreenImage(revealPortraitUrl, animUnit?.name)"
              >
                <div class="unit-reveal-portrait-bg" />
                <img
                  v-if="revealPortraitUrl"
                  :src="revealPortraitUrl"
                  alt=""
                  class="reveal-portrait unit-reveal-portrait-img"
                />
              </div>
              <h3 v-if="animResultRarity === 'mythic'" class="mythic-title nx-title">MYTHIC</h3>
              <h3 class="nx-title unit-reveal-name">{{ animUnit?.name }}</h3>
              <div class="reveal-stars unit-reveal-stars">
                <span
                  v-for="i in 6"
                  :key="i"
                  class="star"
                  :class="{
                    'star-filled': i <= starCount,
                    'star-glow': i <= starCount,
                    'star-last': i === starCount && starCount > 0
                  }"
                  :style="starStyle(i)"
                >⭐</span>
              </div>
              <span class="rarity-badge unit-reveal-rarity nx-badge" :class="rarityClass">{{ rarityLabel(animResultRarity) }}</span>
              <div class="unit-reveal-meta">
                <p v-if="animUnit?.role" class="reveal-role">{{ roleLabel(animUnit.role) }}</p>
                <p v-if="animUnit?.element" class="reveal-element">{{ elementLabel(animUnit.element) }}</p>
              </div>
              <p class="guild-result-balance">🪙 Solde : {{ result?.guild_coins ?? 0 }}</p>
              <button class="btn-close nx-btn" :disabled="!canClose" @click="canClose && closeOverlay()">Fermer</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Fullscreen image -->
      <Transition name="image-fullscreen">
        <div
          v-if="showImageFullscreen && fullscreenImageUrl"
          class="image-fullscreen-overlay"
          @click.self="showImageFullscreen = false"
        >
          <button
            type="button"
            class="image-fullscreen-close"
            aria-label="Fermer"
            @click="showImageFullscreen = false"
          >✕</button>
          <div class="image-fullscreen-content">
            <img :src="fullscreenImageUrl" :alt="fullscreenImageName || 'Unité'" class="image-fullscreen-img" />
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getUnitImageUrl } from '../../utils/unitImage';
import {
  runInvokeAnimation,
  rarityColors,
  getStarsForRarity,
  getFakeOutRarity,
  getElementSlug,
  getScreenShakeCssClass
} from '../../utils/invokeAnimation';

type RotationUnit = {
  slot_index: number;
  unit_id?: number;
  rarity: string;
  name: string;
  role: string;
  element: string;
  image_url?: string | null;
};

type SummonUnit = {
  name?: string | null;
  image_url?: string | null;
  element?: string | null;
  role?: string | null;
};

type SummonResult = {
  rarity: string;
  guild_coins: number;
  unit: SummonUnit | null;
};

const props = defineProps<{
  rotation: { week_year: number; week_number: number; ends_at: string | null; units: RotationUnit[] } | null;
  ownedUnitIds?: number[];
  guildCoins: number;
  summonCost: number;
  loading: boolean;
  summonLoading: boolean;
  result: SummonResult | null;
}>();

function isOwned(unit: RotationUnit): boolean {
  const id = unit.unit_id ?? (unit as any).id;
  if (id == null) return true;
  return (props.ownedUnitIds ?? []).includes(Number(id));
}

const emit = defineEmits<{
  (event: 'summon'): void;
  (event: 'close-result'): void;
}>();

// ── Animation state ──────────────────────────────────────────────────────────
const showOverlay = ref(false);
const phase = ref<'portal' | 'vortex' | 'orb' | 'shake' | 'explosion' | 'reveal'>('portal');
const canClose = ref(false);
const animResultRarity = ref('');
const animUnit = ref<SummonUnit | null>(null);
const showOrb = ref(false);
const orbRarity = ref('');
const showExplosion = ref(false);
const cameraClass = ref('');
const screenShakeClass = ref('');

// Fullscreen image
const showImageFullscreen = ref(false);
const fullscreenImageUrl = ref('');
const fullscreenImageName = ref('');

// ── Computed ──────────────────────────────────────────────────────────────────
const displayedUnits = computed(() =>
  [...(props.rotation?.units ?? [])].sort((a, b) => Number(a.slot_index) - Number(b.slot_index))
);
const canSummon = computed(() => props.guildCoins >= props.summonCost);

const rarityClass = computed(() => `rarity-${(animResultRarity.value || 'common').toLowerCase()}`);
const portalRarityClass = computed(() => rarityClass.value);
const orbRarityClass = computed(() => `rarity-${(orbRarity.value || 'common').toLowerCase()}`);
const overlayClass = computed(() => rarityClass.value);

const orbStyle = computed(() => {
  const r = (orbRarity.value || 'common').toLowerCase();
  const color = rarityColors[r] ?? rarityColors.common;
  return { '--orb-color': color };
});

const orbParticleCount = computed(() => {
  const map: Record<string, number> = { common: 6, uncommon: 8, rare: 10, epic: 12, legendary: 14, mythic: 16 };
  return map[(orbRarity.value || 'common').toLowerCase()] ?? 8;
});

const revealCardRarityClass = computed(() => {
  const r = (animResultRarity.value || 'common').toLowerCase();
  if (r === 'legendary' || r === 'mythic') return `reveal-card-premium rarity-${r}`;
  return '';
});

const revealPortraitUrl = computed(() => getUnitImageUrl(animUnit.value));
const starCount = computed(() => getStarsForRarity(animResultRarity.value));
const elementSlug = computed(() => getElementSlug(animUnit.value?.element ?? undefined));
const elementEffectClass = computed(() =>
  elementSlug.value && elementSlug.value !== 'neutral' ? `element-effect-${elementSlug.value}` : ''
);

// ── Watch result prop → trigger animation ─────────────────────────────────────
watch(() => props.result, (newResult) => {
  if (!newResult) return;
  animResultRarity.value = (newResult.rarity || 'common').toLowerCase();
  animUnit.value = newResult.unit;
  startAnimation();
});

// ── Animation ─────────────────────────────────────────────────────────────────
function startAnimation() {
  canClose.value = false;
  phase.value = 'portal';
  showOrb.value = false;
  orbRarity.value = '';
  showExplosion.value = false;
  screenShakeClass.value = '';
  cameraClass.value = 'camera-zoom-in';
  showOverlay.value = true;

  const controller = {
    startPortalAnimation() {
      phase.value = 'portal';
      setTimeout(() => {
        phase.value = 'vortex';
        cameraClass.value = 'camera-zoom-pulse';
      }, 100);
    },
    playPortalCharge() { /* noop */ },
    spawnOrb(rarity: string) {
      orbRarity.value = rarity;
      showOrb.value = true;
      phase.value = 'orb';
    },
    orbSuspense(finalRarity: string) {
      phase.value = 'shake';
      const fake = getFakeOutRarity(finalRarity);
      if (fake) {
        orbRarity.value = fake;
        setTimeout(() => { orbRarity.value = finalRarity; }, 500);
      } else {
        orbRarity.value = finalRarity;
      }
    },
    explodeOrb() {
      showExplosion.value = true;
      phase.value = 'explosion';
      screenShakeClass.value = getScreenShakeCssClass(animResultRarity.value);
      cameraClass.value = 'camera-reset';
      setTimeout(() => {
        showOrb.value = false;
        showExplosion.value = false;
        screenShakeClass.value = '';
      }, 400);
    },
    revealUnit() {
      phase.value = 'reveal';
      canClose.value = true;
      cameraClass.value = 'camera-reset';
    },
    showStars() { /* géré par le template */ },
    elementEffect() { /* géré par le template */ },
    resetInvokeScene() {
      cameraClass.value = '';
      screenShakeClass.value = '';
    }
  };

  runInvokeAnimation(controller, animResultRarity.value, animUnit.value);
}

function closeOverlay() {
  if (!canClose.value) return;
  showOverlay.value = false;
  showImageFullscreen.value = false;
  fullscreenImageUrl.value = '';
  fullscreenImageName.value = '';
  animUnit.value = null;
  animResultRarity.value = '';
  phase.value = 'portal';
  showOrb.value = false;
  orbRarity.value = '';
  showExplosion.value = false;
  cameraClass.value = '';
  screenShakeClass.value = '';
  canClose.value = false;
  emit('close-result');
}

function openFullscreenImage(imageUrl?: string | null, imageName?: string | null) {
  if (!imageUrl) return;
  fullscreenImageUrl.value = imageUrl;
  fullscreenImageName.value = imageName ?? '';
  showImageFullscreen.value = true;
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function starStyle(index: number) {
  const delay = (index - 1) * 0.14;
  const isLast = index === starCount.value && starCount.value > 0;
  return { '--star-delay': `${delay}s`, '--star-burst': isLast ? '1' : '0' };
}

function orbSparkStyle(n: number) {
  const angle = (n / 6) * 360;
  const rad = (angle * Math.PI) / 180;
  return {
    '--spark-x': `${Math.cos(rad) * 55}px`,
    '--spark-y': `${Math.sin(rad) * 55}px`,
    '--spark-delay': `${(n - 1) * 0.06}s`
  };
}

function particleStyle(n: number) {
  const rad = ((n - 1) / 10) * 2 * Math.PI;
  return {
    '--particle-x': `${Math.round(Math.cos(rad) * 70)}px`,
    '--particle-y': `${Math.round(Math.sin(rad) * 70)}px`,
    '--particle-delay': `${(n - 1) * 0.03}s`
  };
}

function vortexParticleStyle(n: number) {
  const rad = ((n - 1) / 12) * 2 * Math.PI;
  const dist = 80 + (n % 3) * 15;
  return {
    '--vx': `${Math.round(Math.cos(rad) * dist)}px`,
    '--vy': `${Math.round(Math.sin(rad) * dist)}px`,
    '--vdelay': `${(n - 1) * 0.05}s`
  };
}

function orbParticleStyle(n: number) {
  const rad = (n / 8) * 2 * Math.PI;
  return {
    '--ox': `${Math.round(Math.cos(rad) * 45)}px`,
    '--oy': `${Math.round(Math.sin(rad) * 45)}px`,
    '--odelay': `${(n - 1) * 0.04}s`
  };
}

// ── Label helpers ─────────────────────────────────────────────────────────────
function rarityLabel(rarity: string) {
  const r = String(rarity).toLowerCase();
  if (r === 'mythic') return 'Mythique';
  if (r === 'legendary') return 'Légendaire';
  if (r === 'epic') return 'Épique';
  if (r === 'rare') return 'Rare';
  if (r === 'uncommon') return 'Peu commune';
  return 'Commune';
}

function elementLabel(element: string | null | undefined) {
  const e = String(element ?? '').toLowerCase();
  if (e === 'fire' || e === 'feu') return 'Feu';
  if (e === 'water' || e === 'eau') return 'Eau';
  if (e === 'plant' || e === 'plante') return 'Plante';
  if (e === 'light' || e.includes('lumi')) return 'Lumière';
  if (e === 'dark' || e.includes('teneb') || e.includes('ombre')) return 'Ténèbres';
  return element || 'Neutre';
}

function roleLabel(role: string | null | undefined) {
  const r = String(role ?? '').toLowerCase();
  if (r === 'support') return 'Support';
  if (r === 'tank') return 'Tank';
  if (r === 'healer') return 'Healer';
  return role || 'Combattant';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR');
}
</script>

<style scoped>
/* ── Panel ────────────────────────────────────────────────────────────────── */
.guild-panel {
  padding: 18px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.08), transparent 24%),
    linear-gradient(180deg, rgba(8, 13, 24, 0.96), rgba(11, 20, 35, 0.94));
  border: 1px solid rgba(125, 211, 252, 0.12);
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.guild-portal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.guild-portal-title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.guild-panel-kicker {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(192, 132, 252, 0.14);
  border: 1px solid rgba(216, 180, 254, 0.18);
  color: #e9d5ff;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.guild-panel-title {
  margin: 0;
  font-size: 1.1rem;
}

.guild-portal-header-right {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  gap: 10px;
}

.guild-portal-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-self: start;
}

.guild-portal-summon-wrap {
  grid-column: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.guild-portal-pill {
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.62);
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: #f8fafc;
  font-weight: 700;
  font-size: 0.85rem;
}

.guild-portal-pill--cost {
  color: #c4b5fd;
  border-color: rgba(192, 132, 252, 0.2);
}

.guild-portal-warning {
  color: #fca5a5;
  font-size: 0.8rem;
  white-space: nowrap;
}

/* ── Summon button ────────────────────────────────────────────────────────── */
.guild-summon-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 20px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #8b5cf6, #0ea5e9);
  color: #eff6ff;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: 0 12px 28px rgba(14, 165, 233, 0.22);
  transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
  cursor: pointer;
  white-space: nowrap;
}

.guild-summon-button:hover:enabled {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 18px 34px rgba(139, 92, 246, 0.3);
}

.guild-summon-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.summon-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Rotation ─────────────────────────────────────────────────────────────── */
.guild-panel-text,
.guild-empty {
  margin: 0;
  color: #cbd5e1;
}

.guild-rotation-summary {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  color: #cbd5e1;
  font-size: 0.82rem;
}

.guild-rotation-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.guild-unit-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.66);
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 12px 22px rgba(2, 6, 23, 0.18);
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.guild-unit-image-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 92px;
  padding: 4px;
  border-radius: 10px;
  background: rgba(2, 6, 23, 0.42);
}

.guild-unit-card:hover { transform: translateY(-4px); }
.guild-unit-card.rarity-common:hover { border-color: rgba(148, 163, 184, 0.3); }
.guild-unit-card.rarity-uncommon:hover { border-color: rgba(74, 222, 128, 0.34); box-shadow: 0 18px 34px rgba(22, 101, 52, 0.28); }
.guild-unit-card.rarity-rare:hover { border-color: rgba(96, 165, 250, 0.34); box-shadow: 0 18px 34px rgba(30, 64, 175, 0.3); }
.guild-unit-card.rarity-epic:hover { border-color: rgba(192, 132, 252, 0.34); box-shadow: 0 18px 34px rgba(107, 33, 168, 0.32); }
.guild-unit-card.rarity-legendary:hover { border-color: rgba(250, 204, 21, 0.34); box-shadow: 0 18px 34px rgba(146, 64, 14, 0.34); }
.guild-unit-card.rarity-mythic:hover { border-color: rgba(251, 113, 133, 0.4); box-shadow: 0 18px 34px rgba(159, 18, 57, 0.34); }

.guild-unit-image {
  width: 100%;
  height: 100%;
  max-width: 84px;
  max-height: 84px;
  object-fit: contain;
  object-position: center;
}

.guild-unit-image-wrap.guild-unit-image-blurred .guild-unit-image {
  filter: blur(10px);
  user-select: none;
}

.guild-unit-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.guild-unit-body strong { font-size: 0.82rem; line-height: 1.15; }
.guild-unit-card span, .guild-unit-card small { color: #cbd5e1; font-size: 0.72rem; line-height: 1.2; }

/* ── Animation overlay ────────────────────────────────────────────────────── */
.gacha-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
}

.invoke-camera-wrap {
  transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.invoke-camera-wrap.camera-zoom-in { animation: camera-zoom-in 0.6s ease-out forwards; }
.invoke-camera-wrap.camera-zoom-pulse { animation: camera-zoom-pulse 2s ease-in-out infinite; }
.invoke-camera-wrap.camera-reset { animation: camera-reset 0.5s ease-out forwards; }

@keyframes camera-zoom-in { 0% { transform: scale(0.98); } 100% { transform: scale(1); } }
@keyframes camera-zoom-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
@keyframes camera-reset { 0% { transform: scale(1.02); } 100% { transform: scale(1); } }

.invoke-camera-wrap.screen-shake-light { animation: screen-shake-light 0.35s ease-out; }
.invoke-camera-wrap.screen-shake-medium { animation: screen-shake-medium 0.4s ease-out; }
.invoke-camera-wrap.screen-shake-heavy { animation: screen-shake-heavy 0.5s ease-out; }

@keyframes screen-shake-light {
  0%, 100% { transform: translate(0,0); }
  20% { transform: translate(-3px,2px); }
  40% { transform: translate(3px,-2px); }
  60% { transform: translate(-2px,1px); }
  80% { transform: translate(2px,-1px); }
}
@keyframes screen-shake-medium {
  0%, 100% { transform: translate(0,0); }
  15% { transform: translate(-6px,4px); }
  30% { transform: translate(6px,-4px); }
  45% { transform: translate(-4px,3px); }
  60% { transform: translate(4px,-3px); }
  75% { transform: translate(-2px,2px); }
}
@keyframes screen-shake-heavy {
  0%, 100% { transform: translate(0,0); }
  10% { transform: translate(-10px,6px); }
  20% { transform: translate(10px,-6px); }
  30% { transform: translate(-8px,5px); }
  40% { transform: translate(8px,-5px); }
  50% { transform: translate(-5px,4px); }
  60% { transform: translate(5px,-4px); }
  70% { transform: translate(-3px,2px); }
  80% { transform: translate(3px,-2px); }
}

/* ── Portail ──────────────────────────────────────────────────────────────── */
.portal-center {
  position: relative;
  z-index: 1;
  width: 220px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.portal-center.portal-active .portal-hex {
  animation: portal-rotate 3s linear infinite, portal-glow 1.5s ease-in-out infinite;
}

.portal-hex {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  border: 4px solid currentColor;
  background: rgba(0,0,0,0.3);
  box-shadow: 0 0 40px currentColor, inset 0 0 20px rgba(255,255,255,0.1);
}

.portal-center.rarity-common .portal-hex { color: #78716c; }
.portal-center.rarity-uncommon .portal-hex { color: #22c55e; }
.portal-center.rarity-rare .portal-hex { color: #3b82f6; }
.portal-center.rarity-epic .portal-hex { color: #a855f7; }
.portal-center.rarity-legendary .portal-hex { color: #eab308; }
.portal-center.rarity-mythic .portal-hex { color: #dc2626; }

@keyframes portal-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes portal-glow { 0%, 100% { filter: brightness(1); opacity: 1; } 50% { filter: brightness(1.4); opacity: 0.95; } }

/* ── Vortex ───────────────────────────────────────────────────────────────── */
.portal-vortex { overflow: visible; }
.vortex-particles { position: absolute; inset: 0; pointer-events: none; }
.vortex-particle {
  position: absolute;
  left: 50%; top: 50%;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.8);
  box-shadow: 0 0 8px rgba(255,255,255,0.6);
  animation: vortex-in 1s ease-in var(--vdelay,0s) forwards;
  transform: translate(-50%,-50%) translate(var(--vx), var(--vy));
  opacity: 0.9;
}

@keyframes vortex-in {
  from { opacity: 0.9; transform: translate(-50%,-50%) translate(var(--vx),var(--vy)); }
  to { opacity: 0; transform: translate(-50%,-50%) translate(0,0); }
}

/* ── Orb ──────────────────────────────────────────────────────────────────── */
.rarity-orb.orb-premium {
  position: absolute;
  width: 100px; height: 100px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  --orb-color: #78716c;
}

.orb-outer-glow {
  position: absolute; inset: -35px; border-radius: 50%;
  background: radial-gradient(circle, var(--orb-color) 0%, transparent 65%);
  opacity: 0.4; filter: blur(12px);
  animation: orb-intensity 1.2s ease-in-out infinite;
}
.orb-inner-glow {
  position: absolute; inset: -15px; border-radius: 50%;
  background: radial-gradient(circle, var(--orb-color) 0%, transparent 60%);
  opacity: 0.7; filter: blur(8px);
  animation: orb-intensity 1s ease-in-out infinite 0.1s;
}
.orb-ring {
  position: absolute; width: 85px; height: 85px; border-radius: 50%;
  border: 2px solid var(--orb-color);
  opacity: 0.6; box-shadow: 0 0 15px var(--orb-color);
}
.orb-ring-1 { animation: orb-ring-rotate 4s linear infinite; }
.orb-ring-2 { width: 75px; height: 75px; animation: orb-ring-rotate 3s linear infinite reverse; }
.orb-core {
  position: relative;
  width: 44px; height: 44px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff 0%, var(--orb-color) 50%, rgba(0,0,0,0.3) 100%);
  box-shadow: 0 0 25px var(--orb-color), inset 0 0 20px rgba(255,255,255,0.4), inset -5px -5px 15px rgba(0,0,0,0.2);
  animation: orb-pulse 0.9s ease-in-out infinite;
}
.orb-vortex-inner {
  position: absolute; width: 60px; height: 60px; border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, var(--orb-color), transparent, var(--orb-color), transparent);
  opacity: 0.25; animation: orb-vortex-spin 2s linear infinite;
}
.orb-particles { position: absolute; inset: 0; pointer-events: none; }
.orb-particle {
  position: absolute; left: 50%; top: 50%;
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--orb-color); box-shadow: 0 0 8px var(--orb-color);
  animation: orb-particle-orbit 2.5s linear var(--odelay,0s) infinite;
  transform: translate(-50%,-50%) rotate(0deg) translateX(42px) rotate(0deg);
  opacity: 0.9;
}
.orb-sparks { position: absolute; inset: 0; pointer-events: none; }
.orb-spark {
  position: absolute; left: 50%; top: 50%;
  width: 3px; height: 3px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 6px var(--orb-color);
  animation: orb-spark-burst 0.8s ease-out var(--spark-delay,0s) infinite;
  transform: translate(-50%,-50%) translate(0,0); opacity: 0;
}

@keyframes orb-intensity { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.05); } }
@keyframes orb-ring-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes orb-vortex-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes orb-particle-orbit {
  from { transform: translate(-50%,-50%) rotate(0deg) translateX(42px) rotate(0deg); }
  to { transform: translate(-50%,-50%) rotate(360deg) translateX(42px) rotate(-360deg); }
}
@keyframes orb-spark-burst {
  0% { opacity: 0; transform: translate(-50%,-50%) translate(0,0) scale(0.5); }
  40% { opacity: 1; transform: translate(-50%,-50%) translate(var(--spark-x),var(--spark-y)) scale(1); }
  100% { opacity: 0; transform: translate(-50%,-50%) translate(var(--spark-x),var(--spark-y)) scale(1.2); }
}
@keyframes orb-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 25px var(--orb-color), inset 0 0 20px rgba(255,255,255,0.4); }
  50% { transform: scale(1.08); box-shadow: 0 0 35px var(--orb-color), inset 0 0 25px rgba(255,255,255,0.5); }
}
.rarity-orb.orb-shake { animation: orb-shake 0.12s ease-in-out infinite; }
.rarity-orb.orb-shake .orb-core { animation: orb-pulse 0.9s ease-in-out infinite, orb-shake 0.12s ease-in-out infinite; }
@keyframes orb-shake { 0%, 100% { transform: translateX(0) scale(1); } 25% { transform: translateX(-5px) scale(1.06); } 75% { transform: translateX(5px) scale(1.06); } }

/* ── Explosion ────────────────────────────────────────────────────────────── */
.explosion-flash {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(circle at center, rgba(255,255,255,0.9) 0%, var(--explosion-color, rgba(255,255,255,0.4)) 30%, transparent 60%);
  animation: explosion-flash 0.4s ease-out forwards;
  z-index: 2;
}
.explosion-flash.rarity-common { --explosion-color: rgba(120,113,108,0.5); }
.explosion-flash.rarity-uncommon { --explosion-color: rgba(34,197,94,0.5); }
.explosion-flash.rarity-rare { --explosion-color: rgba(59,130,246,0.5); }
.explosion-flash.rarity-epic { --explosion-color: rgba(168,85,247,0.5); }
.explosion-flash.rarity-legendary { --explosion-color: rgba(234,179,8,0.6); }
.explosion-flash.rarity-mythic { --explosion-color: rgba(220,38,38,0.6); }
@keyframes explosion-flash {
  0% { opacity: 0; transform: scale(0.5); }
  30% { opacity: 1; transform: scale(1.2); }
  100% { opacity: 0; transform: scale(1.5); }
}

/* ── Reveal card ──────────────────────────────────────────────────────────── */
.reveal-wrap {
  position: relative; z-index: 1;
  display: flex; align-items: center; justify-content: center;
}

.reveal-card {
  position: relative; z-index: 2;
  background: rgba(15,23,42,0.98);
  border-radius: 1rem;
  padding: 2rem;
  min-width: 280px;
  text-align: center;
  border: 2px solid;
  animation: reveal-in 0.6s ease-out;
}
.reveal-card.rarity-common { border-color: #78716c; }
.reveal-card.rarity-uncommon { border-color: #22c55e; }
.reveal-card.rarity-rare { border-color: #3b82f6; }
.reveal-card.rarity-epic { border-color: #a855f7; }
.reveal-card.rarity-legendary { border-color: #eab308; }
.reveal-card.rarity-mythic { border-color: #dc2626; }

@keyframes reveal-in { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

.unit-reveal .reveal-card.unit-reveal-card {
  animation: unit-reveal-slide-up 0.65s cubic-bezier(0.34,1.56,0.64,1) forwards;
  box-shadow: 0 0 50px var(--reveal-glow, rgba(255,255,255,0.2)), 0 20px 40px rgba(0,0,0,0.4);
  border-width: 2px;
  overflow: hidden;
}

.unit-reveal-card.reveal-card-premium {
  box-shadow: 0 0 60px var(--reveal-glow), 0 0 100px rgba(255,255,255,0.1), 0 25px 50px rgba(0,0,0,0.5);
  animation: unit-reveal-slide-up 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards;
}

@keyframes unit-reveal-slide-up {
  0% { transform: translateY(40px) scale(0.9); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

.reveal-wrap.rarity-common .reveal-card { --reveal-glow: rgba(120,113,108,0.3); }
.reveal-wrap.rarity-uncommon .reveal-card { --reveal-glow: rgba(34,197,94,0.4); }
.reveal-wrap.rarity-rare .reveal-card { --reveal-glow: rgba(59,130,246,0.4); }
.reveal-wrap.rarity-epic .reveal-card { --reveal-glow: rgba(168,85,247,0.4); }
.reveal-wrap.rarity-legendary .reveal-card { --reveal-glow: rgba(234,179,8,0.5); }
.reveal-wrap.rarity-mythic .reveal-card { --reveal-glow: rgba(220,38,38,0.5); }

.unit-reveal-portrait {
  position: relative;
  width: 110px; height: 110px;
  margin: 0 auto 0.75rem;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid currentColor;
  box-shadow: 0 0 20px var(--reveal-glow);
}

.unit-reveal-portrait-bg {
  position: absolute; inset: -10px;
  background: radial-gradient(circle, var(--reveal-glow) 0%, transparent 70%);
  opacity: 0.3; pointer-events: none;
}

.unit-reveal-portrait-img {
  position: relative; width: 100%; height: 100%; object-fit: cover;
}

.reveal-portrait-wrap {
  width: 100px; height: 100px;
  margin: 0 auto 0.75rem;
  border-radius: 50%; overflow: hidden;
  border: 3px solid currentColor;
  background: rgba(0,0,0,0.4);
}
.reveal-portrait-wrap.reveal-portrait-clickable { cursor: pointer; }
.reveal-portrait { width: 100%; height: 100%; object-fit: cover; }

.unit-reveal-name { margin-bottom: 0.5rem; font-size: 1.3rem; }
.unit-reveal-meta { margin: 0.25rem 0; }

.reveal-stars {
  display: flex; justify-content: center;
  gap: 4px; margin: 0.5rem 0; font-size: 1.1rem;
}
.star { opacity: 0.25; filter: grayscale(0.8); transition: opacity 0.2s, filter 0.2s; }
.star.star-filled { opacity: 1; filter: none; }
.star.star-glow { animation: star-glow-in 0.45s ease-out var(--star-delay,0s) forwards; opacity: 0; }
.star.star-last.star-glow { animation: star-burst-last 0.55s ease-out var(--star-delay,0s) forwards; opacity: 0; }

@keyframes star-glow-in {
  0% { opacity: 0; transform: scale(0.4); filter: brightness(0.3); }
  50% { opacity: 1; transform: scale(1.2); filter: brightness(1.5); }
  100% { opacity: 1; transform: scale(1); filter: brightness(1); }
}
@keyframes star-burst-last {
  0% { opacity: 0; transform: scale(0.3); filter: brightness(0.2); }
  40% { opacity: 1; transform: scale(1.35); filter: brightness(1.8); }
  100% { opacity: 1; transform: scale(1); filter: brightness(1); }
}

.rarity-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.85rem;
  text-transform: capitalize;
  margin-bottom: 0.75rem;
}
.rarity-badge.rarity-common { background: #78716c; color: #fff; }
.rarity-badge.rarity-uncommon { background: #22c55e; color: #fff; }
.rarity-badge.rarity-rare { background: #3b82f6; color: #fff; }
.rarity-badge.rarity-epic { background: #a855f7; color: #fff; }
.rarity-badge.rarity-legendary { background: #eab308; color: #1f2937; }
.rarity-badge.rarity-mythic { background: #dc2626; color: #fff; }

.reveal-role, .reveal-element { font-size: 0.9rem; color: #94a3b8; margin: 0.25rem 0; }
.guild-result-balance { font-size: 0.88rem; color: #cbd5e1; margin: 0.5rem 0 0; }
.mythic-title { display: block; font-size: 0.9rem; letter-spacing: 0.2em; color: #f87171; margin-bottom: 0.25rem; animation: mythic-title-spacing 0.8s ease-out forwards; }
@keyframes mythic-title-spacing { from { letter-spacing: -0.1em; opacity: 0; } to { letter-spacing: 0.35em; opacity: 1; } }

/* ── Rareté effects ───────────────────────────────────────────────────────── */
.element-effect {
  position: absolute; inset: -50px;
  pointer-events: none; z-index: 0; opacity: 0.5;
}
.element-effect.element-feu {
  background: radial-gradient(circle at 30% 40%, rgba(255,120,50,0.4) 0%, transparent 40%), radial-gradient(circle at 70% 60%, rgba(220,60,20,0.3) 0%, transparent 45%), radial-gradient(circle at center, rgba(180,50,0,0.2) 0%, transparent 60%);
  animation: element-flicker 1.2s ease-in-out infinite;
}
.element-effect.element-eau {
  background: radial-gradient(ellipse 80% 50% at 50% 50%, rgba(59,130,246,0.3) 0%, transparent 50%), radial-gradient(circle at center, rgba(30,64,175,0.2) 0%, transparent 60%);
  animation: element-wave 2.5s ease-in-out infinite;
}
.element-effect.element-plante {
  background: radial-gradient(circle at 20% 80%, rgba(34,197,94,0.25) 0%, transparent 40%), radial-gradient(circle at 80% 20%, rgba(22,163,74,0.2) 0%, transparent 45%), radial-gradient(circle at center, rgba(22,101,52,0.15) 0%, transparent 65%);
  animation: element-float 3.5s ease-in-out infinite;
}
.element-effect.element-lumiere {
  background: radial-gradient(circle at center, rgba(250,204,21,0.35) 0%, rgba(234,179,8,0.15) 50%, transparent 70%);
  animation: element-pulse 2s ease-in-out infinite;
}
.element-effect.element-tenebres {
  background: radial-gradient(circle at center, rgba(88,28,135,0.4) 0%, rgba(30,27,75,0.2) 50%, transparent 70%);
  animation: element-vortex 3s linear infinite;
}
@keyframes element-flicker { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.6; } }
@keyframes element-wave { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.05); opacity: 0.6; } }
@keyframes element-float { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.55; } }
@keyframes element-pulse { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.2); } }
@keyframes element-vortex { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.epic-lightning {
  position: absolute; inset: -80px; pointer-events: none; z-index: 1;
  background: linear-gradient(135deg, transparent 40%, rgba(168,85,247,0.15) 50%, transparent 60%);
  animation: lightning-flash 0.8s ease-in-out 0.2s; opacity: 0;
}
@keyframes lightning-flash { 0%, 100% { opacity: 0; } 15%, 85% { opacity: 0.8; } 50% { opacity: 0.4; } }

.legendary-halo {
  position: absolute; width: 320px; height: 320px; border-radius: 50%;
  background: radial-gradient(circle, rgba(234,179,8,0.25) 0%, rgba(251,146,60,0.15) 40%, transparent 70%);
  animation: legendary-halo-rotate 4s linear infinite; pointer-events: none;
}
.legendary-particles { position: absolute; width: 200px; height: 200px; pointer-events: none; }
.legendary-particle {
  position: absolute; left: 50%; top: 50%;
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(234,179,8,0.9); box-shadow: 0 0 8px rgba(234,179,8,0.8);
  animation: legendary-particle-out 0.8s ease-out var(--particle-delay,0s) forwards;
  transform: translate(-50%,-50%) translate(0,0); opacity: 0;
}
@keyframes legendary-halo-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes legendary-particle-out {
  from { opacity: 0; transform: translate(-50%,-50%) translate(0,0); }
  to { opacity: 0.8; transform: translate(-50%,-50%) translate(var(--particle-x),var(--particle-y)); }
}

.mythic-bg {
  position: absolute; inset: -100px;
  background: linear-gradient(135deg, rgba(220,38,38,0.4) 0%, rgba(168,85,247,0.4) 50%, rgba(220,38,38,0.3) 100%);
  background-size: 200% 200%;
  animation: mythic-bg-shift 3s ease-in-out infinite; pointer-events: none;
}
.mythic-halo {
  position: absolute; width: 340px; height: 340px; border-radius: 50%;
  border: 3px solid rgba(220,38,38,0.6);
  box-shadow: 0 0 40px rgba(220,38,38,0.4), inset 0 0 30px rgba(255,255,255,0.1);
  animation: mythic-glow-pulse 1.2s ease-in-out infinite; pointer-events: none;
}
.mythic-halo::before {
  content: ''; position: absolute; inset: -8px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.5);
  animation: mythic-glow-pulse 1.2s ease-in-out infinite 0.3s;
}
.mythic-crack {
  position: absolute; inset: -100px; pointer-events: none; z-index: 0;
  background: repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(220,38,38,0.08) 20px, rgba(220,38,38,0.08) 21px);
  animation: crack-pulse 1.5s ease-in-out infinite;
}
@keyframes mythic-bg-shift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
@keyframes mythic-glow-pulse { 0%, 100% { opacity: 0.8; transform: scale(1); } 50% { opacity: 1; transform: scale(1.02); } }
@keyframes crack-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
@keyframes reveal-shake-legendary { 0%, 100% { transform: scale(1) translateX(0); } 25% { transform: scale(1) translateX(-3px); } 75% { transform: scale(1) translateX(3px); } }
@keyframes reveal-shake-mythic { 0%, 100% { transform: scale(1) translateX(0); } 25% { transform: scale(1.05) translateX(-6px); } 75% { transform: scale(1.05) translateX(6px); } }

.reveal-wrap.rarity-legendary .reveal-card { animation: reveal-in 0.6s ease-out, reveal-shake-legendary 0.3s ease-out 0.5s; }
.reveal-wrap.rarity-mythic .reveal-card { animation: reveal-in 0.6s ease-out, reveal-shake-mythic 0.3s ease-out 0.5s; }

/* ── Bouton close ─────────────────────────────────────────────────────────── */
.btn-close {
  margin-top: 1rem;
  padding: 0.5rem 1.25rem;
  border-radius: 0.5rem;
  border: 1px solid #64748b;
  background: rgba(100,116,139,0.3);
  color: #e5e7eb; cursor: pointer;
}
.btn-close:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Fullscreen image ─────────────────────────────────────────────────────── */
.image-fullscreen-overlay {
  position: fixed; inset: 0; z-index: 1100;
  background: rgba(0,0,0,0.85);
  display: flex; align-items: center; justify-content: center;
  padding: 2rem;
}
.image-fullscreen-close {
  position: absolute; top: 1rem; right: 1rem;
  width: 44px; height: 44px;
  border: none; border-radius: 50%;
  background: rgba(255,255,255,0.15); color: #fff;
  font-size: 1.5rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.image-fullscreen-close:hover { background: rgba(255,255,255,0.25); }
.image-fullscreen-content { max-height: 90vh; width: 100%; max-width: 90vw; display: flex; align-items: center; justify-content: center; }
.image-fullscreen-img { max-height: 90vh; width: auto; max-width: 100%; object-fit: contain; border-radius: 8px; }

/* ── Transitions ──────────────────────────────────────────────────────────── */
.overlay-enter-active, .overlay-leave-active { transition: opacity 0.25s ease; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
.image-fullscreen-enter-active, .image-fullscreen-leave-active { transition: opacity 0.2s ease; }
.image-fullscreen-enter-from, .image-fullscreen-leave-to { opacity: 0; }

/* ── Responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 720px) {
  .guild-rotation-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .guild-portal-header { flex-direction: column; align-items: flex-start; }
  .guild-portal-header-right {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .guild-portal-meta {
    justify-content: center;
    flex-wrap: wrap;
  }
}

@media (max-width: 520px) {
  .guild-rotation-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
