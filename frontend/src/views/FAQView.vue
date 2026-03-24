<template>
  <section class="faq-page page-content">
    <div class="faq-inner">
      <header class="faq-header">
        <h1 class="page-title nx-title">Guide & FAQ</h1>
        <p class="faq-intro">
          Texte d’aide pour le jeu. Les blocs <em>« Voir le détail technique »</em> donnent chiffres et noms internes si tu en as besoin.
        </p>
      </header>

      <div
        class="faq-tab-strip"
        role="tablist"
        aria-label="Sections du guide"
      >
        <button
          v-for="tab in faqTabs"
          :key="tab.id"
          type="button"
          role="tab"
          :aria-selected="activeSection === tab.id"
          class="faq-tab-pill"
          :class="{ active: activeSection === tab.id }"
          @click="activeSection = tab.id"
        >
          <span class="faq-tab-emoji" aria-hidden="true">{{ tab.emoji }}</span>
          {{ tab.label }}
        </button>
      </div>

      <!-- Accueil -->
      <article
        v-show="activeSection === 'accueil'"
        class="faq-panel"
        role="tabpanel"
      >
        <h2 class="faq-panel-title">Accueil</h2>
        <p class="faq-lead">
          Nexus Core Arena est un jeu de stratégie au tour par tour. Tu collectes des <strong>unités</strong>, tu les fais progresser,
          tu les équipes et tu les envoies en <strong>campagne</strong> (PvE), en <strong>PvP</strong> ou en <strong>guerre de guilde</strong>.
        </p>
        <p>
          Chaque onglet de ce guide décrit une partie du jeu (menu, combat, stats, effets, invocations, donjon, etc.).
          Pour la liste des unités du jeu, ouvre le <strong>Bestiaire</strong>. Pour un pas-à-pas dans l’interface, utilise le <strong>tutoriel</strong> en bas de page.
        </p>
        <details class="faq-tech">
          <summary>Voir le détail technique (structure du guide)</summary>
          <div class="faq-tech-body">
            Ce guide est aligné sur les mécaniques actuelles du client et du serveur. Il complète le <strong>Bestiaire</strong> mais ne remplace pas les fiches détaillées des unités in-game.
          </div>
        </details>
      </article>

      <!-- Menu -->
      <article v-show="activeSection === 'menu'" class="faq-panel" role="tabpanel">
        <h2 class="faq-panel-title">Menu latéral</h2>
        <p class="faq-lead">
          Voici le rôle de chaque entrée du menu.
        </p>
        <ul class="faq-menu-list">
          <li>
            <strong>Ma Collection</strong> — Liste de tes unités : niveau, fatigue, spécialisation, artefacts équipés, progression.
          </li>
          <li>
            <strong>Mes Équipes</strong> — Tu places jusqu’à six unités (CAC devant, distance derrière), tu choisis le <strong>noyau</strong> actif et tu enregistres plusieurs presets (campagne, PvP, guilde…).
          </li>
          <li>
            <strong>Centre de Repos</strong> — Jusqu’à six unités y récupèrent la fatigue <strong>deux fois plus vite</strong> (−2 par minute au lieu de −1).
          </li>
          <li>
            <strong>Sanctuaire</strong> — Trois portails d’invocation, chacun avec une monnaie différente.
          </li>
          <li>
            <strong>Artefacts</strong> — Forge, amélioration et équipement d’artefacts sur tes unités (bonus de stats).
          </li>
          <li>
            <strong>Guilde</strong> — Membres, demandes d’adhésion, portail de guilde, activité, guerre de guilde, chat.
          </li>
          <li>
            <strong>Combats → Campagne</strong> — Progression PvE par chapitres, avec boss en fin de chapitre.
          </li>
          <li>
            <strong>Combats → Donjon</strong> — Séries de trois combats par niveau, par élément (Feu, Eau, Plante…), avec or et artefacts possibles en fin de niveau (voir l’onglet <strong>Donjon</strong> de cette FAQ).
          </li>
          <li>
            <strong>Combats → PvP</strong> — Combats contre des défenses de joueurs (ou équivalents gérés par le jeu) et montée en Elo.
          </li>
          <li>
            <strong>Classement</strong> — Classement PvP (Elo).
          </li>
          <li>
            <strong>Bestiaire</strong> — Catalogue des unités du jeu.
          </li>
          <li>
            <strong>FAQ</strong> — Ce guide.
          </li>
          <li>
            <strong>Feedback</strong> — Signaler un problème ou envoyer une suggestion.
          </li>
        </ul>
      </article>

      <!-- Combat -->
      <article v-show="activeSection === 'combat'" class="faq-panel" role="tabpanel">
        <h2 class="faq-panel-title">Combat</h2>
        <p class="faq-lead">
          Deux équipes s’affrontent au tour par tour. Chaque unité a une <strong>barre d’action (ATB)</strong> qui se remplit ; quand elle est pleine, cette unité joue son tour.
          Plus la <strong>vitesse</strong> est élevée, plus les tours reviennent souvent.
        </p>
        <p>
          Objectif : vaincre toute l’équipe adverse (PV à zéro). Les compétences appliquent des buffs, des effets négatifs, des soins, des boucliers, etc.
        </p>
        <p>
          Les unités <strong>CAC</strong> (devant) ciblent en priorité les CAC ennemies ; les unités <strong>distance</strong> (derrière) peuvent cibler n’importe qui.
          Tant que l’ennemi a des CAC en vie, tes distance sont en général moins exposées aux attaques des CAC ennemies.
        </p>
        <h3 class="faq-subtitle">Compétences et cooldown</h3>
        <p>
          Après utilisation, une compétence active attend un temps de recharge avant d’être réutilisable.
          Certaines compétences <strong>réduisent</strong> ou <strong>augmentent</strong> ces temps de recharge (pour les alliés ou les ennemis).
        </p>
        <details class="faq-tech">
          <summary>Voir le détail technique (ATB, tours, étourdissement)</summary>
          <div class="faq-tech-body">
            Le moteur utilise une <strong>barre ATB</strong> (action time battle) : la vitesse augmente le taux de remplissage.
            Un état <strong>STUN</strong> fait perdre complètement le tour jouable (pas d’action ce passage).
            Les effets <code>CD_UP</code> / <code>CD_DOWN</code> modulent les temps de recharge des compétences.
            La <code>REDUCE_ATB</code> recule la jauge ; <code>ATB_UP</code> ou équivalent la fait progresser plus vite pour un allié.
            Les noms anglais listés correspondent aux drapeaux internes du moteur ; l’affichage en jeu reste lisible en français.
          </div>
        </details>
      </article>

      <!-- Stats & progression -->
      <article v-show="activeSection === 'stats'" class="faq-panel" role="tabpanel">
        <h2 class="faq-panel-title">Progression des unités</h2>
        <p class="faq-lead">
          Chaque unité a des stats de base : <strong>PV</strong>, <strong>attaque</strong>, <strong>défense</strong>, <strong>vitesse</strong>, <strong>maîtrise</strong>.
        </p>
        <h3 class="faq-subtitle">Rôle des stats</h3>
        <ul>
          <li><strong>PV</strong> — Points de vie : à zéro, l’unité est K.O.</li>
          <li><strong>Attaque</strong> — Augmente en général les <strong>dégâts</strong> infligés par tes attaques et compétences offensives.</li>
          <li><strong>Défense</strong> — Réduit les <strong>dégâts</strong> subis.</li>
          <li><strong>Vitesse</strong> — Détermine à quelle fréquence l’unité <strong>joue ses tours de jeu</strong> (remplissage de l’ATB).</li>
          <li><strong>Maîtrise</strong> — Augmente la chance d’appliquer des <strong>effets négatifs</strong> aux ennemis et la résistance quand ton unité est la cible (voir détail technique).</li>
        </ul>
        <p>
          L’<strong>élément</strong> (avantage / désavantage) modifie aussi la réussite des effets négatifs. Sur une attaque en zone, le tirage est fait <strong>par cible</strong>.
        </p>
        <h3 class="faq-subtitle">Fatigue</h3>
        <p>
          La fatigue augmente à chaque combat et diminue avec le temps hors combat. Elle <strong>réduit la vitesse</strong> (donc moins de tours de jeu)
          et, au-delà d’un seuil, <strong>diminue l’XP</strong> gagnée après le combat. Le <strong>Centre de Repos</strong> accélère la récupération pour jusqu’à six unités (−2 par minute au lieu de −1).
          Il n’y a pas de limite d’énergie : tu peux enchaîner, mais les unités fatiguées sont moins efficaces — alterne tes équipes si besoin.
        </p>
        <h3 class="faq-subtitle">Traits et synergies</h3>
        <p>
          Les unités ont un ou plusieurs <strong>traits</strong> (Gardien, Berserker, etc.). Avec 2, 4 ou 6 unités partageant le même trait dans l’équipe, des <strong>bonus de synergy</strong> s’activent (plus forts à 4 et 6).
        </p>
        <h3 class="faq-subtitle">Noyau</h3>
        <p>
          Les unités d’une certaine rareté ont un <strong>noyau</strong> : bonus passif pour toute l’équipe. Dans chaque preset, tu n’actives qu’<strong>un seul</strong> noyau à la fois.
        </p>
        <h3 class="faq-subtitle">Ascension (spécialisation)</h3>
        <p>
          Au niveau 50, tu peux faire <strong>ascendre</strong> une unité (coût : essence d’ascension) : choix définitif entre <strong>spécialisation A ou B</strong>,
          retour au niveau 1 avec stats et une compétence renforcées selon la branche.
        </p>
        <h3 class="faq-subtitle">Puissance (doublons)</h3>
        <p>
          Invoquer une unité que tu possèdes déjà fusionne les doublons et augmente la <strong>puissance</strong> (P1 à P5). Chaque palier augmente les stats de l’unité (voir détail technique).
        </p>
        <details class="faq-tech">
          <summary>Voir le détail technique (Maîtrise, fatigue, spécialisation, puissance)</summary>
          <div class="faq-tech-body">
            <p><strong>Maîtrise — taux de base :</strong> <strong>65 %</strong> en neutre, <strong>80 %</strong> avec avantage élémentaire, <strong>50 %</strong> en désavantage.
            Chaque tranche de <strong>10 points</strong> de différence (lanceur vs cible) ajoute ou retire <strong>1 point de pourcentage</strong>, plafonné à <strong>±35 points</strong>.
            Si la compétence porte déjà une probabilité propre (<code>chance</code>), elle se <strong>multiplie</strong> avec ce taux. Tirages <strong>indépendants par cible</strong> en zone.</p>
            <p><strong>Fatigue :</strong> +3 par combat ; −1 par minute hors combat (par défaut) ; au <strong>Centre de Repos</strong>, les unités placées perdent <strong>2</strong> points par minute ; chaque point réduit la vitesse effective d’environ <strong>1 %</strong> ;
            au-delà de <strong>50</strong>, l’XP post-combat est <strong>divisée par deux</strong>.</p>
            <p><strong>Ascension (niveau 50) :</strong> coût <strong>1 essence d’ascension</strong> ; retour niveau 1 avec branche choisie ;
            stats de base <strong>+25 %</strong> ; stat liée à la branche <strong>+10 %</strong> ; une compétence est renforcée.</p>
            <p><strong>Puissance (doublons) :</strong> P1 = 1 copie ; P2 = 3 copies totales ; P3 = 6 ; P4 = 10 ; P5 = 15.
            Bonus global de stats : P2 +5 %, P3 +10 %, P4 +15 %, P5 +20 % par rapport à P1.</p>
          </div>
        </details>
      </article>

      <!-- Effets -->
      <article v-show="activeSection === 'effets'" class="faq-panel" role="tabpanel">
        <h2 class="faq-panel-title">Effets en combat</h2>
        <p class="faq-lead">
          Les compétences appliquent des <strong>buffs</strong> (effets positifs) ou des <strong>effets négatifs</strong> sur les unités. Résumé des types courants :
        </p>
        <h3 class="faq-subtitle">Buffs (effets positifs)</h3>
        <div class="faq-effects-grid">
          <div class="faq-effect buff">
            <span class="faq-effect-name">Frappe amplifiée</span>
            <span class="faq-effect-desc">Augmente les dégâts infligés pendant quelques actions.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Carapace renforcée</span>
            <span class="faq-effect-desc">Réduit les dégâts subis.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Allure vive</span>
            <span class="faq-effect-desc">Augmente la vitesse : l’unité joue ses tours de jeu plus souvent.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Barrière</span>
            <span class="faq-effect-desc">Absorbe une partie des dégâts avant les PV.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Vol de vitalité</span>
            <span class="faq-effect-desc">Une partie des dégâts infligés restaure les PV de l’unité.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Régénération</span>
            <span class="faq-effect-desc">Restaure des PV à chaque fois que l’unité joue son tour de jeu.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Immunité aux débuffs</span>
            <span class="faq-effect-desc">Empêche l’application de nouveaux effets négatifs.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Invincibilité</span>
            <span class="faq-effect-desc">Pendant la durée, l’unité ne perd pas de PV (dégâts annulés).</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Contre-attaque</span>
            <span class="faq-effect-desc">L’unité riposte automatiquement quand elle reçoit une attaque.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Provocation</span>
            <span class="faq-effect-desc">Les ennemis sont forcés de cibler cette unité en priorité.</span>
          </div>
        </div>
        <h3 class="faq-subtitle">Effets négatifs</h3>
        <div class="faq-effects-grid">
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Attaque réduite</span>
            <span class="faq-effect-desc">Diminue les dégâts infligés.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Défense réduite</span>
            <span class="faq-effect-desc">Augmente les dégâts subis.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Ralentissement</span>
            <span class="faq-effect-desc">Réduit la vitesse : l’unité joue ses tours de jeu moins souvent.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Silence</span>
            <span class="faq-effect-desc">L’unité ne peut pas utiliser ses compétences actives.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Étourdissement</span>
            <span class="faq-effect-desc">L’unité ne joue pas son tour de jeu (aucune action).</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Aveuglement</span>
            <span class="faq-effect-desc">Les attaques de base peuvent rater (dégâts réduits ou annulés selon le cas).</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Anti-soin</span>
            <span class="faq-effect-desc">Réduit ou annule les soins reçus.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Anti-bouclier</span>
            <span class="faq-effect-desc">Empêche de poser de nouveaux boucliers absorbant les dégâts.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Anti-buff</span>
            <span class="faq-effect-desc">Empêche l’application de nouveaux buffs.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Dégâts sur la durée (DOT)</span>
            <span class="faq-effect-desc">Inflige des dégâts à répétition sur plusieurs tours de jeu.</span>
          </div>
        </div>
        <h3 class="faq-subtitle">Autres mécaniques</h3>
        <ul>
          <li><strong>Strip</strong> — Retire des buffs sur un ennemi.</li>
          <li><strong>Purification (cleanse)</strong> — Retire des effets négatifs sur un allié.</li>
          <li><strong>Réduction d’ATB</strong> — Recule la barre d’action ennemie (elle joue son tour plus tard).</li>
          <li><strong>Boost d’ATB</strong> — Avance la barre d’action d’un allié (tour de jeu plus tôt).</li>
          <li><strong>Vol de stat</strong> — Prend temporairement de l’ATQ, DEF ou VIT à la cible pour te l’appliquer.</li>
          <li><strong>Résurrection</strong> — Ramène une unité alliée K.O. avec une partie de ses PV.</li>
          <li><strong>Réinitialisation de recharge</strong> — Remet le cooldown d’une compétence comme prêt ou modifie son temps restant.</li>
        </ul>
        <details class="faq-tech">
          <summary>Voir le détail technique (codes d’effet et pourcentages usuels)</summary>
          <div class="faq-tech-body">
            <p>Correspondance rapide avec les drapeaux moteur :</p>
            <ul class="faq-tech-list">
              <li>Bienfaits : <code>ATK_UP</code> ~ +50 % ATQ pour X actions ; <code>DEF_UP</code> ~ +50 % DEF ; <code>SPEED_UP</code> ~ +30 % VIT ;
                <code>SHIELD</code>, <code>LIFESTEAL</code>, <code>REGEN</code>, <code>IMMUNITY</code>, <code>INVINCIBILITY</code>, <code>COUNTER_ATTACK</code>, <code>PROVOKE</code>.</li>
              <li>Effets négatifs : <code>ATK_DOWN</code>, <code>DEF_DOWN</code>, <code>SLOW</code>, <code>SILENCE</code>, <code>STUN</code>, <code>BLIND</code>, <code>ANTI_HEAL</code>, <code>ANTI_SHIELD</code>, <code>ANTI_BUFF</code>, <code>DOT</code>.</li>
              <li>Manœuvres : strip de buffs, cleanse, <code>REDUCE_ATB</code>, boost ATB, <code>STEAL_STAT</code>, résurrection, reset de cooldown (<code>SET_SKILL_COOLDOWN_MAX</code> / refresh).</li>
            </ul>
            <p>Beaucoup de sorts embarquent une probabilité interne : elle se combine avec la réussite dictée par la Maîtrise (voir onglet « Progression »).</p>
          </div>
        </details>
      </article>

      <!-- Invocations -->
      <article v-show="activeSection === 'invocations'" class="faq-panel" role="tabpanel">
        <h2 class="faq-panel-title">Sanctuaire — invocations</h2>
        <p class="faq-lead">
          Trois portails ; chacun coûte une monnaie différente (cores, crédits ou fragments) et tire des unités selon ses règles.
        </p>
        <h3 class="faq-subtitle">Portail Noyau</h3>
        <p>
          Payé en <strong>cores</strong>. Tirages plutôt orientés communs / peu communs, avec possibilité de rares. Utile pour la collection et les doublons (puissance).
        </p>
        <h3 class="faq-subtitle">Portail Standard</h3>
        <p>
          Payé en <strong>crédits</strong>. Raretés du commun au mythique. Un système de <strong>pitié</strong> garantit une unité épique, puis légendaire, puis mythique après un certain nombre de tirages sans ces raretés (voir détail technique).
        </p>
        <h3 class="faq-subtitle">Portail Résonance</h3>
        <p>
          Payé en <strong>fragments</strong>. Ne donne que des unités <strong>rares ou épiques</strong>.
        </p>
        <details class="faq-tech">
          <summary>Voir le détail technique (coûts, pitiés)</summary>
          <div class="faq-tech-body">
            <ul>
              <li>Portail Noyau : <strong>10 cores</strong> par tirage.</li>
              <li>Portail Standard : <strong>100 crédits</strong> ; pitié épique tous les <strong>25</strong> tirages, légendaire tous les <strong>100</strong>, mythique tous les <strong>1000</strong>.</li>
              <li>Portail Résonance : <strong>100 fragments</strong> ; unités <strong>rares ou épiques uniquement</strong>.</li>
            </ul>
          </div>
        </details>
      </article>

      <!-- Campagne -->
      <article v-show="activeSection === 'campagne'" class="faq-panel" role="tabpanel">
        <h2 class="faq-panel-title">Campagne (PvE)</h2>
        <p class="faq-lead">
          <strong>10 chapitres</strong>, chacun avec plusieurs stages ; le dernier stage est en général un <strong>boss</strong>.
        </p>
        <p>
          <strong>Mode normal</strong> : disponible tout de suite. <strong>Mode difficile</strong> : se débloque après avoir vaincu le boss du chapitre 5 en normal.
          Les ennemis sont plus forts et les récompenses meilleures en difficile.
        </p>
        <p>
          Première victoire sur un stage : meilleures récompenses (crédits, cores, fragments, parfois essence d’ascension). Les unités gagnent de <strong>l’XP</strong>, sauf malus si la <strong>fatigue</strong> est trop haute.
        </p>
      </article>

      <!-- Donjon -->
      <article v-show="activeSection === 'donjon'" class="faq-panel" role="tabpanel">
        <h2 class="faq-panel-title">Donjon</h2>
        <p class="faq-lead">
          Mode accessible via <strong>Combats → Donjon</strong> — réservé aux joueurs connectés (comme <strong>Campagne</strong> et <strong>PvP</strong>).
          L’édition des compositions ennemies est réservée aux <strong>administrateurs</strong> (menu <strong>Admin → Donjon Admin</strong>), distinct de la page Donjon joueur.
        </p>
        <h3 class="faq-subtitle">Structure</h3>
        <p>
          Plusieurs <strong>donjons par élément</strong> : <strong>Feu</strong>, <strong>Eau</strong>, <strong>Plante</strong>, ainsi que <strong>Lumière</strong> et <strong>Ténèbres</strong> (ces deux derniers sont en cours de déploiement côté contenu — un message l’indique en jeu).
        </p>
        <p>
          Chaque donjon comporte <strong>10 niveaux</strong>. Un <strong>niveau</strong>, c’est une <strong>série de 3 combats</strong> à enchaîner avec <strong>la même équipe</strong> (tu choisis un <strong>preset</strong> dans <strong>Mes Équipes</strong> avant de lancer).
          Tu dois <strong>gagner les trois</strong> pour valider le niveau. Si tu perds n’importe lequel des trois combats, la série est <strong>interrompue</strong> et tu devras relancer le niveau depuis le combat 1.
        </p>
        <p>
          Tu commences au <strong>niveau 1</strong> débloqué. Chaque fois que tu <strong>termines</strong> un niveau (3 victoires), le <strong>niveau suivant</strong> du même élément se débloque (jusqu’au niveau 10).
        </p>
        <h3 class="faq-subtitle">Fatigue</h3>
        <p>
          La <strong>fatigue</strong> de campagne s’applique aux unités de ton preset <strong>uniquement après la 3e victoire</strong> du niveau (fin de série), pas après les combats 1 et 2. Cela permet d’enchaîner les deux premiers combats sans pénaliser l’équipe entre les deux.
        </p>
        <h3 class="faq-subtitle">Récompenses</h3>
        <p>
          Après la <strong>3e victoire</strong> d’un niveau, tu reçois de <strong>l’or</strong> (montant lié au numéro du niveau) et une <strong>probabilité d’obtenir un artefact</strong> —
          plus le niveau est élevé, plus la chance augmente (les pourcentages exacts sont rappelés dans l’interface du Donjon, rubrique <strong>Probabilités</strong>).
        </p>
        <p>
          La <strong>première fois</strong> que tu réussis un niveau donné donne en plus une <strong>récompense de première complétion</strong> (crédits, cores, fragments, ressources divines selon le niveau).
        </p>
        <p>
          La <strong>thématique des artefacts</strong> dépend de l’élément du donjon : par exemple le Feu favorise des bonus liés à l’<strong>attaque</strong>, l’Eau à la <strong>défense</strong>, la Plante aux <strong>PV max</strong>, etc., avec aussi des variantes « double stat » ou « rare » selon le tirage.
        </p>
        <details class="faq-tech">
          <summary>Voir le détail technique (or, probabilités)</summary>
          <div class="faq-tech-body">
            <p><strong>Or de fin de niveau :</strong> <code>25 × numéro du niveau</code> (ex. niveau 4 → 100 or).</p>
            <p><strong>Artefact :</strong> tirage après la 3e victoire ; la probabilité de base par niveau (1 à 10) est affichée dans le jeu sous forme de pourcentages (5 % au niveau 1 jusqu’à 100 % au niveau 10 dans la configuration actuelle).</p>
            <p><strong>Première complétion :</strong> une ligne par couple (joueur, élément, niveau) dans la base ; les récompenses bonus ne sont données qu’une fois par niveau.</p>
          </div>
        </details>
      </article>

      <!-- PvP -->
      <article v-show="activeSection === 'pvp'" class="faq-panel" role="tabpanel">
        <h2 class="faq-panel-title">PvP (arène)</h2>
        <p class="faq-lead">
          Tu attaques avec un <strong>preset d’équipe</strong> et tu dois configurer une <strong>défense</strong> (équipe vue par les adversaires qui t’attaquent).
          Les adversaires sont des joueurs réels ou des défenses générées par le jeu selon les besoins du matchmaking.
        </p>
        <p>
          Tant que la défense n’est pas configurée, tu ne peux pas lancer de combat PvP.
        </p>
        <p>
          Chaque combat fait évoluer ton <strong>Elo</strong> (victoire = montée en général, défaite = baisse). Les rangs de saison (Argent, Or, Platine, etc.) donnent accès à des <strong>récompenses de palier</strong> à récupérer.
        </p>
        <p>
          Récompenses habituelles en fin de combat : <strong>XP</strong> pour les unités (victoire), <strong>crédits</strong> boutique en cas de victoire, <strong>crédits divins</strong> possibles selon le tirage, et mise à jour de l’<strong>Elo</strong>.
          L’<strong>or</strong> et les <strong>artefacts</strong> ne sont <strong>pas</strong> obtenus via le PvP — ils viennent notamment de la <strong>campagne</strong>, des <strong>donjons</strong> (fin de niveau), de la <strong>forge</strong> d’artefacts, etc.
        </p>
        <details class="faq-tech">
          <summary>Voir le détail technique (Elo, défense sans fatigue)</summary>
          <div class="faq-tech-body">
            <ul>
              <li>L’<strong>Elo</strong> quantifie la force relative affichée ; les paliers de saison (Argent → Challenger…) marquent des seuils de réputation.</li>
              <li>La <strong>défense PvP</strong> n’accumule pas de fatigue lorsque quelqu’un te défie.</li>
              <li>Les récompenses d’<strong>or</strong> et d’<strong>artefact</strong> ne sont plus attribuées au <strong>finalize</strong> d’un combat PvP (mise à jour récente).</li>
            </ul>
          </div>
        </details>
      </article>

      <!-- Guilde -->
      <article v-show="activeSection === 'guilde'" class="faq-panel" role="tabpanel">
        <h2 class="faq-panel-title">Guilde</h2>
        <p class="faq-lead">
          Les joueurs peuvent rejoindre une guilde pour le <strong>chat</strong>, le <strong>portail de guilde</strong> (invocations payées en pièces de guilde), l’<strong>historique d’activité</strong> et la <strong>guerre de guilde</strong>.
        </p>
        <h3 class="faq-subtitle">Onglets utiles</h3>
        <ul>
          <li><strong>Membres</strong> — Liste des joueurs et des rôles (chef, officier, membre).</li>
          <li><strong>Demandes</strong> — Candidatures à accepter ou refuser (officiers).</li>
          <li><strong>Portail de guilde</strong> — Unités en rotation, payées en <strong>pièces de guilde</strong>.</li>
          <li><strong>Activité</strong> — Journal des actions liées à la guilde.</li>
          <li><strong>Chat</strong> — Messagerie de guilde.</li>
        </ul>
        <h3 class="faq-subtitle">Guerre de guilde</h3>
        <p>
          Ta guilde affronte une autre guilde. Les membres préparent des <strong>équipes de défense</strong> (4 unités) ; les officiers peuvent en choisir jusqu’à <strong>six</strong> pour la carte.
          Chaque membre peut <strong>attaquer</strong> une défense ennemie avec une équipe de 4 unités. Résultat du siège : <strong>pièces de guilde</strong> pour la guilde (selon victoire / défaite / nul).
        </p>
        <p>
          La <strong>fatigue</strong> des unités ne s’applique <strong>pas</strong> en guerre de guilde.
        </p>
        <details class="faq-tech">
          <summary>Voir le détail technique (slots, équipes)</summary>
          <div class="faq-tech-body">
            Les défenses affichées combinent jusqu’à <strong>six</strong> compositions choisies par les officiers à partir des presets des membres (équipes de <strong>4</strong> unités).
            Les attaques utilisent également des presets de <strong>4</strong> unités. Les récompenses de pièces de guilde dépendent du résultat du siège (victoire / défaite / nul).
          </div>
        </details>
      </article>

      <!-- Artefacts -->
      <article v-show="activeSection === 'artefacts'" class="faq-panel" role="tabpanel">
        <h2 class="faq-panel-title">Artefacts</h2>
        <p class="faq-lead">
          Un artefact s’équipe sur une <strong>unité</strong> et augmente une ou plusieurs stats (PV, ATQ, DEF, VIT, maîtrise…).
        </p>
        <p>
          <strong>Forge</strong> : crée un artefact aléatoire contre de l’<strong>or</strong>.
          <strong>Amélioration</strong> : monte le niveau et les bonus (coût en or, risque d’échec qui augmente avec le niveau).
          <strong>Recyclage</strong> : détruit un artefact et rend une partie de l’or.
        </p>
        <p>
          <strong>Raretés</strong> : commun, peu commun, rare. Plus la rareté est haute, plus les bonus peuvent être forts ; certains artefacts rares ajoutent des effets spéciaux (ex. immunités, double bonus, XP, traits d’équipe).
        </p>
        <p>
          Tu obtiens des artefacts en <strong>forge</strong> (or), en récompense de <strong>donjon</strong> (fin de niveau, selon probabilités), et par d’autres sources prévues par le jeu — <strong>pas</strong> en récompense directe de combat <strong>PvP</strong>.
        </p>
        <details class="faq-tech">
          <summary>Voir le détail technique (coûts, rareté, drops)</summary>
          <div class="faq-tech-body">
            Forge : <strong>5000 or</strong> pour un tirage aléatoire. Amélioration : coût croissant + risque d’échec qui augmente avec le niveau.
            Recyclage : <strong>50 or</strong> pour libérer l’emplacement. Donjons : tirage d’artefact après la 3e victoire d’un niveau (voir onglet <strong>Donjon</strong> de cette FAQ).
          </div>
        </details>
      </article>

      <!-- Richesses -->
      <article v-show="activeSection === 'richesses'" class="faq-panel" role="tabpanel">
        <h2 class="faq-panel-title">Ressources et récompenses</h2>
        <p class="faq-lead">
          Où obtenir les monnaies principales et à quoi elles servent.
        </p>
        <ul class="faq-riches-list">
          <li><strong>Crédits</strong> — Campagne, PvP, connexion quotidienne, paliers ; dépensés au <strong>portail Standard</strong>.</li>
          <li><strong>Cores</strong> — Campagne, quotidien, PvP, paliers ; dépensés au <strong>portail Noyau</strong>.</li>
          <li><strong>Fragments</strong> — Mêmes sources courantes que les crédits ; dépensés au <strong>portail Résonance</strong>.</li>
          <li><strong>Or</strong> — Campagne, donjons (fin de niveau), recyclage d’artefacts ; sert à la <strong>forge</strong> et à l’<strong>amélioration</strong> d’artefacts.</li>
          <li><strong>Essence d’ascension</strong> — Rare ; bosses de campagne, récompenses hautes en PvP (ex. palier Challenger) ; sert à l’<strong>ascension</strong> des unités.</li>
          <li><strong>Pièces de guilde</strong> — Guerres de guilde ; dépensées au <strong>portail de guilde</strong>.</li>
        </ul>
        <h3 class="faq-subtitle">Connexion quotidienne</h3>
        <p>
          Une fois par jour, une récompense de connexion donne crédits, cores et fragments (montants fixés par le serveur).
        </p>
        <h3 class="faq-subtitle">Paliers de saison (PvP)</h3>
        <p>
          En montant en Elo, tu atteins des rangs (Argent, Or, Platine, etc.) ; certains paliers débloquent des <strong>récompenses à réclamer</strong> une fois par saison.
        </p>
      </article>

      <!-- Questions joueurs -->
      <article v-show="activeSection === 'questions'" class="faq-panel faq-panel-questions" role="tabpanel">
        <h2 class="faq-panel-title">FAQ — questions fréquentes</h2>
        <p class="faq-lead">
          Réponses courtes à des questions souvent posées.
        </p>
        <div class="faq-user-q-list">
          <div v-for="(qa, i) in userQuestions" :key="i" class="faq-user-q-item">
            <h3 class="faq-user-q">{{ qa.question }}</h3>
            <p class="faq-user-a">{{ qa.answer }}</p>
          </div>
        </div>
        <p class="faq-empty-hint">
          D’autres réponses suivront au fil des retours.
        </p>
      </article>

      <footer class="faq-tutorial-banner">
        <div class="faq-tutorial-text">
          <strong>Tutoriel</strong>
          <span>Tu peux relancer le tutoriel interactif depuis les premiers écrans du jeu.</span>
        </div>
        <button type="button" class="faq-tutorial-btn" @click="restartTutorial">
          Relancer le tutoriel
        </button>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { startTutorial, resetTutorial } from '../composables/useTutorial';

const faqTabs = [
  { id: 'accueil' as const, label: 'Accueil', emoji: '🏠' },
  { id: 'menu' as const, label: 'Menu', emoji: '🧭' },
  { id: 'combat' as const, label: 'Combat', emoji: '⚔️' },
  { id: 'stats' as const, label: 'Progression', emoji: '📈' },
  { id: 'effets' as const, label: 'Effets', emoji: '✨' },
  { id: 'invocations' as const, label: 'Invocations', emoji: '🏛️' },
  { id: 'campagne' as const, label: 'Campagne', emoji: '🗺️' },
  { id: 'donjon' as const, label: 'Donjon', emoji: '🏰' },
  { id: 'pvp' as const, label: 'PvP', emoji: '🎯' },
  { id: 'guilde' as const, label: 'Guilde', emoji: '👥' },
  { id: 'artefacts' as const, label: 'Artefacts', emoji: '💎' },
  { id: 'richesses' as const, label: 'Richesses', emoji: '💰' },
  { id: 'questions' as const, label: 'FAQ joueurs', emoji: '💬' }
];

type FaqTabId = (typeof faqTabs)[number]['id'];
const activeSection = ref<FaqTabId>('accueil');

function restartTutorial() {
  resetTutorial();
  startTutorial(true);
}

const userQuestions = [
  {
    question: "À quoi sert l'or dans le jeu ?",
    answer:
      "L'or sert à forger et à améliorer les artefacts. Le recyclage d'un artefact rend un peu d'or. "
      + "Tu gagnes aussi de l'or en campagne et en donjon (fin de niveau). Les artefacts s'obtiennent notamment à la forge, en donjon, et on les équipe sur une unité pour augmenter ses stats — plus en récompense directe de combat PvP."
  },
  {
    question: "Il n'y a pas de système d'énergie, donc on peut jouer sans limite ?",
    answer:
      "Il n'y a pas de jauge d'énergie qui bloque les combats, mais la fatigue des unités augmente : elles deviennent plus lentes (moins de tours de jeu) et gagnent moins d'XP si tu enchaînes. "
      + "Alterne les unités ou attends la décroissance de la fatigue."
  },
  {
    question: "La fatigue s'applique partout ?",
    answer:
      "Oui dans la plupart des modes, sauf en guerre de guilde où la fatigue ne s'applique pas. "
      + "La défense PvP n'est pas affectée par la fatigue quand d'autres joueurs l'attaquent. "
      + "En donjon, la fatigue s'applique à ton équipe seulement après la 3e victoire d'un niveau (pas entre les combats 1 et 2)."
  }
];
</script>

<style scoped>
.faq-page {
  margin: 0 -2rem;
  padding: 2rem 1.25rem 3rem;
  background:
    radial-gradient(ellipse 120% 80% at 50% -20%, rgba(34, 211, 238, 0.12), transparent 55%),
    #070b12;
  min-height: 100%;
}

.faq-inner {
  max-width: 820px;
  margin: 0 auto;
}

.faq-header {
  margin-bottom: 1.25rem;
}

.faq-intro {
  color: #94a3b8;
  margin: 0.75rem 0 0;
  line-height: 1.75;
  font-size: 0.95rem;
}

.faq-tab-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 1.25rem;
  padding: 0.35rem 0 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.faq-tab-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.65);
  color: #cbd5e1;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.2s,
    border-color 0.2s,
    color 0.2s,
    box-shadow 0.2s;
}

.faq-tab-pill:hover {
  border-color: rgba(34, 211, 238, 0.45);
  color: #f1f5f9;
}

.faq-tab-pill.active {
  border-color: rgba(34, 211, 238, 0.85);
  color: #5eead4;
  background: rgba(34, 211, 238, 0.1);
  box-shadow: 0 0 20px rgba(34, 211, 238, 0.12);
}

.faq-tab-emoji {
  font-size: 1rem;
  line-height: 1;
  opacity: 0.95;
}

.faq-panel {
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(100, 116, 139, 0.28);
  border-radius: 18px;
  padding: 1.6rem 1.4rem 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow:
    0 18px 50px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.faq-panel-title {
  margin: 0 0 1rem;
  font-size: 1.35rem;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: -0.02em;
}

.faq-lead {
  margin: 0 0 1rem;
  font-size: 1.02rem;
  line-height: 1.75;
  color: #e2e8f0;
  font-weight: 500;
}

.faq-panel p {
  margin: 0 0 0.9rem;
  color: #cbd5e1;
  line-height: 1.78;
  font-size: 0.95rem;
}

.faq-panel p:last-child {
  margin-bottom: 0;
}

.faq-subtitle {
  margin: 1.35rem 0 0.55rem;
  font-size: 1.02rem;
  font-weight: 600;
  color: #a5f3fc;
}

.faq-menu-list,
.faq-panel ul {
  margin: 0 0 0.9rem;
  padding-left: 1.15rem;
  color: #cbd5e1;
  line-height: 1.75;
  font-size: 0.95rem;
}

.faq-menu-list li,
.faq-panel ul li {
  margin-bottom: 0.65rem;
}

.faq-note {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: rgba(30, 41, 59, 0.6);
  border: 1px dashed rgba(148, 163, 184, 0.3);
  font-size: 0.88rem;
  color: #94a3b8;
}

.faq-tech {
  margin-top: 1.25rem;
  border-radius: 12px;
  border: 1px solid rgba(34, 211, 238, 0.22);
  background: rgba(8, 47, 73, 0.25);
  overflow: hidden;
}

.faq-tech summary {
  cursor: pointer;
  padding: 0.85rem 1rem;
  font-weight: 600;
  font-size: 0.88rem;
  color: #67e8f9;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.faq-tech summary::-webkit-details-marker {
 display: none;
}

.faq-tech summary::before {
  content: '▸';
  font-size: 0.7rem;
  transition: transform 0.2s;
  opacity: 0.85;
}

.faq-tech[open] summary::before {
  transform: rotate(90deg);
}

.faq-tech-body {
  padding: 0 1rem 1rem;
  font-size: 0.86rem;
  line-height: 1.7;
  color: #94a3b8;
  border-top: 1px solid rgba(34, 211, 238, 0.12);
}

.faq-tech-body p {
  margin: 0.75rem 0 0;
  font-size: 0.86rem;
  color: #94a3b8;
}

.faq-tech-list {
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
}

.faq-tech-body code {
  font-family: ui-monospace, monospace;
  font-size: 0.8em;
  background: rgba(0, 0, 0, 0.35);
  padding: 0.12rem 0.35rem;
  border-radius: 4px;
  color: #7dd3fc;
}

.faq-effects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  margin: 0.6rem 0 1.1rem;
}

.faq-effect {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid transparent;
}

.faq-effect.buff {
  background: rgba(34, 197, 94, 0.09);
  border-color: rgba(34, 197, 94, 0.28);
}

.faq-effect.debuff {
  background: rgba(239, 68, 68, 0.09);
  border-color: rgba(248, 113, 113, 0.3);
}

.faq-effect-name {
  font-weight: 700;
  font-size: 0.88rem;
  color: #e2e8f0;
}

.faq-effect.buff .faq-effect-name {
  color: #86efac;
}

.faq-effect.debuff .faq-effect-name {
  color: #fca5a5;
}

.faq-effect-desc {
  font-size: 0.82rem;
  color: #94a3b8;
  line-height: 1.5;
}

.faq-riches-list li {
  margin-bottom: 0.55rem;
}

.faq-user-q-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.faq-user-q-item {
  padding: 1rem 1.1rem;
  border-radius: 14px;
  background: rgba(30, 41, 59, 0.45);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.faq-user-q {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 700;
  color: #e2e8f0;
}

.faq-user-a {
  margin: 0;
  color: #94a3b8;
  line-height: 1.7;
  font-size: 0.92rem;
}

.faq-empty-hint {
  margin-top: 1rem;
  font-size: 0.85rem;
  color: #64748b;
  font-style: italic;
}

.faq-tutorial-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.5rem;
  padding: 1.05rem 1.25rem;
  background: linear-gradient(105deg, rgba(0, 229, 255, 0.1), rgba(99, 102, 241, 0.08));
  border: 1px solid rgba(0, 229, 255, 0.28);
  border-radius: 16px;
  flex-wrap: wrap;
}

.faq-tutorial-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: #cbd5e1;
  font-size: 0.88rem;
}

.faq-tutorial-text strong {
  color: #f8fafc;
  font-size: 0.95rem;
}

.faq-tutorial-btn {
  background: linear-gradient(120deg, #22d3ee, #818cf8);
  border: none;
  color: #0f172a;
  font-weight: 700;
  font-size: 0.88rem;
  padding: 0.55rem 1.15rem;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(34, 211, 238, 0.25);
  transition: transform 0.2s, box-shadow 0.2s;
  flex-shrink: 0;
}

.faq-tutorial-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 26px rgba(34, 211, 238, 0.45);
}

@media (max-width: 768px) {
  .faq-page {
    margin: 0 -1rem;
    padding: 1.25rem 0.85rem 2.5rem;
  }

  .faq-tab-strip {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-bottom: 0.75rem;
  }

  .faq-tab-pill {
    flex-shrink: 0;
  }

  .faq-tutorial-banner {
    flex-direction: column;
    align-items: stretch;
  }

  .faq-effects-grid {
    grid-template-columns: 1fr;
  }
}
</style>
