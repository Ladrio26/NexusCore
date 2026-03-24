<template>
  <Teleport to="body">
    <Transition name="tut-root-fade">
      <div v-if="tutorialVisible" class="tut-root" @click.stop>

        <!-- Overlay SVG avec trou spotlight -->
        <svg class="tut-bg-svg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id="tut-hole-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                v-if="spot"
                :x="spot.x"
                :y="spot.y"
                :width="spot.w"
                :height="spot.h"
                rx="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0" y="0" width="100%" height="100%"
            fill="rgba(2, 6, 23, 0.82)"
            mask="url(#tut-hole-mask)"
          />
        </svg>

        <!-- Anneau lumineux autour du spotlight -->
        <Transition name="tut-spot-anim">
          <div
            v-if="spot"
            key="glow"
            class="tut-spotlight-ring"
            :style="{
              left: spot.x + 'px',
              top: spot.y + 'px',
              width: spot.w + 'px',
              height: spot.h + 'px',
            }"
          />
        </Transition>

        <!-- Flèche pointant vers le spotlight -->
        <Transition name="tut-arrow-anim">
          <div
            v-if="spot && arrowStyle"
            class="tut-arrow"
            :class="arrowDirection"
            :style="arrowStyle"
          />
        </Transition>

        <!-- Carte principale -->
        <Transition name="tut-card-anim" mode="out-in">
          <div
            :key="stepIndex"
            class="tut-card"
            :style="cardStyle"
          >
            <!-- Barre de progression -->
            <div class="tut-card-progress">
              <span
                v-for="(_, i) in STEPS"
                :key="i"
                class="tut-dot"
                :class="{
                  'tut-dot--active': i === stepIndex,
                  'tut-dot--done': i < stepIndex,
                }"
              />
            </div>

            <!-- Contenu -->
            <h3 class="tut-card-title">{{ STEPS[stepIndex].title }}</h3>
            <p class="tut-card-text">{{ STEPS[stepIndex].message }}</p>

            <!-- Actions -->
            <div class="tut-card-actions">
              <button class="tut-btn-skip" @click="skip">Passer</button>
              <div class="tut-btn-group">
                <button
                  v-if="stepIndex > 0"
                  class="tut-btn-prev"
                  @click="goPrev"
                >← Retour</button>
                <button class="tut-btn-next" @click="goNext">
                  {{ stepIndex >= STEPS.length - 1 ? '🎉 C\'est parti !' : 'Suivant →' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>

      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { tutorialVisible, closeTutorial } from '../composables/useTutorial';

const router = useRouter();

interface Step {
  title: string;
  message: string;
  target: string | null;
  route: string | null;
  padding: number;
  needsCombatsMenu?: boolean;
  needsSidebar?: boolean;
}

const STEPS: Step[] = [
  {
    title: '🎮 Bienvenue dans Nexus Core Arena !',
    message: 'Ce guide rapide va te montrer comment démarrer. Suis les étapes et clique sur "Suivant" — on t\'explique tout !',
    target: null,
    route: null,
    padding: 0,
  },
  {
    title: '🏛️ Commence au Sanctuaire',
    message: 'Pour avoir des unités avec lesquelles combattre, tu dois les invoquer. Repère le lien "Sanctuaire" dans le menu de gauche — c\'est par là que tout commence !',
    target: 'a.menu-item[href="/sanctuary"]',
    route: '/sanctuary',
    padding: 8,
    needsSidebar: true,
  },
  {
    title: '💰 Le Portail Standard',
    message: 'Ce portail utilise des Crédits. Tu peux y obtenir des unités du rang Commun jusqu\'au Mythique. Tu en as reçu à ta connexion quotidienne — utilise-les !',
    target: '.portail-card.standard',
    route: '/sanctuary',
    padding: 14,
  },
  {
    title: '✨ Lance ton invocation !',
    message: 'Clique sur "Invoquer ×1" pour une unité, ou "×10" pour dix d\'un coup. Il y a aussi le Portail Noyau (Cores) et le Portail Résonance (Fragments) pour varier.',
    target: '.portail-card.standard .invoke-actions',
    route: '/sanctuary',
    padding: 10,
  },
  {
    title: '📦 Ta Collection',
    message: 'Toutes tes unités invoquées apparaissent dans "Ma Collection". Tu peux voir leurs statistiques (PV, ATQ, DEF, Vitesse), leurs compétences et leur niveau.',
    target: 'a.menu-item[href="/collection"]',
    route: null,
    padding: 8,
    needsSidebar: true,
  },
  {
    title: '⚡ Compose ton équipe',
    message: 'Avant de combattre, crée une équipe dans "Mes Équipes". Place tes unités en première ligne (CAC, au contact) ou en arrière (Distance, à portée).',
    target: 'a.menu-item[href="/team-builder"]',
    route: null,
    padding: 8,
    needsSidebar: true,
  },
  {
    title: '⚔️ Le menu Combats',
    message: 'Ce menu donne accès aux deux modes de jeu : la Campagne (mode histoire) et le PvP (affrontements contre d\'autres joueurs). Développons ça.',
    target: 'button.menu-item-trigger',
    route: null,
    padding: 8,
    needsCombatsMenu: true,
    needsSidebar: true,
  },
  {
    title: '🗺️ La Campagne',
    message: '10 chapitres avec des ennemis progressifs. Chaque victoire rapporte des Crédits, Cores et Fragments. Le mode Difficile se débloque après le Boss du chapitre 5 !',
    target: 'a.menu-subitem[href="/campaign"]',
    route: null,
    padding: 8,
    needsCombatsMenu: true,
    needsSidebar: true,
  },
  {
    title: '🏆 Le PvP',
    message: 'Affronte d\'autres joueurs ou des PNJ pour grimper dans le classement Elo. En atteignant des paliers (Argent, Or, Platine…), tu gagnes des récompenses exclusives !',
    target: 'a.menu-subitem[href="/pvp"]',
    route: null,
    padding: 8,
    needsCombatsMenu: true,
    needsSidebar: true,
  },
  {
    title: '🎉 Tu es prêt à jouer !',
    message: 'Commence par invoquer au Sanctuaire, monte une équipe, et pars à l\'aventure ! Pour tout savoir sur les mécaniques du jeu, consulte la FAQ dans le menu.',
    target: null,
    route: null,
    padding: 0,
  },
];

interface Spot { x: number; y: number; w: number; h: number; }

const stepIndex = ref(0);
const spot = ref<Spot | null>(null);
const winW = ref(window.innerWidth);
const winH = ref(window.innerHeight);
const CARD_W = 340;
const CARD_W_MOBILE = 320;
const CARD_H_EST = 250;
const GAP = 22;
const MOBILE_BREAKPOINT = 768;

const isMobile = computed(() => winW.value < MOBILE_BREAKPOINT);

function updateSize() {
  winW.value = window.innerWidth;
  winH.value = window.innerHeight;
}

async function loadStep(idx: number) {
  const s = STEPS[idx];
  spot.value = null;

  // Naviguer si besoin
  if (s.route && router.currentRoute.value.path !== s.route) {
    await router.push(s.route);
    await wait(450);
  }

  // Ouvrir le menu combats si besoin
  if (s.needsCombatsMenu) {
    window.dispatchEvent(new CustomEvent('tutorial:open-combats'));
    await wait(180);
  }

  // Ouvrir le sidebar sur mobile si besoin (délai plus long pour l'animation)
  if (s.needsSidebar && window.innerWidth <= 768) {
    window.dispatchEvent(new CustomEvent('tutorial:open-sidebar'));
    await wait(450);
  }

  if (!s.target) return;

  await nextTick();
  await wait(80);

  const el = document.querySelector(s.target);
  if (!el) return;

  // Sur mobile, center pour mieux cadrer l'élément ; desktop nearest
  const block = window.innerWidth <= 768 ? 'center' : 'nearest';
  el.scrollIntoView({ behavior: 'smooth', block });
  await wait(window.innerWidth <= 768 ? 350 : 200);

  const rect = el.getBoundingClientRect();
  const p = s.padding;
  spot.value = {
    x: rect.left - p,
    y: rect.top - p,
    w: rect.width + p * 2,
    h: rect.height + p * 2,
  };
}

function wait(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Position de la carte
const cardStyle = computed((): Record<string, string> => {
  const w = winW.value;
  const h = winH.value;
  const mobile = isMobile.value;

  // Mobile : mode bottom-sheet (carte toujours en bas, pleine largeur)
  if (mobile) {
    const pad = w < 360 ? 8 : 12;
    return {
      position: 'fixed',
      left: `${pad}px`,
      right: `${pad}px`,
      bottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
      width: 'auto',
      maxWidth: 'none',
    };
  }

  if (!spot.value) {
    return {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: CARD_W + 'px',
    };
  }

  const s = spot.value;

  // Éléments dans la sidebar (côté gauche) : carte à droite
  if (s.x + s.w < 290) {
    const topPos = Math.max(20, Math.min(
      s.y + s.h / 2 - CARD_H_EST / 2,
      h - CARD_H_EST - 20
    ));
    return {
      position: 'fixed',
      left: `${Math.min(s.x + s.w + GAP, w - CARD_W - 20)}px`,
      top: `${topPos}px`,
      width: CARD_W + 'px',
    };
  }

  // Éléments centraux : carte en dessous si possible, sinon au-dessus
  const cx = s.x + s.w / 2;
  const leftPos = Math.max(20, Math.min(cx - CARD_W / 2, w - CARD_W - 20));

  if (s.y + s.h + GAP + CARD_H_EST < h) {
    return {
      position: 'fixed',
      left: `${leftPos}px`,
      top: `${s.y + s.h + GAP}px`,
      width: CARD_W + 'px',
    };
  }

  return {
    position: 'fixed',
    left: `${leftPos}px`,
    top: `${Math.max(20, s.y - CARD_H_EST - GAP)}px`,
    width: CARD_W + 'px',
  };
});

// Direction et position de la flèche
const arrowDirection = computed(() => {
  if (!spot.value || !cardStyle.value) return '';
  const s = spot.value;
  const card = cardStyle.value;
  if (card.left && parseInt(card.left) > s.x + s.w) return 'arrow-left';
  if (card.top && parseInt(card.top) > s.y + s.h) return 'arrow-up';
  return 'arrow-down';
});

const arrowStyle = computed((): Record<string, string> | null => {
  if (!spot.value || isMobile.value) return null; /* Pas de flèche sur mobile (carte en bas) */
  const s = spot.value;
  const dir = arrowDirection.value;

  if (dir === 'arrow-left') {
    return {
      position: 'fixed',
      left: `${s.x + s.w + 2}px`,
      top: `${s.y + s.h / 2 - 10}px`,
    };
  }
  if (dir === 'arrow-up') {
    return {
      position: 'fixed',
      left: `${s.x + s.w / 2 - 10}px`,
      top: `${s.y + s.h + 2}px`,
    };
  }
  if (dir === 'arrow-down') {
    return {
      position: 'fixed',
      left: `${s.x + s.w / 2 - 10}px`,
      top: `${s.y - 22}px`,
    };
  }
  return null;
});

async function goNext() {
  if (stepIndex.value >= STEPS.length - 1) {
    skip();
    return;
  }
  stepIndex.value++;
  await loadStep(stepIndex.value);
}

async function goPrev() {
  if (stepIndex.value <= 0) return;
  stepIndex.value--;
  await loadStep(stepIndex.value);
}

function skip() {
  closeTutorial();
  spot.value = null;
  stepIndex.value = 0;
}

watch(tutorialVisible, async (v) => {
  if (v) {
    stepIndex.value = 0;
    await nextTick();
    await loadStep(0);
  } else {
    spot.value = null;
    stepIndex.value = 0;
  }
});

onMounted(() => window.addEventListener('resize', updateSize));
onUnmounted(() => window.removeEventListener('resize', updateSize));
</script>

<style scoped>
.tut-root {
  position: fixed;
  inset: 0;
  z-index: 9000;
  pointer-events: none;
}

.tut-bg-svg {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: all;
}

/* Anneau lumineux autour du spotlight */
.tut-spotlight-ring {
  position: fixed;
  border-radius: 12px;
  border: 2px solid rgba(0, 229, 255, 0.9);
  box-shadow:
    0 0 0 3px rgba(0, 229, 255, 0.25),
    0 0 24px rgba(0, 229, 255, 0.5),
    inset 0 0 12px rgba(0, 229, 255, 0.08);
  pointer-events: none;
  animation: tut-ring-pulse 2s ease-in-out infinite;
}

@keyframes tut-ring-pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.25), 0 0 24px rgba(0, 229, 255, 0.5), inset 0 0 12px rgba(0, 229, 255, 0.08); }
  50% { box-shadow: 0 0 0 5px rgba(0, 229, 255, 0.15), 0 0 38px rgba(0, 229, 255, 0.7), inset 0 0 16px rgba(0, 229, 255, 0.12); }
}

/* Flèche */
.tut-arrow {
  pointer-events: none;
  width: 0;
  height: 0;
  animation: tut-bounce 1s ease-in-out infinite;
}

.arrow-left {
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-right: 14px solid rgba(0, 229, 255, 0.9);
}

.arrow-up {
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-bottom: 14px solid rgba(0, 229, 255, 0.9);
}

.arrow-down {
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 14px solid rgba(0, 229, 255, 0.9);
}

@keyframes tut-bounce {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(4px); }
}

.arrow-up, .arrow-down {
  animation-name: tut-bounce-y;
}

@keyframes tut-bounce-y {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(4px); }
}

/* Carte tutoriel */
.tut-card {
  position: fixed;
  background: linear-gradient(160deg, #0b1428 0%, #0d1830 100%);
  border: 1px solid rgba(0, 229, 255, 0.3);
  border-radius: 16px;
  padding: 1.25rem 1.4rem;
  box-shadow:
    0 0 30px rgba(0, 229, 255, 0.12),
    0 20px 60px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  pointer-events: all;
  z-index: 9010;
}

.tut-card-progress {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 1rem;
}

.tut-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.25);
  transition: all 0.25s ease;
  flex-shrink: 0;
}

.tut-dot--done {
  background: rgba(0, 229, 255, 0.4);
  width: 10px;
}

.tut-dot--active {
  background: #00e5ff;
  width: 22px;
  box-shadow: 0 0 8px rgba(0, 229, 255, 0.6);
}

.tut-card-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #eaf6ff;
  margin: 0 0 0.65rem;
  line-height: 1.3;
}

.tut-card-text {
  font-size: 0.88rem;
  color: #9fbad0;
  line-height: 1.65;
  margin: 0 0 1.2rem;
}

.tut-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.tut-btn-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tut-btn-skip {
  background: none;
  border: none;
  color: rgba(148, 163, 184, 0.6);
  cursor: pointer;
  font-size: 0.78rem;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  transition: color 0.2s;
  white-space: nowrap;
}

.tut-btn-skip:hover {
  color: #f87171;
}

.tut-btn-prev {
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.2);
  color: #9fbad0;
  cursor: pointer;
  font-size: 0.82rem;
  padding: 0.45rem 0.8rem;
  border-radius: 8px;
  transition: all 0.2s;
  white-space: nowrap;
}

.tut-btn-prev:hover {
  background: rgba(148, 163, 184, 0.2);
  color: #eaf6ff;
}

.tut-btn-next {
  background: linear-gradient(90deg, #00e5ff, #2bff9e);
  border: none;
  color: #0b1428;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.88rem;
  padding: 0.5rem 1.1rem;
  border-radius: 8px;
  box-shadow: 0 0 16px rgba(0, 229, 255, 0.4);
  transition: all 0.2s;
  white-space: nowrap;
}

.tut-btn-next:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 28px rgba(0, 229, 255, 0.65);
}

/* Transitions */
.tut-root-fade-enter-active,
.tut-root-fade-leave-active {
  transition: opacity 0.3s ease;
}
.tut-root-fade-enter-from,
.tut-root-fade-leave-to {
  opacity: 0;
}

.tut-card-anim-enter-active,
.tut-card-anim-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.tut-card-anim-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}
.tut-card-anim-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.tut-spot-anim-enter-active,
.tut-spot-anim-leave-active {
  transition: opacity 0.25s ease;
}
.tut-spot-anim-enter-from,
.tut-spot-anim-leave-to {
  opacity: 0;
}

.tut-arrow-anim-enter-active,
.tut-arrow-anim-leave-active {
  transition: opacity 0.2s ease;
}
.tut-arrow-anim-enter-from,
.tut-arrow-anim-leave-to {
  opacity: 0;
}

/* Mobile (< 768px) */
@media (max-width: 767px) {
  .tut-card {
    border-radius: 20px 20px 0 0;
    padding: 1rem 1.1rem 1.25rem;
    padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
    max-width: none;
    max-height: 70vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tut-card-progress {
    margin-bottom: 0.85rem;
    gap: 5px;
  }

  .tut-dot {
    width: 6px;
    height: 6px;
  }

  .tut-dot--done {
    width: 8px;
  }

  .tut-dot--active {
    width: 18px;
  }

  .tut-card-title {
    font-size: 1rem;
    margin-bottom: 0.5rem;
    line-height: 1.35;
  }

  .tut-card-text {
    font-size: 0.82rem;
    line-height: 1.6;
    margin-bottom: 1rem;
  }

  .tut-card-actions {
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .tut-btn-skip {
    width: 100%;
    order: 3;
    padding: 0.5rem;
    font-size: 0.8rem;
    min-height: 44px;
  }

  .tut-btn-group {
    flex: 1;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .tut-btn-prev,
  .tut-btn-next {
    padding: 0.55rem 1rem;
    min-height: 44px;
    font-size: 0.9rem;
  }

  .tut-spotlight-ring {
    border-radius: 10px;
  }
}
</style>
