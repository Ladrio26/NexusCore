/**
 * BotPvpPlanner.js
 * Vérifie la disponibilité PvP et exécute un combat PvP pour le bot.
 *
 * Note : les combats contre des PNJ ne sont pas supportés pour les bots
 * (pvpNpcService nécessite une intégration dédiée — voir TODO ci-dessous).
 * Le bot skippe le PvP si seuls des PNJ sont disponibles.
 */

import { query } from '../config/db.js';
import {
  findOpponent,
  getPresetSlots,
  recordPvpBattle,
  grantPvpXp,
  getPlayerElo,
} from '../services/pvpService.js';
import { generateNpcDefense } from '../services/pvpNpcService.js';
import {
  buildTeamFromDb,
  getSelectedNoyau,
  applyNoyauBonus,
} from '../services/battleTeamService.js';
import { grantCombatArtifactRewards } from '../services/artifactService.js';
import { applyCombatStats } from '../services/combatStatsService.js';
import { simulateBattle } from '../../../core/combatEngine.js';
import { botLog } from './BotUtils.js';

/**
 * Retourne true si le bot a au moins un preset d'équipe valide.
 * Les bots n'ont pas de limite d'énergie PvP.
 */
export async function canDoPvp(userId) {
  try {
    const rows = await query(
      `SELECT 1 FROM user_team_presets
       WHERE user_id = ?
         AND (JSON_LENGTH(COALESCE(front_slots,'[]')) + JSON_LENGTH(COALESCE(back_slots,'[]'))) > 0
       LIMIT 1`,
      [Number(userId)]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Exécute un combat PvP pour le bot.
 * Retourne { success, eloAfter } ou null si impossible.
 *
 * TODO: Ajouter le support des combats PNJ en important pvpNpcService.generateNpcTeam(elo).
 *       Pour l'instant le bot skip le PvP si aucun joueur humain n'est trouvé.
 */
export async function executePvpBattle(userId) {
  // Récupérer le premier preset valide du bot
  let attackerSlotsData = null;
  for (let i = 1; i <= 5; i++) {
    const sd = await getPresetSlots(userId, i);
    if (sd?.slots?.length) { attackerSlotsData = sd; break; }
  }
  if (!attackerSlotsData) return null;

  const eloBefore = await getPlayerElo(userId);

  // Trouver un adversaire (joueur ou PNJ selon le rang Elo)
  const opponent  = await findOpponent(userId);
  const isNpc     = opponent.defender_type !== 'player' || !opponent.defender_id;

  // Construire l'équipe attaquante
  let teamA;
  try {
    teamA = await buildTeamFromDb(userId, attackerSlotsData.slots);
  } catch (err) {
    botLog(userId, 'pvp_build_attacker_failed', { error: err.message });
    return null;
  }
  if (!teamA?.length) return null;

  const noyauA = getSelectedNoyau(teamA, attackerSlotsData.selected_noyau_index ?? 0);
  applyNoyauBonus(teamA, noyauA);

  // Construire l'équipe défenseure (joueur ou PNJ généré)
  let teamB;
  if (isNpc) {
    teamB = await generateNpcDefense(eloBefore);
  } else {
    const defPreset = opponent.preset_id
      ? await getPresetSlots(opponent.defender_id, opponent.preset_id)
      : null;
    if (!defPreset?.slots?.length) return null;
    try {
      teamB = await buildTeamFromDb(opponent.defender_id, defPreset.slots);
    } catch (err) {
      botLog(userId, 'pvp_build_defender_failed', { error: err.message });
      return null;
    }
    if (teamB?.length) {
      const noyauB = getSelectedNoyau(teamB, 0);
      applyNoyauBonus(teamB, noyauB);
    }
  }
  if (!teamB?.length) return null;

  // Les bots ne consomment pas d'énergie PvP (aucune limite pour eux)

  const defEloBefore = Number(opponent.pvp_elo ?? eloBefore);
  const seed         = Date.now() % 2_147_483_647;
  const log          = simulateBattle(teamA, teamB, { seed });
  const won          = log.summary?.winner === 'A';

  const { attackerEloAfter } = await recordPvpBattle(
    userId,
    isNpc ? null : opponent.defender_id,
    isNpc ? 'npc' : 'player',
    won,
    eloBefore,
    false,
    defEloBefore
  );

  const attackerUnitIds = attackerSlotsData.slots
    .map((s) => Number(s.user_unit_id))
    .filter(Boolean);

  if (won) {
    await grantPvpXp(attackerUnitIds, true).catch(() => {});
  }

  await grantCombatArtifactRewards(userId, {
    victory:      won,
    creditsBonus: won ? 3 : 0,
    battleType:   'pvp',
  }).catch(() => {});

  await applyCombatStats({
    userUnitIds: attackerUnitIds,
    winner:      won ? 'win' : 'loss',
    combatStats: {},
  }).catch(() => {});

  if (!isNpc && opponent.defender_id) {
    await query(
      'UPDATE users SET last_opponent_id = ? WHERE id = ?',
      [opponent.defender_id, Number(userId)]
    ).catch(() => {});
  }

  return { success: won, eloAfter: attackerEloAfter };
}
