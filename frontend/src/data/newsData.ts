/**
 * Mises à jour affichées dans l'onglet News.
 * Les entrées sont triées par date décroissante (plus récentes en haut).
 * Pour ajouter une news : insérer un nouvel objet au début du tableau.
 */
export interface NewsEntry {
  date: string; // YYYY-MM-DD
  title?: string;
  content: string;
  /** Plus élevé = affiché plus haut (utile pour forcer l’ordre si plusieurs news le même jour). */
  priority?: number;
}

/** Clé localStorage : dernière « tête de liste » News consultée (joueur connecté). */
export const NEWS_LAST_SEEN_STORAGE_KEY = 'nexus-core-news-last-seen-signature';

/** Tri : priorité décroissante, puis date décroissante (timestamps), puis ordre d’origine. */
export function sortNewsEntries(entries: readonly NewsEntry[]): NewsEntry[] {
  return [...entries]
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => {
      const pa = a.entry.priority ?? 0;
      const pb = b.entry.priority ?? 0;
      if (pa !== pb) return pb - pa;
      const ta = Date.parse(`${a.entry.date}T12:00:00Z`);
      const tb = Date.parse(`${b.entry.date}T12:00:00Z`);
      const da = Number.isNaN(ta) ? 0 : ta;
      const db = Number.isNaN(tb) ? 0 : tb;
      if (da !== db) return db - da;
      return a.i - b.i;
    })
    .map(({ entry }) => entry);
}

/**
 * Empreinte de la news la plus récente : change dès qu’une nouvelle entrée est ajoutée
 * ou modifiée en tête de liste (après tri).
 */
export function getLatestNewsSignature(): string {
  const sorted = sortNewsEntries(NEWS_ENTRIES);
  if (sorted.length === 0) return '';
  const head = sorted[0];
  const sourceIndex = NEWS_ENTRIES.indexOf(head);
  return `${head.date}\x1f${head.priority ?? 0}\x1f${sourceIndex}\x1f${head.title ?? ''}\x1f${head.content.length}`;
}

export function readNewsLastSeenSignature(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(NEWS_LAST_SEEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeNewsLastSeenSignature(signature: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(NEWS_LAST_SEEN_STORAGE_KEY, signature);
  } catch {
    /* navigation privée / quota */
  }
}

export const NEWS_ENTRIES: NewsEntry[] = [
  {
    date: '2026-03-25',
    priority: 130,
    title: 'XP en campagne & PvP — presets d’équipe',
    content:
      '**Distribution d’XP (campagne & PvP)**\n\n'
      + 'En **fin de combat**, l’**XP** est calculée comme avant pour chaque unité de ton équipe (malus **fatigue**, bonus **artefact** d’XP en PvP, etc.). '
      + '**Changement** : si une unité est déjà **niveau 50**, l’XP qu’elle aurait reçue **n’est plus « perdue »** : elle est **répartie à parts égales** entre toutes les unités de l’équipe qui ne sont **pas encore niveau 50**. '
      + 'Ainsi, monter tes persos reste utile même quand une partie du groupe est déjà au plafond.\n\n'
      + '**Presets d’équipe (Mes Équipes)**\n\n'
      + 'Tu peux désormais enregistrer jusqu’à **15 presets** par joueur (au lieu de **6**). '
      + 'Utile pour campagne, PvP, donjons et situations variées sans tout refaire à chaque fois.'
  },
  {
    date: '2026-03-25',
    priority: 120,
    title: 'Lumière & Ténèbres : invocation et donjon Ténèbres',
    content:
      'Les **unités Lumière** et **unités Ténèbres** sont désormais **obtenables à l’invocation** dans le **Sanctuaire** (portails concernés), au même titre que les autres éléments.\n\n'
      + 'Le **donjon Ténèbres** est **enfin disponible** : rends-toi dans **Combats → Donjon** et sélectionne l’onglet **Ténèbres** pour enchaîner les **trois combats** par niveau, sur le même modèle que les autres donjons élémentaires. Les **récompenses** d’artefacts de ce donjon privilégient la **Maîtrise** (stat simple, double stat incluant la maîtrise, ou artefact rare). Bonne chance !'
  },
  {
    date: '2026-03-24',
    priority: 110,
    title: 'Donjon Lumière — ouvert',
    content:
      'Le **Donjon Lumière** est **disponible** : choisis l’onglet **Lumière** dans **Combats → Donjon** pour enchaîner les **trois combats** par niveau, avec les **mêmes règles** que les autres éléments.\n\n'
      + 'Les **récompenses** d’artefacts de ce donjon privilégient la **Vitesse** (stat simple, double stat incluant la vitesse, ou artefact rare). Bonne chance !'
  },
  {
    date: '2026-03-21',
    priority: 100,
    title: 'Donjons : mode de jeu & récompenses — PvP sans or ni artefact',
    content:
      '**Donjons**\n\n'
      + 'Le mode **Donjon** est disponible pour **tous les joueurs** depuis le menu **Combats → Donjon**. '
      + 'Tu choisis un **élément** (Feu, Eau, Plante…), puis un **niveau** débloqué : chaque niveau se joue en **trois combats d’affilée** avec **un preset d’équipe**. '
      + 'Si tu perds en cours de série, tu devras recommencer ce niveau depuis le premier combat.\n\n'
      + 'En **terminant** les trois victoires d’un niveau, tu obtiens de **l’or**, une **chance d’artefact** (plus le niveau est élevé, plus la chance augmente) et, **la première fois** que tu réussis un étage, des **récompenses bonus** (ressources du jeu). '
      + 'Chaque élément oriente les **types d’artefacts** possibles (stat principale liée à l’élément, double stat, rareté, etc.). Les détails sont dans la **FAQ**, onglet **Donjon**.\n\n'
      + 'Le donjon **Ténèbres** est annoncé **très prochainement**.\n\n'
      + '**PvP**\n\n'
      + 'L’**or** et les **artefacts** ne sont **plus** obtenus en **fin de combat PvP**. '
      + 'Tu continues de gagner **crédits**, **XP**, évolution de l’**Elo** et les **récompenses de palier** quand tu franchis un nouveau rang.'
  },
  {
    date: '2026-03-20',
    title: 'Centre de Repos — récupération de fatigue accélérée',
    content:
      '**Nouveau : le Centre de Repos**\n\n'
      + 'Un onglet **Centre de Repos** est disponible dans le menu (entre **Mes Équipes** et le **Sanctuaire**).\n\n'
      + 'Tu peux y placer **jusqu’à six unités** de ta collection : elles y **récupèrent la fatigue deux fois plus vite** '
      + '(**−2** points par minute au lieu de **−1** hors centre).\n\n'
      + 'Compose ton équipe de repos, **enregistre**, et retrouve tes unités plus fraîches pour la campagne, le PvP et le reste. '
      + 'La page permet aussi de **rechercher** une unité par nom et de trier par **fatigue** pour t’aider à choisir qui envoyer au repos.'
  },
  {
    date: '2026-03-20',
    title: 'Maîtrise, précision des débuffs & équilibrage des effets',
    content:
      '**À quoi sert la Maîtrise**\n\n'
      + '**Maîtrise** ne booste plus les dégâts des compétences. Elle sert à la **précision** (côté lanceur) et à la **résistance** (côté cible) pour les **débuffs et effets hostiles négatifs** visant les **ennemis**.\n\n'
      + 'En zone, chaque cible subit **un tirage indépendant**.\n\n'
      + '**Taux de base** (sans écart de Maîtrise entre lanceur et cible)\n\n'
      + '• **65 %** de succès en match-up **neutre**\n'
      + '• **80 %** avec **avantage** élémentaire\n'
      + '• **50 %** en **désavantage**\n\n'
      + '**Influence de la Maîtrise**\n\n'
      + 'Chaque tranche de **10 points de Maîtrise** en votre faveur sur une cible donne **+1 %** à cette chance (et l’inverse si la cible est plus forte). Le bonus total est plafonné à **±35 %**.\n\n'
      + '**Probabilité déjà présente sur l’effet**\n\n'
      + 'Si l’effet possède déjà une **probabilité** (`chance`), elle se **multiplie** avec le taux ci-dessus.'
  },
  {
    date: '2026-03-19',
    title: 'Système d\'artefacts et rareté',
    content: 'Nouveau système d\'artefacts avec rareté (commun, peu commun, rare). Drops PvP augmentés à 15% victoire / 5% défaite. Artefacts peu communs : immunité, double bonus, +50% XP. Artefacts rares : octroi de traits (Arcaniste, Berserker, Bourreau, Druide, Gardien, Tacticien).'
  }
];
