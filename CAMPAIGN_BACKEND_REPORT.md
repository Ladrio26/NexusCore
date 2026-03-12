# Rapport Backend Campagne

## 1. Tables (migration `database/migrate_campaign.sql`)

| Table | Rôle |
|-------|------|
| **campaign_stages** | Templates des stages : chapitre (1–10), stage (1–10), is_boss, enemy_template (JSON pour 1–9), boss_unit_code (stage 10), normal_multiplier, hard_multiplier. UNIQUE(chapter, stage). |
| **campaign_boss_modifiers** | Modifiers boss par chapitre/stage 10 : normal_modifier (JSON), hard_modifier (JSON). UNIQUE(chapter, stage). |
| **campaign_rewards** | Récompenses par chapitre, stage, mode (normal/hard) : credits, cores, fragments, ascension_essence. UNIQUE(chapter, stage, mode). |
| **campaign_progress_normal** | Progression par user : user_id, chapter, stage, cleared, reward_claimed, cleared_at. PK (user_id, chapter, stage). |
| **campaign_progress_hard** | Progression Hard mensuelle : user_id, season_key (YYYY-MM), chapter, stage, cleared, reward_claimed, cleared_at. PK (user_id, season_key, chapter, stage). |

## 2. Seeds (`database/seeds_campaign.sql`)

- **Units** : 10 boss `BOSS_CH1_10` … `BOSS_CH10_10` (legendary, rôles/éléments variés, skill_data basique).
- **campaign_stages** : 10×10 stages ; stages 1–9 avec enemy_template (3→6 unités), stage 10 is_boss + boss_unit_code ; multiplicateurs `1 + chapter*0.15 + stage*0.03` et ×1.6 pour hard.
- **campaign_boss_modifiers** : 10 lignes (ch 1–10, stage 10), mécaniques distinctes (damageReductionPct, immuneDebuffs, shieldEveryNActions, atbOnHit, silenceEveryNActions, phase2). Hard avec `variantKey` A|B|C (choix déterministe mensuel).
- **campaign_rewards** : Normal — stages 1–9 credits/cores/fragments croissants, stage 10 essence=1 ; Hard — idem plus élevés, essence=1 uniquement boss ch 1–5 (5/mois), ch 6–10 essence=0.

## 3. Endpoints (routes protégées auth)

| Méthode | Route | Description |
|---------|--------|-------------|
| **GET** | `/campaign/status?mode=normal\|hard` | Statut campagne : unlocked, requiredUnits, chapters[1..10].stages (cleared, rewardClaimed, available, isBoss). Si non débloqué → 403 `{ error: "CAMPAIGN_LOCKED", requiredUnits: 5 }`. |
| **POST** | `/campaign/start` | Body : `{ mode, chapter, stage, team: [ { user_unit_id, position } ] }`. Vérifie ≥5 unités, stage available, construit équipes, lance `simulateBattle` avec seed déterministe et bossModifier. Réponse : `{ success, winner, battleLog, rewardsGranted, rewardsPreview, progressUpdated, wallet }`. |

- **Seed déterministe** : Normal = hash(userId + chapter + stage) ; Hard = hash(userId + seasonKey + chapter + stage + variantKey).
- **Victoire** : XP aux survivants (toujours), fatigue +6 aux unités utilisées, first clear → applyRewardsTransaction + markProgress.

## 4. Logique first clear vs XP répétable

- **Récompenses (credits, cores, fragments, ascension_essence)** : données **une seule fois** par stage (first clear). `computeStageRewards` retourne les rewards tant qu’il n’existe pas de ligne de progression avec `reward_claimed = 1` pour ce stage/mode/saison.
- **XP** : **toujours** accordée à chaque victoire aux survivants (120 XP trash / 200 boss en normal, ×1.5 en hard), via `grantCampaignXp` → `xpService.grantXpToSurvivors`.

## 5. Hard reset via season_key

- **season_key** = `YYYY-MM` (mois courant). Calcul : `getSeasonKey()`.
- Progression Hard stockée par (user_id, **season_key**, chapter, stage). Le 1er du mois, un nouveau season_key est utilisé : les stages Hard sont à refaire, les récompenses first clear sont à nouveau disponibles pour ce mois.
- **Variant Hard** : `getHardVariantKey(seasonKey, chapter)` retourne "A"|"B"|"C" de façon déterministe (hash sur seasonKey+chapter). Utilisé dans le seed et dans les modifiers (ex. n différent pour shieldEveryNActions selon variant).

## 6. Boss modifiers supportés (V1) dans `core/combatEngine.js`

- **state** : `bossModifier`, `bossUid`, `bossPhase2`, `counters.bossActions`, `logEvent`.
- **damageReductionPct** : réduction des dégâts subis par le boss (appliquée dans `applyDamageToTarget`).
- **immuneDebuffs** : si true, les APPLY_DEBUFF sur le boss sont ignorés (skill consommée, pas d’effet).
- **shieldEveryNActions** : tous les N actions du boss, application d’un shield (pctMaxHp × maxHp). Event `BOSS_TRIGGER` subType `shieldEveryNActions`.
- **atbOnHit** : quand le boss reçoit un coup, +amount ATB.
- **silenceEveryNActions** : tous les N actions du boss, application de SILENCE (duration) sur toutes les unités côté A. Event `BOSS_TRIGGER` subType `silenceEveryNActions`.
- **phase2** : quand HP boss ≤ triggerHpPct : resetATB, attackBoostPct, newSkill (optionnel), flag `bossPhase2`, event `BOSS_TRIGGER` subType `phase2`.

## 7. Auth / Register — starter credits

- Dans `POST /auth/register`, après l’INSERT utilisateur : `INSERT INTO user_wallet (user_id, credits, cores, fragments, ascension_essence) VALUES (insertId, 500, 0, 0, 0)` pour permettre les premières invocations (5×100 crédits).

## 8. Comment tester (curl)

```bash
# 1) Migration + seeds (depuis la racine du projet)
mysql -u ... -p nexuscore < database/migrate_campaign.sql
mysql -u ... -p nexuscore < database/seeds_campaign.sql

# 2) Inscription (crée user_wallet 500 crédits)
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"campaign@test.fr","password":"secret123"}'
# Réponse : { "token": "...", "user": { "id": N, ... } }

# 3) Obtenir ≥5 unités (gacha ou autre) puis statut campagne
export TOKEN="<token>"
curl -s "http://localhost:3000/campaign/status?mode=normal" -H "Authorization: Bearer $TOKEN"

# 4) Lancer un stage (ex. chapitre 1, stage 1). Remplacer user_unit_id par des IDs valides.
curl -s -X POST http://localhost:3000/campaign/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"normal","chapter":1,"stage":1,"team":[{"user_unit_id":1,"position":"front"},{"user_unit_id":2,"position":"back"}]}'
# Réponse : success, winner, battleLog, rewardsGranted (si first clear), rewardsPreview, progressUpdated, wallet
```

- Si le joueur a &lt; 5 unités : `GET /campaign/status` et `POST /campaign/start` renvoient 403 CAMPAIGN_LOCKED.
- Stage non disponible (ex. stage 2 sans avoir clear le 1) : 400 STAGE_NOT_AVAILABLE.
