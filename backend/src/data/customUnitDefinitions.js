/**
 * Définitions data-driven des arbres d’unités Custom (4 rôles).
 * Chaque nœud : clé unique, étape, groupe d’exclusivité, prérequis explicites.
 */

/** @typedef {{ nodeKey: string, role: string, skillSlot: number, step: number, groupId: string, labelFr: string, descriptionFr: string, requiresAll?: string[], requiresOneOf?: string[][], tag?: string, ruleIds?: string[] }} CustomTreeNode */

export const CUSTOM_ROLES = ['dps', 'tank', 'support', 'assassin'];

export const CUSTOM_ELEMENTS = ['fire', 'water', 'plant', 'light', 'dark'];

/** Stats de base (unité custom — budget de points). */
export const ROLE_BASE_STATS = {
  dps: {
    role: 'ranged',
    attack_type: 'ranged',
    archetype: 'DISTANCE',
    base_hp: 1100,
    base_attack: 190,
    base_defense: 90,
    base_speed: 110,
    mastery: 200,
    gameplay: 'DPS — distance, ATQ / tempo.'
  },
  tank: {
    role: 'tank',
    attack_type: 'melee',
    archetype: 'CAC_TANK',
    base_hp: 1500,
    base_attack: 150,
    base_defense: 130,
    base_speed: 100,
    mastery: 200,
    gameplay: 'Tank — CAC, PV / défense.'
  },
  support: {
    role: 'support',
    attack_type: 'ranged',
    archetype: 'DISTANCE',
    base_hp: 1250,
    base_attack: 170,
    base_defense: 100,
    base_speed: 115,
    mastery: 200,
    gameplay: 'Support — distance, vitesse / maîtrise.'
  },
  assassin: {
    role: 'assassin',
    attack_type: 'melee',
    archetype: 'CAC_DPS',
    base_hp: 1250,
    base_attack: 200,
    base_defense: 100,
    base_speed: 105,
    mastery: 200,
    gameplay: 'Assassin — CAC, burst / tempo.'
  }
};

/** Coût budget puissance (défaut data-driven). Les modes exclusifs valent 0. */
function defaultPowerCost(base) {
  if (base.powerCost != null) return Number(base.powerCost);
  const key = base.nodeKey || '';
  if (key.includes('_mode_')) return 0;
  const g = base.groupId || '';
  if (g.includes('_s4') || g.includes('_s1_s4')) return 2;
  return 1;
}

function n(base) {
  return {
    ...base,
    nodeKey: base.nodeKey,
    role: base.role,
    skillSlot: base.skillSlot,
    step: base.step,
    groupId: base.groupId,
    labelFr: base.labelFr,
    descriptionFr: base.descriptionFr,
    requiresAll: base.requiresAll,
    requiresOneOf: base.requiresOneOf,
    tag: base.tag,
    ruleIds: base.ruleIds,
    powerCost: defaultPowerCost(base)
  };
}

function buildDpsNodes() {
  /** @type {CustomTreeNode[]} */
  const out = [];
  const s1t = [
    ['SINGLE_TARGET_CD2', 'Monocible', 'Recharge 2 tours.'],
    ['SINGLE_TARGET_HP_PERCENT_CD3', 'Monocible % PV max', 'Dégâts basés sur les PV max, CD 3.'],
    ['AOE_CD3', 'Zone', 'Frappe plusieurs ennemis, CD 3.'],
    ['DOT_CD3', 'DoT', 'Dégâts sur la durée, CD 3.'],
    ['AOE_HP_PERCENT_CD4', 'Zone % PV max', 'Zone + % PV max, CD 4.']
  ];
  for (const [key, label, desc] of s1t) {
    out.push(
      n({
        nodeKey: `dps_s1_s1_${key}`,
        role: 'dps',
        skillSlot: 1,
        step: 1,
        groupId: 'dps_s1_s1',
        labelFr: label,
        descriptionFr: desc,
        tag: 'S1_TYPE'
      })
    );
  }
  const s1m = [
    ['BURST', 'Burst', '+20 % dégâts sur la compétence.', 'BURST'],
    ['DEBUFF', 'Debuff', 'Applique Réduction d’ATQ ou de DEF.', 'DEBUFF'],
    ['TEMPO', 'Tempo', 'Réduit l’ATB adverse ou ralentit.', 'TEMPO']
  ];
  for (const [key, label, desc, tag] of s1m) {
    out.push(
      n({
        nodeKey: `dps_s1_s2_${key}`,
        role: 'dps',
        skillSlot: 1,
        step: 2,
        groupId: 'dps_s1_s2',
        labelFr: label,
        descriptionFr: desc,
        tag,
        requiresOneOf: [['dps_s1_s1_SINGLE_TARGET_CD2', 'dps_s1_s1_SINGLE_TARGET_HP_PERCENT_CD3', 'dps_s1_s1_AOE_CD3', 'dps_s1_s1_DOT_CD3', 'dps_s1_s1_AOE_HP_PERCENT_CD4']]
      })
    );
  }
  const burstSpec = [
    ['MORE_DAMAGE', '+ dégâts', 'Renforce encore les dégâts.'],
    ['CD_REDUCTION', '−1 recharge', 'Réduit le temps de recharge (sauf sur AoE / % PV max).', ['no_cd_red_on_aoe_hp']]
  ];
  for (const [key, label, desc, rules] of burstSpec) {
    out.push(
      n({
        nodeKey: `dps_s1_s3_${key}`,
        role: 'dps',
        skillSlot: 1,
        step: 3,
        groupId: 'dps_s1_s3',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['dps_s1_s2_BURST']],
        ruleIds: rules
      })
    );
  }
  const debuffSpec = [
    ['EXTRA_DURATION', '+ durée', 'Effets négatifs plus longs.'],
    ['IGNORE_RESIST', 'Ignore résistance', 'Ignore une partie de la résistance adverse.']
  ];
  for (const [key, label, desc] of debuffSpec) {
    out.push(
      n({
        nodeKey: `dps_s1_s3_${key}`,
        role: 'dps',
        skillSlot: 1,
        step: 3,
        groupId: 'dps_s1_s3',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['dps_s1_s2_DEBUFF']]
      })
    );
  }
  const tempoSpec = [
    ['SELF_ATB_UP', 'ATB personnel', 'Gagne de la jauge d’action.'],
    ['EXTRA_SLOW_DURATION', 'Slow durable', 'Ralentissement prolongé.']
  ];
  for (const [key, label, desc] of tempoSpec) {
    out.push(
      n({
        nodeKey: `dps_s1_s3_${key}`,
        role: 'dps',
        skillSlot: 1,
        step: 3,
        groupId: 'dps_s1_s3',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['dps_s1_s2_TEMPO']]
      })
    );
  }

  out.push(
    n({
      nodeKey: 'dps_s2_mode_active',
      role: 'dps',
      skillSlot: 2,
      step: 1,
      groupId: 'dps_s2_mode',
      labelFr: 'Compétence 2 active',
      descriptionFr: 'Deuxième compétence active (buff / tempo).',
      tag: 'S2_ACTIVE'
    }),
    n({
      nodeKey: 'dps_s2_mode_passive',
      role: 'dps',
      skillSlot: 2,
      step: 1,
      groupId: 'dps_s2_mode',
      labelFr: 'Compétence 2 passive',
      descriptionFr: 'Passif déclenché en combat.',
      tag: 'S2_PASSIVE'
    })
  );
  const s2a = [
    ['ATK_BUFF', 'Augmentation d’ATQ', 'Buff d’attaque sur allié ou soi.'],
    ['ATB_UP', 'Gain d’ATB', 'Accélère la jauge (allié ou soi).'],
    ['SPEED_BUFF', 'Vitesse', 'Augmente la vitesse.']
  ];
  for (const [key, label, desc] of s2a) {
    out.push(
      n({
        nodeKey: `dps_s2_act_${key}`,
        role: 'dps',
        skillSlot: 2,
        step: 2,
        groupId: 'dps_s2_pick',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['dps_s2_mode_active']],
        ruleIds: ['warn_atb_stacking']
      })
    );
  }
  const s2p = [
    ['LIFESTEAL', 'Vol de vie', 'Soigne une partie des dégâts infligés.'],
    ['ATB_ON_HIT', 'ATB au coup', 'Gagne de l’ATB en frappant (1× par action).', ['atb_on_hit_cap']],
    ['ATB_ON_KILL', 'ATB au KO', 'Gagne de l’ATB en éliminant (1× par tour).', ['atb_on_kill_cap']]
  ];
  for (const [key, label, desc, rules] of s2p) {
    out.push(
      n({
        nodeKey: `dps_s2_pas_${key}`,
        role: 'dps',
        skillSlot: 2,
        step: 2,
        groupId: 'dps_s2_pick',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['dps_s2_mode_passive']],
        ruleIds: rules || undefined
      })
    );
  }
  return out;
}

function buildTankNodes() {
  const out = [];
  const s1 = [
    ['SHIELD', 'Bouclier', 'Protège des dégâts.'],
    ['PROVOKE', 'Provocation', 'Force les ennemis à vous cibler.'],
    ['AOE_CONTROL', 'Contrôle de zone', 'Impact de zone avec contrôle.'],
    ['REGEN', 'Régénération', 'Soin sur la durée.']
  ];
  for (const [key, label, desc] of s1) {
    out.push(
      n({
        nodeKey: `tank_s1_s1_${key}`,
        role: 'tank',
        skillSlot: 1,
        step: 1,
        groupId: 'tank_s1_s1',
        labelFr: label,
        descriptionFr: desc
      })
    );
  }
  const s2 = [
    ['PURE_TANK', 'Pur tank', 'Shield renforcé / défense.'],
    ['CONTROL', 'Contrôle', 'Provocation / ralentissement.'],
    ['SUSTAIN', 'Soutien', 'Soin et régénération.']
  ];
  for (const [key, label, desc] of s2) {
    out.push(
      n({
        nodeKey: `tank_s1_s2_${key}`,
        role: 'tank',
        skillSlot: 1,
        step: 2,
        groupId: 'tank_s1_s2',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['tank_s1_s1_SHIELD', 'tank_s1_s1_PROVOKE', 'tank_s1_s1_AOE_CONTROL', 'tank_s1_s1_REGEN']]
      })
    );
  }
  const s3pure = [
    ['SHIELD_HP_SCALING', 'Bouclier % PV', 'Le bouclier scale sur les PV max.'],
    ['BONUS_DEF', 'Défense', 'Bonus défense temporaire.']
  ];
  for (const [key, label, desc] of s3pure) {
    out.push(
      n({
        nodeKey: `tank_s1_s3_${key}`,
        role: 'tank',
        skillSlot: 1,
        step: 3,
        groupId: 'tank_s1_s3',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['tank_s1_s2_PURE_TANK']]
      })
    );
  }
  const s3ctrl = [
    ['AOE_PROVOKE', 'Provocation de zone', 'Zone de provocation.'],
    ['AOE_SLOW', 'Ralentissement de zone', 'Ralentit plusieurs cibles.'],
    ['AOE_SILENCE_1T', 'Silence 1 tour', 'Silence court sur zone.']
  ];
  for (const [key, label, desc] of s3ctrl) {
    out.push(
      n({
        nodeKey: `tank_s1_s3_${key}`,
        role: 'tank',
        skillSlot: 1,
        step: 3,
        groupId: 'tank_s1_s3',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['tank_s1_s2_CONTROL']]
      })
    );
  }
  const s3sus = [
    ['REGEN_PERCENT', 'Régén %', 'Régénération en % PV.'],
    ['HEAL_ON_HIT', 'Soin au coup', 'Soigne en frappant.'],
    ['ALLY_HEAL', 'Soin allié', 'Soigne un allié ciblé.']
  ];
  for (const [key, label, desc] of s3sus) {
    out.push(
      n({
        nodeKey: `tank_s1_s3_${key}`,
        role: 'tank',
        skillSlot: 1,
        step: 3,
        groupId: 'tank_s1_s3',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['tank_s1_s2_SUSTAIN']]
      })
    );
  }
  const s4 = [
    ['BIG_DAMAGE_REDUCTION_1T', 'Réduction dégâts massives', 'Réduction importante 1 tour (remplace invulnérabilité).'],
    ['MASSIVE_AOE_SHIELD', 'Bouclier de zone', 'Grand bouclier de groupe.'],
    ['LIGHT_REVIVE', 'Résurrection légère', 'Relève un allié avec peu de PV.']
  ];
  for (const [key, label, desc] of s4) {
    out.push(
      n({
        nodeKey: `tank_s1_s4_${key}`,
        role: 'tank',
        skillSlot: 1,
        step: 4,
        groupId: 'tank_s1_s4',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [
          [
            'tank_s1_s3_SHIELD_HP_SCALING',
            'tank_s1_s3_BONUS_DEF',
            'tank_s1_s3_AOE_PROVOKE',
            'tank_s1_s3_AOE_SLOW',
            'tank_s1_s3_AOE_SILENCE_1T',
            'tank_s1_s3_REGEN_PERCENT',
            'tank_s1_s3_HEAL_ON_HIT',
            'tank_s1_s3_ALLY_HEAL'
          ]
        ]
      })
    );
  }

  out.push(
    n({
      nodeKey: 'tank_s2_mode_active',
      role: 'tank',
      skillSlot: 2,
      step: 1,
      groupId: 'tank_s2_mode',
      labelFr: 'Compétence 2 active',
      descriptionFr: 'Support défensif actif.'
    }),
    n({
      nodeKey: 'tank_s2_mode_passive',
      role: 'tank',
      skillSlot: 2,
      step: 1,
      groupId: 'tank_s2_mode',
      labelFr: 'Compétence 2 passive',
      descriptionFr: 'Réactions passives.'
    })
  );
  const t2a = [
    ['ALLY_SHIELD', 'Bouclier allié', 'Protège un allié.'],
    ['CLEANSE', 'Purification', 'Retire des débuffs.'],
    ['AOE_HEAL', 'Soin de zone', 'Soigne l’équipe.'],
    ['ANTI_BUFF', 'Anti-buff', 'Empêche les buffs ennemis.']
  ];
  for (const [key, label, desc] of t2a) {
    out.push(
      n({
        nodeKey: `tank_s2_act_${key}`,
        role: 'tank',
        skillSlot: 2,
        step: 2,
        groupId: 'tank_s2_pick',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['tank_s2_mode_active']]
      })
    );
  }
  const t2p = [
    ['ATB_ON_RECEIVE_DAMAGE', 'ATB sous dégâts', 'Gagne de l’ATB en encaissant des coups.'],
    ['ATB_ON_ALLY_DEATH', 'ATB si allié tombe', 'Réaction quand un allié meurt.']
  ];
  for (const [key, label, desc] of t2p) {
    out.push(
      n({
        nodeKey: `tank_s2_pas_${key}`,
        role: 'tank',
        skillSlot: 2,
        step: 2,
        groupId: 'tank_s2_pick',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['tank_s2_mode_passive']]
      })
    );
  }
  return out;
}

function buildSupportNodes() {
  const out = [];
  const s1 = [
    ['HEAL_SINGLE', 'Soin monocible', 'Soin fort sur une cible.'],
    ['HEAL_AOE', 'Soin de zone', 'Soin multiple cibles.'],
    ['ATB_BOOST', 'Poussée ATB', 'Accélère les alliés.'],
    ['CONTROL', 'Contrôle', 'Stun / silence.']
  ];
  for (const [key, label, desc] of s1) {
    out.push(
      n({
        nodeKey: `support_s1_s1_${key}`,
        role: 'support',
        skillSlot: 1,
        step: 1,
        groupId: 'support_s1_s1',
        labelFr: label,
        descriptionFr: desc
      })
    );
  }
  const s2 = [
    ['SUSTAIN', 'Soutien', 'Soins renforcés.'],
    ['CONTROL_BR', 'Contrôle', 'CC renforcé.'],
    ['BUFF', 'Buff', 'ATK / DEF / Immunité.']
  ];
  for (const [key, label, desc] of s2) {
    out.push(
      n({
        nodeKey: `support_s1_s2_${key}`,
        role: 'support',
        skillSlot: 1,
        step: 2,
        groupId: 'support_s1_s2',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['support_s1_s1_HEAL_SINGLE', 'support_s1_s1_HEAL_AOE', 'support_s1_s1_ATB_BOOST', 'support_s1_s1_CONTROL']]
      })
    );
  }
  const sus = [
    ['STRONGER_AOE_HEAL', 'Soin de zone ++', 'Zone plus efficace.'],
    ['STRONGER_SINGLE_HEAL', 'Soin ciblé ++', 'Monocible amplifié.']
  ];
  for (const [key, label, desc] of sus) {
    out.push(
      n({
        nodeKey: `support_s1_s3_${key}`,
        role: 'support',
        skillSlot: 1,
        step: 3,
        groupId: 'support_s1_s3',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['support_s1_s2_SUSTAIN']]
      })
    );
  }
  const ctrl = [
    ['EXTRA_CHANCE', 'Chance ++', 'Plus de chances d’appliquer le contrôle.'],
    ['EXTRA_DURATION', 'Durée ++', 'Contrôle plus long.'],
    ['MULTI_TARGET', 'Multi-cibles', 'Toucher plusieurs ennemis.']
  ];
  for (const [key, label, desc] of ctrl) {
    out.push(
      n({
        nodeKey: `support_s1_s3_${key}`,
        role: 'support',
        skillSlot: 1,
        step: 3,
        groupId: 'support_s1_s3',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['support_s1_s2_CONTROL_BR']]
      })
    );
  }
  const buff = [
    ['BUFF_EXTRA_DURATION', 'Buff durable', 'Durée des buffs augmentée.'],
    ['BUFF_EXTRA_AREA', 'Zone élargie', 'Buffs sur plus de cibles.'],
    ['BUFF_BONUS_EFFECT', 'Effet bonus', 'Effet additionnel sur les buffs.']
  ];
  for (const [key, label, desc] of buff) {
    out.push(
      n({
        nodeKey: `support_s1_s3_${key}`,
        role: 'support',
        skillSlot: 1,
        step: 3,
        groupId: 'support_s1_s3',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['support_s1_s2_BUFF']]
      })
    );
  }
  const s4 = [
    ['FULL_CLEANSE', 'Purif complète', 'Retire beaucoup de débuffs.'],
    ['ALLY_CD_MINUS_1', 'CD −1 allié', 'Réduit un cooldown allié.'],
    ['AOE_IMMUNITY', 'Immunité de zone', 'Protection courte groupe.'],
    ['DOUBLE_BUFF', 'Double buff', 'Applique deux buffs distincts.']
  ];
  for (const [key, label, desc] of s4) {
    out.push(
      n({
        nodeKey: `support_s1_s4_${key}`,
        role: 'support',
        skillSlot: 1,
        step: 4,
        groupId: 'support_s1_s4',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [
          [
            'support_s1_s3_STRONGER_AOE_HEAL',
            'support_s1_s3_STRONGER_SINGLE_HEAL',
            'support_s1_s3_EXTRA_CHANCE',
            'support_s1_s3_EXTRA_DURATION',
            'support_s1_s3_MULTI_TARGET',
            'support_s1_s3_BUFF_EXTRA_DURATION',
            'support_s1_s3_BUFF_EXTRA_AREA',
            'support_s1_s3_BUFF_BONUS_EFFECT'
          ]
        ]
      })
    );
  }

  out.push(
    n({
      nodeKey: 'support_s2_mode_active',
      role: 'support',
      skillSlot: 2,
      step: 1,
      groupId: 'support_s2_mode',
      labelFr: 'Compétence 2 active',
      descriptionFr: 'Soutien actif.'
    }),
    n({
      nodeKey: 'support_s2_mode_passive',
      role: 'support',
      skillSlot: 2,
      step: 1,
      groupId: 'support_s2_mode',
      labelFr: 'Compétence 2 passive',
      descriptionFr: 'Aura / passif.'
    })
  );
  const s2a = [
    ['HEAL', 'Soin', 'Soin ciblé ou zone.'],
    ['BUFF', 'Buff', 'Renforce les stats.'],
    ['CLEANSE', 'Purif', 'Retire des altérations.'],
    ['SHIELD', 'Bouclier', 'Protège des dégâts.']
  ];
  for (const [key, label, desc] of s2a) {
    out.push(
      n({
        nodeKey: `support_s2_act_${key}`,
        role: 'support',
        skillSlot: 2,
        step: 2,
        groupId: 'support_s2_pick',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['support_s2_mode_active']]
      })
    );
  }
  const s2p = [
    ['SPEED_AURA', 'Aura de vitesse', 'Bonus de vitesse passif.'],
    ['HEAL_AURA', 'Aura de soin', 'Soins légers passifs.'],
    ['DEBUFF_RESIST_AURA', 'Résistance aux débuffs', 'Réduit l’impact des débuffs.'],
    ['PASSIVE_ATB_GAIN', 'Gain d’ATB passif', 'Petit gain d’ATB récurrent.']
  ];
  for (const [key, label, desc] of s2p) {
    out.push(
      n({
        nodeKey: `support_s2_pas_${key}`,
        role: 'support',
        skillSlot: 2,
        step: 2,
        groupId: 'support_s2_pick',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['support_s2_mode_passive']]
      })
    );
  }
  return out;
}

function buildAssassinNodes() {
  const out = [];
  const s1 = [
    ['MONO_BURST', 'Burst monocible', 'Gros dégâts sur une cible.'],
    ['HIT_PLUS_TANK', 'Anti-tank', 'Bonus contre les tanks.'],
    ['HIT_PLUS_SPEED', 'Anti-vitesse', 'Bonus contre les rapides.']
  ];
  for (const [key, label, desc] of s1) {
    out.push(
      n({
        nodeKey: `assassin_s1_s1_${key}`,
        role: 'assassin',
        skillSlot: 1,
        step: 1,
        groupId: 'assassin_s1_s1',
        labelFr: label,
        descriptionFr: desc
      })
    );
  }
  const s2 = [
    ['BURST', 'Burst', 'Dégâts purs.'],
    ['CONTROL', 'Contrôle', 'Silence / stun.'],
    ['SURVIVE', 'Survie', 'Soin / bouclier / défense.']
  ];
  for (const [key, label, desc] of s2) {
    out.push(
      n({
        nodeKey: `assassin_s1_s2_${key}`,
        role: 'assassin',
        skillSlot: 1,
        step: 2,
        groupId: 'assassin_s1_s2',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['assassin_s1_s1_MONO_BURST', 'assassin_s1_s1_HIT_PLUS_TANK', 'assassin_s1_s1_HIT_PLUS_SPEED']]
      })
    );
  }
  const burst = [
    ['EXTREME_DAMAGE', 'Dégâts extrêmes', 'Pic de dégâts élevé.'],
    ['REDUCE_DEF', 'Réduction DEF', 'Réduit la défense ennemie.'],
    ['LIGHT_SPLASH_DAMAGE', 'Splash léger', 'Petits dégâts collatéraux.']
  ];
  for (const [key, label, desc] of burst) {
    out.push(
      n({
        nodeKey: `assassin_s1_s3_${key}`,
        role: 'assassin',
        skillSlot: 1,
        step: 3,
        groupId: 'assassin_s1_s3',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['assassin_s1_s2_BURST']]
      })
    );
  }
  const ctrl = [
    ['SILENCE', 'Silence', 'Empêche les compétences.'],
    ['STUN', 'Étourdir', 'Empêche l’action.'],
    ['ANTI_BUFF', 'Anti-buff', 'Bloque les buffs.']
  ];
  for (const [key, label, desc] of ctrl) {
    out.push(
      n({
        nodeKey: `assassin_s1_s3_${key}`,
        role: 'assassin',
        skillSlot: 1,
        step: 3,
        groupId: 'assassin_s1_s3',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['assassin_s1_s2_CONTROL']]
      })
    );
  }
  const surv = [
    ['SELF_HEAL', 'Soin personnel', 'Récupère des PV.'],
    ['SELF_SHIELD', 'Bouclier perso', 'Protection personnelle.'],
    ['BONUS_DEF', 'Défense', 'Réduit les dégâts subis.']
  ];
  for (const [key, label, desc] of surv) {
    out.push(
      n({
        nodeKey: `assassin_s1_s3_${key}`,
        role: 'assassin',
        skillSlot: 1,
        step: 3,
        groupId: 'assassin_s1_s3',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['assassin_s1_s2_SURVIVE']]
      })
    );
  }
  const s4 = [
    ['RESET_CD_ON_KILL', 'Reset au KO', 'Réduit ou réinitialise un CD après élimination.', ['assassin_reset_cd_cap']],
    ['BIG_ATB_GAIN', 'Gros gain ATB', 'Pic d’ATB (pas double tour).', ['warn_no_double_turn']],
    ['BONUS_ATB', 'Bonus ATB', 'Gain d’ATB modéré.']
  ];
  for (const [key, label, desc, rules] of s4) {
    out.push(
      n({
        nodeKey: `assassin_s1_s4_${key}`,
        role: 'assassin',
        skillSlot: 1,
        step: 4,
        groupId: 'assassin_s1_s4',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [
          [
            'assassin_s1_s3_EXTREME_DAMAGE',
            'assassin_s1_s3_REDUCE_DEF',
            'assassin_s1_s3_LIGHT_SPLASH_DAMAGE',
            'assassin_s1_s3_SILENCE',
            'assassin_s1_s3_STUN',
            'assassin_s1_s3_ANTI_BUFF',
            'assassin_s1_s3_SELF_HEAL',
            'assassin_s1_s3_SELF_SHIELD',
            'assassin_s1_s3_BONUS_DEF'
          ]
        ],
        ruleIds: rules
      })
    );
  }

  out.push(
    n({
      nodeKey: 'assassin_s2_mode_active',
      role: 'assassin',
      skillSlot: 2,
      step: 1,
      groupId: 'assassin_s2_mode',
      labelFr: 'Compétence 2 active',
      descriptionFr: 'Outil offensif ou contrôle.'
    }),
    n({
      nodeKey: 'assassin_s2_mode_passive',
      role: 'assassin',
      skillSlot: 2,
      step: 1,
      groupId: 'assassin_s2_mode',
      labelFr: 'Compétence 2 passive',
      descriptionFr: 'Passif offensif.'
    })
  );
  const a2a = [
    ['DAMAGE', 'Dégâts', 'Dégâts bruts.'],
    ['TANK', 'Tankbuster', 'Bonus contre les tanks.'],
    ['SILENCE', 'Silence', 'Court silence.'],
    ['ANTI_HEAL', 'Anti-soin', 'Réduit les soins ennemis.']
  ];
  for (const [key, label, desc] of a2a) {
    out.push(
      n({
        nodeKey: `assassin_s2_act_${key}`,
        role: 'assassin',
        skillSlot: 2,
        step: 2,
        groupId: 'assassin_s2_pick',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['assassin_s2_mode_active']]
      })
    );
  }
  const a2p = [
    ['BONUS_ATB', 'ATB passif', 'Petit gain d’ATB.'],
    ['BONUS_SPEED', 'Vitesse', 'Bonus de vitesse passif.'],
    ['CD_REDUCTION', 'Réduction CD', 'Compétences plus fréquentes.', ['assassin_passive_cd_soft']]
  ];
  for (const [key, label, desc, rules] of a2p) {
    out.push(
      n({
        nodeKey: `assassin_s2_pas_${key}`,
        role: 'assassin',
        skillSlot: 2,
        step: 2,
        groupId: 'assassin_s2_pick',
        labelFr: label,
        descriptionFr: desc,
        requiresOneOf: [['assassin_s2_mode_passive']],
        ruleIds: rules || undefined
      })
    );
  }
  return out;
}

let _cache = null;

export function getAllCustomTreeNodes() {
  if (!_cache) {
    _cache = [...buildDpsNodes(), ...buildTankNodes(), ...buildSupportNodes(), ...buildAssassinNodes()];
  }
  return _cache;
}

export function getNodesByRole(role) {
  const r = String(role || '').toLowerCase();
  return getAllCustomTreeNodes().filter((x) => x.role === r);
}

export function getNodeByKey(nodeKey) {
  return getAllCustomTreeNodes().find((x) => x.nodeKey === nodeKey) ?? null;
}
