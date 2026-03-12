import { query } from '../config/db.js';
import { ascendUnit } from '../services/ascensionService.js';

export function registerUnitsRoutes(fastify, authenticate) {
  fastify.get('/bestiary', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user?.id;
    if (userId == null) {
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
    const units = await query(
      `SELECT id, code, name, rarity, role, attack_type, element, archetype,
              base_hp, base_attack, base_defense, base_speed, mastery, image_url,
              traits, skill_data, specA_bonus_stat, specB_bonus_stat,
              specA_skill_modifier, specB_skill_modifier, specA_passive, specB_passive
       FROM units
       WHERE code NOT LIKE 'BOSS_CH%'
       ORDER BY rarity, name`
    );
    const owned = await query(
      'SELECT DISTINCT unit_id FROM user_units WHERE user_id = ?',
      [userId]
    );
    const ownedUnitIds = owned.map((r) => Number(r.unit_id));
    // MariaDB renvoie les colonnes JSON en string ; on normalise en objet pour le frontend
    const parseJson = (v) => {
      if (v == null) return null;
      if (typeof v === 'object') return v;
      if (typeof v !== 'string') return v;
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    };
    return {
      units: units.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        rarity: r.rarity,
        role: r.role,
        attack_type: r.attack_type,
        element: r.element,
        archetype: r.archetype,
        base_hp: r.base_hp,
        base_attack: r.base_attack,
        base_defense: r.base_defense,
        base_speed: r.base_speed,
        mastery: r.mastery ?? 0,
        image_url: r.image_url ?? null,
        traits: parseJson(r.traits),
        skill_data: parseJson(r.skill_data),
        specA_bonus_stat: r.specA_bonus_stat,
        specB_bonus_stat: r.specB_bonus_stat,
        specA_skill_modifier: parseJson(r.specA_skill_modifier),
        specB_skill_modifier: parseJson(r.specB_skill_modifier),
        specA_passive: parseJson(r.specA_passive),
        specB_passive: parseJson(r.specB_passive)
      })),
      ownedUnitIds
    };
  });

  fastify.post('/units/ascend', { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user?.id;
    if (userId == null) {
      return reply.code(401).send({ success: false, error: 'UNAUTHORIZED' });
    }
    const { userUnitId, specChoice } = request.body || {};
    if (userUnitId == null || specChoice == null) {
      return reply.code(400).send({
        success: false,
        error: 'BAD_REQUEST',
        message: 'userUnitId et specChoice ("A" ou "B") requis.'
      });
    }
    const result = await ascendUnit(userId, userUnitId, specChoice);
    if (!result.success) {
      const code = result.error === 'FORBIDDEN' ? 403 : result.error === 'USER_UNIT_NOT_FOUND' ? 404 : 400;
      return reply.code(code).send({
        success: false,
        error: result.error,
        message: result.message ?? null
      });
    }
    return { success: true, userUnit: result.userUnit, message: result.message };
  });
}
