<template>
  <section class="sanctuaire-container">
    <h1 class="sanctuaire-title nx-title">Sanctuaire d'Invocation</h1>

    <div class="currency-bar">
      <div>🔷 Cores : <strong>{{ wallet.cores }}</strong></div>
      <div>💰 Crédits : <strong>{{ wallet.credits }}</strong></div>
      <div>🧩 Fragments : <strong>{{ wallet.fragments }}</strong></div>
      <div>✨ Essence : <strong>{{ wallet.ascension_essence }}</strong></div>
    </div>

    <div class="portails-grid">
      <div class="portail-card nx-card noyau">
        <div class="portail-overlay">
          <h2 class="nx-title">Portail Noyau</h2>
          <p class="cost nx-subtitle">10 cores / invocation</p>
          <p class="pool">Commun 50% · Peu commun 40% · Rare 10%</p>
          <div class="invoke-actions">
            <button
              class="invoke-btn nx-btn"
              :disabled="loading || !canInvoke('core', 1)"
              @click="invoke('core', 1)"
            >
              {{ getInvokeButtonLabel('core', 1) }}
            </button>
            <button
              class="invoke-btn invoke-btn-multi nx-btn"
              :disabled="loading || !canInvoke('core', 10)"
              @click="invoke('core', 10)"
            >
              {{ getInvokeButtonLabel('core', 10) }}
            </button>
          </div>
        </div>
      </div>

      <div class="portail-card nx-card standard">
        <div class="portail-overlay">
          <h2 class="nx-title">Portail Standard</h2>
          <p class="cost nx-subtitle">100 crédits / invocation</p>
          <p class="pool">Commun 49,9% · Peu commun 30% · Rare 15% · Épique 4% · Légendaire 1% · Mythique 0,1%</p>
          <div class="invoke-actions">
            <div
              class="invoke-btn-wrap"
              :class="standardPityAboutToTrigger(1) ? `pity-trigger pity-${standardPityAboutToTrigger(1)}` : ''"
            >
              <span v-if="standardPityAboutToTrigger(1)" class="pity-badge" :class="`pity-badge-${standardPityAboutToTrigger(1)}`">
                {{ pityTriggerLabel(standardPityAboutToTrigger(1)!) }}
              </span>
              <button
                class="invoke-btn nx-btn"
                :class="standardPityAboutToTrigger(1) ? `invoke-btn-pity pity-${standardPityAboutToTrigger(1)}` : ''"
                :disabled="loading || !canInvoke('standard', 1)"
                @click="invoke('standard', 1)"
              >
                {{ getInvokeButtonLabel('standard', 1) }}
              </button>
            </div>
            <div
              class="invoke-btn-wrap"
              :class="standardPityAboutToTrigger(10) ? `pity-trigger pity-${standardPityAboutToTrigger(10)}` : ''"
            >
              <span v-if="standardPityAboutToTrigger(10)" class="pity-badge" :class="`pity-badge-${standardPityAboutToTrigger(10)}`">
                {{ pityTriggerLabel(standardPityAboutToTrigger(10)!) }}
              </span>
              <button
                class="invoke-btn invoke-btn-multi nx-btn"
                :class="standardPityAboutToTrigger(10) ? `invoke-btn-pity pity-${standardPityAboutToTrigger(10)}` : ''"
                :disabled="loading || !canInvoke('standard', 10)"
                @click="invoke('standard', 10)"
              >
                {{ getInvokeButtonLabel('standard', 10) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="portail-card nx-card resonance">
        <div class="portail-overlay">
          <h2 class="nx-title">Portail Résonance</h2>
          <p class="cost nx-subtitle">100 fragments / invocation</p>
          <p class="pool">Rare 90% · Épique 10%</p>
          <div class="invoke-actions">
            <button
              class="invoke-btn nx-btn"
              :disabled="loading || !canInvoke('resonance', 1)"
              @click="invoke('resonance', 1)"
            >
              {{ getInvokeButtonLabel('resonance', 1) }}
            </button>
            <button
              class="invoke-btn invoke-btn-multi nx-btn"
              :disabled="loading || !canInvoke('resonance', 10)"
              @click="invoke('resonance', 10)"
            >
              {{ getInvokeButtonLabel('resonance', 10) }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="pity-section">
      <h3>Portail Standard</h3>
      <div class="pity-grid">
        <div>⭐ Épique garanti : {{ pity.pity_epic }} / 25</div>
        <div>🌟 Légendaire garanti : {{ pity.pity_legendary }} / 100</div>
        <div>🔥 Mythic garanti : {{ pity.pity_mythic }} / 1000</div>
      </div>
    </div>

    <div v-if="pullError" class="error-msg">{{ pullError }}</div>

    <!-- Overlay animation gacha (camera + shake sur le wrapper) -->
    <Transition name="overlay">
      <div
        v-if="showOverlay"
        class="gacha-overlay invoke-camera-wrap"
        :class="[overlayClass, cameraClass, screenShakeClass]"
        @click.self="canClose && phase === 'reveal' && closeOverlay()"
      >
        <div class="overlay-backdrop" />

        <!-- 1–2) Portail actif + vortex -->
        <div
          v-if="phase !== 'reveal'"
          class="portal-center portal-active"
          :class="[portalRarityClass, phase, { 'portal-vortex': phase !== 'portal' }]"
        >
          <div class="portal-hex" />
          <div v-if="phase !== 'portal'" class="vortex-particles">
            <span v-for="n in 12" :key="n" class="vortex-particle" :style="vortexParticleStyle(n)" />
          </div>
          <!-- 3–4) Orb premium multi-couches + suspense / fake-out -->
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

        <!-- 5) Explosion magique -->
        <div v-if="showExplosion" class="explosion-flash" :class="rarityClass" />

        <!-- 6) Révélation carte unité + étoiles + effet élément -->
        <div
          v-if="phase === 'reveal' && !isMultiPull"
          class="reveal-wrap unit-reveal"
          :class="[rarityClass, elementEffectClass]"
        >
          <!-- Effet élément (feu, eau, plante, lumière, ombre) -->
          <div v-if="elementSlug && elementSlug !== 'neutral'" class="element-effect" :class="`element-${elementSlug}`" />
          <!-- Epic : éclairs violets -->
          <div v-if="resultRarity === 'epic'" class="epic-lightning" />
          <!-- Legendary : pluie d'étoiles -->
          <div v-if="resultRarity === 'legendary'" class="legendary-halo" />
          <div v-if="resultRarity === 'legendary'" class="legendary-particles">
            <span v-for="n in 10" :key="n" class="legendary-particle" :style="particleStyle(n)" />
          </div>
          <!-- Mythic : fissure dimensionnelle + vortex -->
          <div v-if="resultRarity === 'mythic'" class="mythic-bg" />
          <div v-if="resultRarity === 'mythic'" class="mythic-halo" />
          <div v-if="resultRarity === 'mythic'" class="mythic-crack" />
          <div class="reveal-card unit-reveal-card nx-card" :class="[rarityClass, revealCardRarityClass]">
            <div
              v-if="pullResult?.unit"
              class="reveal-portrait-wrap unit-reveal-portrait"
              :class="{ 'reveal-portrait-clickable': !!revealPortraitUrl }"
              role="button"
              tabindex="0"
              title="Agrandir l'image"
              @click="openFullscreenImage(revealPortraitUrl, pullResult?.unit?.name)"
              @keydown.enter="openFullscreenImage(revealPortraitUrl, pullResult?.unit?.name)"
            >
              <div class="unit-reveal-portrait-bg" />
              <img
                v-if="revealPortraitUrl"
                :src="revealPortraitUrl"
                alt=""
                class="reveal-portrait unit-reveal-portrait-img"
              />
            </div>
            <h3 v-if="resultRarity === 'mythic'" class="mythic-title nx-title">MYTHIC</h3>
            <h3 class="nx-title unit-reveal-name">{{ pullResult?.unit?.name }}</h3>
            <!-- Étoiles : pop + glow + burst (dernière plus forte) -->
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
            <span class="rarity-badge unit-reveal-rarity nx-badge" :class="rarityClass">{{ pullResult?.rarity }}</span>
            <div class="unit-reveal-meta">
              <p v-if="pullResult?.unit?.role" class="reveal-role">{{ toRoleFr(pullResult.unit.role) }}</p>
              <p v-if="pullResult?.unit?.element" class="reveal-element">{{ toElementFr(pullResult.unit.element) }}</p>
            </div>
            <p v-if="pullPrimaryMessage" :class="pullResult?.isNewUnit ? 'new-unit' : 'dupe'">{{ pullPrimaryMessage }}</p>
            <p v-if="pullSecondaryMessage" class="dupe">{{ pullSecondaryMessage }}</p>
            <button class="btn-close nx-btn" :disabled="!canClose" @click="canClose && closeOverlay()">Fermer</button>
          </div>
        </div>

        <div
          v-else-if="phase === 'reveal' && isMultiPull"
          class="reveal-wrap multi-reveal-wrap"
          :class="[rarityClass, elementEffectClass]"
        >
          <div v-if="elementSlug && elementSlug !== 'neutral'" class="element-effect" :class="`element-${elementSlug}`" />
          <div v-if="resultRarity === 'epic'" class="epic-lightning" />
          <div v-if="resultRarity === 'legendary'" class="legendary-halo" />
          <div v-if="resultRarity === 'legendary'" class="legendary-particles">
            <span v-for="n in 10" :key="n" class="legendary-particle" :style="particleStyle(n)" />
          </div>
          <div v-if="resultRarity === 'mythic'" class="mythic-bg" />
          <div v-if="resultRarity === 'mythic'" class="mythic-halo" />
          <div v-if="resultRarity === 'mythic'" class="mythic-crack" />
          <div class="multi-reveal-panel nx-card" :class="[rarityClass, revealCardRarityClass]">
            <div class="multi-reveal-header">
              <span class="multi-reveal-kicker">Invocation x10</span>
              <h3 class="nx-title multi-reveal-title">Résultats</h3>
            </div>
            <div class="multi-reveal-grid">
              <article v-for="(result, index) in pullResults" :key="`${result.unit?.name || 'unit'}-${index}`" class="multi-reveal-card nx-card">
                <div
                  class="multi-reveal-portrait"
                  :class="{ 'reveal-portrait-clickable': !!getPullImageUrl(result) }"
                  role="button"
                  tabindex="0"
                  title="Agrandir l'image"
                  @click="openFullscreenImage(getPullImageUrl(result), result.unit?.name)"
                  @keydown.enter="openFullscreenImage(getPullImageUrl(result), result.unit?.name)"
                >
                  <img v-if="getPullImageUrl(result)" :src="getPullImageUrl(result)" alt="" class="multi-reveal-portrait-img" />
                </div>
                <strong class="multi-reveal-name">{{ result.unit?.name || 'Unité inconnue' }}</strong>
                <div class="multi-reveal-stars">
                  <span v-for="i in 6" :key="i" class="star" :class="{ 'star-filled': i <= getPullStarCount(result) }">⭐</span>
                </div>
                <span class="rarity-badge nx-badge" :class="`rarity-${String(result.rarity || 'common').toLowerCase()}`">{{ result.rarity }}</span>
                <span class="multi-reveal-status" :class="{ 'is-new': result.isNewUnit }">{{ result.isNewUnit ? 'Nouveau' : 'Doublon' }}</span>
              </article>
            </div>
            <button class="btn-close nx-btn" :disabled="!canClose" @click="canClose && closeOverlay()">Fermer</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Popup image en grand (au-dessus de la révélation) -->
    <Teleport to="body">
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
          >
            ✕
          </button>
          <div class="image-fullscreen-content">
            <img :src="fullscreenImageUrl" :alt="fullscreenImageName || 'Unité'" class="image-fullscreen-img" />
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import api from '../api';
import {
  runInvokeAnimation,
  rarityColors,
  getStarsForRarity,
  getFakeOutRarity,
  getElementSlug,
  getScreenShakeCssClass
} from '../utils/invokeAnimation';
import { getUnitImageUrl } from '../utils/unitImage';
import { toRoleFr, toElementFr } from '../utils/i18nFr';

const wallet = ref({
  credits: 0,
  cores: 0,
  fragments: 0,
  ascension_essence: 0
});
type PullType = 'standard' | 'core' | 'resonance';
type PullResultData = {
  unit?: { name?: string; role?: string; element?: string; image_url?: string | null };
  rarity?: string;
  isNewUnit?: boolean;
  creditsGained?: number;
  fragmentsGained?: number;
  duplicateRewards?: { credits?: number; fragments?: number };
  power?: {
    level?: number;
    previousLevel?: number;
    openings?: number;
    bonusPercent?: number;
    leveledUp?: boolean;
    isMax?: boolean;
    nextLevel?: number | null;
    progressInCurrentTier?: number;
    requiredInCurrentTier?: number;
    nextThreshold?: number | null;
  };
  wallet?: typeof wallet.value;
  pity?: typeof pity.value;
};
const pity = ref({
  total_pulls: 0,
  pity_epic: 0,
  pity_legendary: 0,
  pity_mythic: 0
});
const loading = ref(false);
const pullError = ref('');
const showOverlay = ref(false);
const phase = ref<'portal' | 'vortex' | 'orb' | 'shake' | 'explosion' | 'reveal'>('portal');
const canClose = ref(false);
const resultRarity = ref('');
const showOrb = ref(false);
const orbRarity = ref('');
const showExplosion = ref(false);
const cameraClass = ref('');
const screenShakeClass = ref('');
const pullResult = ref<PullResultData | null>(null);
const pullResults = ref<PullResultData[]>([]);

const rarityClass = computed(() => {
  const r = (pullResult.value?.rarity ?? resultRarity.value ?? 'common').toLowerCase();
  return `rarity-${r}`;
});

/** Pour le portail : même que rarityClass (couleur globale overlay). */
const portalRarityClass = computed(() => rarityClass.value);

const orbRarityClass = computed(() => {
  const r = (orbRarity.value || 'common').toLowerCase();
  return `rarity-${r}`;
});

const orbStyle = computed(() => {
  const r = (orbRarity.value || 'common').toLowerCase();
  const color = rarityColors[r] ?? rarityColors.common;
  return { '--orb-color': color };
});

const overlayClass = computed(() => {
  const r = (resultRarity.value || 'common').toLowerCase();
  return `rarity-${r}`;
});

const revealPortraitUrl = computed(() => getUnitImageUrl(pullResult.value?.unit ?? null));
const isMultiPull = computed(() => pullResults.value.length > 1);

/** Pity Standard : Épique 25, Légendaire 100, Mythic 1000.
 * x1 : indicateur si compteur >= seuil - 1 (prochain pull = garanti).
 * x10 : indicateur si compteur >= seuil - 10 (un des 10 pulls peut déclencher). */
const PITY_EPIC_AT = 25;
const PITY_LEGENDARY_AT = 100;
const PITY_MYTHIC_AT = 1000;
function standardPityAboutToTrigger(count: number): 'epic' | 'legendary' | 'mythic' | null {
  const margin = count === 10 ? 10 : 1;
  const pe = pity.value.pity_epic ?? 0;
  const pl = pity.value.pity_legendary ?? 0;
  const pm = pity.value.pity_mythic ?? 0;
  if (pm >= PITY_MYTHIC_AT - margin) return 'mythic';
  if (pl >= PITY_LEGENDARY_AT - margin) return 'legendary';
  if (pe >= PITY_EPIC_AT - margin) return 'epic';
  return null;
}
function pityTriggerLabel(rarity: 'epic' | 'legendary' | 'mythic'): string {
  if (rarity === 'mythic') return '🔥 Mythique garanti !';
  if (rarity === 'legendary') return '🌟 Légendaire garanti !';
  return '⭐ Épique garanti !';
}

const showImageFullscreen = ref(false);
const fullscreenImageUrl = ref('');
const fullscreenImageName = ref('');

const starCount = computed(() => getStarsForRarity(resultRarity.value));

const elementSlug = computed(() => getElementSlug(pullResult.value?.unit?.element));

const elementEffectClass = computed(() =>
  elementSlug.value && elementSlug.value !== 'neutral' ? `element-effect-${elementSlug.value}` : ''
);

/** Nombre de particules orb selon rareté (common = peu, mythic = beaucoup). */
const orbParticleCount = computed(() => {
  const r = (orbRarity.value || 'common').toLowerCase();
  const map: Record<string, number> = { common: 6, uncommon: 8, rare: 10, epic: 12, legendary: 14, mythic: 16 };
  return map[r] ?? 8;
});

const revealCardRarityClass = computed(() => {
  const r = (resultRarity.value || 'common').toLowerCase();
  if (r === 'legendary' || r === 'mythic') return `reveal-card-premium rarity-${r}`;
  return '';
});

const pullPrimaryMessage = computed(() => {
  const result = pullResult.value;
  if (!result) return '';
  const powerLevel = Number(result.power?.level ?? 1);
  const powerBonus = Number(result.power?.bonusPercent ?? Math.max(0, (powerLevel - 1) * 5));
  if (result.isNewUnit) {
    return `Nouvelle unité ! Puissance ${powerLevel} débloquée.`;
  }
  if (result.power?.leveledUp) {
    return `Puissance ${powerLevel} débloquée ! Bonus permanent : +${powerBonus}% à toutes les stats.`;
  }
  const credits = Number(result.duplicateRewards?.credits ?? result.creditsGained ?? 0);
  const fragments = Number(result.duplicateRewards?.fragments ?? result.fragmentsGained ?? 0);
  if (credits > 0 || fragments > 0) {
    const parts: string[] = [];
    if (credits > 0) parts.push(`${credits} crédits`);
    if (fragments > 0) parts.push(`${fragments} fragments`);
    return `Puissance max atteinte. Vous obtenez ${parts.join(' et ')}.`;
  }
  return `Doublon absorbé. L'unité progresse vers la Puissance ${result.power?.nextLevel ?? powerLevel}.`;
});

const pullSecondaryMessage = computed(() => {
  const result = pullResult.value;
  if (!result?.power) return '';
  if (result.isNewUnit || result.power.leveledUp || result.power.isMax) return '';
  const current = Number(result.power.progressInCurrentTier ?? 0);
  const required = Number(result.power.requiredInCurrentTier ?? 0);
  const nextLevel = Number(result.power.nextLevel ?? result.power.level ?? 1);
  if (!required) return '';
  return `Progression actuelle : ${current} / ${required} vers Puissance ${nextLevel}.`;
});

function starStyle(index: number) {
  const delay = (index - 1) * 0.14;
  const isLast = index === starCount.value && starCount.value > 0;
  return {
    '--star-delay': `${delay}s`,
    '--star-burst': isLast ? '1' : '0'
  };
}

function orbSparkStyle(n: number) {
  const angle = (n / 6) * 360;
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * 55;
  const y = Math.sin(rad) * 55;
  return {
    '--spark-x': `${x}px`,
    '--spark-y': `${y}px`,
    '--spark-delay': `${(n - 1) * 0.06}s`
  };
}

function particleStyle(n: number) {
  const angleDeg = ((n - 1) / 10) * 360;
  const angleRad = (angleDeg * Math.PI) / 180;
  const x = Math.round(Math.cos(angleRad) * 70);
  const y = Math.round(Math.sin(angleRad) * 70);
  return {
    '--particle-x': `${x}px`,
    '--particle-y': `${y}px`,
    '--particle-delay': `${(n - 1) * 0.03}s`
  };
}

function vortexParticleStyle(n: number) {
  const angleDeg = ((n - 1) / 12) * 360;
  const angleRad = (angleDeg * Math.PI) / 180;
  const dist = 80 + (n % 3) * 15;
  const x = Math.round(Math.cos(angleRad) * dist);
  const y = Math.round(Math.sin(angleRad) * dist);
  return {
    '--vx': `${x}px`,
    '--vy': `${y}px`,
    '--vdelay': `${(n - 1) * 0.05}s`
  };
}

function orbParticleStyle(n: number) {
  const angleDeg = (n / 8) * 360;
  const angleRad = (angleDeg * Math.PI) / 180;
  const x = Math.round(Math.cos(angleRad) * 45);
  const y = Math.round(Math.sin(angleRad) * 45);
  return {
    '--ox': `${x}px`,
    '--oy': `${y}px`,
    '--odelay': `${(n - 1) * 0.04}s`
  };
}

async function loadWallet() {
  try {
    const { data } = await api.get('/wallet');
    wallet.value = {
      credits: data.credits ?? 0,
      cores: data.cores ?? 0,
      fragments: data.fragments ?? 0,
      ascension_essence: data.ascension_essence ?? 0
    };
  } catch {
    wallet.value = { credits: 0, cores: 0, fragments: 0, ascension_essence: 0 };
  }
}

async function loadPity() {
  try {
    const { data } = await api.get('/gacha/pity', { params: { bannerKey: 'standard' } });
    pity.value = {
      total_pulls: data.total_pulls ?? 0,
      pity_epic: data.pity_epic ?? 0,
      pity_legendary: data.pity_legendary ?? 0,
      pity_mythic: data.pity_mythic ?? 0
    };
  } catch {
    pity.value = { total_pulls: 0, pity_epic: 0, pity_legendary: 0, pity_mythic: 0 };
  }
}

function getPullCost(type: PullType, count = 1) {
  if (type === 'core') return { resource: 'cores', label: 'cores', required: 10 * count };
  if (type === 'resonance') return { resource: 'fragments', label: 'fragments', required: 100 * count };
  return { resource: 'credits', label: 'credits', required: 100 * count };
}

function getWalletAmount(type: PullType) {
  if (type === 'core') return Number(wallet.value.cores ?? 0);
  if (type === 'resonance') return Number(wallet.value.fragments ?? 0);
  return Number(wallet.value.credits ?? 0);
}

function canInvoke(type: PullType, count = 1) {
  const { required } = getPullCost(type, count);
  return getWalletAmount(type) >= required;
}

function getInvokeButtonLabel(type: PullType, count = 1) {
  if (canInvoke(type, count)) return `Invoquer x${count}`;
  const { label, required } = getPullCost(type, count);
  return `Pas assez de ${label} (${required} requis).`;
}

function errorMessage(err: string, required?: number): string {
  if (err === 'INSUFFICIENT_CREDITS') return `Pas assez de credits (${required ?? 100} requis).`;
  if (err === 'INSUFFICIENT_CORES') return `Pas assez de cores (${required ?? 10} requis).`;
  if (err === 'INSUFFICIENT_FRAGMENTS') return `Pas assez de fragments (${required ?? 100} requis).`;
  if (err === 'NO_UNIT_FOR_RARITY') return 'Aucune unité pour cette rareté (pool incomplet).';
  return err || 'Erreur';
}

function emitWalletUpdated(nextWallet?: typeof wallet.value | null) {
  if (!nextWallet) return;
  window.dispatchEvent(new CustomEvent('wallet-updated', { detail: nextWallet }));
}

function getPullRank(result: PullResultData | null | undefined) {
  const rarity = String(result?.rarity ?? '').toLowerCase();
  const rankMap: Record<string, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
  return rankMap[rarity] ?? 0;
}

function getFeaturedPull(results: PullResultData[]) {
  return [...results].sort((a, b) => getPullRank(b) - getPullRank(a))[0] ?? null;
}

function getPullImageUrl(result: PullResultData | null | undefined) {
  return getUnitImageUrl(result?.unit ?? null);
}

function getPullStarCount(result: PullResultData | null | undefined) {
  return getStarsForRarity(String(result?.rarity ?? 'common'));
}

function openFullscreenImage(imageUrl?: string | null, imageName?: string | null) {
  if (!imageUrl) return;
  fullscreenImageUrl.value = imageUrl;
  fullscreenImageName.value = imageName ?? '';
  showImageFullscreen.value = true;
}

function handleWalletUpdated(event: Event) {
  const detail = (event as CustomEvent<typeof wallet.value>).detail;
  if (!detail) return;
  wallet.value = {
    credits: Number(detail.credits ?? wallet.value.credits ?? 0),
    cores: Number(detail.cores ?? wallet.value.cores ?? 0),
    fragments: Number(detail.fragments ?? wallet.value.fragments ?? 0),
    ascension_essence: Number(detail.ascension_essence ?? wallet.value.ascension_essence ?? 0)
  };
}

function startAnimation() {
  canClose.value = false;
  phase.value = 'portal';
  showOrb.value = false;
  orbRarity.value = '';
  showExplosion.value = false;
  screenShakeClass.value = '';
  cameraClass.value = 'camera-zoom-in';

  const controller = {
    startPortalAnimation() {
      phase.value = 'portal';
      setTimeout(() => {
        phase.value = 'vortex';
        cameraClass.value = 'camera-zoom-pulse';
      }, 100);
    },
    playPortalCharge() {
      /* camera déjà en zoom-pulse après vortex */
    },
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
      screenShakeClass.value = getScreenShakeCssClass(resultRarity.value);
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
    showStars() {
      /* starCount et étoiles gérés par le template */
    },
    elementEffect() {
      /* elementSlug / elementEffectClass gérés par le template */
    },
    resetInvokeScene() {
      cameraClass.value = '';
      screenShakeClass.value = '';
    }
  };

  runInvokeAnimation(controller, resultRarity.value, pullResult.value?.unit);
}

function closeOverlay() {
  if (!canClose.value) return;
  showOverlay.value = false;
  showImageFullscreen.value = false;
  fullscreenImageUrl.value = '';
  fullscreenImageName.value = '';
  pullResult.value = null;
  pullResults.value = [];
  resultRarity.value = '';
  phase.value = 'portal';
  showOrb.value = false;
  orbRarity.value = '';
  showExplosion.value = false;
  cameraClass.value = '';
  screenShakeClass.value = '';
  canClose.value = false;
}

async function invoke(type: PullType, count = 1) {
  loading.value = true;
  pullError.value = '';
  pullResult.value = null;
  pullResults.value = [];
  try {
    const { data } = await api.post('/sanctuary/pull', { type, count });
    if (data.success) {
      wallet.value = data.wallet ?? wallet.value;
      emitWalletUpdated(data.wallet ?? wallet.value);
      if (type === 'standard' && data.pity) {
        pity.value = {
          total_pulls: data.pity.total_pulls ?? 0,
          pity_epic: data.pity.pity_epic ?? 0,
          pity_legendary: data.pity.pity_legendary ?? 0,
          pity_mythic: data.pity.pity_mythic ?? 0
        };
      }
      if (Array.isArray(data.pulls) && data.pulls.length > 0) {
        pullResults.value = data.pulls.map((entry: any) => ({
          unit: entry.unit,
          rarity: entry.rarity,
          isNewUnit: entry.isNewUnit,
          fragmentsGained: entry.fragmentsGained,
          wallet: entry.wallet,
          pity: entry.pity,
          creditsGained: entry.creditsGained,
          duplicateRewards: entry.duplicateRewards,
          power: entry.power
        }));
        const featuredPull = getFeaturedPull(pullResults.value);
        resultRarity.value = String(featuredPull?.rarity ?? data.featured_rarity ?? 'common').toLowerCase();
        pullResult.value = featuredPull;
      } else {
        const rarity = (data.rarity ?? 'common').toLowerCase();
        resultRarity.value = rarity;
        pullResult.value = {
          unit: data.unit,
          rarity: data.rarity,
          isNewUnit: data.isNewUnit,
          fragmentsGained: data.fragmentsGained,
          wallet: data.wallet,
          pity: data.pity,
          creditsGained: data.creditsGained,
          duplicateRewards: data.duplicateRewards,
          power: data.power
        };
      }
      showOverlay.value = true;
      startAnimation();
    } else {
      pullError.value = errorMessage(data.error, data.required);
    }
  } catch (e: any) {
    const err = e.response?.data?.error ?? e.message ?? 'Erreur réseau';
    pullError.value = errorMessage(err, e.response?.data?.required);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  window.addEventListener('wallet-updated', handleWalletUpdated as EventListener);
  await loadWallet();
  await loadPity();
});

onUnmounted(() => {
  window.removeEventListener('wallet-updated', handleWalletUpdated as EventListener);
});
</script>

<style scoped>
.sanctuaire-container {
  padding: 20px 28px;
  color: #fff;
  background: radial-gradient(circle at top, #0f172a, #020617 70%);
  min-height: 100vh;
}

.sanctuaire-title {
  text-align: center;
  font-size: 1.8rem;
  margin-bottom: 16px;
  letter-spacing: 1px;
}

.currency-bar {
  display: flex;
  justify-content: center;
  gap: 24px;
  background: rgba(255,255,255,0.05);
  padding: 10px 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  backdrop-filter: blur(10px);
}

.portails-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
}

.portail-card {
  position: relative;
  height: 300px;
  border-radius: 18px;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  box-shadow: 0 0 30px rgba(0,0,0,0.5);
  transition: transform 0.4s ease, box-shadow 0.4s ease;
}

.portail-card::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(0,200,255,0.2), transparent 70%);
  opacity: 0;
  transition: opacity 0.4s;
  pointer-events: none;
}

.portail-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 0 40px rgba(0,200,255,0.4);
}

.portail-card:hover::after {
  opacity: 1;
}

.portail-card.standard {
  background-image:
    linear-gradient(180deg, rgba(37, 99, 235, 0.25), rgba(2, 6, 23, 0.82)),
    url('/images/Fond.png');
}

.portail-card.noyau {
  background-image:
    linear-gradient(180deg, rgba(14, 165, 233, 0.22), rgba(8, 47, 73, 0.84)),
    url('/images/Fond.png');
}

.portail-card.resonance {
  background-image:
    linear-gradient(180deg, rgba(168, 85, 247, 0.24), rgba(49, 10, 101, 0.86)),
    url('/images/Fond.png');
}

.portail-overlay {
  position: absolute;
  bottom: 0;
  width: 100%;
  padding: 16px 16px;
  background: linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.2));
  text-align: center;
}

.cost {
  margin: 6px 0 10px;
  opacity: 0.8;
}

.pool {
  margin: 0 0 10px;
  font-size: 0.8rem;
  opacity: 0.85;
}

.invoke-actions {
  display: grid;
  gap: 7px;
}

.invoke-btn-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  border-radius: 12px;
  padding: 3px;
  transition: all 0.35s ease;
}
.invoke-btn-wrap.pity-trigger {
  animation: pity-glow-pulse 2.5s ease-in-out infinite;
}
.invoke-btn-wrap.pity-trigger.pity-epic {
  box-shadow: 0 0 18px rgba(168, 85, 247, 0.45), inset 0 0 12px rgba(139, 92, 246, 0.08);
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(168, 85, 247, 0.12));
}
.invoke-btn-wrap.pity-trigger.pity-legendary {
  box-shadow: 0 0 22px rgba(251, 191, 36, 0.5), inset 0 0 14px rgba(245, 158, 11, 0.1);
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1));
}
.invoke-btn-wrap.pity-trigger.pity-mythic {
  box-shadow: 0 0 28px rgba(244, 114, 182, 0.55), 0 0 40px rgba(236, 72, 153, 0.25), inset 0 0 16px rgba(244, 114, 182, 0.12);
  background: linear-gradient(135deg, rgba(244, 114, 182, 0.25), rgba(236, 72, 153, 0.15));
}
@keyframes pity-glow-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.08); }
}

.pity-badge {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: center;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
}
.pity-badge-epic {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(168, 85, 247, 0.4));
  color: #e9d5ff;
  border: 1px solid rgba(192, 132, 252, 0.5);
  text-shadow: 0 0 8px rgba(168, 85, 247, 0.6);
}
.pity-badge-legendary {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.45), rgba(245, 158, 11, 0.35));
  color: #fef3c7;
  border: 1px solid rgba(253, 224, 71, 0.5);
  text-shadow: 0 0 10px rgba(251, 191, 36, 0.7);
}
.pity-badge-mythic {
  background: linear-gradient(135deg, rgba(244, 114, 182, 0.5), rgba(236, 72, 153, 0.4));
  color: #fce7f3;
  border: 1px solid rgba(251, 113, 133, 0.55);
  text-shadow: 0 0 12px rgba(244, 114, 182, 0.8);
  animation: pity-badge-shimmer 3s ease-in-out infinite;
}
@keyframes pity-badge-shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.92; }
}

.invoke-btn {
  padding: 9px 20px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(90deg, #2563eb, #06b6d4);
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: 0.3s;
  white-space: normal;
  line-height: 1.25;
  min-height: 40px;
}

.invoke-btn-wrap:not(.pity-trigger) .invoke-btn {
  /* default */
}

.invoke-btn-pity.pity-epic {
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  box-shadow: 0 2px 12px rgba(139, 92, 246, 0.4);
}
.invoke-btn-pity.pity-epic:hover:enabled {
  box-shadow: 0 0 24px rgba(168, 85, 247, 0.7), 0 2px 16px rgba(139, 92, 246, 0.4);
}
.invoke-btn-pity.pity-legendary {
  background: linear-gradient(135deg, #d97706, #f59e0b);
  box-shadow: 0 2px 14px rgba(245, 158, 11, 0.45);
}
.invoke-btn-pity.pity-legendary:hover:enabled {
  box-shadow: 0 0 28px rgba(251, 191, 36, 0.75), 0 2px 18px rgba(245, 158, 11, 0.5);
}
.invoke-btn-pity.pity-mythic {
  background: linear-gradient(135deg, #db2777, #ec4899);
  box-shadow: 0 2px 16px rgba(236, 72, 153, 0.5);
}
.invoke-btn-pity.pity-mythic:hover:enabled {
  box-shadow: 0 0 32px rgba(244, 114, 182, 0.8), 0 0 48px rgba(236, 72, 153, 0.35), 0 2px 20px rgba(236, 72, 153, 0.5);
}

.invoke-btn:hover:enabled {
  box-shadow: 0 0 20px rgba(0,200,255,0.7);
  transform: scale(1.05);
}

.invoke-btn-multi {
  background: linear-gradient(90deg, #7c3aed, #ec4899);
}
.portail-card.standard .invoke-btn-multi:not(.invoke-btn-pity) {
  background: linear-gradient(90deg, #7c3aed, #ec4899);
}

.invoke-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: grayscale(0.2);
}

.pity-section {
  margin-top: 20px;
  padding: 14px 18px;
  background: rgba(255,255,255,0.05);
  border-radius: 14px;
  backdrop-filter: blur(8px);
}

.pity-grid {
  display: flex;
  justify-content: space-around;
  margin-top: 8px;
  font-size: 1rem;
  flex-wrap: wrap;
  gap: 12px 24px;
}

.error-msg {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(248, 113, 113, 0.15);
  border: 1px solid rgba(248, 113, 113, 0.4);
  border-radius: 0.5rem;
  color: #fca5a5;
}

/* Overlay */
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

/* ---- Camera feel / cinématique ---- */
.invoke-camera-wrap {
  transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.invoke-camera-wrap.camera-zoom-in {
  animation: camera-zoom-in 0.6s ease-out forwards;
}

.invoke-camera-wrap.camera-zoom-pulse {
  animation: camera-zoom-pulse 2s ease-in-out infinite;
}

.invoke-camera-wrap.camera-reset {
  animation: camera-reset 0.5s ease-out forwards;
}

@keyframes camera-zoom-in {
  0% { transform: scale(0.98); }
  100% { transform: scale(1); }
}

@keyframes camera-zoom-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}

@keyframes camera-reset {
  0% { transform: scale(1.02); }
  100% { transform: scale(1); }
}

/* Screen shake (intensité selon rareté) */
.invoke-camera-wrap.screen-shake-light {
  animation: screen-shake-light 0.35s ease-out;
}

.invoke-camera-wrap.screen-shake-medium {
  animation: screen-shake-medium 0.4s ease-out;
}

.invoke-camera-wrap.screen-shake-heavy {
  animation: screen-shake-heavy 0.5s ease-out;
}

@keyframes screen-shake-light {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-3px, 2px); }
  40% { transform: translate(3px, -2px); }
  60% { transform: translate(-2px, 1px); }
  80% { transform: translate(2px, -1px); }
}

@keyframes screen-shake-medium {
  0%, 100% { transform: translate(0, 0); }
  15% { transform: translate(-6px, 4px); }
  30% { transform: translate(6px, -4px); }
  45% { transform: translate(-4px, 3px); }
  60% { transform: translate(4px, -3px); }
  75% { transform: translate(-2px, 2px); }
}

@keyframes screen-shake-heavy {
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-10px, 6px); }
  20% { transform: translate(10px, -6px); }
  30% { transform: translate(-8px, 5px); }
  40% { transform: translate(8px, -5px); }
  50% { transform: translate(-5px, 4px); }
  60% { transform: translate(5px, -4px); }
  70% { transform: translate(-3px, 2px); }
  80% { transform: translate(3px, -2px); }
}

/* ---- 1) Portail actif : rotation + glow + particules ---- */
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
  background: rgba(0, 0, 0, 0.3);
  box-shadow: 0 0 40px currentColor, inset 0 0 20px rgba(255, 255, 255, 0.1);
}

.portal-center.rarity-common .portal-hex { color: #78716c; }
.portal-center.rarity-uncommon .portal-hex { color: #22c55e; }
.portal-center.rarity-rare .portal-hex { color: #3b82f6; }
.portal-center.rarity-epic .portal-hex { color: #a855f7; }
.portal-center.rarity-legendary .portal-hex { color: #eab308; }
.portal-center.rarity-mythic .portal-hex { color: #dc2626; }

@keyframes portal-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes portal-glow {
  0%, 100% { filter: brightness(1); opacity: 1; }
  50% { filter: brightness(1.4); opacity: 0.95; }
}

/* ---- 2) Vortex : particules aspirées vers le centre ---- */
.portal-vortex {
  overflow: visible;
}

.vortex-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.vortex-particle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
  animation: vortex-in 1s ease-in var(--vdelay, 0s) forwards;
  transform: translate(-50%, -50%) translate(var(--vx), var(--vy));
  opacity: 0.9;
}

.portal-vortex .vortex-particles {
  animation: vortex-pulse 0.5s ease-out;
}

@keyframes vortex-in {
  from {
    opacity: 0.9;
    transform: translate(-50%, -50%) translate(var(--vx), var(--vy));
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) translate(0, 0);
  }
}
@keyframes vortex-pulse {
  0% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* ---- 3–4) Orb premium multi-couches ---- */
.rarity-orb.orb-premium {
  position: absolute;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  --orb-color: #78716c;
}

.orb-outer-glow {
  position: absolute;
  inset: -35px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--orb-color) 0%, transparent 65%);
  opacity: 0.4;
  filter: blur(12px);
  animation: orb-intensity 1.2s ease-in-out infinite;
}

.orb-inner-glow {
  position: absolute;
  inset: -15px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--orb-color) 0%, transparent 60%);
  opacity: 0.7;
  filter: blur(8px);
  animation: orb-intensity 1s ease-in-out infinite 0.1s;
}

.orb-ring {
  position: absolute;
  width: 85px;
  height: 85px;
  border-radius: 50%;
  border: 2px solid var(--orb-color);
  opacity: 0.6;
  box-shadow: 0 0 15px var(--orb-color);
}

.orb-ring-1 {
  animation: orb-ring-rotate 4s linear infinite;
}

.orb-ring-2 {
  width: 75px;
  height: 75px;
  animation: orb-ring-rotate 3s linear infinite reverse;
}

.orb-core {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff 0%, var(--orb-color) 50%, rgba(0,0,0,0.3) 100%);
  box-shadow:
    0 0 25px var(--orb-color),
    inset 0 0 20px rgba(255, 255, 255, 0.4),
    inset -5px -5px 15px rgba(0, 0, 0, 0.2);
  animation: orb-pulse 0.9s ease-in-out infinite;
}

.orb-vortex-inner {
  position: absolute;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, var(--orb-color), transparent, var(--orb-color), transparent);
  opacity: 0.25;
  animation: orb-vortex-spin 2s linear infinite;
}

.orb-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.orb-particle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--orb-color);
  box-shadow: 0 0 8px var(--orb-color);
  animation: orb-particle-orbit 2.5s linear var(--odelay, 0s) infinite;
  transform: translate(-50%, -50%) rotate(0deg) translateX(42px) rotate(0deg);
  opacity: 0.9;
}

.orb-sparks {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.orb-spark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 6px var(--orb-color);
  animation: orb-spark-burst 0.8s ease-out var(--spark-delay, 0s) infinite;
  transform: translate(-50%, -50%) translate(0, 0);
  opacity: 0;
}

@keyframes orb-intensity {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}

@keyframes orb-ring-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes orb-vortex-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes orb-particle-orbit {
  from { transform: translate(-50%, -50%) rotate(0deg) translateX(42px) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg) translateX(42px) rotate(-360deg); }
}

@keyframes orb-spark-burst {
  0% { opacity: 0; transform: translate(-50%, -50%) translate(0, 0) scale(0.5); }
  40% { opacity: 1; transform: translate(-50%, -50%) translate(var(--spark-x), var(--spark-y)) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--spark-x), var(--spark-y)) scale(1.2); }
}

@keyframes orb-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 25px var(--orb-color), inset 0 0 20px rgba(255,255,255,0.4); }
  50% { transform: scale(1.08); box-shadow: 0 0 35px var(--orb-color), inset 0 0 25px rgba(255,255,255,0.5); }
}

.rarity-orb.orb-shake {
  animation: orb-shake 0.12s ease-in-out infinite;
}

.rarity-orb.orb-shake .orb-core {
  animation: orb-pulse 0.9s ease-in-out infinite, orb-shake 0.12s ease-in-out infinite;
}

@keyframes orb-shake {
  0%, 100% { transform: translateX(0) scale(1); }
  25% { transform: translateX(-5px) scale(1.06); }
  75% { transform: translateX(5px) scale(1.06); }
}

/* ---- 5) Explosion magique ---- */
.explosion-flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.9) 0%, var(--explosion-color, rgba(255, 255, 255, 0.4)) 30%, transparent 60%);
  animation: explosion-flash 0.4s ease-out forwards;
  z-index: 2;
}

.explosion-flash.rarity-common { --explosion-color: rgba(120, 113, 108, 0.5); }
.explosion-flash.rarity-uncommon { --explosion-color: rgba(34, 197, 94, 0.5); }
.explosion-flash.rarity-rare { --explosion-color: rgba(59, 130, 246, 0.5); }
.explosion-flash.rarity-epic { --explosion-color: rgba(168, 85, 247, 0.5); }
.explosion-flash.rarity-legendary { --explosion-color: rgba(234, 179, 8, 0.6); }
.explosion-flash.rarity-mythic { --explosion-color: rgba(220, 38, 38, 0.6); }

@keyframes explosion-flash {
  0% { opacity: 0; transform: scale(0.5); }
  30% { opacity: 1; transform: scale(1.2); }
  100% { opacity: 0; transform: scale(1.5); }
}

/* ---- 6) Révélation carte premium (unit-reveal-card) ---- */
.unit-reveal .reveal-card.unit-reveal-card {
  animation: unit-reveal-slide-up 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  box-shadow: 0 0 50px var(--reveal-glow, rgba(255, 255, 255, 0.2)), 0 20px 40px rgba(0, 0, 0, 0.4);
  border-width: 2px;
  overflow: hidden;
}

.unit-reveal-card.reveal-card-premium {
  box-shadow: 0 0 60px var(--reveal-glow), 0 0 100px rgba(255, 255, 255, 0.1), 0 25px 50px rgba(0, 0, 0, 0.5);
  animation: unit-reveal-slide-up 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes unit-reveal-slide-up {
  0% { transform: translateY(40px) scale(0.9); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

.unit-reveal-portrait {
  position: relative;
  width: 110px;
  height: 110px;
  margin: 0 auto 0.75rem;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid currentColor;
  box-shadow: 0 0 20px var(--reveal-glow);
}

.unit-reveal-portrait-bg {
  position: absolute;
  inset: -10px;
  background: radial-gradient(circle, var(--reveal-glow) 0%, transparent 70%);
  opacity: 0.3;
  pointer-events: none;
}

.unit-reveal-portrait-img {
  position: relative;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.unit-reveal-name {
  margin-bottom: 0.5rem;
  font-size: 1.3rem;
}

.unit-reveal-meta {
  margin: 0.25rem 0;
}

.reveal-wrap.rarity-common .reveal-card { --reveal-glow: rgba(120, 113, 108, 0.3); }
.reveal-wrap.rarity-uncommon .reveal-card { --reveal-glow: rgba(34, 197, 94, 0.4); }
.reveal-wrap.rarity-rare .reveal-card { --reveal-glow: rgba(59, 130, 246, 0.4); }
.reveal-wrap.rarity-epic .reveal-card { --reveal-glow: rgba(168, 85, 247, 0.4); }
.reveal-wrap.rarity-legendary .reveal-card { --reveal-glow: rgba(234, 179, 8, 0.5); }
.reveal-wrap.rarity-mythic .reveal-card { --reveal-glow: rgba(220, 38, 38, 0.5); }

@keyframes unit-reveal-in {
  0% { transform: scale(0.6); opacity: 0; }
  70% { transform: scale(1.02); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.reveal-portrait-wrap {
  width: 100px;
  height: 100px;
  margin: 0 auto 0.75rem;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid currentColor;
  background: rgba(0, 0, 0, 0.4);
}

.reveal-portrait-wrap.reveal-portrait-clickable {
  cursor: pointer;
}

.reveal-portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reveal-role,
.reveal-element {
  font-size: 0.9rem;
  color: #94a3b8;
  margin: 0.25rem 0;
}

/* Étoiles (1–6) : apparition une par une avec glow */
.reveal-stars {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin: 0.5rem 0;
  font-size: 1.1rem;
}

.star {
  opacity: 0.25;
  filter: grayscale(0.8);
  transition: opacity 0.2s, filter 0.2s;
}

.star.star-filled {
  opacity: 1;
  filter: none;
}

.star.star-glow {
  animation: star-glow-in 0.45s ease-out var(--star-delay, 0s) forwards;
  opacity: 0;
}

/* Dernière étoile : burst plus fort */
.star.star-last.star-glow {
  animation: star-burst-last 0.55s ease-out var(--star-delay, 0s) forwards;
  opacity: 0;
}

@keyframes star-glow-in {
  0% {
    opacity: 0;
    transform: scale(0.4);
    filter: brightness(0.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
    filter: brightness(1.5);
  }
  100% {
    opacity: 1;
    transform: scale(1);
    filter: brightness(1);
  }
}

@keyframes star-burst-last {
  0% {
    opacity: 0;
    transform: scale(0.3);
    filter: brightness(0.2);
  }
  40% {
    opacity: 1;
    transform: scale(1.35);
    filter: brightness(1.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
    filter: brightness(1);
  }
}

/* Effets élément (fond selon élément unité) */
.element-effect {
  position: absolute;
  inset: -50px;
  pointer-events: none;
  z-index: 0;
  opacity: 0.5;
}

/* Feu : braises + flammes douces */
.element-effect.element-feu {
  background:
    radial-gradient(circle at 30% 40%, rgba(255, 120, 50, 0.4) 0%, transparent 40%),
    radial-gradient(circle at 70% 60%, rgba(220, 60, 20, 0.3) 0%, transparent 45%),
    radial-gradient(circle at center, rgba(180, 50, 0, 0.2) 0%, transparent 60%);
  animation: element-flicker 1.2s ease-in-out infinite;
}

/* Eau : vagues circulaires + reflets */
.element-effect.element-eau {
  background:
    radial-gradient(ellipse 80% 50% at 50% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
    radial-gradient(circle at center, rgba(30, 64, 175, 0.2) 0%, transparent 60%);
  animation: element-wave 2.5s ease-in-out infinite;
}

/* Plante : feuilles + poussière verte */
.element-effect.element-plante {
  background:
    radial-gradient(circle at 20% 80%, rgba(34, 197, 94, 0.25) 0%, transparent 40%),
    radial-gradient(circle at 80% 20%, rgba(22, 163, 74, 0.2) 0%, transparent 45%),
    radial-gradient(circle at center, rgba(22, 101, 52, 0.15) 0%, transparent 65%);
  animation: element-float 3.5s ease-in-out infinite;
}

.element-effect.element-lumiere {
  background: radial-gradient(circle at center, rgba(250, 204, 21, 0.35) 0%, rgba(234, 179, 8, 0.15) 50%, transparent 70%);
  animation: element-pulse 2s ease-in-out infinite;
}

.element-effect.element-tenebres {
  background: radial-gradient(circle at center, rgba(88, 28, 135, 0.4) 0%, rgba(30, 27, 75, 0.2) 50%, transparent 70%);
  animation: element-vortex 3s linear infinite;
}

@keyframes element-flicker {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.6; }
}
@keyframes element-wave {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.05); opacity: 0.6; }
}
@keyframes element-float {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.55; }
}
@keyframes element-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.2); }
}
@keyframes element-vortex {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Epic : éclairs violets */
.epic-lightning {
  position: absolute;
  inset: -80px;
  pointer-events: none;
  z-index: 1;
  background: linear-gradient(135deg, transparent 40%, rgba(168, 85, 247, 0.15) 50%, transparent 60%);
  animation: lightning-flash 0.8s ease-in-out 0.2s;
  opacity: 0;
}

@keyframes lightning-flash {
  0%, 100% { opacity: 0; }
  15%, 85% { opacity: 0.8; }
  50% { opacity: 0.4; }
}

/* Mythic : fissure dimensionnelle */
.mythic-crack {
  position: absolute;
  inset: -100px;
  pointer-events: none;
  z-index: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 20px,
    rgba(220, 38, 38, 0.08) 20px,
    rgba(220, 38, 38, 0.08) 21px
  );
  animation: crack-pulse 1.5s ease-in-out infinite;
}

@keyframes crack-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* Reveal wrapper (legendary/mythic containers) */
.reveal-wrap {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.multi-reveal-wrap {
  width: min(1120px, calc(100vw - 48px));
}

.multi-reveal-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 24px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.96));
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 0 45px rgba(59, 130, 246, 0.18);
}

.multi-reveal-header {
  text-align: center;
  margin-bottom: 18px;
}

.multi-reveal-kicker {
  display: inline-block;
  margin-bottom: 6px;
  font-size: 0.82rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #93c5fd;
}

.multi-reveal-title {
  margin: 0;
}

.multi-reveal-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.multi-reveal-card {
  padding: 14px 12px;
  text-align: center;
  background: rgba(15, 23, 42, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.14);
  animation: multi-card-in 0.45s ease-out both;
}

.multi-reveal-portrait {
  width: 78px;
  height: 78px;
  margin: 0 auto 10px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.18);
  background: rgba(2, 6, 23, 0.72);
}

.multi-reveal-portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.multi-reveal-name {
  display: block;
  min-height: 2.6em;
  margin-bottom: 8px;
  font-size: 0.92rem;
}

.multi-reveal-stars {
  display: flex;
  justify-content: center;
  gap: 2px;
  margin-bottom: 8px;
  font-size: 0.82rem;
}

.multi-reveal-status {
  display: block;
  margin-top: 8px;
  font-size: 0.78rem;
  color: #cbd5e1;
}

.multi-reveal-status.is-new {
  color: #86efac;
}

@keyframes multi-card-in {
  0% {
    opacity: 0;
    transform: translateY(16px) scale(0.96);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.reveal-wrap.rarity-legendary .reveal-card {
  animation: reveal-in 0.6s ease-out, reveal-shake-legendary 0.3s ease-out 0.5s;
}
.reveal-wrap.rarity-mythic .reveal-card {
  animation: reveal-in-mythic 0.6s ease-out, reveal-shake-mythic 0.3s ease-out 0.5s;
}

/* Legendary: halo + particules */
.legendary-halo {
  position: absolute;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(234, 179, 8, 0.25) 0%, rgba(251, 146, 60, 0.15) 40%, transparent 70%);
  animation: legendary-halo-rotate 4s linear infinite;
  pointer-events: none;
}
.legendary-particles {
  position: absolute;
  width: 200px;
  height: 200px;
  pointer-events: none;
}
.legendary-particle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(234, 179, 8, 0.9);
  box-shadow: 0 0 8px rgba(234, 179, 8, 0.8);
  animation: legendary-particle-out 0.8s ease-out var(--particle-delay, 0s) forwards;
  transform: translate(-50%, -50%) translate(0, 0);
  opacity: 0;
}
@keyframes legendary-halo-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes legendary-particle-out {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) translate(0, 0);
  }
  to {
    opacity: 0.8;
    transform: translate(-50%, -50%) translate(var(--particle-x), var(--particle-y));
  }
}

/* Mythic: fond animé + double halo */
.mythic-bg {
  position: absolute;
  inset: -100px;
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.4) 0%, rgba(168, 85, 247, 0.4) 50%, rgba(220, 38, 38, 0.3) 100%);
  background-size: 200% 200%;
  animation: mythic-bg-shift 3s ease-in-out infinite;
  pointer-events: none;
}
.mythic-halo {
  position: absolute;
  width: 340px;
  height: 340px;
  border-radius: 50%;
  border: 3px solid rgba(220, 38, 38, 0.6);
  box-shadow: 0 0 40px rgba(220, 38, 38, 0.4), inset 0 0 30px rgba(255, 255, 255, 0.1);
  animation: mythic-glow-pulse 1.2s ease-in-out infinite;
  pointer-events: none;
}
.mythic-halo::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.5);
  animation: mythic-glow-pulse 1.2s ease-in-out infinite 0.3s;
}
.mythic-title {
  display: block;
  font-size: 0.9rem;
  letter-spacing: 0.2em;
  color: #f87171;
  margin-bottom: 0.25rem;
  animation: mythic-title-spacing 0.8s ease-out forwards;
}
@keyframes mythic-bg-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@keyframes mythic-glow-pulse {
  0%, 100% { opacity: 0.8; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.02); }
}
@keyframes mythic-title-spacing {
  from { letter-spacing: -0.1em; opacity: 0; }
  to { letter-spacing: 0.35em; opacity: 1; }
}

@keyframes reveal-shake-legendary {
  0%, 100% { transform: scale(1) translateX(0); }
  25% { transform: scale(1) translateX(-3px); }
  75% { transform: scale(1) translateX(3px); }
}
@keyframes reveal-shake-mythic {
  0%, 100% { transform: scale(1) translateX(0); }
  25% { transform: scale(1.05) translateX(-6px); }
  75% { transform: scale(1.05) translateX(6px); }
}
@keyframes reveal-in-mythic {
  0% { transform: scale(1.05); opacity: 0; }
  70% { transform: scale(1.02); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.reveal-card {
  position: relative;
  z-index: 2;
  background: rgba(15, 23, 42, 0.98);
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

@keyframes reveal-in {
  0% { transform: scale(0.7); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.reveal-card h3 {
  margin-bottom: 0.75rem;
  font-size: 1.25rem;
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

.new-unit { color: #4ade80; margin: 0.5rem 0; }

/* Popup image en grand */
.image-fullscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  box-sizing: border-box;
}

.image-fullscreen-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.image-fullscreen-close:hover {
  background: rgba(255, 255, 255, 0.25);
}

.image-fullscreen-content {
  max-height: 90vh;
  width: 100%;
  max-width: 90vw;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-fullscreen-img {
  max-height: 90vh;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.image-fullscreen-enter-active,
.image-fullscreen-leave-active {
  transition: opacity 0.2s ease;
}

.image-fullscreen-enter-from,
.image-fullscreen-leave-to {
  opacity: 0;
}
.dupe { color: #94a3b8; margin: 0.5rem 0; }

.btn-close {
  margin-top: 1rem;
  padding: 0.5rem 1.25rem;
  border-radius: 0.5rem;
  border: 1px solid #64748b;
  background: rgba(100, 116, 139, 0.3);
  color: #e5e7eb;
  cursor: pointer;
}
.btn-close:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .multi-reveal-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .sanctuaire-container {
    padding: 1rem;
  }
  .multi-reveal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
}

@media (max-width: 640px) {
  .currency-bar {
    flex-wrap: wrap;
    gap: 14px;
  }

  .multi-reveal-wrap {
    width: min(100vw - 24px, 1120px);
  }

  .multi-reveal-panel {
    padding: 16px;
  }

  .multi-reveal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
}
</style>
