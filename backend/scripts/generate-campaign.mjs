/**
 * Génération complète de la campagne (Normal + Hard).
 * À lancer depuis la racine du projet :
 *   node backend/scripts/generate-campaign.mjs
 */
import { generateCampaign } from '../src/services/campaignGenerator.js';

const seed = process.env.CAMPAIGN_SEED || 'NEXUS_CAMPAIGN_V1';

const main = async () => {
  const fights = await generateCampaign(seed);
  // On affiche le JSON complet sur stdout.
  console.log(JSON.stringify({ seed, fights }, null, 2));
};

main().catch((err) => {
  console.error('[generate-campaign] Error:', err);
  process.exit(1);
});

