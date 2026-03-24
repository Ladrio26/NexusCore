<template>
  <section class="gacha">
    <div class="card nx-panel">
      <h2 class="nx-title">Gacha</h2>

      <div class="wallet">
        <span class="credits">Credits: {{ wallet.credits }}</span>
        <span class="cores">Cores: {{ wallet.cores }}</span>
      </div>

      <div class="pity-list">
        <p class="pity-line">Épique Assuré {{ pity.pity_epic }}/25</p>
        <p class="pity-line">Légendaire Assuré {{ pity.pity_legendary }}/100</p>
        <p class="pity-line">Mythic Assuré {{ pity.pity_mythic }}/1000</p>
      </div>

      <div class="actions">
        <button class="btn-pull nx-btn" :disabled="loading || wallet.credits < 100" @click="pull(1)">
          Pull x1 (100 credits)
        </button>
      </div>

      <div v-if="loading" class="status">Chargement...</div>
      <div v-else-if="pullError" class="error">{{ pullError }}</div>
      <div v-else-if="lastResult" class="result">
        <h3>Dernier tirage</h3>
        <div class="result-unit" :class="lastResult.rarity">
          <strong>{{ lastResult.unit?.name }}</strong>
          <span class="rarity">{{ lastResult.rarity }}</span>
          <span v-if="lastResult.isNewUnit" class="badge nx-badge">Nouvelle unité</span>
          <span v-else class="badge nx-badge">+{{ lastResult.fragments }} fragments</span>
        </div>
        <p v-if="lastResult.wallet" class="wallet-after">
          Credits: {{ lastResult.wallet.credits }} | Cores: {{ lastResult.wallet.cores }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import api from '../api';

const bannerKey = ref('standard');
const wallet = ref({ credits: 0, cores: 0 });
const pity = ref({ total_pulls: 0, pity_epic: 0, pity_legendary: 0, pity_mythic: 0 });
const loading = ref(false);
const pullError = ref('');
const lastResult = ref<any>(null);

async function loadWallet() {
  try {
    const { data } = await api.get('/wallet');
    wallet.value = data;
  } catch {
    wallet.value = { credits: 0, cores: 0 };
  }
}

async function loadPity() {
  try {
    const { data } = await api.get('/gacha/pity', { params: { bannerKey: bannerKey.value } });
    pity.value = data;
  } catch {
    pity.value = { total_pulls: 0, pity_epic: 0, pity_legendary: 0, pity_mythic: 0 };
  }
}

async function pull(_count?: number) {
  loading.value = true;
  pullError.value = '';
  lastResult.value = null;
  try {
    const { data } = await api.post('/gacha/pull', { bannerKey: bannerKey.value });
    if (data.success) {
      lastResult.value = data;
      wallet.value = data.wallet ?? wallet.value;
      pity.value = data.pity ?? pity.value;
      await loadWallet();
      await loadPity();
    } else {
      pullError.value = data.error === 'INSUFFICIENT_CREDITS' ? 'Pas assez de credits (100 requis)' : (data.error || 'Erreur');
    }
  } catch (e: any) {
    pullError.value = e.response?.data?.error || e.message || 'Erreur réseau';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadWallet();
  await loadPity();
});
</script>

<style scoped>
.gacha {
  display: flex;
  justify-content: center;
}

.card {
  background: rgba(15, 23, 42, 0.95);
  border-radius: 1rem;
  padding: 1.5rem 2rem;
  max-width: 560px;
  border: 1px solid rgba(148, 163, 184, 0.4);
}

.wallet {
  display: flex;
  gap: 1.5rem;
  margin: 1rem 0;
}

.pity-list {
  margin: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.pity-line {
  margin: 0;
  font-size: 0.9rem;
}

.actions {
  margin: 1.5rem 0;
}

.btn-pull {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  border: 1px solid #38bdf8;
  background: rgba(56, 189, 248, 0.2);
  color: #e5e7eb;
  cursor: pointer;
  font-size: 1rem;
}

.btn-pull:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .gacha {
    padding: 0 0.5rem;
  }
  .card {
    padding: 1rem;
    max-width: 100%;
  }
  .wallet {
    flex-wrap: wrap;
    gap: 0.75rem;
  }
}

.status,
.error {
  margin-top: 1rem;
}

.error {
  color: #fca5a5;
}

.result {
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.5rem;
}

.result-unit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.result-unit.common { border-left: 4px solid #9ca3af; }
.result-unit.rare { border-left: 4px solid #60a5fa; }
.result-unit.epic { border-left: 4px solid #a78bfa; }
.result-unit.legendary { border-left: 4px solid #fbbf24; }

.wallet-after {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #94a3b8;
}
</style>
