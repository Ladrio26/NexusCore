/**
 * Agrégations pour l’admin : stats détaillées par bot (campagne, donjons, PvP, logs, équipes).
 */
import { query } from '../config/db.js';
import { getSeasonKey } from './campaignService.js';
import { ARTIFACT_STAT_LABELS_FR } from '../../../core/artifacts.js';

function parseJsonSafe(v, fallback = null) {
  if (v == null) return fallback;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return fallback;
  }
}

async function isBotUser(userId) {
  const rows = await query('SELECT 1 FROM bot_profiles WHERE user_id = ? LIMIT 1', [userId]);
  return rows.length > 0;
}

function furthestClearedStage(rows) {
  let best = null;
  let bestScore = -1;
  for (const r of rows || []) {
    if (!r?.cleared) continue;
    const ch = Number(r.chapter);
    const st = Number(r.stage);
    const score = ch * 100 + st;
    if (score > bestScore) {
      bestScore = score;
      best = { chapter: ch, stage: st };
    }
  }
  return best;
}

/**
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function getBotAdminStats(userId) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid < 1) return null;
  if (!(await isBotUser(uid))) return null;

  const seasonKey = getSeasonKey();

  const [
    userRows,
    normalProg,
    hardProg,
    seasonsNormal,
    seasonsHard,
    pvpAgg,
    logByAction,
    topUnits,
    presets,
    runtimeRows,
  ] = await Promise.all([
    query(
      'SELECT id, pvp_elo, elo, display_name FROM users WHERE id = ? LIMIT 1',
      [uid]
    ),
    query(
      `SELECT chapter, stage, cleared, reward_claimed, cleared_at
       FROM campaign_progress_normal WHERE user_id = ? AND season_key = ?`,
      [uid, seasonKey]
    ),
    query(
      `SELECT chapter, stage, cleared, reward_claimed, cleared_at
       FROM campaign_progress_hard WHERE user_id = ? AND season_key = ?`,
      [uid, seasonKey]
    ),
    query(
      `SELECT season_key,
              SUM(cleared = 1) AS stages_cleared,
              MAX(IF(cleared = 1, chapter * 100 + stage, 0)) AS furthest_score
       FROM campaign_progress_normal WHERE user_id = ?
       GROUP BY season_key ORDER BY season_key DESC LIMIT 12`,
      [uid]
    ),
    query(
      `SELECT season_key,
              SUM(cleared = 1) AS stages_cleared,
              MAX(IF(cleared = 1, chapter * 100 + stage, 0)) AS furthest_score
       FROM campaign_progress_hard WHERE user_id = ?
       GROUP BY season_key ORDER BY season_key DESC LIMIT 12`,
      [uid]
    ),
    query(
      `SELECT
         COUNT(*) AS total,
         SUM(result = 'win') AS wins,
         SUM(result = 'loss') AS losses,
         SUM(result = 'draw') AS draws,
         SUM(defender_type = 'player' AND result = 'win') AS wins_vs_player,
         SUM(defender_type = 'player' AND result = 'loss') AS losses_vs_player,
         SUM(defender_type = 'npc' AND result = 'win') AS wins_vs_npc,
         SUM(defender_type = 'npc' AND result = 'loss') AS losses_vs_npc
       FROM pvp_battles WHERE attacker_id = ?`,
      [uid]
    ),
    query(
      `SELECT action, COUNT(*) AS total, SUM(success) AS successes
       FROM bot_action_logs WHERE user_id = ?
       GROUP BY action`,
      [uid]
    ),
    query(
      `SELECT uu.id AS user_unit_id, u.name AS unit_name, uu.level, uu.specialization, uu.power_level,
              uu.combat_kills, uu.combat_victories, uu.combat_defeats,
              uu.combat_damage_dealt, uu.combat_healing_done
       FROM user_units uu
       JOIN units u ON u.id = uu.unit_id
       WHERE uu.user_id = ?
       ORDER BY (uu.combat_victories + uu.combat_defeats) DESC, uu.combat_victories DESC
       LIMIT 20`,
      [uid]
    ),
    query(
      `SELECT preset_index, preset_name, front_slots, back_slots, selected_noyau_index
       FROM user_team_presets WHERE user_id = ?
       ORDER BY preset_index ASC`,
      [uid]
    ),
    query(
      `SELECT dungeon_state_json, action_count, current_action, last_action_at
       FROM bot_runtime_state WHERE user_id = ? LIMIT 1`,
      [uid]
    ),
  ]);

  const user = userRows[0] || {};
  const pvp = pvpAgg[0] || {};

  const normalCleared = (normalProg || []).filter((r) => r.cleared);
  const hardCleared = (hardProg || []).filter((r) => r.cleared);

  let dungeonProgress = [];
  let dungeonFloors = [];
  let dungeonRun = null;
  try {
    dungeonProgress = await query(
      'SELECT element, max_unlocked_level FROM user_dungeon_progress WHERE user_id = ? ORDER BY element',
      [uid]
    );
    dungeonFloors = await query(
      'SELECT element, level FROM user_dungeon_floor_clear WHERE user_id = ? ORDER BY element, level',
      [uid]
    );
    const runRows = await query(
      `SELECT element, level, combats_cleared, team_json, selected_noyau_index
       FROM user_dungeon_run WHERE user_id = ? LIMIT 1`,
      [uid]
    );
    dungeonRun = runRows[0] || null;
  } catch {
    /* tables optionnelles */
  }

  const logRows = await query(
    `SELECT action, success, detail_json FROM bot_action_logs
     WHERE user_id = ? AND action IN ('campaign','dungeon','pvp')
     ORDER BY id DESC LIMIT 2500`,
    [uid]
  );

  const campaignFromLogs = { attempts: 0, wins: 0, byStage: {} };
  const dungeonFromLogs = { attempts: 0, wins: 0, byElementLevel: {} };

  for (const row of logRows) {
    const d = parseJsonSafe(row.detail_json, {});
    if (row.action === 'campaign') {
      campaignFromLogs.attempts += 1;
      if (row.success) campaignFromLogs.wins += 1;
      const key = `${d.mode || 'normal'}:${d.chapter ?? '?'}-${d.stage ?? '?'}`;
      if (!campaignFromLogs.byStage[key]) {
        campaignFromLogs.byStage[key] = { attempts: 0, wins: 0 };
      }
      campaignFromLogs.byStage[key].attempts += 1;
      if (row.success) campaignFromLogs.byStage[key].wins += 1;
    } else if (row.action === 'dungeon') {
      dungeonFromLogs.attempts += 1;
      if (row.success) dungeonFromLogs.wins += 1;
      const el = d.element || '?';
      const lv = d.level ?? '?';
      const dk = `${el}:${lv}`;
      if (!dungeonFromLogs.byElementLevel[dk]) {
        dungeonFromLogs.byElementLevel[dk] = { attempts: 0, wins: 0, element: el, level: lv };
      }
      dungeonFromLogs.byElementLevel[dk].attempts += 1;
      if (row.success) dungeonFromLogs.byElementLevel[dk].wins += 1;
    }
  }

  const presetResolved = await resolvePresetsWithUnitNames(uid, presets || []);

  const rawState = runtimeRows[0]?.dungeon_state_json;
  const runtimeBlob = parseJsonSafe(rawState, {});

  return {
    seasonKey,
    user: {
      display_name: user.display_name,
      pvp_elo: Number(user.pvp_elo ?? 0),
      elo: Number(user.elo ?? 0),
    },
    campaign: {
      currentSeason: seasonKey,
      normal: {
        stages_cleared: normalCleared.length,
        furthest: furthestClearedStage(normalProg),
      },
      hard: {
        stages_cleared: hardCleared.length,
        furthest: furthestClearedStage(hardProg),
      },
      historyNormal: (seasonsNormal || []).map((r) => ({
        season_key: r.season_key,
        stages_cleared: Number(r.stages_cleared ?? 0),
        furthest_score: Number(r.furthest_score ?? 0),
        furthest_chapter: r.furthest_score ? Math.floor(Number(r.furthest_score) / 100) : 0,
        furthest_stage: r.furthest_score ? Number(r.furthest_score) % 100 : 0,
      })),
      historyHard: (seasonsHard || []).map((r) => ({
        season_key: r.season_key,
        stages_cleared: Number(r.stages_cleared ?? 0),
        furthest_score: Number(r.furthest_score ?? 0),
        furthest_chapter: r.furthest_score ? Math.floor(Number(r.furthest_score) / 100) : 0,
        furthest_stage: r.furthest_score ? Number(r.furthest_score) % 100 : 0,
      })),
    },
    dungeon: {
      progress: dungeonProgress,
      floors_cleared: dungeonFloors,
      active_run: dungeonRun
        ? {
            element: dungeonRun.element,
            level: dungeonRun.level,
            combats_cleared: dungeonRun.combats_cleared,
            selected_noyau_index: dungeonRun.selected_noyau_index,
            team: parseJsonSafe(dungeonRun.team_json, null),
          }
        : null,
    },
    dungeon_from_logs: dungeonFromLogs,
    campaign_from_logs: campaignFromLogs,
    pvp: {
      elo: Number(user.pvp_elo ?? 0),
      battles_total: Number(pvp.total ?? 0),
      wins: Number(pvp.wins ?? 0),
      losses: Number(pvp.losses ?? 0),
      draws: Number(pvp.draws ?? 0),
      vs_player: {
        wins: Number(pvp.wins_vs_player ?? 0),
        losses: Number(pvp.losses_vs_player ?? 0),
      },
      vs_npc: {
        wins: Number(pvp.wins_vs_npc ?? 0),
        losses: Number(pvp.losses_vs_npc ?? 0),
      },
    },
    bot_logs_by_action: (logByAction || []).map((r) => ({
      action: r.action,
      total: Number(r.total ?? 0),
      successes: Number(r.successes ?? 0),
    })),
    top_units: topUnits || [],
    team_presets: presetResolved,
    runtime: {
      action_count: Number(runtimeRows[0]?.action_count ?? 0),
      current_action: runtimeRows[0]?.current_action ?? null,
      last_action_at: runtimeRows[0]?.last_action_at ?? null,
      dungeon_state: runtimeBlob,
    },
  };
}

async function resolvePresetsWithUnitNames(userId, presetRows) {
  const allIds = new Set();
  for (const pr of presetRows) {
    const front = parseJsonSafe(pr.front_slots, []) || [];
    const back = parseJsonSafe(pr.back_slots, []) || [];
    for (const s of [...front, ...back]) {
      const id = Number(s?.user_unit_id);
      if (id) allIds.add(id);
    }
  }
  if (!allIds.size) {
    return presetRows.map((pr) => ({
      preset_index: pr.preset_index,
      preset_name: pr.preset_name,
      selected_noyau_index: pr.selected_noyau_index,
      front: [],
      back: [],
    }));
  }
  const ids = [...allIds];
  const ph = ids.map(() => '?').join(',');
  const unitRows = await query(
    `SELECT uu.id, u.name, uu.level, uu.specialization, u.element, u.archetype
     FROM user_units uu JOIN units u ON u.id = uu.unit_id
     WHERE uu.user_id = ? AND uu.id IN (${ph})`,
    [userId, ...ids]
  );
  const byId = new Map(unitRows.map((r) => [Number(r.id), r]));

  return presetRows.map((pr) => {
    const front = parseJsonSafe(pr.front_slots, []) || [];
    const back = parseJsonSafe(pr.back_slots, []) || [];
    return {
      preset_index: pr.preset_index,
      preset_name: pr.preset_name,
      selected_noyau_index: pr.selected_noyau_index,
      front: front.map((s) => slotToResolved(s, byId)),
      back: back.map((s) => slotToResolved(s, byId)),
    };
  });
}

function slotToResolved(slot, byId) {
  const uid = Number(slot?.user_unit_id);
  const u = byId.get(uid);
  return {
    user_unit_id: uid || null,
    name: u?.name ?? (uid ? `#${uid}` : '—'),
    level: u?.level ?? null,
    specialization: u?.specialization ?? null,
    element: u?.element ?? null,
    archetype: u?.archetype ?? null,
  };
}

/**
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function getBotAdminArtifacts(userId) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid < 1) return null;
  if (!(await isBotUser(uid))) return null;

  const artifacts = await query(
    `SELECT ua.id, ua.stat_key, ua.level, ua.equipped_user_unit_id, ua.created_at
     FROM user_artifacts ua
     WHERE ua.user_id = ?
     ORDER BY ua.equipped_user_unit_id IS NULL, ua.level DESC, ua.id ASC`,
    [uid]
  );

  const equippedIds = [...new Set(artifacts.map((a) => a.equipped_user_unit_id).filter(Boolean))];
  let equipMap = new Map();
  if (equippedIds.length) {
    const ph = equippedIds.map(() => '?').join(',');
    const er = await query(
      `SELECT uu.id, u.name, uu.level, uu.specialization
       FROM user_units uu JOIN units u ON u.id = uu.unit_id
       WHERE uu.user_id = ? AND uu.id IN (${ph})`,
      [uid, ...equippedIds]
    );
    equipMap = new Map(er.map((x) => [Number(x.id), x]));
  }

  return {
    artifacts: artifacts.map((a) => {
      const eq = a.equipped_user_unit_id ? equipMap.get(Number(a.equipped_user_unit_id)) : null;
      return {
        id: a.id,
        stat_key: a.stat_key,
        stat_label_fr: ARTIFACT_STAT_LABELS_FR[a.stat_key] || a.stat_key,
        level: Number(a.level ?? 0),
        equipped_user_unit_id: a.equipped_user_unit_id,
        equipped_on: eq
          ? { name: eq.name, level: eq.level, specialization: eq.specialization }
          : null,
        status: a.equipped_user_unit_id ? 'equipped' : 'inventory',
        created_at: a.created_at,
      };
    }),
    summary: {
      total: artifacts.length,
      equipped: artifacts.filter((a) => a.equipped_user_unit_id).length,
      inventory: artifacts.filter((a) => !a.equipped_user_unit_id).length,
    },
  };
}
