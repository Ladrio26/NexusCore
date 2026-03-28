/**
 * BotGuildWarPlanner.js
 * Vérifie la disponibilité et exécute une attaque de guerre de guilde pour le bot.
 */

import { query } from '../config/db.js';
import {
  getCurrentWarForUser,
  getWarDefenses,
  getUsedUnitIds,
  prepareWarAttack,
  finalizeWarAttack,
} from '../services/guildWarService.js';
import {
  buildTeamFromDb,
  getSelectedNoyau,
  applyNoyauBonus,
} from '../services/battleTeamService.js';
import { simulateBattle } from '../../../core/combatEngine.js';
import { applyCombatStats } from '../services/combatStatsService.js';
import { botLog } from './BotUtils.js';

/**
 * Vérifie si le bot peut attaquer en guerre de guilde :
 *  - guerre en phase "attack"
 *  - défenses adverses non détruites
 *  - unités disponibles (non encore utilisées dans cette guerre)
 */
export async function canAttackGuildWar(userId) {
  try {
    const war = await getCurrentWarForUser(userId);
    if (!war || war.status !== 'attack') return false;

    const membership = await query(
      'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
      [Number(userId)]
    );
    if (!membership.length) return false;

    const guildId      = Number(membership[0].guild_id);
    const targetGuildId = guildId === war.guild_a_id ? war.guild_b_id : war.guild_a_id;

    const defenses     = await getWarDefenses(war.id);
    const enemySlots   = defenses.filter((d) => Number(d.guild_id) === targetGuildId && !d.is_destroyed);
    if (!enemySlots.length) return false;

    const usedIds      = await getUsedUnitIds(war.id, userId);
    const excludeClause = usedIds.length
      ? `AND uu.id NOT IN (${usedIds.map(() => '?').join(',')})`
      : '';
    const owned = await query(
      `SELECT uu.id FROM user_units uu WHERE uu.user_id = ? ${excludeClause} LIMIT 1`,
      usedIds.length ? [Number(userId), ...usedIds] : [Number(userId)]
    );
    return owned.length > 0;
  } catch {
    return false;
  }
}

/**
 * Exécute une attaque de guerre de guilde pour le bot.
 * Choisit une défense ennemie aléatoire et sélectionne jusqu'à 4 unités disponibles.
 * Retourne { success, warId, slotIndex } ou null si l'attaque est impossible.
 */
export async function executeWarAttack(userId) {
  const war = await getCurrentWarForUser(userId);
  if (!war || war.status !== 'attack') return null;

  const membership = await query(
    'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
    [Number(userId)]
  );
  if (!membership.length) return null;

  const guildId       = Number(membership[0].guild_id);
  const targetGuildId = guildId === war.guild_a_id ? war.guild_b_id : war.guild_a_id;

  const defenses    = await getWarDefenses(war.id);
  const enemySlots  = defenses.filter((d) => Number(d.guild_id) === targetGuildId && !d.is_destroyed);
  if (!enemySlots.length) return null;

  // Cible aléatoire parmi les défenses adverses disponibles
  const target = enemySlots[Math.floor(Math.random() * enemySlots.length)];

  const usedIds = await getUsedUnitIds(war.id, userId);
  const excludeClause = usedIds.length
    ? `AND uu.id NOT IN (${usedIds.map(() => '?').join(',')})`
    : '';

  // Charge jusqu'à 4 unités disponibles avec leur archétype pour assigner front/back
  const availableRows = await query(
    `SELECT uu.id, u.archetype
     FROM user_units uu
     JOIN units u ON u.id = uu.unit_id
     WHERE uu.user_id = ? ${excludeClause}
     ORDER BY RAND()
     LIMIT 4`,
    usedIds.length ? [Number(userId), ...usedIds] : [Number(userId)]
  );
  if (!availableRows.length) return null;

  // Position selon archétype (CAC→front, Distance→back)
  const attackerUnits = availableRows.map((r) => {
    const arch  = String(r.archetype || '').toUpperCase();
    const isCac = arch === 'CAC_TANK' || arch === 'CAC_DPS';
    return { user_unit_id: Number(r.id), position: isCac ? 'front' : 'back' };
  });

  let prepData;
  try {
    prepData = await prepareWarAttack(
      userId,
      war.id,
      Number(target.slot_index),
      attackerUnits
    );
  } catch (err) {
    botLog(userId, 'guildwar_prepare_failed', { error: err.message });
    return null;
  }

  if (!prepData.defenderUserId || !prepData.defenderSlots?.length) return null;

  let teamA, teamB;
  try {
    teamA = await buildTeamFromDb(userId, prepData.attackerSlots);
    teamB = await buildTeamFromDb(prepData.defenderUserId, prepData.defenderSlots);
  } catch (err) {
    botLog(userId, 'guildwar_build_team_failed', { error: err.message });
    return null;
  }
  if (!teamA?.length || !teamB?.length) return null;

  // Guerre de guilde : pas de fatigue
  const noyauA = getSelectedNoyau(teamA, 0);
  applyNoyauBonus(teamA, noyauA);
  for (const u of teamA) u.fatigue = 0;

  const noyauB = getSelectedNoyau(teamB, 0);
  applyNoyauBonus(teamB, noyauB);
  for (const u of teamB) u.fatigue = 0;

  const seed = Date.now() % 2_147_483_647;
  const log  = simulateBattle(teamA, teamB, { seed });
  const won  = log.summary?.winner === 'A';

  const attackerUnitIds = prepData.attackerSlots
    .map((s) => Number(s.user_unit_id))
    .filter(Boolean);

  try {
    await finalizeWarAttack(
      war.id,
      userId,
      prepData.attackerGuildId,
      prepData.targetSlotIndex,
      prepData.targetGuildId,
      attackerUnitIds,
      won
    );
  } catch (err) {
    botLog(userId, 'guildwar_finalize_failed', { error: err.message });
  }

  try {
    await applyCombatStats({ userUnitIds: attackerUnitIds, winner: won ? 'win' : 'loss', combatStats: {} });
  } catch { /* non-critique */ }

  return { success: won, warId: war.id, slotIndex: prepData.targetSlotIndex };
}
