<template>
  <section class="gw-view">
    <!-- ── Pas en guilde ─────────────────────────────────────────────────── -->
    <div v-if="!loading && notInGuild" class="gw-empty nx-panel">
      <h2>Guerre de Guilde</h2>
      <p>Vous devez appartenir à une guilde pour accéder aux guerres de guilde.</p>
      <router-link to="/guild" class="nx-btn nx-btn-primary">Rejoindre une guilde</router-link>
    </div>

    <!-- ── Chargement ────────────────────────────────────────────────────── -->
    <div v-else-if="loading" class="gw-loading">Chargement...</div>

    <!-- ── Pas de guerre active ──────────────────────────────────────────── -->
    <template v-else-if="!warData">
      <div class="gw-no-war nx-panel">
        <div class="gw-header-block">
          <span class="gw-kicker">Guerre de Guilde</span>
          <h2 class="gw-main-title">Aucune guerre en cours</h2>
        </div>
        <div v-if="schedule" class="gw-schedule">
          <div class="gw-schedule-card">
            <span class="gw-schedule-label">Phase actuelle</span>
            <span class="gw-schedule-value">{{ schedule.current_phase === 'preparation' ? 'Préparation' : 'Attaque' }}</span>
          </div>
          <div class="gw-schedule-card">
            <span class="gw-schedule-label">Prochaine guerre</span>
            <span class="gw-schedule-value gw-countdown">{{ countdown }}</span>
          </div>
        </div>
        <p class="gw-schedule-hint">Heure de Paris : matchmaking à minuit, phase d'attaque à 12h.</p>

        <!-- Historique (visible quand pas de guilde exclue par notInGuild) -->
        <div v-if="!notInGuild" class="gw-history-standalone nx-panel">
          <h3 class="gw-section-title">📜 Historique des guerres</h3>
          <p v-if="historyLoading" class="gw-history-loading">Chargement...</p>
          <p v-else-if="!warHistory.length" class="gw-empty-logs">Aucune guerre terminée pour le moment.</p>
          <ul v-else class="gw-history-list">
            <li
              v-for="entry in warHistory"
              :key="entry.id"
              class="gw-history-item"
              :class="`result-${entry.result}`"
            >
              <span class="gw-history-icon">
                {{ entry.result === 'win' ? '✅' : entry.result === 'loss' ? '❌' : '➖' }}
              </span>
              <div class="gw-history-body">
                <p class="gw-history-text">
                  <strong>{{ entry.result === 'win' ? 'Victoire' : entry.result === 'loss' ? 'Défaite' : 'Nul' }}</strong>
                  contre <strong>{{ entry.opponent_name }}</strong>
                  — <span class="gw-history-reward">{{ entry.reward }} pièces de guilde</span>
                </p>
                <time class="gw-history-time">{{ formatHistoryDate(entry.end_time) }}</time>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <!-- ── Guerre active ─────────────────────────────────────────────────── -->
    <template v-else>
      <div class="gw-war-layout">
        <!-- En-tête guerre -->
        <div class="gw-war-header nx-panel">
          <div class="gw-war-title-block">
            <span class="gw-kicker">{{ phaseLabel }}</span>
            <h2 class="gw-main-title">Guerre de Guilde</h2>
          </div>

          <!-- Score -->
          <div class="gw-score-block">
            <div class="gw-team" :class="{ 'gw-team--mine': myGuildId === war.guild_a_id }">
              <span class="gw-team-name">{{ war.guild_a_name }}</span>
              <span class="gw-team-score" :class="scoreClassA">{{ war.guild_a_score }}</span>
            </div>
            <div class="gw-vs">VS</div>
            <div class="gw-team gw-team--right" :class="{ 'gw-team--mine': myGuildId === war.guild_b_id }">
              <span class="gw-team-score" :class="scoreClassB">{{ war.guild_b_score }}</span>
              <span class="gw-team-name">{{ war.guild_b_name }}</span>
            </div>
          </div>

          <!-- Barres de score -->
          <div class="gw-score-bars">
            <div class="gw-bar-wrap">
              <div class="gw-bar gw-bar--a" :style="{ width: `${(war.guild_a_score / 6) * 100}%` }"></div>
            </div>
            <div class="gw-bar-wrap">
              <div class="gw-bar gw-bar--b" :style="{ width: `${(war.guild_b_score / 6) * 100}%` }"></div>
            </div>
          </div>

          <!-- Timer -->
          <div class="gw-timer">
            <span class="gw-timer-label">
              {{ war.status === 'preparation' ? 'Phase d\'attaque dans' : 'Fin de guerre dans' }}
            </span>
            <span class="gw-timer-value">{{ warTimer }}</span>
          </div>
        </div>

        <!-- Tabs -->
        <div class="gw-tabs nx-panel">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="gw-tab-btn"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- ── ONGLET : DÉFENSES ──────────────────────────────────────── -->
        <div v-if="activeTab === 'defenses'" class="gw-defenses-layout gw-defenses-two-col">
          <!-- Nos défenses — visible uniquement aux membres (pas officiers/chef) -->
          <div v-if="!canManageDefenses" class="gw-defense-section nx-panel">
            <h3 class="gw-section-title">🛡️ Nos défenses — {{ myGuildName }}</h3>
            <p class="gw-defense-hint">Défenses actuellement en place pour la guerre.</p>
            <div class="gw-defense-grid">
              <div
                v-for="slot in 6"
                :key="slot"
                class="gw-defense-slot gw-defense-slot--own"
                :class="getSlotClass(myGuildId, slot)"
              >
                <div class="gw-slot-header">
                  <span class="gw-slot-num">#{{ slot }}</span>
                  <span class="gw-slot-status">{{ getSlotLabel(myGuildId, slot) }}</span>
                </div>
                <div class="gw-slot-units">
                  <template v-if="getDefense(myGuildId, slot)">
                    <div v-for="(unit, i) in getDefense(myGuildId, slot)?.units_json ?? []" :key="i" class="gw-slot-unit-badge">
                      {{ unit.name ?? '???' }}
                    </div>
                    <span v-if="getDefense(myGuildId, slot)?.defender_name" class="gw-slot-defender">par {{ getDefense(myGuildId, slot)?.defender_name }}</span>
                  </template>
                  <span v-else class="gw-slot-empty-label">Vide</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Configurer les défenses — visible uniquement aux officiers et chef -->
          <div v-if="canManageDefenses" class="gw-defense-section nx-panel">
            <h3 class="gw-section-title">⚙️ Configurer les défenses — {{ myGuildName }}</h3>
            <p v-if="war.status === 'preparation'" class="gw-defense-hint">
              Sélectionnez une défense pour chaque emplacement parmi celles proposées par les membres.
            </p>
            <div class="gw-defense-grid">
              <div
                v-for="slot in 6"
                :key="slot"
                class="gw-defense-slot gw-defense-slot--own"
                :class="getSlotClass(myGuildId, slot)"
              >
                <div class="gw-slot-header">
                  <span class="gw-slot-num">#{{ slot }}</span>
                  <span class="gw-slot-status">{{ getSlotLabel(myGuildId, slot) }}</span>
                </div>
                <div class="gw-slot-units">
                  <template v-if="getDefense(myGuildId, slot)">
                    <div v-for="(unit, i) in getDefense(myGuildId, slot)?.units_json ?? []" :key="i" class="gw-slot-unit-badge">
                      {{ unit.name ?? '???' }}
                    </div>
                    <span v-if="getDefense(myGuildId, slot)?.defender_name" class="gw-slot-defender">par {{ getDefense(myGuildId, slot)?.defender_name }}</span>
                  </template>
                  <span v-else class="gw-slot-empty-label">Vide</span>
                </div>
                <select
                  v-if="war.status === 'preparation'"
                  :value="selectedPresetValueForSlot(slot)"
                  class="gw-preset-select"
                  :disabled="placeLoadingSlot === slot"
                  @change="onPresetChange(slot, $event)"
                >
                  <option value="">— Choisir —</option>
                  <option value="0">— Vide —</option>
                  <option v-for="p in availablePresetsForSlot(slot)" :key="p.id" :value="String(p.id)">
                    {{ p.name }} (par {{ p.creator_name }})
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- Mes défenses proposées -->
          <div class="gw-defense-section nx-panel gw-my-presets-section">
            <h3 class="gw-section-title">📋 Mes défenses proposées</h3>
            <p class="gw-defense-hint">Vos défenses soumises aux officiers. Une unité déjà utilisée dans une défense ne peut pas être réutilisée ailleurs.</p>
            <button
              v-if="war.status === 'preparation' && myPresets.length < 3"
              type="button"
              class="nx-btn nx-btn-primary gw-propose-btn"
              @click="openProposeModal"
            >
              + Proposer une défense
            </button>
            <div v-if="myPresets.length === 0" class="gw-my-presets-empty">
              Aucune défense proposée. Cliquez sur « Proposer une défense » pour en créer.
            </div>
            <div v-else class="gw-my-presets-list">
              <div
                v-for="preset in myPresets"
                :key="preset.id"
                class="gw-my-preset-card"
              >
                <div class="gw-my-preset-header">
                  <span class="gw-my-preset-name">{{ preset.name }}</span>
                  <button
                    v-if="war.status === 'preparation'"
                    type="button"
                    class="gw-my-preset-delete"
                    title="Supprimer"
                    :disabled="deletePresetId === preset.id"
                    @click="deleteMyPreset(preset.id)"
                  >
                    {{ deletePresetId === preset.id ? '…' : '✕' }}
                  </button>
                </div>
                <div class="gw-my-preset-units">
                  <span v-for="(u, i) in preset.units_json" :key="i" class="gw-slot-unit-badge">{{ u.name ?? '???' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── ONGLET : ATTAQUE ──────────────────────────────────────── -->
        <div v-else-if="activeTab === 'attack'" class="gw-attack-panel nx-panel">
          <div v-if="war.status !== 'attack'" class="gw-phase-locked">
            <p>⏳ La phase d'attaque commence à 12h00.</p>
          </div>
          <template v-else>
            <h3 class="gw-section-title">⚔️ Défenses adverses — {{ enemyGuildName }}</h3>
            <p class="gw-attack-hint">Sélectionnez un slot à attaquer puis entre 1 et 4 unités.</p>

            <!-- Sélection cible -->
            <div class="gw-target-select">
              <p class="gw-sub-label">Cible</p>
              <div class="gw-target-slots">
                <button
                  v-for="{ slot, defense, destroyed } in enemyTargetSlots"
                  :key="slot"
                  type="button"
                  class="gw-target-slot-btn"
                  :class="{
                    selected: selectedSlot === slot,
                    destroyed,
                    empty: !defense
                  }"
                  :disabled="destroyed || !defense"
                  @click="selectedSlot = slot"
                >
                  <span class="gw-target-slot-num">#{{ slot }}</span>
                  <template v-if="defense && !destroyed">
                    <span class="gw-target-slot-defender">{{ defense.defender_name ?? 'Joueur' }}</span>
                    <span class="gw-target-slot-units">
                      <template v-for="(u, i) in defense.units_json ?? []" :key="i">
                        <span class="gw-target-unit">{{ u.name ?? '?' }} <em>Niv.{{ u.level ?? '?' }}</em></span>
                        <template v-if="i < ((defense.units_json ?? []).length - 1)"> · </template>
                      </template>
                    </span>
                    <div class="gw-defense-hover-bubble" role="tooltip">
                      <div class="gw-defense-hover-title">Defense #{{ slot }}</div>
                      <div class="gw-defense-hover-owner">Proprietaire : {{ defense.defender_name ?? 'Joueur inconnu' }}</div>
                      <div class="gw-defense-hover-list">
                        <div
                          v-for="(u, i) in defense.units_json ?? []"
                          :key="`hover-${slot}-${i}`"
                          class="gw-defense-hover-unit"
                        >
                          <div class="gw-defense-hover-head">
                            <strong>{{ u.name ?? '?' }}</strong>
                            <span class="gw-defense-hover-meta">Niv. {{ u.level ?? '?' }}</span>
                            <span
                              class="gw-defense-hover-spec"
                              :class="{ 'is-none': !u.specialization }"
                            >
                              {{ u.specialization ? `Spe ${u.specialization}` : 'Non spe' }}
                            </span>
                          </div>
                          <div class="gw-defense-hover-stats">
                            HP {{ u.stats?.maxHp ?? '?' }} · ATK {{ u.stats?.attack ?? '?' }} · DEF {{ u.stats?.defense ?? '?' }} · SPD {{ u.stats?.speed ?? '?' }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                  <span v-if="destroyed" class="gw-destroyed-badge">✗</span>
                  <span v-else-if="!defense" class="gw-destroyed-badge">○</span>
                </button>
              </div>
            </div>

            <!-- Sélection unités -->
            <div v-if="selectedSlot" class="gw-unit-select">
              <p class="gw-sub-label">Vos unités ({{ selectedAttackers.length }}/4 — min 1, max 4)</p>
              <div class="gw-unit-grid">
                <div
                  v-for="unit in availableUnits"
                  :key="unit.user_unit_id"
                  class="gw-unit-card"
                  :class="{
                    selected: isUnitSelected(unit.user_unit_id),
                    used: unit.used,
                    disabled: isAttackUnitDisabled(unit)
                  }"
                  @click="toggleUnit(unit)"
                >
                  <div class="gw-unit-rarity" :class="`rarity-${unit.rarity}`"></div>
                  <div class="gw-unit-info">
                    <span class="gw-unit-name">{{ unit.name }}</span>
                    <span class="gw-unit-meta">Niv. {{ unit.level }} · {{ unit.element }}</span>
                  </div>
                  <span v-if="unit.used" class="gw-unit-used-badge">Utilisé</span>
                  <span v-else-if="isUnitSelected(unit.user_unit_id)" class="gw-unit-sel-badge">✓</span>
                </div>
              </div>

              <!-- Position des unités sélectionnées (1-4) -->
              <div v-if="selectedAttackers.length > 0" class="gw-attacker-lineup">
                <p class="gw-sub-label">Disposition (CAC → Front, Distance → Back, max 3 chacun)</p>
                <div class="gw-lineup-grid">
                  <div
                    v-for="(attacker, i) in selectedAttackers"
                    :key="attacker.user_unit_id"
                    class="gw-lineup-unit"
                  >
                    <span class="gw-lineup-name">{{ attacker.name }}</span>
                    <div class="gw-position-toggle">
                      <button
                        type="button"
                        class="gw-pos-btn"
                        :class="{ active: attacker.position === 'front' }"
                        :disabled="!isCAC(attacker)"
                        @click="setPosition(i, 'front')"
                      >Front</button>
                      <button
                        type="button"
                        class="gw-pos-btn"
                        :class="{ active: attacker.position === 'back' }"
                        :disabled="!isDistance(attacker)"
                        @click="setPosition(i, 'back')"
                      >Back</button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                class="nx-btn nx-btn-danger gw-launch-btn"
                :disabled="selectedAttackers.length < 1 || selectedAttackers.length > 4 || attackLoading"
                @click="launchAttack"
              >
                <span v-if="attackLoading" class="gw-spinner"></span>
                {{ attackLoading ? 'Combat en cours...' : `Attaquer Défense #${selectedSlot}` }}
              </button>
            </div>
          </template>
        </div>

        <!-- ── ONGLET : HISTORIQUE ────────────────────────────────────── -->
        <div v-else-if="activeTab === 'history'" class="gw-history-panel nx-panel">
          <h3 class="gw-section-title">📜 Historique des guerres</h3>
          <p v-if="historyLoading" class="gw-history-loading">Chargement...</p>
          <p v-else-if="!warHistory.length" class="gw-empty-logs">Aucune guerre terminée pour le moment.</p>
          <ul v-else class="gw-history-list">
            <li
              v-for="entry in warHistory"
              :key="entry.id"
              class="gw-history-item"
              :class="`result-${entry.result}`"
            >
              <span class="gw-history-icon">
                {{ entry.result === 'win' ? '✅' : entry.result === 'loss' ? '❌' : '➖' }}
              </span>
              <div class="gw-history-body">
                <p class="gw-history-text">
                  <strong>{{ entry.result === 'win' ? 'Victoire' : entry.result === 'loss' ? 'Défaite' : 'Nul' }}</strong>
                  contre <strong>{{ entry.opponent_name }}</strong>
                  — <span class="gw-history-reward">{{ entry.reward }} pièces de guilde</span>
                </p>
                <time class="gw-history-time">{{ formatHistoryDate(entry.end_time) }}</time>
              </div>
            </li>
          </ul>
        </div>

        <!-- ── ONGLET : JOURNAL ──────────────────────────────────────── -->
        <div v-else-if="activeTab === 'logs'" class="gw-logs-panel nx-panel">
          <h3 class="gw-section-title">📋 Journal de Guerre</h3>
          <p v-if="!logs.length" class="gw-empty-logs">Aucune action pour l'instant.</p>
          <ul v-else class="gw-log-list">
            <li v-for="log in logs" :key="log.id" class="gw-log-item" :class="`result-${log.result}`">
              <span class="gw-log-icon">{{ log.result === 'win' ? '✅' : '❌' }}</span>
              <div class="gw-log-body">
                <p class="gw-log-text">
                  <strong>{{ log.attacker_username }}</strong>
                  {{ log.result === 'win' ? 'a attaqué Défense' : 'a perdu contre Défense' }}
                  <strong>#{{ log.target_slot_index }}</strong>
                  {{ log.result === 'win' ? 'et a gagné' : '' }}
                  <span class="gw-log-guild-badge">
                    ({{ getGuildName(log.target_guild_id) }})
                  </span>
                </p>
                <time class="gw-log-time">{{ timeAgo(log.created_at) }}</time>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <!-- ── Modal Proposer une défense ─────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showProposeModal" class="gw-modal-overlay" @click.self="closeProposeModal">
        <div class="gw-modal">
          <h3>Proposer une défense</h3>
          <p class="gw-modal-hint">Sélectionnez entre 1 et 4 unités. Les officiers pourront choisir cette défense pour un emplacement.</p>
          <input
            v-model="proposePresetName"
            type="text"
            class="gw-preset-name-input"
            placeholder="Nom de la défense (ex: Tank + DPS)"
            maxlength="50"
          />
          <p v-if="availableUnitsForPropose.length < 1" class="gw-modal-warn">Aucune unité disponible (celles déjà en défense sont exclues).</p>
          <div class="gw-unit-grid gw-unit-grid--modal">
            <div
              v-for="unit in availableUnitsForPropose"
              :key="unit.user_unit_id"
              class="gw-unit-card"
              :class="{
                selected: isProposeUnitSelected(unit.user_unit_id),
                disabled: isProposeUnitDisabled(unit)
              }"
              @click="toggleProposeUnit(unit)"
            >
              <div class="gw-unit-rarity" :class="`rarity-${unit.rarity}`"></div>
              <div class="gw-unit-info">
                <span class="gw-unit-name">{{ unit.name }}</span>
                <span class="gw-unit-meta">Niv. {{ unit.level }} · {{ unit.element }}</span>
              </div>
              <span v-if="isProposeUnitSelected(unit.user_unit_id)" class="gw-unit-sel-badge">✓</span>
            </div>
          </div>
          <div v-if="proposeDefenseUnits.length > 0" class="gw-lineup-grid" style="margin-top: 12px;">
            <div v-for="(u, i) in proposeDefenseUnits" :key="u.user_unit_id" class="gw-lineup-unit">
              <span class="gw-lineup-name">{{ u.name }}</span>
              <div class="gw-position-toggle">
                <button type="button" class="gw-pos-btn" :class="{ active: u.position === 'front' }" :disabled="!isCAC(u)" @click="setProposePosition(i, 'front')">Front</button>
                <button type="button" class="gw-pos-btn" :class="{ active: u.position === 'back' }" :disabled="!isDistance(u)" @click="setProposePosition(i, 'back')">Back</button>
              </div>
            </div>
          </div>
          <p v-if="proposeDefenseUnits.length >= 1 && proposeDefenseUnits.length <= 4 && !proposePresetName.trim()" class="gw-modal-warn">Donnez un nom à votre défense pour valider.</p>
          <div class="gw-modal-actions">
            <button type="button" class="nx-btn nx-btn-ghost" @click="closeProposeModal">Annuler</button>
            <button
              type="button"
              class="nx-btn nx-btn-primary"
              :disabled="proposeDefenseUnits.length < 1 || proposeDefenseUnits.length > 4 || !proposePresetName.trim() || proposeLoading"
              @click="submitProposeDefense"
            >
              {{ proposeLoading ? 'Enregistrement...' : `Proposer (${proposeDefenseUnits.length}/4 unités)` }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Visualiseur de combat guerre de guilde (replay + plateau) -->
    <StageModal
      :show="!!gwPendingBattle"
      :chapter="0"
      :stage="0"
      mode="normal"
      :stage-info="{ stage: 0, isBoss: false, cleared: false, rewardClaimed: false, available: true }"
      :campaign-team="[]"
      :pending-battle="gwPendingBattle"
      @close="closeGwBattle"
      @battle-finalized="handleGwBattleFinalized"
    />

    <!-- ── Feedback ─────────────────────────────────────────────────────────── -->
    <Transition name="gw-toast">
      <div v-if="toast.message" class="gw-toast" :class="`gw-toast--${toast.type}`">
        {{ toast.message }}
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import api from '../api';
import StageModal from './StageModal.vue';

// ── Types ────────────────────────────────────────────────────────────────────

type WarUnit = {
  user_unit_id: number;
  position: 'front' | 'back';
  name?: string;
  level?: number;
  specialization?: 'A' | 'B' | null;
  power_level?: number;
  stats?: {
    maxHp?: number;
    attack?: number;
    defense?: number;
    speed?: number;
    mastery?: number;
  } | null;
};
type Defense = {
  id: number; war_id: number; guild_id: number; slot_index: number;
  defender_user_id: number | null; defender_name: string | null;
  units_json: WarUnit[]; is_destroyed: boolean; destroyed_at: string | null;
  preset_id?: number | null;
};
type War = {
  id: number; guild_a_id: number; guild_b_id: number;
  guild_a_name: string; guild_b_name: string;
  start_time: string; attack_phase_start: string; end_time: string;
  guild_a_score: number; guild_b_score: number;
  status: 'preparation' | 'attack' | 'finished';
  winner_guild_id: number | null;
};
type WarLog = {
  id: number; attacker_username: string; attacker_guild_id: number;
  target_slot_index: number; target_guild_id: number;
  result: 'win' | 'loss'; created_at: string;
};
type AvailableUnit = {
  user_unit_id: number; name: string; code: string; rarity: string;
  element: string; role: string; archetype: string; image_url: string | null;
  level: number; power_level: number; used: boolean;
};
type Schedule = { current_phase: string; next_phase_at: string; next_war_at: string };
type WarHistoryEntry = {
  id: number; end_time: string; opponent_name: string;
  result: 'win' | 'loss' | 'draw'; reward: number;
};

// ── State ────────────────────────────────────────────────────────────────────

const loading = ref(true);
const notInGuild = ref(false);
const war = ref<War | null>(null);
const warData = ref<any>(null);
const myGuildId = ref<number | null>(null);
const defenses = ref<Defense[]>([]);
const logs = ref<WarLog[]>([]);
const availableUnits = ref<AvailableUnit[]>([]);
const schedule = ref<Schedule | null>(null);
const activeTab = ref<'defenses' | 'attack' | 'logs' | 'history'>('defenses');
const canManageDefenses = ref(false);
const attackLoading = ref(false);
const placeLoading = ref(false);
const selectedSlot = ref<number | null>(null);
const selectedAttackers = ref<Array<AvailableUnit & { position: 'front' | 'back' }>>([]);
const guildPresets = ref<Array<{ id: number; name: string; creator_name: string }>>([]);
const placeLoadingSlot = ref<number | null>(null);
const myPresets = ref<Array<{ id: number; name: string; units_json: WarUnit[] }>>([]);
const deletePresetId = ref<number | null>(null);
const showProposeModal = ref(false);
const proposeDefenseUnits = ref<Array<AvailableUnit & { position: 'front' | 'back' }>>([]);
const proposePresetName = ref('');
const proposeLoading = ref(false);
const toast = ref({ message: '', type: 'success' });
const warHistory = ref<WarHistoryEntry[]>([]);
const historyLoading = ref(false);
const gwPendingBattle = ref<{
  id: number; battleType: 'guild_war'; title?: string; result?: string;
  battleLog?: unknown[]; replay?: { seed?: number; frames: unknown[] };
  initialUnits?: unknown[]; summary?: unknown; enemyTeamLabel?: string;
} | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;
const countdown = ref('');
const warTimer = ref('');

const tabs = [
  { id: 'defenses', label: '🛡️ Défenses' },
  { id: 'attack', label: '⚔️ Attaquer' },
  { id: 'logs', label: '📋 Journal' },
  { id: 'history', label: '📜 Historique' }
];

// ── Computed ─────────────────────────────────────────────────────────────────

const myGuildName = computed(() => {
  if (!war.value || !myGuildId.value) return '';
  return myGuildId.value === war.value.guild_a_id ? war.value.guild_a_name : war.value.guild_b_name;
});
const enemyGuildId = computed(() => {
  if (!war.value || !myGuildId.value) return null;
  return myGuildId.value === war.value.guild_a_id ? war.value.guild_b_id : war.value.guild_a_id;
});
const enemyGuildName = computed(() => {
  if (!war.value || !myGuildId.value) return '';
  return myGuildId.value === war.value.guild_a_id ? war.value.guild_b_name : war.value.guild_a_name;
});
const phaseLabel = computed(() => {
  if (!war.value) return '';
  if (war.value.status === 'preparation') return '⚙️ Phase de Préparation';
  if (war.value.status === 'attack') return '⚔️ Phase d\'Attaque';
  return '🏁 Guerre Terminée';
});
const scoreClassA = computed(() => {
  if (!war.value) return '';
  if (war.value.guild_a_score > war.value.guild_b_score) return 'winning';
  if (war.value.guild_a_score < war.value.guild_b_score) return 'losing';
  return '';
});
const scoreClassB = computed(() => {
  if (!war.value) return '';
  if (war.value.guild_b_score > war.value.guild_a_score) return 'winning';
  if (war.value.guild_b_score < war.value.guild_a_score) return 'losing';
  return '';
});

/** Preset IDs déjà utilisés dans les autres slots (pour exclure des choix). Slot → Set des preset_id utilisés ailleurs. */
const presetIdsUsedBySlot = computed(() => {
  const bySlot: Record<number, Set<number>> = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set(), 6: new Set() };
  if (!myGuildId.value) return bySlot;
  for (const d of defenses.value) {
    if (d.guild_id !== myGuildId.value || !d.preset_id) continue;
    for (let s = 1; s <= 6; s++) {
      if (s !== d.slot_index) bySlot[s].add(d.preset_id);
    }
  }
  return bySlot;
});

/** Presets disponibles pour un slot donné (exclut ceux déjà utilisés dans d'autres slots) */
function availablePresetsForSlot(slot: number) {
  const usedElsewhere = presetIdsUsedBySlot.value[slot];
  return guildPresets.value.filter((p) => !usedElsewhere.has(p.id));
}

/** Unités déjà utilisées dans les défenses placées (nos 6 slots) */
const unitsUsedInPlacedDefenses = computed(() => {
  const ids = new Set<number>();
  if (!myGuildId.value) return ids;
  for (const d of defenses.value) {
    if (d.guild_id !== myGuildId.value) continue;
    for (const u of d.units_json || []) {
      if (u.user_unit_id) ids.add(Number(u.user_unit_id));
    }
  }
  return ids;
});

/** Unités déjà dans mes presets existants (exclues pour une nouvelle proposition) */
const unitsUsedInMyPresets = computed(() => {
  const ids = new Set<number>();
  for (const preset of myPresets.value) {
    for (const u of preset.units_json || []) {
      if (u.user_unit_id) ids.add(Number(u.user_unit_id));
    }
  }
  return ids;
});

/** Unités disponibles pour proposer (exclut celles déjà en défense placée ou dans mes presets) */
const availableUnitsForPropose = computed(() => {
  return availableUnits.value.filter(
    (u) =>
      !unitsUsedInPlacedDefenses.value.has(u.user_unit_id) &&
      !unitsUsedInMyPresets.value.has(u.user_unit_id)
  );
});

/** Slots cibles pour l'attaque adverse (1–6) avec défense préchargée */
const enemyTargetSlots = computed(() => {
  const gid = enemyGuildId.value;
  return [1, 2, 3, 4, 5, 6].map((slot) => ({
    slot,
    defense: getDefense(gid, slot),
    destroyed: isSlotDestroyed(gid, slot),
  }));
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function isCAC(u: AvailableUnit): boolean {
  const a = (u.archetype || '').toUpperCase();
  return a === 'CAC_TANK' || a === 'CAC_DPS';
}
function isDistance(u: AvailableUnit): boolean {
  return (u.archetype || '').toUpperCase().startsWith('DISTANCE');
}

function getDefense(guildId: number | null, slot: number): Defense | undefined {
  if (!guildId) return undefined;
  return defenses.value.find((d) => d.guild_id === guildId && d.slot_index === slot);
}

function selectedPresetValueForSlot(slot: number): string {
  const d = getDefense(myGuildId.value, slot);
  return d?.preset_id ? String(d.preset_id) : '';
}

function isSlotDestroyed(guildId: number | null, slot: number): boolean {
  const d = getDefense(guildId, slot);
  return !!d?.is_destroyed;
}

function getSlotLabel(guildId: number | null, slot: number): string {
  const d = getDefense(guildId, slot);
  if (!d) return 'Vide';
  if (d.is_destroyed) return 'Détruite';
  return 'Active';
}

function getSlotClass(guildId: number | null, slot: number): string {
  const d = getDefense(guildId, slot);
  if (!d) return 'slot--empty';
  if (d.is_destroyed) return 'slot--destroyed';
  return 'slot--active';
}

function getGuildName(guildId: number): string {
  if (!war.value) return String(guildId);
  if (guildId === war.value.guild_a_id) return war.value.guild_a_name;
  if (guildId === war.value.guild_b_id) return war.value.guild_b_name;
  return String(guildId);
}

function isUnitSelected(unitId: number): boolean {
  return selectedAttackers.value.some((u) => u.user_unit_id === unitId);
}

function isProposeUnitSelected(unitId: number): boolean {
  return proposeDefenseUnits.value.some((u) => u.user_unit_id === unitId);
}

function isProposeUnitDisabled(unit: AvailableUnit): boolean {
  if (isProposeUnitSelected(unit.user_unit_id)) return false;
  if (proposeDefenseUnits.value.length >= 4) return true;
  const cacCount = proposeDefenseUnits.value.filter(isCAC).length;
  const distCount = proposeDefenseUnits.value.filter(isDistance).length;
  if (isCAC(unit) && cacCount >= 3) return true;
  if (isDistance(unit) && distCount >= 3) return true;
  return false;
}
// Note: les unités déjà en défense ou dans mes presets sont exclues via availableUnitsForPropose

function toggleProposeUnit(unit: AvailableUnit) {
  const idx = proposeDefenseUnits.value.findIndex((u) => u.user_unit_id === unit.user_unit_id);
  if (idx >= 0) {
    proposeDefenseUnits.value.splice(idx, 1);
    return;
  }
  if (proposeDefenseUnits.value.length >= 4) return; // max 4
  const cacCount = proposeDefenseUnits.value.filter(isCAC).length;
  const distCount = proposeDefenseUnits.value.filter(isDistance).length;
  if (isCAC(unit) && cacCount >= 3) return;
  if (isDistance(unit) && distCount >= 3) return;
  proposeDefenseUnits.value.push({ ...unit, position: isCAC(unit) ? 'front' : 'back' });
}

function setProposePosition(i: number, pos: 'front' | 'back') {
  const u = proposeDefenseUnits.value[i];
  if (!u) return;
  if (pos === 'front' && !isCAC(u)) return;
  if (pos === 'back' && !isDistance(u)) return;
  u.position = pos;
}

function isAttackUnitDisabled(unit: AvailableUnit): boolean {
  if (unit.used) return true;
  if (isUnitSelected(unit.user_unit_id)) return false;
  if (selectedAttackers.value.length >= 4) return true;
  const cacCount = selectedAttackers.value.filter(isCAC).length;
  const distCount = selectedAttackers.value.filter(isDistance).length;
  if (isCAC(unit) && cacCount >= 3) return true;
  if (isDistance(unit) && distCount >= 3) return true;
  return false;
}

function toggleUnit(unit: AvailableUnit) {
  if (unit.used) return;
  const idx = selectedAttackers.value.findIndex((u) => u.user_unit_id === unit.user_unit_id);
  if (idx >= 0) {
    selectedAttackers.value.splice(idx, 1);
    return;
  }
  if (selectedAttackers.value.length >= 4) return;
  const cacCount = selectedAttackers.value.filter(isCAC).length;
  const distCount = selectedAttackers.value.filter(isDistance).length;
  if (isCAC(unit) && cacCount >= 3) return;
  if (isDistance(unit) && distCount >= 3) return;
  const position = isCAC(unit) ? 'front' : 'back';
  selectedAttackers.value.push({ ...unit, position });
}

function setPosition(i: number, pos: 'front' | 'back') {
  const u = selectedAttackers.value[i];
  if (!u) return;
  if (pos === 'front' && !isCAC(u)) return;
  if (pos === 'back' && !isDistance(u)) return;
  u.position = pos;
}

function selectAttackTarget(guildId: number | null, slot: number) {
  if (!guildId || isSlotDestroyed(guildId, slot)) return;
  selectedSlot.value = slot;
  selectedAttackers.value = [];
  activeTab.value = 'attack';
}

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { message, type };
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value.message = ''; }, 4000);
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${Math.floor(hours / 24)}j`;
}

function formatHistoryDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatCountdown(targetDate: string): string {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Chargement ────────────────────────────────────────────────────────────────

async function loadWarStatus() {
  try {
    const { data } = await api.get('/guild-war/status');
    if (!data.success) return;

    schedule.value = data.schedule ?? null;
    warData.value = data.war;

    if (!data.war) {
      war.value = null;
      return;
    }

    war.value = data.war.war;
    myGuildId.value = data.war.my_guild_id;
    defenses.value = data.war.defenses ?? [];
    logs.value = data.war.logs ?? [];

    if (war.value) {
      await loadAvailableUnits(war.value.id);
    }
  } catch (err: any) {
    if (err.response?.status === 403) notInGuild.value = true;
  } finally {
    loading.value = false;
  }
}

async function loadAvailableUnits(warId: number) {
  try {
    const { data } = await api.get(`/guild-war/available-units/${warId}`);
    if (data.success) availableUnits.value = data.units ?? [];
  } catch {
    // silencieux
  }
}

async function loadWarHistory() {
  if (notInGuild.value) return;
  historyLoading.value = true;
  try {
    const { data } = await api.get('/guild-war/history');
    if (data.success) warHistory.value = data.history ?? [];
  } catch {
    warHistory.value = [];
  } finally {
    historyLoading.value = false;
  }
}

async function checkMemberRole() {
  try {
    const { data } = await api.get('/guild/me');
    const role = data.role ?? '';
    canManageDefenses.value = role === 'leader' || role === 'officer';
  } catch {
    canManageDefenses.value = false;
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function launchAttack() {
  const n = selectedAttackers.value.length;
  if (!war.value || !selectedSlot.value || n < 1 || n > 4) return;
  attackLoading.value = true;
  try {
    const { data } = await api.post('/guild-war/attack/start', {
      war_id: war.value.id,
      target_slot_index: selectedSlot.value,
      attacker_units: selectedAttackers.value.map((u) => ({
        user_unit_id: u.user_unit_id,
        position: u.position
      }))
    });
    if (data.success && data.pendingBattle) {
      gwPendingBattle.value = data.pendingBattle;
    }
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Erreur lors du lancement de l\'attaque.', 'error');
  } finally {
    attackLoading.value = false;
  }
}

function closeGwBattle() {
  gwPendingBattle.value = null;
}

async function handleGwBattleFinalized() {
  gwPendingBattle.value = null;
  await loadWarStatus();
  showToast('Attaque finalisée. Le score a été mis à jour.');
}

async function loadGuildPresets() {
  if (canManageDefenses.value) {
    try {
      const { data } = await api.get('/guild-war/guild-defense-presets');
      if (data.success) guildPresets.value = data.presets ?? [];
    } catch { /* silencieux */ }
  }
  try {
    const { data } = await api.get('/guild-war/defense-presets');
    if (data.success) myPresets.value = (data.presets ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      units_json: p.units_json ?? []
    }));
  } catch { myPresets.value = []; }
}

async function deleteMyPreset(presetId: number) {
  deletePresetId.value = presetId;
  try {
    await api.delete(`/guild-war/defense-presets/${presetId}`);
    myPresets.value = myPresets.value.filter((p) => p.id !== presetId);
    if (canManageDefenses.value) {
      const { data } = await api.get('/guild-war/guild-defense-presets');
      if (data.success) guildPresets.value = data.presets ?? [];
    }
    showToast('Défense supprimée.');
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Erreur.', 'error');
  } finally {
    deletePresetId.value = null;
  }
}

function openProposeModal() {
  showProposeModal.value = true;
  proposeDefenseUnits.value = [];
  proposePresetName.value = '';
}

function closeProposeModal() {
  showProposeModal.value = false;
  proposeDefenseUnits.value = [];
}

async function submitProposeDefense() {
  if (proposeDefenseUnits.value.length < 1 || proposeDefenseUnits.value.length > 4 || !proposePresetName.value.trim()) return;
  proposeLoading.value = true;
  try {
    const { data } = await api.post('/guild-war/defense-presets', {
      name: proposePresetName.value.trim(),
      units: proposeDefenseUnits.value.map((u) => ({ user_unit_id: u.user_unit_id, position: u.position, name: u.name }))
    });
    if (data.success) {
      showToast('Défense proposée !');
      closeProposeModal();
      await loadGuildPresets();
    }
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Erreur.', 'error');
  } finally {
    proposeLoading.value = false;
  }
}

async function onPresetChange(slot: number, ev: Event) {
  const el = ev.target as HTMLSelectElement;
  const val = el?.value ?? '';
  if (val === '') return;
  if (!war.value) return;
  placeLoadingSlot.value = slot;
  try {
    const presetId = val === '0' ? null : parseInt(val, 10);
    const { data } = await api.post('/guild-war/defenses/place', {
      war_id: war.value.id,
      slot_index: slot,
      preset_id: presetId
    });
    if (data.success) {
      defenses.value = data.defenses ?? defenses.value;
      showToast(presetId ? `Défense #${slot} mise à jour.` : `Slot #${slot} vidé.`);
    }
  } catch (err: any) {
    showToast(err.response?.data?.message || 'Erreur.', 'error');
  } finally {
    placeLoadingSlot.value = null;
  }
}

// ── Polling & timers ──────────────────────────────────────────────────────────

function startCountdownTimer() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    if (schedule.value) countdown.value = formatCountdown(schedule.value.next_war_at);
    if (war.value) {
      const target = war.value.status === 'preparation'
        ? war.value.attack_phase_start
        : war.value.end_time;
      warTimer.value = formatCountdown(target);
    }
  }, 1000);
}

function startPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (war.value) {
      try {
        const [defRes, logRes] = await Promise.all([
          api.get(`/guild-war/defenses/${war.value.id}`),
          api.get(`/guild-war/logs/${war.value.id}`)
        ]);
        if (defRes.data.success) defenses.value = defRes.data.defenses;
        if (logRes.data.success) logs.value = logRes.data.logs;
      } catch { /* silencieux */ }
    }
  }, 10_000);
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  await loadWarStatus();
  await checkMemberRole();
  await loadGuildPresets();
  if (!notInGuild.value && !warData.value) loadWarHistory();
  startCountdownTimer();
  startPoll();
  if (schedule.value) countdown.value = formatCountdown(schedule.value.next_war_at);
});

watch(activeTab, async (tab) => {
  if (tab === 'defenses') loadGuildPresets();
  if (tab === 'logs' && war.value) {
    try {
      const { data } = await api.get(`/guild-war/logs/${war.value.id}`);
      if (data.success) logs.value = data.logs;
    } catch { /* silencieux */ }
  }
  if (tab === 'history') loadWarHistory();
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (countdownTimer) clearInterval(countdownTimer);
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<style scoped>
.gw-view {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 12px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Panels ─────────────────────────────────────────────────────────────── */
.nx-panel {
  background: radial-gradient(circle at top left, rgba(56, 189, 248, 0.07), transparent 30%),
              linear-gradient(180deg, rgba(8,13,24,0.96), rgba(11,20,35,0.94));
  border: 1px solid rgba(125, 211, 252, 0.12);
  border-radius: 20px;
  padding: 20px;
}

/* ── Loading / Empty ────────────────────────────────────────────────────── */
.gw-loading, .gw-empty { text-align: center; padding: 40px; color: #94a3b8; }
.gw-empty a { margin-top: 16px; display: inline-block; }

/* ── Kicker ─────────────────────────────────────────────────────────────── */
.gw-kicker {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

/* ── No-war ─────────────────────────────────────────────────────────────── */
.gw-no-war { text-align: center; }
.gw-header-block { margin-bottom: 20px; }
.gw-main-title { margin: 0; font-size: 1.4rem; }
.gw-schedule {
  display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin: 16px 0;
}
.gw-schedule-card {
  background: rgba(15,23,42,0.6);
  border: 1px solid rgba(100,116,139,0.2);
  border-radius: 12px;
  padding: 12px 20px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.gw-schedule-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
.gw-schedule-value { font-size: 1.1rem; font-weight: 700; color: #e2e8f0; }
.gw-countdown { font-family: monospace; color: #38bdf8; }
.gw-schedule-hint { color: #475569; font-size: 0.85rem; margin-top: 8px; }

/* ── War layout ─────────────────────────────────────────────────────────── */
.gw-war-layout { display: flex; flex-direction: column; gap: 14px; }
.gw-war-header { display: flex; flex-direction: column; gap: 16px; }
.gw-war-title-block { display: flex; flex-direction: column; }

/* ── Score ──────────────────────────────────────────────────────────────── */
.gw-score-block {
  display: flex; align-items: center; gap: 20px; justify-content: center;
}
.gw-team { display: flex; flex-direction: column; align-items: flex-end; min-width: 120px; }
.gw-team--right { align-items: flex-start; }
.gw-team--mine .gw-team-name { color: #38bdf8; }
.gw-team-name { font-size: 0.9rem; color: #94a3b8; }
.gw-team-score {
  font-size: 2.5rem; font-weight: 900; line-height: 1;
  color: #e2e8f0;
  transition: color 300ms;
}
.gw-team-score.winning { color: #4ade80; }
.gw-team-score.losing { color: #f87171; }
.gw-vs { font-size: 1.1rem; color: #475569; font-weight: 700; }
.gw-score-bars { display: flex; flex-direction: column; gap: 4px; }
.gw-bar-wrap {
  height: 6px; border-radius: 4px;
  background: rgba(100,116,139,0.15);
  overflow: hidden;
}
.gw-bar { height: 100%; border-radius: 4px; transition: width 600ms ease; }
.gw-bar--a { background: linear-gradient(90deg, #38bdf8, #818cf8); }
.gw-bar--b { background: linear-gradient(90deg, #f87171, #fb923c); }

/* ── Timer ──────────────────────────────────────────────────────────────── */
.gw-timer { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; }
.gw-timer-label { color: #64748b; }
.gw-timer-value { font-family: monospace; font-size: 1rem; color: #e2e8f0; font-weight: 700; }

/* ── Tabs ───────────────────────────────────────────────────────────────── */
.gw-tabs { display: flex; gap: 8px; padding: 10px 16px; }
@media (max-width: 768px) {
  .gw-tabs {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    padding: 10px 12px;
  }
  .gw-tab-btn {
    flex-shrink: 0;
  }
  .gw-view {
    padding: 0 1rem 40px;
  }
  .gw-defense-grid {
    grid-template-columns: 1fr;
  }
  .gw-target-slots {
    grid-template-columns: 1fr;
  }
}
.gw-tab-btn {
  padding: 7px 18px;
  border-radius: 10px;
  border: 1px solid rgba(100,116,139,0.2);
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  transition: all 150ms;
}
.gw-tab-btn:hover { background: rgba(56,189,248,0.08); color: #e2e8f0; }
.gw-tab-btn.active {
  background: rgba(56,189,248,0.12);
  border-color: rgba(56,189,248,0.3);
  color: #38bdf8;
}

/* ── Defense grid ───────────────────────────────────────────────────────── */
.gw-defenses-layout { display: flex; flex-direction: column; gap: 14px; }
.gw-defenses-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 900px) {
  .gw-defenses-two-col { grid-template-columns: 1fr; }
}
.gw-defense-section {}
.gw-section-title { margin: 0 0 14px; font-size: 1rem; }
.gw-defense-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}
.gw-defense-slot {
  border-radius: 14px;
  border: 1px solid rgba(100,116,139,0.2);
  background: rgba(15,23,42,0.5);
  padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
  transition: border-color 200ms;
}
.gw-defense-slot--own { border-left: 3px solid rgba(56,189,248,0.3); }
.slot--active { border-color: rgba(74,222,128,0.3); }
.slot--destroyed { border-color: rgba(239,68,68,0.3); opacity: 0.55; }
.slot--empty { border-color: rgba(100,116,139,0.15); }
.gw-slot-header { display: flex; justify-content: space-between; align-items: center; }
.gw-slot-num { font-weight: 800; color: #e2e8f0; }
.gw-slot-status { font-size: 0.72rem; }
.slot--active .gw-slot-status { color: #4ade80; }
.slot--destroyed .gw-slot-status { color: #f87171; }
.slot--empty .gw-slot-status { color: #475569; }
.gw-defense-hint { color: #64748b; font-size: 0.85rem; margin: 0 0 12px; }
.gw-slot-units { display: flex; flex-direction: column; gap: 3px; min-height: 40px; }
.gw-slot-unit-badge { font-size: 0.72rem; color: #94a3b8; background: rgba(100,116,139,0.1); padding: 2px 6px; border-radius: 4px; }
.gw-slot-defender { font-size: 0.68rem; color: #64748b; font-style: italic; margin-top: 2px; }
.gw-slot-empty-label { font-size: 0.75rem; color: #334155; font-style: italic; }
.gw-preset-select {
  margin-top: 8px;
  width: 100%;
  padding: 6px 10px;
  font-size: 0.78rem;
  border-radius: 8px;
  border: 1px solid rgba(100,116,139,0.25);
  background: rgba(15,23,42,0.6);
  color: #e2e8f0;
  cursor: pointer;
}
.gw-preset-select:disabled { opacity: 0.6; cursor: not-allowed; }
.gw-attack-btn, .gw-place-btn { font-size: 0.78rem !important; padding: 5px 10px !important; }

/* ── Attack panel ───────────────────────────────────────────────────────── */
.gw-phase-locked { text-align: center; padding: 30px; color: #64748b; font-size: 1rem; }
.gw-attack-hint { color: #64748b; font-size: 0.875rem; margin: 0 0 16px; }
.gw-sub-label { font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px; }
.gw-target-select { margin-bottom: 20px; }
.gw-target-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.gw-target-slot-btn {
  min-height: 70px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(100,116,139,0.3);
  background: rgba(15,23,42,0.5);
  color: #e2e8f0;
  cursor: pointer;
  position: relative;
  transition: all 150ms;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: 4px;
  overflow: visible;
}
.gw-target-slot-btn:hover:not(:disabled) { border-color: rgba(239,68,68,0.5); background: rgba(239,68,68,0.1); }
.gw-target-slot-btn.selected { border-color: rgba(239,68,68,0.7); background: rgba(239,68,68,0.15); color: #f87171; }
.gw-target-slot-btn.destroyed, .gw-target-slot-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.gw-target-slot-num { font-weight: 800; font-size: 0.9rem; }
.gw-target-slot-defender { font-size: 0.78rem; color: #94a3b8; }
.gw-target-slot-units { font-size: 0.72rem; color: #cbd5e1; line-height: 1.35; }
.gw-target-slot-units em { font-style: normal; color: #64748b; }
.gw-target-unit { white-space: nowrap; }
.gw-destroyed-badge { position: absolute; top: 6px; right: 8px; font-size: 0.7rem; color: #f87171; }
.gw-target-slot-btn.empty .gw-target-slot-num { margin: auto; }

.gw-defense-hover-bubble {
  position: absolute;
  left: 0;
  top: calc(100% + 10px);
  z-index: 40;
  width: min(520px, 82vw);
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(2, 6, 23, 0.97);
  box-shadow: 0 20px 42px rgba(2, 6, 23, 0.65);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-4px);
  transition: opacity 120ms ease, transform 120ms ease;
}
.gw-target-slot-btn:hover .gw-defense-hover-bubble {
  opacity: 1;
  transform: translateY(0);
}
.gw-defense-hover-title {
  font-size: 0.82rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #fca5a5;
  margin-bottom: 4px;
}
.gw-defense-hover-owner {
  color: #e2e8f0;
  font-size: 0.84rem;
  margin-bottom: 8px;
}
.gw-defense-hover-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gw-defense-hover-unit {
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.75);
  padding: 8px 10px;
}
.gw-defense-hover-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.gw-defense-hover-meta {
  color: #cbd5e1;
  font-size: 0.78rem;
}
.gw-defense-hover-spec {
  font-size: 0.72rem;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #7dd3fc;
  padding: 1px 7px;
}
.gw-defense-hover-spec.is-none {
  border-color: rgba(148, 163, 184, 0.35);
  color: #94a3b8;
}
.gw-defense-hover-stats {
  color: #cbd5e1;
  font-size: 0.76rem;
}

/* ── Unit grid ──────────────────────────────────────────────────────────── */
.gw-unit-select { display: flex; flex-direction: column; gap: 14px; }
.gw-unit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
  max-height: 340px;
  overflow-y: auto;
  padding-right: 4px;
}
.gw-unit-grid--modal { max-height: 280px; }
.gw-unit-card {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(100,116,139,0.15);
  background: rgba(15,23,42,0.5);
  cursor: pointer;
  position: relative;
  transition: all 150ms;
}
.gw-unit-card:hover:not(.disabled) { border-color: rgba(56,189,248,0.3); background: rgba(15,23,42,0.72); }
.gw-unit-card.selected { border-color: rgba(56,189,248,0.6); background: rgba(56,189,248,0.08); }
.gw-unit-card.used { opacity: 0.4; cursor: not-allowed; }
.gw-unit-card.disabled { opacity: 0.4; cursor: not-allowed; }
.gw-unit-rarity { width: 6px; height: 36px; border-radius: 3px; flex-shrink: 0; }
.rarity-common { background: #94a3b8; }
.rarity-uncommon { background: #4ade80; }
.rarity-rare { background: #60a5fa; }
.rarity-epic { background: #a78bfa; }
.rarity-legendary { background: #fbbf24; }
.rarity-mythic { background: linear-gradient(180deg, #f472b6, #c084fc); }
.gw-unit-info { flex: 1; min-width: 0; }
.gw-unit-name { display: block; font-size: 0.83rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gw-unit-meta { font-size: 0.72rem; color: #64748b; }
.gw-unit-used-badge { font-size: 0.65rem; color: #f87171; white-space: nowrap; }
.gw-unit-sel-badge { font-size: 0.85rem; color: #38bdf8; }

/* ── Lineup ─────────────────────────────────────────────────────────────── */
.gw-attacker-lineup { display: flex; flex-direction: column; gap: 8px; }
.gw-lineup-grid { display: flex; flex-direction: column; gap: 6px; }
.gw-lineup-unit {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px;
  border-radius: 8px;
  background: rgba(15,23,42,0.5);
  border: 1px solid rgba(100,116,139,0.15);
}
.gw-lineup-name { font-size: 0.82rem; color: #e2e8f0; }
.gw-position-toggle { display: flex; gap: 4px; }
.gw-pos-btn {
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid rgba(100,116,139,0.2);
  background: transparent;
  color: #64748b; font-size: 0.75rem; cursor: pointer;
}
.gw-pos-btn.active { background: rgba(56,189,248,0.15); border-color: rgba(56,189,248,0.4); color: #38bdf8; }
.gw-pos-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.gw-launch-btn { width: 100%; padding: 12px !important; font-size: 1rem !important; }
.gw-spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 6px;
  vertical-align: middle;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Historique ─────────────────────────────────────────────────────────── */
.gw-history-panel, .gw-history-standalone {}
.gw-history-loading { color: #64748b; padding: 20px; text-align: center; }
.gw-history-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.gw-history-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 9px 12px; border-radius: 10px;
  background: rgba(15,23,42,0.5);
  border: 1px solid rgba(100,116,139,0.1);
  border-left: 3px solid rgba(100,116,139,0.3);
}
.gw-history-item.result-win { border-left-color: rgba(74,222,128,0.5); }
.gw-history-item.result-loss { border-left-color: rgba(239,68,68,0.4); }
.gw-history-item.result-draw { border-left-color: rgba(251,191,36,0.5); }
.gw-history-icon { font-size: 1rem; flex-shrink: 0; margin-top: 2px; }
.gw-history-body { flex: 1; }
.gw-history-text { margin: 0 0 3px; font-size: 0.87rem; color: #e2e8f0; }
.gw-history-reward { color: #38bdf8; font-size: 0.85rem; }
.gw-history-time { font-size: 0.74rem; color: #475569; }
.gw-history-standalone { margin-top: 16px; }

/* ── Logs ───────────────────────────────────────────────────────────────── */
.gw-logs-panel {}
.gw-empty-logs { text-align: center; color: #475569; padding: 20px; }
.gw-log-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.gw-log-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 9px 12px; border-radius: 10px;
  background: rgba(15,23,42,0.5);
  border: 1px solid rgba(100,116,139,0.1);
  border-left: 3px solid rgba(100,116,139,0.3);
}
.gw-log-item.result-win { border-left-color: rgba(74,222,128,0.5); }
.gw-log-item.result-loss { border-left-color: rgba(239,68,68,0.4); }
.gw-log-icon { font-size: 1rem; flex-shrink: 0; margin-top: 2px; }
.gw-log-body { flex: 1; }
.gw-log-text { margin: 0 0 3px; font-size: 0.87rem; color: #e2e8f0; }
.gw-log-guild-badge { font-size: 0.75rem; color: #64748b; }
.gw-log-time { font-size: 0.74rem; color: #475569; }

/* ── Modal ──────────────────────────────────────────────────────────────── */
.gw-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
  padding: 16px;
}
.gw-modal {
  background: linear-gradient(180deg, rgba(11,20,40,0.98), rgba(8,13,24,0.98));
  border: 1px solid rgba(125,211,252,0.15);
  border-radius: 20px;
  padding: 24px;
  width: 100%; max-width: 600px;
  max-height: 90vh; overflow-y: auto;
}
.gw-modal h3 { margin: 0 0 6px; }
.gw-modal-hint { color: #64748b; font-size: 0.85rem; margin: 0 0 16px; }
.gw-preset-name-input {
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 12px;
  border-radius: 8px;
  border: 1px solid rgba(100,116,139,0.3);
  background: rgba(15,23,42,0.6);
  color: #e2e8f0;
  font-size: 0.9rem;
}
.gw-propose-btn { margin-bottom: 12px; }
.gw-modal-warn { color: #fbbf24; font-size: 0.85rem; margin: 0 0 12px; }
.gw-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }

/* ── Mes défenses proposées ──────────────────────────────────────────────── */
.gw-my-presets-section { min-width: 0; }
.gw-my-presets-section .gw-propose-btn { margin-bottom: 14px; }
.gw-my-presets-empty {
  color: #64748b; font-size: 0.88rem; padding: 20px; text-align: center;
  background: rgba(100,116,139,0.06); border-radius: 12px; border: 1px dashed rgba(100,116,139,0.2);
}
.gw-my-presets-list { display: flex; flex-direction: column; gap: 10px; }
.gw-my-preset-card {
  background: rgba(15,23,42,0.5);
  border: 1px solid rgba(100,116,139,0.15);
  border-radius: 12px;
  padding: 12px 14px;
  transition: border-color 150ms;
}
.gw-my-preset-card:hover { border-color: rgba(56,189,248,0.2); }
.gw-my-preset-header {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-bottom: 8px;
}
.gw-my-preset-name { font-weight: 600; font-size: 0.9rem; color: #e2e8f0; }
.gw-my-preset-delete {
  width: 28px; height: 28px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid rgba(239,68,68,0.3);
  background: rgba(239,68,68,0.08);
  color: #f87171;
  font-size: 0.85rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 150ms;
}
.gw-my-preset-delete:hover:not(:disabled) {
  background: rgba(239,68,68,0.15);
  border-color: rgba(239,68,68,0.5);
}
.gw-my-preset-delete:disabled { opacity: 0.6; cursor: not-allowed; }
.gw-my-preset-units {
  display: flex; flex-wrap: wrap; gap: 4px;
}
.gw-my-preset-units .gw-slot-unit-badge { font-size: 0.7rem; }

/* ── Toast ──────────────────────────────────────────────────────────────── */
.gw-toast {
  position: fixed; bottom: 24px; right: 24px;
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  z-index: 300;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.gw-toast--success { background: rgba(21,128,61,0.95); color: #bbf7d0; border: 1px solid rgba(74,222,128,0.3); }
.gw-toast--error { background: rgba(127,29,29,0.95); color: #fecaca; border: 1px solid rgba(239,68,68,0.3); }
.gw-toast-enter-active, .gw-toast-leave-active { transition: all 300ms; }
.gw-toast-enter-from, .gw-toast-leave-to { opacity: 0; transform: translateY(10px); }

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (min-width: 720px) {
  .gw-defenses-layout { display: grid; grid-template-columns: 1fr 1fr; }
}
</style>
