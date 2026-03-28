import { query, withTransaction } from '../config/db.js';
import { generateNonBossEnemyComposition, hashSeed } from './campaignGenerator.js';
import { getCampaignStageConfig } from '../modules/campaign/config/campaignStageMatrix.js';

function parseJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  if (typeof v !== 'string') return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function seededShuffle(arr, seedString) {
  const rng = hashSeed(seedString);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/**
 * @param {string} monthKey YYYY-MM
 */
async function countMonthlyEnemies(monthKey) {
  const rows = await query('SELECT COUNT(*) AS n FROM campaign_monthly_enemies WHERE month_key = ?', [monthKey]);
  return Number(rows[0]?.n ?? 0);
}

async function countBossAssignments(monthKey) {
  const rows = await query('SELECT COUNT(*) AS n FROM campaign_boss_assignments WHERE month_key = ?', [monthKey]);
  return Number(rows[0]?.n ?? 0);
}

/**
 * Mois complet : 90 stages non-boss × 2 modes + 10 affectations boss × 2 modes
 */
export async function isCampaignMonthComplete(monthKey) {
  const n = await countMonthlyEnemies(monthKey);
  const b = await countBossAssignments(monthKey);
  return n >= 180 && b >= 20;
}

/**
 * Si la table est vide, copie les compositions stage 10 depuis campaign_stages (sans perte de données).
 */
export async function seedBossTeamsFromStagesIfEmpty() {
  const cnt = await query('SELECT COUNT(*) AS n FROM campaign_boss_teams');
  if (Number(cnt[0]?.n) > 0) return { seeded: false };

  const stages = await query(
    'SELECT chapter, enemy_template, boss_unit_code FROM campaign_stages WHERE stage = 10 AND is_boss = 1 ORDER BY chapter'
  );
  for (const row of stages) {
    const template = parseJson(row.enemy_template);
    const units = (template?.units || []).map((u) => ({
      code: u.code,
      position: u.position === 'back' ? 'back' : 'front'
    }));
    const composition = {
      units,
      boss_unit_code: row.boss_unit_code || null
    };
    const json = JSON.stringify(composition);
    const fixedChapter = Number(row.chapter) === 10 ? 10 : null;
    for (const mode of ['normal', 'hard']) {
      await query(
        `INSERT INTO campaign_boss_teams (mode, name, sort_order, active, notes, composition, fixed_chapter)
         VALUES (?, ?, ?, 1, NULL, ?, ?)`,
        [mode, `Boss (chapitre ${row.chapter})`, Number(row.chapter), json, fixedChapter]
      );
    }
  }
  return { seeded: true, teamsPerMode: stages.length };
}

/** 9 slots pour chapitres 1–9 (shuffle mensuel). */
function padTeamsToNine(teams) {
  if (!teams.length) return [];
  const out = [];
  for (let i = 0; i < 9; i++) out.push(teams[i % teams.length]);
  return out;
}

/**
 * @param {import('mysql2/promise').Pool} connection
 */
async function regenerateMonthlyContentTx(tx, monthKey) {
  await tx.query('DELETE FROM campaign_monthly_enemies WHERE month_key = ?', [monthKey]);
  await tx.query('DELETE FROM campaign_boss_assignments WHERE month_key = ?', [monthKey]);

  const modes = ['normal', 'hard'];

  for (const mode of modes) {
    for (let chapter = 1; chapter <= 10; chapter++) {
      for (let stage = 1; stage <= 9; stage++) {
        const seedString = `NCA|${monthKey}|${mode}|${chapter}|${stage}|v1`;
        const { units } = await generateNonBossEnemyComposition({ mode, chapter, stage, seedString });
        const template = { units };
        await tx.query(
          `INSERT INTO campaign_monthly_enemies (month_key, mode, chapter, stage, enemy_template)
           VALUES (?, ?, ?, ?, ?)`,
          [monthKey, mode, chapter, stage, JSON.stringify(template)]
        );
      }
    }

    const teams = await tx.query(
      `SELECT id, composition, fixed_chapter, sort_order FROM campaign_boss_teams WHERE mode = ? AND active = 1 ORDER BY sort_order ASC, id ASC`,
      [mode]
    );
    if (!teams.length) continue;

    let fixedCh10 = teams.find((t) => Number(t.fixed_chapter) === 10);
    if (!fixedCh10) {
      fixedCh10 = teams.find((t) => Number(t.sort_order) === 10);
    }

    const pool = fixedCh10
      ? teams.filter((t) => Number(t.id) !== Number(fixedCh10.id))
      : [...teams];

    let sourcePool = pool.length ? pool : fixedCh10 ? [fixedCh10] : teams;
    if (!sourcePool.length) sourcePool = teams;

    const padded9 = padTeamsToNine(sourcePool);
    const shuffled9 = seededShuffle(padded9, `${monthKey}|${mode}|boss-shuffle-ch1-9|v3`);

    for (let ch = 1; ch <= 9; ch++) {
      const t = shuffled9[ch - 1];
      const id = t?.id;
      if (!id) continue;
      await tx.query(
        `INSERT INTO campaign_boss_assignments (month_key, mode, chapter, boss_team_id)
         VALUES (?, ?, ?, ?)`,
        [monthKey, mode, ch, id]
      );
    }

    const ch10TeamId =
      fixedCh10?.id ??
      teams.find((t) => Number(t.sort_order) === 10)?.id ??
      teams[teams.length - 1]?.id;
    if (ch10TeamId) {
      await tx.query(
        `INSERT INTO campaign_boss_assignments (month_key, mode, chapter, boss_team_id)
         VALUES (?, ?, ?, ?)`,
        [monthKey, mode, 10, ch10TeamId]
      );
    }
  }
}

/**
 * Génère le contenu mensuel si absent (premier combat du mois ou après migration).
 */
export async function ensureCampaignMonthGenerated(monthKey) {
  await seedBossTeamsFromStagesIfEmpty();
  if (await isCampaignMonthComplete(monthKey)) return;
  try {
    await withTransaction(async (tx) => {
      await regenerateMonthlyContentTx(tx, monthKey);
    });
  } catch (e) {
    if (await isCampaignMonthComplete(monthKey)) return;
    throw e;
  }
}

/**
 * Régénère de force (admin / cron 1er du mois si besoin).
 */
export async function regenerateCampaignMonth(monthKey) {
  await seedBossTeamsFromStagesIfEmpty();
  await withTransaction(async (tx) => {
    await regenerateMonthlyContentTx(tx, monthKey);
  });
}

/**
 * @returns {Promise<object|null>} { units: [{code, position}] }
 */
export async function getMonthlyNonBossTemplate(monthKey, mode, chapter, stage) {
  const rows = await query(
    `SELECT enemy_template FROM campaign_monthly_enemies
     WHERE month_key = ? AND mode = ? AND chapter = ? AND stage = ? LIMIT 1`,
    [monthKey, mode, chapter, stage]
  );
  const raw = rows[0]?.enemy_template;
  return parseJson(raw) || null;
}

export async function getBossAssignmentForChapter(monthKey, mode, chapter) {
  const rows = await query(
    `SELECT boss_team_id FROM campaign_boss_assignments
     WHERE month_key = ? AND mode = ? AND chapter = ? LIMIT 1`,
    [monthKey, mode, chapter]
  );
  const id = rows[0]?.boss_team_id;
  return id != null ? { boss_team_id: Number(id) } : null;
}

export async function getBossTeamById(teamId) {
  const rows = await query(
    `SELECT id, mode, name, active, notes, composition, fixed_chapter FROM campaign_boss_teams WHERE id = ? LIMIT 1`,
    [teamId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    mode: r.mode,
    name: r.name,
    active: !!r.active,
    notes: r.notes ?? null,
    fixed_chapter: r.fixed_chapter != null ? Number(r.fixed_chapter) : null,
    composition: parseJson(r.composition) || {}
  };
}

/**
 * Spécialisation A/B déterministe pour le mois / stage / slot.
 */
export function pickCampaignSpecialization(monthKey, mode, chapter, stage, slotKey) {
  const cfg = getCampaignStageConfig(mode, chapter, stage);
  if (!cfg.specialized) return null;
  const rng = hashSeed(`${monthKey}|${mode}|${chapter}|${stage}|spec|${slotKey}`);
  return rng() > 0.5 ? 'A' : 'B';
}

export async function listBossTeams(mode) {
  const rows = await query(
    `SELECT id, mode, name, sort_order, active, notes, composition, fixed_chapter, created_at, updated_at
     FROM campaign_boss_teams WHERE mode = ? ORDER BY sort_order ASC, id ASC`,
    [mode]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    mode: r.mode,
    name: r.name,
    sort_order: Number(r.sort_order ?? 0),
    active: !!r.active,
    notes: r.notes ?? null,
    fixed_chapter: r.fixed_chapter != null ? Number(r.fixed_chapter) : null,
    composition: parseJson(r.composition) || {},
    created_at: r.created_at,
    updated_at: r.updated_at
  }));
}

async function ensureSingleFixedChapter10(mode, exceptId) {
  await query('UPDATE campaign_boss_teams SET fixed_chapter = NULL WHERE mode = ? AND id <> ? AND fixed_chapter = 10', [
    mode,
    exceptId
  ]);
}

export async function createBossTeam({ mode, name, sort_order, active, notes, composition, fixed_chapter }) {
  const fc = fixed_chapter === 10 ? 10 : null;
  const result = await query(
    `INSERT INTO campaign_boss_teams (mode, name, sort_order, active, notes, composition, fixed_chapter)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [mode, name, sort_order ?? 0, active !== false ? 1 : 0, notes ?? null, JSON.stringify(composition ?? {}), fc]
  );
  const insertId = result?.insertId;
  if (fc === 10 && insertId != null) {
    await ensureSingleFixedChapter10(mode, Number(insertId));
  }
  return insertId;
}

export async function updateBossTeam(id, { name, sort_order, active, notes, composition, fixed_chapter }) {
  const fields = [];
  const vals = [];
  if (name !== undefined) {
    fields.push('name = ?');
    vals.push(name);
  }
  if (sort_order !== undefined) {
    fields.push('sort_order = ?');
    vals.push(sort_order);
  }
  if (active !== undefined) {
    fields.push('active = ?');
    vals.push(active ? 1 : 0);
  }
  if (notes !== undefined) {
    fields.push('notes = ?');
    vals.push(notes);
  }
  if (composition !== undefined) {
    fields.push('composition = ?');
    vals.push(JSON.stringify(composition));
  }
  if (fixed_chapter !== undefined) {
    fields.push('fixed_chapter = ?');
    vals.push(fixed_chapter === 10 ? 10 : null);
  }
  if (!fields.length) return 0;
  vals.push(id);
  const result = await query(`UPDATE campaign_boss_teams SET ${fields.join(', ')} WHERE id = ?`, vals);
  const rows = await query('SELECT mode FROM campaign_boss_teams WHERE id = ?', [id]);
  const mode = rows[0]?.mode;
  if (mode && fixed_chapter === 10) {
    await ensureSingleFixedChapter10(mode, Number(id));
  }
  return result?.affectedRows ?? 0;
}

export async function deleteBossTeam(id) {
  const result = await query('DELETE FROM campaign_boss_teams WHERE id = ?', [id]);
  return result?.affectedRows ?? 0;
}

export async function duplicateBossTeam(id) {
  const team = await getBossTeamById(id);
  if (!team) return null;
  const name = `${team.name} (copie)`;
  const rows = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM campaign_boss_teams WHERE mode = ?', [
    team.mode
  ]);
  const sort = Number(rows[0]?.n ?? 0);
  const newId = await createBossTeam({
    mode: team.mode,
    name,
    sort_order: sort,
    active: team.active,
    notes: team.notes,
    composition: team.composition,
    fixed_chapter: null
  });
  return newId;
}

export async function listBossAssignments(monthKey, mode) {
  const rows = await query(
    `SELECT a.chapter, a.boss_team_id, t.name AS team_name, t.composition
     FROM campaign_boss_assignments a
     JOIN campaign_boss_teams t ON t.id = a.boss_team_id
     WHERE a.month_key = ? AND a.mode = ?
     ORDER BY a.chapter`,
    [monthKey, mode]
  );
  return rows.map((r) => ({
    chapter: Number(r.chapter),
    boss_team_id: Number(r.boss_team_id),
    team_name: r.team_name,
    composition: parseJson(r.composition) || {}
  }));
}

/**
 * Tous les codes boss utilisés par les équipes admin + fallback campaign_stages.
 */
export async function getAllCampaignBossUnitCodes() {
  const fromStages = await query(
    `SELECT DISTINCT boss_unit_code AS c FROM campaign_stages WHERE boss_unit_code IS NOT NULL AND boss_unit_code != ''`
  );
  const fromTeams = await query(`SELECT composition FROM campaign_boss_teams`);
  const set = new Set();
  for (const row of fromStages) {
    if (row.c) set.add(row.c);
  }
  for (const row of fromTeams) {
    const comp = parseJson(row.composition);
    if (comp?.boss_unit_code) set.add(comp.boss_unit_code);
  }
  return [...set];
}
