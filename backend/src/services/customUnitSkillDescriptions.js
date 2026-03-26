/**
 * Descriptions FR lisibles pour les compétences des unités Custom (effets data-driven).
 */

const PASSIVE_TRIGGER_FR = {
  ALWAYS: 'Toujours actif',
  ON_ATTACK: 'À chaque attaque',
  ON_KILL: 'Après un KO',
  ON_ALLY_RECEIVE_DAMAGE: 'Quand un allié subit des dégâts'
};

/**
 * @param {string} trigger
 * @returns {string}
 */
export function passiveTriggerFr(trigger) {
  const u = String(trigger || '')
    .toUpperCase()
    .trim();
  return PASSIVE_TRIGGER_FR[u] || u;
}

function targetFr(t) {
  const u = String(t || '').toUpperCase().trim();
  switch (u) {
    case 'ENEMY_SINGLE':
      return 'un ennemi';
    case 'ALLY_SINGLE':
      return 'un allié';
    case 'TEAM_ENEMY':
      return 'tous les ennemis';
    case 'TEAM_ALLY':
      return 'tous les alliés';
    case 'SELF':
      return 'soi-même';
    case 'LOWEST_HP_ALLY':
      return 'l’allié aux PV les plus bas';
    case 'ALLY_DEAD_SINGLE':
      return 'un allié mort';
    case 'TEAM_ALLY_DEAD':
      return 'tous les alliés morts';
    default:
      return 'une cible';
  }
}

const BUFF_VERB = {
  ATK_UP: "Augmente l'ATTAQUE",
  DEF_UP: 'Augmente la DÉFENSE',
  SPEED_UP: 'Augmente la VITESSE',
  SHIELD: 'Octroie un BOUCLIER',
  DEFEND: 'Octroie REDIRECTION',
  LIFESTEAL: 'Octroie LIFESTEAL',
  REGEN: 'Octroie REGENERATION',
  IMMUNITY: 'Octroie IMMUNITE',
  INVINCIBILITY: 'Octroie INVINCIBILITÉ',
  COUNTER_ATTACK: 'Octroie CONTRE-ATTAQUE',
  PROVOKE: 'Octroie PROVOCATION',
  DOT: 'Octroie un DoT',
  DEATH_MARK: 'Octroie une marque mortelle'
};

const DEBUFF_VERB = {
  ATK_DOWN: "Réduit l'ATTAQUE",
  DEF_DOWN: 'Réduit la DÉFENSE',
  SLOW: 'Réduit la VITESSE (ralentissement)',
  SILENCE: 'Réduit l’usage des compétences (silence)',
  STUN: 'Étourdit',
  BLIND: 'Aveugle',
  PROVOKE: 'Applique PROVOCATION',
  ANTI_HEAL: 'Applique ANTI-SOIN',
  ANTI_SHIELD: 'Applique ANTI-BOUCLIER',
  ANTI_BUFF: 'Applique ANTI-BUFF',
  DOT: 'Applique un DoT',
  DEATH_MARK: 'Applique une marque mortelle'
};

function pct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '';
  return `${Math.round(x * 100)}%`;
}

/**
 * @param {object} effect
 * @returns {string}
 */
export function describeEffectFr(effect) {
  if (!effect || typeof effect !== 'object') return '';
  const type = String(effect.type || '').toUpperCase();
  const tgt = targetFr(effect.target);

  switch (type) {
    case 'DAMAGE': {
      if (effect.percentMaxHp != null) {
        return `Inflige des dégâts (${pct(effect.percentMaxHp)} des PV max) à ${tgt}.`;
      }
      if (effect.percentMaxHpCaster != null) {
        return `Inflige des dégâts (${pct(effect.percentMaxHpCaster)} des PV max du lanceur) à ${tgt}.`;
      }
      if (effect.mult != null) {
        return `Inflige des dégâts (${pct(effect.mult)} ATQ) à ${tgt}.`;
      }
      return `Inflige des dégâts à ${tgt}.`;
    }
    case 'HEAL': {
      if (effect.percentMaxHp != null) {
        return `Soigne ${tgt} (${pct(effect.percentMaxHp)} des PV max).`;
      }
      if (effect.percentMaxHpCaster != null) {
        return `Soigne ${tgt} (${pct(effect.percentMaxHpCaster)} des PV max du lanceur).`;
      }
      if (effect.value != null) {
        return `Soigne ${tgt} (${effect.value} PV).`;
      }
      return `Soigne ${tgt}.`;
    }
    case 'APPLY_BUFF': {
      const bt = String(effect.buffType || '').toUpperCase();
      const verb = BUFF_VERB[bt] || `Applique ${bt}`;
      const dur =
        effect.remainingActions != null ? ` pendant ${effect.remainingActions} tour(s)` : '';
      return `${verb} sur ${tgt}${dur}.`;
    }
    case 'APPLY_DEBUFF': {
      const dt = String(effect.debuffType || '').toUpperCase();
      const verb = DEBUFF_VERB[dt] || `Applique ${dt}`;
      const dur =
        effect.remainingActions != null ? ` pendant ${effect.remainingActions} tour(s)` : '';
      const ch = effect.chance != null && effect.chance < 1 ? ` (${pct(effect.chance)} de chance)` : '';
      return `${verb} sur ${tgt}${dur}${ch}.`;
    }
    case 'STRIP': {
      const c = effect.count != null ? Number(effect.count) : null;
      if (c === 1) return `Retire un buff sur ${tgt}.`;
      return `Retire les buffs sur ${tgt}.`;
    }
    case 'CLEANSE': {
      const c = effect.count != null ? ` (jusqu’à ${effect.count})` : '';
      return `Retire tous les débuffs sur ${tgt}${c}.`;
    }
    case 'ATB_UP': {
      const p = effect.percent != null ? ` de ${pct(effect.percent)}` : '';
      return `Augmente l’ATB${p} sur ${tgt}.`;
    }
    case 'REDUCE_ATB': {
      const p = effect.percent != null ? ` de ${pct(effect.percent)}` : '';
      return `Réduit l’ATB${p} sur ${tgt}.`;
    }
    case 'CD_UP':
      return `Augmente le temps de recharge de ${effect.value ?? '?'} tour(s) sur ${tgt}.`;
    case 'CD_DOWN':
      return `Réduit le temps de recharge de ${effect.value ?? '?'} tour(s) sur ${tgt}.`;
    case 'RESET_SKILL_COOLDOWN':
      return `Réinitialise les temps de recharge sur ${tgt}.`;
    case 'SET_SKILL_COOLDOWN_MAX':
      return `Met tous les temps de recharge au maximum sur ${tgt}.`;
    case 'STEAL_STAT':
      return `Vole ${effect.percent ?? '?'}% de ${effect.stat ?? '?'} sur ${tgt} pendant ${effect.remainingActions ?? '?'} tour(s).`;
    case 'RESURRECT':
      return `Ressuscite ${tgt} avec ${effect.percentHp != null ? pct(effect.percentHp) + ' des PV max' : 'des PV'}.`;
    default:
      return `${type} sur ${tgt}.`;
  }
}

/**
 * @param {object[]} effects
 * @returns {string}
 */
export function buildSkillDescriptionFromEffectsFr(effects) {
  if (!Array.isArray(effects) || effects.length === 0) return '';
  const parts = effects.map((e) => describeEffectFr(e)).filter(Boolean);
  return parts.join(' ');
}

/**
 * Texte public : nom de la compétence, recharge ou déclencheur passif, puis effets détaillés.
 * @param {object} skill — entrée moteur ACTIVE ou PASSIVE
 * @returns {string}
 */
export function buildRichSkillDescriptionFr(skill) {
  if (!skill || typeof skill !== 'object') return '';
  const type = String(skill.type || '').toUpperCase();
  const body = buildSkillDescriptionFromEffectsFr(skill.effects || []);

  if (type === 'PASSIVE') {
    const trig = passiveTriggerFr(skill.trigger);
    const header = `Passif — Déclenchement : ${trig}.`;
    return body ? `${header} ${body}` : header;
  }

  if (type === 'ACTIVE') {
    const cd = Math.max(0, Number(skill.cd_actions ?? skill.cooldown ?? 0));
    const name = String(skill.name || 'Compétence active').trim();
    const cdPart = cd > 0 ? `${cd} tour${cd > 1 ? 's' : ''}` : '—';
    const header = `${name} — Recharge : ${cdPart}.`;
    return body ? `${header} ${body}` : header;
  }

  return body;
}

/**
 * Description attaque de base (monocible ennemi).
 */
export function describeBasicAttackFr(atkPercentLabel) {
  return `Attaque de base : inflige des dégâts (${atkPercentLabel}) à un ennemi.`;
}
