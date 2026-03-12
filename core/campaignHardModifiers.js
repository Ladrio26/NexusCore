const HARD_CHAPTER_MODIFIERS = Object.freeze({
  1: [{ element: 'plant', percent: 10 }],
  2: [{ element: 'water', percent: 10 }],
  3: [{ element: 'fire', percent: 10 }],
  4: [{ element: 'plant', percent: 10 }, { element: 'water', percent: -10 }],
  5: [{ element: 'water', percent: 10 }, { element: 'fire', percent: -10 }],
  6: [{ element: 'fire', percent: 10 }, { element: 'plant', percent: -10 }],
  7: [{ element: 'water', percent: -15 }],
  8: [{ element: 'fire', percent: -15 }],
  9: [{ element: 'plant', percent: -15 }],
  10: [{ element: 'all', percent: -20 }]
});

const ELEMENT_LABELS_FR = Object.freeze({
  water: 'Eau',
  fire: 'Feu',
  plant: 'Plante',
  all: 'Toutes les unités'
});

const MODIFIABLE_STAT_KEYS = Object.freeze(['maxHp', 'attack', 'defense', 'speed', 'mastery']);

export function getHardChapterModifiers(chapter) {
  return HARD_CHAPTER_MODIFIERS[Number(chapter)] ? [...HARD_CHAPTER_MODIFIERS[Number(chapter)]] : [];
}

export function getHardChapterModifierLabelsFr(chapter) {
  return getHardChapterModifiers(chapter).map((modifier) => {
    const elementLabel = ELEMENT_LABELS_FR[modifier.element] || modifier.element;
    const percent = Number(modifier.percent) || 0;
    const prefix = percent > 0 ? '+' : '';
    if (modifier.element === 'all') {
      return `${elementLabel} ${prefix}${percent}% stats`;
    }
    return `Unités ${elementLabel} ${prefix}${percent}% stats`;
  });
}

export function applyHardChapterPlayerStatModifiers(teamUnits, chapter) {
  const modifiers = getHardChapterModifiers(chapter);
  if (!Array.isArray(teamUnits) || !modifiers.length) return;
  for (const unit of teamUnits) {
    const unitElement = String(unit?.element || '').toLowerCase();
    for (const modifier of modifiers) {
      if (modifier.element !== 'all' && unitElement !== modifier.element) continue;
      const multiplier = 1 + (Number(modifier.percent) || 0) / 100;
      for (const statKey of MODIFIABLE_STAT_KEYS) {
        if (typeof unit?.[statKey] !== 'number') continue;
        unit[statKey] = Math.round(unit[statKey] * multiplier);
      }
    }
  }
}
