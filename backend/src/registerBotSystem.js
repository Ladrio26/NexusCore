/**
 * registerBotSystem.js
 * Bootstrap du système de bots — à appeler depuis app.js.
 *
 * Activation : ajouter BOT_SYSTEM_ENABLED=true dans backend/.env
 * Intervalle optionnel : BOT_TICK_INTERVAL_MS=60000
 * Spawner auto : BOT_AUTO_SPAWN=true pour créer 1 bot toutes les 6 h
 */

import { startBotRunner } from './bots/BotRunner.js';
import { startAutoSpawner } from './bots/BotAutoSpawner.js';

export function registerBotSystem() {
  const enabled = process.env.BOT_SYSTEM_ENABLED === 'true'
    || process.env.BOT_SYSTEM_ENABLED === '1';

  if (!enabled) {
    console.log('[BotSystem] Désactivé. Définir BOT_SYSTEM_ENABLED=true pour activer.');
    return;
  }

  const intervalMs = Number(process.env.BOT_TICK_INTERVAL_MS) || 60_000;
  console.log(`[BotSystem] Démarrage du runner (intervalle: ${intervalMs}ms)`);
  startBotRunner(intervalMs);

  const autoSpawn = process.env.BOT_AUTO_SPAWN === 'true'
    || process.env.BOT_AUTO_SPAWN === '1';

  if (autoSpawn) {
    startAutoSpawner();
  }
}
