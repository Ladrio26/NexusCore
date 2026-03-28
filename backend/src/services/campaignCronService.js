import { getSeasonKey } from './campaignService.js';
import { ensureCampaignMonthGenerated } from './campaignMonthlyService.js';

/**
 * Assure qu’une version mensuelle existe (nouveau mois, premier démarrage après migration).
 * Complète le flux « premier combat du mois » si aucun joueur n’a encore lancé la campagne.
 */
export function startCampaignMonthlyCron() {
  const tick = async () => {
    try {
      await ensureCampaignMonthGenerated(getSeasonKey());
    } catch (e) {
      console.warn('[campaignMonthlyCron]', e?.message || e);
    }
  };
  setTimeout(tick, 10_000);
  setInterval(tick, 6 * 60 * 60 * 1000);
}
