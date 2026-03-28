/**
 * BotDecisionEngine.js
 * Arbre de décision du bot — l’ordre des actions suit profile.actionPriority
 * (défaut + surcharges base de données via BotProfiles).
 */

import { getWallet } from '../services/gachaService.js';
import { getBotMinMaxFatigue, isBestTeamFullyAtLevel, getUnspecializedMaxLevelUnits } from './BotTeamPlanner.js';
import { getEquipPlan, getUpgradePlan } from './BotArtifactPlanner.js';
import { canAttackGuildWar } from './BotGuildWarPlanner.js';
import { canDoPvp } from './BotPvpPlanner.js';
import { isActionReady } from './BotStateRepository.js';
import { DEFAULT_ACTION_PRIORITY } from './BotProfiles.js';

/**
 * @param {number} userId
 * @param {object} botState
 * @param {object} profile
 * @returns {Promise<string>}
 */
export async function decide(userId, botState, profile) {
  const order = Array.isArray(profile?.actionPriority) ? profile.actionPriority : [...DEFAULT_ACTION_PRIORITY];

  for (const step of order) {
    switch (step) {
      case 'summon': {
        if (!isActionReady(botState, 'summon')) break;
        try {
          const wallet = await getWallet(userId);
          const canSummon =
            wallet.credits >= 100 ||
            wallet.cores >= 10 ||
            wallet.fragments >= 100 ||
            wallet.divine_credits >= 100 ||
            wallet.divine_cores >= 10 ||
            wallet.divine_fragments >= 100;
          if (canSummon) return 'summon';
        } catch {
          /* continuer */
        }
        break;
      }
      case 'specialize': {
        if (!isActionReady(botState, 'specialize')) break;
        try {
          const toSpecialize = await getUnspecializedMaxLevelUnits(userId);
          if (toSpecialize.length > 0) return 'specialize';
        } catch {
          /* continuer */
        }
        break;
      }
      case 'equip': {
        if (!isActionReady(botState, 'artifactEquip')) break;
        try {
          const plan = await getEquipPlan(userId);
          if (plan.length > 0) return 'equip';
        } catch {
          /* continuer */
        }
        break;
      }
      case 'upgrade': {
        if (!isActionReady(botState, 'artifactUpgrade')) break;
        try {
          const plan = await getUpgradePlan(userId, profile.maxArtifactUpgradeLevel);
          if (plan.length > 0) return 'upgrade';
        } catch {
          /* continuer */
        }
        break;
      }
      case 'guildWar': {
        if (!isActionReady(botState, 'guildWarAttack')) break;
        try {
          if (await canAttackGuildWar(userId)) return 'guildWar';
        } catch {
          /* continuer */
        }
        break;
      }
      case 'campaign': {
        const minFatigue = await getBotMinMaxFatigue(userId).catch(() => null);
        if (minFatigue === null || minFatigue >= profile.maxFatigueForCombat) break;
        if (isActionReady(botState, 'campaignBattle')) return 'campaign';
        break;
      }
      case 'dungeon': {
        const minFatigue = await getBotMinMaxFatigue(userId).catch(() => null);
        if (minFatigue === null || minFatigue >= profile.maxFatigueForCombat) break;
        const dungeonEligible =
          isActionReady(botState, 'dungeonBattle') &&
          (await isBestTeamFullyAtLevel(userId, 50).catch(() => false));
        if (dungeonEligible) return 'dungeon';
        break;
      }
      case 'pvp': {
        if (!isActionReady(botState, 'pvpBattle')) break;
        try {
          if (await canDoPvp(userId)) return 'pvp';
        } catch {
          /* continuer */
        }
        break;
      }
      case 'idle':
        return 'idle';
      default:
        break;
    }
  }

  return 'idle';
}
