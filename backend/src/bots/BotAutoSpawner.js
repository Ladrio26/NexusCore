/**
 * BotAutoSpawner.js
 * Crée automatiquement 1 bot toutes les 6 heures.
 *
 * Logique de guilde :
 *  - Tous les 6 bots créés, le 6e forme une nouvelle guilde (il en est le leader).
 *  - Les 5 bots suivants rejoignent cette guilde via ensureBotInGuild (tick runner).
 *  - Le 12e crée une deuxième guilde, etc.
 *
 * Noms : puisés aléatoirement dans deux pools Fantasy-War distincts (bots / guildes).
 */

import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { createGuild } from '../services/guildService.js';
import { getAllAssignableProfileIds } from './BotProfiles.js';
import { randomChoice, botLog } from './BotUtils.js';

// ── Pools de noms ─────────────────────────────────────────────────────────────

export const BOT_NAMES = [
  'Aelric', 'Bragor', 'Cyndra', 'Dravon', 'Evara',
  'Fheron', 'Graxis', 'Hariel', 'Ildara', 'Jorven',
  'Kethis', 'Lyrana', 'Morven', 'Naelith', 'Ordyn',
  'Praxis', 'Quiral', 'Rydan', 'Selith', 'Theron',
  'Ulvara', 'Vyndra', 'Wraxis', 'Xelith', 'Yaeron',
  'Zephiran', 'Astryn', 'Brunvex', 'Caelith', 'Dymaris',
  'Emvara', 'Forsyn', 'Grendal', 'Halvex', 'Isolyn',
  'Jekara', 'Korveth', 'Lyndral', 'Mythan', 'Narvex',
  'Oswyn', 'Pyreth', 'Quelith', 'Ryndal', 'Sylvax',
];

export const GUILD_NAMES = [
  'Les Seigneurs du Chaos',
  'La Garde Écarlate',
  'Ordre de la Tempête',
  'Les Gardiens des Abysses',
  'Le Pacte de Fer',
  'Les Enfants de la Guerre',
  'La Fraternité des Éclairs',
  'Chevaliers Maudits',
  'Les Faucheuses d\'Âmes',
  'Forge des Titans',
  'Les Briseurs de Mondes',
  'La Légion Ardente',
  'Serment de Sang',
  'Les Loups de l\'Aube',
  'L\'Alliance Éternelle',
  'La Horde Céleste',
  'Les Maîtres du Destin',
  'Égide des Anciens',
  'Les Ombres de la Nuit',
  'La Vanguarde Maudite',
  'Le Serment Noir',
  'Aurore de Sang',
  'Crépuscule Héroïque',
  'Les Vengeurs Célestes',
  'Porte-Flammes Éternels',
  'La Hache Brisée',
  'Lames du Crépuscule',
  'Les Héros Déchus',
  'Conquête Éternelle',
  'Les Dieux de Guerre',
];

/** Nombre de bots par guilde avant qu'une nouvelle soit créée. */
const BOTS_PER_GUILD = 6;

/** Intervalle de création automatique (6 heures). */
const SPAWN_INTERVAL_MS = 6 * 60 * 60 * 1000;

let spawnInterval = null;

// ── Utilitaires internes ──────────────────────────────────────────────────────

/** Compte le nombre total de bots existants. */
async function countBots() {
  const rows = await query('SELECT COUNT(*) AS n FROM bot_profiles');
  return Number(rows[0]?.n ?? 0);
}

/**
 * Génère un display_name unique en partant du pool.
 * Si le nom de base est déjà pris, ajoute un suffixe numérique croissant.
 */
async function pickUniqueBotName() {
  const base = randomChoice(BOT_NAMES);
  for (let suffix = 0; suffix <= 99; suffix++) {
    const name = suffix === 0 ? base : `${base} ${suffix}`;
    const rows = await query(
      'SELECT id FROM users WHERE display_name = ? LIMIT 1',
      [name]
    );
    if (!rows.length) return name;
  }
  // Fallback absolu : timestamp
  return `Bot_${Date.now()}`;
}

/**
 * Retourne un nom de guilde aléatoire non encore utilisé.
 * Si tout le pool est épuisé, ajoute un suffixe romain.
 */
async function pickUniqueGuildName() {
  const shuffled = [...GUILD_NAMES].sort(() => Math.random() - 0.5);
  const suffixes = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

  for (const suffix of suffixes) {
    for (const base of shuffled) {
      const name = (base + suffix).slice(0, 30);
      const rows = await query(
        'SELECT id FROM guilds WHERE name = ? LIMIT 1',
        [name]
      );
      if (!rows.length) return name;
    }
  }
  return `Guilde ${Date.now()}`.slice(0, 30);
}

// ── Création d'un bot ─────────────────────────────────────────────────────────

/**
 * Crée un nouveau bot automatiquement :
 *  1. Choisit un nom et un profil aléatoires.
 *  2. INSERT user + wallet + bot_profiles.
 *  3. Si c'est le N*6e bot : crée une nouvelle guilde dont ce bot est leader.
 */
export async function createAutoBot() {
  const countBefore = await countBots();
  const newIndex    = countBefore + 1; // rang du bot après création

  const name    = await pickUniqueBotName();
  const pool = getAllAssignableProfileIds();
  const profile = randomChoice(pool.length ? pool : ['balanced']);
  const email   = `bot_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}@nexuscore.bot`;

  const passwordHash = await bcrypt.hash(Math.random().toString(36).slice(2), 10);

  const result = await query(
    'INSERT INTO users (email, password_hash, display_name, role, elo) VALUES (?, ?, ?, ?, ?)',
    [email, passwordHash, name, 'player', 0]
  );
  const userId = Number(result.insertId);

  await query(
    'INSERT INTO user_wallet (user_id, credits, cores, gold, fragments) VALUES (?, ?, ?, ?, ?)',
    [userId, 2000, 0, 20000, 0]
  );

  await query(
    'INSERT INTO bot_profiles (user_id, profile, enabled) VALUES (?, ?, 1)',
    [userId, profile]
  );

  botLog(userId, `Auto-créé : "${name}" (profil: ${profile}, rang: #${newIndex})`);

  // Tous les BOTS_PER_GUILD bots → ce bot crée une nouvelle guilde
  if (newIndex % BOTS_PER_GUILD === 0) {
    try {
      const guildName = await pickUniqueGuildName();
      const { guild_id } = await createGuild(userId, guildName);
      botLog(userId, `Nouvelle guilde créée : "${guildName}" (id=${guild_id})`);
    } catch (err) {
      botLog(userId, `⚠ Échec création guilde : ${err.message}`);
    }
  }

  return { userId, name, profile, index: newIndex };
}

// ── Scheduler ────────────────────────────────────────────────────────────────

export function startAutoSpawner() {
  if (spawnInterval) return;

  // Premier bot créé après un délai de 10 s (laisser le serveur démarrer)
  setTimeout(() => {
    createAutoBot().catch((err) =>
      console.error('[BotAutoSpawner] Erreur création initiale :', err.message)
    );
  }, 10_000);

  spawnInterval = setInterval(() => {
    createAutoBot().catch((err) =>
      console.error('[BotAutoSpawner] Erreur création planifiée :', err.message)
    );
  }, SPAWN_INTERVAL_MS);

  console.log(`[BotAutoSpawner] Démarré — 1 bot toutes les ${SPAWN_INTERVAL_MS / 3_600_000}h`);
}

export function stopAutoSpawner() {
  if (spawnInterval) {
    clearInterval(spawnInterval);
    spawnInterval = null;
  }
}
