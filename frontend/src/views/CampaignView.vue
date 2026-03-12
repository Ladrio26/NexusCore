<template>
  <section class="campaign">
    <div v-if="!lockError" class="campaign-page-bg" :class="{ 'campaign-page-bg-hard': mode === 'hard' }" :style="chapterBackgroundStyle" aria-hidden="true" />
    <div v-if="lockError" class="lock-overlay">
      <div class="lock-card nx-panel">
        <h2 class="nx-title">Campagne verrouillée</h2>
        <p class="nx-subtitle">Tu dois posséder au moins <strong>{{ requiredUnits }}</strong> unités pour débloquer la campagne.</p>
        <router-link to="/sanctuary" class="btn-sanctuary nx-btn">Aller au Sanctuaire</router-link>
      </div>
    </div>

    <template v-else>
      <div class="campaign-top">
        <div class="campaign-header">
          <h1 class="nx-title">Campagne</h1>
          <div class="mode-toggle" role="switch" :aria-checked="mode === 'hard'">
            <button
              type="button"
              :class="{ active: mode === 'normal' }"
              @click="mode = 'normal'"
            >
              Normal
            </button>
            <div class="mode-toggle-item" :class="{ locked: !hardModeUnlocked }">
              <button
                type="button"
                :class="{ active: mode === 'hard' }"
                :disabled="!hardModeUnlocked"
                @click="hardModeUnlocked && (mode = 'hard')"
              >
                <span class="mode-flame" aria-hidden="true">{{ hardModeUnlocked ? '🔥' : '🔒' }}</span>
                Difficile
                <span v-if="mode === 'hard'" class="badge-unstable">Instable ce mois-ci</span>
              </button>
              <div v-if="!hardModeUnlocked" class="mode-lock-tooltip" role="tooltip">
                {{ hardModeLockedReason }}
              </div>
            </div>
          </div>
        </div>

        <div class="chapter-tabs">
          <button
            v-for="c in 10"
            :key="c"
            type="button"
            :class="{ active: chapter === c, locked: !status?.chapters?.[c]?.chapterAvailable, unlocked: status?.chapters?.[c]?.chapterAvailable }"
            :title="status?.chapters?.[c]?.chapterAvailable ? '' : 'Termine le chapitre précédent pour débloquer'"
            :disabled="!status?.chapters?.[c]?.chapterAvailable"
            @click="status?.chapters?.[c]?.chapterAvailable && (chapter = c)"
          >
            <span v-if="!status?.chapters?.[c]?.chapterAvailable" class="chapter-lock-badge" aria-hidden="true">🔒</span>
            Ch. {{ c }}
          </button>
        </div>
        <div v-if="hardChapterModifierText" class="chapter-hard-modifier">
          {{ hardChapterModifierText }}
        </div>
      </div>

      <div class="campaign-center">
        <div v-if="status?.chapters?.[chapter]" class="map-wrap" :class="{ 'map-wrap-hard': mode === 'hard' }">
          <div class="map-bg" aria-hidden="true" />
          <div class="map-fog" aria-hidden="true" />
          <div class="map-halo" aria-hidden="true" />
          <ChapterMap
            :chapter="chapter"
            :mode="mode"
            :stages="status.chapters[chapter].stages"
            :season-key="status.seasonKey ?? null"
            @open-stage="openStage"
          />
        </div>
      </div>
    </template>

    <StageModal
      v-if="selectedStage"
      :show="!!selectedStage"
      :chapter="selectedStage.chapter"
      :stage="selectedStage.stage"
      :mode="mode"
      :stage-info="selectedStage.stageInfo"
      :campaign-team="campaignTeam"
      :pending-battle="pendingBattle"
      @close="selectedStage = null; pendingBattle = null"
      @campaign-updated="refreshCampaign"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { getHardChapterModifierLabelsFr } from '../../../core/campaignHardModifiers.js';
import api from '../api';
import ChapterMap from './ChapterMap.vue';
import StageModal from './StageModal.vue';

const mode = ref<'normal' | 'hard'>('normal');
const chapter = ref(1);
const status = ref<{
  unlocked: boolean;
  requiredUnits?: number;
  hardUnlocked?: boolean;
  hardUnlockRequirement?: { chapter: number; stage: number };
  mode: string;
  seasonKey?: string | null;
  chapters?: Record<number, { chapterAvailable: boolean; stages: Array<{ stage: number; isBoss: boolean; cleared: boolean; rewardClaimed: boolean; available: boolean; xpPerUnitNormal?: number; xpPerUnitHard?: number }> }>;
} | null>(null);
const lockError = ref(false);
const requiredUnits = ref(5);
const selectedStage = ref<{
  chapter: number;
  stage: number;
  stageInfo: { stage: number; isBoss: boolean; cleared: boolean; rewardClaimed: boolean; available: boolean; xpPerUnitNormal?: number; xpPerUnitHard?: number };
} | null>(null);
const campaignTeam = ref<Array<{ user_unit_id: number; position: 'front' | 'back' }>>([]);
const pendingBattle = ref<{
  id: number;
  battleType: 'campaign' | 'pvp';
  title?: string;
  mode?: 'normal' | 'hard';
  chapter?: number;
  stage?: number;
  result?: string;
  success?: boolean;
  battleLog?: unknown[];
  replay?: { seed?: number; frames: unknown[] };
  initialUnits?: unknown[];
  summary?: { totalTurns?: number; playerUnitsAlive?: number; enemyUnitsAlive?: number };
} | null>(null);
const hardModeUnlocked = ref(false);
const hardModeLockedReason = ref('Bats le boss du chapitre 5 en mode normal pour débloquer le mode difficile.');
const CHAPTER_BACKGROUNDS: Record<number, string> = {
  1: '/images/campaign/plaine.png',
  2: '/images/campaign/plage.png',
  3: '/images/campaign/desert.png',
  4: '/images/campaign/foret.png',
  5: '/images/campaign/iles.png',
  6: '/images/campaign/canyon.png',
  7: '/images/campaign/montagne.png',
  8: '/images/campaign/ocean.png',
  9: '/images/campaign/volcan.png',
  10: '/images/campaign/chaos.png'
};
const chapterBackgroundStyle = computed(() => {
  const imageUrl = CHAPTER_BACKGROUNDS[chapter.value];
  if (!imageUrl) {
    return {};
  }
  return {
    backgroundImage: `linear-gradient(180deg, rgba(2, 6, 23, 0.18) 0%, rgba(2, 6, 23, 0.5) 100%), url("${imageUrl}")`
  };
});
const hardChapterModifierText = computed(() => {
  if (mode.value !== 'hard') return '';
  return getHardChapterModifierLabelsFr(chapter.value).join(' · ');
});

async function fetchStatus() {
  lockError.value = false;
  try {
    const { data } = await api.get('/campaign/status', { params: { mode: mode.value } });
    status.value = data;
    hardModeUnlocked.value = !!data?.hardUnlocked;
    if (mode.value === 'hard' && !hardModeUnlocked.value) {
      mode.value = 'normal';
      return;
    }
    if (data?.chapters) {
      let maxUnlocked = 1;
      for (let c = 1; c <= 10; c++) {
        if (data.chapters[c]?.chapterAvailable) maxUnlocked = c;
      }
      chapter.value = maxUnlocked;
    }
  } catch (e: any) {
    if (e.response?.status === 403 && e.response?.data?.error === 'CAMPAIGN_LOCKED') {
      lockError.value = true;
      requiredUnits.value = e.response?.data?.requiredUnits ?? 5;
      status.value = null;
      hardModeUnlocked.value = false;
    } else {
      status.value = null;
    }
  }
}

async function fetchTeam() {
  try {
    const { data } = await api.get('/team');
    const front = (data.frontlineSlots || []).map((id: number) => ({ user_unit_id: id, position: 'front' as const }));
    const back = (data.backlineSlots || []).map((id: number) => ({ user_unit_id: id, position: 'back' as const }));
    campaignTeam.value = [...front, ...back];
  } catch {
    campaignTeam.value = [];
  }
}

function openStage(payload: { chapter: number; stage: number; stageInfo: any }) {
  selectedStage.value = {
    chapter: payload.chapter,
    stage: payload.stage,
    stageInfo: payload.stageInfo
  };
}

async function refreshCampaign() {
  await fetchStatus();
  await fetchPendingBattle();
}

async function fetchPendingBattle() {
  try {
    const { data } = await api.get('/battle/pending');
    const battle = data?.pendingBattle;
    if (!battle || battle.battleType !== 'campaign') {
      pendingBattle.value = null;
      return;
    }
    pendingBattle.value = battle;
    mode.value = battle.mode === 'hard' ? 'hard' : 'normal';
    chapter.value = Number(battle.chapter) || 1;
    const fallbackStageInfo = { stage: Number(battle.stage) || 1, isBoss: Number(battle.stage) === 10, cleared: false, rewardClaimed: false, available: true };
    const chapterData = status.value?.chapters?.[chapter.value];
    const matchingStage = chapterData?.stages?.find((entry) => entry.stage === Number(battle.stage));
    selectedStage.value = {
      chapter: Number(battle.chapter) || 1,
      stage: Number(battle.stage) || 1,
      stageInfo: matchingStage ?? fallbackStageInfo
    };
  } catch {
    pendingBattle.value = null;
  }
}

watch(mode, fetchStatus);

onMounted(async () => {
  await fetchStatus();
  await fetchTeam();
  await fetchPendingBattle();
});
</script>

<style scoped>
.campaign {
  position: relative;
  min-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
  padding: 1.5rem 0;
  z-index: 0;
}

.campaign-top {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  padding-top: 0.25rem;
}

.campaign-center {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.campaign-page-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background:
    linear-gradient(180deg, rgba(2, 6, 23, 0.22) 0%, rgba(2, 6, 23, 0.62) 100%),
    radial-gradient(circle at 50% 20%, rgba(15, 23, 42, 0.08), rgba(2, 6, 23, 0.72) 78%);
  background-position: center top;
  background-repeat: no-repeat;
  background-size: cover;
  filter: saturate(1.02) contrast(1.04);
  pointer-events: none;
}

.campaign-page-bg-hard {
  filter: saturate(0.92) contrast(1.08) brightness(0.9);
}

.lock-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.lock-card {
  background: rgba(15, 23, 42, 0.98);
  border-radius: 1rem;
  padding: 2rem;
  text-align: center;
  border: 1px solid rgba(148, 163, 184, 0.4);
  max-width: 400px;
}

.lock-card h2 {
  margin-top: 0;
  color: #fbbf24;
}

.btn-sanctuary {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.6rem 1.25rem;
  border-radius: 999px;
  background: linear-gradient(to right, #3b82f6, #6366f1);
  color: white;
  text-decoration: none;
  font-weight: 600;
}

.campaign-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  position: relative;
  flex-wrap: wrap;
}

.campaign-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.badge-unstable {
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.25);
  color: #fcd34d;
}

.hard-badge {
  font-size: 0.85rem;
  color: #fcd34d;
  text-align: center;
}

.chapter-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  width: min(100%, 980px);
}

.chapter-hard-modifier {
  padding: 0.55rem 0.9rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.68);
  border: 1px solid rgba(248, 113, 113, 0.28);
  color: #fef2f2;
  font-size: 0.84rem;
  font-weight: 600;
  text-align: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(6px);
}

.chapter-tabs button {
  padding: 0.35rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.7);
  color: #e5e7eb;
  cursor: pointer;
  font-size: 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  transition: opacity 0.2s, box-shadow 0.2s;
}

.chapter-tabs button.locked {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
  filter: grayscale(0.6);
}

.chapter-tabs button.unlocked:not(.active) {
  cursor: pointer;
}

.chapter-tabs button.active {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.2);
  color: #7dd3fc;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.25);
}

.chapter-lock-badge {
  font-size: 0.85em;
}

.chapter-tabs button:not(.locked) {
  animation: chapterUnlockFade 0.5s ease;
}

@keyframes chapterUnlockFade {
  from {
    opacity: 0.7;
  }
  to {
    opacity: 1;
  }
}

.map-wrap {
  position: relative;
  width: min(100%, 980px);
  margin: 0 auto;
  border-radius: 1rem;
  padding: 1.5rem;
  padding-top: 1.75rem;
  min-height: 320px;
  overflow: hidden;
  border: none;
  background: transparent;
  backdrop-filter: none;
  box-shadow: none;
  z-index: 1;
}

.map-bg {
  position: absolute;
  inset: 0;
  background: transparent;
  pointer-events: none;
}

.map-fog {
  position: absolute;
  inset: 0;
  background: transparent;
  pointer-events: none;
}

.map-halo {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 280px;
  height: 200px;
  background: transparent;
  pointer-events: none;
}

.map-wrap-hard .map-halo {
  background: transparent;
}

.map-wrap-hard .map-fog {
  background: transparent;
}

.mode-toggle {
  display: flex;
  gap: 0;
  padding: 3px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.4);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
}

.mode-toggle button {
  padding: 0.45rem 1rem;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
}

.mode-toggle-item {
  position: relative;
}

.mode-toggle-item.locked:hover .mode-lock-tooltip {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.mode-toggle button.active {
  background: rgba(56, 189, 248, 0.2);
  color: #7dd3fc;
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.2);
}

.mode-toggle button:last-child.active {
  background: rgba(251, 113, 133, 0.25);
  color: #fda4af;
  box-shadow: 0 0 14px rgba(239, 68, 68, 0.2);
}

.mode-flame {
  font-size: 1em;
  line-height: 1;
}

.mode-lock-tooltip {
  position: absolute;
  left: 50%;
  top: calc(100% + 0.55rem);
  transform: translateX(-50%) translateY(-4px);
  min-width: 240px;
  max-width: 320px;
  padding: 0.6rem 0.8rem;
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid rgba(251, 191, 36, 0.38);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  color: #f8fafc;
  font-size: 0.78rem;
  line-height: 1.35;
  text-align: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s ease, transform 0.18s ease;
  z-index: 5;
}

.mode-lock-tooltip::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 100%;
  transform: translateX(-50%);
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 7px solid rgba(15, 23, 42, 0.96);
}
</style>
