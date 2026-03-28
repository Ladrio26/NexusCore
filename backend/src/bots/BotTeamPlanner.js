/**
 * BotTeamPlanner.js
 * Analyse les presets d'équipe du bot, calcule la fatigue et génère automatiquement
 * les presets quand le bot n'en a pas (ou après une invocation).
 */

import { query } from '../config/db.js';
import { parseJsonSafe } from './BotUtils.js';
import { setDefense, getDefense } from '../services/pvpService.js';

// ── Constantes ────────────────────────────────────────────────────────────────

const RARITY_SCORE = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
// Archetypes qui doivent être en front (CAC)
const FRONT_ARCHETYPES = new Set(['CAC_TANK', 'CAC_DPS']);
// Max unités par preset, max par ligne
const MAX_UNITS_PER_PRESET = 6;
const MAX_PER_ROW          = 5;
// Nombre de presets générés automatiquement (rotation de fatigue)
const AUTO_PRESET_COUNT    = 3;

/**
 * Score de "puissance" d'une unité pour trier les meilleures en premier.
 * Basé sur rareté + niveau + power_level.
 */
function unitScore(u) {
  const r = RARITY_SCORE[String(u.rarity ?? '').toLowerCase()] ?? 1;
  return r * 100 + (u.level ?? 1) + (u.power_level ?? 1) * 5;
}

/**
 * Construit jusqu'à `AUTO_PRESET_COUNT` presets automatiques pour le bot et les enregistre
 * dans `user_team_presets`. Chaque preset utilise les meilleures unités disponibles
 * (non encore assignées) pour maximiser la rotation sous fatigue.
 *
 * Règles :
 * - CAC_TANK / CAC_DPS → front uniquement
 * - DISTANCE_* → back uniquement
 * - Max 6 unités par preset (max 5 par ligne)
 * - Le preset est ignoré s'il ne contient aucune unité
 *
 * @param {number} userId
 * @param {{ force?: boolean }} opts - force=true pour reconstruire même si des presets existent
 */
export async function ensureBotTeamPresets(userId, { force = false } = {}) {
  // Vérifier si le bot a déjà des presets (sauf si force=true)
  if (!force) {
    const existing = await query(
      'SELECT COUNT(*) AS cnt FROM user_team_presets WHERE user_id = ?',
      [Number(userId)]
    );
    if (Number(existing[0]?.cnt ?? 0) > 0) return;
  }

  // Charger toutes les unités du bot avec leur archetype + stats
  const units = await query(
    `SELECT uu.id AS user_unit_id, uu.level, uu.power_level, u.rarity, u.archetype
     FROM user_units uu
     JOIN units u ON u.id = uu.unit_id
     WHERE uu.user_id = ?
     ORDER BY uu.level DESC`,
    [Number(userId)]
  );

  if (!units.length) return; // Pas encore d'unités, rien à faire

  // Séparer front / back et trier par score décroissant
  const frontPool = units
    .filter(u => FRONT_ARCHETYPES.has(u.archetype))
    .sort((a, b) => unitScore(b) - unitScore(a));

  const backPool = units
    .filter(u => !FRONT_ARCHETYPES.has(u.archetype))
    .sort((a, b) => unitScore(b) - unitScore(a));

  const presets = [];

  for (let i = 0; i < AUTO_PRESET_COUNT; i++) {
    const frontSlice = frontPool.splice(0, Math.min(MAX_PER_ROW, Math.floor(MAX_UNITS_PER_PRESET / 2)));
    const remaining  = MAX_UNITS_PER_PRESET - frontSlice.length;
    const backSlice  = backPool.splice(0, Math.min(MAX_PER_ROW, remaining));

    if (frontSlice.length === 0 && backSlice.length === 0) break;

    presets.push({
      index: i + 1,
      name:  `Auto-${i + 1}`,
      front: frontSlice.map(u => u.user_unit_id),
      back:  backSlice.map(u => u.user_unit_id),
    });
  }

  if (!presets.length) return;

  // Supprimer les anciens presets auto (index 1..AUTO_PRESET_COUNT) puis réinsérer
  for (let i = 1; i <= AUTO_PRESET_COUNT; i++) {
    await query(
      'DELETE FROM user_team_presets WHERE user_id = ? AND preset_index = ?',
      [Number(userId), i]
    );
  }

  for (const p of presets) {
    await query(
      `INSERT INTO user_team_presets
         (user_id, preset_index, preset_name, front_slots, back_slots, selected_noyau_index)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [Number(userId), p.index, p.name, JSON.stringify(p.front), JSON.stringify(p.back)]
    );
  }

  // Configurer le preset 1 comme défense PvP dès la création
  await ensureBotPvpDefense(userId).catch(() => {});
}

/**
 * S'assure que le bot a une défense PvP configurée sur le preset 1.
 * Appelé après la création des presets et à chaque tick si la défense est absente.
 *
 * @param {number} userId
 */
export async function ensureBotPvpDefense(userId) {
  try {
    const existing = await getDefense(userId);
    if (existing) return; // défense déjà configurée

    // Vérifier que le preset 1 existe et n'est pas vide avant de le définir
    await setDefense(userId, 1);
  } catch (err) {
    // PRESET_EMPTY_OR_NOT_FOUND : le preset 1 n'est pas encore prêt, on ignore
    if (err.message !== 'PRESET_EMPTY_OR_NOT_FOUND') throw err;
  }
}

/**
 * Retourne tous les presets d'équipe du bot avec la fatigue max observée.
 * Format de retour : Array<{ presetIndex, slots, maxFatigue, selectedNoyauIndex }>
 * Un preset vide (aucun slot) est exclu du résultat.
 */
export async function getTeamPresetsWithFatigue(userId) {
  const presets = await query(
    `SELECT preset_index, front_slots, back_slots, selected_noyau_index
     FROM user_team_presets
     WHERE user_id = ?
     ORDER BY preset_index`,
    [Number(userId)]
  );
  if (!presets.length) return [];

  const allUnitIds = new Set();
  const parsed = presets.map((p) => {
    const front = parseJsonSafe(p.front_slots, []);
    const back  = parseJsonSafe(p.back_slots,  []);
    const slots = [
      ...front.filter(Boolean).map((id) => ({ user_unit_id: Number(id), position: 'front' })),
      ...back.filter(Boolean).map((id)  => ({ user_unit_id: Number(id), position: 'back'  })),
    ];
    for (const s of slots) allUnitIds.add(s.user_unit_id);
    return {
      presetIndex:        Number(p.preset_index),
      slots,
      selectedNoyauIndex: Number(p.selected_noyau_index ?? 0),
    };
  });

  if (!allUnitIds.size) return [];

  // Charge la fatigue de toutes les unités en une requête
  const ids = [...allUnitIds];
  const placeholders = ids.map(() => '?').join(',');
  let fatigueRows = [];
  try {
    fatigueRows = await query(
      `SELECT id, fatigue FROM user_units WHERE id IN (${placeholders})`,
      ids
    );
  } catch { /* non-critique : on utilisera 0 */ }

  const fatigueById = new Map(fatigueRows.map((r) => [Number(r.id), Number(r.fatigue ?? 0)]));

  return parsed
    .filter((p) => p.slots.length > 0)
    .map((p) => {
      const fatigues = p.slots.map((s) => fatigueById.get(s.user_unit_id) ?? 0);
      return { ...p, maxFatigue: Math.max(...fatigues) };
    });
}

/**
 * Retourne le meilleur preset disponible dont la fatigue max ≤ threshold.
 * « Meilleur » = équipe la plus fraîche (tri croissant sur maxFatigue).
 * Retourne null si aucun preset n'est éligible.
 */
export async function getBestTeamPreset(userId, maxFatigueThreshold = 60) {
  const presets = await getTeamPresetsWithFatigue(userId);
  const eligible = presets.filter((p) => p.maxFatigue <= maxFatigueThreshold);
  if (!eligible.length) return null;
  eligible.sort((a, b) => a.maxFatigue - b.maxFatigue);
  return eligible[0];
}

/**
 * Retourne la fatigue max la plus faible parmi tous les presets du bot.
 * Utile pour décider rapidement si des combats sont envisageables.
 * Retourne null si le bot n'a aucun preset.
 */
export async function getBotMinMaxFatigue(userId) {
  const presets = await getTeamPresetsWithFatigue(userId);
  if (!presets.length) return null;
  return Math.min(...presets.map((p) => p.maxFatigue));
}

/**
 * Vérifie que TOUTES les unités du meilleur preset disponible sont au niveau requis.
 * Utilisé pour conditionner l'accès aux donjons (toute l'équipe doit être niveau max).
 *
 * @param {number} userId
 * @param {number} [requiredLevel=50]
 * @returns {Promise<boolean>} true si toutes les unités sont au niveau requis
 */
export async function isBestTeamFullyAtLevel(userId, requiredLevel = 50) {
  const presets = await query(
    `SELECT front_slots, back_slots FROM user_team_presets WHERE user_id = ? ORDER BY preset_index ASC LIMIT 3`,
    [Number(userId)]
  );
  if (!presets.length) return false;

  // Chercher le premier preset dont toutes les unités sont au niveau requis
  for (const preset of presets) {
    const front = parseJsonSafe(preset.front_slots, []);
    const back  = parseJsonSafe(preset.back_slots,  []);
    const ids   = [...front, ...back].map(Number).filter((n) => n > 0);
    if (!ids.length) continue;

    const placeholders = ids.map(() => '?').join(',');
    const rows = await query(
      `SELECT level FROM user_units WHERE id IN (${placeholders}) AND user_id = ?`,
      [...ids, Number(userId)]
    );
    if (rows.length === 0) continue;
    if (rows.every((r) => Number(r.level ?? 0) >= requiredLevel)) return true;
  }
  return false;
}

/**
 * Retourne les user_units du bot qui ont atteint le niveau requis mais n'ont
 * pas encore de spécialisation. Utile pour déclencher l'action 'specialize'.
 *
 * @param {number} userId
 * @param {number} [minLevel=50]
 * @returns {Promise<Array<{ user_unit_id: number, specA_passive: any, specB_passive: any }>>}
 */
export async function getUnspecializedMaxLevelUnits(userId, minLevel = 50) {
  const rows = await query(
    `SELECT uu.id AS user_unit_id, u.specA_passive, u.specB_passive
     FROM user_units uu
     JOIN units u ON u.id = uu.unit_id
     WHERE uu.user_id = ? AND uu.level >= ? AND (uu.specialization IS NULL OR uu.specialization = '')`,
    [Number(userId), minLevel]
  );
  return rows;
}
