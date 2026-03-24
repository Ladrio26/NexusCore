/**
 * Service de statistiques de combat par unité joueur.
 * Met à jour combat_kills, combat_victories, combat_defeats, combat_damage_dealt, combat_healing_done.
 */
import { query } from '../config/db.js';

const BATTLE_EVENT = {
  DAMAGE: 'DAMAGE',
  HEAL: 'HEAL',
  DEATH: 'DEATH'
};

/**
 * Parse le battleLog pour extraire kills, damage, healing par user_unit_id (équipe A uniquement).
 * @param {Array} battleLog - Entrées du journal (type, sourceId, targetId, value)
 * @param {number} teamASize - Nombre d'unités équipe A (indices 0..teamASize-1)
 * @param {Array<{ user_unit_id: number }>} teamASlots - Slots équipe A ordonnés (index i = combatIndex i)
 * @returns {Record<number, { kills: number, damage: number, healing: number }>}
 */
export function parseCombatStatsFromBattleLog(battleLog, teamASize, teamASlots) {
  return parseCombatStatsFromBattleLogBothTeams(battleLog, teamASize, teamASlots, 0, []).teamA;
}

/**
 * Parse le battleLog pour les deux équipes (ranked).
 * @returns {{ teamA: Record<number, { kills, damage, healing }>, teamB: Record<number, { kills, damage, healing }> }}
 */
export function parseCombatStatsFromBattleLogBothTeams(battleLog, teamASize, teamASlots, teamBSize, teamBSlots) {
  const teamAIds = (teamASlots || []).map((s) => Number(s.id ?? s.user_unit_id)).filter(Boolean);
  const teamBIds = (teamBSlots || []).map((s) => Number(s.id ?? s.user_unit_id)).filter(Boolean);

  const toUid = (idx, isTeamA) => {
    if (idx == null || idx < 0) return null;
    if (isTeamA && idx < teamASize) return teamAIds[idx] ?? null;
    if (!isTeamA && idx < teamBSize) return teamBIds[idx] ?? null;
    return null;
  };

  const statsA = {};
  const statsB = {};
  let lastDamageByTarget = {};

  for (const ev of battleLog || []) {
    const type = ev?.type;
    const src = ev?.sourceId;
    const tgt = ev?.targetId;
    const val = ev?.value ?? ev?.meta?.amount ?? ev?.meta?.effectiveDamage ?? 0;
    const srcIdx = typeof src === 'number' ? src : (typeof src === 'string' && /^\d+$/.test(String(src)) ? parseInt(String(src), 10) : null);
    const tgtIdx = typeof tgt === 'number' ? tgt : (typeof tgt === 'string' && /^\d+$/.test(String(tgt)) ? parseInt(String(tgt), 10) : null);

    const srcIsA = srcIdx != null && srcIdx < teamASize;
    const srcIsB = srcIdx != null && srcIdx >= teamASize && srcIdx < teamASize + teamBSize;
    const srcIdxB = srcIsB ? srcIdx - teamASize : null;

    if (type === BATTLE_EVENT.DAMAGE && srcIdx != null && Number(val) > 0) {
      lastDamageByTarget[tgtIdx] = { sourceId: srcIdx };
      if (srcIsA) {
        const uid = toUid(srcIdx, true);
        if (uid) { statsA[uid] = statsA[uid] || { kills: 0, damage: 0, healing: 0 }; statsA[uid].damage += Number(val) || 0; }
      }
      if (srcIsB) {
        const uid = toUid(srcIdxB, false);
        if (uid) { statsB[uid] = statsB[uid] || { kills: 0, damage: 0, healing: 0 }; statsB[uid].damage += Number(val) || 0; }
      }
    }
    if (type === BATTLE_EVENT.HEAL && srcIdx != null && Number(val) > 0) {
      if (srcIsA) {
        const uid = toUid(srcIdx, true);
        if (uid) { statsA[uid] = statsA[uid] || { kills: 0, damage: 0, healing: 0 }; statsA[uid].healing += Number(val) || 0; }
      }
      if (srcIsB) {
        const uid = toUid(srcIdxB, false);
        if (uid) { statsB[uid] = statsB[uid] || { kills: 0, damage: 0, healing: 0 }; statsB[uid].healing += Number(val) || 0; }
      }
    }
    if (type === BATTLE_EVENT.DEATH && tgtIdx != null) {
      const last = lastDamageByTarget[tgtIdx];
      if (last) {
        const kIdx = last.sourceId;
        const kIsA = kIdx < teamASize;
        const kIsB = kIdx >= teamASize && kIdx < teamASize + teamBSize;
        const kIdxB = kIsB ? kIdx - teamASize : null;
        if (kIsA) {
          const uid = toUid(kIdx, true);
          if (uid) { statsA[uid] = statsA[uid] || { kills: 0, damage: 0, healing: 0 }; statsA[uid].kills += 1; }
        }
        if (kIsB) {
          const uid = toUid(kIdxB, false);
          if (uid) { statsB[uid] = statsB[uid] || { kills: 0, damage: 0, healing: 0 }; statsB[uid].kills += 1; }
        }
      }
      delete lastDamageByTarget[tgtIdx];
    }
  }
  return { teamA: statsA, teamB: statsB };
}

/**
 * Applique les statistiques de combat après une bataille.
 * @param {Object} opts
 * @param {number[]} opts.userUnitIds - Toutes les unités joueur ayant participé
 * @param {'win'|'loss'|'draw'} opts.winner
 * @param {Record<number, { kills?: number, damage?: number, healing?: number }>} [opts.combatStats] - Stats par user_unit_id (optionnel)
 */
export async function applyCombatStats({ userUnitIds, winner, combatStats = {} }) {
  try {
    const ids = Array.isArray(userUnitIds) ? userUnitIds.map(Number).filter(Boolean) : [];
    if (ids.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[combatStats] applyCombatStats skippé: userUnitIds vide');
      }
      return;
    }

    const isWin = winner === 'win';
    const isLoss = winner === 'loss';

    let updatedCount = 0;
    for (const uid of ids) {
      const inc = { victories: 0, defeats: 0, kills: 0, damage: 0, healing: 0 };
      if (isWin) inc.victories = 1;
      if (isLoss) inc.defeats = 1;
      const extra = combatStats[uid] ?? combatStats[String(uid)];
      if (extra && typeof extra === 'object') {
        inc.kills += Math.max(0, Math.floor(Number(extra.kills) || 0));
        inc.damage += Math.max(0, Math.floor(Number(extra.damage) || 0));
        inc.healing += Math.max(0, Math.floor(Number(extra.healing) || 0));
      }
      if (inc.victories || inc.defeats || inc.kills || inc.damage || inc.healing) {
        await query(
          `UPDATE user_units SET
            combat_victories = combat_victories + ?,
            combat_defeats = combat_defeats + ?,
            combat_kills = combat_kills + ?,
            combat_damage_dealt = combat_damage_dealt + ?,
            combat_healing_done = combat_healing_done + ?
          WHERE id = ?`,
          [inc.victories, inc.defeats, inc.kills, inc.damage, inc.healing, uid]
        );
        updatedCount++;
      }
    }
    if (process.env.NODE_ENV !== 'production' && updatedCount > 0) {
      console.debug('[combatStats] applyCombatStats OK:', { idsCount: ids.length, updatedCount, winner });
    }
  } catch (err) {
    console.error('[combatStatsService] applyCombatStats failed:', err?.message || err);
    throw err;
  }
}
