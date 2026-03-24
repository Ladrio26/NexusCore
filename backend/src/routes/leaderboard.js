import { query } from '../config/db.js';
import { getSeasonKey } from '../services/campaignService.js';

export function registerLeaderboardRoutes(fastify, authenticate) {
  fastify.get(
    '/leaderboard',
    { preHandler: [authenticate] },
    async (request) => {
      const q = request.query || {};
      let page = Number(q.page) || 1;
      if (!Number.isFinite(page) || page < 1) page = 1;
      const rawBoard = String(q.board || 'rank').toLowerCase();
      const board = rawBoard === 'campaign' || rawBoard === 'guild' ? rawBoard : 'rank';
      let limit = Number(q.limit) || 200;
      if (!Number.isFinite(limit) || limit <= 0) limit = 200;
      if (limit > 200) limit = 200;
      const offset = (page - 1) * limit;

      if (board === 'campaign') {
        const seasonKey = getSeasonKey();
        const rows = await query(
          `SELECT u.id, u.display_name, u.avatar_url,
                  COALESCE(h.max_cleared_score, 0) AS max_cleared_score,
                  COALESCE(n.hard_unlocked, 0) AS hard_unlocked
           FROM users u
           LEFT JOIN (
             SELECT user_id, MAX(chapter * 100 + stage) AS max_cleared_score
             FROM campaign_progress_hard
             WHERE season_key = ? AND cleared = 1
             GROUP BY user_id
           ) h ON h.user_id = u.id
           LEFT JOIN (
             SELECT user_id, MAX(CASE WHEN chapter = 5 AND stage = 10 AND cleared = 1 THEN 1 ELSE 0 END) AS hard_unlocked
             FROM campaign_progress_normal
             GROUP BY user_id
           ) n ON n.user_id = u.id`,
          [seasonKey]
        );

        function computeUnlockedScore(hardUnlocked, maxClearedScore) {
          const unlocked = Number(hardUnlocked ?? 0) > 0;
          const clearedScore = Number(maxClearedScore ?? 0);
          if (!unlocked) return 0;
          if (clearedScore <= 0) return 101;
          const chapter = Math.floor(clearedScore / 100);
          const stage = clearedScore % 100;
          if (chapter >= 10 && stage >= 10) return 1010;
          if (stage >= 10) return (chapter + 1) * 100 + 1;
          return chapter * 100 + stage + 1;
        }

        function formatUnlockedLabel(score) {
          const normalized = Number(score ?? 0);
          if (normalized <= 0) return 'Verrouillé';
          const chapter = Math.floor(normalized / 100);
          const stage = normalized % 100;
          return `Chap. ${chapter}-${stage}`;
        }

        const sorted = rows
          .map((r) => {
            const unlockedScore = computeUnlockedScore(r.hard_unlocked, r.max_cleared_score);
            return {
              id: Number(r.id),
              pseudo: r.display_name,
              avatar_url: r.avatar_url ?? null,
              unlocked_score: unlockedScore,
              campaign_label: formatUnlockedLabel(unlockedScore)
            };
          })
          .sort((a, b) => b.unlocked_score - a.unlocked_score || a.pseudo.localeCompare(b.pseudo, 'fr'));

        const paged = sorted.slice(offset, offset + limit).map((r, idx) => ({
          ...r,
          rank: offset + idx + 1
        }));
        const total = sorted.length;
        const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

        return {
          board,
          players: paged,
          page,
          limit,
          total,
          totalPages
        };
      }

      if (board === 'guild') {
        const [rows, countRows] = await Promise.all([
          query(
            `SELECT g.id, g.name,
                    COALESCE(e.elo, 1000) AS guild_elo,
                    COALESCE(e.wins, 0) AS wins,
                    COALESCE(e.losses, 0) AS losses,
                    COALESCE(e.draws, 0) AS draws,
                    COUNT(gm.user_id) AS member_count
             FROM guilds g
             LEFT JOIN guild_elo e ON e.guild_id = g.id
             LEFT JOIN guild_members gm ON gm.guild_id = g.id
             GROUP BY g.id, g.name, e.elo, e.wins, e.losses, e.draws
             HAVING COUNT(gm.user_id) > 0
             ORDER BY guild_elo DESC, wins DESC, g.name ASC
             LIMIT ? OFFSET ?`,
            [limit, offset]
          ),
          query(
            `SELECT COUNT(*) AS total
             FROM guilds g
             WHERE EXISTS (SELECT 1 FROM guild_members gm WHERE gm.guild_id = g.id)`
          )
        ]);

        const players = rows.map((r, idx) => ({
          id: Number(r.id),
          pseudo: r.name,
          elo: Number(r.guild_elo ?? 1000),
          rank: offset + idx + 1,
          wins: Number(r.wins ?? 0),
          losses: Number(r.losses ?? 0),
          draws: Number(r.draws ?? 0),
          member_count: Number(r.member_count ?? 0)
        }));

        const total = Number(countRows[0]?.total ?? 0);
        const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

        return {
          board,
          players,
          page,
          limit,
          total,
          totalPages
        };
      }

      const [rows, countRows] = await Promise.all([
        query(
          `SELECT u.id, u.display_name, u.pvp_elo, u.avatar_url,
                  (SELECT g.name FROM guild_members gm
                   JOIN guilds g ON g.id = gm.guild_id
                   WHERE gm.user_id = u.id
                   LIMIT 1) AS guild_name
           FROM users u
           ORDER BY u.pvp_elo DESC, u.display_name ASC
           LIMIT ? OFFSET ?`,
          [limit, offset]
        ),
        query('SELECT COUNT(*) AS total FROM users')
      ]);

      const players = rows.map((r, idx) => {
        const rawGuild = r.guild_name ?? r.Guild_name ?? r.GUILD_NAME;
        return {
          id: Number(r.id),
          pseudo: r.display_name,
          elo: Number(r.pvp_elo ?? 0),
          rank: offset + idx + 1,
          avatar_url: r.avatar_url ?? null,
          guild_name: rawGuild != null && rawGuild !== '' ? String(rawGuild).trim() : null
        };
      });

      const total = Number(countRows[0]?.total ?? 0);
      const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

      return {
        board,
        players,
        page,
        limit,
        total,
        totalPages
      };
    }
  );
}
