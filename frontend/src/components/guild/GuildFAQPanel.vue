<template>
  <section class="guild-faq-panel nx-panel">
    <div class="gfaq-header">
      <span class="gfaq-kicker">Guide complet</span>
      <h3 class="gfaq-title">⚔️ Fonctionnement des Guerres de Guilde</h3>
      <p class="gfaq-intro">Tout ce que les membres et officiers doivent savoir pour participer aux guerres.</p>
    </div>

    <nav class="gfaq-nav" aria-label="Sections">
      <a v-for="s in sections" :key="s.id" :href="`#gfaq-${s.id}`" class="gfaq-nav-link">{{ s.label }}</a>
    </nav>

    <div class="gfaq-content">

      <!-- Vue d'ensemble -->
      <section id="gfaq-overview" class="gfaq-section">
        <h4 class="gfaq-section-title">📋 Vue d'ensemble</h4>
        <p>
        La Guerre de Guilde est un affrontement <strong>quotidien</strong> entre deux guildes. Le but est de détruire un maximum
        de défenses adverses tout en protégeant les tiennes. Les victoires rapportent des <strong>pièces de guilde</strong>,
        la monnaie qui permet d'invoquer au Portail de Guilde.
        </p>
        <div class="gfaq-timeline">
          <div class="gfaq-timeline-step">
            <span class="gfaq-step-icon">🌙</span>
            <div>
              <strong>Minuit — Matchmaking</strong>
              <p>Le système associe automatiquement deux guildes de niveau comparable. La guerre débute.</p>
            </div>
          </div>
          <div class="gfaq-timeline-step">
            <span class="gfaq-step-icon">🛡️</span>
            <div>
              <strong>Minuit → 12h — Phase de Préparation</strong>
              <p>Chaque membre peut placer son équipe de défense. C'est le moment de configurer ta défense !</p>
            </div>
          </div>
          <div class="gfaq-timeline-step">
            <span class="gfaq-step-icon">⚔️</span>
            <div>
              <strong>12h → Minuit — Phase d'Attaque</strong>
              <p>Les guildes s'affrontent : chaque membre peut attaquer les défenses ennemies et marquer des points.</p>
            </div>
          </div>
          <div class="gfaq-timeline-step">
            <span class="gfaq-step-icon">🏆</span>
            <div>
              <strong>Minuit — Résultats</strong>
              <p>La guilde ayant le plus de points remporte la guerre. Les deux guildes reçoivent des pièces.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Rôle des membres -->
      <section id="gfaq-members" class="gfaq-section">
        <h4 class="gfaq-section-title">👤 Ce que doit faire un Membre</h4>

        <div class="gfaq-step-card">
          <div class="gfaq-step-num">1</div>
          <div>
            <strong>Préparer ses presets de défense (avant 12h)</strong>
            <p>
              Dans l'onglet <em>Guerre de Guilde</em>, crée jusqu'à <strong>3 presets de défense</strong> — chacun
              composé de <strong>4 unités maximum</strong>. Ces presets sont visibles par le leader et les officiers,
              qui sélectionneront parmi toutes les propositions de la guilde les <strong>6 défenses</strong> qui seront
              placées sur les slots de la guerre. Propose tes équipes les plus robustes !
            </p>
          </div>
        </div>

        <div class="gfaq-step-card">
          <div class="gfaq-step-num">2</div>
          <div>
            <strong>Attaquer une défense ennemie (après 12h)</strong>
            <p>
              Tu peux attaquer l'une des défenses de la guilde adverse avec une équipe de <strong>4 unités</strong>.
              Chaque défense détruite rapporte des points à ta guilde.
              Tu n'as droit qu'à <strong>une seule attaque par guerre</strong> — choisis bien ta cible !
              Analyse les défenses ennemies et sélectionne celle que ton équipe peut battre.
            </p>
          </div>
        </div>

        <div class="gfaq-step-card">
          <div class="gfaq-step-num">3</div>
          <div>
            <strong>Coordonner avec les coéquipiers</strong>
            <p>
              Utilisez le <strong>Chat de Guilde</strong> pour vous coordonner : qui attaque quoi,
              quelles défenses ennemies sont les plus faibles, etc.
            </p>
          </div>
        </div>
      </section>

      <!-- Rôle des officiers -->
      <section id="gfaq-officers" class="gfaq-section">
        <h4 class="gfaq-section-title">⭐ Ce que doit faire un Officier</h4>
        <p>Les officiers (et le leader) ont les mêmes responsabilités que les membres, plus des tâches essentielles :</p>
        <ul>
          <li>
            <strong>Sélectionner les 6 défenses (avant 12h)</strong> : consulter tous les presets de défense
            proposés par les membres et placer les 6 meilleurs dans les slots de défense de la guerre.
            Les slots vides accordent automatiquement un point à l'adversaire !
          </li>
          <li>
            <strong>Accepter/Refuser les demandes d'adhésion</strong> pendant la guerre pour maintenir un effectif fort.
          </li>
          <li>
            <strong>Coordonner les attaques</strong> dans le chat : répartir les cibles entre les membres
            pour maximiser les points sans gâcher des attaques sur des défenses déjà détruites.
          </li>
          <li>
            <strong>Encourager la participation</strong> : rappeler aux membres de soumettre leurs presets avant 12h
            et de lancer leur attaque pendant la phase d'attaque.
          </li>
        </ul>
      </section>

      <!-- Récompenses -->
      <section id="gfaq-rewards" class="gfaq-section">
        <h4 class="gfaq-section-title">💰 Récompenses</h4>
        <p>À la fin de chaque guerre, <strong>tous les membres</strong> reçoivent des pièces de guilde selon le résultat :</p>
        <div class="gfaq-rewards-grid">
          <div class="gfaq-reward-card win">
            <span class="gfaq-reward-icon">✅</span>
            <strong>Victoire</strong>
            <span class="gfaq-reward-coins">+100 🪙</span>
          </div>
          <div class="gfaq-reward-card draw">
            <span class="gfaq-reward-icon">➖</span>
            <strong>Match nul</strong>
            <span class="gfaq-reward-coins">+75 🪙</span>
          </div>
          <div class="gfaq-reward-card loss">
            <span class="gfaq-reward-icon">❌</span>
            <strong>Défaite</strong>
            <span class="gfaq-reward-coins">+50 🪙</span>
          </div>
        </div>
        <p class="gfaq-note">
          Les pièces de guilde s'utilisent dans le <strong>Portail de Guilde</strong> pour invoquer des unités de la rotation hebdomadaire.
          Participe à chaque guerre pour accumuler des pièces et élargir ta collection !
        </p>
      </section>

      <!-- Conseils -->
      <section id="gfaq-tips" class="gfaq-section">
        <h4 class="gfaq-section-title">💡 Conseils stratégiques</h4>
        <ul>
          <li>
            <strong>Défense variée :</strong> Place des unités de rôles différents (soigneur, tank, attaquant) pour rendre ta défense imprévisible.
          </li>
          <li>
            <strong>Synergie d'équipe :</strong> Les unités qui se complètent (buffs + dégâts, par exemple) sont plus efficaces en défense qu'une simple accumulation d'attaquants.
          </li>
          <li>
            <strong>Attaque ciblée :</strong> N'attaque pas au hasard. Repère les défenses ennemies les plus faibles
            ou les moins bien adaptées à ton équipe.
          </li>
          <li>
            <strong>Ne rate pas ta fenêtre :</strong> Tu n'as qu'une seule attaque par guerre. Si tu n'attaques pas,
            tu ne contribues pas aux points de la guilde.
          </li>
          <li>
            <strong>Coordination :</strong> Évite que plusieurs membres attaquent la même cible. Utilisez le chat pour
            vous répartir les défenses ennemies.
          </li>
        </ul>
      </section>

    </div>
  </section>
</template>

<script setup lang="ts">
const sections = [
  { id: 'overview', label: 'Vue d\'ensemble' },
  { id: 'members', label: 'Rôle des membres' },
  { id: 'officers', label: 'Rôle des officiers' },
  { id: 'rewards', label: 'Récompenses' },
  { id: 'tips', label: 'Conseils' },
];
</script>

<style scoped>
.guild-faq-panel {
  padding: 22px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(8, 13, 24, 0.95), rgba(11, 20, 35, 0.92));
  border: 1px solid rgba(125, 211, 252, 0.12);
}

.gfaq-header {
  margin-bottom: 1.5rem;
}

.gfaq-kicker {
  display: inline-block;
  margin-bottom: 10px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(139, 92, 246, 0.14);
  border: 1px solid rgba(167, 139, 250, 0.2);
  color: #c4b5fd;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.gfaq-title {
  margin: 0 0 0.5rem;
  font-size: 1.3rem;
  color: #f8fafc;
}

.gfaq-intro {
  margin: 0;
  color: #94a3b8;
  font-size: 0.92rem;
}

.gfaq-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1.75rem;
  padding: 0.65rem 0.75rem;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 10px;
}

.gfaq-nav-link {
  color: #7dd3fc;
  text-decoration: none;
  padding: 0.3rem 0.55rem;
  border-radius: 6px;
  font-size: 0.82rem;
  transition: background 0.18s, color 0.18s;
}

.gfaq-nav-link:hover {
  background: rgba(0, 255, 255, 0.12);
  color: #00ffff;
}

.gfaq-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.gfaq-section {
  scroll-margin-top: 1rem;
}

.gfaq-section-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(0, 255, 255, 0.15);
}

.gfaq-section p,
.gfaq-section ul {
  color: #94a3b8;
  line-height: 1.65;
  margin: 0 0 0.75rem;
}

.gfaq-section ul {
  padding-left: 1.25rem;
}

.gfaq-section li {
  margin-bottom: 0.5rem;
}

/* Timeline */
.gfaq-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 0.75rem;
  position: relative;
}

.gfaq-timeline::before {
  content: '';
  position: absolute;
  left: 19px;
  top: 28px;
  bottom: 28px;
  width: 2px;
  background: linear-gradient(to bottom, rgba(0, 229, 255, 0.5), rgba(139, 92, 246, 0.3));
}

.gfaq-timeline-step {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 14px 0;
  position: relative;
}

.gfaq-step-icon {
  font-size: 1.35rem;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(0, 229, 255, 0.3);
  border-radius: 50%;
  position: relative;
  z-index: 1;
}

.gfaq-timeline-step > div strong {
  color: #e2e8f0;
  font-size: 0.95rem;
}

.gfaq-timeline-step > div p {
  margin: 0.25rem 0 0;
  color: #94a3b8;
  font-size: 0.88rem;
}

/* Step cards */
.gfaq-step-card {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 14px 16px;
  margin-bottom: 10px;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 12px;
}

.gfaq-step-num {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #00e5ff, #2bff9e);
  color: #0b1428;
  font-weight: 800;
  font-size: 0.9rem;
  border-radius: 50%;
}

.gfaq-step-card strong {
  color: #e2e8f0;
  font-size: 0.95rem;
  display: block;
  margin-bottom: 0.25rem;
}

.gfaq-step-card p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.88rem;
  line-height: 1.6;
}

/* Rewards */
.gfaq-rewards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 0.75rem 0;
}

.gfaq-reward-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 10px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.15);
  background: rgba(15, 23, 42, 0.7);
  text-align: center;
}

.gfaq-reward-card.win {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.08);
}

.gfaq-reward-card.draw {
  border-color: rgba(148, 163, 184, 0.3);
  background: rgba(148, 163, 184, 0.08);
}

.gfaq-reward-card.loss {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.08);
}

.gfaq-reward-icon {
  font-size: 1.4rem;
}

.gfaq-reward-card strong {
  color: #e2e8f0;
  font-size: 0.88rem;
}

.gfaq-reward-coins {
  color: #fde68a;
  font-weight: 700;
  font-size: 1.05rem;
}

.gfaq-note {
  font-size: 0.86rem;
  color: #64748b;
  font-style: italic;
}

@media (max-width: 640px) {
  .gfaq-rewards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
