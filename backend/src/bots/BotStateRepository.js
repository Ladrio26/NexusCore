/**
 * BotStateRepository.js
 * Accès DB pour l'état runtime des bots et les logs d'actions.
 */

import { query } from '../config/db.js';
import { parseJsonSafe, parseSqlDateUtc, toMysqlDatetime } from './BotUtils.js';

/**
 * Charge l'état runtime d'un bot depuis bot_runtime_state.
 * Retourne un objet état initialisé avec des valeurs par défaut si absent.
 */
export async function getBotState(botUserId) {
  const rows = await query(
    `SELECT current_action, next_action_at, cooldowns_json, dungeon_state_json,
            last_action_at, action_count
     FROM bot_runtime_state WHERE user_id = ?`,
    [Number(botUserId)]
  );
  if (!rows.length) {
    return {
      userId: Number(botUserId),
      currentAction: null,
      nextActionAt: null,
      cooldowns: {},
      dungeonState: {},
      lastActionAt: null,
      actionCount: 0,
    };
  }
  const r = rows[0];
  const rawGameState = parseJsonSafe(r.dungeon_state_json, {});
  // campaignBlocked est colocalisé dans dungeon_state_json pour éviter une migration DB
  const { campaignBlocked: cb, ...dungeonState } = rawGameState;
  return {
    userId: Number(botUserId),
    currentAction: r.current_action ?? null,
    nextActionAt: parseSqlDateUtc(r.next_action_at),
    cooldowns: parseJsonSafe(r.cooldowns_json, {}),
    dungeonState,
    campaignBlocked: cb ?? null,
    lastActionAt: parseSqlDateUtc(r.last_action_at),
    actionCount: Number(r.action_count ?? 0),
  };
}

/** Persiste l'état runtime du bot (upsert). */
export async function saveBotState(botUserId, state) {
  await query(
    `INSERT INTO bot_runtime_state
       (user_id, current_action, next_action_at, cooldowns_json, dungeon_state_json, last_action_at, action_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       current_action    = VALUES(current_action),
       next_action_at    = VALUES(next_action_at),
       cooldowns_json    = VALUES(cooldowns_json),
       dungeon_state_json = VALUES(dungeon_state_json),
       last_action_at    = VALUES(last_action_at),
       action_count      = VALUES(action_count)`,
    [
      Number(botUserId),
      state.currentAction ?? null,
      toMysqlDatetime(state.nextActionAt),
      JSON.stringify(state.cooldowns ?? {}),
      // campaignBlocked est stocké dans le même blob que dungeonState (pas de migration DB requise)
      JSON.stringify({ ...(state.dungeonState ?? {}), ...(state.campaignBlocked ? { campaignBlocked: state.campaignBlocked } : {}) }),
      toMysqlDatetime(state.lastActionAt),
      state.actionCount ?? 0,
    ]
  );
}

/** Enregistre une ligne dans bot_action_logs. Non bloquant (erreur ignorée). */
export async function logBotAction(botUserId, action, success, detail = {}) {
  try {
    await query(
      `INSERT INTO bot_action_logs (user_id, action, success, detail_json, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [Number(botUserId), action, success ? 1 : 0, JSON.stringify(detail)]
    );
  } catch {
    /* non-critique */
  }
}

/** Retourne la liste de tous les bots actifs avec leur profil. */
export async function getActiveBots() {
  const rows = await query(
    `SELECT bp.user_id, bp.profile
     FROM bot_profiles bp
     JOIN users u ON u.id = bp.user_id
     WHERE bp.enabled = 1`,
    []
  );
  return rows.map((r) => ({ userId: Number(r.user_id), profile: r.profile }));
}

/** Retourne l'identifiant de profil d'un bot, ou null si non trouvé. */
export async function getBotProfileId(botUserId) {
  const rows = await query(
    'SELECT profile FROM bot_profiles WHERE user_id = ?',
    [Number(botUserId)]
  );
  return rows[0]?.profile ?? null;
}

// ── Helpers cooldowns ────────────────────────────────────────────────────────

/** Retourne true si le cooldown pour actionKey est écoulé (ou absent). */
export function isActionReady(botState, actionKey) {
  const ts = botState.cooldowns?.[actionKey];
  if (!ts) return true;
  return Date.now() >= Number(ts);
}

/**
 * Enregistre un cooldown pour une clé d'action.
 * @param {object} botState - état runtime (modifié en place)
 * @param {string} actionKey - clé d'action (ex: 'campaignBattle')
 * @param {number} delayMs - durée du cooldown en ms à partir de maintenant
 */
export function setCooldown(botState, actionKey, delayMs) {
  if (!botState.cooldowns) botState.cooldowns = {};
  botState.cooldowns[actionKey] = Date.now() + delayMs;
}
