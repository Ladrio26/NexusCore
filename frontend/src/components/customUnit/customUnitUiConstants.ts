/** Métadonnées UI pour le builder d’unité custom (aligné sur le backend). */

export type EffectCategory = 'DAMAGE' | 'HEAL' | 'BUFF' | 'DEBUFF' | 'CONTROL' | 'OTHER';

export const ROLE_LABELS: Record<string, string> = {
  dps: 'DPS',
  tank: 'Tank',
  support: 'Support',
  assassin: 'Assassin'
};

export const ELEMENT_LABELS: Record<string, string> = {
  fire: 'Feu',
  water: 'Eau',
  plant: 'Plante',
  light: 'Lumière',
  dark: 'Ténèbres'
};

/** Couleur sémantique (CustomDropdown / badges). */
export const CATEGORY_STYLE: Record<EffectCategory, { label: string; cssVar: string }> = {
  DAMAGE: { label: 'Dégâts', cssVar: '--cu-cat-damage' },
  HEAL: { label: 'Soin', cssVar: '--cu-cat-heal' },
  BUFF: { label: 'Buff', cssVar: '--cu-cat-buff' },
  DEBUFF: { label: 'Debuff', cssVar: '--cu-cat-debuff' },
  CONTROL: { label: 'Contrôle', cssVar: '--cu-cat-control' },
  OTHER: { label: 'Autre', cssVar: '--cu-cat-other' }
};

const DAMAGE_SET = new Set<string>([
  'DAMAGE',
  'DAMAGE_HP_CASTER',
  'DAMAGE_HP_TARGET',
  'DOT',
  'STEAL_STAT'
]);

const HEAL_SET = new Set<string>(['HEAL', 'RESURRECT', 'REGEN']);

const BUFF_SET = new Set<string>([
  'ATK_UP',
  'DEF_UP',
  'SPEED',
  'SHIELD',
  'IMMUNITY',
  'INVINCIBILITY',
  'CLEANSE_ONE',
  'CLEANSE_ALL',
  'DEFEND',
  'CD_DOWN_1',
  'CD_DOWN_2'
]);

const DEBUFF_SET = new Set<string>([
  'STRIP_ONE',
  'STRIP_ALL',
  'SILENCE',
  'PROVOKE',
  'ATK_DOWN',
  'DEF_DOWN',
  'SLOW',
  'ANTI_SHIELD',
  'ANTI_HEAL',
  'BLIND',
  'STUN',
  'ANTI_BUFF'
]);

const CONTROL_SET = new Set<string>([
  'ATB_UP_50',
  'ATB_UP_100',
  'REDUCE_ATB_50',
  'REDUCE_ATB_100',
  'RESET_SKILL_CD',
  'SET_SKILL_CD_MAX',
  'CD_UP_1',
  'CD_UP_2'
]);

export function getEffectCategory(effectId: string): EffectCategory {
  const id = String(effectId || '').toUpperCase();
  if (DAMAGE_SET.has(id)) return 'DAMAGE';
  if (HEAL_SET.has(id)) return 'HEAL';
  if (BUFF_SET.has(id)) return 'BUFF';
  if (DEBUFF_SET.has(id)) return 'DEBUFF';
  if (CONTROL_SET.has(id)) return 'CONTROL';
  return 'OTHER';
}

export const PRINCIPAL_TYPES: { id: EffectCategory | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'Tous types' },
  { id: 'DAMAGE', label: 'Dégâts' },
  { id: 'HEAL', label: 'Soin / vitalité' },
  { id: 'BUFF', label: 'Buffs' },
  { id: 'DEBUFF', label: 'Debuffs' },
  { id: 'CONTROL', label: 'Contrôle / tempo' }
];

/**
 * Libellé affiché dans les listes d’effets (phrase complète, durées alignées sur le moteur).
 * Effets à durée : 2 tours par défaut, 1 tour pour les plus puissants (stun, provoque, immunité, etc.).
 */
export const EFFECT_DISPLAY_LABELS: Record<string, string> = {
  DAMAGE: 'Inflige des dégâts basés sur l’ATQ',
  DAMAGE_HP_CASTER: 'Inflige des dégâts basés sur tes PV max',
  DAMAGE_HP_TARGET: 'Inflige des dégâts basés sur les PV max de la cible',
  HEAL: 'Soigne un pourcentage des PV max',
  RESURRECT: 'Ramène une unité morte à la vie',
  STRIP_ONE: 'Retire un buff ennemi',
  STRIP_ALL: 'Retire tous les buffs ennemis',
  CLEANSE_ONE: 'Retire un debuff allié',
  CLEANSE_ALL: 'Retire tous les debuffs alliés',
  ATB_UP_50: 'Augmente l’ATB de 50 %',
  ATB_UP_100: 'Augmente l’ATB de 100 %',
  REDUCE_ATB_50: 'Réduit l’ATB adverse de 50 %',
  REDUCE_ATB_100: 'Réduit l’ATB adverse de 100 %',
  RESET_SKILL_CD: 'Réinitialise les temps de recharge',
  SET_SKILL_CD_MAX: 'Met tous les temps de recharge au maximum',
  CD_UP_1: 'Augmente les temps de recharge (niveau 1)',
  CD_UP_2: 'Augmente fortement les temps de recharge (niveau 2)',
  CD_DOWN_1: 'Réduit les temps de recharge alliés / soi (niveau 1)',
  CD_DOWN_2: 'Réduit fortement les temps de recharge alliés / soi (niveau 2)',
  STEAL_STAT: 'Vole une partie d’une stat à la cible pendant 1 tour',
  DEFEND: 'Réduit les dégâts subis pendant 1 tour',
  ATK_UP: 'Augmente l’attaque pendant 2 tours',
  DEF_UP: 'Augmente la défense pendant 2 tours',
  SPEED: 'Augmente la vitesse pendant 2 tours',
  SHIELD: 'Octroie un Bouclier pendant 2 tours',
  IMMUNITY: 'Immunité aux debuffs pendant 1 tour',
  INVINCIBILITY: 'Invulnérabilité pendant 1 tour',
  REGEN: 'Octroie Régénération pendant 2 tours',
  DOT: 'Inflige des dégâts à chaque tour pendant 2 tours',
  SILENCE: 'Empêche les compétences pendant 2 tours',
  PROVOKE: 'Force la cible à vous attaquer pendant 1 tour',
  ATK_DOWN: 'Réduit l’attaque adverse pendant 2 tours',
  DEF_DOWN: 'Réduit la défense adverse pendant 1 tour',
  SLOW: 'Ralentit la cible pendant 2 tours',
  ANTI_SHIELD: 'Empêche les boucliers ennemis pendant 2 tours',
  ANTI_HEAL: 'Réduit les soins reçus pendant 2 tours',
  BLIND: 'Aveugle pendant 2 tours',
  STUN: 'Étourdit la cible pendant 1 tour',
  ANTI_BUFF: 'Empêche les buffs adverses pendant 2 tours'
};

export function formatEffectDisplayLabel(effectId: string): string {
  const id = String(effectId || '')
    .trim()
    .toUpperCase();
  if (!id) return '';
  return EFFECT_DISPLAY_LABELS[id] || id.replace(/_/g, ' ');
}

/** Descriptions courtes pour tooltips (lisibles en jeu). */
export const EFFECT_TOOLTIPS: Record<string, string> = {
  DAMAGE: 'Inflige des dégâts basés sur l’ATQ.',
  DAMAGE_HP_CASTER: 'Dégâts basés sur les PV max du lanceur.',
  DAMAGE_HP_TARGET: 'Dégâts basés sur les PV max de la cible.',
  HEAL: 'Soigne un pourcentage des PV max.',
  RESURRECT: 'Ramène une cible à la vie.',
  STRIP_ONE: 'Retire un buff ennemi.',
  STRIP_ALL: 'Retire tous les buffs ennemis.',
  CLEANSE_ONE: 'Retire un debuff allié.',
  CLEANSE_ALL: 'Retire tous les debuffs alliés.',
  ATB_UP_50: 'Augmente l’ATB de 50 %.',
  ATB_UP_100: 'Augmente l’ATB de 100 %.',
  REDUCE_ATB_50: 'Réduit l’ATB adverse de 50 %.',
  REDUCE_ATB_100: 'Réduit l’ATB adverse de 100 %.',
  RESET_SKILL_CD: 'Réinitialise les temps de recharge.',
  SET_SKILL_CD_MAX: 'Met tous les temps de recharge au maximum.',
  CD_UP_1: 'Augmente les temps de recharge.',
  CD_UP_2: 'Augmente fortement les temps de recharge.',
  CD_DOWN_1: 'Réduit les CD des alliés ou les vôtres.',
  CD_DOWN_2: 'Réduit fortement les CD des alliés ou les vôtres.',
  STEAL_STAT: 'Vole une stat à la cible.',
  DEFEND: 'Posture défensive temporaire.',
  ATK_UP: 'Augmente l’attaque.',
  DEF_UP: 'Augmente la défense.',
  SPEED: 'Augmente la vitesse.',
  SHIELD: 'Octroie un Bouclier basé sur les PV max.',
  IMMUNITY: 'Immunité aux debuffs.',
  INVINCIBILITY: 'Invulnérabilité courte.',
  REGEN: 'Octroie Régénération sur plusieurs tours.',
  DOT: 'Dégâts sur la durée.',
  SILENCE: 'Empêche les compétences.',
  PROVOKE: 'Force la cible à vous attaquer.',
  ATK_DOWN: 'Réduit l’attaque adverse.',
  DEF_DOWN: 'Réduit la défense adverse.',
  SLOW: 'Ralentit la cible.',
  ANTI_SHIELD: 'Empêche les boucliers.',
  ANTI_HEAL: 'Réduit les soins reçus.',
  BLIND: 'Aveugle la cible.',
  STUN: 'Étourdit la cible.',
  ANTI_BUFF: 'Bloque les buffs.'
};

export const MODIFIER_LABELS: Record<string, string> = {
  DURATION_1: 'Durée +1 tour',
  DURATION_2: 'Durée +2 tours',
  DAMAGE_20_PERCENT: 'Dégâts +20 %'
};

export const PASSIVE_TRIGGERS: { value: string; label: string }[] = [
  { value: 'ALWAYS', label: 'Toujours actif' },
  { value: 'ON_ATTACK', label: 'À chaque attaque' },
  { value: 'ON_KILL', label: 'Après un KO' },
  { value: 'ON_ALLY_RECEIVE_DAMAGE', label: 'Quand un allié subit des dégâts' }
];

/** Détermine le CD de la compétence : base 3 + value (0 = Standard, −1 = Rapide). */
export const COOLDOWN_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Standard (3 tours)' },
  { value: -1, label: 'Rapide (−1 tour) — 2 pts budget' }
];

export function formatTargetLabel(t: string): string {
  const map: Record<string, string> = {
    ENEMY_SINGLE: 'Ennemi unique',
    TEAM_ENEMY: 'Équipe ennemie',
    SELF: 'Soi-même',
    ALLY_SINGLE: 'Allié unique',
    TEAM_ALLY: 'Équipe alliée',
    ALLY_DEAD_SINGLE: 'Allié mort',
    TEAM_ALLY_DEAD: 'Équipe morte',
    LOWEST_HP_ALLY: 'Allié PV les plus bas'
  };
  return map[t] || t;
}
