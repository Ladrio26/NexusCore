/**
 * Libellés courts / badges pour l’UI artefacts (grille, icônes, fiche détail, slots équipés).
 */
import { ARTIFACT_STAT_LABELS_FR, canonicalArtifactStatKey } from '@engine/artifacts.js';

/** Codes ultra-courts (lisibles dans les petites cases). */
const SHORT_STAT: Record<string, string> = {
  attack: 'ATQ',
  defense: 'DEF',
  speed: 'VIT',
  maxHp: 'PV',
  mastery: 'MAIT'
};

/**
 * Texte compact pour badge / glyphe : ATQ, PV, ATQ/DEF, IMMU, noms de traits en entier, etc.
 */
export function artifactBadgeLabel(statKey: string | undefined | null, extraData?: unknown): string {
  const c = canonicalArtifactStatKey(String(statKey || ''));
  if (!c) return '—';

  if (c === 'immune') return 'IMMU';
  if (c === 'xp_boost') return 'XP';

  if (c === 'dual_bonus') {
    const ex = extraData as { bonuses?: string[] } | null | undefined;
    const bonuses = ex?.bonuses;
    if (Array.isArray(bonuses) && bonuses.length >= 2) {
      const a = shortStatOrKey(canonicalArtifactStatKey(bonuses[0]));
      const b = shortStatOrKey(canonicalArtifactStatKey(bonuses[1]));
      return `${a}/${b}`;
    }
    if (Array.isArray(bonuses) && bonuses.length === 1) {
      return shortStatOrKey(canonicalArtifactStatKey(bonuses[0]));
    }
    return '2×';
  }

  const labels = ARTIFACT_STAT_LABELS_FR as Record<string, string>;

  if (c.startsWith('trait_')) {
    return labels[c] || c;
  }

  if (SHORT_STAT[c]) return SHORT_STAT[c];
  return labels[c] || c;
}

function shortStatOrKey(key: string): string {
  const k = canonicalArtifactStatKey(key);
  if (SHORT_STAT[k]) return SHORT_STAT[k];
  if (k === 'immune') return 'IMMU';
  if (k === 'xp_boost') return 'XP';
  return SHORT_STAT[k] || k;
}
