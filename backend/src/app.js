import Fastify from 'fastify';
import path from 'path';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { ensureDatabaseSchema, getPool } from './config/db.js';
import { authMiddleware } from './middleware/auth.js';
import { requireAdminUser } from './middleware/requireAdminUser.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerRankedRoutes } from './routes/ranked.js';
import { registerBattleRoutes } from './routes/battle.js';
import { registerCollectionRoutes } from './routes/collection.js';
import { registerTeamRoutes } from './routes/team.js';
import { registerGachaRoutes } from './routes/gacha.js';
import { registerUnitsRoutes } from './routes/units.js';
import { registerSanctuaryRoutes } from './routes/sanctuary.js';
import { registerCampaignRoutes } from './routes/campaign.js';
import { registerLeaderboardRoutes } from './routes/leaderboard.js';
import { registerPvpRoutes } from './routes/pvp.js';
import { registerArtifactRoutes } from './routes/artifacts.js';
import { registerGuildRoutes } from './routes/guild.js';
import { registerGuildWarRoutes } from './routes/guildWar.js';
import { registerFeedbackRoutes } from './routes/feedback.js';
import { registerNotificationsRoutes } from './routes/notifications.js';
import { startGuildWarCron } from './services/guildWarCronService.js';

export async function buildApp({ logger = true } = {}) {
  const fastify = Fastify({ logger });

  await ensureDatabaseSchema();

  fastify.decorate('authenticate', authMiddleware);

  await fastify.register(cors, { origin: true });
  await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/'
  });
  await fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), '..', 'personnages'),
    prefix: '/personnages/',
    decorateReply: false
  });

  fastify.get('/health', async () => {
    const conn = await getPool();
    await conn.query('SELECT 1');
    return { status: 'ok' };
  });

  registerAuthRoutes(fastify);
  registerProfileRoutes(fastify, authMiddleware);
  registerRankedRoutes(fastify, authMiddleware);
  registerBattleRoutes(fastify, authMiddleware);
  registerCollectionRoutes(fastify, authMiddleware);
  registerTeamRoutes(fastify, authMiddleware);
  registerGachaRoutes(fastify, authMiddleware);
  registerUnitsRoutes(fastify, authMiddleware);
  registerSanctuaryRoutes(fastify, authMiddleware);
  registerCampaignRoutes(fastify, authMiddleware);
  registerLeaderboardRoutes(fastify, authMiddleware);
  registerPvpRoutes(fastify, authMiddleware);
  registerArtifactRoutes(fastify, authMiddleware);
  registerGuildRoutes(fastify, authMiddleware, requireAdminUser);
  registerGuildWarRoutes(fastify, authMiddleware);
  registerAdminRoutes(fastify, authMiddleware, requireAdminUser);
  registerFeedbackRoutes(fastify, authMiddleware, requireAdminUser);
  registerNotificationsRoutes(fastify, authMiddleware);

  startGuildWarCron();

  return fastify;
}
