<template>
  <section
    ref="sanctuaryRootRef"
    class="sanctuary-page"
    @mousemove="onSanctuaryMouseMove"
    @mouseleave="onSanctuaryMouseLeave"
  >
    <!-- Fond cosmique + parallax -->
    <div class="sanctuary-cosmic-layer" :style="cosmicParallaxStyle" aria-hidden="true">
      <div class="sanctuary-cosmic-gradient" />
      <div class="sanctuary-cosmic-noise" />
      <div class="sanctuary-cosmic-orbs">
        <span class="sanctuary-orb sanctuary-orb-a" />
        <span class="sanctuary-orb sanctuary-orb-b" />
        <span class="sanctuary-orb sanctuary-orb-c" />
      </div>
      <div class="sanctuary-dust">
        <span v-for="n in 32" :key="'d' + n" class="sanctuary-dust-dot" :style="sanctDustStyle(n)" />
      </div>
    </div>

    <div class="sanctuary-layout" :style="layoutParallaxStyle">
      <header class="sanctuary-header-float">
        <div class="sanctuary-header-inner">
          <div class="sanctuary-title-block">
            <h1 class="sanctuary-title nx-title">Sanctuaire d'invocation</h1>
            <p class="sanctuary-sub">Cosmos vivant · Énergise ton roster</p>
          </div>
          <div class="sanctuary-wallet">
            <div class="sanctuary-wallet-row">
              <div class="res-pill" title="Cores">
                <span class="res-ico">🔷</span><span class="res-lbl">Cores</span><strong>{{ wallet.cores }}</strong>
              </div>
              <div class="res-pill" title="Crédits">
                <span class="res-ico">💰</span><span class="res-lbl">Crédits</span><strong>{{ wallet.credits }}</strong>
              </div>
              <div class="res-pill" title="Fragments">
                <span class="res-ico">🧩</span><span class="res-lbl">Fragments</span><strong>{{ wallet.fragments }}</strong>
              </div>
              <div class="res-pill" title="Essence d'ascension">
                <span class="res-ico">✨</span><span class="res-lbl">Essence</span><strong>{{ wallet.ascension_essence }}</strong>
              </div>
            </div>
            <div class="sanctuary-wallet-row sanctuary-wallet-row-divine">
              <div class="res-pill res-pill-divine" title="Cores divins">
                <span class="res-ico">💎</span><span class="res-lbl">C. divins</span><strong>{{ wallet.divine_cores ?? 0 }}</strong>
              </div>
              <div class="res-pill res-pill-divine" title="Crédits divins">
                <span class="res-ico">💠</span><span class="res-lbl">Cr. divins</span><strong>{{ wallet.divine_credits ?? 0 }}</strong>
              </div>
              <div class="res-pill res-pill-divine" title="Fragments divins">
                <span class="res-ico">🔮</span><span class="res-lbl">Fr. divins</span><strong>{{ wallet.divine_fragments ?? 0 }}</strong>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div v-if="pullError" class="sanctuary-error">{{ pullError }}</div>

      <!-- Ligne principale : Noyau | Standard (vedette) | Résonance -->
      <div class="sanctuary-primary-row portail-enter" style="--stagger: 1">
        <div class="portail-card-wrap">
          <div class="portail-card-fx portail-card-fx--noyau" aria-hidden="true">
            <span class="portail-vortex portail-vortex--slow" />
            <span v-for="n in 8" :key="'e1' + n" class="portail-ember portail-ember--gold" :style="portailEmberStyle(n + 20)" />
          </div>
          <div class="portail-card nx-card portail-card--noyau">
            <div class="portail-overlay">
              <h2 class="nx-title portail-title">Portail Noyau</h2>
              <p class="cost nx-subtitle">10 cores / invocation</p>
              <p class="pool pool--full">Commun 50% · Peu commun 40% · Rare 10% · Feu/Eau/Plante</p>
              <div class="invoke-actions">
                <button type="button" class="invoke-btn nx-btn portail-btn--noyau" :disabled="loading || !canInvoke('core', 1)" @click="invoke('core', 1)"><span class="invoke-btn-gloss" aria-hidden="true" />{{ getInvokeButtonLabel('core', 1) }}</button>
                <button type="button" class="invoke-btn invoke-btn-multi nx-btn portail-btn--noyau" :disabled="loading || !canInvoke('core', 10)" @click="invoke('core', 10)"><span class="invoke-btn-gloss" aria-hidden="true" />{{ getInvokeButtonLabel('core', 10) }}</button>
              </div>
            </div>
          </div>
        </div>

        <div class="portail-card-wrap portail-card-wrap--featured">
          <div class="portail-card-fx portail-card-fx--standard" aria-hidden="true">
            <span class="portail-vortex" />
            <span v-for="n in 14" :key="'hv' + n" class="portail-ember" :style="portailEmberStyle(n)" />
          </div>
          <div class="portail-card nx-card portail-card--standard">
            <span class="portail-badge-hero">Portail principal</span>
            <div class="portail-overlay">
              <h2 class="nx-title portail-title">Portail Standard</h2>
              <p class="cost nx-subtitle">100 crédits / invocation</p>
              <div class="pity-inline pity-inline--on-card">
                <span title="Pity épique (guaranteed à 25)">⭐ {{ pity.pity_epic }}/25</span>
                <span title="Pity légendaire">🌟 {{ pity.pity_legendary }}/100</span>
                <span title="Pity mythique">🔥 {{ pity.pity_mythic }}/1000</span>
              </div>
              <p class="pool pool--full">
                Commun 49,9% · Peu commun 30% · Rare 15% · Épique 4% · Légendaire 1% · Mythique 0,1% · Feu/Eau/Plante
              </p>
              <div class="invoke-actions">
                <div class="invoke-btn-wrap" :class="standardPityAboutToTrigger(1) ? `pity-trigger pity-${standardPityAboutToTrigger(1)}` : ''">
                  <span v-if="standardPityAboutToTrigger(1)" class="pity-badge" :class="`pity-badge-${standardPityAboutToTrigger(1)}`">{{ pityTriggerLabel(standardPityAboutToTrigger(1)!) }}</span>
                  <button
                    type="button"
                    class="invoke-btn nx-btn"
                    :class="standardPityAboutToTrigger(1) ? `invoke-btn-pity pity-${standardPityAboutToTrigger(1)}` : ''"
                    :disabled="loading || !canInvoke('standard', 1)"
                    @click="invoke('standard', 1)"
                  >
                    <span class="invoke-btn-gloss" aria-hidden="true" />
                    {{ getInvokeButtonLabel('standard', 1) }}
                  </button>
                </div>
                <div class="invoke-btn-wrap" :class="standardPityAboutToTrigger(10) ? `pity-trigger pity-${standardPityAboutToTrigger(10)}` : ''">
                  <span v-if="standardPityAboutToTrigger(10)" class="pity-badge" :class="`pity-badge-${standardPityAboutToTrigger(10)}`">{{ pityTriggerLabel(standardPityAboutToTrigger(10)!) }}</span>
                  <button
                    type="button"
                    class="invoke-btn invoke-btn-multi nx-btn"
                    :class="standardPityAboutToTrigger(10) ? `invoke-btn-pity pity-${standardPityAboutToTrigger(10)}` : ''"
                    :disabled="loading || !canInvoke('standard', 10)"
                    @click="invoke('standard', 10)"
                  >
                    <span class="invoke-btn-gloss" aria-hidden="true" />
                    {{ getInvokeButtonLabel('standard', 10) }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="portail-card-wrap">
          <div class="portail-card-fx portail-card-fx--resonance" aria-hidden="true">
            <span class="portail-vortex portail-vortex--purple" />
            <span v-for="n in 8" :key="'e2' + n" class="portail-ember portail-ember--violet" :style="portailEmberStyle(n + 40)" />
          </div>
          <div class="portail-card nx-card portail-card--resonance">
            <div class="portail-overlay">
              <h2 class="nx-title portail-title">Portail Résonance</h2>
              <p class="cost nx-subtitle">100 fragments / invocation</p>
              <p class="pool pool--full">Rare 90% · Épique 10% · Feu/Eau/Plante</p>
              <div class="invoke-actions">
                <button type="button" class="invoke-btn nx-btn portail-btn--resonance" :disabled="loading || !canInvoke('resonance', 1)" @click="invoke('resonance', 1)"><span class="invoke-btn-gloss" aria-hidden="true" />{{ getInvokeButtonLabel('resonance', 1) }}</button>
                <button type="button" class="invoke-btn invoke-btn-multi nx-btn portail-btn--resonance" :disabled="loading || !canInvoke('resonance', 10)" @click="invoke('resonance', 10)"><span class="invoke-btn-gloss" aria-hidden="true" />{{ getInvokeButtonLabel('resonance', 10) }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h2 class="sanctuary-section-title portail-enter" style="--stagger: 2">Portails divins</h2>

      <div class="sanctuary-secondary">
        <div class="sanctuary-secondary-row sanctuary-secondary-row--triple portail-enter" style="--stagger: 3">
          <div class="portail-card-wrap">
            <div class="portail-card-fx portail-card-fx--divine" aria-hidden="true">
              <span class="portail-vortex portail-vortex--divine" />
              <span v-for="n in 10" :key="'e3' + n" class="portail-ember portail-ember--white" :style="portailEmberStyle(n + 60)" />
            </div>
            <div class="portail-card nx-card portail-card--noyau portail-card--divine">
              <div class="portail-overlay">
                <h2 class="nx-title portail-title">Portail Noyau Divin</h2>
                <p class="cost nx-subtitle">10 cores divins / invocation</p>
                <p class="pool pool--full">Commun 50% · Peu commun 40% · Rare 10% · Lumière/Ténèbres</p>
                <div class="invoke-actions">
                  <button type="button" class="invoke-btn nx-btn portail-btn--divine" :disabled="loading || !canInvoke('divine_core', 1)" @click="invoke('divine_core', 1)"><span class="invoke-btn-gloss" aria-hidden="true" />{{ getInvokeIconPrefix('divine_core', 1) }}{{ getInvokeButtonLabel('divine_core', 1) }}</button>
                  <button type="button" class="invoke-btn invoke-btn-multi nx-btn portail-btn--divine" :disabled="loading || !canInvoke('divine_core', 10)" @click="invoke('divine_core', 10)"><span class="invoke-btn-gloss" aria-hidden="true" />{{ getInvokeIconPrefix('divine_core', 10) }}{{ getInvokeButtonLabel('divine_core', 10) }}</button>
                </div>
              </div>
            </div>
          </div>

          <div class="portail-card-wrap">
            <div class="portail-card-fx portail-card-fx--standard portail-card-fx--divine" aria-hidden="true">
              <span class="portail-vortex portail-vortex--divine" />
              <span v-for="n in 8" :key="'e4' + n" class="portail-ember portail-ember--white" :style="portailEmberStyle(n + 90)" />
            </div>
            <div class="portail-card nx-card portail-card--standard portail-card--divine">
              <div class="portail-overlay">
                <h2 class="nx-title portail-title">Portail Standard Divin</h2>
                <p class="cost nx-subtitle">100 crédits divins / invocation</p>
                <p class="pool pool--full">Commun 49,9% · Peu commun 30% · Rare 15% · Épique 4% · Légendaire 1% · Mythique 0,1% · Lumière/Ténèbres</p>
                <div class="invoke-actions">
                  <div class="invoke-btn-wrap" :class="divineStandardPityAboutToTrigger(1) ? `pity-trigger pity-${divineStandardPityAboutToTrigger(1)}` : ''">
                    <span v-if="divineStandardPityAboutToTrigger(1)" class="pity-badge" :class="`pity-badge-${divineStandardPityAboutToTrigger(1)!}`">{{ pityTriggerLabel(divineStandardPityAboutToTrigger(1)!) }}</span>
                    <button type="button" class="invoke-btn nx-btn portail-btn--divine" :class="divineStandardPityAboutToTrigger(1) ? `invoke-btn-pity pity-${divineStandardPityAboutToTrigger(1)}` : ''" :disabled="loading || !canInvoke('divine_standard', 1)" @click="invoke('divine_standard', 1)"><span class="invoke-btn-gloss" aria-hidden="true" />{{ getInvokeIconPrefix('divine_standard', 1) }}{{ getInvokeButtonLabel('divine_standard', 1) }}</button>
                  </div>
                  <div class="invoke-btn-wrap" :class="divineStandardPityAboutToTrigger(10) ? `pity-trigger pity-${divineStandardPityAboutToTrigger(10)}` : ''">
                    <span v-if="divineStandardPityAboutToTrigger(10)" class="pity-badge" :class="`pity-badge-${divineStandardPityAboutToTrigger(10)!}`">{{ pityTriggerLabel(divineStandardPityAboutToTrigger(10)!) }}</span>
                    <button type="button" class="invoke-btn invoke-btn-multi nx-btn portail-btn--divine" :class="divineStandardPityAboutToTrigger(10) ? `invoke-btn-pity pity-${divineStandardPityAboutToTrigger(10)}` : ''" :disabled="loading || !canInvoke('divine_standard', 10)" @click="invoke('divine_standard', 10)"><span class="invoke-btn-gloss" aria-hidden="true" />{{ getInvokeIconPrefix('divine_standard', 10) }}{{ getInvokeButtonLabel('divine_standard', 10) }}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="portail-card-wrap">
            <div class="portail-card-fx portail-card-fx--resonance portail-card-fx--divine" aria-hidden="true">
              <span class="portail-vortex portail-vortex--purple portail-vortex--divine" />
              <span v-for="n in 8" :key="'e5' + n" class="portail-ember portail-ember--white" :style="portailEmberStyle(n + 110)" />
            </div>
            <div class="portail-card nx-card portail-card--resonance portail-card--divine">
              <div class="portail-overlay">
                <h2 class="nx-title portail-title">Portail Résonance Divin</h2>
                <p class="cost nx-subtitle">100 fragments divins / invocation</p>
                <p class="pool pool--full">Rare 90% · Épique 10% · Lumière/Ténèbres</p>
                <div class="invoke-actions">
                  <button type="button" class="invoke-btn nx-btn portail-btn--divine" :disabled="loading || !canInvoke('divine_resonance', 1)" @click="invoke('divine_resonance', 1)"><span class="invoke-btn-gloss" aria-hidden="true" />{{ getInvokeIconPrefix('divine_resonance', 1) }}{{ getInvokeButtonLabel('divine_resonance', 1) }}</button>
                  <button type="button" class="invoke-btn invoke-btn-multi nx-btn portail-btn--divine" :disabled="loading || !canInvoke('divine_resonance', 10)" @click="invoke('divine_resonance', 10)"><span class="invoke-btn-gloss" aria-hidden="true" />{{ getInvokeIconPrefix('divine_resonance', 10) }}{{ getInvokeButtonLabel('divine_resonance', 10) }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="pity-inline pity-inline--secondary portail-enter" style="--stagger: 5">
          <span>Pity divins ·</span>
          <span title="Pity épique (standard divin)">⭐ {{ pityDivineStandard.pity_epic }}/25</span>
          <span title="Pity légendaire">🌟 {{ pityDivineStandard.pity_legendary }}/100</span>
          <span title="Pity mythique">🔥 {{ pityDivineStandard.pity_mythic }}/1000</span>
        </div>
      </div>

      <footer class="sanctuary-footer portail-enter" style="--stagger: 6">
        <p>Chaque portail consomme la monnaie indiquée. Les taux de drop par rareté sont rappelés sur chaque carte.</p>
      </footer>
    </div>

    <!-- Overlay animation gacha (camera + shake sur le wrapper) -->
    <Transition name="overlay">
      <div
        v-if="showOverlay"
        class="gacha-overlay invoke-camera-wrap"
        :class="[overlayClass, cameraClass, screenShakeClass, `invoke-phase-${phase}`]"
        @click.self="canClose && phase === 'reveal' && closeOverlay()"
      >
        <div
          class="overlay-backdrop"
          :class="{ 'backdrop-invoke-pulse': phase !== 'reveal', 'backdrop-reveal-focus': phase === 'reveal' }"
        />

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
            class="rarity-orb orb-premium orb-invoke-core"
            :class="[
              orbRarityClass,
              {
                'orb-charge-phase': phase === 'shake',
                'orb-just-spawned': phase === 'orb'
              }
            ]"
            :style="orbStyle"
          >
            <div class="orb-magic-circle" aria-hidden="true" />
            <div class="orb-outer-glow" />
            <div class="orb-inner-glow" />
            <div class="orb-ring orb-ring-1" />
            <div class="orb-ring orb-ring-2" />
            <div class="orb-ring orb-ring-3" />
            <div class="orb-core" />
            <div class="orb-vortex-inner" />
            <div class="orb-energy-rings" aria-hidden="true">
              <span v-for="n in 5" :key="'er-' + n" class="orb-energy-ring" :style="{ '--energy-ring-delay': `${(n - 1) * 0.22}s` }" />
            </div>
            <div class="orb-burst-particles" aria-hidden="true">
              <span v-for="n in 14" :key="'bp-' + n" class="orb-burst-particle" :style="orbBurstParticleStyle(n)" />
            </div>
            <div class="orb-particles">
              <span v-for="n in orbParticleCount" :key="n" class="orb-particle" :style="orbParticleStyle(n)" />
            </div>
            <div class="orb-sparks">
              <span v-for="n in 6" :key="n" class="orb-spark" :style="orbSparkStyle(n)" />
            </div>
          </div>
        </div>

        <!-- 5) Explosion : flash blanc bref + onde de rareté -->
        <div v-if="showExplosion" class="explosion-white-flash" aria-hidden="true" />
        <div v-if="showExplosion" class="explosion-flash" :class="rarityClass" />
        <div v-if="showExplosion" class="explosion-particles" :class="rarityClass" aria-hidden="true">
          <span v-for="n in 24" :key="'xp-' + n" class="explosion-debris" :style="explosionDebrisStyle(n)" />
        </div>

        <!-- 6) Révélation carte unité + étoiles + effet élément -->
        <div
          v-if="phase === 'reveal' && !isMultiPull"
          class="reveal-wrap unit-reveal reveal-modal-stage"
          :class="[rarityClass, elementEffectClass, `reveal-tier-${resultRarity}`]"
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
          <div class="reveal-card unit-reveal-card nx-card reveal-card-living" :class="[rarityClass, revealCardRarityClass]">
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
            <span class="rarity-badge unit-reveal-rarity nx-badge rarity-badge-pill" :class="rarityClass">{{ pullResult?.rarity }}</span>
            <div class="unit-reveal-meta">
              <p v-if="pullResult?.unit?.role" class="reveal-role">{{ toRoleFr(pullResult.unit.role) }}</p>
              <p v-if="pullResult?.unit?.element" class="reveal-element">{{ toElementFr(pullResult.unit.element) }}</p>
            </div>
            <p v-if="pullResultSkillDescription" class="reveal-skill-desc">{{ pullResultSkillDescription }}</p>
            <p v-if="pullPrimaryMessage" :class="pullResult?.isNewUnit ? 'new-unit' : 'dupe'">{{ pullPrimaryMessage }}</p>
            <p v-if="pullSecondaryMessage" class="dupe">{{ pullSecondaryMessage }}</p>
            <button type="button" class="btn-close nx-btn btn-close-reveal" :disabled="!canClose" @click="canClose && closeOverlay()">Fermer</button>
          </div>
        </div>

        <div
          v-else-if="phase === 'reveal' && isMultiPull"
          class="reveal-wrap multi-reveal-wrap reveal-modal-stage"
          :class="[rarityClass, elementEffectClass, `reveal-tier-${resultRarity}`]"
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
              <article
                v-for="(result, index) in pullResults"
                :key="`${result.unit?.name || 'unit'}-${index}`"
                class="multi-reveal-card nx-card"
                :style="{ '--multi-reveal-i': String(index) }"
              >
                <div
                  class="multi-reveal-portrait"
                  :class="{ 'reveal-portrait-clickable': !!getPullImageUrl(result) }"
                  role="button"
                  tabindex="0"
                  title="Agrandir l'image"
                  @click="openFullscreenImage(getPullImageUrl(result), result.unit?.name)"
                  @keydown.enter="openFullscreenImage(getPullImageUrl(result), result.unit?.name)"
                >
                  <img v-if="getPullImageUrl(result)" :src="getPullImageUrl(result) ?? undefined" alt="" class="multi-reveal-portrait-img" />
                </div>
                <strong class="multi-reveal-name">{{ result.unit?.name || 'Unité inconnue' }}</strong>
                <div class="multi-reveal-stars">
                  <span v-for="i in 6" :key="i" class="star" :class="{ 'star-filled': i <= getPullStarCount(result) }">⭐</span>
                </div>
                <span class="rarity-badge nx-badge" :class="`rarity-${String(result.rarity || 'common').toLowerCase()}`">{{ result.rarity }}</span>
                <span class="multi-reveal-status" :class="{ 'is-new': result.isNewUnit }">{{ result.isNewUnit ? 'Nouveau' : 'Doublon' }}</span>
                <p v-if="getMultiRevealSkillDesc(result)" class="multi-reveal-skill-desc">{{ getMultiRevealSkillDesc(result) }}</p>
              </article>
            </div>
            <button type="button" class="btn-close nx-btn btn-close-reveal" :disabled="!canClose" @click="canClose && closeOverlay()">Fermer</button>
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
  INVOKE_DURATIONS,
  rarityColors,
  getStarsForRarity,
  getFakeOutRarity,
  getElementSlug,
  getScreenShakeCssClass
} from '../utils/invokeAnimation';
import { getUnitImageUrl } from '../utils/unitImage';
import { toRoleFr, toElementFr } from '../utils/i18nFr';
import { getUnitSkillDisplayText } from '../utils/skillDescription';

const wallet = ref({
  credits: 0,
  cores: 0,
  fragments: 0,
  ascension_essence: 0,
  divine_cores: 0,
  divine_credits: 0,
  divine_fragments: 0
});
type PullType = 'standard' | 'core' | 'resonance' | 'divine_core' | 'divine_standard' | 'divine_resonance';

/** Désactivation temporaire des 3 portails divins (x1 et x10). Remettre à false pour réactiver. */
const DIVINE_PORTALS_DISABLED = false;

function isDivinePortalType(type: PullType): boolean {
  return type === 'divine_core' || type === 'divine_standard' || type === 'divine_resonance';
}
type PullResultData = {
  unit?: { name?: string; role?: string; element?: string; image_url?: string | null; skill_data?: Record<string, unknown> | null; skill_description?: string };
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
const pityDivineStandard = ref({
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

/** Parallax léger (fond cosmique) — désactivé sur tactile / très petits écrans pour éviter clignotements (GPU + transitions). */
const sanctuaryRootRef = ref<HTMLElement | null>(null);
const parallaxXY = ref({ x: 0, y: 0 });
const parallaxEnabled = ref(false);

function updateParallaxEnabled() {
  if (typeof window === 'undefined') return;
  parallaxEnabled.value = window.matchMedia('(pointer: fine) and (hover: hover) and (min-width: 481px)').matches;
}

let parallaxMq: MediaQueryList | null = null;
function onParallaxMediaChange() {
  updateParallaxEnabled();
}

const cosmicParallaxStyle = computed(() => {
  if (!parallaxEnabled.value) return {};
  return {
    transform: `translate3d(${parallaxXY.value.x}px, ${parallaxXY.value.y}px, 0) scale(1.08)`
  };
});

/** Léger contre-mouvement du contenu (effet parallax second plan). */
const layoutParallaxStyle = computed(() => {
  if (!parallaxEnabled.value) return {};
  return {
    transform: `translate3d(${Math.round(parallaxXY.value.x * -0.18)}px, ${Math.round(parallaxXY.value.y * -0.12)}px, 0)`
  };
});

function onSanctuaryMouseMove(e: MouseEvent) {
  if (!parallaxEnabled.value) return;
  const el = sanctuaryRootRef.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const w = Math.max(r.width, 1);
  const h = Math.max(r.height, 1);
  const nx = (e.clientX - r.left) / w - 0.5;
  const ny = (e.clientY - r.top) / h - 0.5;
  parallaxXY.value = { x: Math.round(nx * -28), y: Math.round(ny * -22) };
}

function onSanctuaryMouseLeave() {
  parallaxXY.value = { x: 0, y: 0 };
}

function sanctDustStyle(n: number) {
  const left = (n * 17.3) % 100;
  const top = (n * 31.7 + 9) % 100;
  const delay = (n % 11) * 0.28;
  const dur = 4.5 + (n % 8) * 0.6;
  return {
    left: `${left}%`,
    top: `${top}%`,
    animationDelay: `${delay}s`,
    animationDuration: `${dur}s`
  };
}

function portailEmberStyle(n: number) {
  const angle = (n * 47.2) % 360;
  const dist = 36 + (n % 5) * 9;
  const rad = (angle * Math.PI) / 180;
  const x = Math.round(Math.cos(rad) * dist);
  const y = Math.round(Math.sin(rad) * dist);
  return {
    '--ember-x': `${x}px`,
    '--ember-y': `${y}px`,
    '--ember-delay': `${(n % 8) * 0.11}s`,
    '--ember-dur': `${2.1 + (n % 4) * 0.4}s`
  };
}

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
  const teaser: Record<string, { core: string; rim: string }> = {
    common: { core: '#f8fafc', rim: '#7dd3fc' },
    uncommon: { core: '#ecfdf5', rim: '#4ade80' },
    rare: { core: '#dbeafe', rim: '#3b82f6' },
    epic: { core: '#ede9fe', rim: '#a855f7' },
    legendary: { core: '#fef9c3', rim: '#facc15' },
    mythic: { core: '#fdf4ff', rim: '#f472b6' }
  };
  const t = teaser[r] ?? teaser.common;
  return {
    '--orb-color': color,
    '--orb-core-tint': t.core,
    '--orb-rim-tint': t.rim
  };
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
function divineStandardPityAboutToTrigger(count: number): 'epic' | 'legendary' | 'mythic' | null {
  const margin = count === 10 ? 10 : 1;
  const pe = pityDivineStandard.value.pity_epic ?? 0;
  const pl = pityDivineStandard.value.pity_legendary ?? 0;
  const pm = pityDivineStandard.value.pity_mythic ?? 0;
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

const pullResultSkillDescription = computed(() => {
  const u = pullResult.value?.unit as { skill_data?: Record<string, unknown>; specialization?: string | null } | undefined;
  return getUnitSkillDisplayText(u?.skill_data ?? null, u?.specialization ?? null);
});

function getMultiRevealSkillDesc(result: PullResultData): string {
  const u = result?.unit as { skill_data?: Record<string, unknown>; specialization?: string | null } | undefined;
  return getUnitSkillDisplayText(u?.skill_data ?? null, u?.specialization ?? null);
}

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

/** Particules périphériques du noyau (couche « orbit » supplémentaire). */
function orbBurstParticleStyle(n: number) {
  const angleDeg = ((n - 1) / 14) * 360;
  const angleRad = (angleDeg * Math.PI) / 180;
  const dist = 48 + (n % 4) * 6;
  const x = Math.round(Math.cos(angleRad) * dist);
  const y = Math.round(Math.sin(angleRad) * dist);
  return {
    '--obx': `${x}px`,
    '--oby': `${y}px`,
    '--obdelay': `${(n - 1) * 0.035}s`,
    '--obdur': `${1.8 + (n % 5) * 0.12}s`
  };
}

/** Débris radial à l’explosion. */
function explosionDebrisStyle(n: number) {
  const angleDeg = ((n - 1) / 24) * 360 + (n % 7) * 3;
  const angleRad = (angleDeg * Math.PI) / 180;
  const dist = 120 + (n % 5) * 28;
  const x = Math.round(Math.cos(angleRad) * dist);
  const y = Math.round(Math.sin(angleRad) * dist);
  return {
    '--dx': `${x}px`,
    '--dy': `${y}px`,
    '--ddelay': `${(n - 1) * 0.012}s`
  };
}

async function loadWallet() {
  try {
    const { data } = await api.get('/wallet');
    wallet.value = {
      credits: data.credits ?? 0,
      cores: data.cores ?? 0,
      fragments: data.fragments ?? 0,
      ascension_essence: data.ascension_essence ?? 0,
      divine_cores: data.divine_cores ?? 0,
      divine_credits: data.divine_credits ?? 0,
      divine_fragments: data.divine_fragments ?? 0
    };
  } catch {
    wallet.value = { credits: 0, cores: 0, fragments: 0, ascension_essence: 0, divine_cores: 0, divine_credits: 0, divine_fragments: 0 };
  }
}

async function loadPity() {
  try {
    const [std, div] = await Promise.all([
      api.get('/gacha/pity', { params: { bannerKey: 'standard' } }),
      api.get('/gacha/pity', { params: { bannerKey: 'divine_standard' } })
    ]);
    pity.value = {
      total_pulls: std.data.total_pulls ?? 0,
      pity_epic: std.data.pity_epic ?? 0,
      pity_legendary: std.data.pity_legendary ?? 0,
      pity_mythic: std.data.pity_mythic ?? 0
    };
    pityDivineStandard.value = {
      total_pulls: div.data.total_pulls ?? 0,
      pity_epic: div.data.pity_epic ?? 0,
      pity_legendary: div.data.pity_legendary ?? 0,
      pity_mythic: div.data.pity_mythic ?? 0
    };
  } catch {
    pity.value = { total_pulls: 0, pity_epic: 0, pity_legendary: 0, pity_mythic: 0 };
    pityDivineStandard.value = { total_pulls: 0, pity_epic: 0, pity_legendary: 0, pity_mythic: 0 };
  }
}

function getPullCost(type: PullType, count = 1) {
  if (type === 'core') return { resource: 'cores', label: 'cores', required: 10 * count };
  if (type === 'resonance') return { resource: 'fragments', label: 'fragments', required: 100 * count };
  if (type === 'divine_core') return { resource: 'divine_cores', label: 'cores divins', required: 10 * count };
  if (type === 'divine_standard') return { resource: 'divine_credits', label: 'crédits divins', required: 100 * count };
  if (type === 'divine_resonance') return { resource: 'divine_fragments', label: 'fragments divins', required: 100 * count };
  return { resource: 'credits', label: 'credits', required: 100 * count };
}

function getWalletAmount(type: PullType) {
  if (type === 'core') return Number(wallet.value.cores ?? 0);
  if (type === 'resonance') return Number(wallet.value.fragments ?? 0);
  if (type === 'divine_core') return Number(wallet.value.divine_cores ?? 0);
  if (type === 'divine_standard') return Number(wallet.value.divine_credits ?? 0);
  if (type === 'divine_resonance') return Number(wallet.value.divine_fragments ?? 0);
  return Number(wallet.value.credits ?? 0);
}

function canInvoke(type: PullType, count = 1) {
  if (DIVINE_PORTALS_DISABLED && isDivinePortalType(type)) return false;
  const { required } = getPullCost(type, count);
  return getWalletAmount(type) >= required;
}

function getInvokeButtonLabel(type: PullType, count = 1) {
  if (DIVINE_PORTALS_DISABLED && isDivinePortalType(type)) return 'Temporairement indisponible';
  if (canInvoke(type, count)) return `Invoquer x${count}`;
  const { label, required } = getPullCost(type, count);
  return `Pas assez de ${label} (${required} requis).`;
}

/** Préfixe visuel si pas assez de monnaie (équivalent « cadenas »). */
function getInvokeIconPrefix(type: PullType, count = 1) {
  if (DIVINE_PORTALS_DISABLED && isDivinePortalType(type)) return '🔒 ';
  return canInvoke(type, count) ? '' : '🔒 ';
}

function errorMessage(err: string, required?: number): string {
  if (err === 'INSUFFICIENT_CREDITS') return `Pas assez de credits (${required ?? 100} requis).`;
  if (err === 'INSUFFICIENT_CORES') return `Pas assez de cores (${required ?? 10} requis).`;
  if (err === 'INSUFFICIENT_FRAGMENTS') return `Pas assez de fragments (${required ?? 100} requis).`;
  if (err === 'INSUFFICIENT_DIVINE_CREDITS') return `Pas assez de crédits divins (${required ?? 100} requis).`;
  if (err === 'INSUFFICIENT_DIVINE_CORES') return `Pas assez de cores divins (${required ?? 10} requis).`;
  if (err === 'INSUFFICIENT_DIVINE_FRAGMENTS') return `Pas assez de fragments divins (${required ?? 100} requis).`;
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
    ascension_essence: Number(detail.ascension_essence ?? wallet.value.ascension_essence ?? 0),
    divine_cores: Number(detail.divine_cores ?? wallet.value.divine_cores ?? 0),
    divine_credits: Number(detail.divine_credits ?? wallet.value.divine_credits ?? 0),
    divine_fragments: Number(detail.divine_fragments ?? wallet.value.divine_fragments ?? 0)
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
      }, INVOKE_DURATIONS.explosion);
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
  if (DIVINE_PORTALS_DISABLED && isDivinePortalType(type)) {
    pullError.value = 'Les portails divins sont temporairement indisponibles.';
    return;
  }
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
      if (type === 'divine_standard' && data.pity) {
        pityDivineStandard.value = {
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
  updateParallaxEnabled();
  parallaxMq = window.matchMedia('(pointer: fine) and (hover: hover) and (min-width: 481px)');
  parallaxMq.addEventListener('change', onParallaxMediaChange);
  window.addEventListener('wallet-updated', handleWalletUpdated as EventListener);
  await loadWallet();
  await loadPity();
});

onUnmounted(() => {
  if (parallaxMq) {
    parallaxMq.removeEventListener('change', onParallaxMediaChange);
    parallaxMq = null;
  }
  window.removeEventListener('wallet-updated', handleWalletUpdated as EventListener);
});
</script>

<style scoped>
/* --- Page Sanctuaire : layout cosmique premium --- */
.sanctuary-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  color: #f8fafc;
  overflow-x: hidden;
  isolation: isolate;
  animation: sanctuary-page-in 1s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes sanctuary-page-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.sanctuary-cosmic-layer {
  position: fixed;
  inset: -8%;
  z-index: 0;
  pointer-events: none;
  /* Transform par défaut quand le parallax JS est désactivé (évite scale inline + transitions conflictuelles) */
  transform: translate3d(0, 0, 0) scale(1.08);
  transform-origin: center center;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transition: transform 0.35s ease-out;
}

.sanctuary-cosmic-gradient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 100% 80% at 50% -10%, rgba(99, 102, 241, 0.35) 0%, transparent 55%),
    radial-gradient(ellipse 70% 60% at 100% 40%, rgba(139, 92, 246, 0.22) 0%, transparent 50%),
    radial-gradient(ellipse 60% 50% at 0% 80%, rgba(6, 182, 212, 0.18) 0%, transparent 45%),
    linear-gradient(165deg, #060b18 0%, #0c1228 40%, #1a0a2e 100%);
}

.sanctuary-cosmic-noise {
  position: absolute;
  inset: 0;
  opacity: 0.06;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

.sanctuary-cosmic-orbs {
  position: absolute;
  inset: 0;
}

.sanctuary-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.5;
  animation: sanctuary-orb-float 14s ease-in-out infinite;
}
.sanctuary-orb-a {
  width: min(420px, 55vw);
  height: min(420px, 55vw);
  left: 10%;
  top: 15%;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.45) 0%, transparent 70%);
  animation-delay: 0s;
}
.sanctuary-orb-b {
  width: min(360px, 45vw);
  height: min(360px, 45vw);
  right: 5%;
  top: 40%;
  background: radial-gradient(circle, rgba(167, 139, 250, 0.4) 0%, transparent 68%);
  animation-delay: -4s;
}
.sanctuary-orb-c {
  width: min(300px, 40vw);
  height: min(300px, 40vw);
  left: 35%;
  bottom: 10%;
  background: radial-gradient(circle, rgba(244, 114, 182, 0.25) 0%, transparent 65%);
  animation-delay: -7s;
}

@keyframes sanctuary-orb-float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(20px, -16px) scale(1.05);
  }
}

.sanctuary-dust {
  position: absolute;
  inset: 0;
}

.sanctuary-dust-dot {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  box-shadow: 0 0 6px rgba(200, 230, 255, 0.5);
  animation: sanctuary-dust-twinkle linear infinite;
  opacity: 0;
}

@keyframes sanctuary-dust-twinkle {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.5);
  }
  20% {
    opacity: 0.85;
  }
  50% {
    opacity: 0.35;
    transform: scale(1);
  }
}

.sanctuary-layout {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: min(1480px, calc(100% - 16px));
  margin: 0 auto;
  padding: 16px 8px 36px;
  transition: transform 0.2s ease-out;
  box-sizing: border-box;
}

/* Header glass floating */
.sanctuary-header-float {
  position: sticky;
  top: 12px;
  z-index: 5;
  margin-bottom: 18px;
  animation: sanctuary-header-in 0.75s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes sanctuary-header-in {
  from {
    opacity: 0;
    transform: translateY(-18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sanctuary-header-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 20px;
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow:
    0 4px 32px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(56, 189, 248, 0.08) inset,
    0 0 40px rgba(34, 211, 238, 0.06);
  backdrop-filter: blur(16px) saturate(1.25);
  -webkit-backdrop-filter: blur(16px) saturate(1.25);
}

.sanctuary-title-block {
  min-width: 0;
}

.sanctuary-title {
  margin: 0 0 4px;
  font-size: clamp(1.35rem, 3.5vw, 1.75rem);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: linear-gradient(105deg, #e0f2fe 0%, #a5b4fc 45%, #f0abfc 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 0 40px rgba(96, 165, 250, 0.35);
}

.sanctuary-sub {
  margin: 0;
  font-size: 0.88rem;
  color: rgba(186, 230, 253, 0.65);
  letter-spacing: 0.04em;
}

.sanctuary-wallet {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end;
}

.sanctuary-wallet-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.sanctuary-wallet-row-divine {
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.res-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 6px 10px;
  border-radius: 999px;
  font-size: 0.8rem;
  background: rgba(2, 6, 23, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
  transition:
    transform 0.2s ease,
    box-shadow 0.25s ease,
    border-color 0.2s ease;
  cursor: default;
}

.res-pill:hover {
  border-color: rgba(56, 189, 248, 0.45);
  box-shadow: 0 0 20px rgba(34, 211, 238, 0.25);
  transform: translateY(-1px);
}

.res-pill strong {
  font-variant-numeric: tabular-nums;
  color: #f1f5f9;
}

.res-ico {
  font-size: 1rem;
  line-height: 1;
}

.res-lbl {
  color: rgba(148, 163, 184, 0.95);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 520px) {
  .res-lbl {
    max-width: none;
  }
}

.res-pill-divine {
  border-color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 18px rgba(255, 255, 255, 0.06);
}

.res-pill-divine:hover {
  box-shadow: 0 0 24px rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.4);
}

.sanctuary-error {
  margin: 0 0 1rem;
  padding: 0.85rem 1rem;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.4);
  border-radius: 12px;
  color: #fecaca;
}

/* Hiérarchie : héros puis secondaires */
.sanctuary-primary-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 20px;
  align-items: start;
}

.sanctuary-section-title {
  margin: 0 0 10px;
  font-size: 0.82rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(186, 230, 253, 0.55);
  font-weight: 600;
}

.sanctuary-secondary {
  margin-bottom: 28px;
}

.sanctuary-secondary-row {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}

.sanctuary-secondary-row--triple {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.sanctuary-footer {
  text-align: center;
  padding: 16px 12px;
  font-size: 0.78rem;
  color: rgba(148, 163, 184, 0.75);
  border-top: 1px solid rgba(148, 163, 184, 0.12);
}

.sanctuary-footer p {
  margin: 0;
  max-width: 520px;
  margin-inline: auto;
  line-height: 1.45;
}

.portail-enter {
  animation: portail-stagger-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(0.06s * var(--stagger, 0));
}

@keyframes portail-stagger-in {
  from {
    opacity: 0;
    transform: translateY(22px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.portail-card-wrap {
  position: relative;
  perspective: 1400px;
  min-height: 0;
}

/* Colonne centrale : badge + effets, mêmes dimensions que les voisins */
.portail-card-wrap--featured {
  max-width: none;
  margin-inline: 0;
  position: relative;
}

@media (max-width: 900px) {
  .sanctuary-primary-row.portail-enter {
    grid-template-columns: 1fr;
  }
}

.portail-card-fx {
  position: absolute;
  inset: 0;
  border-radius: 22px;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  opacity: 0.9;
}

.portail-vortex {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 180%;
  height: 180%;
  margin-left: -90%;
  margin-top: -90%;
  background: conic-gradient(
    from 180deg,
    transparent 0deg,
    rgba(56, 189, 248, 0.12) 60deg,
    transparent 120deg,
    rgba(129, 140, 248, 0.1) 200deg,
    transparent 280deg
  );
  animation: portail-vortex-spin 18s linear infinite;
}

.portail-vortex--slow {
  animation-duration: 28s;
}

.portail-vortex--purple {
  background: conic-gradient(
    from 90deg,
    transparent 0deg,
    rgba(167, 139, 250, 0.18) 80deg,
    transparent 160deg,
    rgba(192, 132, 252, 0.12) 240deg,
    transparent 320deg
  );
}

.portail-vortex--divine {
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(255, 255, 255, 0.14) 45deg,
    transparent 100deg,
    rgba(224, 231, 255, 0.1) 200deg,
    transparent 300deg
  );
  animation-duration: 22s;
}

@keyframes portail-vortex-spin {
  to {
    transform: rotate(360deg);
  }
}

.portail-ember {
  position: absolute;
  left: 50%;
  top: 46%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  margin: -2px 0 0 -2px;
  background: rgba(125, 211, 252, 0.9);
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.8);
  animation: portail-ember-float var(--ember-dur, 2.4s) ease-in-out var(--ember-delay, 0s) infinite;
  opacity: 0;
}

.portail-ember--gold {
  background: rgba(251, 191, 36, 0.95);
  box-shadow: 0 0 14px rgba(251, 191, 36, 0.75);
}

.portail-ember--violet {
  background: rgba(216, 180, 254, 0.95);
  box-shadow: 0 0 14px rgba(192, 132, 252, 0.8);
}

.portail-ember--white {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 16px rgba(255, 255, 255, 0.65);
}

@keyframes portail-ember-float {
  0%,
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) translate(0, 0);
  }
  30% {
    opacity: 1;
  }
  70% {
    opacity: 0.85;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) translate(var(--ember-x, 0), var(--ember-y, 0));
  }
}

.portail-card {
  position: relative;
  z-index: 1;
  height: 198px;
  border-radius: 18px;
  overflow: hidden;
  background-size: cover;
  background-position: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  transition:
    transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.45s ease,
    border-color 0.3s ease;
  transform-style: preserve-3d;
  animation: portail-card-breathe 7s ease-in-out infinite;
}

@keyframes portail-card-breathe {
  0%,
  100% {
    box-shadow:
      0 12px 40px rgba(0, 0, 0, 0.45),
      0 0 32px rgba(0, 0, 0, 0.2);
  }
  50% {
    box-shadow:
      0 16px 48px rgba(0, 0, 0, 0.5),
      0 0 48px rgba(99, 102, 241, 0.12);
  }
}

.portail-card::before {
  content: '';
  position: absolute;
  inset: -40%;
  background: linear-gradient(
    125deg,
    transparent 35%,
    rgba(255, 255, 255, 0.07) 48%,
    transparent 60%
  );
  animation: portail-shine 9s ease-in-out infinite;
  pointer-events: none;
  z-index: 1;
}

@keyframes portail-shine {
  0%,
  100% {
    transform: translate(-12%, -8%) rotate(0deg);
    opacity: 0.35;
  }
  50% {
    transform: translate(8%, 6%) rotate(8deg);
    opacity: 0.6;
  }
}

.portail-card-wrap:hover .portail-card {
  transform: rotateX(3deg) rotateY(-4deg) scale(1.05) scaleZ(1);
  box-shadow:
    0 22px 56px rgba(0, 0, 0, 0.55),
    0 0 64px rgba(56, 189, 248, 0.18);
}

.portail-card-wrap:hover .portail-ember {
  animation-duration: calc(var(--ember-dur, 2.4s) * 0.72);
}

.portail-card--standard {
  --portail-accent: #3b82f6;
  --portail-glow: rgba(59, 130, 246, 0.45);
  background-image:
    linear-gradient(180deg, rgba(37, 99, 235, 0.38), rgba(15, 23, 42, 0.88)),
    url('/images/Fond.png');
}
.portail-card--noyau {
  --portail-accent: #eab308;
  --portail-glow: rgba(234, 179, 8, 0.45);
  background-image:
    linear-gradient(180deg, rgba(180, 130, 20, 0.4), rgba(55, 40, 8, 0.9)),
    url('/images/Fond.png');
}
.portail-card--resonance {
  --portail-accent: #a855f7;
  --portail-glow: rgba(168, 85, 247, 0.5);
  background-image:
    linear-gradient(180deg, rgba(109, 40, 217, 0.42), rgba(30, 10, 55, 0.91)),
    url('/images/Fond.png');
}

.portail-card--divine {
  border-color: rgba(255, 255, 255, 0.28);
  box-shadow:
    0 12px 44px rgba(0, 0, 0, 0.5),
    0 0 40px rgba(255, 255, 255, 0.08);
}

.portail-card--divine.portail-card--standard {
  background-image:
    linear-gradient(180deg, rgba(59, 130, 246, 0.25), rgba(15, 23, 42, 0.9)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, transparent 50%),
    url('/images/Fond.png');
}

.portail-badge-hero {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 3;
  padding: 4px 12px;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.65);
  border: 1px solid rgba(56, 189, 248, 0.45);
  color: #bae6fd;
  box-shadow: 0 0 20px rgba(34, 211, 238, 0.25);
}

.portail-overlay {
  position: absolute;
  z-index: 2;
  bottom: 0;
  width: 100%;
  padding: 10px 10px 12px;
  background: linear-gradient(to top, rgba(2, 6, 23, 0.94) 0%, rgba(2, 6, 23, 0.45) 55%, transparent 100%);
  text-align: center;
}

.portail-title {
  font-size: 0.98rem;
  margin: 0 0 4px;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.6);
}

.cost {
  margin: 2px 0 4px;
  opacity: 0.88;
  font-size: 0.78rem;
}

.pool {
  margin: 0 0 6px;
  font-size: 0.72rem;
  line-height: 1.3;
  opacity: 0.82;
}

.pool--full {
  font-size: 0.62rem;
  line-height: 1.28;
  margin-bottom: 6px;
  opacity: 0.88;
  hyphens: auto;
  word-break: break-word;
}

.pool-hint {
  display: inline-block;
  margin-left: 4px;
  opacity: 0.55;
  font-size: 0.62rem;
  vertical-align: super;
}

.pity-inline {
  font-size: 0.65rem;
  color: #94a3cb;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 4px 0 0;
}

.pity-inline--on-card {
  padding: 0 0 6px;
  margin: 0;
  font-size: 0.68rem;
  color: #c7d2fe;
  font-weight: 600;
}

.pity-inline--secondary {
  margin-top: 4px;
  opacity: 0.85;
}

.pity-inline span {
  white-space: nowrap;
}

.invoke-actions {
  display: grid;
  gap: 6px;
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
  position: relative;
  overflow: hidden;
  padding: 7px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: linear-gradient(115deg, #2563eb 0%, #06b6d4 50%, #6366f1 100%);
  background-size: 200% 100%;
  color: white;
  font-weight: 800;
  cursor: pointer;
  transition:
    transform 0.25s ease,
    box-shadow 0.3s ease,
    background-position 0.45s ease,
    filter 0.3s ease,
    border-color 0.2s ease;
  white-space: normal;
  line-height: 1.25;
  min-height: 36px;
  box-shadow:
    0 0 22px rgba(37, 99, 235, 0.35),
    0 4px 16px rgba(0, 0, 0, 0.35);
  animation: invoke-btn-idle-glow 3.5s ease-in-out infinite;
}

.invoke-btn-gloss {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 0%,
    rgba(255, 255, 255, 0.22) 45%,
    transparent 55%
  );
  transform: translateX(-100%);
  animation: invoke-btn-shine 2.8s ease-in-out infinite;
  pointer-events: none;
}

@keyframes invoke-btn-shine {
  0% {
    transform: translateX(-120%);
  }
  45% {
    transform: translateX(120%);
  }
  100% {
    transform: translateX(120%);
  }
}

@keyframes invoke-btn-idle-glow {
  0%,
  100% {
    box-shadow:
      0 0 22px rgba(37, 99, 235, 0.35),
      0 4px 16px rgba(0, 0, 0, 0.35);
  }
  50% {
    box-shadow:
      0 0 32px rgba(34, 211, 238, 0.45),
      0 6px 20px rgba(0, 0, 0, 0.4);
  }
}

.invoke-btn:hover:enabled {
  background-position: 100% 0;
  transform: scale(1.04) translateY(-1px);
  border-color: rgba(255, 255, 255, 0.38);
}

.invoke-btn-wrap:not(.pity-trigger) .invoke-btn {
  /* thème par défaut (standard / héros) */
}

.portail-btn--noyau:not(.invoke-btn-pity) {
  background: linear-gradient(115deg, #b45309 0%, #eab308 45%, #f59e0b 100%);
  box-shadow: 0 0 22px rgba(234, 179, 8, 0.4);
  animation-name: invoke-btn-idle-gold;
}

@keyframes invoke-btn-idle-gold {
  0%,
  100% {
    box-shadow: 0 0 22px rgba(234, 179, 8, 0.38);
  }
  50% {
    box-shadow: 0 0 34px rgba(253, 224, 71, 0.45);
  }
}

.portail-btn--resonance:not(.invoke-btn-pity) {
  background: linear-gradient(115deg, #7c3aed 0%, #a855f7 45%, #c084fc 100%);
  box-shadow: 0 0 22px rgba(168, 85, 247, 0.4);
  animation-name: invoke-btn-idle-violet;
}

@keyframes invoke-btn-idle-violet {
  0%,
  100% {
    box-shadow: 0 0 22px rgba(168, 85, 247, 0.38);
  }
  50% {
    box-shadow: 0 0 36px rgba(192, 132, 252, 0.5);
  }
}

.portail-btn--divine:not(.invoke-btn-pity) {
  background: linear-gradient(115deg, #e2e8f0 0%, #f8fafc 40%, #93c5fd 100%);
  color: #0f172a;
  border-color: rgba(255, 255, 255, 0.55);
  box-shadow: 0 0 26px rgba(255, 255, 255, 0.28);
  animation-name: invoke-btn-idle-divine;
}

.portail-btn--divine:not(.invoke-btn-pity) .invoke-btn-gloss {
  background: linear-gradient(
    105deg,
    transparent 0%,
    rgba(255, 255, 255, 0.55) 45%,
    transparent 55%
  );
}

@keyframes invoke-btn-idle-divine {
  0%,
  100% {
    box-shadow: 0 0 24px rgba(255, 255, 255, 0.22);
  }
  50% {
    box-shadow: 0 0 36px rgba(255, 255, 255, 0.35);
  }
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

.invoke-btn-multi:not(.invoke-btn-pity):not(.portail-btn--noyau):not(.portail-btn--resonance):not(.portail-btn--divine) {
  background: linear-gradient(115deg, #7c3aed 0%, #db2777 50%, #ec4899 100%);
  background-size: 200% 100%;
}

.invoke-btn:disabled {
  opacity: 0.52;
  cursor: not-allowed;
  filter: grayscale(0.35) brightness(0.92);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: none;
  box-shadow: none;
  border-color: rgba(148, 163, 184, 0.25);
}

.invoke-btn:disabled .invoke-btn-gloss {
  animation: none;
  opacity: 0;
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
  background: rgba(0, 0, 0, 0.52);
  transition:
    background 0.55s cubic-bezier(0.4, 0, 0.2, 1),
    backdrop-filter 0.55s ease;
}

.overlay-backdrop.backdrop-invoke-pulse {
  background: rgba(0, 0, 0, 0.6);
}

.overlay-backdrop.backdrop-reveal-focus {
  background: rgba(2, 6, 23, 0.82);
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
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
  0% { transform: scale(1); }
  100% { transform: scale(1.02); }
}

@keyframes camera-zoom-pulse {
  0%, 100% { transform: scale(1.02); }
  50% { transform: scale(1.035); }
}

@keyframes camera-reset {
  0% { transform: scale(1.035); }
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

/* ---- 3–4) Noyau d’invocation (multi-couches + charge + teaser rareté) ---- */
.rarity-orb.orb-premium {
  position: absolute;
  width: 112px;
  height: 112px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  --orb-color: #78716c;
  --orb-core-tint: #f8fafc;
  --orb-rim-tint: #7dd3fc;
}

.rarity-orb.orb-invoke-core {
  transform-origin: center center;
  animation: orb-spawn-scale 0.58s cubic-bezier(0.28, 1.15, 0.48, 1) both;
}

.rarity-orb.orb-just-spawned {
  filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.35));
}

.rarity-orb.orb-charge-phase .orb-outer-glow {
  animation: orb-intensity-charge 1.15s ease-in-out infinite;
  opacity: 0.65;
}

.rarity-orb.orb-charge-phase .orb-inner-glow {
  animation: orb-intensity-charge 0.9s ease-in-out infinite;
  opacity: 0.85;
}

.rarity-orb.orb-charge-phase .orb-particle {
  animation-duration: 1.05s;
}

.rarity-orb.orb-charge-phase .orb-ring-1 {
  animation-duration: 2.2s;
}

.rarity-orb.orb-charge-phase .orb-ring-2 {
  animation-duration: 1.65s;
}

.rarity-orb.orb-charge-phase .orb-ring-3 {
  animation-duration: 2.8s;
}

/* Tremblement / tension sur tout le noyau (sans écraser le spawn initial). */
.rarity-orb.orb-invoke-core.orb-charge-phase {
  animation: orb-charge-wobble 0.13s ease-in-out infinite;
}

@keyframes orb-charge-wobble {
  0%,
  100% {
    transform: scale(1) translate(0, 0);
  }
  25% {
    transform: scale(1.035) translate(-5px, 1px);
  }
  75% {
    transform: scale(1.035) translate(5px, -1px);
  }
}

.rarity-orb.rarity-mythic.orb-charge-phase .orb-core {
  animation:
    orb-pulse 0.85s ease-in-out infinite,
    mythic-core-hue 2.4s ease-in-out infinite;
}

@keyframes orb-spawn-scale {
  0% {
    transform: scale(0);
    opacity: 0;
    filter: brightness(2) blur(6px);
  }
  55% {
    opacity: 1;
    filter: brightness(1.25) blur(0);
  }
  100% {
    transform: scale(1);
    opacity: 1;
    filter: brightness(1) blur(0);
  }
}

@keyframes orb-intensity-charge {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.12);
  }
}

@keyframes mythic-core-hue {
  0% {
    filter: hue-rotate(0deg) saturate(1.35) brightness(1.05);
  }
  33% {
    filter: hue-rotate(100deg) saturate(1.5) brightness(1.12);
  }
  66% {
    filter: hue-rotate(220deg) saturate(1.4) brightness(1.08);
  }
  100% {
    filter: hue-rotate(360deg) saturate(1.35) brightness(1.05);
  }
}

.orb-magic-circle {
  position: absolute;
  width: 118%;
  height: 118%;
  border-radius: 50%;
  border: 1px dashed rgba(255, 255, 255, 0.28);
  box-shadow:
    inset 0 0 22px rgba(255, 255, 255, 0.06),
    0 0 18px rgba(34, 211, 238, 0.12);
  animation: orb-magic-drift 14s linear infinite;
  pointer-events: none;
}

@keyframes orb-magic-drift {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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

.orb-ring-3 {
  width: 98px;
  height: 98px;
  border-width: 1px;
  opacity: 0.35;
  border-style: dashed;
  animation: orb-ring-rotate 5.5s linear infinite;
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.15);
}

.orb-core {
  position: relative;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 35% 35%,
    var(--orb-core-tint, #fff) 0%,
    var(--orb-rim-tint, #bae6fd) 38%,
    var(--orb-color) 72%,
    rgba(0, 0, 0, 0.35) 100%
  );
  box-shadow:
    0 0 28px var(--orb-color),
    0 0 48px color-mix(in srgb, var(--orb-color) 45%, transparent),
    inset 0 0 22px rgba(255, 255, 255, 0.45),
    inset -6px -6px 16px rgba(0, 0, 0, 0.25);
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

.orb-energy-rings {
  position: absolute;
  inset: -30%;
  pointer-events: none;
}

.orb-energy-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 70px;
  height: 70px;
  margin-left: -35px;
  margin-top: -35px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--orb-color) 55%, white);
  opacity: 0;
  animation: orb-energy-expand 1.65s ease-out var(--energy-ring-delay, 0s) infinite;
  box-shadow: 0 0 14px color-mix(in srgb, var(--orb-color) 40%, transparent);
}

@keyframes orb-energy-expand {
  0% {
    transform: scale(0.4);
    opacity: 0.85;
  }
  70% {
    opacity: 0.25;
  }
  100% {
    transform: scale(2.6);
    opacity: 0;
  }
}

.orb-burst-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.orb-burst-particle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, var(--orb-color) 100%);
  box-shadow: 0 0 10px var(--orb-color);
  animation: orb-burst-orbit var(--obdur, 2s) linear var(--obdelay, 0s) infinite;
  transform: translate(-50%, -50%) translate(var(--obx), var(--oby));
  opacity: 0.92;
}

@keyframes orb-burst-orbit {
  from {
    transform: translate(-50%, -50%) rotate(0deg) translate(var(--obx), var(--oby)) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg) translate(var(--obx), var(--oby)) rotate(-360deg);
  }
}

.rarity-orb.orb-charge-phase .orb-burst-particle {
  animation-duration: calc(var(--obdur, 2s) * 0.55);
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

.rarity-orb.orb-charge-phase .orb-core {
  animation: orb-pulse-charge 0.72s ease-in-out infinite;
}

@keyframes orb-pulse-charge {
  0%,
  100% {
    transform: scale(1);
    box-shadow:
      0 0 28px var(--orb-color),
      0 0 52px color-mix(in srgb, var(--orb-color) 50%, transparent),
      inset 0 0 22px rgba(255, 255, 255, 0.45);
  }
  50% {
    transform: scale(1.1);
    box-shadow:
      0 0 40px var(--orb-color),
      0 0 70px color-mix(in srgb, var(--orb-color) 65%, transparent),
      inset 0 0 26px rgba(255, 255, 255, 0.55);
  }
}

/* ---- 5) Explosion : flash blanc bref + onde rareté + débris ---- */
.explosion-white-flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  background: #fff;
  animation: explosion-white-pop 0.12s ease-out forwards;
}

@keyframes explosion-white-pop {
  0% {
    opacity: 0;
  }
  35% {
    opacity: 0.95;
  }
  100% {
    opacity: 0;
  }
}

.explosion-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.explosion-debris {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--explosion-color, #fff);
  box-shadow: 0 0 12px var(--explosion-color, #fff);
  opacity: 0;
  transform: translate(-50%, -50%);
  animation: explosion-debris-fly 0.52s cubic-bezier(0.18, 0.85, 0.35, 1) var(--ddelay, 0s) forwards;
}

@keyframes explosion-debris-fly {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--dx, 0px)), calc(-50% + var(--dy, 0px))) scale(0.25);
  }
}

.explosion-particles.rarity-common {
  --explosion-color: #e2e8f0;
}
.explosion-particles.rarity-uncommon {
  --explosion-color: #4ade80;
}
.explosion-particles.rarity-rare {
  --explosion-color: #60a5fa;
}
.explosion-particles.rarity-epic {
  --explosion-color: #c084fc;
}
.explosion-particles.rarity-legendary {
  --explosion-color: #facc15;
}
.explosion-particles.rarity-mythic {
  --explosion-color: #fb7185;
}

.explosion-flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.55) 0%,
    var(--explosion-color, rgba(255, 255, 255, 0.4)) 28%,
    transparent 62%
  );
  animation: explosion-flash 0.48s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  z-index: 2;
}

.explosion-flash.rarity-common { --explosion-color: rgba(120, 113, 108, 0.5); }
.explosion-flash.rarity-uncommon { --explosion-color: rgba(34, 197, 94, 0.5); }
.explosion-flash.rarity-rare { --explosion-color: rgba(59, 130, 246, 0.5); }
.explosion-flash.rarity-epic { --explosion-color: rgba(168, 85, 247, 0.5); }
.explosion-flash.rarity-legendary { --explosion-color: rgba(234, 179, 8, 0.6); }
.explosion-flash.rarity-mythic { --explosion-color: rgba(220, 38, 38, 0.6); }

@keyframes explosion-flash {
  0% {
    opacity: 0;
    transform: scale(0.65);
  }
  18% {
    opacity: 1;
    transform: scale(1.08);
  }
  100% {
    opacity: 0;
    transform: scale(1.65);
  }
}

/* ---- 6) Révélation carte premium (unit-reveal-card) ---- */
.reveal-modal-stage {
  width: 100%;
  max-width: 420px;
  padding: 12px;
  animation: reveal-stage-fade 0.45s ease-out both;
}

@keyframes reveal-stage-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.unit-reveal .reveal-card.unit-reveal-card {
  position: relative;
  animation: unit-reveal-slide-up 0.72s cubic-bezier(0.31, 1.24, 0.34, 1.02) forwards;
  box-shadow:
    0 0 55px var(--reveal-glow, rgba(255, 255, 255, 0.2)),
    0 22px 48px rgba(0, 0, 0, 0.45);
  border-width: 2px;
  overflow: hidden;
}

.reveal-card-living::before {
  content: '';
  position: absolute;
  inset: -40%;
  background: conic-gradient(
    from 220deg,
    color-mix(in srgb, var(--reveal-glow) 35%, transparent),
    transparent 35%,
    color-mix(in srgb, var(--reveal-glow) 25%, transparent),
    transparent 70%
  );
  opacity: 0.35;
  animation: reveal-living-rotate 10s linear infinite;
  pointer-events: none;
  z-index: 0;
}

.reveal-card-living > * {
  position: relative;
  z-index: 1;
}

@keyframes reveal-living-rotate {
  to {
    transform: rotate(360deg);
  }
}

.reveal-card-living {
  animation:
    unit-reveal-slide-up 0.72s cubic-bezier(0.31, 1.24, 0.34, 1.02) forwards,
    reveal-card-breathe 3.2s ease-in-out 0.75s infinite;
}

@keyframes reveal-card-breathe {
  0%,
  100% {
    box-shadow:
      0 0 48px var(--reveal-glow, rgba(255, 255, 255, 0.2)),
      0 20px 40px rgba(0, 0, 0, 0.4);
  }
  50% {
    box-shadow:
      0 0 72px color-mix(in srgb, var(--reveal-glow) 80%, white),
      0 24px 52px rgba(0, 0, 0, 0.5);
  }
}

.unit-reveal-card.reveal-card-premium {
  box-shadow:
    0 0 70px var(--reveal-glow),
    0 0 110px rgba(255, 255, 255, 0.12),
    0 28px 56px rgba(0, 0, 0, 0.55);
  animation:
    unit-reveal-slide-up 0.92s cubic-bezier(0.28, 1.1, 0.32, 1) forwards,
    reveal-card-breathe 3.8s ease-in-out 0.85s infinite;
}

@keyframes unit-reveal-slide-up {
  0% {
    transform: translateY(48px) scale(0.8);
    opacity: 0;
    filter: blur(4px);
  }
  55% {
    filter: blur(0);
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
    filter: blur(0);
  }
}

.unit-reveal-portrait {
  position: relative;
  width: 118px;
  height: 118px;
  margin: 0 auto 0.75rem;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid color-mix(in srgb, var(--reveal-glow) 75%, white);
  box-shadow:
    0 0 28px var(--reveal-glow),
    0 0 56px color-mix(in srgb, var(--reveal-glow) 55%, transparent),
    inset 0 0 20px rgba(255, 255, 255, 0.08);
  animation: portrait-reveal-pop 0.72s cubic-bezier(0.34, 1.4, 0.48, 1) both;
}

@keyframes portrait-reveal-pop {
  0% {
    transform: scale(0.85);
    box-shadow: 0 0 0 transparent;
  }
  100% {
    transform: scale(1);
  }
}

.unit-reveal-portrait-bg {
  position: absolute;
  inset: -22%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--reveal-glow) 0%, transparent 68%);
  opacity: 0.55;
  pointer-events: none;
  animation: portrait-halo-pulse 2.8s ease-in-out infinite;
  filter: blur(4px);
}

@keyframes portrait-halo-pulse {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(1);
  }
  50% {
    opacity: 0.75;
    transform: scale(1.06);
  }
}

.reveal-tier-legendary .unit-reveal-portrait::after,
.reveal-tier-mythic .unit-reveal-portrait::after {
  content: '';
  position: absolute;
  inset: -50%;
  background: repeating-conic-gradient(
    from 0deg,
    transparent 0deg 8deg,
    rgba(255, 255, 255, 0.06) 8deg 9deg
  );
  animation: legendary-ray-spin 5s linear infinite;
  pointer-events: none;
  z-index: 2;
  mix-blend-mode: screen;
}

.reveal-tier-mythic .unit-reveal-portrait::after {
  animation-duration: 3.2s;
  opacity: 0.95;
}

.reveal-tier-epic .reveal-card-living::before {
  opacity: 0.42;
  animation-duration: 8s;
}

.reveal-tier-uncommon .reveal-card-living::before {
  opacity: 0.22;
}

.reveal-tier-mythic .reveal-card-living::before {
  opacity: 0.5;
  animation-duration: 5s;
  background: conic-gradient(
    from 120deg,
    rgba(251, 113, 133, 0.35),
    transparent 30%,
    rgba(125, 211, 252, 0.3),
    transparent 65%,
    rgba(192, 132, 252, 0.35),
    transparent 100%
  );
}

@keyframes legendary-ray-spin {
  to {
    transform: rotate(360deg);
  }
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

.reveal-skill-desc {
  font-size: 0.85rem;
  color: #a5b4fc;
  margin: 0.4rem 0;
  line-height: 1.35;
  font-style: italic;
  max-width: 280px;
  margin-left: auto;
  margin-right: auto;
  white-space: pre-line;
}
.reveal-skill-desc {
  font-size: 0.82rem;
  color: #a5b4c8;
  margin: 0.4rem 0;
  line-height: 1.35;
  font-style: italic;
  max-width: 100%;
}

.reveal-skill-desc {
  font-size: 0.85rem;
  color: #a5b4fc;
  margin: 0.35rem 0;
  line-height: 1.35;
  font-style: italic;
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
    transform: scale(0.35) translateY(8px);
    filter: brightness(0.35);
  }
  55% {
    opacity: 1;
    transform: scale(1.28) translateY(-3px);
    filter: brightness(1.55);
  }
  75% {
    transform: scale(0.94) translateY(1px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: brightness(1);
  }
}

@keyframes star-burst-last {
  0% {
    opacity: 0;
    transform: scale(0.28) translateY(10px) rotate(-12deg);
    filter: brightness(0.25);
  }
  42% {
    opacity: 1;
    transform: scale(1.42) translateY(-5px) rotate(6deg);
    filter: brightness(1.9);
  }
  70% {
    transform: scale(0.92) translateY(2px) rotate(-3deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0) rotate(0);
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

/* x10 : ne pas hériter du max-width 420px de .reveal-modal-stage (révélation simple) */
.multi-reveal-wrap.reveal-modal-stage {
  max-width: min(100vw - 16px, 1680px);
  width: 100%;
  padding: 8px 10px;
  box-sizing: border-box;
}

.multi-reveal-wrap {
  width: min(100vw - 16px, 1680px);
}

.multi-reveal-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 20px clamp(12px, 2vw, 28px);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.96));
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 0 45px rgba(59, 130, 246, 0.18);
  box-sizing: border-box;
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
  gap: clamp(10px, 1.2vw, 20px);
  margin-bottom: 20px;
  width: 100%;
  min-width: 0;
}

/* Bouton Fermer : centré en bas du panneau (invocation x10) */
.multi-reveal-panel > .btn-close-reveal {
  display: block;
  margin-inline: auto;
  margin-top: 1rem;
  margin-bottom: 0;
}

.multi-reveal-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  padding: 14px clamp(8px, 1vw, 14px);
  text-align: center;
  background: rgba(15, 23, 42, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.14);
  animation: multi-card-in 0.52s cubic-bezier(0.28, 1.02, 0.36, 1) both;
  animation-delay: calc(var(--multi-reveal-i, 0) * 0.065s);
}

.multi-reveal-card .rarity-badge {
  max-width: 100%;
  margin-bottom: 0.35rem;
  font-size: clamp(0.65rem, 1.1vw, 0.8rem);
  padding: 0.2rem 0.45rem;
  line-height: 1.2;
  word-break: break-word;
}

.multi-reveal-portrait {
  width: clamp(64px, 8vw, 96px);
  height: clamp(64px, 8vw, 96px);
  margin: 0 auto 10px;
  flex-shrink: 0;
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
  width: 100%;
  min-height: 2.4em;
  margin-bottom: 8px;
  font-size: clamp(0.72rem, 1.15vw, 0.95rem);
  line-height: 1.25;
  word-break: break-word;
  hyphens: auto;
}

.multi-reveal-stars {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1px 3px;
  margin-bottom: 6px;
  font-size: clamp(0.65rem, 1vw, 0.85rem);
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

.multi-reveal-card .multi-reveal-skill-desc {
  font-size: clamp(0.62rem, 0.95vw, 0.75rem);
  color: #a5b4fc;
  margin-top: 6px;
  line-height: 1.3;
  font-style: italic;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

@keyframes multi-card-in {
  0% {
    opacity: 0;
    transform: translateY(22px) scale(0.92);
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

.rarity-badge-pill {
  position: relative;
  overflow: hidden;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: 0 0 18px rgba(0, 0, 0, 0.35);
  animation: rarity-badge-pop 0.55s cubic-bezier(0.34, 1.35, 0.64, 1) 0.55s both;
}

.rarity-badge-pill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(255, 255, 255, 0.35) 50%,
    transparent 60%
  );
  transform: translateX(-120%);
  animation: rarity-badge-shimmer 2.8s ease-in-out 1s infinite;
  pointer-events: none;
}

@keyframes rarity-badge-pop {
  0% {
    opacity: 0;
    transform: scale(0.82);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes rarity-badge-shimmer {
  0% {
    transform: translateX(-120%);
  }
  35% {
    transform: translateX(120%);
  }
  100% {
    transform: translateX(120%);
  }
}

.rarity-badge.rarity-common {
  background: linear-gradient(135deg, #78716c, #57534e);
  color: #fff;
  box-shadow: 0 0 14px rgba(120, 113, 108, 0.45);
}
.rarity-badge.rarity-uncommon {
  background: linear-gradient(135deg, #22c55e, #15803d);
  color: #fff;
  box-shadow: 0 0 16px rgba(34, 197, 94, 0.5);
}
.rarity-badge.rarity-rare {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: #fff;
  box-shadow: 0 0 18px rgba(59, 130, 246, 0.55);
}
.rarity-badge.rarity-epic {
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  color: #fff;
  box-shadow: 0 0 20px rgba(168, 85, 247, 0.6);
}
.rarity-badge.rarity-legendary {
  background: linear-gradient(135deg, #facc15, #ca8a04);
  color: #1f2937;
  box-shadow: 0 0 22px rgba(234, 179, 8, 0.65);
}
.rarity-badge.rarity-mythic {
  background: linear-gradient(135deg, #f87171, #dc2626, #be123c);
  color: #fff;
  box-shadow: 0 0 24px rgba(220, 38, 38, 0.65), 0 0 40px rgba(244, 114, 182, 0.35);
}

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
  transition:
    transform 0.2s ease,
    box-shadow 0.25s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    opacity 0.35s ease;
}

.btn-close-reveal:not(:disabled):hover {
  transform: translateY(-3px);
  border-color: rgba(56, 189, 248, 0.65);
  background: rgba(56, 189, 248, 0.18);
  box-shadow:
    0 0 22px rgba(34, 211, 238, 0.35),
    0 10px 24px rgba(0, 0, 0, 0.35);
}

.btn-close-reveal:not(:disabled):active {
  transform: translateY(0);
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

@media (max-width: 900px) {
  .sanctuary-secondary-row--triple {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .sanctuary-layout {
    padding: 12px 8px 32px;
    max-width: 100%;
  }
  .sanctuary-header-inner {
    flex-direction: column;
    align-items: stretch;
  }
  .sanctuary-wallet {
    align-items: stretch;
  }
  .sanctuary-wallet-row {
    justify-content: center;
  }
  .sanctuary-secondary-row--triple {
    grid-template-columns: 1fr;
  }
  .multi-reveal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
}

/* Très petits écrans / tactile : stabiliser le fond et les cartes (évite clignotements GPU) */
@media (max-width: 480px), (pointer: coarse) {
  .sanctuary-cosmic-layer {
    inset: -4%;
    transform: translate3d(0, 0, 0) scale(1.04) !important;
    transition: none !important;
    backface-visibility: hidden;
  }

  .sanctuary-layout {
    transition: none !important;
  }

  .sanctuary-orb {
    animation: none;
    filter: blur(28px);
  }

  .sanctuary-dust-dot {
    animation: none !important;
    opacity: 0 !important;
  }

  .portail-card {
    animation: none;
    contain: layout paint;
    -webkit-font-smoothing: antialiased;
  }

  .portail-card::before {
    animation: none;
    opacity: 0.38;
  }

  .portail-vortex {
    animation: none !important;
  }

  .portail-ember {
    animation: none !important;
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sanctuary-cosmic-layer {
    transform: translate3d(0, 0, 0) scale(1.04) !important;
    transition: none !important;
  }

  .sanctuary-layout {
    transition: none !important;
  }

  .sanctuary-orb,
  .sanctuary-dust-dot,
  .portail-card,
  .portail-card::before,
  .portail-vortex,
  .portail-ember {
    animation: none !important;
  }
}

@media (max-width: 640px) {
  .multi-reveal-wrap.reveal-modal-stage {
    max-width: calc(100vw - 12px);
    padding: 6px 6px;
  }

  .multi-reveal-panel {
    padding: 14px 10px;
  }

  .multi-reveal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
}
</style>
