/**
 * guildWarCronService.js
 *
 * Gère le cycle quotidien des Guerres de Guilde (heure de Paris) :
 *   00:00 Paris → résolution des guerres de la veille + nouveau matchmaking
 *   12:00 Paris → transition vers la phase d'attaque
 *
 * S'appuie sur un setInterval toutes les 60 secondes.
 * Les opérations sont idempotentes (re-exécutables sans doublon).
 */
import { getParisHour, getParisMinute, getParisDateKey } from '../utils/parisTime.js';
import {
  runDailyMatchmaking,
  resolveFinishedWars,
  transitionToAttackPhase
} from './guildWarService.js';

let cronTimer = null;

// Mémorise la dernière exécution pour éviter les doublons dans la même minute
let lastMidnightRun = null;
let lastNoonRun = null;

async function tick() {
  try {
    const now = new Date();
    const dateKey = getParisDateKey(now);
    const hour = getParisHour(now);
    const minute = getParisMinute(now);

    // ─ 00:00 Paris : résolution + matchmaking ────────────────────────────────
    if (hour === 0 && minute < 5) {
      const midnightKey = `${dateKey}-midnight`;
      if (lastMidnightRun !== midnightKey) {
        lastMidnightRun = midnightKey;
        try {
          const resolveResult = await resolveFinishedWars();
          console.log(`[GuildWarCron] Résolution : ${resolveResult.resolved} guerres terminées.`);
        } catch (err) {
          console.error('[GuildWarCron] Erreur résolution :', err.message);
        }
        try {
          const matchResult = await runDailyMatchmaking();
          console.log(`[GuildWarCron] Matchmaking : ${matchResult.matched} paires créées.`);
        } catch (err) {
          console.error('[GuildWarCron] Erreur matchmaking :', err.message);
        }
      }
    }

    // ─ 12:00 Paris : transition vers la phase d'attaque ─────────────────────
    if (hour === 12 && minute < 5) {
      const noonKey = `${dateKey}-noon`;
      if (lastNoonRun !== noonKey) {
        lastNoonRun = noonKey;
        try {
          const transResult = await transitionToAttackPhase();
          console.log(`[GuildWarCron] Transition attaque : ${transResult.updated} guerres mises à jour.`);
        } catch (err) {
          console.error('[GuildWarCron] Erreur transition :', err.message);
        }
      }
    }

    // Vérification continue : résoudre les guerres dont end_time est passé
    // (au cas où le cron de minuit aurait manqué)
    if (minute === 0) {
      try {
        await transitionToAttackPhase();
        await resolveFinishedWars();
      } catch {
        // Silencieux - déjà logué plus haut si critique
      }
    }
  } catch (err) {
    console.error('[GuildWarCron] Erreur inattendue :', err.message);
  }
}

export function startGuildWarCron() {
  if (cronTimer) return;
  console.log('[GuildWarCron] Démarrage du cron de guerre de guilde (interval: 60s).');
  // Premier tick immédiat pour traiter les transitions manquées au redémarrage
  void transitionToAttackPhase().catch(() => {});
  void resolveFinishedWars().catch(() => {});
  cronTimer = setInterval(tick, 60_000);
}

export function stopGuildWarCron() {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
  }
}
