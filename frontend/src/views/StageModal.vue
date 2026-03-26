<template>
  <Teleport to="body">
    <div v-if="show" class="battle-overlay modal-backdrop modal-overlay" @click.self="handleOverlayClose">
      <div class="battle-modal" :class="{ 'battle-modal--combat': battleResult }">
        <div class="modal-card nx-panel stage-modal" :class="{ 'modal-card--combat': battleResult, 'battle-modal-content': battleResult }">
          <template v-if="battleResult">
            <div class="modal-header modal-header--combat">
              <div class="header-left">
                <h2 class="stage-title">{{ battleTitle }}</h2>
              </div>
              <div class="header-right">
                <span v-if="battleResult && hasReplayMode" class="round-counter" :title="'Tour actuel / limite avant match nul'">{{ currentRound }} / {{ MAX_ROUNDS }}</span>
                <template v-if="isDungeonBattle && showBattleResult">
                  <!-- Rejouer : fin de série (combat 3 gagné) ou défaite — pas entre les combats 1→2 et 2→3 (enchaînement auto). -->
                  <button
                    v-if="!battleFinalizeResult?.dungeonChainNext"
                    type="button"
                    class="campaign-quick-btn campaign-btn-replay"
                    @click="handleDungeonReplay"
                  >
                    Rejouer
                  </button>
                </template>
                <template v-else-if="isCampaignBattle && showBattleResult">
                  <button
                    type="button"
                    class="campaign-quick-btn campaign-btn-replay"
                    @click="handleReplay"
                  >
                    Rejouer
                  </button>
                  <button
                    v-if="hasNextStage"
                    type="button"
                    class="campaign-quick-btn campaign-btn-next"
                    @click="handleGoNext"
                  >
                    Suivant
                  </button>
                </template>
                <button
                  type="button"
                  class="auto-mode-btn"
                  :class="{ active: autoMode }"
                  :title="autoMode ? 'Désactiver le mode auto' : 'Activer le mode auto'"
                  @click="toggleAutoMode"
                >
                  <span class="btn-text-desktop">{{ autoMode ? '⚡ Auto' : 'Mode Auto' }}</span>
                  <span class="btn-text-mobile">{{ autoMode ? '⚡' : 'Auto' }}</span>
                </button>
                <button
                  type="button"
                  class="logs-toggle-btn"
                  :class="{ active: showLogs }"
                  :title="showLogs ? 'Masquer les logs' : 'Afficher les logs'"
                  @click="showLogs = !showLogs"
                >
                  <span class="btn-text-desktop">{{ showLogs ? '📋 Logs' : 'Logs' }}</span>
                  <span class="btn-text-mobile">{{ showLogs ? '📋' : 'Logs' }}</span>
                </button>
                <button type="button" class="close-btn" aria-label="Fermer" @click.stop.prevent="closeAndNotify(false)">✕</button>
                <button
                  v-if="activePendingBattle"
                  type="button"
                  class="abandon-btn"
                  title="Abandonner le combat (en cas de blocage)"
                  @click.stop="emit('abandon')"
                >
                  Abandonner
                </button>
                <button type="button" class="legend-btn" @click="toggleLegend">
                  <span class="btn-text-desktop">Légende</span>
                  <span class="btn-text-mobile">?</span>
                </button>
              </div>
            </div>
            <div v-if="showBattleResult" class="stage-result" :class="resultClass">
              <span class="stage-result-label">{{ resultText }}</span>
              <div v-if="battleRewardsDisplay.length" class="stage-result-rewards">
                <div v-for="(line, i) in battleRewardsDisplay" :key="i" class="stage-result-reward-line">{{ line }}</div>
              </div>
              <div v-else-if="!hasFinalized && activePendingBattle?.id" class="stage-result-rewards stage-result-loading">
                Chargement des récompenses…
              </div>
            </div>
            <div v-if="isPvpBattle && showBattleResult" class="pvp-result-actions">
              <button type="button" class="pvp-find-opponent-btn campaign-quick-btn" @click.stop="handlePvpFindOpponent">
                Rechercher un Adversaire
              </button>
            </div>
            <div v-if="showDecisionPanelVisible" class="manual-decision-panel" :class="{ 'is-waiting': isDecisionPanelWaiting }">
              <div class="manual-decision-title">
                Tour de {{ manualDecisionContext?.actorName ?? 'votre unité' }}.
              </div>
              <div class="manual-decision-actions">
                <button
                  type="button"
                  class="manual-action-btn"
                  :class="{ active: manualActionChoice === 'BASIC' }"
                  @click="selectManualAction('BASIC')"
                >
                  Attaque de base
                </button>
                <template v-if="manualSkillSlotsMulti && manualDecisionContext?.skillSlots?.length">
                  <div
                    v-for="(slot, idx) in manualDecisionContext.skillSlots"
                    :key="String(slot.skillKey)"
                    class="manual-skill-wrap"
                    @mouseenter="manualSkillHoverKey = String(slot.skillKey)"
                    @mouseleave="manualSkillHoverKey = null"
                  >
                    <button
                      type="button"
                      class="manual-action-btn"
                      :class="{
                        active:
                          manualActionChoice === 'SKILL' && manualSelectedSkillKey === String(slot.skillKey)
                      }"
                      :disabled="!slot.ready || !(slot.skillTargets?.length)"
                      @click="selectManualAction('SKILL', String(slot.skillKey))"
                    >
                      Compétence {{ idx + 1 }}{{ manualSlotCooldownText(slot) }}
                    </button>
                    <div
                      v-if="
                        manualSkillHoverKey === String(slot.skillKey) &&
                        manualSlotTooltipText(slot)
                      "
                      class="manual-skill-tooltip"
                    >
                      {{ manualSlotTooltipText(slot) }}
                    </div>
                  </div>
                </template>
                <div
                  v-else
                  class="manual-skill-wrap"
                  @mouseenter="manualSkillHover = true"
                  @mouseleave="manualSkillHover = false"
                >
                  <button
                    type="button"
                    class="manual-action-btn"
                    :class="{ active: manualActionChoice === 'SKILL' }"
                    :disabled="!manualDecisionContext?.skillAvailable"
                    @click="selectManualAction('SKILL')"
                  >
                    Compétence{{ manualSkillCooldownText }}
                  </button>
                  <div v-if="manualSkillHover && manualSkillDescription" class="manual-skill-tooltip">
                    {{ manualSkillDescription }}
                  </div>
                </div>
              </div>
              <div class="manual-decision-targets">
                <span class="manual-target-label">Clique directement sur une unité valide (rond surligné).</span>
                <span v-if="manualExpectedTargetName" class="manual-target-expected">
                  Cible imposée par le focus: {{ manualExpectedTargetName }}
                </span>
              </div>
              <div v-if="manualDecisionError" class="manual-decision-error">{{ manualDecisionError }}</div>
            </div>
            <div v-else-if="showForcedAutoHint" class="manual-decision-hint">
              {{ forcedAutoHintText }}
            </div>
            <div v-else-if="showAutoModeHint" class="manual-decision-hint manual-decision-hint--auto">
              ⚡ Mode Auto actif — tes unités jouent seules.
            </div>
          </template>
          <template v-else>
            <div class="modal-header stage-modal-header battle-header">
              <span class="stage-title-icon" aria-hidden="true">{{ stageInfo?.isBoss ? '🔥' : '⚔' }}</span>
              <h2 class="stage-modal-title nx-title">Chapitre {{ chapter }} – Stage {{ stage }}</h2>
              <span v-if="stageInfo?.isBoss" class="badge boss nx-badge nx-badge-red nx-glow-red">Boss</span>
              <button type="button" class="btn-close" aria-label="Fermer" @click="$emit('close')">&times;</button>
              <div class="header-line" aria-hidden="true" />
            </div>
          </template>

        <template v-if="!battleResult && !dungeonMode">
          <div v-if="hardChapterModifierText" class="hard-modifier-preview">
            <strong>Effet du chapitre difficile :</strong> {{ hardChapterModifierText }}
          </div>
          <div v-if="rewardsPreview" class="rewards-preview">
            <h3>Récompenses (premier clear)</h3>
            <div class="rewards-badges">
              <div v-if="rewardsPreview.credits" class="reward-badge">💰 {{ rewardsPreview.credits }}</div>
              <div v-if="rewardsPreview.cores" class="reward-badge">🔷 {{ rewardsPreview.cores }}</div>
              <div v-if="rewardsPreview.fragments" class="reward-badge">🧩 {{ rewardsPreview.fragments }}</div>
              <div v-if="rewardsPreview.ascension_essence" class="reward-badge">✨ {{ rewardsPreview.ascension_essence }}</div>
            </div>
            <p class="xp-note">XP répétable à chaque victoire.</p>
          </div>

          <div v-if="!hasAnyPreset" class="no-team">
            <p>Crée une équipe dans <router-link to="/team-builder">Mes Equipes</router-link> pour combattre.</p>
          </div>

          <div v-else class="preset-select">
            <p class="preset-select-label">Choisir un preset pour combattre :</p>
            <div class="preset-options">
              <label
                v-for="p in presetsWithUnits"
                :key="p.preset_index"
                class="preset-option"
                :class="{ active: selectedPresetIndex === p.preset_index }"
              >
                <input type="radio" :value="p.preset_index" v-model="selectedPresetIndex" />
                <span>{{ presetDisplayName(p) }}</span>
              </label>
            </div>
          </div>

          <div class="actions">
            <button
              class="btn-fight button-combat nx-btn nx-glow-blue"
              :disabled="loading || !canFight || !stageInfo?.available"
              @click="startBattle"
            >
              <span v-if="loading">Combat en cours…</span>
              <span v-else>Combattre</span>
            </button>
          </div>
          <p v-if="presetHasUnfitUnits && !battleResult" class="preset-unfit-msg">{{ presetUnfitMessage }}</p>
          <div v-if="battleError" class="battle-error">
            {{ battleError }}
          </div>
        </template>

        <template v-else>
          <div v-if="initialUnitsForBattlefield.length > 0" class="combat-wrapper">
            <div v-if="showLegend" class="legend-overlay" @click.self="closeLegend">
              <div class="legend-panel">
                <button type="button" class="legend-close" aria-label="Fermer la légende" @click="closeLegend">✕</button>
                <h3 class="legend-panel-title">Effets de combat</h3>
                <p class="legend-intro">Les icônes tournent autour des unités. Le nombre indique la durée (tours). Un anneau coloré signale bouclier, immunité, contre-attaque, étourdissement, etc.</p>
                <div class="legend-section">
                  <div class="legend-section-label">Buffs</div>
                  <div v-for="(cfg, key) in buffConfig" :key="'buff-' + key" class="legend-row">
                    <span class="legend-icon" :style="{ color: legendVisual(key, false).color }">{{ legendVisual(key, false).icon }}</span>
                    <span class="legend-label" :title="cfg.description">{{ cfg.label }}</span>
                  </div>
                </div>
                <div class="legend-section">
                  <div class="legend-section-label">Débuffs</div>
                  <div v-for="(cfg, key) in debuffConfig" :key="'debuff-' + key" class="legend-row">
                    <span class="legend-icon" :style="{ color: legendVisual(key, true).color }">{{ legendVisual(key, true).icon }}</span>
                    <span class="legend-label" :title="cfg.description">{{ cfg.label }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="hoveredUnit"
              class="unit-tooltip"
            >
              <div v-if="getUnitImageUrl(hoveredUnit)" class="tooltip-unit-image" :style="{ backgroundImage: `url(${getUnitImageUrl(hoveredUnit)})` }" />
              <div class="tooltip-title" :style="hoveredUnitRarityStyle">
                {{ hoveredUnit.name }} (Nv.{{ hoveredUnit.level ?? '?' }})
              </div>
              <div class="tooltip-meta">
                {{ elementLabel(hoveredUnit.element) }}
                <span v-if="hoveredUnitRoleLabel"> · {{ hoveredUnitRoleLabel }}</span>
              </div>
              <div v-if="hoveredUnitFatigue != null" class="tooltip-meta tooltip-fatigue">
                Fatigue : {{ hoveredUnitFatigue }}
              </div>
              <div class="tooltip-stats">
                <div>HP : {{ currentHp(hoveredUnit) }} / {{ hoveredUnit.maxHp }}</div>
                <div>ATQ : {{ hoveredUnit.attack ?? '—' }}</div>
                <div>DEF : {{ hoveredUnit.defense ?? '—' }}</div>
                <div>VIT : {{ hoveredUnit.speed ?? '—' }}</div>
                <div>MTR : {{ hoveredUnitMasteryDisplay }}</div>
              </div>
              <div v-if="(hoveredUnit.traits ?? []).length" class="tooltip-traits">
                Traits : {{ (hoveredUnit.traits ?? []).map(toTraitFr).join(', ') }}
              </div>
              <div v-if="hoveredUnitSkillDescription" class="tooltip-skill">
                ⚡ {{ hoveredUnitSkillDescription }}
              </div>
            </div>
            <div class="battle-body">
            <div class="combat-layout">
              <div
                class="battle-logs battle-logs-left log-column team-a"
                :class="{ 'battle-logs--collapsed': !showLogs }"
                :aria-hidden="!showLogs"
              >
                <div ref="logColumnARef" class="log-container" @scroll="replayLogScrollLock = true">
                  <template v-if="hasReplayMode">
                    <div v-for="(log, i) in visibleReplayLogEntries.logsA" :key="'ra-' + i" class="log-entry" :class="{ 'log-entry-current': hasReplayMode && i === visibleReplayLogEntries.logsA.length - 1 }" :style="{ color: log.color }">{{ log.text }}</div>
                  </template>
                  <template v-else>
                    <div v-for="(log, i) in logsTeamA" :key="'a-' + i" class="log-entry" :style="{ color: log.color }">{{ log.text }}</div>
                  </template>
                </div>
              </div>
              <div class="battle-arena">
              <div id="combat-visual" class="combat-visual">
                <div class="battlefield-wrapper">
                  <div id="battlefield" ref="battlefieldRef" class="battlefield">
                    <Battlefield
                      ref="battlefieldComponentRef"
                      :ui-units="uiUnits"
                      :active-unit-id="battlefieldActiveUnitId"
                      :targetable-unit-ids="manualTargetableUnitIds"
                      :selected-target-id="manualSelectedTargetUnitId"
                      :enemy-team-label="battleEnemyTeamLabel"
                      @unit-hover="(u) => u != null ? handleUnitHover(u as BattlefieldUnit) : clearUnitHover()"
                      @unit-click="handleBattlefieldUnitClick"
                    />
                  </div>
                </div>
              </div>
              </div>
              <div
                class="battle-logs battle-logs-right log-column team-b"
                :class="{ 'battle-logs--collapsed': !showLogs }"
                :aria-hidden="!showLogs"
              >
                <div ref="logColumnBRef" class="log-container" @scroll="replayLogScrollLock = true">
                  <template v-if="hasReplayMode">
                    <div v-for="(log, i) in visibleReplayLogEntries.logsB" :key="'rb-' + i" class="log-entry" :class="{ 'log-entry-current': hasReplayMode && i === visibleReplayLogEntries.logsB.length - 1 }" :style="{ color: log.color }">{{ log.text }}</div>
                  </template>
                  <template v-else>
                    <div v-for="(log, i) in logsTeamB" :key="'b-' + i" class="log-entry" :style="{ color: log.color }">{{ log.text }}</div>
                  </template>
                </div>
              </div>
            </div>
            </div>
          </div>
        </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// @ts-nocheck — composant très large ; le typage strict sera affiné progressivement.
import { ref, reactive, watch, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { getHardChapterModifierLabelsFr } from '@engine/campaignHardModifiers.js';
// @ts-expect-error moteur JS sans types
import { simulateBattle, MAX_ROUNDS } from '@engine/combatEngine.js';
import api, { getToken } from '../api';
import Battlefield from '../components/Battlefield.vue';
import { getBuffVisual } from '../utils/buffVisualMap';
import { getUnitImageUrl } from '../utils/unitImage';
import { toTraitFr, combatRoleLabel } from '../utils/i18nFr';
import { rarityColors } from '../utils/invokeAnimation';
import { normalizeSkillDescription, getUnitSkillDisplayText } from '../utils/skillDescription';

type PresetUnit = { user_unit_id: number; fatigue?: number };
type PresetItem = {
  preset_index: number;
  preset_name: string | null;
  front_slots: number[];
  back_slots: number[];
  selected_noyau_index?: number;
  front_units?: PresetUnit[];
  back_units?: PresetUnit[];
};
const props = defineProps<{
  show: boolean;
  chapter: number;
  stage: number;
  mode: 'normal' | 'hard';
  stageInfo: { stage: number; isBoss: boolean; cleared: boolean; rewardClaimed: boolean; available: boolean } | undefined;
  campaignTeam: Array<{ user_unit_id: number; position: 'front' | 'back' }>;
  pendingBattle?: {
    id: number;
    battleType: 'campaign' | 'pvp' | 'guild_war' | 'dungeon';
    title?: string;
    result?: string;
    success?: boolean;
    battleLog?: unknown[];
    replay?: { seed?: number; frames: ReplayFrame[] | unknown[] };
    initialUnits?: BattlefieldUnit[] | unknown[];
    summary?: { totalTurns?: number; playerUnitsAlive?: number; enemyUnitsAlive?: number } | unknown;
    enemyTeamLabel?: string;
    interactiveSession?: { seed: number; bossModifier?: unknown; teamA: unknown[]; teamB: unknown[] };
  } | null;
  /** Replay autonome (ex: PvP). Quand défini, affiche uniquement le visualiseur de combat. */
  standaloneReplay?: {
    battleLog?: unknown[];
    replay?: { seed?: number; frames: ReplayFrame[] | unknown[] };
    initialUnits?: BattlefieldUnit[] | unknown[];
    summary?: { totalTurns?: number; playerUnitsAlive?: number; enemyUnitsAlive?: number } | unknown;
    decisionRequest?: {
      actorCombatIndex: number;
      actorName: string;
      skillAvailable: boolean;
      skillCd?: number;
      mainSkillDescription?: string;
      skillSlots?: DecisionSkillSlot[] | null;
      basicTargets: Array<{ combatIndex: number; name: string }>;
      skillTargets: Array<{ combatIndex: number; name: string }>;
    } | null;
    result?: string;
    /** Label équipe ennemie (ex. "PNJ" en PvP contre bot). */
    enemyTeamLabel?: string;
  } | null;
  /** Quand true, lance automatiquement le combat à l'ouverture (ex: bouton Suivant). */
  autoStartOnOpen?: boolean;
  /** Donjon : pas d'écran preset interne, le parent fournit le pendingBattle. */
  dungeonMode?: boolean;
  /** Donjon : mode Auto/Manuel à appliquer à l’ouverture (ex. mémorisé depuis le combat précédent). */
  dungeonInitialAutoMode?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'battle-done'): void;
  (e: 'battle-finalized', payload: Record<string, unknown>): void;
  (e: 'campaign-updated'): void;
  (e: 'go-next', payload: { chapter: number; stage: number }): void;
  (e: 'close', payload?: { findOpponent?: boolean }): void;
  (e: 'abandon'): void;
  (e: 'dungeon-combat-next', payload: { autoMode: boolean }): void;
  (e: 'dungeon-replay', payload: { autoMode: boolean }): void;
}>();

/** Évite d'émettre campaign-updated plusieurs fois (victoire). */
const progressionAlreadySent = ref(false);

const rewardsPreview = ref<{ credits: number; cores: number; fragments: number; ascension_essence: number } | null>(null);
const loading = ref(false);
const battleError = ref('');
const hardChapterModifierText = computed(() => (
  props.mode === 'hard' ? getHardChapterModifierLabelsFr(props.chapter).join(' · ') : ''
));
type BattlefieldUnit = {
  id: string;
  name: string;
  image_url?: string | null;
  rarity?: string;
  maxHp: number;
  element: string;
  side: 'A' | 'B';
  position: 'front' | 'back';
  level?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  mastery?: number;
  traits?: string[];
  skillDescription?: string;
};
type ReplaySnapshotUnit = {
  id: string;
  name: string;
  hp: number;
  hpMax: number;
  atb: number | null;
  alive: boolean;
  combatIndex: number;
  position: string;
  buffs: Array<{ type: string; value: number | null; remainingActions: number | null; sourceId?: string | null }>;
  debuffs: Array<{ type: string; value: number | null; remainingActions: number | null }>;
  hasSkill?: boolean;
  skillCd?: number | null;
  shield: number;
};
type ReplaySnapshot = {
  turn: number;
  activeUnitId: string | null;
  teams: Array<{ id: string; units: ReplaySnapshotUnit[] }>;
};
type ReplayFrame = { i: number; ts: number; event: Record<string, unknown>; snapshot: ReplaySnapshot };

/** Slot compétence renvoyé par le moteur (decisionRequest.skillSlots). */
type DecisionSkillSlot = {
  skillKey: string;
  name?: string | null;
  priority?: number;
  skillCd?: number;
  ready?: boolean;
  skillTargets?: Array<{ combatIndex: number; name: string }>;
  description?: string;
};

/** Priorité auto pour compétences ALLY_SINGLE (mode auto). */
type AllySingleAutoTargetStrategy =
  | 'lowest_hp_pct'
  | 'most_debuffs'
  | 'highest_attack'
  | 'lowest_atb'
  | 'longest_cd';

/* Déclarations nécessaires avant isStandaloneReplay, finalizeAndStore, watch (évite "Cannot access before initialization") */
const battleResult = ref<{
  success: boolean | null;
  result: 'win' | 'loss' | 'draw' | null;
  rewardsGranted: { credits: number; cores: number; fragments: number; ascension_essence: number } | null;
  battleLog?: unknown[];
  initialUnits?: BattlefieldUnit[];
  replay?: { seed?: number; frames: ReplayFrame[] };
  summary?: { totalTurns: number; playerUnitsAlive: number; enemyUnitsAlive: number };
  decisionRequest?: {
    actorCombatIndex: number;
    actorName: string;
    skillAvailable: boolean;
    skillCd?: number;
    mainSkillDescription?: string;
    skillSlots?: DecisionSkillSlot[] | null;
    basicTargets: Array<{ combatIndex: number; name: string }>;
    skillTargets: Array<{ combatIndex: number; name: string }>;
  } | null;
} | null>(null);
const activePendingBattle = ref<{ id: number; battleType: 'campaign' | 'pvp' | 'guild_war' | 'dungeon'; title?: string; enemyTeamLabel?: string } | null>(null);
const finalizeDataRef = ref<{ team?: Array<{ user_unit_id: number }>; attackerUserUnitIds?: number[]; attackerUnitIds?: number[] } | null>(null);
const battleFinalizeResult = ref<Record<string, unknown> | null>(null);
const hasFinalized = ref(false);

function computeCombatStatsFromLog(battleLog: unknown[] | undefined, teamSlots: Array<{ user_unit_id: number }>): Record<number, { kills: number; damage: number; healing: number }> {
  const stats: Record<number, { kills: number; damage: number; healing: number }> = {};
  const teamASize = teamSlots.length;
  const teamAIds = teamSlots.map((s) => Number(s.user_unit_id)).filter(Boolean);
  const idxToUid = (idx: number | null) => (idx != null && idx >= 0 && idx < teamASize ? teamAIds[idx] : null);
  const lastDamageByTarget: Record<number, number> = {};
  for (const ev of battleLog || []) {
    const e = ev as { type?: string; sourceId?: number | string; targetId?: number | string; value?: number; meta?: { amount?: number; effectiveDamage?: number } };
    const type = e?.type;
    const src = e?.sourceId;
    const tgt = e?.targetId;
    const val = (e?.value ?? e?.meta?.amount ?? e?.meta?.effectiveDamage ?? 0) as number;
    const srcIdx = typeof src === 'number' ? src : (typeof src === 'string' && /^\d+$/.test(src) ? parseInt(src, 10) : null);
    const tgtIdx = typeof tgt === 'number' ? tgt : (typeof tgt === 'string' && /^\d+$/.test(tgt) ? parseInt(tgt, 10) : null);
    if (type === 'DAMAGE' && srcIdx != null && val > 0) {
      if (tgtIdx != null) lastDamageByTarget[tgtIdx] = srcIdx;
      const uid = idxToUid(srcIdx);
      if (uid) {
        stats[uid] = stats[uid] || { kills: 0, damage: 0, healing: 0 };
        stats[uid].damage += val;
      }
    }
    if (type === 'HEAL' && srcIdx != null && val > 0) {
      const uid = idxToUid(srcIdx);
      if (uid) {
        stats[uid] = stats[uid] || { kills: 0, damage: 0, healing: 0 };
        stats[uid].healing += val;
      }
    }
    if (type === 'DEATH' && tgtIdx != null) {
      const killerIdx = lastDamageByTarget[tgtIdx];
      if (killerIdx != null) {
        const uid = idxToUid(killerIdx);
        if (uid) {
          stats[uid] = stats[uid] || { kills: 0, damage: 0, healing: 0 };
          stats[uid].kills += 1;
        }
      }
      delete lastDamageByTarget[tgtIdx];
    }
  }
  return stats;
}

function getTeamSlotsForStats(): Array<{ user_unit_id: number }> {
  const fd = finalizeDataRef.value;
  if (fd?.team?.length) return fd.team;
  const ids = fd?.attackerUserUnitIds ?? fd?.attackerUnitIds;
  if (ids?.length) return ids.map((id) => ({ user_unit_id: id }));
  if (
    (activePendingBattle.value?.battleType === 'campaign' || activePendingBattle.value?.battleType === 'dungeon')
    && props.campaignTeam?.length
  ) {
    return props.campaignTeam.map((s) => ({ user_unit_id: s.user_unit_id }));
  }
  return [];
}

const showBattleResult = computed(() => !!battleResult.value?.result);

const isStandaloneReplay = computed(() => !!props.standaloneReplay || activePendingBattle.value?.battleType === 'pvp' || activePendingBattle.value?.battleType === 'guild_war');
const isCampaignBattle = computed(() => activePendingBattle.value?.battleType === 'campaign');
const isDungeonBattle = computed(() => activePendingBattle.value?.battleType === 'dungeon');
const isCampaignLikeBattle = computed(
  () => activePendingBattle.value?.battleType === 'campaign' || activePendingBattle.value?.battleType === 'dungeon'
);
const isPvpBattle = computed(() => activePendingBattle.value?.battleType === 'pvp');
const dungeonMode = computed(() => props.dungeonMode === true);
const hasNextStage = computed(() => props.stage < 10 || (props.stage === 10 && props.chapter < 10));

/** Appelle /battle/finalize et stocke le résultat pour l'affichage des récompenses. */
async function finalizeAndStore() {
  if (!showBattleResult.value || !activePendingBattle.value?.id || hasFinalized.value) return;
  const winner = battleResult.value?.result ?? 'loss';
  const teamSlots = getTeamSlotsForStats();
  const combatStats = teamSlots.length && battleResult.value?.battleLog
    ? computeCombatStatsFromLog(battleResult.value.battleLog, teamSlots)
    : {};
  try {
    const { data } = await api.post('/battle/finalize', {
      id: activePendingBattle.value.id,
      winner,
      combatStats
    });
    battleFinalizeResult.value = (data ?? {}) as Record<string, unknown>;
    hasFinalized.value = true;
    if (data?.wallet) {
      window.dispatchEvent(new CustomEvent('wallet-updated', { detail: data.wallet }));
    }
    if (activePendingBattle.value?.battleType === 'campaign' && data?.progressUpdated && !progressionAlreadySent.value) {
      progressionAlreadySent.value = true;
      emit('campaign-updated');
    }
    emit('battle-finalized', data ?? {});
  } catch (e) {
    console.error('[StageModal] Auto-finalize error:', e);
  }
}

watch(
  [showBattleResult, () => activePendingBattle.value?.id],
  ([showRes, battleId]) => {
    if (showRes && battleId && !hasFinalized.value && !loading.value) {
      finalizeAndStore();
    }
  },
  { immediate: true }
);

/** Finalise le combat campagne si nécessaire (victoire : récompenses, XP, fatigue ; défaite : nettoyage). */
async function finalizeCampaignBattleIfNeeded(): Promise<boolean> {
  if (!isCampaignLikeBattle.value || battleResult.value?.result == null || !activePendingBattle.value?.id) {
    return false;
  }
  if (hasFinalized.value) {
    activePendingBattle.value = null;
    return true;
  }
  loading.value = true;
  try {
    const winner = battleResult.value.result;
    const teamSlots = getTeamSlotsForStats();
    const combatStats = teamSlots.length && battleResult.value?.battleLog
      ? computeCombatStatsFromLog(battleResult.value.battleLog, teamSlots)
      : {};
    const { data } = await api.post('/battle/finalize', {
      id: activePendingBattle.value.id,
      winner,
      combatStats
    });
    battleFinalizeResult.value = (data ?? {}) as Record<string, unknown>;
    hasFinalized.value = true;
    if (data?.wallet) {
      window.dispatchEvent(new CustomEvent('wallet-updated', { detail: data.wallet }));
    }
    if (data?.progressUpdated) {
      progressionAlreadySent.value = true;
      emit('campaign-updated'); /* Toujours notifier pour débloquer le niveau suivant (Rejouer ou Suivant) */
    }
    battleFinalizeResult.value = (data ?? {}) as Record<string, unknown>;
    hasFinalized.value = true;
    emit('battle-finalized', data ?? {});
    activePendingBattle.value = null;
    return true;
  } catch (e) {
    console.error('[StageModal] Finalize error:', e);
    return false;
  } finally {
    loading.value = false;
  }
}

async function handleReplay() {
  const finalized = await finalizeCampaignBattleIfNeeded();
  // Pause pour laisser le parent rafraîchir le statut (déblocage du niveau suivant)
  if (finalized && battleResult.value?.result === 'win') {
    await new Promise((r) => setTimeout(r, 200));
  }
  startBattle();
}
async function handleDungeonCombatNextClick() {
  await finalizeCampaignBattleIfNeeded();
  emit('dungeon-combat-next', { autoMode: autoMode.value });
}

async function handleDungeonReplay() {
  await finalizeCampaignBattleIfNeeded();
  emit('dungeon-replay', { autoMode: autoMode.value });
}

/** Donjon : enchaîne automatiquement combat 1→2 et 2→3 (sans cliquer « Combat suivant »). */
const dungeonAutoChainScheduled = ref(false);
watch(
  () => activePendingBattle.value?.id,
  () => {
    dungeonAutoChainScheduled.value = false;
  }
);
watch(
  () => ({
    fin: battleFinalizeResult.value,
    hf: hasFinalized.value,
    win: battleResult.value?.result === 'win',
    dm: props.dungeonMode,
    br: showBattleResult.value,
    dungeonBt: activePendingBattle.value?.battleType === 'dungeon'
  }),
  async (st) => {
    if (!st.dm || !st.br || !st.win || !st.hf || !st.dungeonBt) return;
    const d = st.fin as Record<string, unknown> | null;
    if (!d || d.dungeonChainNext !== true) return;
    if (dungeonAutoChainScheduled.value) return;
    dungeonAutoChainScheduled.value = true;
    await nextTick();
    await new Promise((r) => setTimeout(r, 650));
    try {
      await handleDungeonCombatNextClick();
    } catch (e) {
      console.error('[StageModal] dungeon auto-chain', e);
      dungeonAutoChainScheduled.value = false;
    }
  }
);

async function handleGoNext() {
  await finalizeCampaignBattleIfNeeded();
  // Courte pause après finalisation pour laisser le backend confirmer et le parent traiter campaign-updated
  if (battleResult.value?.result === 'win' && props.stage === 10) {
    await new Promise((r) => setTimeout(r, 150));
  }
  const nextCh = props.stage < 10 ? props.chapter : props.chapter + 1;
  const nextSt = props.stage < 10 ? props.stage + 1 : 1;
  emit('go-next', { chapter: nextCh, stage: nextSt });
}
const battleTitle = computed(() => {
  if (activePendingBattle.value?.title) return activePendingBattle.value.title;
  if (props.standaloneReplay) return 'Combat PvP';
  if (activePendingBattle.value?.battleType === 'guild_war') return 'Guerre de Guilde';
  return `Chapitre ${props.chapter} – Stage ${props.stage}`;
});
const battleEnemyTeamLabel = computed(() => {
  if (activePendingBattle.value?.enemyTeamLabel) return activePendingBattle.value.enemyTeamLabel;
  if (props.standaloneReplay?.enemyTeamLabel) return props.standaloneReplay.enemyTeamLabel;
  return 'Équipe Ennemie';
});

function getInitialUnitsNow(): BattlefieldUnit[] {
  return Array.isArray(battleResult.value?.initialUnits) ? battleResult.value.initialUnits as BattlefieldUnit[] : [];
}
function getUnitNameByCombatIndexSafe(combatIndex: number | null | undefined): string {
  if (combatIndex == null) return '?';
  const units = getInitialUnitsNow();
  const u = units[combatIndex];
  return u?.name ?? String(combatIndex);
}
function getUnitByCombatIndexSafe(combatIndex: number | null | undefined): BattlefieldUnit | null {
  if (combatIndex == null) return null;
  const units = getInitialUnitsNow();
  return units[combatIndex] ?? null;
}
function getCombatIndexSafe(logId: string | number | null | undefined): number | null {
  if (logId == null || logId === '') return null;
  const units = getInitialUnitsNow();
  const idx = typeof logId === 'number' ? logId : (typeof logId === 'string' ? parseInt(logId, 10) : NaN);
  if (Number.isInteger(idx) && idx >= 0 && idx < units.length) return idx;
  if (typeof logId === 'string') {
    const i = units.findIndex((u) => String(u.id) === logId || String((u as any).uid ?? '') === logId);
    if (i >= 0) return i;
  }
  return null;
}
function resolveUnitFromLogIdSafe(logId: string | number | null | undefined): { combatIndex: number | null; unit: BattlefieldUnit | null } {
  const combatIndex = getCombatIndexSafe(logId);
  const units = getInitialUnitsNow();
  const unit = combatIndex != null && units[combatIndex] ? units[combatIndex] : null;
  return { combatIndex, unit };
}
function hasElementAdvantage(attackerElement: string | null | undefined, targetElement: string | null | undefined): boolean {
  const a = String(attackerElement ?? '').toLowerCase();
  const t = String(targetElement ?? '').toLowerCase();
  if (!a || !t) return false;
  if ((a === 'water' && t === 'fire') || (a === 'fire' && t === 'plant') || (a === 'plant' && t === 'water')) return true;
  if ((a === 'light' || a === 'lumiere') && (t === 'dark' || t === 'tenebres' || t === 'tenebre')) return true;
  if ((a === 'dark' || a === 'tenebres' || a === 'tenebre') && (t === 'light' || t === 'lumiere')) return true;
  return false;
}

const battlefieldRef = ref<HTMLElement | null>(null);
const battlefieldComponentRef = ref<InstanceType<typeof Battlefield> | null>(null);
const uiUnits = reactive(new Map<string, Record<string, unknown>>());
const battlefieldHp = ref<Record<string, number>>({});
const deadUnitIds = ref<Set<string>>(new Set());
const logsTeamA = ref<{ text: string; color: string }[]>([]);
const logsTeamB = ref<{ text: string; color: string }[]>([]);
const showLegend = ref(false);
const showLogs = ref(true);

function toggleLegend() {
  showLegend.value = !showLegend.value;
}

function toggleAutoMode() {
  autoMode.value = !autoMode.value;
}

function closeLegend() {
  showLegend.value = false;
}

function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') closeLegend();
}

onMounted(() => {
  window.addEventListener('keydown', onEsc);
  window.addEventListener('beforeunload', handleBeforeUnload);
  // Déclencher la finalisation si le combat est déjà terminé (ex: replay PvP au chargement)
  if (showBattleResult.value && activePendingBattle.value?.id && !hasFinalized.value && !loading.value) {
    finalizeAndStore();
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', onEsc);
  window.removeEventListener('beforeunload', handleBeforeUnload);
});

/** DOM ids des unités mortes (reste en DOM avec .dead jusqu'à cleanup). */
const deadUnits = ref<Set<string>>(new Set());
const replayRunning = ref(false);
const hoveredUnit = ref<BattlefieldUnit | null>(null);

const replayFrames = ref<ReplayFrame[]>([]);
const replayFrameIndex = ref(0);
let replayTimer: ReturnType<typeof setInterval> | null = null;
const replayLogScrollLock = ref(false);

/** État du moteur local : équipes, seed, modificateur boss, décisions accumulées. */
const engineTeamA = ref<unknown[]>([]);
const engineTeamB = ref<unknown[]>([]);
const engineSeed = ref<number>(1);
const engineBossModifier = ref<unknown>(null);
const combatDecisions = ref<Array<{ action: string; targetCombatIndex: number; skillKey?: string }>>([]);

type ManualAction = 'BASIC' | 'SKILL';
const manualActionChoice = ref<ManualAction | null>(null);
const manualTargetChoice = ref<number | null>(null);
const manualDecisionError = ref('');
const manualSkillHover = ref(false);
/** Survol d’un slot précis (multi-compétences). */
const manualSkillHoverKey = ref<string | null>(null);
/** Slot choisi quand plusieurs compétences actives (clé moteur). */
const manualSelectedSkillKey = ref<string | null>(null);
const autoMode = ref(props.dungeonMode ? !!props.dungeonInitialAutoMode : false);

let __lastAppliedSnapshot: ReplaySnapshot | null = null;
let __lastAppliedTick: number | null = null;

const hasReplayMode = computed(() => (battleResult.value?.replay?.frames?.length ?? 0) > 0);
const replayReachedEnd = computed(() => hasReplayMode.value && replayFrames.value.length > 0 && replayFrameIndex.value >= replayFrames.value.length - 1);
const currentReplaySnapshot = computed((): ReplaySnapshot | null => {
  const frames = replayFrames.value;
  if (!frames.length) return null;
  const i = Math.max(0, Math.min(replayFrameIndex.value, frames.length - 1));
  return frames[i]?.snapshot ?? null;
});

const currentRound = computed(() => currentReplaySnapshot.value?.turn ?? 0);

function getSnapshotFlatUnits(snapshot: ReplaySnapshot | null): Array<Record<string, unknown>> {
  if (!snapshot) return [];
  const anySnap = snapshot as unknown as { units?: Array<Record<string, unknown>>; teams?: Array<{ id: string; units: Array<Record<string, unknown>> }> };
  if (Array.isArray(anySnap.units)) return anySnap.units;
  const teams = Array.isArray(anySnap.teams) ? anySnap.teams : [];
  return teams.flatMap((t) => t.units || []);
}

/** Aligné sur SKILL_TARGET_PRIORITY du moteur (ciblage manuel / prochain événement). */
const MANUAL_SKILL_TARGET_PRIORITY: string[] = [
  'ALLY_DEAD_SINGLE',
  'TEAM_ALLY_DEAD',
  'ENEMY_SINGLE',
  'ALLY_SINGLE',
  'TEAM_ENEMY',
  'TEAM_ALLY',
  'LOWEST_HP_ALLY',
  'SELF'
];

function getAllySingleAutoStrategyFromReplayRow(
  row: { effect?: string; effectConfig?: Record<string, unknown> } | null | undefined
): AllySingleAutoTargetStrategy | null {
  if (!row) return null;
  const effRaw = String(row.effect ?? '').toUpperCase();
  const cfg = row.effectConfig ?? {};
  const buffType = String(cfg.buffType ?? '').toUpperCase();
  const logicalType =
    effRaw === 'APPLY_BUFF' && buffType && buffType !== 'DEBUFF' ? buffType : effRaw;

  if (logicalType === 'HEAL') return 'lowest_hp_pct';
  if (logicalType === 'CLEANSE') return 'most_debuffs';
  if (logicalType === 'ATK_UP') return 'highest_attack';
  if (logicalType === 'ATB_UP') return 'lowest_atb';
  if (logicalType === 'RESET_SKILL_COOLDOWN' || logicalType === 'CD_DOWN') return 'longest_cd';

  const survivability = new Set(['DEF_UP', 'REGEN', 'SHIELD', 'DEFEND', 'INVINCIBILITY']);
  if (survivability.has(logicalType)) return 'lowest_hp_pct';

  return null;
}

function getAllySingleAutoStrategyFromRawEffect(eff: Record<string, unknown> | null | undefined): AllySingleAutoTargetStrategy | null {
  if (!eff) return null;
  const type = String(eff.type ?? '').toUpperCase();
  const buffType = String(eff.buffType ?? eff.buff ?? '').toUpperCase();
  const logicalType = type === 'APPLY_BUFF' && buffType && buffType !== 'DEBUFF' ? buffType : type;
  return getAllySingleAutoStrategyFromReplayRow({
    effect: logicalType,
    effectConfig: { buffType: buffType || undefined }
  });
}

function findActiveSkillDefinitionByKey(
  skillData: Record<string, unknown> | null,
  skillKey: string
): Record<string, unknown> | null {
  if (!skillData || typeof skillData !== 'object') return null;
  const skills = Array.isArray(skillData.skills) ? skillData.skills : [];
  const active = skills.filter(
    (s) => s && typeof s === 'object' && String((s as Record<string, unknown>).type ?? '').toUpperCase() === 'ACTIVE'
  ) as Array<Record<string, unknown>>;
  for (let i = 0; i < active.length; i++) {
    const s = active[i];
    const key = s.id != null ? String(s.id) : `active-${i}`;
    if (key === skillKey) return s;
  }
  const inner = (skillData.skill ?? skillData) as Record<string, unknown>;
  if (inner && typeof inner === 'object' && Array.isArray(inner.effects)) return inner;
  return null;
}

/**
 * Même ordre que performAutoDecision : premier slot prêt avec des cibles, par priorité croissante.
 */
function resolveServerAutoSkillKey(skillSlots: DecisionSkillSlot[] | null | undefined): string | null {
  if (!skillSlots || skillSlots.length === 0) return null;
  const sorted = [...skillSlots].sort((a, b) => Number(a.priority ?? 999) - Number(b.priority ?? 999));
  for (const s of sorted) {
    if (!s.ready) continue;
    const st = s.skillTargets ?? [];
    if (st.length > 0) return String(s.skillKey);
  }
  return null;
}

function computeAllySingleAutoStrategyFromSkillData(
  skillData: Record<string, unknown> | null,
  skillSlots: DecisionSkillSlot[] | null | undefined
): AllySingleAutoTargetStrategy | null {
  if (!skillData || typeof skillData !== 'object') return null;
  const key = resolveServerAutoSkillKey(skillSlots);
  let effects: Array<Record<string, unknown>> = [];
  if (key) {
    const skillDef = findActiveSkillDefinitionByKey(skillData, key);
    if (skillDef && Array.isArray(skillDef.effects)) effects = skillDef.effects as Array<Record<string, unknown>>;
  }
  if (effects.length === 0) {
    const skills = Array.isArray(skillData.skills) ? skillData.skills : [];
    const active = skills.filter(
      (s) => s && typeof s === 'object' && String((s as Record<string, unknown>).type ?? '').toUpperCase() === 'ACTIVE'
    ) as Array<Record<string, unknown>>;
    const first = active[0];
    if (first && Array.isArray(first.effects)) effects = first.effects as Array<Record<string, unknown>>;
  }
  if (effects.length === 0) return null;
  const effectTargets = effects
    .map((e) => String(e.target ?? '').toUpperCase().trim())
    .filter((t) => t.length > 0);
  const preferred = MANUAL_SKILL_TARGET_PRIORITY.find((p) => effectTargets.includes(p));
  if (preferred !== 'ALLY_SINGLE') return null;
  const allyFirst = effects.find((e) => String(e.target ?? '').toUpperCase().trim() === 'ALLY_SINGLE');
  return getAllySingleAutoStrategyFromRawEffect(allyFirst ?? effects[0]);
}

function pickAutoAllySingleTargetCombatIndex(
  pool: Array<{ combatIndex: number; name: string }>,
  strategy: AllySingleAutoTargetStrategy,
  snapshotUnits: Array<Record<string, unknown>>
): number | null {
  if (pool.length <= 1 || !snapshotUnits.length) return null;
  const map = new Map<number, Record<string, unknown>>();
  for (const u of snapshotUnits) {
    const ci = Number(u.combatIndex);
    if (Number.isInteger(ci)) map.set(ci, u);
  }
  const rows = pool
    .map((t) => ({ t, u: map.get(t.combatIndex) }))
    .filter((x): x is { t: { combatIndex: number; name: string }; u: Record<string, unknown> } => Boolean(x.u));
  if (!rows.length) return null;

  const hpRatio = (u: Record<string, unknown>) => {
    const hp = Number(u.hp ?? 0);
    const max = Number(u.maxHp ?? u.hpMax ?? 0);
    if (max > 0) return hp / max;
    return hp > 0 ? 1 : 0;
  };
  const debuffCount = (u: Record<string, unknown>) => {
    const d = u.debuffs;
    return Array.isArray(d) ? d.length : 0;
  };
  const attackVal = (u: Record<string, unknown>) => {
    const a = Number(u.attack ?? u.atk ?? 0);
    return Number.isFinite(a) ? a : 0;
  };
  const atbVal = (u: Record<string, unknown>) => {
    const a = u.atb;
    if (a == null) return 0;
    const n = Number(a);
    return Number.isFinite(n) ? n : 0;
  };
  const skillCdVal = (u: Record<string, unknown>) => {
    const c = Number(u.skillCd ?? 0);
    return Number.isFinite(c) ? c : 0;
  };

  const pickMinRatio = () =>
    rows.reduce((best, cur) => (hpRatio(cur.u) < hpRatio(best.u) ? cur : best));
  const pickMaxDebuffs = () =>
    rows.reduce((best, cur) => (debuffCount(cur.u) > debuffCount(best.u) ? cur : best));
  const pickMaxAtk = () =>
    rows.reduce((best, cur) => (attackVal(cur.u) > attackVal(best.u) ? cur : best));
  const pickMinAtb = () =>
    rows.reduce((best, cur) => (atbVal(cur.u) < atbVal(best.u) ? cur : best));
  const pickMaxCd = () =>
    rows.reduce((best, cur) => (skillCdVal(cur.u) > skillCdVal(best.u) ? cur : best));

  let chosen = rows[0];
  if (strategy === 'lowest_hp_pct') chosen = pickMinRatio();
  else if (strategy === 'most_debuffs') chosen = pickMaxDebuffs();
  else if (strategy === 'highest_attack') chosen = pickMaxAtk();
  else if (strategy === 'lowest_atb') chosen = pickMinAtb();
  else if (strategy === 'longest_cd') chosen = pickMaxCd();
  else return null;

  return chosen.t.combatIndex;
}

const manualDecisionContext = computed(() => {
  try {
  // Accès explicite à replayFrameIndex pour forcer la réévaluation à chaque frame
  // (notamment au point de décision suivant, même si serverDecision ne change pas)
  void replayFrameIndex.value;
  const serverDecision = battleResult.value?.decisionRequest;
  if (serverDecision && Number.isInteger(Number(serverDecision.actorCombatIndex))) {
    const actorIdx = Number(serverDecision.actorCombatIndex);
    const actorUnit = getInitialUnitsNow()[actorIdx] || null;
    const n = teamASize.value ?? 0;
    const rawUnit =
      actorIdx < n
        ? (engineTeamA.value as Record<string, unknown>[])?.[actorIdx]
        : (engineTeamB.value as Record<string, unknown>[])?.[actorIdx - n];
    const skillData =
      rawUnit && typeof rawUnit === 'object' && rawUnit.skill_data
        ? (rawUnit.skill_data as Record<string, unknown>)
        : null;
    const drSlots = (serverDecision as { skillSlots?: DecisionSkillSlot[] }).skillSlots;
    const skillSlots = Array.isArray(drSlots) ? drSlots : null;
    const allySingleAutoTargetStrategy = computeAllySingleAutoStrategyFromSkillData(skillData, skillSlots);
    const mainFromServer = String(
      (serverDecision as { mainSkillDescription?: string }).mainSkillDescription ?? ''
    ).trim();
    /** Tooltip bouton unique : texte aligné moteur/API (multi-compétences si applicable). */
    const skillDesc = (() => {
      if (skillSlots && skillSlots.length > 1) return null;
      const spec =
        rawUnit && typeof rawUnit === 'object'
          ? (rawUnit as { specialization?: string | null }).specialization
          : null;
      if (skillData) {
        const t = getUnitSkillDisplayText(skillData, spec);
        if (t) return t;
      }
      const fromUnit = actorUnit?.skillDescription;
      if (fromUnit && String(fromUnit).trim()) return normalizeSkillDescription(String(fromUnit).trim());
      if (mainFromServer) return normalizeSkillDescription(mainFromServer);
      return null;
    })();
    return {
      actorName: serverDecision.actorName ?? actorUnit?.name ?? 'Unité',
      actorCombatIndex: actorIdx,
      skillDescription: skillDesc,
      skillSlots,
      expectedTargetCombatIndex: null,
      allySingleAutoTargetStrategy,
      skillAvailable: Boolean(serverDecision.skillAvailable),
      skillInCooldown: Number(serverDecision.skillCd ?? 0) > 0,
      skillCd: Number(serverDecision.skillCd ?? 0),
      isStunned: false,
      isProvoked: false,
      basicTargets: Array.isArray(serverDecision.basicTargets) ? serverDecision.basicTargets : [],
      skillTargets: Array.isArray(serverDecision.skillTargets) ? serverDecision.skillTargets : []
    };
  }
  if (!hasReplayMode.value || replayFrameIndex.value >= replayFrames.value.length - 1) return null;
  const nextFrame = replayFrames.value[replayFrameIndex.value + 1];
  const nextEvent = nextFrame?.event as Record<string, unknown> | undefined;
  if (!nextEvent) return null;

  const type = String(nextEvent.type ?? '').toLowerCase();
  const isAttack = type === 'attack';
  const isSkill = type === 'skill' || String(nextEvent.actionType ?? '').toUpperCase() === 'SKILL';
  if (!isAttack && !isSkill) return null;

  const actorId = (nextEvent.actor ?? nextEvent.sourceId ?? null) as string | number | null;
  const actorResolved = resolveUnitFromLogIdSafe(actorId);
  const actorUnit = actorResolved.unit;
  if (!actorUnit || actorUnit.side !== 'A') return null;

  const snapshotUnits = getSnapshotFlatUnits(currentReplaySnapshot.value);
  const actorSnap = snapshotUnits.find((u) => {
    const ci = Number(u.combatIndex);
    return Number.isInteger(ci) && ci === actorResolved.combatIndex;
  });
  const actorDebuffs = Array.isArray(actorSnap?.debuffs) ? actorSnap.debuffs as Array<Record<string, unknown>> : [];
  const isStunned = actorDebuffs.some((d) => String(d?.type ?? '').toUpperCase() === 'STUN');
  const isProvoked = actorDebuffs.some((d) => String(d?.type ?? '').toUpperCase() === 'PROVOKE');

  const actorRole = String(actorSnap?.role ?? (actorUnit.position === 'front' ? 'CAC' : 'DISTANCE')).toUpperCase();
  const actorHasSkill = typeof actorSnap?.hasSkill === 'boolean'
    ? Boolean(actorSnap?.hasSkill)
    : Boolean(actorUnit.skillDescription);
  const actorSkillCdRaw = actorSnap?.skillCd;
  const actorSkillCd = Number.isFinite(Number(actorSkillCdRaw)) ? Number(actorSkillCdRaw) : 0;
  const enemyAlive = snapshotUnits
    .filter((u) => String(u.team ?? '') === 'ENEMY' && (u.isDead !== true) && (u.alive !== false))
    .map((u) => ({ combatIndex: Number(u.combatIndex), role: String(u.role ?? '').toUpperCase() }))
    .filter((u) => Number.isInteger(u.combatIndex) && u.combatIndex >= 0);
  const allyAlive = snapshotUnits
    .filter((u) => String(u.team ?? '') === 'ALLY' && (u.isDead !== true) && (u.alive !== false))
    .map((u) => ({ combatIndex: Number(u.combatIndex), role: String(u.role ?? '').toUpperCase() }))
    .filter((u) => Number.isInteger(u.combatIndex) && u.combatIndex >= 0);

  const allyDead = snapshotUnits
    .filter((u) => String(u.team ?? '') === 'ALLY' && (u.isDead === true || u.alive === false))
    .map((u) => Number(u.combatIndex))
    .filter((ci) => Number.isInteger(ci) && ci >= 0);

  const enemyFrontAlive = enemyAlive.filter((u) => u.role === 'CAC').map((u) => u.combatIndex);
  const enemyBackAlive = enemyAlive.filter((u) => u.role !== 'CAC').map((u) => u.combatIndex);
  const enemyAllAlive = enemyAlive.map((u) => u.combatIndex);
  const allyAllAlive = allyAlive.map((u) => u.combatIndex);

  const basicTargetIndexes = actorRole === 'DISTANCE'
    ? enemyAllAlive
    : (enemyFrontAlive.length > 0 ? enemyFrontAlive : enemyBackAlive);

  const effectsByTarget = Array.isArray(nextEvent.effectsResultsByTarget)
    ? (nextEvent.effectsResultsByTarget as Array<{ effect?: string; effectConfig?: Record<string, unknown>; results?: Array<Record<string, unknown>> }>)
    : [];
  const effectTargets = effectsByTarget
    .map((e) => String(e.effectConfig?.target ?? '').toUpperCase().trim())
    .filter((t) => t.length > 0);
  const preferredTarget = MANUAL_SKILL_TARGET_PRIORITY.find((p) => effectTargets.includes(p));

  const allySingleAutoTargetStrategy: AllySingleAutoTargetStrategy | null =
    preferredTarget === 'ALLY_SINGLE'
      ? getAllySingleAutoStrategyFromReplayRow(
          effectsByTarget.find(
            (e) => String(e.effectConfig?.target ?? '').toUpperCase().trim() === 'ALLY_SINGLE'
          ) ?? effectsByTarget[0]
        )
      : null;

  const expectedTargetRaw = (nextEvent.target ?? nextEvent.targetId ?? (Array.isArray(nextEvent.targets) ? nextEvent.targets[0] : null)) as string | number | null;
  const expectedTargetCombatIndex = getCombatIndexSafe(expectedTargetRaw);
  const forcedProvokeTargets = isProvoked && expectedTargetCombatIndex != null ? [expectedTargetCombatIndex] : [];

  let skillTargetIndexes: number[];
  if (preferredTarget === 'ALLY_DEAD_SINGLE' || preferredTarget === 'TEAM_ALLY_DEAD') {
    skillTargetIndexes = allyDead;
  } else if (preferredTarget === 'ENEMY_SINGLE') {
    skillTargetIndexes = basicTargetIndexes;
  } else if (preferredTarget === 'ALLY_SINGLE') {
    skillTargetIndexes = allyAllAlive;
  } else if (preferredTarget === 'TEAM_ENEMY') {
    skillTargetIndexes = enemyAllAlive;
  } else if (preferredTarget === 'TEAM_ALLY') {
    skillTargetIndexes = allyAllAlive;
  } else if (preferredTarget === 'LOWEST_HP_ALLY') {
    skillTargetIndexes = allyAllAlive;
  } else if (preferredTarget === 'SELF') {
    const actorCi = actorResolved.combatIndex ?? 0;
    skillTargetIndexes = actorCi >= 0 ? [actorCi] : [];
  } else {
    skillTargetIndexes = [...enemyAllAlive, ...allyAllAlive];
  }

  const basicTargets = Array.from(new Set(isProvoked ? forcedProvokeTargets : basicTargetIndexes)).map((ci) => ({
    combatIndex: ci,
    name: getUnitNameByCombatIndexSafe(ci)
  }));
  const skillTargets = Array.from(new Set(isProvoked ? forcedProvokeTargets : skillTargetIndexes)).map((ci) => ({
    combatIndex: ci,
    name: getUnitNameByCombatIndexSafe(ci)
  }));

  const ci = actorResolved.combatIndex ?? 0;
  const sizeA = initialUnitsForBattlefield.value.filter((u) => u.side === 'A').length;
  const rawUnit = ci < sizeA ? (engineTeamA.value as Record<string, unknown>[])?.[ci] : (engineTeamB.value as Record<string, unknown>[])?.[ci - sizeA];
  const sd = rawUnit && typeof rawUnit === 'object' && rawUnit.skill_data
    ? (rawUnit.skill_data as Record<string, unknown>)
    : null;
  const rawActorDesc = (actorUnit as { skillDescription?: string })?.skillDescription?.trim();
  const specReplay =
    rawUnit && typeof rawUnit === 'object'
      ? (rawUnit as { specialization?: string | null }).specialization
      : null;
  const desc = sd
    ? getUnitSkillDisplayText(sd, specReplay) || null
    : rawActorDesc
      ? normalizeSkillDescription(rawActorDesc)
      : null;

  return {
    actorName: actorUnit.name,
    actorCombatIndex: actorResolved.combatIndex,
    skillDescription: desc ?? null,
    skillSlots: null,
    expectedTargetCombatIndex,
    allySingleAutoTargetStrategy,
    skillAvailable: actorHasSkill && actorSkillCd <= 0 && !isStunned && !isProvoked && !actorDebuffs.some((d) => String(d?.type ?? '').toUpperCase() === 'SILENCE'),
    skillInCooldown: actorHasSkill && actorSkillCd > 0,
    skillCd: actorSkillCd,
    isStunned,
    isProvoked,
    basicTargets,
    skillTargets
  };
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[StageModal] manualDecisionContext error', err);
    }
    return null;
  }
});

const manualSkillSlotsMulti = computed(() => {
  const n = manualDecisionContext.value?.skillSlots?.length ?? 0;
  return n > 1;
});

function manualSlotCooldownText(slot: { skillCd?: number }) {
  const cd = Math.max(0, Number(slot.skillCd ?? 0));
  if (cd <= 0) return '';
  return ` (${cd})`;
}

function manualSlotTooltipText(slot: { description?: string }) {
  const d = slot.description != null ? String(slot.description).trim() : '';
  return d;
}

const showManualDecisionPanel = computed(() =>
  hasReplayMode.value &&
  !!manualDecisionContext.value &&
  !manualDecisionContext.value.isStunned &&
  !manualDecisionContext.value.isProvoked &&
  replayFrameIndex.value >= replayFrames.value.length - 1
);

/** Panneau visible (mais grisé) même pendant l'animation, dès qu'un contexte de décision existe. Masqué en Mode Auto. */
const showDecisionPanelVisible = computed(() =>
  hasReplayMode.value &&
  !!manualDecisionContext.value &&
  !manualDecisionContext.value.isStunned &&
  !manualDecisionContext.value.isProvoked &&
  !autoMode.value
);

/** True pendant l'animation (frames en cours), le panneau est affiché mais désactivé. */
const isDecisionPanelWaiting = computed(() =>
  showDecisionPanelVisible.value &&
  replayFrameIndex.value < replayFrames.value.length - 1
);

const showForcedAutoHint = computed(() =>
  hasReplayMode.value &&
  !!manualDecisionContext.value &&
  (manualDecisionContext.value.isStunned || manualDecisionContext.value.isProvoked) &&
  replayFrameIndex.value >= replayFrames.value.length - 1
);

const showAutoModeHint = computed(() =>
  hasReplayMode.value && autoMode.value && !!battleResult.value?.decisionRequest && replayFrameIndex.value >= replayFrames.value.length - 1
);

const forcedAutoHintText = computed(() => {
  const ctx = manualDecisionContext.value;
  if (!ctx) return '';
  if (ctx.isStunned) return `${ctx.actorName} est étourdie : action automatique forcée.`;
  if (ctx.isProvoked) return `${ctx.actorName} est provoquée : attaque de base forcée sur le provocateur.`;
  return '';
});

const manualSkillDescription = computed(() => {
  const raw = manualDecisionContext.value?.skillDescription;
  if (!raw) return '';
  return String(raw).trim();
});
const manualSkillCooldownText = computed(() => {
  const ctx = manualDecisionContext.value;
  if (!ctx) return '';
  if (!ctx.skillInCooldown) return '';
  const cd = Math.max(0, Number(ctx.skillCd ?? 0));
  if (cd <= 0) return '';
  return ` (${cd})`;
});
const manualValidTargets = computed(() => {
  const ctx = manualDecisionContext.value;
  if (!ctx) return [];
  if (ctx.isStunned || ctx.isProvoked) return [];
  // Utilise 'BASIC' par défaut si aucun choix n'a encore été fait (évite les cibles vides au début de chaque tour)
  const effectiveChoice = manualActionChoice.value || 'BASIC';
  let candidates: Array<{ combatIndex: number; name: string }> = [];
  if (effectiveChoice === 'BASIC') candidates = ctx.basicTargets;
  else if (effectiveChoice === 'SKILL') {
    const slots = ctx.skillSlots;
    if (slots && slots.length > 1) {
      const key = manualSelectedSkillKey.value;
      if (!key) candidates = [];
      else {
        const slot = slots.find((s) => String(s.skillKey) === String(key));
        candidates = Array.isArray(slot?.skillTargets) ? slot.skillTargets : [];
      }
    } else {
      candidates = ctx.skillTargets;
    }
  }
  // Le replay est pré-calculé côté moteur: on n'autorise que la cible réellement jouée dans le prochain event.
  if (ctx.expectedTargetCombatIndex != null) {
    return candidates.filter((t) => t.combatIndex === ctx.expectedTargetCombatIndex);
  }
  return candidates;
});
const manualExpectedTargetName = computed(() => {
  const ctx = manualDecisionContext.value;
  if (!ctx || ctx.expectedTargetCombatIndex == null) return null;
  return getUnitNameByCombatIndexSafe(ctx.expectedTargetCombatIndex);
});
/**
 * ID de l'unité active à afficher dans le champ de bataille.
 * Au point de décision, on utilise l'acteur du decisionContext (unité alliée sur le point d'agir)
 * plutôt que le snapshot (qui peut pointer vers l'acteur précédent).
 */
const battlefieldActiveUnitId = computed(() => {
  if (!hasReplayMode.value) return null;
  const ctx = manualDecisionContext.value;
  if (ctx && replayFrameIndex.value >= replayFrames.value.length - 1) {
    const unit = getInitialUnitsNow()[ctx.actorCombatIndex];
    return unit?.id ?? currentReplaySnapshot.value?.activeUnitId ?? null;
  }
  return currentReplaySnapshot.value?.activeUnitId ?? null;
});

const manualTargetableCombatIndexes = computed(() => manualValidTargets.value.map((t) => t.combatIndex));
/** IDs des unités ciblables. Priorité uiUnits (format moteur/snapshot) pour matcher le Battlefield ; fallback initialUnits. */
const manualTargetableUnitIds = computed(() => {
  const indexes = new Set(manualTargetableCombatIndexes.value);
  const ids: string[] = [];
  for (const u of uiUnits.values()) {
    const raw = u as { id?: string; combatIndex?: number };
    const ci = raw.combatIndex;
    if (ci != null && indexes.has(ci) && raw.id) ids.push(String(raw.id));
  }
  if (ids.length === 0 && indexes.size > 0) {
    const units = getInitialUnitsNow();
    return units
      .map((u, i) => ({ id: u.id, combatIndex: i }))
      .filter((x) => indexes.has(x.combatIndex))
      .map((x) => String(x.id));
  }
  return ids;
});
const manualSelectedTargetUnitId = computed(() => {
  if (manualTargetChoice.value == null) return null;
  const units = getInitialUnitsNow();
  const u = units.map((x, i) => ({ ...x, combatIndex: i })).find((x) => x.combatIndex === manualTargetChoice.value);
  return u?.id ?? null;
});

const visibleReplayEvents = computed(() => {
  const frames = replayFrames.value;
  if (!frames.length) return [];
  const i = Math.max(0, Math.min(replayFrameIndex.value, frames.length - 1));
  return frames.slice(0, i + 1).map((f) => f.event).filter((e) => (e?.type ?? '') !== 'init');
});

function handleUnitHover(unit: BattlefieldUnit) {
  hoveredUnit.value = unit;
}

function clearUnitHover() {
  hoveredUnit.value = null;
}

/** HP actuel pour le tooltip (battlefieldHp ou maxHp) */
function currentHp(u: BattlefieldUnit): number {
  const cur = battlefieldHp.value[u.id];
  return cur !== undefined ? Math.max(0, cur) : u.maxHp;
}

/**
 * Index de combat = index dans initialUnitsForBattlefield (ordre moteur).
 * Le moteur peut envoyer sourceId/targetId comme nombre (combatIndex) ou comme id unité (ex. 'A-0').
 */
function getCombatIndex(logId: string | number | null | undefined): number | null {
  if (logId == null || logId === '') return null;
  const units = initialUnitsForBattlefield.value;
  const idx = typeof logId === 'number' ? logId : (typeof logId === 'string' ? parseInt(logId, 10) : NaN);
  if (Number.isInteger(idx) && idx >= 0 && idx < units.length) return idx;
  if (typeof logId === 'string') {
    const i = units.findIndex((u) => String(u.id) === logId || String(u.uid) === logId);
    if (i >= 0) return i;
  }
  return null;
}

/** Résout une unité à partir d'un id du log. Toutes les actions utilisent unitKeyId (pas logId brut). */
function resolveUnitFromLogId(logId: string | number | null | undefined): { combatIndex: number | null; unit: BattlefieldUnit | null; domId: string | null; unitKeyId: string | null } {
  const combatIndex = getCombatIndex(logId);
  const units = initialUnitsForBattlefield.value;
  const unit = combatIndex != null && units[combatIndex] ? units[combatIndex] : null;
  const domId = combatIndex != null ? `unit-${combatIndex}` : null;
  const unitKeyId = unit?.id ?? null;
  return { combatIndex, unit, domId, unitKeyId };
}

const initialUnitsForBattlefield = computed(() => {
  const list = battleResult.value?.initialUnits;
  return Array.isArray(list) ? list : [];
});

/** Description de la compétence pour l'unité survolée (skill_data moteur en priorité — inclut actives + passifs). */
const hoveredUnitSkillDescription = computed(() => {
  const unit = hoveredUnit.value;
  if (!unit) return '';
  const idx = unit.combatIndex;
  if (idx == null || typeof idx !== 'number') return '';
  const sizeA = initialUnitsForBattlefield.value.filter((u) => u.side === 'A').length;
  const raw = idx < sizeA ? (engineTeamA.value as Record<string, unknown>[])?.[idx] : (engineTeamB.value as Record<string, unknown>[])?.[idx - sizeA];
  if (raw && typeof raw === 'object' && raw.skill_data) {
    const spec = (raw as { specialization?: string | null }).specialization;
    const t = getUnitSkillDisplayText(raw.skill_data as Record<string, unknown>, spec);
    if (t) return t;
  }
  const initial = initialUnitsForBattlefield.value[idx];
  const fromInit = (initial as { skillDescription?: string })?.skillDescription?.trim();
  if (fromInit) return normalizeSkillDescription(fromInit);
  return '';
});

/** Couleur du nom de l'unité selon sa rareté (tooltip). Fallback sur initialUnits si uiUnit n'a pas rarity. */
const hoveredUnitRarityStyle = computed(() => {
  const u = hoveredUnit.value;
  if (!u) return {};
  let r = String((u as { rarity?: string }).rarity || '').toLowerCase();
  if (!r) {
    const idx = (u as { combatIndex?: number }).combatIndex;
    const initial = typeof idx === 'number' && idx >= 0 ? initialUnitsForBattlefield.value[idx] : null;
    r = String((initial as { rarity?: string })?.rarity || 'common').toLowerCase();
  }
  const color = rarityColors[r] ?? rarityColors.common;
  return { color };
});

/** Rôle affiché (Tank, DPS, Soutien, Assassin) pour l'unité survolée. */
const hoveredUnitRoleLabel = computed(() => {
  const u = hoveredUnit.value;
  if (!u) return '';
  const hu = u as { unitRole?: string | null; archetype?: string | null; combatIndex?: number };
  let unitRole = hu.unitRole ?? null;
  let archetype = hu.archetype ?? null;
  if (!unitRole && !archetype) {
    const idx = hu.combatIndex;
    const initial = typeof idx === 'number' && idx >= 0 ? initialUnitsForBattlefield.value[idx] : null;
    const init = initial as { role?: string; archetype?: string } | null;
    if (init) {
      unitRole = init.role ?? null;
      archetype = init.archetype ?? null;
    }
  }
  return combatRoleLabel(unitRole, archetype);
});

/** Fatigue de l'unité survolée (équipe joueur uniquement, side A).
 *  En guerre de guilde, la fatigue n'est pas prise en compte : toujours 0 pour le camp A. */
const hoveredUnitFatigue = computed(() => {
  const u = hoveredUnit.value;
  if (!u) return null;
  const hu = u as { fatigue?: number; team?: string; combatIndex?: number };
  const idx = hu.combatIndex;
  const initial = typeof idx === 'number' && idx >= 0 ? initialUnitsForBattlefield.value[idx] : null;
  const init = initial as { fatigue?: number; side?: string } | null;
  if (init?.side !== 'A') return null;
  if (activePendingBattle.value?.battleType === 'guild_war') return 0;
  if (hu.fatigue != null) return hu.fatigue;
  if (init?.fatigue != null) return init.fatigue;
  return null;
});

/** Maîtrise affichée dans le tooltip (unité UI puis unité initiale). */
const hoveredUnitMasteryDisplay = computed(() => {
  const u = hoveredUnit.value;
  if (!u) return '—';
  const hu = u as { mastery?: number; combatIndex?: number };
  const fromUi = hu.mastery;
  if (fromUi != null && Number.isFinite(Number(fromUi))) return Number(fromUi);
  const idx = hu.combatIndex;
  const initial = typeof idx === 'number' && idx >= 0 ? initialUnitsForBattlefield.value[idx] : null;
  const m = (initial as { mastery?: number } | null)?.mastery;
  if (m != null && Number.isFinite(Number(m))) return Number(m);
  return '—';
});

/** combatUnits = ordre exact moteur (teamA puis teamB), avec combatIndex. */
const combatUnitsWithIndex = computed(() =>
  initialUnitsForBattlefield.value.map((u, i) => ({ ...u, combatIndex: i }))
);
const ELEMENT_COLORS: Record<string, string> = {
  WATER: '#3b82f6',
  FIRE: '#ef4444',
  PLANT: '#22c55e',
  NEUTRAL: '#94a3b8'
};
function elementColor(el: string) {
  return ELEMENT_COLORS[String(el || '').toUpperCase()] ?? ELEMENT_COLORS.NEUTRAL;
}

const ELEMENT_LABELS: Record<string, string> = {
  WATER: 'Eau',
  FIRE: 'Feu',
  PLANT: 'Plante',
  NEUTRAL: 'Neutre'
};
function elementLabel(el: string): string {
  return ELEMENT_LABELS[String(el || '').toUpperCase()] ?? String(el || '—');
}
const teamASize = computed(() => initialUnitsForBattlefield.value.filter((u) => u.side === 'A').length);
function unitsForRow(side: 'A' | 'B', position: 'front' | 'back') {
  const dead = deadUnitIds.value;
  if (hasReplayMode.value) {
    return combatUnitsWithIndex.value.filter((u) => u.side === side && u.position === position);
  }
  return combatUnitsWithIndex.value.filter(
    (u) => u.side === side && u.position === position && !dead.has(u.id)
  );
}

function hpPercent(u: BattlefieldUnit) {
  const current = battlefieldHp.value[u.id];
  if (current !== undefined) return Math.max(0, Math.min(100, (current / u.maxHp) * 100));
  return 100;
}

type BattleLogEvent = {
  turn: number;
  type: string;
  sourceId: string | number | null;
  sourceName: string | null;
  targetId: string | number | null;
  targetName: string | null;
  value: number | null;
  meta?: Record<string, unknown>;
  actionType?: string;
  actorId?: string | number | null;
  actorName?: string | null;
  isCrit?: boolean;
  isBlocked?: boolean;
  extra?: { skillName?: string | null; debuffType?: string; duration?: number; [k: string]: unknown };
};

const CAMPAIGN_LAST_PRESET_KEY = 'nexus_campaign_last_preset_index';
const presets = ref<PresetItem[]>([]);
const selectedPresetIndex = ref<number | null>(null);
/** Map user_unit_id -> fatigue (depuis /collection) pour afficher la fatigue moyenne des presets */
const collectionFatigueByUnitId = ref<Map<number, number>>(new Map());
/** Unités non utilisables au combat (0 PV effectifs, blessure, etc.) — clé = user_unit_id */
const collectionCannotFightByUnitId = ref<Map<number, boolean>>(new Map());

function collectionUnitUnfit(u: Record<string, unknown>): boolean {
  const inj = Number(u.injury_level ?? 0);
  const knocked = Number(u.is_injured ?? 0);
  if (knocked === 1 || inj > 0) return true;
  const maxHp = Number(u.maxHp ?? u.base_hp ?? 0);
  return !Number.isFinite(maxHp) || maxHp <= 0;
}

const hasAnyPreset = computed(() => presets.value.some((p) => (p.front_slots?.length || 0) + (p.back_slots?.length || 0) > 0));
const presetsWithUnits = computed(() => presets.value.filter((p) => (p.front_slots?.length || 0) + (p.back_slots?.length || 0) > 0));

const teamToUse = computed(() => {
  if (selectedPresetIndex.value != null) {
    const p = presets.value.find((x) => x.preset_index === selectedPresetIndex.value);
    if (p) {
      const front = (p.front_slots || []).map((id) => ({ user_unit_id: id, position: 'front' as const }));
      const back = (p.back_slots || []).map((id) => ({ user_unit_id: id, position: 'back' as const }));
      return [...front, ...back];
    }
  }
  return props.campaignTeam || [];
});

const presetHasUnfitUnits = computed(() => {
  const team = teamToUse.value;
  if (!team?.length) return false;
  const map = collectionCannotFightByUnitId.value;
  return team.some((slot) => map.get(Number(slot.user_unit_id)) === true);
});

const presetUnfitMessage =
  'Impossible de lancer le combat : au moins une unité du preset a des PV à zéro ou est blessée. Soigne tes unités dans la collection.';

const canFight = computed(
  () => (teamToUse.value?.length ?? 0) >= 1 && !presetHasUnfitUnits.value
);

const rewardsText = computed(() => {
  const r = battleResult.value?.rewardsGranted;
  if (!r) return 'XP attribuée aux survivants.';
  const parts: string[] = [];
  if (r.credits) parts.push(`Credits +${r.credits}`);
  if (r.cores) parts.push(`Cores +${r.cores}`);
  if (r.fragments) parts.push(`Fragments +${r.fragments}`);
  if (r.ascension_essence) parts.push(`Essence +${r.ascension_essence}`);
  return parts.length ? parts.join(' · ') : 'XP attribuée aux survivants.';
});

/** Lignes de récompenses à afficher dans l'encadré Victoire/Défaite (depuis battle/finalize). */
const battleRewardsDisplay = computed((): string[] => {
  const r = battleFinalizeResult.value;
  if (!r || !showBattleResult.value) return [];
  const lines: string[] = [];
  const bt = String(r.battleType ?? '').toLowerCase();

  if (bt === 'dungeon') {
    const gold = Number(r.gold_gained ?? 0);
    if (gold > 0) lines.push(`Or : +${gold}`);
    if (r.artifact_drop) lines.push('Artefact');
    if (r.dungeonLevelComplete) lines.push('Niveau terminé');
  } else if (bt === 'campaign') {
    const xp = Number(r.xp_per_unit ?? 0);
    if (xp > 0) lines.push(`XP par unité : +${xp}`);
    const rg = r.rewardsGranted as Record<string, number> | undefined;
    if (rg) {
      if (rg.credits) lines.push(`Crédits : +${rg.credits}`);
      if (rg.cores) lines.push(`Cores : +${rg.cores}`);
      if (rg.fragments) lines.push(`Fragments : +${rg.fragments}`);
      if (rg.ascension_essence) lines.push(`Essence : +${rg.ascension_essence}`);
    }
    if (r.artifact_drop) lines.push('Artefact');
  } else if (bt === 'pvp') {
    const xp = Number(r.xp_granted ?? 0);
    if (xp > 0) lines.push(`XP : +${xp}`);
    const gold = Number(r.gold_gained ?? 0);
    if (gold > 0) lines.push(`Or : +${gold}`);
    const credits = Number(r.credits_gained ?? 0);
    if (credits > 0) lines.push(`Crédits : +${credits}`);
    if (r.artifact_drop) lines.push('Artefact');
  } else {
    /* Fallback : guilde, ou format inattendu — afficher au moins l'or */
    const gold = Number(r.gold_gained ?? 0);
    if (gold > 0) lines.push(`Or : +${gold}`);
  }

  return lines;
});

const resultClass = computed(() => {
  if (battleResult.value?.result === 'win') return 'victory';
  if (battleResult.value?.result === 'draw') return 'draw';
  return 'defeat';
});
const resultText = computed(() => {
  if (battleResult.value?.result === 'win') return 'Victoire';
  if (battleResult.value?.result === 'draw') return 'Égalité';
  return 'Défaite';
});

/** Garantit type, sourceName, targetName, value, meta pour l'affichage (ancien + nouveau format API). */
function safeStr(v: unknown): string {
  if (v == null || v === undefined) return '?';
  const s = String(v);
  return s === 'undefined' || s === 'null' ? '?' : s;
}

function normalizeBattleEvent(e: Record<string, unknown>): NormalizedBattleEvent {
  const extra = (e.extra && typeof e.extra === 'object' ? e.extra : {}) as Record<string, unknown>;
  const type = e.type ?? e.actionType ?? 'UNKNOWN';
  const sourceName = e.sourceName ?? e.actorName ?? e.actor ?? null;
  const targetName = e.targetName ?? e.target ?? extra?.targetName ?? null;
  return {
    turn: Number(e.turn) || 0,
    type: safeStr(type),
    sourceName: sourceName != null ? String(sourceName) : null,
    targetName: targetName != null ? String(targetName) : null,
    value: (e.value ?? e.damage ?? e.heal ?? null) as number | null,
    meta: (e.meta && typeof e.meta === 'object' ? e.meta : extra) as Record<string, unknown>,
    sourceId: (e.sourceId ?? e.actorId ?? null) as string | number | null,
    targetId: (e.targetId ?? null) as string | number | null,
    isCrit: Boolean(e.isCrit ?? (e.meta && typeof e.meta === 'object' && (e.meta as Record<string, unknown>).isCrit)),
    isBlocked: Boolean(e.isBlocked)
  };
}

type NormalizedBattleEvent = {
  turn: number;
  type: string;
  sourceName: string | null;
  targetName: string | null;
  value: number | null;
  meta: Record<string, unknown>;
  sourceId?: string | number | null;
  targetId?: string | number | null;
  isCrit?: boolean;
  isBlocked?: boolean;
};

const normalizedBattleLog = computed(() => {
  const log = battleResult.value?.battleLog;
  if (!Array.isArray(log)) return [];
  return log.map((e) => normalizeBattleEvent(e as Record<string, unknown>));
});

function presetDisplayName(p: PresetItem): string {
  const name = (p.preset_name || '').trim();
  const base = name || 'Preset ' + p.preset_index;
  const avgFatigue = averagePresetFatigue(p);
  if (avgFatigue != null) return `${base} (fatigue moy. : ${Math.round(avgFatigue)})`;
  return base;
}

function averagePresetFatigue(p: PresetItem): number | null {
  const units = [...(p.front_units || []), ...(p.back_units || [])];
  const unitIds = [...new Set([...(p.front_slots || []), ...(p.back_slots || [])])];
  if (units.length === 0 && unitIds.length === 0) return null;
  let sum = 0;
  let count = 0;
  if (units.length > 0) {
    for (const u of units) {
      const f = u.fatigue;
      if (typeof f === 'number' || (f != null && !Number.isNaN(Number(f)))) {
        sum += Number(f);
        count++;
      } else if (u.user_unit_id != null) {
        const fromColl = collectionFatigueByUnitId.value.get(Number(u.user_unit_id));
        if (fromColl != null) {
          sum += fromColl;
          count++;
        }
      }
    }
  }
  if (count === 0 && unitIds.length > 0) {
    const fatigueMap = collectionFatigueByUnitId.value;
    for (const id of unitIds) {
      const f = fatigueMap.get(Number(id));
      if (f != null) {
        sum += f;
        count++;
      }
    }
  }
  if (count === 0) return null;
  return sum / count;
}

function hydrateBattleState(payload: {
  id?: number;
  battleType?: 'campaign' | 'pvp' | 'guild_war' | 'dungeon';
  title?: string;
  result?: string;
  finalizeData?: { team?: Array<{ user_unit_id: number }>; attackerUserUnitIds?: number[]; attackerUnitIds?: number[] };
  battleLog?: unknown[];
  initialUnits?: BattlefieldUnit[];
  replay?: { seed?: number; frames: ReplayFrame[] };
  summary?: { totalTurns?: number; playerUnitsAlive?: number; enemyUnitsAlive?: number };
  decisionRequest?: {
    actorCombatIndex: number;
    actorName: string;
    skillAvailable: boolean;
    skillCd?: number;
    mainSkillDescription?: string;
    skillSlots?: DecisionSkillSlot[] | null;
    basicTargets: Array<{ combatIndex: number; name: string }>;
    skillTargets: Array<{ combatIndex: number; name: string }>;
  } | null;
  enemyTeamLabel?: string;
  interactiveSession?: { seed: number; bossModifier?: unknown; teamA: unknown[]; teamB: unknown[] };
}) {
  hasFinalized.value = false;
  battleFinalizeResult.value = null;
  // Extraire et stocker les paramètres du moteur local
  const session = payload.interactiveSession;
  const pPayload = payload as { chapter?: number; stage?: number; mode?: string };
  const ch10St10 = Number(pPayload.chapter) === 10 && Number(pPayload.stage) === 10;
  const bossModifierFallback = ch10St10
    ? { resurrectOnce: true, resurrectThenDot: pPayload.mode === 'hard' }
    : null;
  // Pour ch10 st10 : garantir resurrectOnce même si le payload a perdu bossModifier
  const sessionMod = session?.bossModifier as Record<string, unknown> | null | undefined;
  const effectiveBossModifier = ch10St10 && !sessionMod?.resurrectOnce
    ? bossModifierFallback
    : (session?.bossModifier ?? bossModifierFallback);
  if (session?.teamA?.length && session?.teamB?.length) {
    engineTeamA.value = session.teamA;
    engineTeamB.value = session.teamB;
    engineSeed.value = Number(session.seed) || (Date.now() % 2147483647);
    engineBossModifier.value = effectiveBossModifier;
    combatDecisions.value = [];
  } else {
    engineTeamA.value = [];
    engineTeamB.value = [];
    engineBossModifier.value = null;
  }

  activePendingBattle.value = payload.id && payload.battleType
    ? { id: payload.id, battleType: payload.battleType, title: payload.title, enemyTeamLabel: payload.enemyTeamLabel }
    : null;
  const p = payload as { finalizeData?: { team?: Array<{ user_unit_id: number }>; attackerUserUnitIds?: number[]; attackerUnitIds?: number[] } };
  finalizeDataRef.value = p?.finalizeData ?? null;
  battleError.value = '';

  const hasLocalEngine = engineTeamA.value.length > 0 && engineTeamB.value.length > 0;
  battleResult.value = {
    result: hasLocalEngine ? null : (payload.result === 'win' || payload.result === 'loss' || payload.result === 'draw' ? payload.result : null),
    success: hasLocalEngine ? null : (payload.result === 'win' ? true : (payload.result === 'loss' || payload.result === 'draw' ? false : null)),
    rewardsGranted: null,
    battleLog: hasLocalEngine ? [] : (Array.isArray(payload.battleLog) ? payload.battleLog as BattleLogEvent[] : []),
    initialUnits: payload.initialUnits,
    replay: hasLocalEngine ? undefined : payload.replay,
    decisionRequest: hasLocalEngine ? null : (payload.decisionRequest ?? null),
    summary: payload.summary ? {
      totalTurns: payload.summary.totalTurns ?? 0,
      playerUnitsAlive: payload.summary.playerUnitsAlive ?? 0,
      enemyUnitsAlive: payload.summary.enemyUnitsAlive ?? 0
    } : undefined
  };
  replayFrames.value = hasLocalEngine ? [] : (payload.replay?.frames ?? []);
  replayFrameIndex.value = 0;
  manualActionChoice.value = null;
  manualTargetChoice.value = null;
  manualDecisionError.value = '';
  if (replayTimer) clearInterval(replayTimer);
  replayTimer = null;

  nextTick(() => {
    initBattlefieldHp();
    if (hasLocalEngine) {
      // Lancer le moteur localement (décisions = []) pour obtenir les premiers frames
      runEngineLocally(true);
    } else if (replayFrames.value.length > 0) {
      // Fallback : replay pré-calculé (standaloneReplay PvP, etc.)
      const hasDecisionRequest = !!payload.decisionRequest;
      if (hasDecisionRequest) {
        applyReplaySnapshotToBattlefield(currentReplaySnapshot.value);
      } else {
        startReplayPlaybackFromStart();
      }
    }
  });
}

/**
 * Après un tour de moteur : positionner l'index de replay, réappliquer la snapshot, relancer le flux auto/replay.
 * En onglet masqué, exécution synchrone (sans nextTick) pour ne pas dépendre des timers ralentis par le navigateur.
 */
function applyEngineRunAftermath(isFirstRun: boolean, prevFrameIdx: number) {
  if (isFirstRun) {
    // Sauter directement au dernier frame pour afficher les ATB correctes dès le début
    const lastFrameIdx = Math.max(0, replayFrames.value.length - 1);
    replayFrameIndex.value = lastFrameIdx;
    initBattlefieldHp();
    // Réinitialiser la déduplication : après initBattlefieldHp, la snapshot doit toujours être
    // réappliquée (sinon si lastFrameIdx=0, le watch a déjà enregistré cette snapshot
    // et la déduplication bloque la réapplication → ATB restent à 0).
    __lastAppliedSnapshot = null;
    __lastAppliedTick = null;
  } else {
    // Si l'index ne change pas (ex: prevFrameIdx=0 sur 2e décision), Vue ne déclenchera
    // pas le watch. On force un "bump" via une valeur temporaire puis on revient.
    const target = Math.max(0, prevFrameIdx);
    if (replayFrameIndex.value === target) {
      // Forcer la réinitialisation de la déduplication pour re-appliquer le snapshot
      __lastAppliedSnapshot = null;
      __lastAppliedTick = null;
    }
    replayFrameIndex.value = target;
  }
  applyReplaySnapshotToBattlefield(currentReplaySnapshot.value);
  stopReplayTimer();
  startManualAutoFlow();
}

/**
 * Lance le moteur de combat localement avec les équipes et décisions courantes.
 * Met à jour battleResult, replayFrames, puis redémarre l'animation depuis la position courante.
 */
function runEngineLocally(isFirstRun = false) {
  if (!engineTeamA.value.length || !engineTeamB.value.length) return;
  const prevFrameIdx = replayFrameIndex.value;

  // Ch10 st10 : garantir bossModifier (résurrection) même si absent du payload
  let bossMod = engineBossModifier.value as { resurrectOnce?: boolean; resurrectThenDot?: boolean } | null | undefined;
  if (!bossMod?.resurrectOnce && props.chapter === 10 && props.stage === 10) {
    bossMod = props.mode === 'hard'
      ? { resurrectOnce: true, resurrectThenDot: true }
      : { resurrectOnce: true };
  }
  const log = (simulateBattle as (a: unknown[], b: unknown[], c: unknown) => {
    summary?: { winner?: string; totalTurns?: number; totalRounds?: number; playerUnitsAlive?: number; enemyUnitsAlive?: number };
    battleLog?: unknown[];
    replay?: { seed?: number; frames: ReplayFrame[] };
    decisionRequest?: {
      actorCombatIndex: number;
      actorName: string;
      skillAvailable: boolean;
      skillCd?: number;
      mainSkillDescription?: string;
      skillSlots?: DecisionSkillSlot[] | null;
      basicTargets: Array<{ combatIndex: number; name: string }>;
      skillTargets: Array<{ combatIndex: number; name: string }>;
    } | null;
  })(engineTeamA.value, engineTeamB.value, {
    seed: engineSeed.value,
    bossModifier: bossMod || undefined,
    interactive: true,
    decisions: [...combatDecisions.value]
  });

  const winner = log.summary?.winner;
  if (battleResult.value) {
    battleResult.value = {
      ...battleResult.value,
      result: winner === 'A' ? 'win' : winner === 'B' ? 'loss' : (winner === 'draw' ? 'draw' : null),
      success: winner === 'A' ? true : (winner != null && winner !== 'A' && winner !== 'awaiting_player_action' ? false : null),
      battleLog: log.battleLog as BattleLogEvent[] ?? [],
      replay: log.replay ? { seed: log.replay.seed, frames: log.replay.frames ?? [] } : battleResult.value.replay,
      decisionRequest: log.decisionRequest ?? null,
      summary: log.summary ? {
        totalTurns: log.summary.totalTurns ?? log.summary.totalRounds ?? 0,
        playerUnitsAlive: log.summary.playerUnitsAlive ?? 0,
        enemyUnitsAlive: log.summary.enemyUnitsAlive ?? 0
      } : battleResult.value.summary
    };
  }
  replayFrames.value = log.replay?.frames ?? [];

  // Réinitialiser les champs de saisie de décision
  manualActionChoice.value = null;
  manualTargetChoice.value = null;
  manualSelectedSkillKey.value = null;
  manualSkillHoverKey.value = null;
  manualDecisionError.value = '';

  const scheduleAftermath = () => applyEngineRunAftermath(isFirstRun, prevFrameIdx);
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    scheduleAftermath();
  } else {
    nextTick(scheduleAftermath);
  }
}

watch(
  () => [props.show, props.standaloneReplay, props.pendingBattle] as const,
  ([show, standalone, pendingBattle]) => {
    if (show && pendingBattle) {
      hydrateBattleState(pendingBattle);
      return;
    }
    if (show && standalone) {
      hydrateBattleState(standalone);
      return;
    }
    if (!show) {
      activePendingBattle.value = null;
    }
  },
  { immediate: true }
);

watch(
  () => [props.show, props.chapter, props.stage, props.mode] as const,
  async ([show, ch, st, mode]) => {
    if (props.standaloneReplay || props.pendingBattle || props.dungeonMode) return;
    battleResult.value = null;
    battleError.value = '';
    if (!show || !ch || !st) {
      rewardsPreview.value = null;
      return;
    }
    try {
      const { data } = await api.get('/campaign/rewards', {
        params: { chapter: ch, stage: st, mode: mode || 'normal' }
      });
      rewardsPreview.value = data;
    } catch {
      rewardsPreview.value = null;
    }
    if (show) {
      try {
        const [presetsRes, collectionRes] = await Promise.all([
          api.get('/team/presets'),
          api.get('/collection').catch(() => ({ data: { units: [] } }))
        ]);
        presets.value = presetsRes.data?.presets || [];
        const units = Array.isArray(collectionRes.data?.units) ? collectionRes.data.units : [];
        const map = new Map<number, number>();
        const unfit = new Map<number, boolean>();
        for (const u of units) {
          const raw = u as Record<string, unknown>;
          const id = raw?.user_unit_id ?? raw?.id;
          const f = raw?.fatigue;
          if (id != null && (typeof f === 'number' || (f != null && !Number.isNaN(Number(f))))) {
            map.set(Number(id), Math.min(100, Math.max(0, Number(f))));
          }
          if (id != null) {
            unfit.set(Number(id), collectionUnitUnfit(raw));
          }
        }
        collectionFatigueByUnitId.value = map;
        collectionCannotFightByUnitId.value = unfit;
        const withUnits = (presetsRes.data?.presets || []).filter((p: PresetItem) => ((p.front_slots?.length || 0) + (p.back_slots?.length || 0)) > 0);
        const lastUsed = (() => {
          try {
            const s = localStorage.getItem(CAMPAIGN_LAST_PRESET_KEY);
            if (s != null) {
              const n = parseInt(s, 10);
              if (!Number.isNaN(n) && withUnits.some((p: PresetItem) => p.preset_index === n)) return n;
            }
          } catch {}
          return null;
        })();
        selectedPresetIndex.value = lastUsed ?? (withUnits.length ? withUnits[0].preset_index : null);
      } catch {
        presets.value = [];
        collectionFatigueByUnitId.value = new Map();
        collectionCannotFightByUnitId.value = new Map();
        selectedPresetIndex.value = null;
      }
    }
  },
  { immediate: true }
);

async function startBattle() {
  if (!canFight.value || !props.stageInfo?.available || loading.value) return;
  loading.value = true;
  battleError.value = '';
  try {
    const p = presets.value.find((x) => x.preset_index === selectedPresetIndex.value);
    const selectedNoyauIndex = p?.selected_noyau_index ?? 0;
    const { data } = await api.post('/campaign/start', {
      mode: props.mode,
      chapter: props.chapter,
      stage: props.stage,
      team: teamToUse.value,
      selected_noyau_index: selectedNoyauIndex
    });
    if (!data?.pendingBattle) {
      throw new Error('PENDING_BATTLE_MISSING');
    }
    hydrateBattleState(data.pendingBattle);
    if (selectedPresetIndex.value != null) {
      try {
        localStorage.setItem(CAMPAIGN_LAST_PRESET_KEY, String(selectedPresetIndex.value));
      } catch {}
    }
    if (typeof console !== 'undefined' && console.table && battleResult.value.battleLog?.length) {
      console.table(battleResult.value.battleLog);
    }
  } catch (e: any) {
    const pendingBattle = e.response?.data?.pendingBattle;
    if (pendingBattle) {
      hydrateBattleState(pendingBattle);
      if (selectedPresetIndex.value != null) {
        try {
          localStorage.setItem(CAMPAIGN_LAST_PRESET_KEY, String(selectedPresetIndex.value));
        } catch {}
      }
      return;
    }
    const msg = e.response?.data?.message || e.response?.data?.error || e?.message || 'Erreur combat';
    battleResult.value = null;
    activePendingBattle.value = null;
    battleError.value = msg;
    console.error(msg);
  } finally {
    loading.value = false;
  }
}

const logColumnARef = ref<HTMLElement | null>(null);
const logColumnBRef = ref<HTMLElement | null>(null);

function appendLogText(_text: string, _color = '#ccc') {
  // Used only as fallback; real logs go via pushLog in processLog
  const logContainer = logColumnARef.value ?? logColumnBRef.value;
  if (!logContainer) return;
  logContainer.scrollTop = logContainer.scrollHeight;
}

function initBattlefieldHp() {
  const units = battleResult.value?.initialUnits ?? [];
  const next: Record<string, number> = {};
  uiUnits.clear();
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const initU = u as { archetype?: string; role?: string; fatigue?: number };
    next[u.id] = u.maxHp;
    uiUnits.set(u.id, {
      id: u.id,
      name: u.name,
      image_url: u.image_url ?? null,
      element: u.element,
      team: u.side === 'A' ? 'ALLY' : 'ENEMY',
      role: u.position === 'front' ? 'CAC' : 'DISTANCE',
      unitRole: initU.role ?? null,
      archetype: initU.archetype ?? null,
      fatigue: initU.fatigue ?? 0,
      combatIndex: i,
      hp: u.maxHp,
      maxHp: u.maxHp,
      atb: 0,
      buffs: [],
      debuffs: [],
      isDead: false,
      attack: u.attack,
      defense: u.defense,
      speed: u.speed,
      mastery: (u as { mastery?: number }).mastery,
      level: u.level,
      rarity: (u as { rarity?: string }).rarity ?? 'common'
    });
  }
  battlefieldHp.value = next;
  deadUnitIds.value = new Set();
  deadUnits.value = new Set();
}

function getNameByCombatIndex(combatIndex: number | null | undefined): string {
  if (combatIndex == null) return '?';
  const units = initialUnitsForBattlefield.value;
  const u = units[combatIndex];
  return u?.name ?? String(combatIndex);
}

function applyReplaySnapshotToBattlefield(snapshot: ReplaySnapshot | null) {
  const flatUnits = (snapshot as { units?: ReplaySnapshotUnit[] })?.units ?? snapshot?.teams?.flatMap((t) => t.units);
  if (!flatUnits?.length) return;
  const tick = (snapshot as { tick?: number }).tick ?? (snapshot as { meta?: { tick?: number } }).meta?.tick ?? null;
  if (tick !== null) {
    if (__lastAppliedTick === tick) return;
    __lastAppliedTick = tick;
  } else {
    if (snapshot === __lastAppliedSnapshot) return;
    __lastAppliedSnapshot = snapshot;
  }
  const initial = initialUnitsForBattlefield.value;
  const byId = new Map(initial.map((u) => [u.id, u]));
  uiUnits.clear();
  for (const u of flatUnits) {
    const raw = u as Record<string, unknown>;
    const combatIdx = u.combatIndex ?? 0;
    const initialUnit = (combatIdx >= 0 && combatIdx < initial.length ? initial[combatIdx] : null) ?? byId.get(u.id);
    const initU = initialUnit as { archetype?: string; role?: string; fatigue?: number } | null;
    uiUnits.set(u.id, {
      id: u.id,
      name: u.name,
      image_url: (raw.image_url as string) ?? (initialUnit as Record<string, unknown>)?.image_url ?? null,
      element: raw.element ?? initialUnit?.element ?? '',
      team: raw.team ?? (initialUnit?.side === 'A' ? 'ALLY' : initialUnit?.side === 'B' ? 'ENEMY' : ''),
      role: raw.role ?? (initialUnit?.position === 'front' ? 'CAC' : 'DISTANCE'),
      unitRole: (raw.unitRole as string) ?? initU?.role ?? null,
      archetype: (raw.archetype as string) ?? initU?.archetype ?? null,
      fatigue: (raw.fatigue as number) ?? initU?.fatigue ?? 0,
      combatIndex: u.combatIndex ?? 0,
      hp: u.hp,
      maxHp: u.hpMax ?? (raw.maxHp as number) ?? initialUnit?.maxHp ?? 100,
      atb: raw.atb ?? 0,
      buffs: u.buffs ?? [],
      debuffs: u.debuffs ?? [],
      isDead: (raw.isDead as boolean) ?? !u.alive,
      attack: (raw.attack as number) ?? (initialUnit as Record<string, unknown>)?.attack,
      defense: (raw.defense as number) ?? (initialUnit as Record<string, unknown>)?.defense,
      speed: (raw.speed as number) ?? (initialUnit as Record<string, unknown>)?.speed,
      mastery:
        (raw.mastery as number) ??
        (initialUnit as Record<string, unknown>)?.mastery as number | undefined,
      level: (raw.level as number) ?? (initialUnit as Record<string, unknown>)?.level,
      rarity: (raw.rarity as string) ?? (initialUnit as Record<string, unknown>)?.rarity ?? 'common'
    });
  }
  if (typeof console !== 'undefined' && console.log) {
    console.log('UI Units:', Array.from(uiUnits.values()));
  }
  const hp: Record<string, number> = {};
  const dead = new Set<string>();
  for (const u of flatUnits) {
    hp[u.id] = u.hp;
    if (!u.alive) dead.add(u.id);
  }
  for (const u of initial) {
    if (hp[u.id] === undefined) hp[u.id] = u.maxHp ?? 0;
  }
  battlefieldHp.value = hp;
  deadUnitIds.value = dead;
  deadUnits.value = new Set();
}

function expandSkillEventsToFlat(events: Record<string, unknown>[]): Record<string, unknown>[] {
  const flat: Record<string, unknown>[] = [];
  const skillIdOf = (ev: Record<string, unknown>, actor: unknown) =>
    (ev.skillId ?? ev.skillName ?? ev.skillIndex ?? actor) as string | number | null;
  for (const ev of events) {
    const type = String(ev.type ?? '').toLowerCase();
    if (type === 'skill') {
      const effectsResultsByTarget = ev.effectsResultsByTarget as Array<{
        effect: string;
        effectConfig?: Record<string, unknown>;
        results: Array<Record<string, unknown>>;
      }> | undefined;
      const actor = ev.actor ?? null;
      if (Array.isArray(effectsResultsByTarget)) {
        for (const { effect: effType, effectConfig: cfg, results } of effectsResultsByTarget) {
          const eff = String(effType ?? '').toUpperCase();
          for (const r of results || []) {
            const targetId = r.targetCombatIndex ?? r.targetUid ?? null;
            const skillId = skillIdOf(ev, actor);
            if (eff === 'APPLY_BUFF' && (r.shieldAmount ?? 0) > 0) {
              flat.push({
                type: 'SHIELD_GAIN',
                sourceId: actor,
                targetId,
                value: r.shieldAmount,
                meta: cfg
              });
              continue;
            }
            if (eff === 'APPLY_BUFF' || eff === 'APPLY_DEBUFF') {
              if (!r.applied && eff !== 'APPLY_DEBUFF') continue;
              const buffType = String((r as Record<string, unknown>).buffType ?? (cfg as Record<string, unknown>)?.buffType ?? '').toUpperCase();
              const remainingActions = Number((r as Record<string, unknown>).remainingActions ?? (cfg as Record<string, unknown>)?.remainingActions ?? 1);
              const value = (r as Record<string, unknown>).value ?? (r as Record<string, unknown>).shieldAmount ?? (cfg as Record<string, unknown>)?.value ?? undefined;
              flat.push({
                type: eff,
                sourceId: actor,
                targetId,
                buffType: buffType || (eff === 'APPLY_DEBUFF' ? 'DEBUFF' : 'BUFF'),
                remainingActions,
                value,
                meta: cfg
              });
              continue;
            }
            if (eff === 'DAMAGE' && (r.effectiveDamage != null || (r as Record<string, unknown>).value != null)) {
              const value = r.effectiveDamage ?? (r as Record<string, unknown>).value;
              flat.push({
                type: 'DAMAGE',
                sourceId: actor,
                targetId,
                value,
                skillId,
                isCrit: !!(r as Record<string, unknown>).isCrit,
                meta: cfg
              });
              continue;
            }
            if (eff === 'HEAL' && (r.healAmount ?? 0) > 0) {
              flat.push({
                type: 'HEAL',
                sourceId: actor,
                targetId,
                value: r.healAmount,
                skillId,
                meta: cfg
              });
              continue;
            }
            if (eff === 'STRIP' && (r.removed ?? 0) > 0) {
              const removedBuffs = (r.removedBuffs as Array<{ buffType?: string; value?: number | null }>) ?? [];
              flat.push({
                type: 'REMOVE_BUFF',
                sourceId: actor,
                targetId,
                removed: removedBuffs,
                count: r.removed,
                meta: cfg
              });
              continue;
            }
            if (eff === 'CLEANSE' && (r.removed ?? 0) > 0) {
              const removedDebuffs = (r.removedDebuffs as Array<{ debuffType?: string; value?: number | null }>) ?? [];
              flat.push({
                type: 'REMOVE_DEBUFF',
                sourceId: actor,
                targetId,
                removed: removedDebuffs,
                count: r.removed,
                meta: cfg
              });
              continue;
            }
            if (eff === 'REDUCE_ATB' && r.applied) {
              flat.push({
                type: 'ATB_CHANGE',
                sourceId: actor,
                targetId,
                value: (r as Record<string, unknown>).value ?? (cfg as Record<string, unknown>)?.percent ?? 0,
                skillId,
                meta: cfg
              });
              continue;
            }
            if (eff === 'RESET_SKILL_COOLDOWN' && (r.applied || r.after === 0)) {
              flat.push({
                type: 'RESET_SKILL_COOLDOWN',
                sourceId: actor,
                targetId,
                value: r.after ?? 0,
                before: r.before ?? null,
                after: r.after ?? 0,
                baseCooldown: r.baseCooldown ?? null,
                skillId,
                meta: cfg
              });
              continue;
            }
            if (eff === 'SET_SKILL_COOLDOWN_MAX' && r.applied) {
              flat.push({
                type: 'SET_SKILL_COOLDOWN_MAX',
                sourceId: actor,
                targetId,
                value: r.after ?? r.baseCooldown ?? 0,
                before: r.before ?? null,
                after: r.after ?? null,
                baseCooldown: r.baseCooldown ?? null,
                skillId,
                meta: cfg
              });
              continue;
            }
            if (eff === 'CD_UP' && r.applied) {
              flat.push({
                type: 'CD_UP',
                sourceId: actor,
                targetId,
                value: r.delta ?? (cfg as Record<string, unknown>)?.value ?? 0,
                before: r.before ?? null,
                after: r.after ?? null,
                delta: r.delta ?? null,
                skillId,
                meta: cfg
              });
              continue;
            }
            if (eff === 'CD_DOWN' && r.applied) {
              flat.push({
                type: 'CD_DOWN',
                sourceId: actor,
                targetId,
                value: r.delta ?? (cfg as Record<string, unknown>)?.value ?? 0,
                before: r.before ?? null,
                after: r.after ?? null,
                delta: r.delta ?? null,
                skillId,
                meta: cfg
              });
              continue;
            }
            if (eff === 'RESURRECT' && r.applied) {
              flat.push({
                type: 'RESURRECT',
                sourceId: actor,
                targetId,
                value: (r as Record<string, unknown>).hpRestored ?? null,
                meta: cfg
              });
              continue;
            }
            flat.push({
              type: 'skill',
              actor,
              effectsResultsByTarget: [{ effect: eff, effectConfig: cfg, results: [r] }]
            });
          }
        }
      } else {
        flat.push(ev);
      }
      continue;
    }
    if (type === 'unit_ko' || type === 'ko') {
      flat.push({
        type: 'DEATH',
        targetId: ev.targetId ?? ev.sourceId ?? ev.unit ?? null
      });
      continue;
    }
    flat.push(ev);
  }
  return flat;
}

/** Extrait la clé d'effet d'un message "X applique [effet] sur/à Y" pour regrouper les EFFECT_APPLY. */
function extractEffectKeyFromMessage(message: string): string {
  const m = message.match(/\bapplique\s+(.+?)\s+(?:sur|à)\s+/i) || message.match(/\bgagne\s+(.+?)(?:\s+\(|\s*$)/i);
  if (m && m[1]) return String(m[1]).trim().toUpperCase();
  if (/\bvole\b/i.test(message)) return 'STEAL_STAT';
  return '';
}

function groupEvents(events: Record<string, unknown>[]): Record<string, unknown>[] {
  const grouped: Record<string, unknown>[] = [];
  let i = 0;
  while (i < events.length) {
    const e = events[i];
    const type = String(e.type ?? '').toUpperCase();
    if (type === 'APPLY_BUFF' || type === 'APPLY_DEBUFF') {
      const baseEvent = e as Record<string, unknown>;
      const baseActor = String(baseEvent.sourceId ?? baseEvent.actor ?? '');
      const baseBuffType = String(baseEvent.buffType ?? '').toUpperCase();
      const group = [baseEvent];
      let j = i + 1;
      while (j < events.length) {
        const next = events[j] as Record<string, unknown>;
        const nextType = String(next.type ?? '').toUpperCase();
        // Ignore les événements 'passive' intercalés du même acteur
        if (nextType === 'PASSIVE' || nextType === 'PASSIVE_TRIGGER') {
          const nextActor = String(next.actor ?? next.sourceId ?? '');
          if (nextActor === baseActor) { j++; continue; }
          break;
        }
        if (nextType !== type) break;
        const nextActor = String(next.sourceId ?? next.actor ?? '');
        if (nextActor !== baseActor) break;
        if (String(next.buffType ?? '').toUpperCase() !== baseBuffType) break;
        group.push(next);
        j++;
      }
      grouped.push({
        type: 'GROUPED_BUFF',
        baseEvent: { ...baseEvent, type: baseEvent.type },
        targets: group.map((x) => (x as Record<string, unknown>).targetId)
      });
      i = j;
      continue;
    }
    if (type === 'DAMAGE') {
      const baseEvent = e as Record<string, unknown>;
      const group = [baseEvent];
      let j = i + 1;
      while (
        j < events.length &&
        String(events[j].type ?? '').toUpperCase() === 'DAMAGE' &&
        (events[j].sourceId === baseEvent.sourceId || String(events[j].sourceId) === String(baseEvent.sourceId)) &&
        (events[j].skillId === baseEvent.skillId || String(events[j].skillId) === String(baseEvent.skillId))
      ) {
        group.push(events[j] as Record<string, unknown>);
        j++;
      }
      grouped.push({ type: 'GROUPED_DAMAGE', baseEvent, hits: group });
      i = j;
      continue;
    }
    if (type === 'HEAL') {
      const baseEvent = e as Record<string, unknown>;
      const group = [baseEvent];
      let j = i + 1;
      while (
        j < events.length &&
        String(events[j].type ?? '').toUpperCase() === 'HEAL' &&
        (events[j].sourceId === baseEvent.sourceId || String(events[j].sourceId) === String(baseEvent.sourceId)) &&
        (events[j].skillId === baseEvent.skillId || String(events[j].skillId) === String(baseEvent.skillId))
      ) {
        group.push(events[j] as Record<string, unknown>);
        j++;
      }
      grouped.push({ type: 'GROUPED_HEAL', baseEvent, heals: group });
      i = j;
      continue;
    }
    if (type === 'EFFECT_APPLY') {
      const baseEvent = e as Record<string, unknown>;
      const sourceKey = String(baseEvent.actor ?? baseEvent.sourceId ?? '');
      // Utiliser effectType directement si disponible (événements de passifs), sinon parser le message
      const directEffectType = String(baseEvent.effectType ?? '').toUpperCase();
      const meta = (baseEvent.meta ?? {}) as Record<string, unknown>;
      const msg = String(baseEvent.message ?? meta.message ?? '');
      const effectKey = directEffectType || extractEffectKeyFromMessage(msg);
      if (effectKey !== '') {
        const group = [baseEvent];
        let j = i + 1;
        while (j < events.length) {
          const next = events[j] as Record<string, unknown>;
          const nextType = String(next.type ?? '').toUpperCase();
          // Ignorer les événements 'passive' intercalés du même acteur
          if (nextType === 'PASSIVE' || nextType === 'PASSIVE_TRIGGER') {
            const nextActor = String(next.actor ?? next.sourceId ?? '');
            if (nextActor === sourceKey) { j++; continue; }
            break;
          }
          if (nextType !== 'EFFECT_APPLY') break;
          const nextActor = String(next.actor ?? next.sourceId ?? '');
          if (nextActor !== sourceKey) break;
          const nextDirectType = String(next.effectType ?? '').toUpperCase();
          const nextMeta = (next.meta ?? {}) as Record<string, unknown>;
          const nextMsg = String(next.message ?? nextMeta.message ?? '');
          const nextEffectKey = nextDirectType || extractEffectKeyFromMessage(nextMsg);
          if (nextEffectKey !== effectKey) break;
          group.push(next);
          j++;
        }
        if (group.length > 1) {
          grouped.push({ type: 'GROUPED_EFFECT_APPLY', baseEvent, events: group, effectKey });
          i = j;
          continue;
        }
      }
    }
    if (type === 'SHIELD_GAIN') {
      const baseEvent = e as Record<string, unknown>;
      const group = [baseEvent];
      let j = i + 1;
      while (
        j < events.length &&
        String(events[j].type ?? '').toUpperCase() === 'SHIELD_GAIN' &&
        (events[j].sourceId === baseEvent.sourceId || String(events[j].sourceId) === String(baseEvent.sourceId))
      ) {
        group.push(events[j] as Record<string, unknown>);
        j++;
      }
      grouped.push({ type: 'GROUPED_SHIELD', baseEvent, shields: group });
      i = j;
      continue;
    }
    if (type === 'REMOVE_BUFF') {
      const baseEvent = e as Record<string, unknown>;
      const group = [baseEvent];
      let j = i + 1;
      while (
        j < events.length &&
        String(events[j].type ?? '').toUpperCase() === 'REMOVE_BUFF' &&
        (events[j].sourceId === baseEvent.sourceId || String(events[j].sourceId) === String(baseEvent.sourceId))
      ) {
        group.push(events[j] as Record<string, unknown>);
        j++;
      }
      grouped.push({ type: 'GROUPED_REMOVE_BUFF', baseEvent, strips: group });
      i = j;
      continue;
    }
    if (type === 'DEATH') {
      const group = [e as Record<string, unknown>];
      let j = i + 1;
      while (j < events.length && String(events[j].type ?? '').toUpperCase() === 'DEATH') {
        group.push(events[j] as Record<string, unknown>);
        j++;
      }
      grouped.push({ type: 'GROUPED_DEATH', deaths: group });
      i = j;
      continue;
    }
    grouped.push(e);
    i++;
  }
  return grouped;
}

function rawEventToLogEntries(event: Record<string, unknown>): Array<{ text: string; color: string; team: 'A' | 'B' }> {
  const type = String(event.type ?? '').toLowerCase();
  const units = initialUnitsForBattlefield.value;
  const teamASize = units.filter((u) => u.side === 'A').length;
  const getTeam = (idx: number | string | null | undefined): 'A' | 'B' => {
    if (idx == null) return 'A';
    if (typeof idx === 'string' && (idx.startsWith('A') || idx.startsWith('B'))) return idx.startsWith('A') ? 'A' : 'B';
    const i = typeof idx === 'string' ? parseInt(idx, 10) : idx;
    return !Number.isNaN(i) && i < teamASize ? 'A' : 'B';
  };
  const getName = (idx: number | string | null | undefined) => {
    if (idx == null) return '?';
    if (typeof idx === 'number' && idx >= 0 && idx < units.length) return units[idx]?.name ?? String(idx);
    if (typeof idx === 'string') {
      const parsed = parseInt(idx, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < units.length) return units[parsed]?.name ?? idx;
      const u = units.find((x) => x.id === idx);
      return u?.name ?? idx;
    }
    return String(idx);
  };
  const out: Array<{ text: string; color: string; team: 'A' | 'B' }> = [];
  if (type === 'init') return out;
  if (type === 'attack') {
    const actor = event.actor ?? event.sourceId;
    const target = event.target ?? event.targetId;
    const dmg = event.finalDamage ?? event.value;
    const isCrit = event.isCrit === true;
    const srcName = getName(actor);
    const tgtName = getName(target);
    const team = getTeam(actor);
    if (event.isCounter === true) {
      out.push({ text: `${tgtName} contre-attaque ${srcName}.`, color: LOG_COLORS.damage, team: getTeam(target) });
    }
    if (dmg != null && !event.isMiss) {
      const msg = isCrit ? `${srcName} inflige ${dmg} dégâts critiques à ${tgtName}.` : `${srcName} inflige ${dmg} dégâts à ${tgtName}.`;
      out.push({ text: msg, color: LOG_COLORS.damage, team });
    }
    return out;
  }
  if (type === 'unit_ko' || type === 'ko') {
    const targetId = event.sourceId ?? event.targetId ?? null;
    const name = getName(targetId);
    out.push({ text: `${name} est KO.`, color: LOG_COLORS.death, team: getTeam(targetId) });
    return out;
  }
  if (type === 'shield_absorb') {
    const targetId = event.targetId ?? null;
    const val = event.valueAbsorbed ?? event.value ?? 0;
    const name = getName(targetId);
    out.push({ text: `${name} absorbe ${val} dégâts avec son bouclier.`, color: LOG_COLORS.shield, team: getTeam(targetId) });
    return out;
  }
  if (type === 'immune') {
    const targetId = event.targetId ?? null;
    const name = getName(targetId);
    out.push({ text: `${name} est immunisé (Invulnérabilité).`, color: LOG_COLORS.neutral, team: getTeam(targetId) });
    return out;
  }
  if (type === 'grouped_effect_apply') {
    const baseEvent = (event.baseEvent ?? event) as Record<string, unknown>;
    const effectKey = String((event as Record<string, unknown>).effectKey ?? '').toUpperCase();
    const sourceName = getName(baseEvent.actor ?? baseEvent.sourceId);
    const team = getTeam(baseEvent.actor ?? baseEvent.sourceId);
    const { text, color } = formatGroupedEffectApplyPhrase(sourceName, effectKey);
    out.push({ text, color, team });
    return out;
  }
  if (type === 'effect_apply') {
    const meta = (event.meta ?? event.extra ?? {}) as Record<string, unknown>;
    const message = String((event.message as string) ?? meta.message ?? '');
    const team = getTeam(event.actor ?? event.sourceId);
    if (message) {
      const effectKey = extractEffectKeyFromMessage(message);
      if (effectKey === 'HEAL') {
        out.push({ text: `${getName(event.actor ?? event.sourceId)} soigne ${getName(event.target ?? (event as Record<string, unknown>).targetId)}.`, color: LOG_COLORS.heal, team });
      } else if (effectKey === 'STEAL_STAT') {
        out.push({ text: message, color: LOG_COLORS.passive, team });
      } else {
        out.push({ text: message, color: LOG_COLORS.buff, team });
      }
    }
    return out;
  }
  if (type === 'regen_tick') {
    const targetId = event.actorId ?? event.targetId ?? null;
    const val = event.heal ?? event.value ?? 0;
    out.push({ text: `${getName(targetId)} se régénère de ${val} PV.`, color: LOG_COLORS.heal, team: getTeam(targetId) });
    return out;
  }
  if (type === 'apply_buff') {
    const meta = (event.meta ?? event.extra ?? {}) as Record<string, unknown>;
    const buffType = String(event.buffType ?? meta?.buffType ?? '').toUpperCase();
    const duration = Number(event.remainingActions ?? meta?.remainingActions ?? meta?.duration ?? 1);
    const durStr = duration ? ` (${duration} tour${duration !== 1 ? 's' : ''})` : '';
    const source = getName(event.sourceId ?? null);
    const target = getName(event.targetId ?? null);
    const team = getTeam(event.sourceId);
    const phrase = getBuffPhrase(buffType || undefined);
    const label = formatBuffLabel(buffType || undefined) ?? 'effet';
    if (event.sourceId === event.targetId) {
      out.push({ text: `${source} gagne ${label}${durStr}.`, color: LOG_COLORS.buff, team });
    } else if (phrase) {
      out.push({ text: `${source} ${phrase} ${target}${durStr}.`, color: LOG_COLORS.buff, team });
    } else {
      out.push({ text: `${source} applique ${label} à ${target}${durStr}.`, color: LOG_COLORS.buff, team });
    }
    return out;
  }
  if (type === 'apply_debuff') {
    const meta = (event.meta ?? event.extra ?? {}) as Record<string, unknown>;
    const debuffType = String(event.debuffType ?? event.buffType ?? meta?.debuffType ?? meta?.buffType ?? '').toUpperCase();
    const duration = Number(event.remainingActions ?? meta?.remainingActions ?? meta?.duration ?? 1);
    const durStr = duration ? ` (${duration} tour${duration !== 1 ? 's' : ''})` : '';
    const source = getName(event.sourceId ?? null);
    const target = getName(event.targetId ?? null);
    const team = getTeam(event.sourceId);
    const phrase = getDebuffPhrase(debuffType || undefined);
    const label = formatDebuffLabel(debuffType || undefined) || 'effet';
    if (phrase) {
      out.push({ text: `${source} ${phrase} ${target}${durStr}.`, color: LOG_COLORS.debuff, team });
    } else {
      out.push({ text: `${source} réduit ${label} de ${target}${durStr}.`, color: LOG_COLORS.debuff, team });
    }
    return out;
  }
  if (type === 'grouped_buff') {
    const text = renderGroupedBuff(event as { type: string; baseEvent: Record<string, unknown>; targets: (string | number | null | undefined)[] });
    const team = getTeam((event.baseEvent as Record<string, unknown>)?.sourceId);
    const isDebuff = String((event.baseEvent as Record<string, unknown>)?.type ?? '').toUpperCase() === 'APPLY_DEBUFF';
    out.push({ text, color: isDebuff ? LOG_COLORS.debuff : LOG_COLORS.buff, team });
    return out;
  }
  if (type === 'grouped_damage') {
    const text = renderGroupedDamage(event as { baseEvent: Record<string, unknown>; hits: Record<string, unknown>[] });
    out.push({ text, color: LOG_COLORS.damage, team: getTeam((event.baseEvent as Record<string, unknown>)?.sourceId) });
    return out;
  }
  if (type === 'grouped_heal') {
    const text = renderGroupedHeal(event as { baseEvent: Record<string, unknown>; heals: Record<string, unknown>[] });
    out.push({ text, color: LOG_COLORS.heal, team: getTeam((event.baseEvent as Record<string, unknown>)?.sourceId) });
    return out;
  }
  if (type === 'grouped_shield') {
    const text = renderGroupedShield(event as { baseEvent: Record<string, unknown>; shields: Record<string, unknown>[] });
    out.push({ text, color: LOG_COLORS.shield, team: getTeam((event.baseEvent as Record<string, unknown>)?.sourceId) });
    return out;
  }
  if (type === 'grouped_death') {
    const text = renderGroupedDeath(event as { deaths: Record<string, unknown>[] });
    const firstDeath = (event.deaths as Record<string, unknown>[])?.[0];
    const targetId = firstDeath != null ? (firstDeath as Record<string, unknown>).targetId : null;
    out.push({ text, color: LOG_COLORS.death, team: getTeam(targetId) });
    return out;
  }
  if (type === 'grouped_remove_buff') {
    const text = renderGroupedRemoveBuff(event as { baseEvent: Record<string, unknown>; strips: Record<string, unknown>[] });
    out.push({ text, color: LOG_COLORS.debuff, team: getTeam((event.baseEvent as Record<string, unknown>)?.sourceId) });
    return out;
  }
  if (type === 'remove_buff') {
    const source = getName(event.sourceId ?? null);
    const target = getName(event.targetId ?? null);
    const removed = (event.removed as Array<{ buffType?: string }>) ?? [];
    const labels = removed.map((b) => NARRATIVE_BUFF_LABELS[b.buffType ?? ''] ?? b.buffType ?? 'buff').filter(Boolean);
    const list = labels.length > 0 ? labels.join(', ') : 'des buffs';
    out.push({ text: `${source} dissipe sur ${target} : ${list}.`, color: LOG_COLORS.debuff, team: getTeam(event.sourceId) });
    return out;
  }
  if (type === 'atb_change') {
    const source = getName(event.sourceId ?? null);
    const target = getName(event.targetId ?? null);
    const val = event.value ?? 0;
    const pct = typeof val === 'number' ? Math.round(val) : val;
    out.push({ text: `${source} réduit l'ATB de ${target} (${pct} points).`, color: LOG_COLORS.neutral, team: getTeam(event.sourceId) });
    return out;
  }
  if (type === 'reset_skill_cooldown') {
    const source = getName(event.sourceId ?? null);
    const target = getName(event.targetId ?? null);
    out.push({ text: `${source} remet le temps de recharge de ${target} à 0.`, color: LOG_COLORS.neutral, team: getTeam(event.sourceId) });
    return out;
  }
  if (type === 'set_skill_cooldown_max') {
    const source = getName(event.sourceId ?? null);
    const target = getName(event.targetId ?? null);
    const value = Number(event.after ?? event.value ?? event.baseCooldown ?? 0);
    out.push({ text: `${source} remet le temps de recharge de ${target} à ${value}.`, color: LOG_COLORS.debuff, team: getTeam(event.sourceId) });
    return out;
  }
  if (type === 'resurrect') {
    const source = getName(event.sourceId ?? null);
    const target = getName(event.targetId ?? null);
    const val = event.value ?? null;
    const n = val != null && Number(val) > 0 ? ` (+${val} PV)` : '';
    out.push({ text: `${source} ressuscite ${target}${n}.`, color: LOG_COLORS.heal, team: getTeam(event.sourceId) });
    return out;
  }
  if (type === 'passive') {
    return out;
  }
  if (type === 'buff_tick' || type === 'debuff_tick') {
    return out;
  }
  if (type === 'skill') {
    const effectsResultsByTarget = event.effectsResultsByTarget as Array<{ effect: string; effectConfig?: Record<string, unknown>; results: Array<Record<string, unknown>> }> | undefined;
    const actor = event.actor ?? null;
    const srcName = getName(actor);
    const team = getTeam(actor);
    if (Array.isArray(effectsResultsByTarget)) {
      for (const { effect: effType, effectConfig: cfg, results } of effectsResultsByTarget) {
        const eff = String(effType ?? '').toUpperCase();
        const healResults = (results || []).filter((r) => (r.healAmount ?? 0) > 0);
        if (eff === 'HEAL' && healResults.length > 1) {
          out.push({ text: `${srcName} soigne tous les alliés.`, color: LOG_COLORS.heal, team });
          continue;
        }
        const buffResults = (eff === 'APPLY_BUFF' && (cfg as Record<string, unknown>)?.buffType !== 'SHIELD')
          ? (results || []).filter((r) => r.applied && (r.shieldAmount ?? 0) === 0)
          : [];
        const isTeamBuff = buffResults.length > 1 && buffResults.every((r) => getTeam(r.targetCombatIndex ?? r.targetUid) === team);
        if (isTeamBuff && eff === 'APPLY_BUFF') {
          const r0 = buffResults[0] as Record<string, unknown>;
          const rBuffType = r0.buffType ?? cfg?.buffType ?? (cfg as Record<string, unknown>)?.buffType;
          const buffType = String(rBuffType ?? '').toUpperCase();
          const duration = Number(r0.remainingActions ?? (cfg as Record<string, unknown>)?.remainingActions ?? 1);
          const durStr = duration ? ` (${duration} tour${duration !== 1 ? 's' : ''})` : '';
          const phrase = getBuffPhrase(buffType || undefined);
          const label = formatBuffLabel(buffType || undefined) ?? 'effet';
          if (phrase) {
            out.push({ text: `${srcName} ${phrase} toute l'équipe${durStr}.`, color: LOG_COLORS.buff, team });
          } else {
            out.push({ text: `${srcName} renforce toute l'équipe : ${label}${durStr}.`, color: LOG_COLORS.buff, team });
          }
          continue;
        }
        const debuffResults = (eff === 'APPLY_DEBUFF') ? (results || []).filter((r) => r.applied && !r.immune) : [];
        const isTeamDebuff = debuffResults.length > 1 && debuffResults.every((r) => getTeam(r.targetCombatIndex ?? r.targetUid) !== team);
        if (isTeamDebuff && eff === 'APPLY_DEBUFF') {
          const r0 = debuffResults[0] as Record<string, unknown>;
          const debuffType = String(r0.debuffType ?? (cfg as Record<string, unknown>)?.debuffType ?? '').toUpperCase();
          const duration = Number(r0.remainingActions ?? (cfg as Record<string, unknown>)?.remainingActions ?? 1);
          const durStr = duration ? ` (${duration} tour${duration !== 1 ? 's' : ''})` : '';
          const phrase = getDebuffPhrase(debuffType || undefined);
          const label = formatDebuffLabel(debuffType || undefined) || 'effet';
          if (phrase) {
            out.push({ text: `${srcName} ${phrase} l'équipe ennemie${durStr}.`, color: LOG_COLORS.debuff, team });
          } else {
            out.push({ text: `${srcName} affaiblit l'équipe ennemie : ${label}${durStr}.`, color: LOG_COLORS.debuff, team });
          }
          continue;
        }
        for (const r of results || []) {
          const tgtId = r.targetCombatIndex ?? r.targetUid ?? null;
          const tgtName = getName(tgtId);
          if (eff === 'DAMAGE' && r.effectiveDamage != null) {
            out.push({ text: `${srcName} inflige ${r.effectiveDamage} dégâts à ${tgtName}.`, color: LOG_COLORS.damage, team });
          } else if (eff === 'HEAL' && (r.healAmount ?? 0) > 0) {
            const self = actor === tgtId;
            const isRegen = (r as Record<string, unknown>).regen === true;
            out.push({ text: isRegen ? `${tgtName} se régénère de ${r.healAmount} PV.` : (self ? `${srcName} récupère ${r.healAmount} PV.` : `${srcName} soigne ${tgtName} de ${r.healAmount} PV.`), color: LOG_COLORS.heal, team });
          } else if (eff === 'APPLY_BUFF' && (r.shieldAmount ?? 0) > 0) {
            out.push({ text: `${srcName} applique un bouclier de ${r.shieldAmount} à ${tgtName}.`, color: LOG_COLORS.shield, team });
          } else if (eff === 'APPLY_DEBUFF' && r.applied) {
            const debuffType = String((r as Record<string, unknown>).debuffType ?? '').toUpperCase();
            const duration = Number((r as Record<string, unknown>).remainingActions ?? 1);
            const durStr = duration ? ` (${duration} tour${duration !== 1 ? 's' : ''})` : '';
            const phrase = getDebuffPhrase(debuffType || undefined);
            const label = (debuffType === 'APPLY_BUFF' || debuffType === 'APPLY_DEBUFF') ? 'effet' : (NARRATIVE_BUFF_LABELS[debuffType] ?? 'effet');
            if (phrase) {
              out.push({ text: `${srcName} ${phrase} ${tgtName}${durStr}.`, color: LOG_COLORS.debuff, team });
            } else {
              out.push({ text: `${srcName} affaiblit ${tgtName} : ${label}.`, color: LOG_COLORS.debuff, team });
            }
          } else if (eff === 'APPLY_BUFF' && r.applied) {
            const rBuffType = (r as Record<string, unknown>).buffType ?? (r as Record<string, unknown>).effectConfig?.buffType ?? (cfg as Record<string, unknown>)?.buffType;
            const buffType = String(rBuffType ?? '').toUpperCase();
            const duration = Number((r as Record<string, unknown>).remainingActions ?? 1);
            const durStr = duration ? ` (${duration} tour${duration !== 1 ? 's' : ''})` : '';
            const phrase = getBuffPhrase(buffType || undefined);
            const label = formatBuffLabel(buffType || undefined) ?? 'effet';
            const self = actor === tgtId;
            if (self) {
              out.push({ text: `${srcName} gagne ${label}${durStr}.`, color: LOG_COLORS.buff, team });
            } else if (phrase) {
              out.push({ text: `${srcName} ${phrase} ${tgtName}${durStr}.`, color: LOG_COLORS.buff, team });
            } else {
              out.push({ text: `${srcName} applique ${label} à ${tgtName}${durStr}.`, color: LOG_COLORS.buff, team });
            }
          } else if (eff === 'RESURRECT' && r.applied) {
            out.push({ text: `${tgtName} est ressuscité.`, color: LOG_COLORS.heal, team });
          } else if (eff === 'STEAL_STAT' && r.applied) {
            const stat = String((r as Record<string, unknown>).stat ?? 'stat').toLowerCase();
            const amount = Number((r as Record<string, unknown>).amount ?? 0);
            const statFr = stat === 'attack' ? "d'attaque" : stat === 'defense' ? 'de défense' : stat === 'speed' ? 'de vitesse' : stat === 'mastery' ? 'de maîtrise' : 'de statistique';
            out.push({ text: `${srcName} vole ${amount} points ${statFr} à ${tgtName}.`, color: LOG_COLORS.passive, team });
          } else if (eff === 'RESET_SKILL_COOLDOWN' && (r.applied || r.after === 0)) {
            out.push({ text: `${srcName} remet le temps de recharge de ${tgtName} à 0.`, color: LOG_COLORS.neutral, team });
          } else if (eff === 'SET_SKILL_COOLDOWN_MAX' && r.applied) {
            const value = Number((r as Record<string, unknown>).after ?? (r as Record<string, unknown>).baseCooldown ?? 0);
            out.push({ text: `${srcName} remet le temps de recharge de ${tgtName} à ${value}.`, color: LOG_COLORS.debuff, team });
          } else if (eff === 'CD_UP' && r.applied) {
            const d = Number((r as Record<string, unknown>).delta ?? 0);
            out.push({ text: `${srcName} retarde le temps de recharge de ${tgtName} de ${d} tour(s).`, color: LOG_COLORS.debuff, team });
          } else if (eff === 'CD_DOWN' && r.applied) {
            const d = Number((r as Record<string, unknown>).delta ?? 0);
            out.push({ text: `${srcName} réduit le temps de recharge de ${tgtName} de ${d} tour(s).`, color: LOG_COLORS.buff, team });
          }
        }
      }
    }
    return out;
  }
  if (type === 'redirect' && event.reason === 'DEFEND') {
    const to = event.to ?? null;
    const from = event.from ?? null;
    out.push({ text: `${getName(to)} protège ${getName(from)}.`, color: LOG_COLORS.buff, team: getTeam(to) });
    return out;
  }
  if (type === 'synergy_trigger') {
    const trait = (event.trait ?? 'Synergie') as string;
    const subType = (event.subType ?? '') as string;
    const val = event.healAmount ?? event.value ?? undefined;
    const src = event.unit ?? event.source ?? null;
    const txt = formatSynergyTriggerLog(trait, subType, typeof val === 'number' ? val : undefined, getName(src));
    out.push({ text: txt, color: LOG_COLORS.passive, team: getTeam(src) });
    return out;
  }
  if (type === 'boss_trigger') {
    const subType = (event.subType ?? '') as string;
    out.push({ text: `Boss : ${subType}.`, color: LOG_COLORS.neutral, team: 'B' });
    return out;
  }
  return out;
}

const visibleReplayLogEntries = computed(() => {
  const events = visibleReplayEvents.value as Record<string, unknown>[];
  const flat = expandSkillEventsToFlat(events);
  const grouped = groupEvents(flat);
  const logsA: { text: string; color: string }[] = [];
  const logsB: { text: string; color: string }[] = [];
  for (const ev of grouped) {
    const entries = rawEventToLogEntries(ev);
    for (const entry of entries) {
      if (entry.team === 'A') logsA.push({ text: entry.text, color: entry.color });
      else logsB.push({ text: entry.text, color: entry.color });
    }
  }
  return { logsA, logsB };
});

function replayReset() {
  stopReplayTimer();
  replayFrameIndex.value = 0;
  nextTick(() => applyReplaySnapshotToBattlefield(currentReplaySnapshot.value));
}
function replayStepBack() {
  if (replayFrameIndex.value <= 0) return;
  stopReplayTimer();
  replayFrameIndex.value--;
  nextTick(() => applyReplaySnapshotToBattlefield(currentReplaySnapshot.value));
}
function canAdvanceReplayManuallyWithoutChoice() {
  // Toujours autoriser l'avancement tant qu'on n'est pas au dernier frame
  if (replayFrameIndex.value < replayFrames.value.length - 1) return true;
  const ctx = manualDecisionContext.value;
  if (!ctx) return true;
  return ctx.isStunned || ctx.isProvoked;
}

function advanceReplayOneFrame(force = false) {
  if (replayFrameIndex.value >= replayFrames.value.length - 1) return false;
  if (!force && !canAdvanceReplayManuallyWithoutChoice()) return false;
  replayFrameIndex.value++;
  nextTick(() => applyReplaySnapshotToBattlefield(currentReplaySnapshot.value));
  return true;
}

/** Même logique qu'advanceReplayOneFrame mais application synchrone (onglet masqué : pas de nextTick). */
function advanceReplayOneFrameSync(force = false) {
  if (replayFrameIndex.value >= replayFrames.value.length - 1) return false;
  if (!force && !canAdvanceReplayManuallyWithoutChoice()) return false;
  replayFrameIndex.value++;
  applyReplaySnapshotToBattlefield(currentReplaySnapshot.value);
  return true;
}

function replayStepForward() {
  advanceReplayOneFrame();
}
function replayEnd() {
  stopReplayTimer();
  replayFrameIndex.value = Math.max(0, replayFrames.value.length - 1);
  nextTick(() => applyReplaySnapshotToBattlefield(currentReplaySnapshot.value));
}
const REPLAY_TICK_MS = 80;

/**
 * Quand l'onglet est en arrière-plan, les navigateurs ralentissent fortement setInterval/requestAnimationFrame.
 * On enchaîne alors les frames et les décisions auto de façon synchrone jusqu'à la fin ou une décision manuelle.
 */
function flushHiddenReplayCatchUp() {
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden' || !hasReplayMode.value) return;
  const MAX_STEPS = 100000;
  let steps = 0;
  while (document.visibilityState === 'hidden' && steps++ < MAX_STEPS && hasReplayMode.value && battleResult.value) {
    if (replayFrames.value.length === 0) break;
    if (replayFrameIndex.value < replayFrames.value.length - 1) {
      if (!advanceReplayOneFrameSync()) break;
      continue;
    }
    const dr = battleResult.value.decisionRequest;
    if (!dr) break;
    if (autoMode.value) {
      const ctx = manualDecisionContext.value;
      if (ctx && (ctx.isStunned || ctx.isProvoked)) break;
      performAutoDecision();
      continue;
    }
    break;
  }
}

function startReplayPlaybackFromStart() {
  if (!hasReplayMode.value || replayFrames.value.length === 0) return;
  if (replayTimer) clearInterval(replayTimer);
  replayTimer = null;
  replayFrameIndex.value = 0;
  nextTick(() => {
    applyReplaySnapshotToBattlefield(currentReplaySnapshot.value);
    startManualAutoFlow();
  });
}

function stopReplayTimer() {
  if (replayTimer) clearInterval(replayTimer);
  replayTimer = null;
}

function startManualAutoFlow() {
  if (!hasReplayMode.value) return;
  stopReplayTimer();
  // Onglet masqué : ne pas s'appuyer sur setInterval (throttlé à ~1s ou figé).
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    flushHiddenReplayCatchUp();
    return;
  }
  // En avant-plan : dernier frame + attente de décision joueur → le watch auto / manuel prend le relais.
  if (battleResult.value?.decisionRequest && replayFrameIndex.value >= replayFrames.value.length - 1) return;
  replayTimer = setInterval(() => {
    if (replayFrameIndex.value >= replayFrames.value.length - 1) {
      stopReplayTimer();
      return;
    }
    const ok = advanceReplayOneFrame();
    if (!ok) {
      stopReplayTimer();
      return;
    }
  }, REPLAY_TICK_MS);
}

function selectManualAction(action: ManualAction, skillKey?: string | null) {
  manualDecisionError.value = '';
  const ctx = manualDecisionContext.value;
  if (action === 'SKILL' && (!ctx || !ctx.skillAvailable)) {
    manualDecisionError.value = 'Compétence indisponible (cooldown actif ou effet empêchant son lancement).';
    return;
  }
  manualActionChoice.value = action;
  if (action === 'SKILL') {
    const slots = ctx?.skillSlots;
    if (slots && slots.length > 1) {
      manualSelectedSkillKey.value = skillKey != null && String(skillKey).length ? String(skillKey) : null;
    } else {
      manualSelectedSkillKey.value = null;
    }
  } else {
    manualSelectedSkillKey.value = null;
  }
}

function submitInteractiveAction(action: ManualAction, targetCombatIndex: number, skillKey?: string)
{
  if (!activePendingBattle.value?.id) return;
  const entry: { action: string; targetCombatIndex: number; skillKey?: string } = { action, targetCombatIndex };
  if (skillKey != null && String(skillKey).length) entry.skillKey = String(skillKey);
  combatDecisions.value = [...combatDecisions.value, entry];
  try {
    runEngineLocally(false);
  } catch (e: unknown) {
    const err = e as Error & { response?: { data?: { message?: string; error?: string } } };
    const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Impossible de jouer cette action.';
    manualDecisionError.value = msg;
    throw e;
  }
}

function performAutoDecision() {
  const dr = battleResult.value?.decisionRequest;
  const ctx = manualDecisionContext.value;
  if (!dr || !ctx || ctx.isStunned || ctx.isProvoked || !hasReplayMode.value) return;
  if (replayFrameIndex.value < replayFrames.value.length - 1) return;
  const actionRaw = String((dr as { suggestedAction?: string })?.suggestedAction ?? 'BASIC').toUpperCase();
  // Préférer la compétence si disponible, sinon attaque de base
  let action: ManualAction = actionRaw === 'SKILL' && ctx.skillAvailable ? 'SKILL' : 'BASIC';
  let pool: Array<{ combatIndex: number; name: string }> = [];
  let autoSkillKey: string | undefined;
  if (action === 'SKILL') {
    const slots = ctx.skillSlots;
    if (slots && slots.length > 1) {
      const sorted = [...slots].sort((a, b) => Number(a.priority ?? 999) - Number(b.priority ?? 999));
      for (const s of sorted) {
        if (!s.ready) continue;
        const st = (s.skillTargets ?? []).length ? s.skillTargets : [];
        if (st && st.length > 0) {
          pool = st as Array<{ combatIndex: number; name: string }>;
          autoSkillKey = String(s.skillKey);
          break;
        }
      }
      if (!pool.length) {
        action = 'BASIC';
        pool = ctx.basicTargets;
      }
    } else {
      pool = ctx.skillTargets;
    }
  } else {
    pool = ctx.basicTargets;
  }
  // Si compétence choisie mais aucune cible valide (ex: résurrection sans allié mort), repli sur attaque de base
  if (action === 'SKILL' && (!pool || pool.length === 0)) {
    action = 'BASIC';
    pool = ctx.basicTargets;
    autoSkillKey = undefined;
  }
  const strat = ctx.allySingleAutoTargetStrategy;
  const snapUnits = getSnapshotFlatUnits(currentReplaySnapshot.value);
  const smartAlly =
    action === 'SKILL' && strat && pool.length > 1
      ? pickAutoAllySingleTargetCombatIndex(pool, strat, snapUnits)
      : null;
  const target =
    smartAlly != null
      ? smartAlly
      : ctx.expectedTargetCombatIndex != null
        ? pool.find((t) => t.combatIndex === ctx.expectedTargetCombatIndex)?.combatIndex
        : pool[0]?.combatIndex;
  if (target == null) return;
  manualDecisionError.value = '';
  submitInteractiveAction(action, target, autoSkillKey);
}

async function confirmManualDecision() {
  const ctx = manualDecisionContext.value;
  if (!ctx) return;
  if (!manualActionChoice.value) {
    manualDecisionError.value = "Choisis d'abord Attaque de base ou Compétence.";
    return;
  }
  if (manualActionChoice.value === 'SKILL' && !ctx.skillAvailable) {
    manualDecisionError.value = 'Compétence indisponible.';
    return;
  }
  if (
    manualActionChoice.value === 'SKILL' &&
    ctx.skillSlots &&
    ctx.skillSlots.length > 1 &&
    !manualSelectedSkillKey.value
  ) {
    manualDecisionError.value = 'Choisis une compétence (1 ou 2).';
    return;
  }
  if (manualTargetChoice.value == null) {
    manualDecisionError.value = 'Sélectionne une cible valide.';
    return;
  }
  const valid = manualValidTargets.value.some((t) => t.combatIndex === manualTargetChoice.value);
  if (!valid) {
    manualDecisionError.value = 'Cible invalide.';
    return;
  }
  manualDecisionError.value = '';
  const selectedAction = manualActionChoice.value;
  const selectedTarget = manualTargetChoice.value;
  manualActionChoice.value = null;
  manualTargetChoice.value = null;
  manualSkillHover.value = false;
  manualSkillHoverKey.value = null;
  const skillKeyForSubmit =
    selectedAction === 'SKILL' && ctx.skillSlots && ctx.skillSlots.length > 1
      ? manualSelectedSkillKey.value ?? undefined
      : undefined;
  manualSelectedSkillKey.value = null;
  if (battleResult.value?.decisionRequest && activePendingBattle.value?.id && selectedAction && selectedTarget != null) {
    try {
      await submitInteractiveAction(selectedAction, selectedTarget, skillKeyForSubmit);
    } catch (e: any) {
      manualDecisionError.value = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Impossible de jouer cette action.';
    }
    return;
  }
  advanceReplayOneFrame(true);
  nextTick(() => startManualAutoFlow());
}

async function handleBattlefieldUnitClick(unit: unknown) {
  if (!showManualDecisionPanel.value) return;
  const u = unit as { combatIndex?: number };
  const ci = Number(u?.combatIndex);
  if (!Number.isInteger(ci) || ci < 0) return;
  const ctx = manualDecisionContext.value;
  if (!ctx) return;
  if (!manualActionChoice.value) {
    manualDecisionError.value = "Choisis d'abord Attaque de base ou Compétence.";
    return;
  }
  const isValid = manualValidTargets.value.some((t) => t.combatIndex === ci);
  if (!isValid) {
    manualDecisionError.value = 'Cible invalide pour cette action.';
    return;
  }
  manualTargetChoice.value = ci;
  await confirmManualDecision();
}

watch([replayFrameIndex, hasReplayMode], () => {
  if (hasReplayMode.value && currentReplaySnapshot.value) {
    applyReplaySnapshotToBattlefield(currentReplaySnapshot.value);
  }
  manualDecisionError.value = '';
  if (!battleResult.value?.decisionRequest) manualActionChoice.value = null;
  manualTargetChoice.value = null;
  manualSelectedSkillKey.value = null;
  manualSkillHoverKey.value = null;
  nextTick(() => startManualAutoFlow());
});

watch(manualDecisionContext, (ctx) => {
  if (!ctx) return;
  if (ctx.isStunned || ctx.isProvoked) {
    manualActionChoice.value = null;
    manualSelectedSkillKey.value = null;
    return;
  }
  // Par défaut, on reste sur attaque de base pour afficher immédiatement les cibles valides.
  if (!manualActionChoice.value) {
    manualActionChoice.value = 'BASIC';
    manualSelectedSkillKey.value = null;
  }
});

watch(
  () => [
    autoMode.value,
    manualDecisionContext.value,
    battleResult.value?.decisionRequest,
    replayFrameIndex.value,
    replayFrames.value.length
  ],
  () => {
    if (!autoMode.value || !battleResult.value?.decisionRequest || replayFrameIndex.value < replayFrames.value.length - 1) return;
    const ctx = manualDecisionContext.value;
    if (!ctx || ctx.isStunned || ctx.isProvoked) return;
    // Onglet masqué : performAutoDecision est enchaîné par flushHiddenReplayCatchUp (évite double soumission).
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    nextTick(() => performAutoDecision());
  },
  { flush: 'post' }
);

/** Reprendre l'intervalle de replay en avant-plan ; rattraper le combat en arrière-plan. */
function onCombatDocumentVisibilityChange() {
  if (!hasReplayMode.value || !battleResult.value) return;
  if (document.visibilityState === 'visible') {
    startManualAutoFlow();
    // En auto, au dernier frame le timer ne tourne pas : le watch peut ne pas se redéclencher au retour d’onglet.
    if (
      autoMode.value &&
      battleResult.value.decisionRequest &&
      replayFrameIndex.value >= replayFrames.value.length - 1
    ) {
      const ctx = manualDecisionContext.value;
      if (ctx && !ctx.isStunned && !ctx.isProvoked) {
        nextTick(() => performAutoDecision());
      }
    }
  } else {
    flushHiddenReplayCatchUp();
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', onCombatDocumentVisibilityChange);
});
onUnmounted(() => {
  document.removeEventListener('visibilitychange', onCombatDocumentVisibilityChange);
});

function triggerReplayAttackAnimations() {
  if (!hasReplayMode.value || !battlefieldRef.value) return;
  const frames = replayFrames.value;
  const idx = replayFrameIndex.value;
  const frame = frames[idx];
  const event = frame?.event as Record<string, unknown> | undefined;
  if (!event) return;
  const type = String(event.type ?? '').toUpperCase();
  let sourceId: string | number | null = (event.sourceId ?? event.actor) as string | number | null ?? null;
  let targetId: string | number | null = (event.targetId ?? event.target) as string | number | null ?? null;
  if (type === 'GROUPED_DAMAGE' && event.baseEvent) {
    const base = event.baseEvent as Record<string, unknown>;
    sourceId = (base.sourceId ?? base.actor) as string | number | null ?? null;
    targetId = (base.targetId ?? base.target) as string | number | null ?? null;
  }
  if (type !== 'ATTACK' && type !== 'BASIC_ATTACK' && type !== 'SKILL_CAST' && type !== 'DAMAGE' && type !== 'GROUPED_DAMAGE') return;
  if (sourceId == null || targetId == null) return;
  const actorRes = resolveUnitFromLogId(sourceId);
  const targetRes = resolveUnitFromLogId(targetId);
  if (!actorRes.domId || !targetRes.domId) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => animateAttack(actorRes.domId!, targetRes.domId!));
  });
}

function scrollLogColumnsToBottom() {
  nextTick(() => {
    logColumnARef.value && (logColumnARef.value.scrollTop = logColumnARef.value.scrollHeight);
    logColumnBRef.value && (logColumnBRef.value.scrollTop = logColumnBRef.value.scrollHeight);
  });
}

watch(replayFrameIndex, () => {
  nextTick(triggerReplayAttackAnimations);
  if (hasReplayMode.value) {
    replayLogScrollLock.value = false;
    scrollLogColumnsToBottom();
  }
});

watch(visibleReplayLogEntries, () => {
  if (hasReplayMode.value) {
    scrollLogColumnsToBottom();
  }
}, { deep: true });

function updateHP(unitId: string, newHp: number, maxHp: number) {
  const combatIndex = getCombatIndex(unitId);
  const domId = combatIndex != null ? `unit-${combatIndex}` : null;
  if (domId) {
    const root = battlefieldRef.value;
    const fill = root?.querySelector(`#${CSS.escape(domId)} .hp-fill`) as HTMLElement | null;
    if (fill) {
      const percent = Math.max(0, (newHp / maxHp) * 100);
      fill.style.height = percent + '%';
    }
    const hp = Math.max(0, newHp);
    battlefieldHp.value = { ...battlefieldHp.value, [unitId]: hp };
    if (hp <= 0 && !deadUnits.value.has(domId)) {
      deadUnits.value = new Set(deadUnits.value).add(domId);
      const unitEl = document.getElementById(domId);
      if (unitEl) {
        unitEl.classList.add('dead');
        unitEl.style.transition = 'opacity 0.4s ease';
        unitEl.style.opacity = '0.3';
      }
    }
  } else {
    const hp = Math.max(0, newHp);
    battlefieldHp.value = { ...battlefieldHp.value, [unitId]: hp };
  }
}

const ATTACK_ANIM_DURATION_MS = 220;

function animateAttack(attackerDomId: string, targetDomId: string): Promise<void> {
  return new Promise((resolve) => {
    const root = battlefieldRef.value as HTMLElement | null;
    const attacker = (root?.querySelector(`#${CSS.escape(attackerDomId)}`) ?? document.getElementById(attackerDomId)) as HTMLElement | null;
    const target = (root?.querySelector(`#${CSS.escape(targetDomId)}`) ?? document.getElementById(targetDomId)) as HTMLElement | null;
    if (!attacker || !target) return resolve();
    const attackerRect = attacker.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const attackerCenterX = attackerRect.left + attackerRect.width / 2;
    const attackerCenterY = attackerRect.top + attackerRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const fullDx = targetCenterX - attackerCenterX;
    const fullDy = targetCenterY - attackerCenterY;
    const dx = fullDx;
    const dy = fullDy;
    attacker.style.willChange = 'transform';
    attacker.style.transition = `transform ${ATTACK_ANIM_DURATION_MS}ms ease-out`;
    attacker.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
    attacker.style.zIndex = '10';
    setTimeout(() => {
      attacker.style.transition = `transform ${ATTACK_ANIM_DURATION_MS}ms ease-in`;
      attacker.style.transform = '';
      setTimeout(() => {
        attacker.style.transition = '';
        attacker.style.zIndex = '';
        attacker.style.willChange = '';
        resolve();
      }, ATTACK_ANIM_DURATION_MS);
    }, ATTACK_ANIM_DURATION_MS);
  });
}

function showFloatingText(targetDomId: string, text: string, color = '#fff', variant = '') {
  const root = battlefieldRef.value;
  if (!root) return;
  const target = root.querySelector(`#${CSS.escape(targetDomId)}`) as HTMLElement | null;
  if (!target) return;
  const container = target.querySelector('.float-container') as HTMLElement | null;
  if (!container) return;
  const floating = document.createElement('div');
  floating.className = variant ? `floating-text ${variant}` : 'floating-text';
  floating.textContent = text;
  floating.style.color = color;
  container.appendChild(floating);
  setTimeout(() => floating.remove(), 1000);
}

function shortStatLabelFr(stat: unknown): string {
  const key = String(stat ?? '').trim().toLowerCase();
  if (key === 'attack') return 'ATQ';
  if (key === 'defense') return 'DEF';
  if (key === 'speed') return 'VIT';
  if (key === 'mastery') return 'MTR';
  return 'STAT';
}

function addShieldOverlay(domId: string, value: number) {
  const root = battlefieldRef.value;
  if (!root) return;
  const unitEl = root.querySelector(`#${CSS.escape(domId)}`) as HTMLElement | null;
  if (!unitEl) return;
  const circle = unitEl.querySelector('.unit-circle');
  if (!circle) return;
  let overlay = unitEl.querySelector('.shield-overlay') as HTMLElement | null;
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'shield-overlay';
    circle.appendChild(overlay);
  }
  overlay.textContent = `🛡 ${value}`;
  overlay.classList.add('shield-overlay-visible');
  setTimeout(() => {
    overlay?.classList.remove('shield-overlay-visible');
  }, 2500);
}

/** Désactivé : les buffs sont rendus uniquement par UnitCircle.vue (snapshot réactif). */
function addStatusEffect(_domId: string, _effectType: string, _isDebuff: boolean, _duration?: number) {}

/** Désactivé : plus d'injection DOM pour les buffs. */
function updateStatusDuration(_domId: string, _effectType: string, _remainingActions: number) {}

/** Désactivé : plus d'injection DOM pour les buffs. */
function removeBuff(_unitDomId: string, _effectType: string) {}

/** Désactivé : plus de conteneur legacy .status-icon en DOM. */
function clearBuffs() {}

async function processLog(event: NormalizedBattleEvent | BattleLogEvent) {
  const rawType = (event as NormalizedBattleEvent).type ?? (event as BattleLogEvent).type ?? '';
  const type = String(rawType).toLowerCase();
  if (type === 'skill_cast') {
    return;
  }
  const sourceId = (event as BattleLogEvent).sourceId ?? (event as NormalizedBattleEvent).sourceId ?? null;
  const targetId = (event as BattleLogEvent).targetId ?? (event as NormalizedBattleEvent).targetId ?? null;
  const value = (event as BattleLogEvent).value ?? (event as NormalizedBattleEvent).value ?? (event as NormalizedBattleEvent).meta?.value ?? null;
  const meta = (event as NormalizedBattleEvent).meta ?? (event as BattleLogEvent).extra ?? {};
  const amount = (meta?.amount as number) ?? value;
  const effectiveValue = value != null ? value : (typeof amount === 'number' ? amount : null);
  const sourceName = (event as NormalizedBattleEvent).sourceName ?? (event as BattleLogEvent).sourceName ?? '?';
  const targetName = (event as NormalizedBattleEvent).targetName ?? (event as BattleLogEvent).targetName ?? '?';

  const team: 'A' | 'B' =
    (event as BattleLogEvent & { sourceTeam?: 'A' | 'B' }).sourceTeam ??
    (() => {
      const sid = getCombatIndex(sourceId);
      return sid !== null && sid < teamASize.value ? 'A' : 'B';
    })();
  const pushLog = (text: string, color: string) => {
    const entry = { text, color };
    if (team === 'A') logsTeamA.value = [...logsTeamA.value, entry];
    else logsTeamB.value = [...logsTeamB.value, entry];
    nextTick(() => {
      const el = team === 'A' ? logColumnARef.value : logColumnBRef.value;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const src = resolveUnitFromLogId(sourceId);
  const tgt = resolveUnitFromLogId(targetId);
  const attackerDomId = src.domId;
  const targetDomId = tgt.domId;
  const unitKeyIdTarget = tgt.unitKeyId;

  const needsTarget = ['damage', 'heal', 'shield', 'buff_apply', 'debuff_apply', 'strip'].includes(type);
  if (needsTarget && tgt.unit == null && targetId != null) {
    if (typeof console !== 'undefined' && console.warn) console.warn('processLog: unit not found for targetId', targetId, type);
  }

  if (type === 'death' || type === 'ko') {
    if (tgt.unit && unitKeyIdTarget != null) {
      pushLog(`${targetName} est KO.`, LOG_COLORS.death);
      updateHP(unitKeyIdTarget, 0, tgt.unit.maxHp ?? 100);
      if (targetDomId && !deadUnits.value.has(targetDomId)) {
        deadUnits.value = new Set(deadUnits.value).add(targetDomId);
        const unitEl = document.getElementById(targetDomId);
        if (unitEl) {
          unitEl.classList.add('dead');
          unitEl.style.opacity = '0.3';
        }
      }
    }
    await new Promise((r) => setTimeout(r, 400));
    return;
  }

  if (src.unit && battlefieldHp.value[src.unit.id] !== undefined && battlefieldHp.value[src.unit.id] <= 0) return;
  if (attackerDomId && !document.getElementById(attackerDomId)) return;
  if (targetDomId && !document.getElementById(targetDomId)) {
    if (type !== 'damage' && type !== 'heal' && type !== 'shield') return;
  }
  if (targetDomId && deadUnits.value.has(targetDomId) && type !== 'damage' && type !== 'heal' && type !== 'shield') return;

  if (type === 'damage' && unitKeyIdTarget != null && value != null && targetDomId) {
    const isCrit = meta.isCrit === true;
    const msg = isCrit
      ? `${sourceName} inflige ${value} dégâts critiques à ${targetName}.`
      : `${sourceName} inflige ${value} dégâts à ${targetName}.`;
    pushLog(msg, LOG_COLORS.damage);
    if (attackerDomId && src.unit && (battlefieldHp.value[src.unit.id] ?? 1) > 0) {
      await animateAttack(attackerDomId, targetDomId);
    }
    showFloatingText(targetDomId, isCrit ? `-${value} !` : `-${value}`, LOG_COLORS.damage);
    const maxHp = tgt.unit?.maxHp ?? 100;
    const newHp = meta.hpAfter != null ? Math.max(0, Number(meta.hpAfter)) : Math.max(0, (battlefieldHp.value[unitKeyIdTarget] ?? maxHp) - value);
    updateHP(unitKeyIdTarget, newHp, maxHp);
  }
  if ((type === 'heal' || type === 'regen_tick') && unitKeyIdTarget != null && targetDomId && (effectiveValue != null && effectiveValue > 0 || typeof meta.heal === 'number')) {
    const liveHealValue = effectiveValue != null ? effectiveValue : Number(meta.heal ?? 0);
    const isSelfHeal = sourceId != null && targetId != null && sourceId === targetId;
    const isRegen = meta.regen === true || type === 'regen_tick';
    const msg = isRegen
      ? `${targetName} se régénère de ${liveHealValue} PV.`
      : (isSelfHeal
        ? `${sourceName} récupère ${liveHealValue} PV.`
        : `${sourceName} soigne ${targetName} de ${liveHealValue} PV.`);
    pushLog(msg, LOG_COLORS.heal);
    showFloatingText(targetDomId, isRegen ? `+${liveHealValue} Régén.` : `+${liveHealValue}`, LOG_COLORS.heal, isRegen ? 'float-regen' : 'float-heal');
    const maxHp = tgt.unit?.maxHp ?? 100;
    const newHp = meta.hpAfter != null ? Math.min(maxHp, Number(meta.hpAfter)) : Math.min(maxHp, (battlefieldHp.value[unitKeyIdTarget] ?? 0) + liveHealValue);
    updateHP(unitKeyIdTarget, newHp, maxHp);
  }
  if (type === 'shield' && unitKeyIdTarget != null && targetDomId && (effectiveValue != null && effectiveValue > 0)) {
    const isSelf = sourceId != null && targetId != null && sourceId === targetId;
    const msg = isSelf
      ? `${sourceName} s'applique un bouclier de ${effectiveValue}.`
      : `${sourceName} applique un bouclier de ${effectiveValue} à ${targetName}.`;
    pushLog(msg, LOG_COLORS.shield);
    showFloatingText(targetDomId, `+${effectiveValue} 🛡`, LOG_COLORS.shield, 'float-shield');
    addShieldOverlay(targetDomId, effectiveValue);
  }
  if (type === 'buff_apply') {
    const buffType = String(meta.buffType ?? meta.buff ?? '').toUpperCase() || 'BUFF';
    const duration = Number(meta.duration ?? meta.remainingActions ?? 0) || 0;
    const isTeamWide = meta.teamWide === true;
    const isSelf = meta.self === true || (sourceId != null && targetId != null && sourceId === targetId) || meta.targetMode === 'SELF';
    const value = (meta.value ?? effectiveValue) as number | null | undefined;
    const phrase = getBuffPhrase(buffType || undefined);
    const label = formatBuffLabel(buffType || undefined) ?? 'effet';
    const durStr = duration ? ` (${duration} tour${duration !== 1 ? 's' : ''})` : '';
    if (isTeamWide) {
      const msg = phrase ? `${sourceName} ${phrase} toute l'équipe${durStr}.` : `${sourceName} renforce toute l'équipe : ${label}${durStr}.`;
      pushLog(msg, LOG_COLORS.buff);
    } else if (unitKeyIdTarget != null && targetDomId != null) {
      const msg = formatBuffEvent({
        kind: 'buff',
        sourceName,
        targetName,
        effectType: buffType,
        duration: duration || undefined,
        value: buffType === 'SHIELD' ? value ?? effectiveValue : null,
        isSelf
      });
      if (msg) pushLog(msg, LOG_COLORS.buff);
      const effectLabel = (buffType === 'APPLY_BUFF' || buffType === 'APPLY_DEBUFF') ? 'effet' : (NARRATIVE_BUFF_LABELS[buffType] ?? 'effet');
      showFloatingText(targetDomId, effectLabel, LOG_COLORS.buff, 'float-buff');
    }
  }
  if (type === 'debuff_apply' && unitKeyIdTarget != null && targetDomId != null) {
    const debuffType = String(meta.debuffType ?? meta.debuff ?? '').toUpperCase() || 'DEBUFF';
    const duration = Number(meta.duration ?? meta.remainingActions ?? 0) || 0;
    const isSelf = meta.self === true || (sourceId != null && targetId != null && sourceId === targetId) || meta.targetMode === 'SELF';
    const msg = formatBuffEvent({
      kind: 'debuff',
      sourceName,
      targetName,
      effectType: debuffType,
      duration: duration || undefined,
      value: null,
      isSelf
    });
    if (msg) pushLog(msg, LOG_COLORS.debuff);
    const effectLabelDebuff = (debuffType === 'APPLY_BUFF' || debuffType === 'APPLY_DEBUFF') ? 'effet' : (NARRATIVE_BUFF_LABELS[debuffType] ?? 'effet');
    showFloatingText(targetDomId, effectLabelDebuff, LOG_COLORS.debuff, 'float-debuff');
  }
  if (type === 'strip' && unitKeyIdTarget != null && value != null && targetDomId) {
    pushLog(`${sourceName} retire ${value} buff(s) à ${targetName}.`, LOG_COLORS.neutral);
  }

  if (type === 'passive_trigger') {
  }
  if (type === 'resurrect' && unitKeyIdTarget != null) {
    const pct = (meta.percent ?? meta.value) as number | undefined;
    const pctStr = pct != null ? ` (${Math.round(Number(pct) * 100)}% PV).` : '.';
    pushLog(`${targetName} est ressuscité${pctStr}`, LOG_COLORS.heal);
    if (targetDomId) showFloatingText(targetDomId, 'Résurrection', LOG_COLORS.heal, 'float-heal');
    const maxHp = tgt.unit?.maxHp ?? 100;
    const newHp = meta.hpAfter != null ? Math.max(1, Math.min(maxHp, Number(meta.hpAfter))) : Math.min(maxHp, Math.round(maxHp * (Number(meta.percent ?? 0.3))));
    updateHP(unitKeyIdTarget, newHp, maxHp);
    if (targetDomId && deadUnits.value.has(targetDomId)) {
      deadUnits.value = new Set(deadUnits.value);
      deadUnits.value.delete(targetDomId);
      const unitEl = document.getElementById(targetDomId);
      if (unitEl) {
        unitEl.classList.remove('dead');
        unitEl.style.opacity = '1';
      }
    }
  }
  if (type === 'atb_up' && unitKeyIdTarget != null && targetDomId) {
    const pct = (meta.percent ?? value) as number | undefined;
    const pctStr = pct != null ? ` +${typeof pct === 'number' && pct <= 1 ? Math.round(pct * 100) : pct}%` : '';
    pushLog(`${sourceName} accorde de l'ATB à ${targetName}${pctStr}.`, LOG_COLORS.shield);
    showFloatingText(targetDomId, `ATB${pctStr}`, LOG_COLORS.shield, 'float-buff');
  }
  if (type === 'reduce_atb' && unitKeyIdTarget != null && targetDomId) {
    const pct = (meta.percent ?? value) as number | undefined;
    const pctStr = pct != null ? ` -${typeof pct === 'number' && pct <= 1 ? Math.round(pct * 100) : pct}%` : '';
    pushLog(`${sourceName} réduit l'ATB de ${targetName}${pctStr}.`, LOG_COLORS.neutral);
    showFloatingText(targetDomId, `ATB${pctStr}`, LOG_COLORS.neutral, 'float-debuff');
  }
  const shieldAbsorbAmount = effectiveValue ?? (meta.valueAbsorbed as number) ?? value;
  if (type === 'shield_absorb' && unitKeyIdTarget != null && targetDomId && (shieldAbsorbAmount != null && shieldAbsorbAmount > 0)) {
    pushLog(`Le bouclier de ${targetName} absorbe ${shieldAbsorbAmount} dégâts.`, LOG_COLORS.shield);
    showFloatingText(targetDomId, `🛡 ${shieldAbsorbAmount}`, LOG_COLORS.shield, 'float-shield');
  }
  if (type === 'immune' && unitKeyIdTarget != null && targetDomId) {
    const reasonRaw = (meta.reason ?? '') as string;
    const reasonLabel = reasonRaw === 'INVINCIBILITY' ? 'Invulnérabilité' : (reasonRaw ? reasonRaw : 'Immunité');
    pushLog(`${targetName} est immunisé (${reasonLabel}).`, LOG_COLORS.neutral);
    showFloatingText(targetDomId, 'Immunisé', LOG_COLORS.neutral, 'float-buff');
  }
  if (type === 'debuff_resist' && unitKeyIdTarget != null && targetDomId) {
    const debuffType = String(meta.debuffType ?? meta.debuff ?? '').toUpperCase();
    const label = (debuffType === 'APPLY_BUFF' || debuffType === 'APPLY_DEBUFF') ? 'effet' : (NARRATIVE_BUFF_LABELS[debuffType] ?? 'effet');
    pushLog(`${targetName} résiste à ${label}.`, LOG_COLORS.debuff);
    showFloatingText(targetDomId, 'Résiste', LOG_COLORS.debuff, 'float-debuff');
  }
  if (type === 'effect_apply') {
    const message = String((event as Record<string, unknown>).message ?? meta.message ?? '').trim();
    if (message) {
      const isStatSteal = /vole/i.test(message);
      pushLog(message, isStatSteal ? LOG_COLORS.passive : LOG_COLORS.buff);
      if (targetDomId) {
        if (isStatSteal) {
          const amount = Number(meta.amount ?? 0);
          const stat = shortStatLabelFr(meta.stat);
          showFloatingText(targetDomId, `${stat} -${amount}`, LOG_COLORS.debuff, 'float-steal-loss');
        } else {
          showFloatingText(targetDomId, 'Effet', LOG_COLORS.buff, 'float-buff');
        }
      }
      if (isStatSteal && attackerDomId) {
        const amount = Number(meta.amount ?? 0);
        const stat = shortStatLabelFr(meta.stat);
        showFloatingText(attackerDomId, `${stat} +${amount}`, LOG_COLORS.passive, 'float-steal-gain');
      }
    }
  }
  if (type === 'counter_attack') {
    pushLog(`${sourceName} contre-attaque ${targetName}.`, LOG_COLORS.damage);
  }
  if (type === 'defend_redirect' && targetName && meta.protectorName) {
    pushLog(`${String(meta.protectorName)} protège ${targetName}.`, LOG_COLORS.buff);
  }
  if (type === 'synergy_trigger') {
    const trait = (meta.synergyType ?? meta.trait ?? 'Synergie') as string;
    const subType = (meta.subType ?? '') as string;
    const val = value ?? meta.value ?? meta.healAmount;
    pushLog(formatSynergyTriggerLog(trait, subType, typeof val === 'number' ? val : undefined, sourceName), LOG_COLORS.passive);
  }
  if (type === 'boss_trigger') {
    const subType = (meta.subType ?? '') as string;
    pushLog(`Boss : ${subType}.`, LOG_COLORS.neutral);
  }

  const handledTypes = new Set([
    'death', 'ko', 'damage', 'heal', 'shield', 'buff_apply', 'buff_tick', 'buff_remove',
    'debuff_apply', 'debuff_tick', 'debuff_remove', 'strip', 'removebuff', 'remove_buff', 'regen_tick',
    'passive_trigger', 'resurrect', 'atb_up', 'reduce_atb', 'shield_absorb', 'immune', 'debuff_resist', 'effect_apply',
    'skill_cast', 'counter_attack', 'defend_redirect', 'synergy_trigger', 'boss_trigger'
  ]);
  if (type && !handledTypes.has(type)) {
    if (typeof console !== 'undefined' && console.warn) console.warn('UNHANDLED EVENT TYPE:', type);
  }

  await new Promise((r) => setTimeout(r, 400));
}

function renderLegend() {
  const legend = document.getElementById('combat-legend');
  if (!legend) return;
  legend.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = 'Légende';
  title.style.margin = '0 0 12px 0';
  title.style.fontSize = '14px';
  title.style.color = '#e5e7eb';
  legend.appendChild(title);
  const sectionDebuff = document.createElement('div');
  sectionDebuff.innerHTML = '<div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Débuffs</div>';
  Object.entries(debuffConfig).forEach(([key, cfg]) => {
    const row = document.createElement('div');
    row.classList.add('legend-row');
    row.innerHTML = `<span class="legend-icon">${cfg.icon}</span><span class="legend-label">${cfg.label}</span>`;
    row.title = cfg.description;
    sectionDebuff.appendChild(row);
  });
  legend.appendChild(sectionDebuff);
  const sectionBuff = document.createElement('div');
  sectionBuff.innerHTML = '<div style="font-size:11px;color:#94a3b8;margin:12px 0 6px 0;">Buffs</div>';
  Object.entries(buffConfig).forEach(([key, cfg]) => {
    const row = document.createElement('div');
    row.classList.add('legend-row');
    row.innerHTML = `<span class="legend-icon">${cfg.icon}</span><span class="legend-label">${cfg.label}</span>`;
    row.title = cfg.description;
    sectionBuff.appendChild(row);
  });
  legend.appendChild(sectionBuff);
}

async function playLogsAutomatically() {
  if (normalizedBattleLog.value.length === 0) return;
  logsTeamA.value = [];
  logsTeamB.value = [];
  initBattlefieldHp();
  clearBuffs();
  replayRunning.value = true;
  const events = normalizedBattleLog.value.filter((e) => {
    const t = String((e as BattleLogEvent).type ?? '').toLowerCase();
    return t !== 'turn_start' && t !== 'battle_end';
  });
  for (let i = 0; i < events.length; i++) {
    try {
      await processLog(events[i]);
    } catch (err) {
      if (typeof console !== 'undefined' && console.error) console.error('processLog failed', events[i], err);
    }
  }
  cleanupDeadUnits();
  replayRunning.value = false;
}

function cleanupDeadUnits() {
  const units = initialUnitsForBattlefield.value;
  deadUnits.value.forEach((domId) => {
    const unitEl = document.getElementById(domId);
    if (unitEl) unitEl.remove();
    const combatIndex = parseInt(domId.replace(/^unit-/, ''), 10);
    if (!Number.isNaN(combatIndex) && units[combatIndex]) {
      deadUnitIds.value = new Set(deadUnitIds.value).add(units[combatIndex].id);
    }
  });
  deadUnits.value = new Set();
}

const debuffConfig: Record<string, { icon: string; label: string; description: string }> = {
  ATK_DOWN: { icon: '⚔', label: 'ATQ -30%', description: "Réduit l'attaque de 30%" },
  DEF_DOWN: { icon: '🛡', label: 'DEF -30%', description: 'Réduit la défense de 30%' },
  SLOW: { icon: '⏳', label: 'Ralentissement', description: 'Réduit la vitesse de 20%' },
  SILENCE: { icon: '🔇', label: 'Silence', description: "Empêche l'utilisation des compétences" },
  STUN: { icon: '★', label: 'Étourdissement', description: 'Passe son tour' },
  PROVOKE: { icon: '🎯', label: 'Provocation', description: 'Force les attaques sur cette unité' },
  ANTI_HEAL: { icon: '💔', label: 'Anti-Soin', description: 'Empêche tout soin reçu' },
  ANTI_SHIELD: { icon: '🛡', label: 'Anti-Bouclier', description: 'Empêche tout nouveau bouclier' },
  ANTI_BUFF: { icon: '✕', label: 'Anti-Buff', description: "Empêche l'obtention de nouveaux buffs" },
  DOT: { icon: '🔥', label: 'Dégâts sur la durée', description: '5% HP max par stack au début du tour (cumulable)' },
  ATB_DOWN: { icon: '↓', label: 'ATB -', description: 'Réduit la jauge d\'action' },
  BLIND: { icon: '☁', label: 'Aveuglement', description: '25% chance de rater' },
  STAT_STEAL_DEBUFF: { icon: '🧲', label: 'Stat volée', description: "Une partie de la stat est volée temporairement" }
};

function legendVisual(key: string, isDebuff: boolean) {
  return getBuffVisual(key, isDebuff);
}

const buffConfig: Record<string, { icon: string; label: string; description: string }> = {
  ATK_UP: { icon: '⚔', label: 'ATQ +50%', description: "Augmente l'attaque de 50%" },
  DEF_UP: { icon: '🛡', label: 'DEF +50%', description: 'Augmente la défense de 50%' },
  SPEED: { icon: '⚡', label: 'Vitesse', description: 'Augmente la vitesse de 30%' },
  CRIT_UP: { icon: '💥', label: 'Critique', description: 'Augmente les dégâts critiques' },
  SHIELD: { icon: '🛡', label: 'Bouclier', description: 'Absorbe les dégâts (anneau bleu)' },
  REGEN: { icon: '💚', label: 'Régénération', description: 'Soigne au début du tour (cumulable)' },
  STAT_STEAL_BUFF: { icon: '🧲', label: 'Vol de stats', description: 'Stat temporairement volée à un ennemi' },
  IMMUNITY: { icon: '✨', label: 'Immunité', description: 'Immunité aux débuffs (anneau blanc)' },
  INVINCIBILITY: { icon: '○', label: 'Invulnérable', description: 'Invulnérable aux dégâts (anneau pulsant)' },
  DEFEND: { icon: '🛡', label: 'Protection', description: 'Redirige les attaques sur cette unité' }
};

const DEBUFF_LABELS: Record<string, string> = {
  DEF_DOWN: 'DEF',
  ATK_DOWN: 'ATQ',
  SLOW: 'Ralentissement',
  ANTI_BUFF: 'Anti-Buff',
  ANTI_HEAL: 'Anti-Soin',
  ANTI_SHIELD: 'Anti-Bouclier',
  DOT: 'DOT',
  STUN: 'Étourdissement',
  SILENCE: 'Silence',
  BLIND: 'Aveuglement',
  ATB_DOWN: 'ATB',
  PROVOKE: 'Provocation',
  PROVOCATION: 'Provocation',
  STAT_STEAL_DEBUFF: 'Stat volée' /* alias pour affichage logs, légende = PROVOKE uniquement */
};

const BUFF_LABELS: Record<string, string> = {
  ATK_UP: 'ATQ',
  DEF_UP: 'DEF',
  SPD_UP: 'Vitesse',
  SPEED: 'Vitesse',
  CRIT_UP: 'Critique',
  SHIELD: 'Bouclier',
  REGEN: 'Régénération',
  HEAL_OVER_TIME: 'Régénération',
  STAT_STEAL_BUFF: 'Vol de stats',
  IMMUNITY: 'Immunité',
  INVINCIBILITY: 'Invulnérable',
  DEFEND: 'Protection'
};

/** Libellés narratifs pour les logs (jamais afficher type brut). */
const NARRATIVE_BUFF_LABELS: Record<string, string> = {
  ATK_UP: "l'attaque",
  DEF_UP: 'la défense',
  SPEED_UP: 'la vitesse',
  SPD_UP: 'la vitesse',
  SPEED: 'la vitesse',
  ATK_DOWN: "l'attaque",
  DEF_DOWN: 'la défense',
  SLOW: 'la vitesse',
  SPEED_DOWN: 'la vitesse',
  SHIELD: 'Bouclier',
  REGEN: 'Régénération',
  CRIT_UP: 'les dégâts critiques',
  HEAL_OVER_TIME: 'Régénération',
  STAT_STEAL_BUFF: 'Vol de stats',
  STAT_STEAL_DEBUFF: 'Stat volée',
  IMMUNITY: 'Immunité',
  INVINCIBILITY: 'Invulnérable',
  DEFEND: 'Protection',
  SILENCE: 'le silence',
  ANTI_HEAL: "l'anti-soin",
  ANTI_SHIELD: "l'anti-bouclier",
  ANTI_BUFF: "l'anti-buff",
  DOT: 'DOT',
  STUN: 'Étourdissement',
  BLIND: 'Aveuglement',
  ATB_DOWN: "l'ATB",
  ATB_UP: "l'ATB",
  PROVOKE: 'Provocation',
  PROVOCATION: 'Provocation'
};

/** Phrase complète pour un buff (ex. "augmente l'ATB de") pour "X [phrase] Y." */
const NARRATIVE_BUFF_PHRASE: Record<string, string> = {
  ATB_UP: "augmente l'ATB de",
  ATK_UP: "augmente l'attaque de",
  DEF_UP: 'augmente la défense de',
  SPEED_UP: 'augmente la vitesse de',
  SPD_UP: 'augmente la vitesse de',
  SPEED: 'augmente la vitesse de',
  CRIT_UP: 'augmente les dégâts critiques de',
  IMMUNITY: "accorde l'immunité à",
  INVINCIBILITY: 'rend invulnérable',
  SHIELD: 'applique un bouclier à',
  REGEN: 'applique une régénération à',
  DEFEND: 'protège'
};

/** Phrase complète pour un debuff (ex. "réduit la défense de") pour "X [phrase] Y (N tours)." */
const NARRATIVE_DEBUFF_PHRASE: Record<string, string> = {
  ATK_DOWN: "réduit l'attaque de",
  DEF_DOWN: 'réduit la défense de',
  SLOW: 'ralentit',
  SPEED_DOWN: 'réduit la vitesse de',
  SILENCE: 'réduit au silence',
  BLIND: 'aveugle',
  STUN: 'étourdit',
  PROVOKE: 'provoque',
  PROVOCATION: 'provoque',
  ANTI_HEAL: "inflige l'anti-soin à",
  ANTI_SHIELD: "inflige l'anti-bouclier à",
  ANTI_BUFF: "inflige l'anti-buff à",
  DOT: 'inflige des dégâts sur la durée à',
  ATB_DOWN: "réduit l'ATB de",
  STAT_STEAL_DEBUFF: 'vole les stats de'
};

/** Couleurs narratives (dégâts=rouge, heal=vert, buff=bleu, debuff=violet, passive=cyan). */
const LOG_COLORS = {
  damage: '#ef4444',
  heal: '#22c55e',
  buff: '#3b82f6',
  debuff: '#8b5cf6',
  passive: '#06b6d4',
  shield: '#60a5fa',
  death: '#ef4444',
  neutral: '#94a3b8'
};

function getUnitNameForNarrative(id: string | number | null | undefined): string {
  if (id == null) return '?';
  const units = initialUnitsForBattlefield.value;
  if (typeof id === 'number' && id >= 0 && id < units.length) return units[id]?.name ?? String(id);
  if (typeof id === 'string') {
    const parsed = parseInt(id, 10);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed < units.length) return units[parsed]?.name ?? id;
    const u = units.find((x) => x.id === id);
    return u?.name ?? id;
  }
  return String(id);
}

function getTeamOf(unitId: string | number | null | undefined): 'A' | 'B' {
  if (unitId == null) return 'A';
  const units = initialUnitsForBattlefield.value;
  const idx = typeof unitId === 'number' ? unitId : (typeof unitId === 'string' ? parseInt(unitId, 10) : NaN);
  if (!Number.isNaN(idx) && idx >= 0 && idx < units.length) return units[idx].side === 'B' ? 'B' : 'A';
  const u = units.find((x) => x.id === unitId);
  return u?.side === 'B' ? 'B' : 'A';
}

function getTeamUnitIds(side: 'A' | 'B'): string[] {
  return initialUnitsForBattlefield.value.filter((u) => u.side === side).map((u) => u.id);
}

function isEntireTeam(targetIds: (string | number | null | undefined)[], sourceId: string | number | null | undefined): boolean {
  const side = getTeamOf(sourceId);
  const teamIds = new Set(getTeamUnitIds(side).map((id) => id));
  const normalized = targetIds.map((id) => (typeof id === 'number' ? initialUnitsForBattlefield.value[id]?.id : id)).filter(Boolean);
  if (normalized.length !== teamIds.size) return false;
  return normalized.every((id) => teamIds.has(id as string));
}

function isEnemyTeamFull(targetIds: (string | number | null | undefined)[], sourceId: string | number | null | undefined): boolean {
  const sourceSide = getTeamOf(sourceId);
  const enemySide = sourceSide === 'A' ? 'B' : 'A';
  const teamIds = new Set(getTeamUnitIds(enemySide).map((id) => id));
  const normalized = targetIds.map((id) => (typeof id === 'number' ? initialUnitsForBattlefield.value[id]?.id : id)).filter(Boolean);
  if (normalized.length !== teamIds.size) return false;
  return normalized.every((id) => teamIds.has(id as string));
}

function formatTargets(targets: (string | number | null | undefined)[]): string {
  if (targets.length === 1) return getUnitNameForNarrative(targets[0]);
  return targets.map((t) => getUnitNameForNarrative(t)).join(', ');
}

/** Détermine buff/debuff via buffType (jamais via event.type). */
function buffKind(buffType: string | undefined): 'shield' | 'buff' | 'debuff' | 'other' {
  if (!buffType) return 'other';
  const t = String(buffType).toUpperCase();
  if (t === 'SHIELD') return 'shield';
  if (t === 'REGEN' || t === 'STAT_STEAL_BUFF') return 'buff';
  if (t === 'STAT_STEAL_DEBUFF') return 'debuff';
  if (t.endsWith('_UP')) return 'buff';
  if (t.endsWith('_DOWN') || t === 'SLOW' || t === 'SILENCE' || t === 'BLIND' || t === 'PROVOKE' || t === 'STUN' || t === 'DOT' || t.startsWith('ANTI_')) return 'debuff';
  return 'other';
}

function formatBuffLabel(type: string | undefined): string | null {
  if (!type) return null;
  const key = String(type).toUpperCase();
  return NARRATIVE_BUFF_LABELS[key] ?? (key !== 'APPLY_BUFF' && key !== 'APPLY_DEBUFF' ? type : null);
}

function formatDebuffLabel(type: string | undefined): string {
  if (!type) return 'effet';
  const key = String(type).toUpperCase();
  return NARRATIVE_BUFF_LABELS[key] ?? type;
}

/** Retourne la phrase pour "X [phrase] Y" (buff), ex. "augmente l'ATB de". */
function getBuffPhrase(type: string | undefined): string | null {
  if (!type) return null;
  return NARRATIVE_BUFF_PHRASE[String(type).toUpperCase()] ?? null;
}

/** Retourne la phrase pour "X [phrase] Y (N tours)" (debuff), ex. "réduit la défense de". */
function getDebuffPhrase(type: string | undefined): string | null {
  if (!type) return null;
  return NARRATIVE_DEBUFF_PHRASE[String(type).toUpperCase()] ?? null;
}

/** Phrase unique pour un groupe d'effets appliqués à plusieurs cibles (EFFECT_APPLY). */
function formatGroupedEffectApplyPhrase(sourceName: string, effectKey: string): { text: string; color: string } {
  let key = effectKey.toUpperCase().trim();
  // Normaliser les clés issues du parsing de messages français (chemin de secours)
  const FRENCH_STAT_TO_KEY: Record<string, string> = {
    "L'ATTAQUE": 'ATK_UP', 'LA DEFENSE': 'DEF_UP', 'LA DÉFENSE': 'DEF_UP',
    'LA VITESSE': 'SPEED_UP', 'LES DEGATS CRITIQUES': 'CRIT_UP', 'LES DÉGÂTS CRITIQUES': 'CRIT_UP',
    "L'IMMUNITE": 'IMMUNITY', 'IMMUNITE': 'IMMUNITY',
  };
  if (FRENCH_STAT_TO_KEY[key]) key = FRENCH_STAT_TO_KEY[key];
  // Aliases courants
  if (key === 'SPEED' || key === 'SPD_UP') key = 'SPEED_UP';
  if (key === 'PROVOCATION') key = 'PROVOKE';

  // Effets spéciaux
  if (key === 'HEAL') return { text: `${sourceName} soigne tous les alliés.`, color: LOG_COLORS.heal };
  if (key === 'RESURRECT') return { text: `${sourceName} ressuscite plusieurs alliés.`, color: LOG_COLORS.heal };
  if (key === 'STEAL_STAT' || key === 'STAT_STEAL_DEBUFF') return { text: `${sourceName} vole des stats à plusieurs cibles.`, color: LOG_COLORS.passive };
  if (key === 'RESET_SKILL_COOLDOWN') return { text: `${sourceName} remet plusieurs temps de recharge à 0.`, color: LOG_COLORS.neutral };
  if (key === 'SET_SKILL_COOLDOWN_MAX') return { text: `${sourceName} remet plusieurs temps de recharge à leur valeur initiale.`, color: LOG_COLORS.debuff };
  if (key === 'CD_UP') return { text: `${sourceName} retarde les temps de recharge adverses.`, color: LOG_COLORS.debuff };
  if (key === 'CD_DOWN') return { text: `${sourceName} accélère les temps de recharge alliés.`, color: LOG_COLORS.buff };
  if (key === 'ATB_UP') return { text: `${sourceName} augmente l'ATB de toute son équipe.`, color: LOG_COLORS.buff };
  if (key === 'ATB_DOWN') return { text: `${sourceName} réduit l'ATB de l'équipe ennemie.`, color: LOG_COLORS.debuff };

  // Débuffs connus
  const debuffKeys = ['ATK_DOWN', 'DEF_DOWN', 'SLOW', 'SPEED_DOWN', 'SILENCE', 'BLIND', 'ANTI_HEAL', 'ANTI_SHIELD', 'ANTI_BUFF', 'DOT', 'STUN', 'PROVOKE'];
  if (debuffKeys.includes(key)) {
    const phrase = getDebuffPhrase(key);
    if (phrase) return { text: `${sourceName} ${phrase} l'équipe ennemie.`, color: LOG_COLORS.debuff };
    const label = NARRATIVE_BUFF_LABELS[key] ?? formatDebuffLabel(key) ?? key;
    return { text: `${sourceName} affaiblit l'équipe ennemie : ${label}.`, color: LOG_COLORS.debuff };
  }

  // Buffs connus
  const buffKeys = ['ATK_UP', 'DEF_UP', 'SPEED_UP', 'CRIT_UP', 'IMMUNITY', 'INVINCIBILITY', 'SHIELD', 'DEFEND', 'REGEN', 'HEAL_OVER_TIME', 'STAT_STEAL_BUFF'];
  if (buffKeys.includes(key)) {
    const phrase = getBuffPhrase(key);
    if (phrase) return { text: `${sourceName} ${phrase} toute son équipe.`, color: LOG_COLORS.buff };
    const label = NARRATIVE_BUFF_LABELS[key] ?? formatBuffLabel(key) ?? key;
    return { text: `${sourceName} renforce toute son équipe : ${label}.`, color: LOG_COLORS.buff };
  }

  // Génériques : on sait au moins si c'est un buff ou un débuff
  if (key === 'APPLY_BUFF') return { text: `${sourceName} renforce toute son équipe.`, color: LOG_COLORS.buff };
  if (key === 'APPLY_DEBUFF') return { text: `${sourceName} affaiblit l'équipe ennemie.`, color: LOG_COLORS.debuff };

  // Dernier recours : label formaté ou clé brute
  const label = NARRATIVE_BUFF_LABELS[key] ?? formatDebuffLabel(key) ?? formatBuffLabel(key) ?? null;
  if (label) return { text: `${sourceName} applique ${label} à toutes les cibles.`, color: LOG_COLORS.buff };
  return { text: `${sourceName} affecte plusieurs cibles.`, color: LOG_COLORS.buff };
}

function renderGroupedBuff(group: { type: string; baseEvent: Record<string, unknown>; targets: (string | number | null | undefined)[] }): string {
  const { baseEvent, targets } = group;
  const source = getUnitNameForNarrative(baseEvent.sourceId as string | number);
  const meta = (baseEvent.meta ?? baseEvent.extra ?? {}) as Record<string, unknown>;
  const rawBuffType = String(baseEvent.meta?.buffType ?? baseEvent.buffType ?? baseEvent.meta?.debuffType ?? baseEvent.debuffType ?? '').toUpperCase();
  const isDebuff = String(baseEvent.type ?? baseEvent.meta?.debuffType ?? '').toUpperCase() === 'APPLY_DEBUFF' || !!baseEvent.debuffType || !!meta?.debuffType;
  const label = isDebuff ? (formatDebuffLabel(rawBuffType || undefined) || 'effet') : (formatBuffLabel(rawBuffType || undefined) ?? 'effet');
  const duration = Number(baseEvent.remainingActions ?? meta?.remainingActions ?? baseEvent.meta?.remainingActions ?? 1);
  const durationStr = duration > 1 ? `${duration} tours` : '1 tour';
  const value = baseEvent.value ?? (baseEvent.meta as Record<string, unknown>)?.value ?? (baseEvent.meta as Record<string, unknown>)?.amount;
  const kind = buffKind(rawBuffType || undefined);

  if (kind === 'shield') {
    if (value != null && Number(value) > 0) {
      if (targets.length === 1) return `${source} applique un bouclier de ${value} à ${formatTargets(targets)}.`;
      if (isEntireTeam(targets, baseEvent.sourceId)) return `${source} applique un bouclier de ${value} à toute son équipe.`;
      return `${source} applique un bouclier de ${value} à ${formatTargets(targets)}.`;
    }
    if (targets.length === 1) return `${source} applique un bouclier à ${formatTargets(targets)}.`;
    if (isEntireTeam(targets, baseEvent.sourceId)) return `${source} applique un bouclier à toute son équipe.`;
    return `${source} applique un bouclier à ${formatTargets(targets)}.`;
  }

  if (kind === 'buff') {
    if (targets.length === 1) return `${source} renforce ${formatTargets(targets)} : ${label} (${durationStr}).`;
    const isTeamBuff = targets.length > 1 && targets.every((t) => getTeamOf(t) === getTeamOf(baseEvent.sourceId));
    if (isTeamBuff || isEntireTeam(targets, baseEvent.sourceId)) {
      const phrase = getBuffPhrase(rawBuffType || undefined);
      return phrase
        ? `${source} ${phrase} toute l'équipe (${durationStr}).`
        : `${source} renforce toute son équipe : ${label} (${durationStr}).`;
    }
    return `${source} renforce ${formatTargets(targets)} : ${label} (${durationStr}).`;
  }

  if (kind === 'debuff') {
    const phrase = getDebuffPhrase(rawBuffType || undefined);
    const natural = label.replace(/^l'armure/, "l'armure").replace(/^ATQ/, "l'attaque").replace(/^Vitesse/, 'la vitesse');
    const isTeamDebuff = targets.length > 1 && targets.every((t) => getTeamOf(t) !== getTeamOf(baseEvent.sourceId));
    if (isEnemyTeamFull(targets, baseEvent.sourceId) || isTeamDebuff) {
      return phrase ? `${source} ${phrase} l'équipe ennemie (${durationStr}).` : `${source} réduit ${natural} de l'équipe ennemie (${durationStr}).`;
    }
    if (targets.length === 1) {
      return phrase ? `${source} ${phrase} ${formatTargets(targets)} (${durationStr}).` : `${source} réduit ${natural} de ${formatTargets(targets)} (${durationStr}).`;
    }
    return phrase ? `${source} ${phrase} ${formatTargets(targets)} (${durationStr}).` : `${source} affaiblit ${formatTargets(targets)} : ${label} (${durationStr}).`;
  }

  if (targets.length === 1) return `${source} affecte ${formatTargets(targets)}.`;
  return `${source} affecte ${formatTargets(targets)}.`;
}

function renderGroupedDamage(group: { baseEvent: Record<string, unknown>; hits: Record<string, unknown>[] }): string {
  const { baseEvent, hits } = group;
  const source = getUnitNameForNarrative(baseEvent.sourceId as string | number);
  if (hits.some((h) => (h as Record<string, unknown>).isCrit)) {
    return `💥 ${source} inflige des dégâts critiques !`;
  }
  if (hits.length === 1) {
    const h = hits[0] as Record<string, unknown>;
    const target = getUnitNameForNarrative(h.targetId as string | number);
    const dmg = h.value ?? h.effectiveDamage ?? 0;
    return `${source} inflige ${dmg} dégâts à ${target}.`;
  }
  const targetIds = hits.map((h) => (h as Record<string, unknown>).targetId);
  if (isEnemyTeamFull(targetIds, baseEvent.sourceId)) {
    return `${source} inflige des dégâts à tous les ennemis.`;
  }
  const details = hits
    .map((h) => {
      const rec = h as Record<string, unknown>;
      return `${getUnitNameForNarrative(rec.targetId as string | number)} (${rec.value ?? rec.effectiveDamage ?? 0})`;
    })
    .join(', ');
  return `${source} inflige ${details}.`;
}

function renderGroupedHeal(group: { baseEvent: Record<string, unknown>; heals: Record<string, unknown>[] }): string {
  const { baseEvent, heals } = group;
  const source = getUnitNameForNarrative(baseEvent.sourceId as string | number);
  if (heals.length === 1) {
    const h = heals[0] as Record<string, unknown>;
    const val = h.value ?? h.healAmount ?? 0;
    const isRegen = h.meta?.regen === true || h.regen === true;
    if (isRegen) {
      return `${getUnitNameForNarrative(h.targetId as string | number)} se régénère de ${val} PV.`;
    }
    return `${source} soigne ${getUnitNameForNarrative(h.targetId as string | number)} de ${val} PV.`;
  }
  // Plusieurs cibles = soin de zone / équipe : une seule phrase.
  return `${source} soigne tous les alliés.`;
}

function renderGroupedShield(group: { baseEvent: Record<string, unknown>; shields: Record<string, unknown>[] }): string {
  const { baseEvent, shields } = group;
  const source = getUnitNameForNarrative(baseEvent.sourceId as string | number);
  const targetIds = shields.map((s) => (s as Record<string, unknown>).targetId);
  if (isEntireTeam(targetIds, baseEvent.sourceId)) {
    return `${source} applique un bouclier à toute son équipe.`;
  }
  const details = shields
    .map((s) => {
      const rec = s as Record<string, unknown>;
      return `${getUnitNameForNarrative(rec.targetId as string | number)} (${rec.value ?? 0})`;
    })
    .join(', ');
  return `${source} applique un bouclier à ${details}.`;
}

function renderGroupedDeath(group: { deaths: Record<string, unknown>[] }): string {
  const deaths = group.deaths;
  const names = deaths
    .map((d) => getUnitNameForNarrative((d as Record<string, unknown>).targetId as string | number))
    .join(', ');
  return deaths.length > 1 ? `${names} sont vaincus.` : `${names} est vaincu.`;
}

function renderGroupedRemoveBuff(group: { baseEvent: Record<string, unknown>; strips: Record<string, unknown>[] }): string {
  const { baseEvent, strips } = group;
  const source = getUnitNameForNarrative(baseEvent.sourceId as string | number);
  if (strips.length === 1) {
    const s = strips[0] as Record<string, unknown>;
    const targetId = s.targetId;
    const target = getUnitNameForNarrative(targetId as string | number);
    const removed = (s.removed as Array<{ buffType?: string; value?: number | null }>) ?? [];
    const labels = removed.map((b) => NARRATIVE_BUFF_LABELS[b.buffType ?? ''] ?? b.buffType ?? 'buff').filter(Boolean);
    const list = labels.length > 0 ? labels.join(', ') : 'des buffs';
    return `${source} dissipe sur ${target} : ${list}.`;
  }
  const parts = strips.map((s) => {
    const rec = s as Record<string, unknown>;
    const targetName = getUnitNameForNarrative(rec.targetId as string | number);
    const removed = (rec.removed as Array<{ buffType?: string }>) ?? [];
    const labels = removed.map((b) => NARRATIVE_BUFF_LABELS[b.buffType ?? ''] ?? b.buffType ?? 'buff').filter(Boolean);
    return `${targetName} (${labels.length > 0 ? labels.join(', ') : 'buffs'})`;
  });
  return `${source} dissipe : ${parts.join(' ; ')}.`;
}

function renderApplyBuff(event: Record<string, unknown>): string {
  const meta = (event.meta ?? event.extra ?? {}) as Record<string, unknown>;
  const source = getUnitNameForNarrative(event.sourceId as string | number);
  const target = getUnitNameForNarrative(event.targetId as string | number);
  const buffType = String(event.buffType ?? meta?.buffType ?? '').toUpperCase();
  const debuffType = String(event.debuffType ?? meta?.debuffType ?? '').toUpperCase();
  const duration = Number(event.remainingActions ?? meta?.remainingActions ?? meta?.duration ?? 1);
  const value = event.value ?? meta?.value;
  const isDebuff = event.type === 'APPLY_DEBUFF' || (event.type as string)?.toLowerCase() === 'debuff_apply' || !!event.debuffType || !!meta?.debuffType;

  const durStr = duration ? ` (${duration} tour${duration !== 1 ? 's' : ''})` : '';

  if (isDebuff || debuffType) {
    const type = debuffType || buffType;
    const phrase = getDebuffPhrase(type || undefined);
    const label = formatDebuffLabel(type || undefined);
    if (phrase) return `${source} ${phrase} ${target}${durStr}.`;
    return `${source} réduit ${label} de ${target}${durStr}.`;
  }

  const phrase = getBuffPhrase(buffType || undefined);
  const label = formatBuffLabel(buffType || undefined) ?? 'effet';
  const valueStr = value != null ? ` +${typeof value === 'number' && value <= 1 ? Math.round(value * 100) : value}%` : '';

  if (event.sourceId === event.targetId) {
    return `${source} gagne ${label}${valueStr}${durStr}.`;
  }
  if (phrase) return `${source} ${phrase} ${target}${durStr}.`;
  return `${source} applique ${label}${valueStr} à ${target}${durStr}.`;
}

function formatEventNarrative(event: Record<string, unknown>): string {
  const type = String(event.type ?? '').toUpperCase();
  const source = getUnitNameForNarrative(event.sourceId ?? event.actorId ?? event.actor);
  const target = getUnitNameForNarrative(event.targetId ?? event.target);
  const meta = (event.meta ?? event.extra ?? {}) as Record<string, unknown>;
  switch (type) {
    case 'DAMAGE':
    case 'damage': {
      const val = event.value ?? event.finalDamage ?? meta.value ?? 0;
      const crit = event.isCrit ?? meta.isCrit ? ' dégâts critiques' : ' dégâts';
      return `${source} inflige ${val}${crit} à ${target}.`;
    }
    case 'HEAL':
    case 'heal': {
      const val = event.value ?? meta.amount ?? meta.value ?? 0;
      if (meta.regen === true) {
        return `${target} se régénère de ${val} PV.`;
      }
      return source === target ? `${source} récupère ${val} PV.` : `${source} soigne ${target} de ${val} PV.`;
    }
    case 'REGEN_TICK':
    case 'regen_tick':
      return `${target} se régénère de ${event.value ?? meta.heal ?? 0} PV.`;
    case 'EFFECT_APPLY':
    case 'effect_apply':
      return String(event.message ?? meta.message ?? '');
    case 'APPLY_BUFF':
    case 'BUFF_APPLY':
    case 'buff_apply': {
      const buffType = (meta?.buffType ?? event.buffType) as string | undefined;
      const duration = Number(meta?.remainingActions ?? meta?.duration ?? event.remainingActions ?? 1);
      const value = (meta?.value ?? event.value) as number | undefined;
      const label = formatBuffLabel(buffType);
      if (!label) return '';
      const valueStr = value != null ? ` +${typeof value === 'number' && value <= 1 ? Math.round(value * 100) : value}%` : '';
      const durStr = duration ? ` (${duration} tour${duration !== 1 ? 's' : ''})` : '';
      if (event.sourceId === event.targetId) {
        return `${source} gagne ${label}${valueStr}${durStr}.`;
      }
      return `${source} applique ${label}${valueStr} à ${target}${durStr}.`;
    }
    case 'APPLY_DEBUFF':
    case 'DEBUFF_APPLY':
    case 'debuff_apply': {
      const debuffType = (meta?.debuffType ?? meta?.buffType ?? event.debuffType) as string | undefined;
      const duration = Number(meta?.duration ?? meta?.remainingActions ?? event.remainingActions ?? 1);
      const label = formatDebuffLabel(debuffType);
      const durStr = duration ? ` (${duration} tour${duration !== 1 ? 's' : ''})` : '';
      return `${source} réduit ${label} de ${target}${durStr}.`;
    }
    case 'PASSIVE_TRIGGER':
    case 'passive_trigger':
    case 'passive':
      return '';
    case 'SHIELD':
    case 'SHIELD_GAIN':
    case 'shield': {
      const val = event.value ?? meta.amount ?? meta.value ?? 0;
      return source === target ? `${source} s'applique un bouclier de ${val}.` : `${source} applique un bouclier de ${val} à ${target}.`;
    }
    case 'REMOVE_BUFF':
    case 'STRIP':
    case 'strip': {
      const count = event.value ?? meta.count ?? 1;
      return `${source} retire ${count} buff(s) à ${target}.`;
    }
    case 'REMOVE_DEBUFF':
    case 'CLEANSE':
    case 'cleanse': {
      const count = event.value ?? meta.count ?? 1;
      return `${source} retire ${count} débuff(s) à ${target}.`;
    }
    case 'DEATH':
    case 'ko':
    case 'unit_ko':
      return `${target} est KO.`;
    case 'RESURRECT':
    case 'resurrect':
      return `${target} est ressuscité.`;
    case 'IMMUNE':
    case 'immune':
      return `${target} est immunisé.`;
    case 'STUN_SKIP':
    case 'stun_skip':
      return `${source} passe son tour (Étourdissement).`;
    case 'SHIELD_ABSORB':
    case 'shield_absorb': {
      const val = event.valueAbsorbed ?? event.value ?? meta.valueAbsorbed ?? 0;
      return `${target} absorbe ${val} dégâts avec son bouclier.`;
    }
    default:
      return '';
  }
}

function formatBuffEvent(params: {
  kind: 'buff' | 'debuff';
  sourceName: string;
  targetName: string;
  effectType: string;
  duration?: number;
  value?: number | null;
  isSelf: boolean;
}): string {
  const raw = String(params.effectType ?? '').toUpperCase();
  const label = params.kind === 'debuff' ? formatDebuffLabel(raw || undefined) : (formatBuffLabel(raw || undefined) ?? 'effet');
  const valueStr = params.value != null ? ` +${typeof params.value === 'number' && params.value <= 1 ? Math.round(params.value * 100) : params.value}%` : '';
  const durationStr = params.duration != null && params.duration > 0
    ? ` (${params.duration} tour${params.duration !== 1 ? 's' : ''})`
    : '';
  if (params.kind === 'buff') {
    if (raw === 'SHIELD' && params.value != null && params.value > 0) {
      return params.isSelf
        ? `${params.sourceName} s'applique un bouclier de ${params.value}.`
        : `${params.sourceName} applique un bouclier de ${params.value} à ${params.targetName}.`;
    }
    if (params.isSelf) {
      return `${params.sourceName} gagne ${label}${valueStr}${durationStr}.`;
    }
    return `${params.sourceName} applique ${label}${valueStr} à ${params.targetName}${durationStr}.`;
  }
  if (params.kind === 'debuff') {
    if (params.isSelf) {
      return `${params.sourceName} s'affaiblit : ${label}${durationStr}.`;
    }
    return `${params.sourceName} réduit ${label} de ${params.targetName}${durationStr}.`;
  }
  return '';
}

const BUFF_VALUES_UI: Record<string, number> = {
  ATK_UP: 0.5,
  DEF_UP: 0.5
};

function formatEffectName(type: string | undefined): string {
  if (!type) return 'effet';
  const map: Record<string, string> = {
    ATK_UP: 'ATQ +50%',
    DEF_UP: 'DEF +50%',
    ATK_DOWN: 'ATQ -30%',
    DEF_DOWN: 'DEF -30%',
    SLOW: 'Ralentissement',
    SILENCE: 'Silence',
    PROVOKE: 'Provocation',
    PROVOCATION: 'Provocation',
    ANTI_HEAL: 'Anti-Soin',
    ANTI_SHIELD: 'Anti-Bouclier',
    ATB_DOWN: 'Réduction ATB',
    BLIND: 'Aveuglement',
    ANTI_BUFF: 'Anti-Buff',
    DOT: 'DOT',
    STUN: 'Étourdissement',
    SPD_UP: 'Vitesse',
    SPEED: 'Vitesse',
    CRIT_UP: 'Critique',
    SHIELD: 'Bouclier',
    REGEN: 'Régénération',
    HEAL_OVER_TIME: 'Régénération',
    STAT_STEAL_BUFF: 'Vol de stats',
    STAT_STEAL_DEBUFF: 'Stat volée',
    IMMUNITY: 'Immunité',
    INVINCIBILITY: 'Invulnérable',
    DEFEND: 'Protection'
  };
  if (type === 'APPLY_BUFF' || type === 'APPLY_DEBUFF') return 'effet';
  return map[type] ?? BUFF_LABELS[type] ?? DEBUFF_LABELS[type] ?? 'effet';
}

const SYNERGY_LABELS: Record<string, string> = {
  GUARDIANS: 'Gardiens',
  BERSERKERS: 'Berserkers',
  EXECUTIONERS: 'Bourreaux',
  ARCANISTS: 'Arcanistes',
  DRUIDS: 'Druides',
  TACTICIANS: 'Tacticiens'
};

/** Phrases en français pour chaque type d'effet de synergie (logs courts). */
const SYNERGY_SUBTYPE_PHRASES: Record<string, string> = {
  FRONTLINE_SHIELD: 'Bouclier au front',
  POST_SKILL_SHIELD: 'Bouclier après compétence',
  SELF_REGEN: 'Régénération',
  PERIODIC_CLEANSE: 'Débuffs retirés',
  START_ATB_BOOST: 'Bonus ATB au démarrage',
  FIRST_ACTOR_BOOST_SLOWEST: 'Bonus ATB au plus lent',
  FIRST_KILL_ATB_BOOST: 'Bonus ATB après premier kill',
  KILL_ATB_BOOST: 'Bonus ATB après kill',
  LIFESTEAL: 'Vol de vie'
};

function formatSynergyTriggerLog(
  trait: string,
  subType: string,
  value: number | undefined,
  sourceName: string
): string {
  const traitLabel = SYNERGY_LABELS[trait] ?? trait;
  const phrase = SYNERGY_SUBTYPE_PHRASES[subType] ?? subType;
  const valuePart = value != null && !Number.isNaN(value) ? ` (+${value})` : '';
  return `${sourceName} (${traitLabel}) : ${phrase}${valuePart}.`;
}

function formatEvent(event: NormalizedBattleEvent | BattleLogEvent): string {
  const t = Number(event.turn) ?? 0;
  const type = safeStr(event.type ?? event.actionType ?? 'UNKNOWN');
  const source = safeStr(event.sourceName ?? event.actorName ?? event.sourceId ?? event.actorId ?? '?');
  const target = safeStr(event.targetName ?? event.targetId ?? '?');
  const meta = (event.meta ?? (event as BattleLogEvent).extra ?? {}) as Record<string, unknown>;
  const skillName = (meta.skillName ?? (event as BattleLogEvent).extra?.skillName) as string | undefined;
  const debuffType = (meta.debuffType ?? (event as BattleLogEvent).extra?.debuffType) as string | undefined;
  const duration = (meta.duration ?? (event as BattleLogEvent).extra?.duration) as number | undefined;
  const statLabel = debuffType ? ((DEBUFF_LABELS[debuffType] ?? debuffType) || 'debuff') : 'debuff';

  switch (type) {
    case 'TURN_START':
    case 'turn_start':
      return `——— Tour ${t} ———`;
    case 'BATTLE_END':
    case 'battle_end':
      return `——— Fin du combat ———`;
    case 'BASIC_ATTACK':
    case 'basic_attack': {
      const blocked = event.isBlocked ?? false;
      if (blocked) return `Tour ${t} — ${source} attaque ${target} mais rate.`;
      const crit = (meta.isCrit ?? event.isCrit) ? ' (CRITIQUE !)' : '';
      const val = event.value != null ? ` et inflige ${event.value} dégâts.` : '.';
      return `Tour ${t} — ${source} attaque ${target}${crit}${val}`;
    }
    case 'SKILL_CAST':
    case 'skill_damage':
    case 'skill': {
      const displaySkill = (skillName && String(skillName).toUpperCase() !== 'GENERIC') ? skillName : null;
      if (displaySkill) {
        const targetPart = (target && target !== '?') ? ` sur ${target}` : '';
        return `Tour ${t} — ${source} lance ${displaySkill}${targetPart}.`;
      }
      const damageByTarget = (meta as Record<string, unknown>)?.skillDamageByTarget as Array<{ targetName: string; value: number }> | undefined;
      if (damageByTarget?.length) {
        const phrase =
          damageByTarget.length === 1
            ? `${damageByTarget[0].value} dégâts à ${damageByTarget[0].targetName}`
            : `${damageByTarget[0].value} dégâts à ${damageByTarget[0].targetName}` +
              (damageByTarget.length > 2 ? ', ' + damageByTarget.slice(1, -1).map((d) => `${d.value} à ${d.targetName}`).join(', ') : '') +
              (damageByTarget.length > 1 ? ` et ${damageByTarget[damageByTarget.length - 1].value} à ${damageByTarget[damageByTarget.length - 1].targetName}` : '');
        return `Tour ${t} — ${source} utilise une attaque spéciale qui inflige ${phrase}.`;
      }
      const damageVal = event.value ?? (meta as Record<string, unknown>)?.skillTotalDamage;
      if (damageVal != null && Number(damageVal) > 0) {
        return `Tour ${t} — ${source} utilise une attaque spéciale qui inflige ${damageVal} dégâts à une ou plusieurs unités.`;
      }
      return `Tour ${t} — ${source} utilise une attaque spéciale.`;
    }
    case 'DAMAGE': {
      const crit = (meta.isCrit ?? event.isCrit) ? ' (CRITIQUE !)' : '';
      return `Tour ${t} — ${source} inflige ${event.value ?? 0} dégâts à ${target}${crit}.`;
    }
    case 'HEAL':
    case 'heal':
      if (meta.regen === true) return `Tour ${t} — ${target} se régénère de ${event.value ?? 0} PV.`;
      return `Tour ${t} — ${source} soigne ${target} pour ${event.value ?? 0} PV.`;
    case 'REGEN_TICK':
    case 'regen_tick':
      return `Tour ${t} — ${target} se régénère de ${meta.heal ?? event.value ?? 0} PV.`;
    case 'SHIELD':
    case 'shield':
      if (source === target) return `Tour ${t} — ${source} se protège avec un bouclier de ${event.value ?? 0} PV.`;
      return `Tour ${t} — ${source} accorde un bouclier de ${event.value ?? 0} PV à ${target}.`;
    case 'BUFF_APPLY':
    case 'buff': {
      const buffType = (meta.buffType ?? (event as BattleLogEvent).extra?.buffType) as string | undefined;
      const buffDuration = (meta.duration ?? (event as BattleLogEvent).extra?.duration) as number | undefined;
      const percent = (meta.percent ?? (buffType ? BUFF_VALUES_UI[buffType] : undefined)) as number | undefined;
      const buffLabel = buffType ? (BUFF_LABELS[buffType] ?? buffType) : null;
      const valuePart = event.value != null ? ` (+${event.value})` : '';
      const percentPart = percent != null ? ` +${Math.round(percent * 100)}%` : '';
      const durationPart = (buffDuration ?? 0) > 0 ? ` (${buffDuration} tour${(buffDuration ?? 0) > 1 ? 's' : ''})` : '';
      const which = buffLabel ? ` ${buffLabel}${percentPart}` : '';
      return `Tour ${t} — ${target} gagne un buff${which}${valuePart}${durationPart}.`;
    }
    case 'DEBUFF_APPLY':
    case 'debuff':
      const dur = (duration ?? 0) > 0 ? ` (${duration} tour${(duration ?? 0) > 1 ? 's' : ''})` : '';
      return `Tour ${t} — ${source} applique ${statLabel} à ${target}${dur}.`;
    case 'DEBUFF_RESIST':
      return `Tour ${t} — ${source} tente d'appliquer ${statLabel} à ${target} (résisté).`;
    case 'STRIP':
      return `Tour ${t} — ${source} retire ${event.value ?? 0} buff(s) à ${target}.`;
    case 'CLEANSE':
      return `Tour ${t} — ${source} retire ${event.value ?? 0} débuff(s) à ${target}.`;
    case 'REDUCE_ATB':
    case 'reduce_atb': {
      const pct = event.value != null ? Math.round(Number(event.value) * 100) : 0;
      return `Tour ${t} — ${source} réduit la jauge d'action de ${target} de ${pct}%.`;
    }
    case 'ATB_UP':
    case 'atb_up':
      const atbVal = event.value != null ? (Number(event.value) <= 1 ? Math.round(Number(event.value) * 100) + '%' : event.value + '%') : '';
      return `Tour ${t} — ${target} gagne ${atbVal} ATB.`;
    case 'DEATH':
    case 'death':
      return `Tour ${t} — ${target} est vaincu(e).`;
    case 'RESURRECT':
      const pctRes = (meta.percent ?? 0.3) as number;
      return `Tour ${t} — ${source} ressuscite ${target} avec ${Math.round(pctRes * 100)}% PV${event.value != null ? ` (${event.value} PV)` : ''}.`;
    case 'COUNTER_ATTACK':
      return `Tour ${t} — ${source} contre-attaque ${target}.`;
    case 'DEFEND_REDIRECT':
      const protector = (meta.protectorName ?? source) as string;
      return `Tour ${t} — ${protector} intercepte l'attaque destinée à ${target}.`;
    case 'PASSIVE_TRIGGER':
      const passiveType = (meta.passiveType ?? 'Passif') as string;
      const passiveLabel = passiveType === 'SELF_RESURRECT' ? 'Auto-Résurrection' : passiveType === 'ON_ATTACK' ? 'Coup supplémentaire' : passiveType;
      return `Tour ${t} — Le passif ${passiveLabel} s'active.`;
    case 'SYNERGY_TRIGGER':
      const syn = (meta.synergyType ?? 'Synergie') as string;
      const sub = (meta.subType ?? '') as string;
      const synLabel = SYNERGY_LABELS[syn] ?? syn;
      if (sub === 'LIFESTEAL') return `Tour ${t} — ${source} absorbe ${event.value ?? 0} PV (${synLabel}).`;
      if (sub === 'FRONTLINE_SHIELD') return `Tour ${t} — Synergie ${synLabel} : Bouclier appliqué à ${target}.`;
      if (sub === 'POST_SKILL_SHIELD') return `Tour ${t} — Synergie ${synLabel} : Bouclier après compétence.`;
      if (sub === 'SELF_REGEN') return `Tour ${t} — Synergie ${synLabel} : Régénération (${event.value ?? 0} PV).`;
      if (sub === 'PERIODIC_CLEANSE') return `Tour ${t} — Synergie ${synLabel} : Débuffs retirés à ${target}.`;
      if (sub === 'START_ATB_BOOST') return `Tour ${t} — Synergie ${synLabel} : Bonus ATB au démarrage.`;
      if (sub === 'FIRST_ACTOR_BOOST_SLOWEST') return `Tour ${t} — Synergie ${synLabel} : Bonus ATB au plus lent.`;
      if (sub === 'FIRST_KILL_ATB_BOOST') return `Tour ${t} — Synergie ${synLabel} : Bonus ATB après premier kill.`;
      if (sub === 'KILL_ATB_BOOST') return `Tour ${t} — Synergie ${synLabel} : Bonus ATB après kill (+40).`;
      return `Tour ${t} — Synergie ${synLabel} : ${sub || 'effet'}.`;
    case 'BOSS_TRIGGER':
      const subType = (meta.subType ?? '') as string;
      if (subType === 'phase2') return `Tour ${t} — Le Boss entre en Phase 2.`;
      if (subType === 'shieldEveryNActions') return `Tour ${t} — Le Boss gagne un bouclier (${event.value ?? 0} PV).`;
      if (subType === 'silenceEveryNActions') return `Tour ${t} — Le Boss impose Silence (${event.value ?? 0} tours).`;
      return `Tour ${t} — Boss : ${subType || 'trigger'}.`;
    case 'STUN_SKIP':
    case 'stun_skip':
      return `Tour ${t} — ${source} passe son tour (Étourdissement).`;
    case 'EFFECT_APPLY':
    case 'effect_apply':
      return `Tour ${t} — ${String(meta.message ?? (event as Record<string, unknown>).message ?? `${source} applique un effet à ${target}.`)}`;
    case 'UNKNOWN':
    default:
      return formatEventNarrative(event as Record<string, unknown>) || `Tour ${t} — ${source} agit sur ${target}.`;
  }
}

async function closeAndNotify(andFindOpponent = false) {
  if (loading.value) return;
  if (activePendingBattle.value?.id && !hasFinalized.value) {
    // Si le combat n'est pas terminé, le joueur perd automatiquement.
    const winner = battleResult.value?.result ?? 'loss';
    const battleId = activePendingBattle.value.id;
    const battleType = activePendingBattle.value.battleType;
    const teamSlots = getTeamSlotsForStats();
    const combatStats = teamSlots.length && battleResult.value?.battleLog
      ? computeCombatStatsFromLog(battleResult.value.battleLog, teamSlots)
      : {};
    loading.value = true;
    try {
      const { data } = await api.post('/battle/finalize', { id: battleId, winner, combatStats });
      if (data?.wallet) {
        window.dispatchEvent(new CustomEvent('wallet-updated', { detail: data.wallet }));
      }
      if (battleType === 'campaign' && data?.progressUpdated && !progressionAlreadySent.value) {
        progressionAlreadySent.value = true;
        emit('campaign-updated');
      }
      battleFinalizeResult.value = (data ?? {}) as Record<string, unknown>;
      hasFinalized.value = true;
      emit('battle-finalized', data);
    } catch (e: any) {
      // On logge l'erreur mais on ferme quand même la modale pour ne pas bloquer le joueur.
      // Le combat est considéré comme terminé côté client.
      const status = (e as any)?.response?.status;
      const msg = (e as any)?.response?.data?.message || (e as any)?.response?.data?.error || null;
      if (status !== 404) {
        // 404 = battle déjà supprimée, pas d'erreur à afficher
        battleError.value = msg ?? 'Impossible de finaliser le combat.';
      }
    }
  }
  stopReplayTimer();
  replayFrames.value = [];
  activePendingBattle.value = null;
  loading.value = false;
  emit('close', { findOpponent: !!andFindOpponent });
}

function handlePvpFindOpponent() {
  closeAndNotify(true);
}

function handleOverlayClose() {
  closeAndNotify();
}

/**
 * Lors d'un rechargement ou fermeture de page en cours de combat,
 * envoie une requête "keepalive" pour enregistrer la défaite.
 */
function handleBeforeUnload() {
  const id = activePendingBattle.value?.id;
  if (!id || battleResult.value?.result != null) return;
  const token = getToken();
  fetch('/api/battle/finalize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ id, winner: 'loss' }),
    keepalive: true
  });
}
</script>

<style scoped>
.battle-overlay.modal-backdrop.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.battle-modal {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  min-height: 0;
}

.battle-modal.battle-modal--combat {
  width: 95%;
  max-width: 1500px;
  height: 92vh;
  max-height: 92vh;
  padding: 0;
  align-items: stretch;
  display: flex;
  flex-direction: column;
}

.battle-modal.battle-modal--combat .modal-card {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  background: linear-gradient(180deg, #0b1c2c, #091423);
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  /* Masquer toute barre de défilement pendant les animations combat */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.battle-modal.battle-modal--combat .modal-card::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.modal-header.modal-header--combat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 8px;
}
.modal-header--combat .header-left {
  display: flex;
  align-items: center;
  gap: 25px;
  min-width: 0;
}
.modal-header--combat .stage-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #e2e8f0;
  flex-shrink: 0;
}
.modal-header--combat .header-right {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  flex-wrap: nowrap;
}
.campaign-quick-btn {
  font-size: 12px;
  padding: 4px 10px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
}
.campaign-quick-btn:hover {
  border-color: rgba(0, 255, 200, 0.5);
  background: rgba(0, 255, 200, 0.12);
  color: #00ffc8;
}
.campaign-btn-next {
  border-color: rgba(34, 197, 94, 0.4);
}
.campaign-btn-next:hover {
  border-color: rgba(34, 197, 94, 0.7);
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}
.campaign-quick-btn {
  font-size: 12px;
  padding: 4px 10px;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 6px;
  color: #e2e8f0;
  cursor: pointer;
}
.campaign-quick-btn:hover {
  background: rgba(30, 41, 59, 0.9);
  border-color: rgba(0, 255, 200, 0.4);
}
.campaign-btn-next {
  color: #22c55e;
}
.campaign-btn-next:hover {
  background: rgba(34, 197, 94, 0.15);
}
.campaign-btn-replay:hover {
  background: rgba(59, 130, 246, 0.15);
}
.modal-header--combat .round-counter {
  font-size: 12px;
  color: #94a3b8;
  padding: 4px 8px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.2);
}
.modal-header--combat .round-counter[title]:hover {
  color: #cbd5e1;
}
.round-counter {
  font-size: 12px;
  color: #94a3b8;
  padding: 4px 8px;
  background: rgba(15, 23, 42, 0.7);
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  font-variant-numeric: tabular-nums;
}
.btn-text-mobile {
  display: none;
}
.btn-text-desktop {
  display: inline;
}
.modal-header--combat .close-btn {
  background: transparent;
  border: 1px solid #444;
  border-radius: 6px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  color: #e2e8f0;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-header--combat .close-btn:hover {
  border-color: #666;
  background: rgba(255,255,255,0.05);
}
.modal-header--combat .close-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  border-color: #334155;
  background: rgba(15, 23, 42, 0.4);
}
.modal-header--combat .legend-btn {
  font-size: 12px;
  padding: 4px 10px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
}
.modal-header--combat .legend-btn:hover {
  border-color: rgba(0, 255, 200, 0.4);
  color: #a5f3fc;
}
.modal-header--combat .abandon-btn {
  font-size: 12px;
  padding: 4px 10px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: #fda4af;
  border-radius: 6px;
  cursor: pointer;
}
.modal-header--combat .abandon-btn:hover {
  border-color: rgba(248, 113, 113, 0.6);
  color: #fecdd3;
  background: rgba(248, 113, 113, 0.1);
}
.modal-header--combat .logs-toggle-btn {
  font-size: 12px;
  padding: 4px 10px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
}
.modal-header--combat .logs-toggle-btn:hover {
  border-color: rgba(0, 255, 200, 0.4);
  color: #a5f3fc;
}
.modal-header--combat .logs-toggle-btn.active {
  background: rgba(0, 255, 200, 0.15);
  color: #a5f3fc;
  border-color: rgba(0, 255, 200, 0.5);
}

/* Libellés desktop par défaut, mobile masqué */
.modal-header--combat .btn-text-mobile {
  display: none;
}
.modal-header--combat .btn-text-desktop {
  display: inline;
}
.auto-mode-btn {
  font-size: 12px;
  padding: 4px 10px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
}
.auto-mode-btn:hover {
  border-color: rgba(0, 255, 200, 0.4);
  color: #a5f3fc;
}
.auto-mode-btn.active {
  background: rgba(0, 255, 200, 0.2);
  color: #a5f3fc;
  border-color: rgba(0, 255, 200, 0.5);
}
.modal-header--combat .btn-text-mobile {
  display: none;
}
.modal-header--combat .btn-text-desktop {
  display: inline;
}
.manual-decision-hint--auto {
  background: rgba(0, 255, 200, 0.08);
  border-color: rgba(0, 255, 200, 0.35);
  color: #a5f3fc;
}
.replay-controls--inline {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.replay-controls--inline .replay-controls-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.replay-controls--inline .replay-timeline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.replay-controls--inline .replay-slider {
  width: 120px;
  min-width: 0;
}
.stage-result {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 6px 14px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 10px;
  flex-shrink: 0;
}
.stage-result-loading {
  font-weight: 500;
  font-size: 0.88rem;
  opacity: 0.9;
}
.stage-result.victory {
  background: #1c6e45;
  color: #a8ffcf;
}
.stage-result.defeat {
  background: #6e1c1c;
  color: #ffb3b3;
}
.stage-result.draw {
  background: #4a5568;
  color: #e2e8f0;
}
.stage-result-rewards {
  margin-top: 6px;
  font-size: 0.88rem;
  font-weight: 500;
  opacity: 0.95;
}
.stage-result-reward-line {
  line-height: 1.4;
}
.stage-result-reward-line + .stage-result-reward-line {
  margin-top: 2px;
}

.battle-lock-message {
  margin-bottom: 10px;
  font-size: 0.88rem;
  color: #fcd34d;
}

.battle-topbar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.battle-topbar-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #e2e8f0;
}

.battle-close {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  transition: 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  line-height: 1;
}

.battle-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

.battle-result {
  padding: 8px 14px;
  margin: 8px 16px;
  border-radius: 10px;
  font-size: 0.9rem;
  background: linear-gradient(90deg, #113d2c, #0e2a1f);
  border: 1px solid rgba(0, 255, 150, 0.2);
  display: inline-flex;
  gap: 12px;
  align-items: center;
  width: auto;
  max-width: fit-content;
  flex-shrink: 0;
}

.battle-rewards {
  opacity: 0.8;
  font-size: 0.85rem;
}

.battle-result-defeat {
  background: linear-gradient(90deg, #3d1c1c, #2a0e0e);
  border-color: rgba(255, 100, 100, 0.2);
}

.modal-card.stage-modal {
  background: linear-gradient(145deg, #0f1f3a, #0a1629);
  border: 1px solid rgba(0, 255, 200, 0.2);
  box-shadow:
    0 0 30px rgba(0, 255, 200, 0.15),
    0 0 80px rgba(0, 0, 0, 0.8);
  border-radius: 18px;
  backdrop-filter: blur(10px);
  animation: modalEnter 0.25s ease;
  padding: 1.5rem;
  max-width: 420px;
  width: 90%;
}

@keyframes modalEnter {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.battle-modal-content {
  width: 100%;
  max-width: 1400px;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;
}

.modal-card.stage-modal.modal-card--combat {
  max-width: none;
  width: 100%;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;
}

@media (max-height: 800px) {
  .battle-modal.battle-modal--combat {
    height: 92vh;
    max-height: 92vh;
  }
  .modal-card.stage-modal.modal-card--combat {
    max-height: 95vh;
  }
}

@media (max-width: 768px) {
  .battle-overlay.modal-backdrop.modal-overlay {
    padding: 0.5rem;
  }

  .battle-modal {
    padding: 12px;
  }

  .modal-card.stage-modal {
    padding: 1rem;
    max-width: 100%;
  }

  /* Header combat : titre masqué, boutons sur une ligne, plus compacts */
  .modal-header--combat .header-left {
    display: none;
  }
  .modal-header--combat .header-right {
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    width: 100%;
  }
  .modal-header--combat .close-btn,
  .modal-header--combat .legend-btn,
  .modal-header--combat .logs-toggle-btn,
  .modal-header--combat .auto-mode-btn,
  .modal-header--combat .abandon-btn {
    min-height: 28px;
    min-width: 28px;
    padding: 4px 6px;
    font-size: 10px;
  }
  .modal-header--combat .close-btn {
    width: 28px;
    height: 28px;
    font-size: 0.85rem;
  }

  .manual-action-btn,
  .manual-target-btn,
  .manual-confirm-btn {
    min-height: 44px;
    padding: 12px 16px;
    font-size: 14px;
  }

  .manual-decision-panel {
    margin: 8px 10px;
    padding: 12px;
  }

  .btn-fight {
    min-height: 48px;
    padding: 14px 20px;
    font-size: 1rem;
  }

  .preset-option {
    padding: 12px 16px;
    min-height: 44px;
  }
}

.battle-header {
  flex-shrink: 0;
}

.stage-modal-header {
  position: relative;
  box-shadow: 0 0 20px rgba(0, 255, 200, 0.12);
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
}

.battle-controls {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.battle-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.stage-title-icon {
  font-size: 1.4rem;
  margin-right: 0.5rem;
  line-height: 1;
}

.stage-modal-title {
  margin: 0;
  font-size: 1.45rem;
  flex: 1;
  text-shadow: 0 0 20px rgba(0, 255, 200, 0.35);
  color: #e2e8f0;
}

.header-line {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0, 255, 200, 0.6), transparent);
  animation: headerLineShift 2s ease-in-out infinite;
}

@keyframes headerLineShift {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

.combat-wrapper {
  position: relative;
  width: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.replay-controls {
  margin-bottom: 10px;
  padding: 8px 12px;
  background: rgba(15, 23, 42, 0.85);
  border-radius: 10px;
  border: 1px solid rgba(100, 180, 255, 0.25);
}
.replay-controls-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.replay-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(30, 41, 59, 0.9);
  color: #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.replay-btn:hover:not(:disabled) {
  background: rgba(51, 65, 85, 0.95);
  border-color: rgba(0, 255, 200, 0.4);
}
.replay-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.replay-btn-play {
  width: 44px;
  font-size: 18px;
}
.replay-speed {
  margin-left: 12px;
  display: flex;
  gap: 4px;
}
.combat-mode-switch {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}
.combat-mode-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(30, 41, 59, 0.9);
  color: #94a3b8;
  border-radius: 6px;
  cursor: pointer;
}
.combat-mode-btn.active {
  background: rgba(0, 255, 200, 0.2);
  color: #a5f3fc;
  border-color: rgba(0, 255, 200, 0.5);
}
.manual-decision-panel {
  margin: 8px 14px 10px;
  padding: 10px;
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 10px;
  background: rgba(2, 6, 23, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition: opacity 0.2s ease, filter 0.2s ease;
}
.manual-decision-panel.is-waiting {
  opacity: 0.45;
  filter: grayscale(0.5);
  pointer-events: none;
}
.manual-decision-title {
  font-size: 13px;
  color: #dbeafe;
  min-width: 220px;
}
.manual-decision-actions,
.manual-decision-targets {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}
.manual-action-btn,
.manual-target-btn,
.manual-confirm-btn {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.85);
  color: #e2e8f0;
  cursor: pointer;
  font-size: 12px;
}
.manual-action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  filter: grayscale(0.45);
}
.manual-skill-wrap {
  position: relative;
  display: inline-flex;
}
.manual-skill-tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  width: 260px;
  max-width: min(72vw, 320px);
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(59, 130, 246, 0.45);
  background: rgba(2, 6, 23, 0.96);
  color: #dbeafe;
  font-size: 12px;
  line-height: 1.35;
  white-space: pre-line;
  z-index: 40;
  box-shadow: 0 8px 22px rgba(2, 6, 23, 0.6);
  pointer-events: none;
}

@media (max-width: 768px) {
  .manual-skill-tooltip {
    max-width: calc(100vw - 24px);
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    top: auto;
    bottom: calc(100% + 8px);
  }
}
.manual-action-btn.active,
.manual-target-btn.active {
  border-color: rgba(0, 255, 200, 0.65);
  box-shadow: 0 0 0 1px rgba(0, 255, 200, 0.25) inset;
}
.manual-confirm-btn {
  background: linear-gradient(180deg, #0f766e, #115e59);
  border-color: rgba(45, 212, 191, 0.7);
}
.manual-target-label {
  color: #93c5fd;
  font-size: 12px;
}
.manual-target-expected {
  color: #fbbf24;
  font-size: 12px;
}
.manual-decision-error {
  color: #fca5a5;
  font-size: 12px;
}
.manual-decision-hint {
  margin: 8px 14px 10px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px dashed rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.55);
  color: #cbd5e1;
  font-size: 12px;
}
.manual-decision-hint--auto {
  background: rgba(0, 255, 200, 0.12);
  border-color: rgba(0, 255, 200, 0.35);
  color: #a5f3fc;
}
.auto-mode-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(30, 41, 59, 0.9);
  color: #94a3b8;
  border-radius: 6px;
  cursor: pointer;
  margin-right: 6px;
}
.auto-mode-btn:hover {
  border-color: rgba(0, 255, 200, 0.4);
  color: #a5f3fc;
}
.auto-mode-btn.active {
  background: rgba(0, 255, 200, 0.2);
  color: #a5f3fc;
  border-color: rgba(0, 255, 200, 0.5);
}
.replay-speed-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(30, 41, 59, 0.9);
  color: #94a3b8;
  border-radius: 6px;
  cursor: pointer;
}
.replay-speed-btn.active {
  background: rgba(0, 255, 200, 0.2);
  color: #a5f3fc;
  border-color: rgba(0, 255, 200, 0.5);
}
.auto-mode-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(30, 41, 59, 0.9);
  color: #94a3b8;
  border-radius: 6px;
  cursor: pointer;
  margin-right: 8px;
}
.auto-mode-btn:hover {
  border-color: rgba(255, 200, 0, 0.5);
  color: #fde047;
}
.auto-mode-btn.active {
  background: rgba(255, 200, 0, 0.15);
  color: #fde047;
  border-color: rgba(255, 200, 0, 0.5);
}
.manual-decision-hint--auto {
  border-color: rgba(255, 200, 0, 0.4);
  background: rgba(255, 200, 0, 0.08);
  color: #fde047;
}
.replay-timeline {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.replay-slider {
  flex: 1;
  min-width: 0;
  height: 8px;
  accent-color: rgba(0, 255, 200, 0.7);
}
.replay-timeline-label {
  font-size: 12px;
  color: #94a3b8;
  min-width: 60px;
}
.replay-unavailable {
  padding: 8px 12px;
  color: #94a3b8;
  font-size: 13px;
  margin-bottom: 8px;
}
.unit-active {
  box-shadow: 0 0 16px rgba(0, 255, 200, 0.5), 0 0 24px rgba(0, 255, 200, 0.25);
  outline: 2px solid rgba(0, 255, 200, 0.6);
  outline-offset: 2px;
}
.log-entry-current {
  font-weight: 600;
}

.btn-legend {
  margin-left: auto;
  z-index: 10;
  padding: 6px 12px;
  font-size: 12px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
}

.btn-legend:hover {
  border-color: rgba(0, 255, 200, 0.4);
  color: #a5f3fc;
}

.unit-tooltip {
  position: fixed;
  bottom: 40px;
  right: 40px;
  width: 280px;

  background: linear-gradient(180deg, #0b1a2a, #091523);
  border-radius: 12px;
  padding: 14px;

  box-shadow: 0 0 25px rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(100, 180, 255, 0.3);

  z-index: 3000;
}

.unit-tooltip .tooltip-unit-image {
  width: 100%;
  aspect-ratio: 1;
  max-height: 140px;
  border-radius: 8px;
  margin-bottom: 10px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  background-color: rgba(0, 0, 0, 0.25);
}

.unit-tooltip .tooltip-title {
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 8px;
  /* couleur gérée par hoveredUnitRarityStyle (rareté) */
}

.unit-tooltip .tooltip-meta {
  font-size: 12px;
  opacity: 0.85;
  margin-bottom: 6px;
}

.unit-tooltip .tooltip-stats {
  font-size: 13px;
  margin-bottom: 8px;
}

.unit-tooltip .tooltip-stats > div {
  margin-bottom: 2px;
}

.unit-tooltip .tooltip-traits {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 6px;
}

.unit-tooltip .tooltip-skill {
  font-size: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 6px;
  white-space: pre-line;
}

.unit-tooltip .tooltip-spec {
  font-size: 11px;
  color: #a5b4fc;
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px solid rgba(165, 180, 252, 0.2);
}

.legend-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.legend-panel {
  position: relative;
  width: 320px;
  height: 100%;
  overflow-y: auto;
  background: #0f1a2b;
  box-shadow: -10px 0 40px rgba(0, 0, 0, 0.6);
  padding: 14px;
  padding-top: 44px;
  font-size: 13px;
  color: #e5e7eb;
  border-left: 1px solid rgba(100, 180, 255, 0.2);
}

.legend-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #e5e7eb;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.legend-close:hover {
  background: rgba(255, 255, 255, 0.15);
}

.legend-panel::-webkit-scrollbar {
  width: 6px;
}

.legend-panel::-webkit-scrollbar-thumb {
  background: #3aa3ff;
  border-radius: 4px;
}

.legend-panel-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #e5e7eb;
}

.legend-intro {
  margin: 0 0 14px 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.4;
}

.legend-section {
  margin-bottom: 12px;
}

.legend-section:last-child {
  margin-bottom: 0;
}

.legend-section-label {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 6px;
}

.combat-layout {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow: hidden;
  gap: 0;
  align-items: stretch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.combat-layout::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* Colonnes de logs toujours présentes dans le flux flex : repliées sans changer la hauteur totale de la modale */
.battle-logs.battle-logs--collapsed {
  flex: 0 0 0 !important;
  width: 0 !important;
  min-width: 0 !important;
  max-width: 0 !important;
  max-height: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  opacity: 0;
  overflow: hidden !important;
  pointer-events: none;
}

.battle-logs {
  width: 280px;
  min-width: 280px;
  flex: 1 1 280px;
  max-width: 380px;
  overflow-y: auto;
  height: 100%;
}

.battle-logs-left,
.battle-logs-right {
  width: 280px;
  min-width: 280px;
  flex: 1 1 280px;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* Mobile: terrain en priorité, logs compacts en dessous */
@media (max-width: 768px) {
  .combat-layout {
    flex-direction: column;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .combat-layout::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  .battle-arena {
    order: -1;
    flex: 1 1 auto;
    min-height: min(65vh, 380px);
    padding: 12px 8px;
  }

  .combat-visual {
    width: 100%;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .battlefield-wrapper {
    margin-top: 4px;
    flex: 1;
    min-width: 0;
    max-width: 100%;
    display: flex;
    justify-content: center;
  }

  .battlefield {
    padding: 8px;
    margin: 0.25rem 0;
    max-width: 100%;
  }

  .battle-logs,
  .battle-logs-left,
  .battle-logs-right {
    width: 100%;
    min-width: 0;
    flex: 0 0 auto;
    max-height: 110px;
  }

  .log-column {
    padding: 8px;
    font-size: 11px;
  }
}

.battle-logs-left .log-container,
.battle-logs-right .log-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 6px;
  min-height: 0;
}

.log-container::-webkit-scrollbar {
  width: 6px;
}

.log-container::-webkit-scrollbar-thumb {
  background: rgba(0, 255, 200, 0.4);
  border-radius: 6px;
}

.log-column {
  padding: 12px;
  font-size: 13px;
  background: #0b1220;
}

.log-column.team-a {
  border-right: 1px solid #1f2937;
}

.log-column.team-b {
  border-left: 1px solid #1f2937;
}

.log-entry {
  margin-bottom: 4px;
}

.battle-arena {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: clip;
  min-width: 0;
  padding: 0;
  position: relative;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.battle-arena::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.preset-unfit-msg {
  margin-top: 12px;
  margin-bottom: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(120, 53, 15, 0.35);
  border: 1px solid rgba(251, 191, 36, 0.5);
  color: #fde68a;
  font-size: 13px;
  line-height: 1.45;
}

.battle-error {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(127, 29, 29, 0.28);
  border: 1px solid rgba(248, 113, 113, 0.45);
  color: #fecaca;
  font-size: 14px;
}

.combat-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  position: relative;
  overflow: clip;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.combat-visual::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.legend-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.legend-icon {
  margin-right: 8px;
  font-size: 16px;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.2rem;
  flex: 1;
}

.badge.boss {
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  font-size: 0.8rem;
  font-weight: 600;
}

.btn-close {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
  padding: 0.25rem;
}

.rewards-preview {
  margin-bottom: 1rem;
}

.hard-modifier-preview {
  margin-bottom: 1rem;
  padding: 0.8rem 1rem;
  border-radius: 0.9rem;
  background: rgba(15, 23, 42, 0.82);
  border: 1px solid rgba(248, 113, 113, 0.28);
  color: #f8fafc;
  font-size: 0.92rem;
  line-height: 1.4;
}

.hard-modifier-preview strong {
  color: #fecaca;
}

.rewards-preview h3,
.result-box h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.rewards-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.5rem 0 0 0;
}

.reward-badge {
  background: rgba(0, 255, 200, 0.1);
  border: 1px solid rgba(0, 255, 200, 0.3);
  padding: 6px 12px;
  border-radius: 12px;
  box-shadow: 0 0 8px rgba(0, 255, 200, 0.2);
  font-size: 0.9rem;
  color: #e2e8f0;
}

.rewards-line {
  margin: 0.25rem 0;
  font-size: 0.9rem;
  color: #cbd5e1;
}

.xp-note {
  margin: 0.5rem 0 0 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

.no-team {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(251, 191, 36, 0.1);
  border-radius: 0.5rem;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.no-team a {
  color: #38bdf8;
}

.preset-select {
  margin-bottom: 1rem;
}

.preset-select-label {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #94a3b8;
}

.preset-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preset-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.95rem;
  color: #e5e7eb;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 10px;
  transition: all 0.2s ease;
}

.preset-option:hover {
  border-color: rgba(0, 255, 200, 0.3);
}

.preset-option.active {
  border: 1px solid #2bff9e;
  box-shadow: 0 0 15px rgba(43, 255, 158, 0.4);
}

.preset-option input {
  cursor: pointer;
}

.actions {
  margin-top: 1rem;
}

.btn-fight {
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(to right, #22c55e, #16a34a);
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.button-combat {
  border-radius: 14px;
  background: linear-gradient(90deg, #00ff9e, #00c8ff);
  font-weight: 600;
  letter-spacing: 1px;
  box-shadow: 0 0 20px rgba(0, 255, 200, 0.5);
  transition: all 0.2s ease;
}

.button-combat:hover:not(:disabled) {
  box-shadow: 0 0 35px rgba(0, 255, 200, 0.8);
  transform: translateY(-2px);
}

.btn-fight:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-box {
  flex-shrink: 0;
  padding: 1rem;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
}

.result-box.victory {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.5);
}

.result-box.defeat {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.5);
}

.rewards-granted p {
  margin: 0.25rem 0;
}

.btn-toggle-log {
  width: 100%;
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(30, 41, 59, 0.8);
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-toggle-log:hover {
  background: rgba(51, 65, 85, 0.9);
  color: #e5e7eb;
}

.battle-log {
  margin-top: 0.5rem;
  margin-bottom: 1rem;
  max-height: 400px;
  overflow-y: auto;
  background: #111;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.battle-log-version {
  font-size: 11px;
  color: #64748b;
  margin: 0 0 6px 0;
}

.log-entry {
  margin-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 4px;
  color: #cbd5e1;
  line-height: 1.4;
}

.log-entry:last-child {
  margin-bottom: 0;
  border-bottom: none;
  padding-bottom: 0;
}

/* Terrain de combat 2D — overflow clip pour empêcher toute scrollbar dans l'encart central */
.battlefield-wrapper {
  width: 100%;
  margin-top: 15px;
  overflow: clip;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.battlefield-wrapper::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.battlefield-wrapper-inner {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.battlefield {
  width: 100%;
  max-width: 100%;
  flex: 1;
  min-height: 0;
  background: linear-gradient(to bottom, #0f172a, #111827);
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding: 20px;
  position: relative;
  border-radius: 8px;
  margin: 0.75rem 0;
  border: 1px solid rgba(148, 163, 184, 0.2);
  overflow: clip;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.battlefield::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.battlefield .row {
  display: flex;
  justify-content: center;
  gap: 40px;
  min-height: 100px;
}

.battlefield .divider {
  height: 2px;
  background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent);
  margin: 10px 0;
  flex-shrink: 0;
}

.battlefield .unit {
  position: relative;
  text-align: center;
  transition: transform 0.25s ease-out, opacity 0.3s ease;
}

.battlefield .row.teamA .unit {
  padding-bottom: 28px;
}

.battlefield .unit.unit-ko,
.battlefield .unit.dead {
  filter: grayscale(1);
  pointer-events: none;
}

.battlefield .unit.dead {
  opacity: 0.3;
  transition: opacity 0.4s ease;
}

.battlefield .unit-name {
  color: white;
  font-size: 0.75rem;
  margin-bottom: 6px;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
}

.battlefield .unit-circle {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  border: 3px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.4);
}

.battlefield :deep(.shield-overlay) {
  position: absolute;
  inset: 0;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  pointer-events: none;
  border: 3px solid rgba(96, 165, 250, 0.5);
  box-shadow: 0 0 12px rgba(96, 165, 250, 0.4), inset 0 0 12px rgba(96, 165, 250, 0.15);
  background: rgba(96, 165, 250, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
  color: #93c5fd;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
  opacity: 0;
  transition: opacity 0.25s ease;
}

.battlefield :deep(.shield-overlay.shield-overlay-visible) {
  opacity: 1;
}

.battlefield .hp-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: var(--element-color, #94a3b8);
  transition: height 0.3s ease;
}

.battlefield .float-container {
  position: absolute;
  top: 25px;
  right: -30px;
  width: 60px;
  height: 30px;
  pointer-events: none;
  overflow: visible;
}

.battlefield .floating-text {
  position: absolute;
  right: 0;
  top: 0;
  font-weight: bold;
  font-size: 0.9rem;
  white-space: nowrap;
  text-shadow: 0 0 4px #000;
  animation: floatRight 1s ease-out forwards;
  letter-spacing: 0.02em;
  filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.4));
}

.battlefield .floating-text.float-heal,
.battlefield .floating-text.float-regen {
  font-weight: 800;
}

.battlefield .floating-text.float-regen {
  text-shadow: 0 0 8px rgba(34, 197, 94, 0.45);
}

.battlefield .floating-text.float-shield {
  text-shadow: 0 0 8px rgba(96, 165, 250, 0.45);
}

.battlefield .floating-text.float-buff {
  text-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
}

.battlefield .floating-text.float-debuff {
  text-shadow: 0 0 8px rgba(139, 92, 246, 0.4);
}

.battlefield .floating-text.float-steal-gain,
.battlefield .floating-text.float-steal-loss {
  font-size: 0.82rem;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 999px;
}

.battlefield .floating-text.float-steal-gain {
  background: rgba(20, 184, 166, 0.18);
  text-shadow: 0 0 8px rgba(20, 184, 166, 0.5);
}

.battlefield .floating-text.float-steal-loss {
  background: rgba(139, 92, 246, 0.18);
  text-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
}

@keyframes floatRight {
  0% { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; transform: translateX(20px); }
}

.battlefield .status-icon {
  width: 20px;
  min-height: 20px;
  border-radius: 4px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  color: white;
  margin: 1px;
  transition: transform 0.15s ease;
  position: relative;
  flex-shrink: 0;
  pointer-events: auto;
}

.battlefield .status-icon.buff {
  background: linear-gradient(135deg, #065f46, #10b981);
  border: 1px solid #34d399;
}

.battlefield .status-icon.debuff {
  background: linear-gradient(135deg, #7f1d1d, #dc2626);
  border: 1px solid #f87171;
}

.battlefield .status-icon .status-emoji {
  line-height: 1;
}
.battlefield .status-icon .status-duration {
  font-size: 9px;
  line-height: 1;
  opacity: 0.95;
}
.battlefield .status-icon:hover {
  transform: scale(1.2);
  z-index: 5;
}

.battlefield-actions {
  margin-bottom: 0.5rem;
}

.btn-replay {
  padding: 0.4rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(30, 41, 59, 0.8);
  color: #e5e7eb;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-replay:hover:not(:disabled) {
  background: rgba(51, 65, 85, 0.9);
}

.btn-replay:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
