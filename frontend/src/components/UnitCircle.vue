<template>
  <div class="unit-wrapper" :class="{ bottom: rowPosition === 'bottom' }">
    <div class="unit-main">
      <div class="unit-circle-wrap unit">
        <AtbArc :value="unit?.atb ?? 0" />
        <div
          class="unit-ring"
          :class="ringClasses"
        />
        <div
          class="unit-circle unit-portrait"
          :class="{ recoil: recoilActive, 'has-unit-image': unitImageUrl }"
        >
          <img
            v-if="unitImageUrl"
            :src="unitImageUrl"
            alt=""
            class="unit-portrait-image"
            loading="lazy"
            decoding="async"
          >
          <div
            class="element-circle"
            :class="elementClass || 'element-neutral'"
          />
          <div
            class="hp-mask"
            :style="hpMaskStyle"
          />
        </div>
        <div class="buff-container">
          <div
            v-for="(b, i) in orbitBuffs"
            :key="orbitKey(b, i)"
            class="buff-orb"
            :style="orbitStyle(i)"
          >
            <span
              class="buff-orb-icon buff-pop"
              :style="{ color: b.color }"
            >{{ b.icon }}</span>
            <span
              v-if="b.duration != null && b.duration > 0"
              class="buff-orb-duration"
            >{{ b.duration }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="unit-name">{{ unit?.name ?? '' }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import AtbArc from './AtbArc.vue';
import { getUnitImageUrl } from '../utils/unitImage';
import { getBuffVisual, getRingClassForType } from '../utils/buffVisualMap';

const ELEMENT_SLUG: Record<string, string> = {
  FIRE: 'feu', FEU: 'feu',
  WATER: 'eau', EAU: 'eau',
  PLANT: 'plante', PLANTE: 'plante',
  LIGHT: 'lumiere', LUMIERE: 'lumiere', 'LUMIÈRE': 'lumiere',
  DARK: 'tenebres', TENEBRES: 'tenebres', 'TÉNÈBRES': 'tenebres',
  NEUTRAL: 'neutral'
};

type BuffEntry = { type?: string; buffType?: string; remainingActions?: number | null };

const props = withDefaults(
  defineProps<{
    unit: {
      id?: string;
      name?: string;
      element?: string;
      atb?: number | null;
      hp?: number;
      hpMax?: number;
      maxHp?: number;
      alive?: boolean;
      buffs?: BuffEntry[];
      debuffs?: BuffEntry[];
    };
    rowPosition?: 'top' | 'bottom';
    elementColor?: string;
  }>(),
  { elementColor: '#94a3b8', rowPosition: 'top' }
);

const recoilActive = ref(false);

const elementClass = computed(() => {
  const el = props.unit?.element;
  if (!el) return 'element-neutral';
  const slug = ELEMENT_SLUG[String(el).toUpperCase()] ?? String(el).toLowerCase();
  return slug ? `element-${slug}` : 'element-neutral';
});

const hpPercent = computed(() => {
  const u = props.unit;
  const max = u?.hpMax ?? u?.maxHp;
  if (!max || max <= 0) return 1;
  const hp = u?.hp ?? max;
  return Math.max(0, Math.min(1, hp / max));
});

const hpMaskStyle = computed(() => {
  const percent = hpPercent.value * 100;
  return {
    clipPath: `inset(0 0 ${percent}% 0)`
  };
});

const unitImageUrl = computed(() => getUnitImageUrl(props.unit ?? null));

function toOrbitBuff(b: BuffEntry, isDebuff: boolean) {
  const type = (b.buffType ?? b.type) ?? '';
  const visual = getBuffVisual(type, isDebuff);
  const duration = b.remainingActions != null ? Number(b.remainingActions) : null;
  return {
    type,
    icon: visual.icon,
    color: visual.color,
    duration: Number.isNaN(duration) || duration == null ? null : Math.max(0, Math.round(duration)),
    ringClass: visual.ringClass ?? null
  };
}

const orbitBuffs = computed(() => {
  const buffs = (props.unit?.buffs ?? []).map((b) => toOrbitBuff(b, false));
  const debuffs = (props.unit?.debuffs ?? []).map((d) => toOrbitBuff(d, true));
  return [...buffs, ...debuffs];
});

const ringClasses = computed(() => {
  const set = new Set<string>();
  for (const b of props.unit?.buffs ?? []) {
    const rc = getRingClassForType((b.buffType ?? b.type));
    if (rc) set.add(rc);
  }
  for (const d of props.unit?.debuffs ?? []) {
    const rc = getRingClassForType((d.buffType ?? d.type));
    if (rc) set.add(rc);
  }
  return Array.from(set);
});

function orbitKey(b: { type: string; icon: string }, i: number) {
  return `orb-${b.type}-${i}`;
}

function orbitStyle(index: number) {
  const total = orbitBuffs.value.length;
  const angle = total > 0 ? (360 / total) * index : 0;
  return {
    '--orbit-offset': `${angle}deg`
  };
}

watch(
  () => props.unit?.atb,
  (newVal, oldVal) => {
    if (oldVal != null && newVal != null && newVal < oldVal) triggerAtbTick();
  }
);

function triggerAtbTick() {
  recoilActive.value = true;
  setTimeout(() => {
    recoilActive.value = false;
  }, 150);
}
</script>

<style scoped>
.unit-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.unit-main {
  display: flex;
  align-items: center;
  gap: 6px;
}

.unit-circle-wrap.unit {
  position: relative;
  width: 95px;
  height: 90px;
}

/* ---- Anneau d'effets autour de l'unité ---- */
.unit-ring {
  position: absolute;
  top: 18px;
  left: 12px;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  pointer-events: none;
  box-shadow: none;
  opacity: 0;
  transition: opacity 0.06s ease, box-shadow 0.06s ease;
}

.unit-ring.shield-ring {
  opacity: 1;
  box-shadow: 0 0 12px 3px rgba(56, 189, 248, 0.7), inset 0 0 8px rgba(56, 189, 248, 0.2);
  animation: ringPulse 1.5s ease-in-out infinite;
}

.unit-ring.immunity-ring {
  opacity: 1;
  box-shadow: 0 0 14px 4px rgba(248, 250, 252, 0.8), inset 0 0 10px rgba(255, 255, 255, 0.3);
  animation: ringPulse 1.2s ease-in-out infinite;
}

.unit-ring.invincible-ring {
  opacity: 1;
  box-shadow: 0 0 16px 5px rgba(255, 255, 255, 0.9), inset 0 0 12px rgba(255, 255, 255, 0.4);
  animation: ringPulse 0.8s ease-in-out infinite;
}

.unit-ring.counter-ring {
  opacity: 1;
  box-shadow: 0 0 12px 3px rgba(249, 115, 22, 0.7);
  animation: ringPulse 1s ease-in-out infinite;
}

.unit-ring.stun-ring {
  opacity: 1;
  box-shadow: 0 0 10px 3px rgba(234, 179, 8, 0.8);
  animation: ringPulse 1.3s ease-in-out infinite;
}

.unit-ring.lifesteal-ring {
  opacity: 1;
  box-shadow: 0 0 10px 2px rgba(153, 27, 27, 0.6);
  animation: ringPulse 1.5s ease-in-out infinite;
}

.unit-ring.regen-ring {
  opacity: 1;
  box-shadow: 0 0 12px 3px rgba(34, 197, 94, 0.65), inset 0 0 10px rgba(34, 197, 94, 0.22);
  animation: ringPulse 1.4s ease-in-out infinite;
}

.unit-ring.stat-steal-buff-ring {
  opacity: 1;
  box-shadow: 0 0 12px 3px rgba(20, 184, 166, 0.65), inset 0 0 10px rgba(45, 212, 191, 0.18);
  animation: ringPulse 1.1s ease-in-out infinite;
}

.unit-ring.stat-steal-debuff-ring {
  opacity: 1;
  box-shadow: 0 0 12px 3px rgba(15, 118, 110, 0.65), inset 0 0 10px rgba(15, 118, 110, 0.18);
  animation: ringPulse 1.1s ease-in-out infinite;
}

.unit-ring.heal-flash {
  opacity: 0.6;
  box-shadow: 0 0 8px 2px rgba(34, 197, 94, 0.5);
}

.unit-ring.resurrect-light {
  opacity: 1;
  box-shadow: 0 0 14px 4px rgba(226, 232, 240, 0.8);
  animation: ringPulse 1s ease-in-out infinite;
}

@keyframes ringPulse {
  0%, 100% { filter: brightness(1); transform: scale(1); }
  50% { filter: brightness(1.15); transform: scale(1.02); }
}

/* ---- Portrait (cercle unité) ---- */
.unit-circle.unit-portrait {
  position: absolute;
  top: 18px;
  left: 12px;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid rgba(255, 255, 255, 0.2);
}

.unit-name {
  font-size: 9px;
  margin-top: 4px;
  text-align: center;
}

@media (max-width: 768px) {
  .unit-circle-wrap.unit :deep(.atb-arc) {
    display: none;
  }

  .unit-circle-wrap.unit {
    width: 28px;
    height: 26px;
  }

  /* Taille réduite pour tenir 4-6 unités par ligne sur mobile */
  .unit-ring,
  .unit-circle.unit-portrait,
  .buff-container {
    top: 2px;
    left: 3px;
    width: 22px;
    height: 22px;
  }

  .unit-circle.unit-portrait {
    border-width: 1px;
  }

  .buff-orb {
    transform: rotate(var(--orbit-offset, 0deg)) translateX(9px) rotate(calc(-1 * var(--orbit-offset, 0deg)));
  }

  .buff-orb-icon {
    width: 6px;
    height: 6px;
    font-size: 5px;
  }

  .buff-orb-duration {
    font-size: 5px;
  }

  .unit-name {
    font-size: 6px;
    margin-top: 1px;
    max-width: 28px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.1;
  }

  /* Masquer la barre ATB en responsive (trop grosse) */
  :deep(.atb-arc) {
    display: none;
  }

  /* Désactiver les buffs en orbite sur mobile */
  .buff-container {
    display: none;
  }
}

.unit-circle.recoil {
  animation: atbRecoil 0.15s ease-out;
}

.unit-circle.recoil::after {
  content: '';
  position: absolute;
  inset: -10%;
  width: 120%;
  height: 120%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 208, 0, 0.33), transparent 70%);
  animation: flashFade 0.2s ease-out;
  pointer-events: none;
}

.unit-circle .element-circle {
  z-index: 0;
}

.unit-portrait-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  object-position: center;
  opacity: 0.72;
  pointer-events: none;
  z-index: 1;
}

.unit-circle .hp-mask {
  z-index: 2;
}

.element-circle {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.element-circle.element-feu {
  background: radial-gradient(circle, #ff6a00, #8a1f00);
}
.element-circle.element-eau {
  background: radial-gradient(circle, #00bfff, #003a8a);
}
.element-circle.element-plante {
  background: radial-gradient(circle, #3bd16f, #0b5e2a);
}
.element-circle.element-lumiere {
  background: radial-gradient(circle, #ffe066, #b89c00);
}
.element-circle.element-tenebres {
  background: radial-gradient(circle, #9a5cff, #3a0070);
}
.element-circle.element-neutral {
  background: radial-gradient(circle, #94a3b8, #475569);
}

.hp-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.65);
  transition: clip-path 0.2s linear;
  pointer-events: none;
}

/* ---- Conteneur d'icônes en orbite (désactivé uniquement sur mobile) ---- */
.buff-container {
  position: absolute;
  top: 18px;
  left: 12px;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  pointer-events: none;
  animation: orbit 12s linear infinite;
}

.buff-container--legacy {
  position: absolute;
  top: 18px;
  left: 12px;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  pointer-events: none;
  animation: orbit 12s linear infinite;
}

.buff-orb {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: rotate(var(--orbit-offset, 0deg)) translateX(35px) rotate(calc(-1 * var(--orbit-offset, 0deg)));
}

.buff-orb-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.8), 0 1px 2px rgba(0, 0, 0, 0.9);
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  animation: buffPop 0.08s ease-out;
}

.buff-orb-duration {
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 2px #000;
  margin-top: 1px;
}

@keyframes orbit {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes buffPop {
  0% { transform: scale(0); opacity: 0; }
  70% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes atbRecoil {
  0% { transform: translateX(0); }
  50% { transform: translateX(-6px); }
  100% { transform: translateX(0); }
}

@keyframes flashFade {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* Duplicate removed - mobile styles already in first @media block */
</style>
