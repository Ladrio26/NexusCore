#!/usr/bin/env node
/**
 * Copie les compositions donjon Feu → Eau, Plante et Lumière en remplaçant les codes d'unités
 * par les équivalents (même « famille » : préfixe avant la virgule, ou règles Boss / premier mot).
 * Même niveau et spécialisation que le template Feu ; seul le code (unité de l’élément cible) change.
 *
 * Usage : depuis backend/ : node scripts/sync-dungeon-water-plant-from-fire.mjs
 * Requiert .env avec accès MySQL (même config que db.js) et des unités Lumière pour chaque famille présente au donjon Feu.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_USER = 'ladrio',
  DB_PASSWORD = 'cerise',
  DB_NAME = 'nexuscore'
} = process.env;

/** Clé de famille pour regrouper les éléments (même préfixe de nom que le donjon Feu). */
function familyKeyFromUnitName(name) {
  const t = String(name || '').trim();
  if (!t) return '';
  if (t.includes(',')) return t.slice(0, t.indexOf(',')).trim();
  const words = t.split(/\s+/);
  if (words[0]?.toLowerCase() === 'boss') return t;
  return words[0] || t;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const pool = await mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 2
  });

  try {
  const [unitRows] = await pool.query(
    `SELECT code, name, element FROM units WHERE element IN ('fire', 'water', 'plant', 'light', 'dark')`
  );

  /** @type {Map<string, Record<string, object>>} */
  const byFamily = new Map();
  for (const r of unitRows) {
    const k = familyKeyFromUnitName(r.name);
    if (!k) continue;
    if (!byFamily.has(k)) byFamily.set(k, {});
    const el = String(r.element || '').toLowerCase();
    const bucket = byFamily.get(k);
    if (bucket[el]) {
      console.warn(
        `Attention: plusieurs unités ${el} pour la famille "${k}": conservé ${bucket[el].code}, ignoré ${r.code}`
      );
      continue;
    }
    bucket[el] = r;
  }

  function resolveTargetCode(fireCode, targetElement) {
    const fireRow = unitRows.find((u) => u.code === fireCode && String(u.element).toLowerCase() === 'fire');
    if (!fireRow) {
      return { ok: false, reason: `Unité fire introuvable: ${fireCode}` };
    }
    const k = familyKeyFromUnitName(fireRow.name);
    const bucket = byFamily.get(k);
    if (!bucket) {
      return { ok: false, reason: `Pas de famille pour clé "${k}" (${fireRow.name})` };
    }
    const t = bucket[targetElement];
    if (!t) {
      return {
        ok: false,
        reason: `Pas d'équivalent ${targetElement} pour la famille "${k}" (feu: ${fireRow.name})`
      };
    }
    return { ok: true, code: t.code, name: t.name };
  }

  const [encRows] = await pool.query(
    `SELECT element, level, combat_index, enemy_template_json FROM dungeon_encounters WHERE element = 'fire' ORDER BY level, combat_index`
  );

  if (!encRows.length) {
    console.warn('Aucune rencontre donjon "fire" en base. Rien à faire.');
    return;
  }

  let ok = 0;
  let err = 0;

  for (const row of encRows) {
    let template =
      typeof row.enemy_template_json === 'string'
        ? JSON.parse(row.enemy_template_json)
        : row.enemy_template_json;
    if (!template || typeof template !== 'object') template = { units: [], stat_multiplier: 1 };

    const units = Array.isArray(template.units) ? template.units : [];
    const statMultiplier = template.stat_multiplier ?? 1;

    for (const targetEl of ['water', 'plant', 'light']) {
      const newUnits = [];
      for (const u of units) {
        const code = u?.code;
        if (!code) continue;
        const res = resolveTargetCode(String(code), targetEl);
        if (!res.ok) {
          console.error(
            `[${targetEl} L${row.level} C${row.combat_index}] ${res.reason} (code source ${code})`
          );
          err++;
          throw new Error(res.reason);
        }
        newUnits.push({
          ...u,
          code: res.code
        });
      }

      const newTemplate = {
        units: newUnits,
        stat_multiplier: statMultiplier
      };

      const json = JSON.stringify(newTemplate);
      if (dryRun) {
        console.log(`[dry-run] ${targetEl} L${row.level} C${row.combat_index}:`, json.slice(0, 200) + '...');
      } else {
        await pool.query(
          `INSERT INTO dungeon_encounters (element, level, combat_index, enemy_template_json)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE enemy_template_json = VALUES(enemy_template_json)`,
          [targetEl, row.level, row.combat_index, json]
        );
      }
      ok++;
    }
  }

  console.log(
    dryRun
      ? `[dry-run] Terminé. Combinaisons prévues (eau+plante+lumière): ${ok}`
      : `Terminé. Lignes écrites (eau+plante+lumière): ${ok}, erreurs de mapping: ${err}`
  );
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
