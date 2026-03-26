import {
  buildCustomUnitPreview,
  buildCustomUnitPreviewFromConfig
} from '../services/customUnitBuilder.js';
import { getAllCustomTreeNodes, getNodesByRole, CUSTOM_ELEMENTS } from '../data/customUnitDefinitions.js';
import { getCustomUnitByUserId, createCustomUnit, updateCustomUnit } from '../services/customUnitService.js';
import {
  EFFECT_BASE_COSTS,
  MODIFIER_COSTS,
  ROLE_POINT_BUDGET,
  TARGET_COST_MULTIPLIER_BY_TARGET,
  RECHARGE_RAPIDE_BUDGET_COST
} from '../data/customUnitPointCosts.js';
import {
  VALID_SPEC_BONUS_STATS,
  VALID_SKILL1_SPEC_BONUS
} from '../data/customUnitSpecializationConfig.js';

const pre = { preHandler: [] };

export function registerCustomUnitRoutes(fastify, authenticate, requireAdminUser) {
  pre.preHandler = [authenticate, requireAdminUser];

  fastify.get('/custom-unit/tree', pre, async (request) => {
    const role = request.query?.role;
    const nodes = role ? getNodesByRole(String(role)) : getAllCustomTreeNodes();
    return { nodes };
  });

  fastify.get('/custom-unit/me', pre, async (request) => {
    const userId = request.user.id;
    const cu = await getCustomUnitByUserId(userId);
    return { customUnit: cu };
  });

  fastify.get('/custom-unit/preview', pre, async (request, reply) => {
    const q = request.query || {};
    const role = q.role;
    const element = q.element;
    let selectedKeys = [];
    try {
      selectedKeys = JSON.parse(q.keys || '[]');
    } catch {
      return reply.code(400).send({ error: 'INVALID_KEYS', message: 'Paramètre keys JSON invalide.' });
    }
    if (!Array.isArray(selectedKeys)) selectedKeys = [];
    return buildCustomUnitPreview(role, element, selectedKeys);
  });

  /** Preview budget points (corps JSON : { role, element, config }). */
  fastify.post('/custom-unit/preview', pre, async (request, reply) => {
    const body = request.body || {};
    const { role, element, config } = body;
    if (!config || typeof config !== 'object') {
      return reply.code(400).send({ error: 'INVALID_CONFIG', message: 'Le champ config est requis (objet).' });
    }
    return buildCustomUnitPreviewFromConfig(role, element, config);
  });

  /** Listes pour l’UI (coûts, budgets, éléments). */
  fastify.get('/custom-unit/options', pre, async () => ({
    elements: CUSTOM_ELEMENTS,
    roles: Object.keys(ROLE_POINT_BUDGET),
    roleBudgets: ROLE_POINT_BUDGET,
    effectCosts: EFFECT_BASE_COSTS,
    modifierCosts: MODIFIER_COSTS,
    targetMultipliers: TARGET_COST_MULTIPLIER_BY_TARGET,
    rechargeRapideBudgetCost: RECHARGE_RAPIDE_BUDGET_COST,
    specBonusStats: VALID_SPEC_BONUS_STATS,
    skill1SpecBonusChoices: VALID_SKILL1_SPEC_BONUS,
    engineTargets: [
      'ENEMY_SINGLE',
      'TEAM_ENEMY',
      'SELF',
      'ALLY_SINGLE',
      'TEAM_ALLY',
      'ALLY_DEAD_SINGLE',
      'TEAM_ALLY_DEAD',
      'LOWEST_HP_ALLY'
    ]
  }));

  fastify.post('/custom-unit/create', pre, async (request, reply) => {
    const body = request.body || {};
    try {
      const result = await createCustomUnit(request.user.id, {
        name: body.name,
        role: body.role,
        element: body.element,
        selectedKeys: body.selectedKeys || [],
        config: body.config
      });
      const cu = await getCustomUnitByUserId(request.user.id);
      return { ok: true, ...result, customUnit: cu };
    } catch (err) {
      if (err.code === 'VALIDATION') {
        return reply.code(400).send({ error: 'VALIDATION', message: err.message, details: err.details });
      }
      if (err.code === 'ALREADY_EXISTS') {
        return reply.code(409).send({ error: 'ALREADY_EXISTS', message: err.message });
      }
      request.log?.error?.(err, 'custom-unit create');
      return reply.code(500).send({ error: 'CREATE_FAILED', message: err.message });
    }
  });

  fastify.post('/custom-unit/update', pre, async (request, reply) => {
    const body = request.body || {};
    try {
      await updateCustomUnit(request.user.id, {
        name: body.name,
        role: body.role,
        element: body.element,
        selectedKeys: body.selectedKeys || [],
        config: body.config
      });
      const cu = await getCustomUnitByUserId(request.user.id);
      return { ok: true, customUnit: cu };
    } catch (err) {
      if (err.code === 'VALIDATION') {
        return reply.code(400).send({ error: 'VALIDATION', message: err.message, details: err.details });
      }
      if (err.code === 'NOT_FOUND') {
        return reply.code(404).send({ error: 'NOT_FOUND', message: err.message });
      }
      if (err.code === 'LOCKED') {
        return reply.code(403).send({ error: 'LOCKED', message: err.message });
      }
      request.log?.error?.(err, 'custom-unit update');
      return reply.code(500).send({ error: 'UPDATE_FAILED', message: err.message });
    }
  });
}
