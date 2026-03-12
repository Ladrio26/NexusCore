import {
  createGuild,
  requestJoinGuild,
  cancelGuildJoinRequest,
  getGuildOverview,
  listGuilds,
  listManagedGuildRequests,
  acceptGuildJoinRequest,
  refuseGuildJoinRequest,
  updateGuildMemberRole,
  leaveGuild,
  addGuildCurrency
} from '../services/guildService.js';
import {
  getGuildPortalState,
  summonFromGuildPortal
} from '../services/guildPortalService.js';
import {
  getGuildChatMessages,
  sendGuildChatMessage
} from '../services/guildChatService.js';
import {
  getGuildNotifications,
  resolveUserGuildId
} from '../services/guildNotificationService.js';

function sendGuildError(reply, err) {
  const code = String(err?.code ?? '');
  if (code === 'INVALID_GUILD_NAME' || code === 'INVALID_GUILD_ID' || code === 'INVALID_GUILD_ROLE' || code === 'INVALID_MEMBER_ID') {
    return reply.code(400).send({ success: false, error: code, message: err.message });
  }
  if (code === 'ALREADY_IN_GUILD' || code === 'JOIN_REQUEST_ALREADY_PENDING' || code === 'GUILD_NAME_ALREADY_USED' || code === 'TARGET_ALREADY_IN_GUILD' || code === 'CANNOT_CHANGE_LEADER_ROLE' || code === 'INSUFFICIENT_GUILD_COINS' || code === 'INVALID_GUILD_CHAT_MESSAGE' || code === 'GUILD_CHAT_MESSAGE_TOO_LONG') {
    return reply.code(400).send({ success: false, error: code, message: err.message });
  }
  if (code === 'NOT_IN_GUILD' || code === 'INSUFFICIENT_PERMISSIONS') {
    return reply.code(403).send({ success: false, error: code, message: err.message });
  }
  if (code === 'GUILD_NOT_FOUND' || code === 'JOIN_REQUEST_NOT_FOUND' || code === 'GUILD_MEMBER_NOT_FOUND') {
    return reply.code(404).send({ success: false, error: code, message: err.message });
  }
  if (code === 'GUILD_PORTAL_ROTATION_INVALID' || code === 'INSUFFICIENT_UNITS_FOR_ROTATION') {
    return reply.code(500).send({ success: false, error: code, message: err.message });
  }
  return reply.code(500).send({ success: false, error: 'GUILD_SERVER_ERROR', message: err?.message || 'Erreur serveur.' });
}

export function registerGuildRoutes(fastify, authenticate, requireAdminUser) {
  const preAuth = { preHandler: [authenticate] };
  const preAdmin = { preHandler: [authenticate, requireAdminUser] };

  fastify.get('/guild/me', preAuth, async (request, reply) => {
    try {
      const overview = await getGuildOverview(request.user.id);
      return { success: true, ...overview };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild me error');
      return sendGuildError(reply, err);
    }
  });

  fastify.get('/guild/list', preAuth, async (_request, reply) => {
    try {
      return { success: true, guilds: await listGuilds() };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild list error');
      return sendGuildError(reply, err);
    }
  });

  fastify.post('/guild/create', preAuth, async (request, reply) => {
    try {
      const result = await createGuild(request.user.id, request.body?.name);
      return { success: true, ...result };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild create error');
      return sendGuildError(reply, err);
    }
  });

  fastify.post('/guild/request-join', preAuth, async (request, reply) => {
    try {
      const result = await requestJoinGuild(request.user.id, request.body?.guild_id);
      return { success: true, ...result };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild join request error');
      return sendGuildError(reply, err);
    }
  });

  fastify.post('/guild/request-cancel', preAuth, async (request, reply) => {
    try {
      const result = await cancelGuildJoinRequest(request.user.id);
      return { success: true, ...result };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild join request cancel error');
      return sendGuildError(reply, err);
    }
  });

  fastify.get('/guild/requests', preAuth, async (request, reply) => {
    try {
      const result = await listManagedGuildRequests(request.user.id);
      return { success: true, ...result };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild requests list error');
      return sendGuildError(reply, err);
    }
  });

  fastify.post('/guild/requests/:requestId/accept', preAuth, async (request, reply) => {
    try {
      const result = await acceptGuildJoinRequest(request.user.id, request.params?.requestId);
      return { success: true, ...result };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild request accept error');
      return sendGuildError(reply, err);
    }
  });

  fastify.post('/guild/requests/:requestId/refuse', preAuth, async (request, reply) => {
    try {
      const result = await refuseGuildJoinRequest(request.user.id, request.params?.requestId);
      return { success: true, ...result };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild request refuse error');
      return sendGuildError(reply, err);
    }
  });

  fastify.post('/guild/members/:memberUserId/role', preAuth, async (request, reply) => {
    try {
      const result = await updateGuildMemberRole(request.user.id, request.params?.memberUserId, request.body?.role);
      return { success: true, ...result };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild role update error');
      return sendGuildError(reply, err);
    }
  });

  fastify.post('/guild/leave', preAuth, async (request, reply) => {
    try {
      const result = await leaveGuild(request.user.id);
      return { success: true, ...result };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild leave error');
      return sendGuildError(reply, err);
    }
  });

  fastify.get('/guild/portal/rotation', preAuth, async (request, reply) => {
    try {
      const result = await getGuildPortalState(request.user.id);
      return { success: true, ...result };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild portal rotation error');
      return sendGuildError(reply, err);
    }
  });

  fastify.post('/guild/portal/summon', preAuth, async (request, reply) => {
    try {
      return await summonFromGuildPortal(request.user.id);
    } catch (err) {
      fastify.log?.error?.(err, 'Guild portal summon error');
      return sendGuildError(reply, err);
    }
  });

  fastify.get('/guild/chat/messages', preAuth, async (request, reply) => {
    try {
      return {
        success: true,
        messages: await getGuildChatMessages(request.user.id)
      };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild chat list error');
      return sendGuildError(reply, err);
    }
  });

  fastify.post('/guild/chat/send', preAuth, async (request, reply) => {
    try {
      const message = await sendGuildChatMessage(request.user.id, request.body?.message);
      return {
        success: true,
        message: 'Message envoyé.',
        data: message
      };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild chat send error');
      return sendGuildError(reply, err);
    }
  });

  fastify.get('/guild/notifications', preAuth, async (request, reply) => {
    try {
      const guildId = await resolveUserGuildId(request.user.id);
      if (!guildId) {
        return reply.code(403).send({ success: false, error: 'NOT_IN_GUILD', message: "Vous n'êtes dans aucune guilde." });
      }
      const notifications = await getGuildNotifications(guildId);
      return { success: true, notifications };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild notifications error');
      return sendGuildError(reply, err);
    }
  });

  fastify.post('/guild/dev/grant-coins', preAdmin, async (request, reply) => {
    try {
      const userId = Number(request.body?.user_id);
      const amount = Number(request.body?.amount);
      if (!Number.isInteger(userId) || userId < 1 || !Number.isFinite(amount)) {
        return reply.code(400).send({ success: false, error: 'INVALID_DEV_GRANT', message: 'user_id et amount sont requis.' });
      }
      const wallet = await addGuildCurrency(userId, amount);
      return {
        success: true,
        message: 'Monnaie de guilde modifiée.',
        user_id: userId,
        guild_coins: wallet.guild_coins
      };
    } catch (err) {
      fastify.log?.error?.(err, 'Guild dev grant coins error');
      return sendGuildError(reply, err);
    }
  });
}
