import { query, withTransaction } from '../config/db.js';
import {
  createGuildNotification,
  GUILD_NOTIFICATION_TYPES
} from './guildNotificationService.js';

export const GUILD_ROLES = Object.freeze({
  LEADER: 'leader',
  OFFICER: 'officer',
  MEMBER: 'member'
});

const GUILD_ROLE_VALUES = Object.values(GUILD_ROLES);
const GUILD_NAME_MIN_LENGTH = 3;
const GUILD_NAME_MAX_LENGTH = 30;

function getRunner(executor = null) {
  return executor?.query ?? query;
}

function buildGuildError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function normalizeGuildName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim();
}

export function getGuildPermissions(role) {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  return {
    canManageRequests: normalizedRole === GUILD_ROLES.LEADER || normalizedRole === GUILD_ROLES.OFFICER,
    canManageMembers: normalizedRole === GUILD_ROLES.LEADER,
    canUsePortal: GUILD_ROLE_VALUES.includes(normalizedRole)
  };
}

export function validateGuildRole(role, { allowLeader = false } = {}) {
  const normalizedRole = String(role ?? '').trim().toLowerCase();
  const allowed = allowLeader ? GUILD_ROLE_VALUES : [GUILD_ROLES.OFFICER, GUILD_ROLES.MEMBER];
  if (!allowed.includes(normalizedRole)) {
    throw buildGuildError('INVALID_GUILD_ROLE', 'Rôle de guilde invalide.');
  }
  return normalizedRole;
}

export function validateGuildName(rawName) {
  const name = normalizeGuildName(rawName);
  if (!name) {
    throw buildGuildError('INVALID_GUILD_NAME', 'Le nom de guilde est requis.');
  }
  if (name.length < GUILD_NAME_MIN_LENGTH || name.length > GUILD_NAME_MAX_LENGTH) {
    throw buildGuildError(
      'INVALID_GUILD_NAME',
      `Le nom de guilde doit contenir entre ${GUILD_NAME_MIN_LENGTH} et ${GUILD_NAME_MAX_LENGTH} caractères.`
    );
  }
  return name;
}

export async function ensureGuildCurrency(userId, executor = null) {
  const runQuery = getRunner(executor);
  await runQuery(
    `INSERT INTO guild_currencies (user_id, guild_coins, updated_at)
     VALUES (?, 0, NOW())
     ON DUPLICATE KEY UPDATE updated_at = updated_at`,
    [userId]
  );
}

export async function getGuildCurrency(userId, executor = null) {
  const runQuery = getRunner(executor);
  await ensureGuildCurrency(userId, executor);
  const rows = await runQuery(
    'SELECT guild_coins, updated_at FROM guild_currencies WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return {
    guild_coins: Number(rows[0]?.guild_coins ?? 0),
    updated_at: rows[0]?.updated_at ?? null
  };
}

export async function setGuildCurrency(userId, amount, executor = null) {
  const runQuery = getRunner(executor);
  const normalizedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  await ensureGuildCurrency(userId, executor);
  await runQuery(
    'UPDATE guild_currencies SET guild_coins = ?, updated_at = NOW() WHERE user_id = ?',
    [normalizedAmount, userId]
  );
  return getGuildCurrency(userId, executor);
}

export async function addGuildCurrency(userId, delta, executor = null) {
  const runQuery = getRunner(executor);
  const normalizedDelta = Math.floor(Number(delta) || 0);
  await ensureGuildCurrency(userId, executor);
  await runQuery(
    'UPDATE guild_currencies SET guild_coins = GREATEST(0, guild_coins + ?), updated_at = NOW() WHERE user_id = ?',
    [normalizedDelta, userId]
  );
  return getGuildCurrency(userId, executor);
}

export async function getGuildMembership(userId, executor = null) {
  const runQuery = getRunner(executor);
  const rows = await runQuery(
    `SELECT gm.guild_id,
            gm.role,
            gm.joined_at,
            g.name AS guild_name,
            g.owner_user_id,
            g.created_at AS guild_created_at
     FROM guild_members gm
     JOIN guilds g ON g.id = gm.guild_id
     WHERE gm.user_id = ?
     LIMIT 1`,
    [userId]
  );
  const row = rows[0] ?? null;
  if (!row) return null;
  return {
    guild_id: Number(row.guild_id),
    role: String(row.role),
    joined_at: row.joined_at ?? null,
    guild: {
      id: Number(row.guild_id),
      name: row.guild_name,
      owner_user_id: Number(row.owner_user_id),
      created_at: row.guild_created_at ?? null
    }
  };
}

export async function getGuildById(guildId, executor = null) {
  const runQuery = getRunner(executor);
  const rows = await runQuery(
    'SELECT id, name, owner_user_id, created_at FROM guilds WHERE id = ? LIMIT 1',
    [guildId]
  );
  const row = rows[0] ?? null;
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name,
    owner_user_id: Number(row.owner_user_id),
    created_at: row.created_at ?? null
  };
}

export async function getActiveGuildJoinRequest(userId, executor = null) {
  const runQuery = getRunner(executor);
  const rows = await runQuery(
    `SELECT gjr.id,
            gjr.guild_id,
            gjr.created_at,
            g.name AS guild_name
     FROM guild_join_requests gjr
     JOIN guilds g ON g.id = gjr.guild_id
     WHERE gjr.user_id = ?
     LIMIT 1`,
    [userId]
  );
  const row = rows[0] ?? null;
  if (!row) return null;
  return {
    id: Number(row.id),
    guild_id: Number(row.guild_id),
    guild_name: row.guild_name,
    created_at: row.created_at ?? null
  };
}

export async function getGuildMembers(guildId, executor = null) {
  const runQuery = getRunner(executor);
  const rows = await runQuery(
    `SELECT gm.user_id,
            gm.role,
            gm.joined_at,
            u.display_name,
            u.avatar_url
     FROM guild_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.guild_id = ?
     ORDER BY FIELD(gm.role, 'leader', 'officer', 'member'), gm.joined_at ASC, u.display_name ASC`,
    [guildId]
  );
  return rows.map((row) => ({
    user_id: Number(row.user_id),
    display_name: row.display_name,
    avatar_url: row.avatar_url ?? null,
    role: String(row.role),
    joined_at: row.joined_at ?? null
  }));
}

export async function listGuilds(executor = null) {
  const runQuery = getRunner(executor);
  const rows = await runQuery(
    `SELECT g.id, g.name, g.owner_user_id, g.created_at, COUNT(gm.id) AS member_count
     FROM guilds g
     LEFT JOIN guild_members gm ON gm.guild_id = g.id
     GROUP BY g.id, g.name, g.owner_user_id, g.created_at
     ORDER BY member_count DESC, g.name ASC`
  );
  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    owner_user_id: Number(row.owner_user_id),
    created_at: row.created_at ?? null,
    member_count: Number(row.member_count ?? 0)
  }));
}

export async function getGuildJoinRequests(guildId, executor = null) {
  const runQuery = getRunner(executor);
  const rows = await runQuery(
    `SELECT gjr.id,
            gjr.guild_id,
            gjr.user_id,
            gjr.created_at,
            u.display_name,
            u.avatar_url
     FROM guild_join_requests gjr
     JOIN users u ON u.id = gjr.user_id
     WHERE gjr.guild_id = ?
     ORDER BY gjr.created_at ASC`,
    [guildId]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    guild_id: Number(row.guild_id),
    user_id: Number(row.user_id),
    display_name: row.display_name,
    avatar_url: row.avatar_url ?? null,
    created_at: row.created_at ?? null
  }));
}

export async function getGuildOverview(userId) {
  const membership = await getGuildMembership(userId);
  const guildCurrency = await getGuildCurrency(userId);
  if (!membership) {
    const activeJoinRequest = await getActiveGuildJoinRequest(userId);
    return {
      in_guild: false,
      guild: null,
      role: null,
      permissions: getGuildPermissions(null),
      members: [],
      guild_coins: guildCurrency.guild_coins,
      active_join_request: activeJoinRequest
    };
  }

  const members = await getGuildMembers(membership.guild_id);
  return {
    in_guild: true,
    guild: membership.guild,
    role: membership.role,
    permissions: getGuildPermissions(membership.role),
    members,
    guild_coins: guildCurrency.guild_coins,
    active_join_request: null
  };
}

export async function createGuild(userId, rawName) {
  const name = validateGuildName(rawName);
  let guildId = null;

  try {
    await withTransaction(async (tx) => {
      const membership = await getGuildMembership(userId, tx);
      if (membership) {
        throw buildGuildError('ALREADY_IN_GUILD', 'Vous êtes déjà dans une guilde.');
      }
      const activeJoinRequest = await getActiveGuildJoinRequest(userId, tx);
      if (activeJoinRequest) {
        throw buildGuildError('JOIN_REQUEST_ALREADY_PENDING', 'Vous avez déjà une demande en attente.');
      }

      const result = await tx.query(
        'INSERT INTO guilds (name, owner_user_id, created_at) VALUES (?, ?, NOW())',
        [name, userId]
      );
      guildId = Number(result.insertId);
      await tx.query(
        'INSERT INTO guild_members (guild_id, user_id, role, joined_at) VALUES (?, ?, ?, NOW())',
        [guildId, userId, GUILD_ROLES.LEADER]
      );
      await ensureGuildCurrency(userId, tx);
    });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw buildGuildError('GUILD_NAME_ALREADY_USED', 'Nom de guilde déjà utilisé.');
    }
    throw error;
  }

  return {
    message: 'Guilde créée avec succès.',
    guild_id: guildId,
    overview: await getGuildOverview(userId)
  };
}

export async function requestJoinGuild(userId, guildId) {
  const normalizedGuildId = Number(guildId);
  if (!Number.isInteger(normalizedGuildId) || normalizedGuildId < 1) {
    throw buildGuildError('INVALID_GUILD_ID', 'Guilde invalide.');
  }

  await withTransaction(async (tx) => {
    const membership = await getGuildMembership(userId, tx);
    if (membership) {
      throw buildGuildError('ALREADY_IN_GUILD', 'Vous êtes déjà dans une guilde.');
    }
    const activeJoinRequest = await getActiveGuildJoinRequest(userId, tx);
    if (activeJoinRequest) {
      throw buildGuildError('JOIN_REQUEST_ALREADY_PENDING', 'Vous avez déjà une demande en attente.');
    }
    const guild = await getGuildById(normalizedGuildId, tx);
    if (!guild) {
      throw buildGuildError('GUILD_NOT_FOUND', "Cette guilde n'existe pas.");
    }
    await tx.query(
      'INSERT INTO guild_join_requests (guild_id, user_id, created_at) VALUES (?, ?, NOW())',
      [normalizedGuildId, userId]
    );
  });

  return {
    message: "Demande d'adhésion envoyée.",
    overview: await getGuildOverview(userId)
  };
}

export async function cancelGuildJoinRequest(userId) {
  const deleted = await withTransaction(async (tx) => {
    const membership = await getGuildMembership(userId, tx);
    if (membership) {
      throw buildGuildError('ALREADY_IN_GUILD', 'Vous êtes déjà dans une guilde.');
    }
    const activeJoinRequest = await getActiveGuildJoinRequest(userId, tx);
    if (!activeJoinRequest) {
      throw buildGuildError('JOIN_REQUEST_NOT_FOUND', "Vous n'avez aucune demande en attente.");
    }
    await tx.query('DELETE FROM guild_join_requests WHERE id = ? AND user_id = ?', [activeJoinRequest.id, userId]);
    return true;
  });

  return {
    success: deleted,
    message: 'Demande annulée.',
    overview: await getGuildOverview(userId)
  };
}

async function getActorManagedGuildRequest(userId, requestId, executor = null) {
  const runQuery = getRunner(executor);
  const membership = await getGuildMembership(userId, executor);
  if (!membership) {
    throw buildGuildError('NOT_IN_GUILD', "Vous n'êtes dans aucune guilde.");
  }
  if (!getGuildPermissions(membership.role).canManageRequests) {
    throw buildGuildError('INSUFFICIENT_PERMISSIONS', 'Permissions insuffisantes.');
  }

  const rows = await runQuery(
    `SELECT gjr.id,
            gjr.guild_id,
            gjr.user_id,
            gjr.created_at,
            u.display_name,
            u.avatar_url
     FROM guild_join_requests gjr
     JOIN users u ON u.id = gjr.user_id
     WHERE gjr.id = ?
     LIMIT 1`,
    [requestId]
  );
  const request = rows[0] ?? null;
  if (!request) {
    throw buildGuildError('JOIN_REQUEST_NOT_FOUND', "Cette demande n'existe plus.");
  }
  if (Number(request.guild_id) !== Number(membership.guild_id)) {
    throw buildGuildError('INSUFFICIENT_PERMISSIONS', 'Permissions insuffisantes.');
  }
  return {
    membership,
    request: {
      id: Number(request.id),
      guild_id: Number(request.guild_id),
      user_id: Number(request.user_id),
      display_name: request.display_name,
      avatar_url: request.avatar_url ?? null,
      created_at: request.created_at ?? null
    }
  };
}

export async function listManagedGuildRequests(userId) {
  const membership = await getGuildMembership(userId);
  if (!membership) {
    throw buildGuildError('NOT_IN_GUILD', "Vous n'êtes dans aucune guilde.");
  }
  if (!getGuildPermissions(membership.role).canManageRequests) {
    throw buildGuildError('INSUFFICIENT_PERMISSIONS', 'Permissions insuffisantes.');
  }
  return {
    guild_id: membership.guild_id,
    requests: await getGuildJoinRequests(membership.guild_id)
  };
}

export async function acceptGuildJoinRequest(actorUserId, requestId) {
  let acceptedUserId = null;
  let guildId = null;

  await withTransaction(async (tx) => {
    const { membership, request } = await getActorManagedGuildRequest(actorUserId, requestId, tx);
    guildId = membership.guild_id;
    acceptedUserId = request.user_id;

    const existingMembershipRows = await tx.query(
      'SELECT guild_id FROM guild_members WHERE user_id = ? LIMIT 1',
      [request.user_id]
    );
    if (existingMembershipRows.length > 0) {
      throw buildGuildError('TARGET_ALREADY_IN_GUILD', 'Ce joueur est déjà dans une guilde.');
    }

    await tx.query(
      'INSERT INTO guild_members (guild_id, user_id, role, joined_at) VALUES (?, ?, ?, NOW())',
      [membership.guild_id, request.user_id, GUILD_ROLES.MEMBER]
    );
    await tx.query('DELETE FROM guild_join_requests WHERE id = ?', [request.id]);
    await ensureGuildCurrency(request.user_id, tx);
  });

  // Notification silencieuse (non-bloquante)
  if (guildId && acceptedUserId) {
    const usernameRows = await query(
      'SELECT display_name FROM users WHERE id = ? LIMIT 1',
      [acceptedUserId]
    ).catch(() => []);
    const username = usernameRows[0]?.display_name ?? 'Inconnu';
    void createGuildNotification(
      guildId, acceptedUserId,
      GUILD_NOTIFICATION_TYPES.MEMBER_JOIN,
      { username }
    );
  }

  return {
    message: 'Demande acceptée.',
    accepted_user_id: acceptedUserId,
    guild_id: guildId,
    requests: await getGuildJoinRequests(guildId)
  };
}

export async function refuseGuildJoinRequest(actorUserId, requestId) {
  let guildId = null;
  let refusedUserId = null;

  await withTransaction(async (tx) => {
    const { membership, request } = await getActorManagedGuildRequest(actorUserId, requestId, tx);
    guildId = membership.guild_id;
    refusedUserId = request.user_id;
    await tx.query('DELETE FROM guild_join_requests WHERE id = ?', [request.id]);
  });

  return {
    message: 'Demande refusée.',
    refused_user_id: refusedUserId,
    guild_id: guildId,
    requests: await getGuildJoinRequests(guildId)
  };
}

export async function updateGuildMemberRole(actorUserId, targetUserId, nextRole) {
  const normalizedTargetUserId = Number(targetUserId);
  if (!Number.isInteger(normalizedTargetUserId) || normalizedTargetUserId < 1) {
    throw buildGuildError('INVALID_MEMBER_ID', 'Membre invalide.');
  }
  const normalizedRole = validateGuildRole(nextRole, { allowLeader: false });
  let guildId = null;

  await withTransaction(async (tx) => {
    const actorMembership = await getGuildMembership(actorUserId, tx);
    if (!actorMembership) {
      throw buildGuildError('NOT_IN_GUILD', "Vous n'êtes dans aucune guilde.");
    }
    if (actorMembership.role !== GUILD_ROLES.LEADER) {
      throw buildGuildError('INSUFFICIENT_PERMISSIONS', 'Permissions insuffisantes.');
    }
    guildId = actorMembership.guild_id;

    const targetRows = await tx.query(
      `SELECT gm.guild_id, gm.user_id, gm.role
       FROM guild_members gm
       WHERE gm.user_id = ?
       LIMIT 1`,
      [normalizedTargetUserId]
    );
    const targetMembership = targetRows[0] ?? null;
    if (!targetMembership || Number(targetMembership.guild_id) !== Number(actorMembership.guild_id)) {
      throw buildGuildError('GUILD_MEMBER_NOT_FOUND', 'Ce membre ne fait pas partie de votre guilde.');
    }
    if (String(targetMembership.role) === GUILD_ROLES.LEADER) {
      throw buildGuildError('CANNOT_CHANGE_LEADER_ROLE', 'Impossible de modifier le rôle du leader.');
    }

    await tx.query(
      'UPDATE guild_members SET role = ? WHERE guild_id = ? AND user_id = ?',
      [normalizedRole, actorMembership.guild_id, normalizedTargetUserId]
    );
  });

  return {
    message: 'Rôle mis à jour.',
    guild_id: guildId,
    members: await getGuildMembers(guildId)
  };
}

/**
 * Permet au leader d'expulser un membre de la guilde.
 */
export async function kickGuildMember(actorUserId, targetUserId) {
  const normalizedTargetUserId = Number(targetUserId);
  if (!Number.isInteger(normalizedTargetUserId) || normalizedTargetUserId < 1) {
    throw buildGuildError('INVALID_MEMBER_ID', 'Membre invalide.');
  }
  if (Number(actorUserId) === normalizedTargetUserId) {
    throw buildGuildError('CANNOT_KICK_SELF', 'Vous ne pouvez pas vous expulser vous-même. Utilisez "Quitter la guilde".');
  }

  let guildId = null;

  await withTransaction(async (tx) => {
    const actorMembership = await getGuildMembership(actorUserId, tx);
    if (!actorMembership) {
      throw buildGuildError('NOT_IN_GUILD', "Vous n'êtes dans aucune guilde.");
    }
    if (actorMembership.role !== GUILD_ROLES.LEADER) {
      throw buildGuildError('INSUFFICIENT_PERMISSIONS', 'Seul le leader peut expulser des membres.');
    }
    guildId = actorMembership.guild_id;

    const targetRows = await tx.query(
      `SELECT guild_id, user_id, role FROM guild_members WHERE user_id = ? LIMIT 1`,
      [normalizedTargetUserId]
    );
    const targetMembership = targetRows[0] ?? null;
    if (!targetMembership || Number(targetMembership.guild_id) !== Number(guildId)) {
      throw buildGuildError('GUILD_MEMBER_NOT_FOUND', 'Ce membre ne fait pas partie de votre guilde.');
    }
    if (String(targetMembership.role) === GUILD_ROLES.LEADER) {
      throw buildGuildError('CANNOT_KICK_LEADER', "Impossible d'expulser le leader.");
    }

    await tx.query('DELETE FROM guild_members WHERE guild_id = ? AND user_id = ?', [guildId, normalizedTargetUserId]);
  });

  return {
    message: 'Membre expulsé de la guilde.',
    members: await getGuildMembers(guildId)
  };
}

/**
 * Permet à un utilisateur de quitter sa guilde.
 * Si le leader quitte et est seul : la guilde est supprimée.
 * Si le leader quitte et a des membres : le premier officier (ou membre) devient leader.
 */
export async function leaveGuild(userId) {
  const membership = await getGuildMembership(userId);
  if (!membership) {
    throw buildGuildError('NOT_IN_GUILD', "Vous n'êtes dans aucune guilde.");
  }

  await withTransaction(async (tx) => {
    const runQuery = getRunner(tx);
    const guildId = membership.guild_id;

    if (membership.role === GUILD_ROLES.LEADER) {
      const otherMembers = await runQuery(
        `SELECT user_id, role FROM guild_members
         WHERE guild_id = ? AND user_id != ?
         ORDER BY FIELD(role, ?, ?, ?)`,
        [guildId, userId, GUILD_ROLES.OFFICER, GUILD_ROLES.MEMBER, GUILD_ROLES.LEADER]
      );

      if (otherMembers.length === 0) {
        await runQuery('DELETE FROM guild_members WHERE guild_id = ?', [guildId]);
        await runQuery('DELETE FROM guild_join_requests WHERE guild_id = ?', [guildId]);
        await runQuery('DELETE FROM guilds WHERE id = ?', [guildId]);
        return;
      }

      const newLeaderId = Number(otherMembers[0].user_id);
      await runQuery('UPDATE guilds SET owner_user_id = ? WHERE id = ?', [newLeaderId, guildId]);
      await runQuery(
        'UPDATE guild_members SET role = ? WHERE guild_id = ? AND user_id = ?',
        [GUILD_ROLES.LEADER, guildId, newLeaderId]
      );
    }

    await runQuery('DELETE FROM guild_members WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  });

  return {
    message: 'Vous avez quitté la guilde.',
    overview: await getGuildOverview(userId)
  };
}
