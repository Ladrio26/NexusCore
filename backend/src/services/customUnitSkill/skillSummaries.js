/**
 * Résumés gameplay (lisibles) séparés des descriptions techniques (effets).
 */

const GAMEPLAY = {
  dps: {
    BURST: 'Pic de dégâts brut, idéal pour éliminer une priorité rapidement.',
    DEBUFF: 'Affaiblit les statistiques adverses tout en frappant.',
    TEMPO: 'Ralentit la jauge adverse et impose un rythme favorable.',
    Buff: 'Renforce un allié pour des fenêtres de burst coordonnées.',
    Tempo: 'Accélère la jauge : plus d’actions, plus de pression.',
    Sustain: 'Récupère des PV en infligeant des dégâts : tenue de ligne.',
    DoT: 'Dégâts sur la durée pour punir les équipes défensives.'
  },
  tank: {
    Tank: 'Occupe le front, protège l’équipe et impose le focus ennemi.',
    Control: 'Contrôle la mêlée par provocation, ralentissement ou silence.',
    Protection: 'Renforce les boucliers et la résistance collective.',
    Sustain: 'Stabilise les PV par soins ou régénération.',
    Support: 'Apporte purification ou soin ponctuel aux alliés.'
  },
  support: {
    Support: 'Renforce les alliés par soins, buffs ou contrôle.',
    Sustain: 'Maintient les PV et la tenue du groupe.',
    Control: 'Bloque ou retarde les menaces clés.',
    Buff: 'Amplifie les stats pour des pics de dégâts ou de survie.',
    Protection: 'Réduit les dégâts subis par les alliés.',
    Tempo: 'Accélère le rythme du combat côté alliés.'
  },
  assassin: {
    Burst: 'Élimination rapide d’une cible prioritaire.',
    Control: 'Coupe les sorts ou la mobilité adverse.',
    Sustain: 'Survit mieux tout en restant offensif.',
    Tempo: 'Gagne du rythme pour enchaîner les menaces.'
  }
};

function tagBlurbs(role, tags) {
  const r = GAMEPLAY[String(role).toLowerCase()] || {};
  const out = [];
  for (const t of tags || []) {
    if (r[t]) out.push(r[t]);
  }
  if (out.length === 0 && tags?.length) {
    return [`Profil : ${tags.join(', ')}.`];
  }
  return out;
}

/**
 * @param {object} skill — ACTIVE ou PASSIVE (moteur)
 * @param {{ role?: string, slot?: number }} ctx
 * @returns {{ technical: string, gameplayHint: string, tags: string[] }}
 */
export function generateSkillSummary(skill, ctx = {}) {
  const desc = String(skill?.description || '').trim();
  const tags = [];
  const eff = skill?.effects || [];
  for (const e of eff) {
    const t = String(e?.type || '').toUpperCase();
    if (t === 'DAMAGE') {
      if (e.target === 'TEAM_ENEMY') tags.push('AoE');
      else tags.push('Burst');
    }
    if (t === 'HEAL' || t === 'APPLY_BUFF') {
      const bt = String(e.buffType || '').toUpperCase();
      if (bt === 'REGEN' || t === 'HEAL') tags.push('Sustain');
      if (bt === 'SHIELD' || bt === 'DEF_UP') tags.push('Protection');
    }
    if (t === 'APPLY_DEBUFF') tags.push('Control');
    if (t === 'ATB_UP') tags.push('Tempo');
  }
  const uniq = [...new Set(tags)];
  const role = ctx.role;
  const hints = tagBlurbs(role, uniq);
  const gameplayHint = hints[0] || (desc ? 'Compétence polyvalente adaptée à votre build.' : '—');
  return {
    technical: desc,
    gameplayHint,
    tags: uniq
  };
}

/**
 * @param {string} role
 * @param {string[]} roleTags — tags agrégés (Burst, Tank…)
 * @param {{ totalPower?: number, maxPower?: number }} power
 */
export function buildGameplayPitch(role, roleTags, power = {}) {
  const r = String(role).toLowerCase();
  const base =
    {
      dps: 'Profil offensif : pression continue et pics de dégâts.',
      tank: 'Profil défensif : contrôle de la mêlée et protection d’équipe.',
      support: 'Profil d’appoint : soins, tempo et renforts tactiques.',
      assassin: 'Profil d’élimination : ciblage prioritaire et contrôle court.'
    }[r] || 'Build personnalisé selon vos choix.';
  const tagLine = roleTags?.length ? `Axes : ${[...new Set(roleTags)].join(', ')}.` : '';
  const p = Number(power.totalPower ?? 0);
  const m = Number(power.maxPower ?? 8);
  const powLine = m ? `Charge d’arbre : ${p} / ${m}.` : '';
  return [base, tagLine, powLine].filter(Boolean).join(' ');
}
