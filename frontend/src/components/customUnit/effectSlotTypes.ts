/** Une ligne d’effet : id + cible + modificateurs propres. */
export type EffectSlot = {
  id: string;
  target: string;
  modifiers: string[];
};

export type SkillBlock = {
  effects: EffectSlot[];
  cooldownModifier: number;
  type?: 'ACTIVE' | 'PASSIVE';
  passiveTrigger?: string;
  /** @deprecated rétrocompat */
  target?: string;
  /** @deprecated rétrocompat */
  modifiers?: string[];
};

/** Stats +10 % en spécialisation A ou B (comme les autres unités). */
export type SpecBonusStatKey = 'attack' | 'defense' | 'speed' | 'mastery' | 'maxHp';

/** Effet gratuit sur la compétence I (hors budget). */
export type Skill1SpecBonusKind = 'SELF_ATK' | 'SELF_DEF' | 'SELF_SPEED';

export type UnitConfig = {
  /** Si `false`, aucune compétence II en jeu (rétrocompat : absent = true). */
  hasSkill2?: boolean;
  skill1: SkillBlock;
  skill2: SkillBlock;
  /** Spé A : +10 % sur cette stat (units.specA_bonus_stat). */
  specAStat?: SpecBonusStatKey;
  /** Spé B : +10 % sur cette stat. */
  specBStat?: SpecBonusStatKey;
  /** Bonus compétence I : buff ATQ / DEF / VITESSE sur soi (hors budget). */
  skill1SpecBonus?: Skill1SpecBonusKind;
};
