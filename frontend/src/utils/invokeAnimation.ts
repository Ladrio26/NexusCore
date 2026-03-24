/**
 * Animation d'invocation type gacha (Sanctuaire) — Version Premium / AAA.
 * Modulaire : garde la base existante, ajoute camera feel, orb multi-couches, effets rareté, multi x10.
 */

/** Couleurs par rareté (common = gris, mythic = rouge). */
export const rarityColors: Record<string, string> = {
  common: '#78716c',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
  mythic: '#dc2626'
};

/** Nombre d'étoiles par rareté : Common 1★ … Mythic 6★. */
export const rarityStars: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythic: 6
};

export type RarityKey = keyof typeof rarityColors;

export function getStarsForRarity(rarity: string): number {
  const r = (rarity || 'common').toLowerCase();
  return rarityStars[r] ?? 1;
}

const FAKE_OUT_MAP: Record<string, string> = {
  rare: 'epic',
  epic: 'legendary'
};

export function getFakeOutRarity(rarity: string): string | null {
  const r = (rarity || '').toLowerCase();
  return FAKE_OUT_MAP[r] ?? null;
}

export const ELEMENT_SLUGS = ['feu', 'eau', 'plante', 'lumiere', 'tenebres', 'neutral'] as const;

export function getElementSlug(element: string | undefined): string {
  if (!element) return 'neutral';
  const s = String(element).toLowerCase();
  if (s.includes('feu') || s === 'fire') return 'feu';
  if (s.includes('eau') || s === 'water') return 'eau';
  if (s.includes('plant')) return 'plante';
  if (s.includes('lumi') || s === 'light') return 'lumiere';
  if (s.includes('teneb') || s.includes('dark') || s.includes('ombre')) return 'tenebres';
  return 'neutral';
}

// ---------------------------------------------------------------------------
// CAMERA / SCREEN SHAKE (rarity-dependent)
// ---------------------------------------------------------------------------

export type ScreenShakeLevel = 'none' | 'light' | 'medium' | 'heavy';

/** Classe CSS de screen shake selon la rareté (pour l'explosion). */
export function getScreenShakeClass(rarity: string): ScreenShakeLevel {
  const r = (rarity || 'common').toLowerCase();
  if (r === 'mythic') return 'heavy';
  if (r === 'legendary') return 'heavy';
  if (r === 'epic') return 'medium';
  if (r === 'rare') return 'light';
  return 'none';
}

/** Nom de classe CSS à appliquer sur le conteneur (camera + shake). */
export function getScreenShakeCssClass(rarity: string): string {
  const level = getScreenShakeClass(rarity);
  if (level === 'none') return '';
  return `screen-shake-${level}`;
}

// ---------------------------------------------------------------------------
// CONTROLLER & RUN SINGLE INVOKE (comportement actuel conservé)
// ---------------------------------------------------------------------------

export interface InvokeAnimationController {
  startPortalAnimation: () => void;
  playPortalCharge?: () => void;
  spawnOrb: (rarity: string) => void;
  upgradeOrbVisuals?: (rarity: string) => void;
  orbSuspense: (finalRarity: string) => void;
  playOrbSuspense?: (rarity: string, finalRarity: string) => void;
  explodeOrb: () => void;
  revealUnit: (unit: unknown) => void;
  showStars: (rarity: string) => void;
  playElementRevealEffect?: (element: string) => void;
  elementEffect: (element: string) => void;
  playRarityFinisher?: (rarity: string) => void;
  resetInvokeScene?: () => void;
}

/** Timings calibrés : montée en tension ~1,2 s + flash court + reveal. */
const DURATIONS = {
  /** Fond + portail (avant l’apparition du noyau). */
  portal: 520,
  /** Spirale d’accroche (gardée courte — le gros du show est sur l’orb). */
  vortex: 280,
  /** Noyau qui apparaît (scale-in CSS côté vue). */
  orbSpawn: 420,
  /** Charge d’énergie / tension avant l’explosion. */
  orbSuspense: 1200,
  /** Flash + disparition du noyau. */
  explosion: 480,
  reveal: 0
};

/**
 * Lance la séquence d'animation single invoke (~3–4 s).
 * Les méthodes optionnelles du controller (playPortalCharge, upgradeOrbVisuals, etc.)
 * sont appelées si présentes.
 */
export function runInvokeAnimation(
  controller: InvokeAnimationController,
  rarity: string,
  unit: unknown
): void {
  const r = (rarity || 'common').toLowerCase();
  const u = unit as { element?: string };

  controller.startPortalAnimation();
  if (controller.playPortalCharge) controller.playPortalCharge();

  let t = DURATIONS.portal;
  setTimeout(() => {
    controller.spawnOrb(r);
    if (controller.upgradeOrbVisuals) controller.upgradeOrbVisuals(r);
  }, t);
  t += DURATIONS.vortex + DURATIONS.orbSpawn;

  setTimeout(() => {
    controller.orbSuspense(r);
    if (controller.playOrbSuspense) controller.playOrbSuspense(r, r);
  }, t);
  t += DURATIONS.orbSuspense;

  setTimeout(() => controller.explodeOrb(), t);
  t += DURATIONS.explosion;

  setTimeout(() => {
    controller.revealUnit(unit);
    controller.showStars(r);
    controller.elementEffect(u?.element ?? '');
    if (controller.playElementRevealEffect) controller.playElementRevealEffect(u?.element ?? '');
    if (controller.playRarityFinisher) controller.playRarityFinisher(r);
  }, t);
}

export const INVOKE_DURATIONS = DURATIONS;
export const TOTAL_INVOKE_DURATION =
  DURATIONS.portal + DURATIONS.vortex + DURATIONS.orbSpawn + DURATIONS.orbSuspense + DURATIONS.explosion;

// ---------------------------------------------------------------------------
// MULTI INVOCATION X10
// ---------------------------------------------------------------------------

export type MultiInvokeUnit = {
  unit?: { name?: string; role?: string; element?: string };
  rarity?: string;
  isNewUnit?: boolean;
  fragmentsGained?: number;
};

export interface MultiInvokeController {
  showMultiOrbs: (units: MultiInvokeUnit[]) => void;
  revealOne: (index: number, unit: MultiInvokeUnit) => void;
  showMultiRevealGrid: (units: MultiInvokeUnit[]) => void;
  resetInvokeScene?: () => void;
}

/** Ordre de révélation : Legendary/Mythic en dernier pour la tension. */
function getRevealOrder(units: MultiInvokeUnit[]): number[] {
  const indices = units.map((_, i) => i);
  const rarityOrder = (r: string) => {
    const s = (r || '').toLowerCase();
    if (s === 'mythic') return 3;
    if (s === 'legendary') return 2;
    if (s === 'epic') return 1;
    return 0;
  };
  return indices.sort((a, b) => rarityOrder(units[a].rarity ?? '') - rarityOrder(units[b].rarity ?? ''));
}

/**
 * Lance l'animation multi-invocation x10 : 10 orbes → révélation en cascade (rares en dernier).
 */
export function playMultiInvokeAnimation(
  controller: MultiInvokeController,
  units: MultiInvokeUnit[],
  options?: { delayBetweenReveals?: number; tensionPauseBeforeRare?: number }
): void {
  const delay = options?.delayBetweenReveals ?? 350;
  const tensionPause = options?.tensionPauseBeforeRare ?? 600;

  controller.showMultiOrbs(units);
  const order = getRevealOrder(units);

  let t = 1200; // temps avant première révélation
  order.forEach((index, i) => {
    const u = units[index];
    const r = (u.rarity ?? '').toLowerCase();
    const isRare = r === 'legendary' || r === 'mythic';
    if (isRare && i > 0) t += tensionPause;
    setTimeout(() => controller.revealOne(index, u), t);
    t += delay;
  });

  t += 400;
  setTimeout(() => controller.showMultiRevealGrid(units), t);
}

/** Remet la scène à zéro (camera, shake, orbs). */
export function resetInvokeScene(controller: { resetInvokeScene?: () => void }): void {
  if (controller.resetInvokeScene) controller.resetInvokeScene();
}
