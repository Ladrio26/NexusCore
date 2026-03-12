<template>
  <section class="leaderboard page-content">
    <div class="leaderboard-bg" aria-hidden="true" />

    <header class="leaderboard-header">
      <h1 class="page-title nx-title">Classement</h1>
    </header>

    <div v-if="loading" class="state-text">Chargement du classement...</div>
    <div v-else-if="error" class="state-text state-error">{{ error }}</div>
    <div v-else-if="!players.length" class="state-text">
      {{ board === 'guild' ? 'Aucune guilde pour le moment.' : 'Aucun joueur pour le moment.' }}
    </div>
    <div v-else>
      <div class="leaderboard-controls nx-panel">
        <div class="board-filters">
          <button type="button" class="board-filter" :class="{ active: board === 'rank' }" :disabled="loading" @click="setBoard('rank')">
            Rang
          </button>
          <button type="button" class="board-filter" :class="{ active: board === 'campaign' }" :disabled="loading" @click="setBoard('campaign')">
            Campagne
          </button>
          <button type="button" class="board-filter" :class="{ active: board === 'guild' }" :disabled="loading" @click="setBoard('guild')">
            Guilde
          </button>
        </div>
        <nav v-if="showPager" class="pager-inline" aria-label="Pagination du classement">
          <button v-if="page > 1" type="button" class="nx-btn nx-btn-ghost" :disabled="loading" @click="goToPage(page - 1)">
            Precedent
          </button>
          <span class="page-indicator">Page {{ page }} / {{ totalPages }}</span>
          <button v-if="page < totalPages" type="button" class="nx-btn nx-btn-ghost" :disabled="loading" @click="goToPage(page + 1)">
            Suivant
          </button>
        </nav>
      </div>

      <div class="leaderboard-table-wrap nx-panel">
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th>Rang</th>
              <th>{{ board === 'guild' ? 'Guilde' : 'Joueur' }}</th>
              <th>
                {{
                  board === 'campaign'
                    ? 'Campagne difficile'
                    : board === 'guild'
                      ? 'Bilan de guerre'
                      : 'Ligue'
                }}
              </th>
              <th v-if="board !== 'campaign'">Elo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="player in players" :key="player.id" :class="rowClass(player.rank)">
              <td class="rank-cell">
                <span class="rank-pill" :class="rankPillClass(player.rank)">
                  {{ rankLabel(player.rank) }}
                </span>
              </td>
              <td>
                <span v-if="board === 'guild'" class="guild-name">{{ player.pseudo }}</span>
                <router-link v-else :to="`/collection/${player.id}`" class="player-link">
                  <img :src="getAvatarUrl(player)" alt="" class="player-avatar" />
                  <span class="player-name">{{ player.pseudo }}</span>
                </router-link>
              </td>
              <td>
                <span v-if="board === 'campaign'" class="league-badge compact campaign-badge" :class="{ locked: player.campaign_label === 'Verrouillé' }">
                  {{ player.campaign_label }}
                </span>
                <span v-else-if="board === 'guild'" class="guild-war-stats">
                  {{ player.wins ?? 0 }}V / {{ player.losses ?? 0 }}D / {{ player.draws ?? 0 }}N · {{ player.member_count ?? 0 }} membres
                </span>
                <span v-else class="league-badge compact" :class="leagueClass(player.elo, player.rank)">
                  {{ leagueLabel(player.elo, player.rank) }}
                </span>
              </td>
              <td v-if="board !== 'campaign'" class="elo-cell">{{ player.elo }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import api from '../api';
import { getAvatarUrl } from '@/utils/avatar';

type LeaderboardPlayer = {
  id: number;
  pseudo: string;
  elo?: number;
  rank: number;
  avatar_url?: string | null;
  campaign_label?: string;
  unlocked_score?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  member_count?: number;
};

const PAGE_SIZE = 20;

const players = ref<LeaderboardPlayer[]>([]);
const loading = ref(false);
const error = ref('');
const page = ref(1);
const total = ref(0);
const totalPages = ref(1);
const board = ref<'rank' | 'campaign' | 'guild'>('rank');

function leagueLabel(elo: number, rank?: number): string {
  if (rank === 1 && elo >= 1700) return 'Légende';
  if (elo >= 1700) return 'Challenger';
  if (elo >= 1600) return 'Grand Master';
  if (elo >= 1500) return 'Master';
  if (elo >= 1400) return 'Diamant 1';
  if (elo >= 1300) return 'Diamant 2';
  if (elo >= 1200) return 'Diamant 3';
  if (elo >= 1100) return 'Platine 1';
  if (elo >= 1000) return 'Platine 2';
  if (elo >= 900) return 'Platine 3';
  if (elo >= 800) return 'Or 1';
  if (elo >= 700) return 'Or 2';
  if (elo >= 600) return 'Or 3';
  if (elo >= 500) return 'Argent 1';
  if (elo >= 400) return 'Argent 2';
  if (elo >= 300) return 'Argent 3';
  if (elo >= 200) return 'Bronze 1';
  if (elo >= 100) return 'Bronze 2';
  return 'Bronze 3';
}

function leagueClass(elo: number, rank?: number): string {
  if (rank === 1 && elo >= 1700) return 'league-legend';
  if (elo >= 1700) return 'league-challenger';
  if (elo >= 1600) return 'league-grandmaster';
  if (elo >= 1500) return 'league-master';
  if (elo >= 1200) return 'league-diamond';
  if (elo >= 900) return 'league-platinum';
  if (elo >= 600) return 'league-gold';
  if (elo >= 300) return 'league-silver';
  return 'league-bronze';
}

function rankLabel(rank: number) {
  return String(rank);
}

function rankPillClass(rank: number) {
  if (rank === 1) return 'top-1';
  if (rank === 2) return 'top-2';
  if (rank === 3) return 'top-3';
  return 'standard';
}

function rowClass(rank: number) {
  if (rank <= 3) return `row-top-${rank}`;
  if (rank <= 10) return 'row-top-10';
  return '';
}

const showPager = computed(() => total.value > PAGE_SIZE && totalPages.value > 1);

async function loadLeaderboard(targetPage = 1) {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/leaderboard', {
      params: { page: targetPage, limit: PAGE_SIZE, board: board.value }
    });
    players.value = Array.isArray(data.players) ? data.players : [];
    page.value = Number(data.page ?? targetPage);
    total.value = Number(data.total ?? players.value.length);
    totalPages.value = Math.max(1, Number(data.totalPages ?? 1));
  } catch {
    error.value = 'Impossible de charger le classement.';
  } finally {
    loading.value = false;
  }
}

function goToPage(targetPage: number) {
  if (targetPage < 1 || targetPage > totalPages.value || targetPage === page.value || loading.value) return;
  void loadLeaderboard(targetPage);
}

function setBoard(nextBoard: 'rank' | 'campaign' | 'guild') {
  if (board.value === nextBoard || loading.value) return;
  board.value = nextBoard;
  void loadLeaderboard(1);
}

onMounted(() => {
  void loadLeaderboard(1);
});
</script>

<style scoped>
.leaderboard {
  width: 100%;
  min-height: 60vh;
  padding: 18px 24px 28px;
  position: relative;
  overflow: hidden;
}

.leaderboard-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 120% 80% at 50% -20%, rgba(0, 255, 255, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse 80% 50% at 50% 60%, rgba(30, 58, 138, 0.15) 0%, transparent 55%),
    radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%);
  pointer-events: none;
}

.leaderboard-header {
  position: relative;
  margin-bottom: 10px;
  text-align: center;
}

.page-title {
  font-size: 1.85rem;
  font-weight: 700;
  margin: 0 0 4px;
  letter-spacing: 0.02em;
  background: linear-gradient(180deg, #f8fafc 0%, #cbd5e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.leaderboard-controls {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin: 0 auto 12px;
  max-width: 980px;
  padding: 10px 14px;
  color: #cbd5e1;
  font-size: 0.9rem;
}

.board-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.board-filter {
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.72);
  color: #e2e8f0;
  border-radius: 10px;
  padding: 8px 12px;
  font-weight: 700;
  cursor: pointer;
}

.board-filter.active {
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(30, 64, 175, 0.35);
}

.pager-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.page-indicator {
  color: #cbd5e1;
  font-size: 0.9rem;
}

.leaderboard-table-wrap {
  position: relative;
  z-index: 1;
  max-width: 980px;
  margin: 0 auto;
  overflow: hidden;
  padding: 8px 10px;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
}

.leaderboard-table th,
.leaderboard-table td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  text-align: left;
}

.leaderboard-table th {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
}

.leaderboard-table td {
  font-size: 0.92rem;
  color: #e2e8f0;
}

.rank-cell,
.elo-cell {
  white-space: nowrap;
}

.rank-pill {
  display: inline-flex;
  min-width: 34px;
  justify-content: center;
  align-items: center;
  border-radius: 999px;
  padding: 4px 8px;
  font-weight: 800;
  font-size: 0.82rem;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.rank-pill.top-1 {
  background: rgba(250, 204, 21, 0.18);
  border-color: rgba(250, 204, 21, 0.4);
  color: #fde68a;
}

.rank-pill.top-2 {
  background: rgba(148, 163, 184, 0.18);
  border-color: rgba(203, 213, 225, 0.35);
  color: #e2e8f0;
}

.rank-pill.top-3 {
  background: rgba(180, 83, 9, 0.2);
  border-color: rgba(251, 191, 36, 0.25);
  color: #fcd34d;
}

.player-link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  text-decoration: none;
}

.player-avatar {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  object-fit: cover;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.player-name {
  font-weight: 700;
}

.guild-name {
  font-weight: 700;
  color: #e2e8f0;
}

.guild-war-stats {
  color: #cbd5e1;
  font-size: 0.82rem;
}

.row-top-1,
.row-top-2,
.row-top-3 {
  background: rgba(15, 23, 42, 0.36);
}

.row-top-10 {
  background: rgba(15, 23, 42, 0.18);
}

.league-badge.compact {
  font-size: 0.72rem;
  padding: 4px 8px;
  border-radius: 999px;
  font-weight: 700;
  border: 1px solid transparent;
}

.league-legend,
.league-challenger {
  background: rgba(168, 85, 247, 0.18);
  border-color: rgba(216, 180, 254, 0.28);
  color: #e9d5ff;
}

.league-grandmaster,
.league-master {
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(252, 165, 165, 0.26);
  color: #fecaca;
}

.league-diamond {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(147, 197, 253, 0.26);
  color: #bfdbfe;
}

.league-platinum {
  background: rgba(20, 184, 166, 0.16);
  border-color: rgba(153, 246, 228, 0.26);
  color: #99f6e4;
}

.league-gold {
  background: rgba(234, 179, 8, 0.16);
  border-color: rgba(253, 224, 71, 0.26);
  color: #fde047;
}

.league-silver {
  background: rgba(148, 163, 184, 0.16);
  border-color: rgba(226, 232, 240, 0.24);
  color: #e2e8f0;
}

.league-bronze {
  background: rgba(180, 83, 9, 0.18);
  border-color: rgba(251, 191, 36, 0.18);
  color: #fdba74;
}

.campaign-badge {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(147, 197, 253, 0.26);
  color: #bfdbfe;
}

.campaign-badge.locked {
  background: rgba(127, 29, 29, 0.2);
  border-color: rgba(248, 113, 113, 0.24);
  color: #fecaca;
}

.state-text {
  position: relative;
  z-index: 1;
  text-align: center;
  color: #cbd5e1;
  padding: 32px 0;
}

.state-error {
  color: #fca5a5;
}

@media (max-width: 768px) {
  .leaderboard {
    padding: 16px 12px 24px;
  }

  .leaderboard-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .leaderboard-table th:nth-child(3),
  .leaderboard-table td:nth-child(3) {
    display: none;
  }

  .player-avatar {
    width: 26px;
    height: 26px;
  }
}
</style>
