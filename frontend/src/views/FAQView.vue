<template>
  <section class="faq-page page-content">
    <div class="faq-inner">
    <h1 class="page-title nx-title">FAQ</h1>
    <p class="faq-intro">
      Bienvenue dans Nexus Core Arena. Cette page t'explique tout le jeu en langage simple — sans formules ni chiffres techniques.
    </p>

    <nav class="faq-nav" aria-label="Sections de la FAQ">
      <a
        v-for="s in sections"
        :key="s.id"
        :href="`#section-${s.id}`"
        class="faq-nav-link"
      >{{ s.title }}</a>
    </nav>

    <div class="faq-content">
      <!-- Combats -->
      <section :id="`section-${sections[0].id}`" class="faq-section">
        <h2 class="faq-section-title">⚔️ Les combats</h2>
        <h3>Comment ça marche ?</h3>
        <p>
          Chaque combat oppose deux équipes. Les unités agissent une par une, selon leur <strong>barre d'action (ATB)</strong> :
          plus une unité est rapide, plus elle se remplit vite et joue souvent. Le but est de vaincre toute l'équipe adverse.
        </p>
        <h3>Stats et vocabulaire</h3>
        <ul>
          <li><strong>PV (HP)</strong> : Points de vie. À 0, l'unité est K.O.</li>
          <li><strong>ATQ (ATK)</strong> : Attaque. Plus c'est haut, plus les dégâts infligés sont importants.</li>
          <li><strong>DEF</strong> : Défense. Réduit les dégâts reçus.</li>
          <li><strong>VIT (SPD)</strong> : Vitesse. Détermine la fréquence des actions.</li>
          <li><strong>CAC</strong> : Corps à corps. Unités placées devant, au contact direct de l'ennemi.</li>
          <li><strong>Distance</strong> : Unités placées à l'arrière, qui attaquent sans être directement exposées.</li>
        </ul>

        <h3>Ciblage : qui attaque qui ?</h3>
        <p>Le type d'une unité détermine qui elle peut cibler :</p>
        <ul>
          <li><strong>CAC</strong> : peut uniquement attaquer les unités ennemies <strong>CAC</strong>. Si l'ennemi n'a plus de CAC en vie, il peut alors cibler les Distance.</li>
          <li><strong>Distance</strong> : peut attaquer <strong>n'importe quelle</strong> unité ennemie, CAC ou Distance.</li>
        </ul>
        <p>Cela signifie que tes unités Distance sont relativement protégées tant que l'adversaire a des CAC en vie.</p>

        <h3>Fatigue des unités</h3>
        <p>
          Chaque unité possède une jauge de <strong>Fatigue</strong> (0 à 100). Combattre augmente la fatigue de <strong>+3 par combat</strong>.
          Elle redescend naturellement de <strong>1 par minute</strong> en dehors des combats.
        </p>
        <ul>
          <li><strong>Impact en combat</strong> : Chaque point de fatigue réduit la vitesse de l'unité de 1 %. Plus elle est fatiguée, plus elle est lente, et donc moins efficace.</li>
          <li>Si la fatigue dépasse <strong>50</strong>, l'XP gagnée après le combat est <strong>divisée par 2</strong>.</li>
          <li>La fatigue n'empêche pas de combattre — elle réduit la progression et l'efficacité au combat.</li>
          <li>Pour optimiser la montée en niveau, alterne tes unités plutôt que de toujours jouer le même preset.</li>
        </ul>

        <h3>Traits et Synergies</h3>
        <p>
          Chaque unité possède un ou plusieurs <strong>traits</strong> (Gardien, Druide, Arcaniste, Bourreau, Berserker, Tacticien).
          Ces traits déclenchent des <strong>synergies</strong> quand plusieurs unités de ton équipe partagent le même trait.
        </p>
        <ul>
          <li><strong>2 unités</strong> avec le même trait : bonus de base (ex. +10% défense pour 2 Gardiens).</li>
          <li><strong>4 unités</strong> : bonus intermédiaire (ex. bouclier au démarrage pour 4 Gardiens, vampirisme pour 4 Berserkers).</li>
          <li><strong>6 unités</strong> : bonus puissant (ex. réduction des dégâts reçus pour 6 Gardiens, bonus ATB pour 6 Tacticiens).</li>
        </ul>
        <p>Constituer des équipes cohérentes autour de 2 ou 3 traits complémentaires amplifie considérablement ta puissance.</p>

        <h3>Noyaux</h3>
        <p>
          Les unités <strong>épiques, légendaires et mythiques</strong> possèdent un <strong>Noyau</strong> : un bonus passif qui améliore une stat (PV, ATQ, DEF, VIT ou Maîtrise) de toute l'équipe.
        </p>
        <p>
          Dans <strong>Mes Équipes</strong>, tu dois choisir <strong>une seule</strong> unité dont le Noyau sera actif pour le preset. Seul ce Noyau s'applique à toute l'équipe.
          Choisis celui qui correspond le mieux à ta stratégie : par exemple, un Noyau +15% ATQ pour une équipe orientée dégâts, ou +15% DEF pour une équipe plus tank.
        </p>

        <h3>Tous les Buffs (effets positifs)</h3>
        <div class="faq-effects-grid">
          <div class="faq-effect buff">
            <span class="faq-effect-name">ATQ+ (ATK_UP)</span>
            <span class="faq-effect-desc">Augmente l'attaque de 50% pour X actions.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">DEF+ (DEF_UP)</span>
            <span class="faq-effect-desc">Augmente la défense de 50% pour X actions.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">VIT+ (SPEED_UP)</span>
            <span class="faq-effect-desc">Augmente la vitesse de 30% pour X actions.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Bouclier (SHIELD)</span>
            <span class="faq-effect-desc">Absorbe une quantité de dégâts avant de toucher aux PV.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Vol de Vie (LIFESTEAL)</span>
            <span class="faq-effect-desc">Une partie des dégâts infligés soigne l'unité.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Régénération (REGEN)</span>
            <span class="faq-effect-desc">Restaure des PV à chaque action de l'unité.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Immunité (IMMUNITY)</span>
            <span class="faq-effect-desc">Rend l'unité insensible à l'application de débuffs.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Invincibilité (INVINCIBILITY)</span>
            <span class="faq-effect-desc">L'unité ne peut pas perdre de PV pendant la durée.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Contre-Attaque (COUNTER_ATTACK)</span>
            <span class="faq-effect-desc">L'unité réplique automatiquement à chaque attaque reçue.</span>
          </div>
          <div class="faq-effect buff">
            <span class="faq-effect-name">Provocation (PROVOKE)</span>
            <span class="faq-effect-desc">Force les ennemis à cibler cette unité en priorité.</span>
          </div>
        </div>

        <h3>Tous les Débuffs (effets négatifs)</h3>
        <div class="faq-effects-grid">
          <div class="faq-effect debuff">
            <span class="faq-effect-name">ATQ− (ATK_DOWN)</span>
            <span class="faq-effect-desc">Réduit l'attaque de l'unité ciblée.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">DEF− (DEF_DOWN)</span>
            <span class="faq-effect-desc">Réduit la défense, rendant l'unité plus vulnérable aux dégâts.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Ralentissement (SLOW)</span>
            <span class="faq-effect-desc">Réduit la vitesse, l'unité joue moins souvent.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Silence (SILENCE)</span>
            <span class="faq-effect-desc">Empêche l'unité d'utiliser ses compétences actives.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Étourdissement (STUN)</span>
            <span class="faq-effect-desc">L'unité passe son tour complètement.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Aveuglement (BLIND)</span>
            <span class="faq-effect-desc">L'unité peut rater ses attaques de base.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Anti-Soin (ANTI_HEAL)</span>
            <span class="faq-effect-desc">Réduit ou annule les soins reçus par l'unité ciblée.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Anti-Bouclier (ANTI_SHIELD)</span>
            <span class="faq-effect-desc">Empêche la pose de nouveaux boucliers sur la cible.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Anti-Buff (ANTI_BUFF)</span>
            <span class="faq-effect-desc">Empêche l'application de buffs sur la cible.</span>
          </div>
          <div class="faq-effect debuff">
            <span class="faq-effect-name">Brûlure / Poison (DOT)</span>
            <span class="faq-effect-desc">Inflige des dégâts sur la durée à chaque action de l'unité.</span>
          </div>
        </div>

        <h3>Autres effets de compétence</h3>
        <ul>
          <li><strong>Strip</strong> : Retire des buffs actifs sur une unité ennemie.</li>
          <li><strong>Purification (Cleanse)</strong> : Retire des débuffs actifs sur une unité alliée.</li>
          <li><strong>Réduction ATB</strong> : Recule la barre d'action d'un ennemi (il joue plus tard).</li>
          <li><strong>Boost ATB</strong> : Avance la barre d'action d'un allié (il joue plus tôt).</li>
          <li><strong>Vol de Stat</strong> : Vole temporairement une stat (ATQ, DEF, VIT…) d'un ennemi pour te l'appliquer.</li>
          <li><strong>Résurrection</strong> : Ramène une unité alliée K.O. avec un certain nombre de PV.</li>
          <li><strong>Réinitialisation de recharge</strong> : Réinitialise le cooldown d'une compétence alliée.</li>
        </ul>
      </section>

      <!-- Sanctuaire -->
      <section :id="`section-${sections[1].id}`" class="faq-section">
        <h2 class="faq-section-title">🏛️ Le Sanctuaire d'invocation</h2>
        <p>
          Le Sanctuaire permet d'obtenir de nouvelles unités en les invoquant. Il y a trois portails, chacun avec sa propre monnaie et ses chances.
        </p>
        <h3>Portail Noyau</h3>
        <p>
          Coûte <strong>10 cores</strong> par invocation. Donne surtout des unités communes et peu communes, parfois rares.
          Idéal pour débuter et accumuler des doublons.
        </p>
        <h3>Portail Standard</h3>
        <p>
          Coûte <strong>100 crédits</strong> par invocation. Offre un spectre plus large : du commun au mythique.
          Un système de <strong>pitié</strong> garantit une unité épique tous les 25 tirages, légendaire tous les 100, et mythique tous les 1000.
        </p>
        <h3>Portail Résonance</h3>
        <p>
          Coûte <strong>100 fragments</strong> par invocation. Donne des unités rares ou épiques uniquement.
          Pratique quand tu veux des unités plus fortes sans les taux du portail standard.
        </p>
      </section>

      <!-- Menu et onglets -->
      <section :id="`section-${sections[2].id}`" class="faq-section">
        <h2 class="faq-section-title">📂 Les onglets du menu</h2>
        <ul>
          <li><strong>Ma Collection</strong> : Liste de toutes tes unités. Tu peux voir leurs stats, leur niveau, leur spécialisation, et gérer leurs artefacts.</li>
          <li><strong>Mes Équipes</strong> : Création de presets d'équipes pour la campagne, le PvP ou la guerre de guilde. Tu choisis lesquelles placer en CAC et en distance, et tu sélectionnes le Noyau.</li>
          <li><strong>Sanctuaire</strong> : Les trois portails d'invocation (Noyau, Standard, Résonance).</li>
          <li><strong>Artefacts</strong> : Équipements que tu forges, améliores et équipes sur tes unités pour booster leurs stats.</li>
          <li><strong>Guilde</strong> : Rejoins ou crée une guilde pour le portail de guilde, le chat, les guerres et les pièces de guilde.</li>
          <li><strong>Combats → Campagne</strong> : Mode PvE avec 10 chapitres, mode normal et difficile.</li>
          <li><strong>Combats → PvP</strong> : Affronte d'autres joueurs ou des PNJ pour monter en Elo.</li>
          <li><strong>Classement</strong> : Classement PvP par Elo.</li>
          <li><strong>Bestiaire</strong> : Catalogue de toutes les unités du jeu.</li>
        </ul>
      </section>

      <!-- Guilde -->
      <section :id="`section-${sections[3].id}`" class="faq-section">
        <h2 class="faq-section-title">👥 Les guildes</h2>
        <p>
          Les guildes sont des alliances de joueurs. En rejoignant une guilde, tu accèdes à plusieurs fonctionnalités.
        </p>
        <h3>Onglet Membres</h3>
        <p>
          Liste des membres, leurs rôles (propriétaire, officier, membre) et leurs pièces de guilde.
          Les officiers peuvent changer les rôles et gérer les demandes d'adhésion.
        </p>
        <h3>Onglet Demandes</h3>
        <p>
          Les joueurs qui demandent à rejoindre ta guilde apparaissent ici. Les officiers peuvent accepter ou refuser.
        </p>
        <h3>Onglet Portail de Guilde</h3>
        <p>
          Chaque semaine, une rotation d'unités est disponible. Tu peux les invoker avec tes <strong>pièces de guilde</strong>.
          Ces pièces s'obtiennent en participant aux guerres de guilde (victoire, défaite ou nul).
        </p>
        <h3>Onglet Activité</h3>
        <p>
          Historique des actions de la guilde : qui a rejoint, qui a tué un boss de campagne, qui a gagné en PvP, etc.
        </p>
        <h3>Onglet Guerre de Guilde</h3>
        <p>
          Ta guilde affronte une autre guilde chaque jour. Chaque membre prépare des presets de défense (équipes de 4 unités),
          et les officiers/leader sélectionnent les 6 défenses qui seront placées sur les slots.
          Pendant la phase d'attaque, chaque membre peut attaquer une défense ennemie avec une équipe de 4 unités.
          Les victoires donnent des pièces de guilde.
        </p>
        <h3>Onglet Chat de Guilde</h3>
        <p>
          Discussion avec tes coéquipiers.
        </p>
      </section>

      <!-- Campagne -->
      <section :id="`section-${sections[4].id}`" class="faq-section">
        <h2 class="faq-section-title">🗺️ La campagne</h2>
        <p>
          La campagne est le mode PvE principal. Elle se divise en <strong>10 chapitres</strong>, chacun avec plusieurs stages.
          Le dernier stage de chaque chapitre est un <strong>boss</strong>, plus difficile et plus gratifiant.
        </p>
        <h3>Mode normal et difficile</h3>
        <p>
          Le mode <strong>normal</strong> est disponible dès le début. Le mode <strong>difficile</strong> se débloque une fois le Boss du chapitre 5 du mode normal vaincu.
          Les récompenses du mode difficile sont meilleures, mais les ennemis sont plus forts.
        </p>
        <h3>Récompenses</h3>
        <p>
          À chaque stage vaincu pour la première fois, tu reçois des crédits, des cores, des fragments, et parfois de l'essence d'ascension.
          Les unités gagnent de l'XP. Les boss donnent plus de récompenses.
        </p>
      </section>

      <!-- PvP -->
      <section :id="`section-${sections[5].id}`" class="faq-section">
        <h2 class="faq-section-title">🎯 Le PvP</h2>
        <p>
          Le PvP te permet d'affronter d'autres joueurs ou des PNJ. Chaque victoire ou défaite modifie ton <strong>Elo</strong> :
          plus il est haut, plus ton rang est élevé.
        </p>
        <h3>Configuration obligatoire</h3>
        <p>
          Tu dois configurer une <strong>défense</strong> (équipe utilisée quand on t'attaque) pour pouvoir lancer un combat PvP.
          Va dans « Configurer la défense » pour la définir.
        </p>
        <h3>Preset d'attaque</h3>
        <p>
          Avant de chercher un adversaire, choisis le preset d'équipe que tu veux utiliser pour attaquer.
          Tu peux en avoir plusieurs (Campagne, PvP, Guerre de guilde, etc.).
        </p>
        <h3>Récompenses</h3>
        <p>
          Chaque combat donne de l'XP aux unités survivantes, ainsi qu'un peu d'or. En gagnant, tu reçois aussi 1 crédit.
          En montant en Elo, tu atteins des <strong>paliers</strong> (Argent, Or, Platine, Diamant, Master, Grand Master, Challenger)
          qui te donnent des récompenses uniques par saison.
        </p>
      </section>

      <!-- Artefacts -->
      <section :id="`section-${sections[6].id}`" class="faq-section">
        <h2 class="faq-section-title">💎 Les artefacts</h2>
        <p>
          Les artefacts renforcent tes unités. Tu peux les forger, les équiper et les améliorer.
          Ils peuvent aussi être obtenus en <strong>PvP uniquement</strong>, en gagnant un combat, à un faible taux de drop.
        </p>
        <h3>Forge</h3>
        <p>
          Coûte <strong>5000 or</strong>. Crée un nouvel artefact aléatoire. L'or s'obtient en combattant (campagne, PvP) ou en recyclant des artefacts.
        </p>
        <h3>Amélioration</h3>
        <p>
          Tu dépenses de l'or pour monter un artefact de niveau. Chaque niveau augmente son bonus.
          Le coût et la chance de réussite augmentent avec le niveau.
        </p>
        <h3>Recyclage</h3>
        <p>
          Détruire un artefact équipé te rend <strong>50 or</strong>. Utile pour libérer une place ou récupérer de l'or.
        </p>
      </section>

      <!-- Ressources -->
      <section :id="`section-${sections[7].id}`" class="faq-section">
        <h2 class="faq-section-title">💰 Les ressources</h2>
        <ul>
          <li><strong>Crédits</strong> : Pour les invocations au portail Standard, et gagnés en campagne, PvP, connexion quotidienne et paliers.</li>
          <li><strong>Cores</strong> : Pour les invocations au portail Noyau. Campagne, connexion quotidienne, paliers.</li>
          <li><strong>Fragments</strong> : Pour le portail Résonance. Campagne, connexion quotidienne, paliers.</li>
          <li><strong>Or</strong> : Pour forger et améliorer les artefacts. Obtenu en combattant ou en recyclant des artefacts.</li>
          <li><strong>Essence d'ascension</strong> : Ressource rare pour l'ascension des unités. Boss de campagne, palier Challenger en PvP.</li>
          <li><strong>Pièces de guilde</strong> : Pour les invocations du portail de guilde. Guerres de guilde.</li>
        </ul>
      </section>
    </div>

    <!-- Relancer le tutoriel -->
    <div class="faq-tutorial-banner">
      <div class="faq-tutorial-text">
        <strong>Nouveau joueur ?</strong>
        <span>Le tutoriel interactif te guide pas à pas dans tes premiers pas.</span>
      </div>
      <button class="faq-tutorial-btn" @click="restartTutorial">
        🎮 Relancer le tutoriel
      </button>
    </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { startTutorial, resetTutorial } from '../composables/useTutorial';

function restartTutorial() {
  resetTutorial();
  startTutorial(true);
}

const sections = [
  { id: 'combats', title: 'Combats' },
  { id: 'sanctuaire', title: 'Sanctuaire' },
  { id: 'menu', title: 'Menu et onglets' },
  { id: 'guilde', title: 'Guilde' },
  { id: 'campagne', title: 'Campagne' },
  { id: 'pvp', title: 'PvP' },
  { id: 'artefacts', title: 'Artefacts' },
  { id: 'ressources', title: 'Ressources' }
];
</script>

<style scoped>
.faq-page {
  margin: 0 -2rem;
  padding: 2rem;
  background: #080c14;
  min-height: 100%;
}

.faq-inner {
  max-width: 720px;
  margin: 0 auto;
}

.faq-intro {
  color: #cbd5e1;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.faq-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 2rem;
  padding: 0.75rem;
  background: rgba(12, 18, 32, 0.95);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 0.75rem;
}

.faq-nav-link {
  color: #93c5fd;
  text-decoration: none;
  padding: 0.35rem 0.6rem;
  border-radius: 0.4rem;
  font-size: 0.85rem;
  transition: background 0.2s, color 0.2s;
}

.faq-nav-link:hover {
  background: rgba(0, 255, 255, 0.15);
  color: #00ffff;
}

.faq-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.faq-section {
  scroll-margin-top: 1rem;
}

.faq-section-title {
  font-size: 1.35rem;
  color: #f8fafc;
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(0, 255, 255, 0.2);
}

.faq-section h3 {
  font-size: 1.05rem;
  color: #e2e8f0;
  margin: 1rem 0 0.5rem;
}

.faq-section p,
.faq-section ul {
  color: #cbd5e1;
  line-height: 1.65;
  margin: 0 0 0.75rem;
}

.faq-section ul {
  padding-left: 1.25rem;
}

.faq-section li {
  margin-bottom: 0.4rem;
}

/* Grilles d'effets buffs/debuffs */
.faq-effects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 8px;
  margin: 0.5rem 0 1rem;
}

.faq-effect {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid transparent;
}

.faq-effect.buff {
  background: rgba(34, 197, 94, 0.07);
  border-color: rgba(34, 197, 94, 0.22);
}

.faq-effect.debuff {
  background: rgba(239, 68, 68, 0.07);
  border-color: rgba(239, 68, 68, 0.22);
}

.faq-effect-name {
  font-weight: 700;
  font-size: 0.85rem;
  color: #e2e8f0;
}

.faq-effect.buff .faq-effect-name {
  color: #86efac;
}

.faq-effect.debuff .faq-effect-name {
  color: #fca5a5;
}

.faq-effect-desc {
  font-size: 0.8rem;
  color: #94a3b8;
  line-height: 1.45;
}

/* Bannière tutoriel */
.faq-tutorial-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 2.5rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.08), rgba(43, 255, 158, 0.06));
  border: 1px solid rgba(0, 229, 255, 0.25);
  border-radius: 12px;
  flex-wrap: wrap;
}

.faq-tutorial-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: #cbd5e1;
  font-size: 0.88rem;
}

.faq-tutorial-text strong {
  color: #eaf6ff;
  font-size: 0.95rem;
}

.faq-tutorial-btn {
  background: linear-gradient(90deg, #00e5ff, #2bff9e);
  border: none;
  color: #0b1428;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 0.55rem 1.2rem;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 0 16px rgba(0, 229, 255, 0.35);
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.faq-tutorial-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 26px rgba(0, 229, 255, 0.6);
}

@media (max-width: 768px) {
  .faq-page {
    margin: 0 -1rem;
    padding: 1rem;
  }

  .faq-tutorial-banner {
    flex-direction: column;
    align-items: flex-start;
  }

  .faq-effects-grid {
    grid-template-columns: 1fr;
  }
}
</style>
