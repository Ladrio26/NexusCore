/**
 * BotRunner.js
 * Scheduler central qui fait tourner tous les bots actifs à intervalle régulier.
 * Chaque tick traite séquentiellement la liste des bots pour éviter la contention DB.
 */

import {
  getActiveBots,
  getBotState,
  saveBotState,
  logBotAction,
} from './BotStateRepository.js';
import { getProfile } from './BotProfiles.js';
import { decide } from './BotDecisionEngine.js';
import { executeAction } from './BotActionExecutor.js';
import { ensureBotTeamPresets, ensureBotPvpDefense } from './BotTeamPlanner.js';
import { ensureBotInGuild } from './BotGuildManager.js';
import { botLog, jitter } from './BotUtils.js';

const DEFAULT_TICK_INTERVAL_MS = 60_000; // 1 minute

let tickInterval = null;
let isRunning    = false;

/**
 * Démarre la boucle de tick du runner.
 * @param {number} [intervalMs=60000] - intervalle entre chaque vague de ticks (ms)
 */
export function startBotRunner(intervalMs = DEFAULT_TICK_INTERVAL_MS) {
  if (isRunning) return;
  isRunning = true;
  botLog(0, 'BotRunner started', { intervalMs });
  // Premier tick après un délai court pour laisser le serveur terminer son démarrage
  setTimeout(() => tickAll(), 10_000);
  tickInterval = setInterval(() => tickAll(), intervalMs);
}

export function stopBotRunner() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  isRunning = false;
  botLog(0, 'BotRunner stopped');
}

export function isBotRunnerRunning() {
  return isRunning;
}

// ── Tick ─────────────────────────────────────────────────────────────────────

async function tickAll() {
  let bots;
  try {
    bots = await getActiveBots();
  } catch (err) {
    console.error('[BotRunner] Failed to load active bots:', err.message);
    return;
  }

  if (!bots.length) return;
  botLog(0, `tickAll: ${bots.length} bot(s) actif(s)`);

  for (const bot of bots) {
    try {
      await processBot(bot.userId, bot.profile);
    } catch (err) {
      console.error(`[BotRunner] Error processing bot ${bot.userId}:`, err.message);
    }
  }
}

async function processBot(userId, profileId) {
  const botState = await getBotState(userId);
  const profile  = getProfile(profileId);
  const now      = Date.now();

  // Respecter le next_action_at global (pause entre deux actions)
  if (botState.nextActionAt && botState.nextActionAt.getTime() > now) {
    return;
  }

  // S'assurer que le bot fait partie de la guilde commune
  try {
    await ensureBotInGuild(userId);
  } catch (err) {
    console.warn(`[BotRunner] ensureBotInGuild failed for bot ${userId}:`, err.message);
  }

  // Générer les presets d'équipe automatiquement si le bot n'en a aucun
  try {
    await ensureBotTeamPresets(userId);
  } catch (err) {
    console.warn(`[BotRunner] ensureBotTeamPresets failed for bot ${userId}:`, err.message);
  }

  // S'assurer que le preset 1 est défini comme défense PvP
  try {
    await ensureBotPvpDefense(userId);
  } catch (err) {
    console.warn(`[BotRunner] ensureBotPvpDefense failed for bot ${userId}:`, err.message);
  }

  let action, result;
  try {
    action = await decide(userId, botState, profile);
  } catch (err) {
    console.error(`[BotRunner] decide() failed for bot ${userId}:`, err.message);
    return;
  }

  botLog(userId, `→ ${action}`);

  try {
    result = await executeAction(userId, action, profile, botState);
  } catch (err) {
    console.error(`[BotRunner] executeAction(${action}) failed for bot ${userId}:`, err.message);
    result = { ok: false, detail: { error: err.message } };
  }

  // Après un summon réussi, reconstruire les presets + défense PvP
  if (action === 'summon' && result.ok) {
    try {
      await ensureBotTeamPresets(userId, { force: true });
      // ensureBotTeamPresets appelle déjà ensureBotPvpDefense en fin de création,
      // mais on force un re-check au cas où la défense aurait été supprimée entre-temps.
      await ensureBotPvpDefense(userId);
      botLog(userId, 'presets + défense PvP reconfigurés après invocation');
    } catch (err) {
      console.warn(`[BotRunner] rebuild presets/defense failed for bot ${userId}:`, err.message);
    }
  }

  botLog(userId, `✓ ${action}`, { ok: result.ok, ...result.detail });

  // Le prochain tick global utilise globalTickCooldownMs (court : quelques minutes).
  // Les cooldowns per-action (botState.cooldowns.xxx) gèrent quand RÉPÉTER la même action.
  const globalCooldownMs = profile.globalTickCooldownMs ?? 2 * 60_000;
  botState.nextActionAt = new Date(now + jitter(globalCooldownMs, 0.2));
  botState.lastActionAt = new Date(now);
  botState.currentAction = action;
  botState.actionCount   = (botState.actionCount ?? 0) + 1;

  await saveBotState(userId, botState);
  await logBotAction(userId, action, result.ok, result.detail);
}

