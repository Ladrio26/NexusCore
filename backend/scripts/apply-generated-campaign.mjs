/**
 * Génère/reconstruit une campagne complète en base, y compris sur une DB vide :
 * - upsert des 100 lignes `campaign_stages`
 * - upsert des rewards normal/hard
 * - création des 10 boss `BOSS_CHx_10` si absents
 * - upsert des boss modifiers
 *
 * À lancer depuis la racine du projet :
 *   node backend/scripts/apply-generated-campaign.mjs
 */

import { generateCampaign } from '../src/services/campaignGenerator.js';
import { getPool } from '../src/config/db.js';

function getBossCodeForChapter(chapter) {
  return `BOSS_CH${chapter}_10`;
}

function computeNormalMultiplier(chapter, stage) {
  return Number((1 + chapter * 0.15 + stage * 0.03).toFixed(3));
}

function computeHardMultiplier(normalMultiplier) {
  return Number((normalMultiplier * 1.6).toFixed(3));
}

function buildEnemyTemplateFromFight(fight, bossCodeIfBoss) {
  const unitsSource = Array.isArray(fight.enemies) ? fight.enemies : [];
  const minions = bossCodeIfBoss
    ? unitsSource.filter((e) => e.unitId !== bossCodeIfBoss)
    : unitsSource;
  const units = minions.map((e, idx) => ({
    code: e.unitId,
    position: idx === 0 || idx % 2 === 0 ? 'front' : 'back'
  }));
  return { units };
}

function buildBossModifierPair(chapter) {
  const presets = {
    1: {
      normal: { damageReductionPct: 0.12 },
      hard: { damageReductionPct: 0.2 }
    },
    2: {
      normal: { immuneDebuffs: true },
      hard: { immuneDebuffs: true, damageReductionPct: 0.1 }
    },
    3: {
      normal: { shieldEveryNActions: { n: 3, pctMaxHp: 0.16 } },
      hard: { shieldEveryNActions: { n: 2, pctMaxHp: 0.2 } }
    },
    4: {
      normal: { atbOnHit: { amount: 10 } },
      hard: { atbOnHit: { amount: 18 } }
    },
    5: {
      normal: { silenceEveryNActions: { n: 4, duration: 1 } },
      hard: { silenceEveryNActions: { n: 3, duration: 2 } }
    },
    6: {
      normal: { phase2: { triggerHpPct: 0.5, resetATB: true, attackBoostPct: 0.2 } },
      hard: { phase2: { triggerHpPct: 0.6, resetATB: true, attackBoostPct: 0.35 } }
    },
    7: {
      normal: { damageReductionPct: 0.15, shieldEveryNActions: { n: 3, pctMaxHp: 0.18 } },
      hard: { damageReductionPct: 0.22, shieldEveryNActions: { n: 2, pctMaxHp: 0.22 } }
    },
    8: {
      normal: { immuneDebuffs: true, atbOnHit: { amount: 12 } },
      hard: { immuneDebuffs: true, atbOnHit: { amount: 20 }, damageReductionPct: 0.1 }
    },
    9: {
      normal: { silenceEveryNActions: { n: 3, duration: 2 }, phase2: { triggerHpPct: 0.45, attackBoostPct: 0.2 } },
      hard: { silenceEveryNActions: { n: 2, duration: 2 }, phase2: { triggerHpPct: 0.55, resetATB: true, attackBoostPct: 0.35 } }
    },
    10: {
      normal: { damageReductionPct: 0.18, immuneDebuffs: true, phase2: { triggerHpPct: 0.5, resetATB: true, attackBoostPct: 0.25 } },
      hard: { damageReductionPct: 0.25, immuneDebuffs: true, shieldEveryNActions: { n: 2, pctMaxHp: 0.2 }, phase2: { triggerHpPct: 0.6, resetATB: true, attackBoostPct: 0.4 } }
    }
  };
  return presets[chapter] ?? { normal: null, hard: null };
}

async function loadBossSourceUnits(conn) {
  const [rows] = await conn.execute(
    `SELECT code, name, rarity, role, attack_type, element, archetype,
            base_hp, base_attack, base_defense, base_speed, mastery, traits, skill_data, image_url,
            specA_bonus_stat, specB_bonus_stat, specA_skill_modifier, specB_skill_modifier, specA_passive, specB_passive
     FROM units
     WHERE element IN ('water', 'fire', 'plant') AND code NOT LIKE 'BOSS_CH%'
     ORDER BY FIELD(rarity, 'mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'), id ASC`
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('NO_SOURCE_UNITS_FOR_CAMPAIGN');
  }
  return rows;
}

function scaleBossStat(baseValue, chapter, multiplier) {
  return Math.max(1, Math.round(Number(baseValue || 0) * (multiplier + chapter * 0.08)));
}

async function ensureBossUnits(conn) {
  const sourceUnits = await loadBossSourceUnits(conn);
  for (let chapter = 1; chapter <= 10; chapter++) {
    const source = sourceUnits[(chapter - 1) % sourceUnits.length];
    const bossCode = getBossCodeForChapter(chapter);
    const statMultiplier = 1.45 + chapter * 0.06;
    await conn.execute(
      `INSERT INTO units (
         code, name, rarity, role, attack_type, element, archetype,
         base_hp, base_attack, base_defense, base_speed, mastery, traits, skill_data, image_url,
         specA_bonus_stat, specB_bonus_stat, specA_skill_modifier, specB_skill_modifier, specA_passive, specB_passive
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         rarity = VALUES(rarity),
         role = VALUES(role),
         attack_type = VALUES(attack_type),
         element = VALUES(element),
         archetype = VALUES(archetype),
         base_hp = VALUES(base_hp),
         base_attack = VALUES(base_attack),
         base_defense = VALUES(base_defense),
         base_speed = VALUES(base_speed),
         mastery = VALUES(mastery),
         traits = VALUES(traits),
         skill_data = VALUES(skill_data),
         image_url = VALUES(image_url),
         specA_bonus_stat = VALUES(specA_bonus_stat),
         specB_bonus_stat = VALUES(specB_bonus_stat),
         specA_skill_modifier = VALUES(specA_skill_modifier),
         specB_skill_modifier = VALUES(specB_skill_modifier),
         specA_passive = VALUES(specA_passive),
         specB_passive = VALUES(specB_passive)`,
      [
        bossCode,
        `Boss Chapitre ${chapter}`,
        'legendary',
        source.role,
        source.attack_type,
        source.element,
        source.archetype,
        scaleBossStat(source.base_hp, chapter, statMultiplier),
        scaleBossStat(source.base_attack, chapter, statMultiplier),
        scaleBossStat(source.base_defense, chapter, statMultiplier),
        scaleBossStat(source.base_speed, chapter, 1.05),
        Math.max(Number(source.mastery || 0), 10 + chapter * 3),
        source.traits,
        source.skill_data,
        source.image_url,
        source.specA_bonus_stat,
        source.specB_bonus_stat,
        source.specA_skill_modifier,
        source.specB_skill_modifier,
        source.specA_passive,
        source.specB_passive
      ]
    );
  }
}

async function main() {
  const seed = process.env.CAMPAIGN_SEED || 'NEXUS_CAMPAIGN_V1';
  const fights = await generateCampaign(seed);
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await ensureBossUnits(conn);

    const normalFights = fights.filter((f) => f.mode === 'normal');
    for (const fight of normalFights) {
      const chapter = Number(fight.chapter);
      const stage = Number(fight.fight);
      const isBoss = Boolean(fight.isBoss);
      const bossCode = isBoss ? getBossCodeForChapter(chapter) : null;
      const enemyTemplate = buildEnemyTemplateFromFight(fight, bossCode);
      const normalMultiplier = computeNormalMultiplier(chapter, stage);
      const hardMultiplier = computeHardMultiplier(normalMultiplier);

      await conn.execute(
        `INSERT INTO campaign_stages (chapter, stage, is_boss, normal_multiplier, hard_multiplier, enemy_template, boss_unit_code)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           is_boss = VALUES(is_boss),
           normal_multiplier = VALUES(normal_multiplier),
           hard_multiplier = VALUES(hard_multiplier),
           enemy_template = VALUES(enemy_template),
           boss_unit_code = VALUES(boss_unit_code)`,
        [
          chapter,
          stage,
          isBoss ? 1 : 0,
          normalMultiplier,
          hardMultiplier,
          JSON.stringify(enemyTemplate),
          bossCode
        ]
      );
    }

    for (let chapter = 1; chapter <= 10; chapter++) {
      const modifiers = buildBossModifierPair(chapter);
      await conn.execute(
        `INSERT INTO campaign_boss_modifiers (chapter, stage, normal_modifier, hard_modifier)
         VALUES (?, 10, ?, ?)
         ON DUPLICATE KEY UPDATE
           normal_modifier = VALUES(normal_modifier),
           hard_modifier = VALUES(hard_modifier)`,
        [
          chapter,
          JSON.stringify(modifiers.normal),
          JSON.stringify(modifiers.hard)
        ]
      );
    }

    for (const fight of fights) {
      const chapter = Number(fight.chapter);
      const stage = Number(fight.fight);
      const mode = String(fight.mode);
      const rewards = fight.rewards || {};
      await conn.execute(
        `INSERT INTO campaign_rewards (chapter, stage, mode, credits, cores, fragments, ascension_essence)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           credits = VALUES(credits),
           cores = VALUES(cores),
           fragments = VALUES(fragments),
           ascension_essence = VALUES(ascension_essence)`,
        [
          chapter,
          stage,
          mode,
          Number(rewards.credits ?? 0),
          Number(rewards.cores ?? 0),
          Number(rewards.fragments ?? 0),
          rewards.essence ? 1 : 0
        ]
      );
    }

    await conn.commit();
    console.log('[apply-generated-campaign] Campaign data successfully applied for seed', seed);
  } catch (err) {
    await conn.rollback();
    console.error('[apply-generated-campaign] Error, rollback:', err);
    process.exitCode = 1;
  } finally {
    conn.release();
  }
}

main().catch((err) => {
  console.error('[apply-generated-campaign] Fatal error:', err);
  process.exit(1);
});

