import { query, withTransaction } from '../config/db.js';
import { getGuildMembership } from './guildService.js';

export const GUILD_CHAT_MAX_MESSAGES = 50;
export const GUILD_CHAT_MAX_LENGTH = 500;

function getRunner(executor = null) {
  return executor?.query ?? query;
}

function buildGuildChatError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeGuildChatMessage(message) {
  return String(message ?? '').trim();
}

async function getGuildChatMessageById(messageId, executor = null) {
  const runQuery = getRunner(executor);
  const rows = await runQuery(
    `SELECT gcm.id AS message_id,
            gcm.guild_id,
            gcm.user_id,
            gcm.message,
            gcm.created_at,
            u.display_name AS username,
            u.avatar_url
     FROM guild_chat_messages gcm
     JOIN users u ON u.id = gcm.user_id
     WHERE gcm.id = ?
     LIMIT 1`,
    [messageId]
  );
  const row = rows[0] ?? null;
  if (!row) return null;
  return {
    message_id: Number(row.message_id),
    guild_id: Number(row.guild_id),
    user_id: Number(row.user_id),
    username: row.username,
    avatar_url: row.avatar_url ?? null,
    message: row.message,
    created_at: row.created_at ?? null
  };
}

export async function getGuildChatMessages(userId) {
  const membership = await getGuildMembership(userId);
  if (!membership) {
    throw buildGuildChatError('NOT_IN_GUILD', "Vous devez être dans une guilde pour accéder au chat.");
  }

  const rows = await query(
    `SELECT gcm.id AS message_id,
            gcm.guild_id,
            gcm.user_id,
            gcm.message,
            gcm.created_at,
            u.display_name AS username,
            u.avatar_url
     FROM guild_chat_messages gcm
     JOIN users u ON u.id = gcm.user_id
     WHERE gcm.guild_id = ?
     ORDER BY gcm.created_at DESC, gcm.id DESC
     LIMIT ?`,
    [membership.guild_id, GUILD_CHAT_MAX_MESSAGES]
  );

  return rows.reverse().map((row) => ({
    message_id: Number(row.message_id),
    guild_id: Number(row.guild_id),
    user_id: Number(row.user_id),
    username: row.username,
    avatar_url: row.avatar_url ?? null,
    message: row.message,
    created_at: row.created_at ?? null
  }));
}

export async function sendGuildChatMessage(userId, rawMessage) {
  const message = normalizeGuildChatMessage(rawMessage);
  if (!message) {
    throw buildGuildChatError('INVALID_GUILD_CHAT_MESSAGE', 'Le message ne peut pas être vide.');
  }
  if (message.length > GUILD_CHAT_MAX_LENGTH) {
    throw buildGuildChatError('GUILD_CHAT_MESSAGE_TOO_LONG', `Le message ne peut pas dépasser ${GUILD_CHAT_MAX_LENGTH} caractères.`);
  }

  let messageId = null;

  await withTransaction(async (tx) => {
    const membership = await getGuildMembership(userId, tx);
    if (!membership) {
      throw buildGuildChatError('NOT_IN_GUILD', "Vous devez être dans une guilde pour écrire dans le chat.");
    }

    const insertResult = await tx.query(
      'INSERT INTO guild_chat_messages (guild_id, user_id, message, created_at) VALUES (?, ?, ?, NOW())',
      [membership.guild_id, userId, message]
    );
    messageId = Number(insertResult.insertId);

    await tx.query(
      `DELETE FROM guild_chat_messages
       WHERE guild_id = ?
         AND id NOT IN (
           SELECT id FROM (
             SELECT id
             FROM guild_chat_messages
             WHERE guild_id = ?
             ORDER BY created_at DESC, id DESC
             LIMIT ?
           ) AS recent_messages
         )`,
      [membership.guild_id, membership.guild_id, GUILD_CHAT_MAX_MESSAGES]
    );
  });

  return getGuildChatMessageById(messageId);
}
