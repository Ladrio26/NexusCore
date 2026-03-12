<template>
  <section class="pvp">
    <div class="card nx-panel">
      <h1 class="nx-title">PvP</h1>

      <div class="pvp-elo">
        <span class="pvp-elo-label">Elo actuel</span>
        <span class="pvp-elo-value">{{ pvpMe?.pvp_elo ?? 0 }}</span>
      </div>

      <div v-if="!pvpMe?.defense" class="pvp-alert">
        <p>Configurez une défense (preset d'équipe) pour accéder au PvP.</p>
        <router-link to="/pvp/defense" class="nx-btn">Configurer la défense</router-link>
      </div>

      <template v-else>
        <div class="pvp-defense-link">
          <span class="pvp-defense-label">Défense :</span>
          <router-link to="/pvp/defense" class="pvp-defense-edit">Configurer la défense</router-link>
        </div>

        <div class="pvp-preset-row">
          <label class="pvp-label">Preset d'attaque</label>
          <select v-model.number="attackerPresetId" class="pvp-select" :disabled="loading">
            <option v-for="p in presets" :key="p.preset_index" :value="p.preset_index">
              {{ p.preset_name || `Preset ${p.preset_index}` }}
            </option>
          </select>
        </div>

        <div v-if="selectedAttackPreset" class="pvp-team-preview nx-panel">
          <h3 class="pvp-team-preview-title">Aperçu du preset d'attaque</h3>
          <div class="pvp-unit-row">
            <span class="pvp-unit-row-label">CAC</span>
            <div class="pvp-unit-list">
              <div v-for="unit in selectedAttackPreset.front_units" :key="`att-front-${unit.user_unit_id}`" class="pvp-unit-card">
                <img :src="unitImage(unit)" :alt="unit.name" class="pvp-unit-avatar" />
                <span class="pvp-unit-name">{{ unit.name }}</span>
                <span class="pvp-unit-level">Nv.{{ unit.level }}</span>
              </div>
              <span v-if="!selectedAttackPreset.front_units.length" class="pvp-row-empty">Aucune unité CAC</span>
            </div>
          </div>
          <div class="pvp-unit-row">
            <span class="pvp-unit-row-label">Distance</span>
            <div class="pvp-unit-list">
              <div v-for="unit in selectedAttackPreset.back_units" :key="`att-back-${unit.user_unit_id}`" class="pvp-unit-card">
                <img :src="unitImage(unit)" :alt="unit.name" class="pvp-unit-avatar" />
                <span class="pvp-unit-name">{{ unit.name }}</span>
                <span class="pvp-unit-level">Nv.{{ unit.level }}</span>
              </div>
              <span v-if="!selectedAttackPreset.back_units.length" class="pvp-row-empty">Aucune unité distance</span>
            </div>
          </div>
        </div>

        <div class="pvp-actions">
          <button
            type="button"
            class="nx-btn nx-glow-blue pvp-btn-find"
            :disabled="loading || !attackerPresetId"
            @click="findAndFight"
          >
            {{ loading ? 'Recherche & combat…' : 'Trouver un adversaire' }}
          </button>
        </div>

        <div v-if="battleError" class="pvp-error">{{ battleError }}</div>
      </template>
    </div>

    <!-- Visualiseur de combat PvP (replay + plateau) -->
    <StageModal
      :show="!!pendingBattle"
      :chapter="0"
      :stage="0"
      mode="normal"
      :stage-info="{ stage: 0, isBoss: false, cleared: false, rewardClaimed: false, available: true }"
      :campaign-team="[]"
      :pending-battle="pendingBattle"
      @close="closeResult"
      @battle-finalized="handleBattleFinalized"
    />
    <Teleport to="body">
      <Transition name="rank-reward-popup">
        <div
          v-if="rankRewardPopup.length"
          class="pvp-rank-popup-overlay"
          @click.self="closeRankRewardPopup"
        >
          <section class="pvp-rank-popup nx-panel">
            <span class="pvp-rank-popup-kicker">PvP</span>
            <h2 class="pvp-rank-popup-title">Récompense de palier</h2>
            <p class="pvp-rank-popup-text">
              Tu as atteint un nouveau palier et débloqué ces récompenses :
            </p>
            <div class="pvp-rank-popup-list">
              <div
                v-for="reward in rankRewardPopup"
                :key="reward.key"
                class="pvp-rank-popup-card"
              >
                <strong>{{ reward.label }}</strong>
                <span>{{ formatRewardParts(reward) }}</span>
              </div>
            </div>
            <button type="button" class="nx-btn pvp-rank-popup-close" @click="closeRankRewardPopup">
              Récupéré
            </button>
          </section>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import api from '../api';
import StageModal from './StageModal.vue';
import { getUnitImageUrl } from '@/utils/unitImage';

type RankReward = {
  key: string;
  label: string;
  threshold: number;
  credits: number;
  cores: number;
  fragments: number;
  ascension_essence: number;
};

type PresetUnit = {
  user_unit_id: number;
  name: string;
  level: number;
  image_url?: string | null;
};

type Preset = {
  preset_index: number;
  preset_name: string | null;
  front_units: PresetUnit[];
  back_units: PresetUnit[];
};

const pvpMe = ref<{ pvp_elo: number; defense: { preset_id: number } | null } | null>(null);
const presets = ref<Preset[]>([]);
const loading = ref(false);
const battleError = ref('');
const rankRewardPopup = ref<RankReward[]>([]);
const pendingBattle = ref<{
  id: number;
  battleType: 'campaign' | 'pvp';
  title?: string;
  result?: string;
  battleLog?: unknown[];
  replay?: { seed?: number; frames: unknown[] };
  initialUnits?: unknown[];
  summary?: unknown;
  enemyTeamLabel?: string;
} | null>(null);
/** Dernier joueur affronté (pour ne pas retomber deux fois d'affilée sur le même). */
const lastDefenderId = ref<number | null>(null);

async function loadPvpMe() {
  try {
    const { data } = await api.get('/pvp/me');
    pvpMe.value = data;
  } catch {
    pvpMe.value = null;
  }
}

async function loadPresets() {
  try {
    const { data } = await api.get('/team/presets');
    presets.value = (data.presets || []).map((p: {
      preset_index: number;
      preset_name?: string | null;
      front_units?: PresetUnit[];
      back_units?: PresetUnit[];
    }) => ({
      preset_index: p.preset_index,
      preset_name: p.preset_name ?? null,
      front_units: Array.isArray(p.front_units) ? p.front_units : [],
      back_units: Array.isArray(p.back_units) ? p.back_units : []
    }));
    if (presets.value.length > 0 && !attackerPresetId.value) {
      attackerPresetId.value = presets.value[0].preset_index;
    }
  } catch {
    presets.value = [];
  }
}

function unitImage(unit: PresetUnit): string {
  return getUnitImageUrl(unit) || '/images/default-avatar.svg';
}

const selectedAttackPreset = computed(() =>
  presets.value.find((p) => p.preset_index === attackerPresetId.value) ?? null
);

async function findAndFight() {
  if (!attackerPresetId.value) return;
  battleError.value = '';
  loading.value = true;
  try {
    const { data: opponent } = await api.get('/pvp/find-opponent', {
      params: lastDefenderId.value != null ? { exclude_defender_id: lastDefenderId.value } : {}
    });
    const { data } = await api.post('/pvp/start-battle', {
      attacker_preset_id: attackerPresetId.value,
      defender_id: opponent.defender_type === 'player' ? opponent.defender_id : undefined,
      defender_type: opponent.defender_type
    });
    const resumedBattle = data?.pendingBattle ?? null;
    if (!resumedBattle) {
      throw new Error('PENDING_BATTLE_MISSING');
    }
    const enemyLabel = opponent.defender_type === 'npc' ? 'PNJ' : `Équipe de ${opponent.display_name || 'l\'adversaire'}`;
    pendingBattle.value = { ...resumedBattle, enemyTeamLabel: enemyLabel };
    lastDefenderId.value = opponent.defender_type === 'player' && opponent.defender_id != null ? opponent.defender_id : null;
  } catch (e: any) {
    const resumedBattle = e.response?.data?.pendingBattle;
    if (resumedBattle) {
      pendingBattle.value = resumedBattle;
    } else {
      battleError.value = e.response?.data?.message || e.response?.data?.error || e?.message || 'Impossible de trouver un adversaire ou erreur combat.';
    }
  } finally {
    loading.value = false;
  }
}

const attackerPresetId = ref<number>(1);

watch(presets, (list) => {
  if (list.length > 0 && attackerPresetId.value && !list.some((p) => p.preset_index === attackerPresetId.value)) {
    attackerPresetId.value = list[0].preset_index;
  }
}, { deep: true });

function closeResult() {
  pendingBattle.value = null;
}

async function loadPendingBattle() {
  try {
    const { data } = await api.get('/battle/pending');
    const battle = data?.pendingBattle;
    if (!battle || battle.battleType !== 'pvp') {
      pendingBattle.value = null;
      return;
    }
    pendingBattle.value = battle;
  } catch {
    pendingBattle.value = null;
  }
}

async function handleBattleFinalized(payload: Record<string, any>) {
  if (Array.isArray(payload?.rank_rewards) && payload.rank_rewards.length) {
    rankRewardPopup.value = [...payload.rank_rewards];
  }
  await loadPvpMe();
}

function formatRewardParts(reward: RankReward) {
  const parts: string[] = [];
  if (reward.credits) parts.push(`+${reward.credits} crédits`);
  if (reward.cores) parts.push(`+${reward.cores} cores`);
  if (reward.fragments) parts.push(`+${reward.fragments} fragments`);
  if (reward.ascension_essence) parts.push(`+${reward.ascension_essence} essence`);
  return parts.join(' · ');
}

function closeRankRewardPopup() {
  rankRewardPopup.value = [];
}

onMounted(() => {
  loadPvpMe();
  loadPresets();
  loadPendingBattle();
});
</script>

<style scoped>
.pvp {
  padding: 1rem;
}
.card {
  max-width: 520px;
  margin: 0 auto;
  background: rgba(15, 23, 42, 0.95);
  border-radius: 1rem;
  padding: 1.5rem 2rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
}
.pvp-elo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.pvp-elo-label { color: rgba(148, 163, 184, 0.9); }
.pvp-elo-value { font-size: 1.5rem; font-weight: 700; }
.pvp-alert {
  padding: 1rem;
  background: rgba(100, 116, 139, 0.2);
  border-radius: 0.5rem;
  margin-top: 0.5rem;
}
.pvp-alert p { margin-bottom: 0.75rem; }
.pvp-defense-link {
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.pvp-defense-label { color: rgba(148, 163, 184, 0.9); font-size: 0.95rem; }
.pvp-defense-edit {
  color: #93c5fd;
  text-decoration: none;
  font-size: 0.95rem;
}
.pvp-defense-edit:hover { text-decoration: underline; }
.pvp-preset-row { margin-bottom: 1rem; }
.pvp-label { display: block; margin-bottom: 0.35rem; color: rgba(148, 163, 184, 0.9); font-size: 0.9rem; }
.pvp-select {
  width: 100%;
  max-width: 280px;
  padding: 0.5rem 0.75rem;
  background: rgba(30, 41, 59, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 0.5rem;
  color: #e2e8f0;
}
.pvp-actions { margin: 1.25rem 0; }
.pvp-btn-find { margin-right: 0.5rem; }
.pvp-error { color: #f87171; margin-top: 0.75rem; font-size: 0.9rem; }
.pvp-team-preview {
  margin-top: 0.9rem;
  padding: 0.85rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.45);
}
.pvp-team-preview-title {
  margin: 0 0 0.65rem 0;
  font-size: 0.95rem;
  color: #e2e8f0;
}
.pvp-unit-row {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  margin-top: 0.6rem;
}
.pvp-unit-row-label {
  width: 72px;
  flex: 0 0 72px;
  font-size: 0.8rem;
  color: #93c5fd;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-top: 0.35rem;
}
.pvp-unit-list {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.pvp-unit-card {
  width: 88px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.6rem;
  background: rgba(15, 23, 42, 0.7);
  padding: 0.45rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}
.pvp-unit-avatar {
  width: 48px;
  height: 48px;
  border-radius: 999px;
  object-fit: cover;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(2, 6, 23, 0.7);
}
.pvp-unit-name {
  max-width: 100%;
  font-size: 0.72rem;
  line-height: 1.1;
  text-align: center;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pvp-unit-level {
  font-size: 0.7rem;
  color: #94a3b8;
}
.pvp-row-empty {
  color: #64748b;
  font-size: 0.8rem;
  padding-top: 0.4rem;
}
.pvp-rank-popup-overlay {
  position: fixed;
  inset: 0;
  z-index: 3200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(2, 6, 23, 0.78);
  backdrop-filter: blur(10px);
}
.pvp-rank-popup {
  width: min(100%, 520px);
  padding: 1.75rem;
  border-radius: 1.25rem;
  border: 1px solid rgba(250, 204, 21, 0.35);
  background:
    radial-gradient(circle at top, rgba(250, 204, 21, 0.18), transparent 55%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(2, 6, 23, 0.98));
  box-shadow:
    0 24px 80px rgba(2, 6, 23, 0.72),
    0 0 32px rgba(250, 204, 21, 0.14);
  text-align: center;
}
.pvp-rank-popup-kicker {
  display: inline-block;
  margin-bottom: 0.85rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(250, 204, 21, 0.12);
  border: 1px solid rgba(250, 204, 21, 0.28);
  color: #fde68a;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.pvp-rank-popup-title {
  margin: 0;
  color: #f8fafc;
  font-size: 1.9rem;
}
.pvp-rank-popup-text {
  margin: 0.9rem 0 1.2rem;
  color: #cbd5e1;
  line-height: 1.5;
}
.pvp-rank-popup-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.pvp-rank-popup-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgba(250, 204, 21, 0.16);
  background: rgba(15, 23, 42, 0.68);
  color: #f8fafc;
}
.pvp-rank-popup-card span {
  color: #cbd5e1;
  font-size: 0.92rem;
}
.pvp-rank-popup-close {
  margin-top: 1.25rem;
  min-width: 160px;
}
.rank-reward-popup-enter-active,
.rank-reward-popup-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.rank-reward-popup-enter-from,
.rank-reward-popup-leave-to {
  opacity: 0;
}
.rank-reward-popup-enter-from .pvp-rank-popup,
.rank-reward-popup-leave-to .pvp-rank-popup {
  transform: translateY(12px) scale(0.98);
}
</style>
