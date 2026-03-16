/** Tooltips pour la popup unité (Bestiaire et Collection) — survol pour afficher */

export const TOOLTIP_TYPE =
  "Type : Distance ou Corps à corps. Les unités distance peuvent infliger des dégâts ciblés à n'importe quelle unité. Les unités Corps à corps ne peuvent infliger des dégâts ciblés qu'aux unités corps à corps tant qu'il en reste.";

export const TOOLTIP_ELEMENT =
  "Élément : Élément de l'unité. Feu > Eau > Plante > Feu. Une unité avec l'avantage élémentaire a 25% de chance de faire un coup critique en attaquant. Une unité avec le désavantage élémentaire a 25% de chance de ne pas faire de dégâts en attaquant.";

export const TOOLTIP_TRAITS =
  'Traits : Les traits donnent de bonus à toute l\'équipe en fonction du nombre d\'unité avec ces traits.';

export const TOOLTIP_NOYAU =
  "Noyau : Bonus de Leader à toute l'équipe. S'il y a plusieurs bonus de Leader dans une équipe, un seul est choisi.";

export const TOOLTIP_HP =
  "PV : Son nombre de points de vie. Si les PV arrivent à 0, l'unité est KO jusqu'à la fin du combat, mais peut toujours être ressucitée.";

export const TOOLTIP_ATK = "ATQ : Attaque de l'unité, sert au calcul de ses dégâts.";

export const TOOLTIP_DEF = "DEF : Défense de l'unité, sert à la réduction des dégâts reçus.";

export const TOOLTIP_SPD =
  'VIT : Vitesse de l\'équipe, sert à décider l\'ordre d\'attaque des unités.';

export const TOOLTIP_MASTERY =
  "Maîtrise : Augmente les dégâts des compétences de l'unité.";

export const TOOLTIP_CD =
  'CD : Cooldown de la compétence : Nombre d\'actions de l\'unité à faire avant de pouvoir relancer la compétence.';

export const TOOLTIP_SPEC =
  "Spécialisation : Une unité peut être spécialisé UNE fois, lorsqu'elle est niveau 50. Une unité spécialisé retourne au niveau 1, augmente toutes ses statistiques (PV, ATQ, DEF, VIT et Maitrise) de 25%, et augmente de 10% supplémentaire la statistique de la Spécialisation choisie (A ou B). La compétence est améliorée définitivement en fonction de la spécialisation choisie.";

/** Collection uniquement */
export const TOOLTIP_XP = 'XP : Expérience nécéssaire pour monter de niveau.';

export const TOOLTIP_PUISSANCE =
  "Puissance : Niveau de puissance de l'unité. La puissance augmente avec les doublons de cette même unité. Chaque niveau de puissance augmente toutes ses statistiques (PV, ATQ, DEF, VIT et Maitrise) de 5%";

export const TOOLTIP_OUVERTURES_TOTALES =
  "Ouverture Totale : Nombre de fois que vous avez obtenu cette unité.";

export const TOOLTIP_PROGRESSION_PUISSANCE =
  'Progression puissance : Nombre de doublons nécéssaires pour atteindre le niveau de puissance suivant.';

export const TOOLTIP_FATIGUE =
  "Fatigue : A chaque combat, toutes les unités de votre équipe augmentent leur fatigue de 3. Chaque point de fatigue réduit la vitesse de l'unité de 1%. Chaque unité retire 1 point de fatigue par minute.";
