import { query } from '../config/db.js';
import {
  getCampaignStageConfig,
  getCampaignStageLevel
} from '../modules/campaign/config/campaignStageMatrix.js';

/**
 * Surcharges manuelles des niveaux par (mode, chapitre, stage).
 * La spécialisation reste toujours celle de la matrice.
 */

export async function loadLevelOverrideMap(mode) {
  const rows = await query(
    'SELECT chapter, stage, level FROM campaign_stage_level_overrides WHERE mode = ?',
    [mode]
  );
  const map = new Map();
  for (const r of rows) {
    map.set(`${Number(r.chapter)}-${Number(r.stage)}`, Number(r.level));
  }
  return map;
}

/**
 * @param {Map<string, number>|null|undefined} overrideMap
 */
export function mergeLevelIntoConfig(mode, chapter, stage, overrideMap) {
  const base = getCampaignStageConfig(mode, chapter, stage);
  const key = `${Number(chapter)}-${Number(stage)}`;
  if (overrideMap && overrideMap.has(key)) {
    return { ...base, level: overrideMap.get(key) };
  }
  return base;
}

export async function getEffectiveCampaignStageConfig(mode, chapter, stage) {
  const map = await loadLevelOverrideMap(mode);
  return mergeLevelIntoConfig(mode, chapter, stage, map);
}

export async function getStageLevelsGridForAdmin(mode) {
  const overrideMap = await loadLevelOverrideMap(mode);
  const levels = [];
  const isOverride = [];
  for (let c = 1; c <= 10; c++) {
    const rowL = [];
    const rowO = [];
    for (let s = 1; s <= 10; s++) {
      const key = `${c}-${s}`;
      const def = getCampaignStageLevel(mode, c, s);
      if (overrideMap.has(key)) {
        rowL.push(overrideMap.get(key));
        rowO.push(true);
      } else {
        rowL.push(def);
        rowO.push(false);
      }
    }
    levels.push(rowL);
    isOverride.push(rowO);
  }
  return { mode, levels, isOverride };
}

export async function upsertStageLevelOverride(mode, chapter, stage, level) {
  const ch = Number(chapter);
  const st = Number(stage);
  const lv = Number(level);
  const def = getCampaignStageLevel(mode, ch, st);
  if (lv === def) {
    await query(
      'DELETE FROM campaign_stage_level_overrides WHERE mode = ? AND chapter = ? AND stage = ?',
      [mode, ch, st]
    );
    return { ok: true, resetToDefault: true };
  }
  await query(
    `INSERT INTO campaign_stage_level_overrides (mode, chapter, stage, level)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE level = VALUES(level)`,
    [mode, ch, st, lv]
  );
  return { ok: true, resetToDefault: false };
}

export async function deleteStageLevelOverride(mode, chapter, stage) {
  await query(
    'DELETE FROM campaign_stage_level_overrides WHERE mode = ? AND chapter = ? AND stage = ?',
    [mode, chapter, stage]
  );
  return { ok: true };
}

export async function deleteAllStageLevelOverridesForMode(mode) {
  const result = await query('DELETE FROM campaign_stage_level_overrides WHERE mode = ?', [mode]);
  return { ok: true, affectedRows: result?.affectedRows ?? 0 };
}
