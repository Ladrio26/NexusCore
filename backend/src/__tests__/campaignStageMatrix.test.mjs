import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCampaignStageLevel,
  isCampaignStageSpecialized,
  getCampaignStageConfig,
  NORMAL_LEVELS_BY_CHAPTER,
  HARD_LEVELS_BY_CHAPTER
} from '../modules/campaign/config/campaignStageMatrix.js';
import { hashSeed } from '../services/campaignGenerator.js';

test('Normal chapitre 4 stage 6 = niveau 28, non spécialisé', () => {
  assert.equal(getCampaignStageLevel('normal', 4, 6), 28);
  assert.equal(isCampaignStageSpecialized('normal', 4, 6), false);
});

test('Hard chapitre 8 stage 3 = niveau 66, toujours spécialisé', () => {
  assert.equal(getCampaignStageLevel('hard', 8, 3), 66);
  assert.equal(isCampaignStageSpecialized('hard', 8, 3), true);
});

test('Normal exceptions spécialisées (ch5–9 st10, ch10 tout)', () => {
  assert.equal(isCampaignStageSpecialized('normal', 4, 10), false);
  assert.equal(isCampaignStageSpecialized('normal', 5, 10), true);
  assert.equal(isCampaignStageSpecialized('normal', 9, 10), true);
  assert.equal(isCampaignStageSpecialized('normal', 10, 1), true);
  assert.equal(isCampaignStageSpecialized('normal', 10, 9), true);
});

test('Matrices 10×10 complètes', () => {
  assert.equal(NORMAL_LEVELS_BY_CHAPTER.length, 10);
  assert.equal(HARD_LEVELS_BY_CHAPTER.length, 10);
  for (let c = 0; c < 10; c++) {
    assert.equal(NORMAL_LEVELS_BY_CHAPTER[c].length, 10);
    assert.equal(HARD_LEVELS_BY_CHAPTER[c].length, 10);
  }
});

test('getCampaignStageConfig cohérent', () => {
  const cfg = getCampaignStageConfig('hard', 1, 1);
  assert.equal(cfg.level, 21);
  assert.equal(cfg.specialized, true);
});

test('Shuffle boss : 10 chapitres, permutation de 10 équipes', () => {
  const teams = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
  const seed = '2026-03|normal|boss-shuffle|v1';
  const rng = hashSeed(seed);
  const a = [...teams];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  assert.equal(a.length, 10);
  const ids = new Set(a.map((x) => x.id));
  assert.equal(ids.size, 10);
});
