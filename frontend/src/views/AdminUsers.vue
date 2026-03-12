<template>
  <section class="admin-users admin-fullwidth">
    <div class="admin-page-header">
      <h1 class="admin-title">Gestion des utilisateurs</h1>
      <p class="admin-desc">Voir et modifier les comptes (pseudo, email, Elo, PvP Elo, dernier adversaire, avatar).</p>
    </div>

    <div class="admin-toolbar nx-panel">
      <button type="button" class="nx-btn" :disabled="loading" @click="loadUsers">Actualiser</button>
    </div>

    <p v-if="errorMessage" class="admin-error">{{ errorMessage }}</p>
    <p v-if="statusMessage" class="admin-success">{{ statusMessage }}</p>
    <p v-if="loading && users.length === 0" class="admin-loading">Chargement…</p>

    <div v-else-if="users.length === 0" class="admin-empty">Aucun utilisateur.</div>

    <div v-else class="admin-layout-users">
      <div class="admin-table-wrap">
        <table class="admin-users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Pseudo</th>
              <th>Email</th>
              <th>Elo</th>
              <th>PvP Elo</th>
              <th>Dernière connexion</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in users"
              :key="u.id"
              :class="{ selected: selectedUser?.id === u.id }"
              @click="selectUser(u)"
            >
              <td>{{ u.id }}</td>
              <td>{{ u.display_name || '—' }}</td>
              <td class="cell-email">{{ u.email || '—' }}</td>
              <td>{{ u.elo }}</td>
              <td>{{ u.pvp_elo }}</td>
              <td class="cell-date">{{ formatDate(u.last_login_at) }}</td>
              <td>
                <button type="button" class="nx-btn nx-btn-small" @click.stop="selectUser(u)">Modifier</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="selectedUser" class="admin-detail nx-panel">
        <h2>Modifier l'utilisateur #{{ selectedUser.id }}</h2>
        <form class="admin-user-form" @submit.prevent="saveUser">
          <div class="form-row">
            <label>Pseudo</label>
            <input v-model="edit.display_name" type="text" class="nx-input full" maxlength="64" placeholder="Display name" />
          </div>
          <div class="form-row">
            <label>Email</label>
            <input v-model="edit.email" type="email" class="nx-input full" placeholder="email@example.com" />
          </div>
          <div class="form-row">
            <label>Elo (classé)</label>
            <input v-model.number="edit.elo" type="number" class="nx-input" min="0" step="1" />
          </div>
          <div class="form-row">
            <label>PvP Elo</label>
            <input v-model.number="edit.pvp_elo" type="number" class="nx-input" min="0" step="1" />
          </div>
          <div class="form-row">
            <label>Dernier adversaire (ID)</label>
            <input v-model="edit.last_opponent_id" type="text" class="nx-input" placeholder="ID ou vide" />
          </div>
          <div class="form-row">
            <label>Dernière connexion</label>
            <span class="readonly">{{ formatDate(selectedUser.last_login_at) }}</span>
          </div>
          <div class="wallet-card">
            <h3>Portefeuille</h3>
            <div class="wallet-current">
              <span>Crédits : <strong>{{ selectedUser.wallet?.credits ?? 0 }}</strong></span>
              <span>Cores : <strong>{{ selectedUser.wallet?.cores ?? 0 }}</strong></span>
              <span>Fragments : <strong>{{ selectedUser.wallet?.fragments ?? 0 }}</strong></span>
              <span>Essence : <strong>{{ selectedUser.wallet?.ascension_essence ?? 0 }}</strong></span>
              <span>Or : <strong>{{ selectedUser.wallet?.gold ?? 0 }}</strong></span>
            </div>
            <div class="wallet-adjustments">
              <div class="form-row">
                <label>Delta crédits</label>
                <input v-model.number="edit.walletCreditsDelta" type="number" class="nx-input" step="1" />
              </div>
              <div class="form-row">
                <label>Delta cores</label>
                <input v-model.number="edit.walletCoresDelta" type="number" class="nx-input" step="1" />
              </div>
              <div class="form-row">
                <label>Delta fragments</label>
                <input v-model.number="edit.walletFragmentsDelta" type="number" class="nx-input" step="1" />
              </div>
              <div class="form-row">
                <label>Delta essence</label>
                <input v-model.number="edit.walletEssenceDelta" type="number" class="nx-input" step="1" />
              </div>
              <div class="form-row">
                <label>Delta or</label>
                <input v-model.number="edit.walletGoldDelta" type="number" class="nx-input" step="1" />
              </div>
            </div>
          </div>
          <div class="wallet-card guild-wallet-card">
            <h3>Monnaie de guilde</h3>
            <div class="guild-wallet-current">
              <span>Solde actuel : <strong>{{ selectedUser.guild_coins ?? 0 }}</strong></span>
            </div>
            <div class="guild-wallet-actions">
              <div class="form-row">
                <label>Delta monnaie de guilde</label>
                <input v-model.number="edit.guildCoinsDelta" type="number" class="nx-input" step="1" />
              </div>
              <button
                type="button"
                class="nx-btn"
                :disabled="grantingGuildCoins || !hasGuildCoinsDelta"
                @click="grantGuildCoins"
              >
                {{ grantingGuildCoins ? 'Application…' : 'Ajouter / retirer' }}
              </button>
            </div>
          </div>
          <div class="form-row" v-if="selectedUser.avatar_url">
            <label>Avatar</label>
            <div class="avatar-row">
              <img :src="avatarFullUrl(selectedUser.avatar_url)" alt="" class="avatar-preview" />
              <button type="button" class="nx-btn nx-btn-small" @click="clearAvatar">Effacer l'avatar</button>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="nx-btn nx-btn-danger" :disabled="saving" @click="deleteUser">Supprimer le compte</button>
            <button type="button" class="nx-btn" @click="selectedUser = null">Fermer</button>
            <button type="submit" class="nx-btn nx-glow-blue" :disabled="saving">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import api from '../api';

type User = {
  id: number;
  email: string;
  display_name: string;
  elo: number;
  pvp_elo: number;
  avatar_url: string | null;
  last_login_at: string | null;
  last_opponent_id: number | null;
  wallet: {
    credits: number;
    cores: number;
    fragments: number;
    ascension_essence: number;
    gold: number;
  };
  guild_coins: number;
};

const users = ref<User[]>([]);
const loading = ref(false);
const errorMessage = ref('');
const statusMessage = ref('');
const selectedUser = ref<User | null>(null);
const saving = ref(false);
const grantingGuildCoins = ref(false);

const edit = ref({
  display_name: '',
  email: '',
  elo: 0,
  pvp_elo: 0,
  last_opponent_id: '' as string | number,
  walletCreditsDelta: 0,
  walletCoresDelta: 0,
  walletFragmentsDelta: 0,
  walletEssenceDelta: 0,
  walletGoldDelta: 0,
  guildCoinsDelta: 0
});

watch(selectedUser, (u) => {
  if (u) {
    edit.value = {
      display_name: u.display_name ?? '',
      email: u.email ?? '',
      elo: u.elo ?? 0,
      pvp_elo: u.pvp_elo ?? 0,
      last_opponent_id: u.last_opponent_id != null ? u.last_opponent_id : '',
      walletCreditsDelta: 0,
      walletCoresDelta: 0,
      walletFragmentsDelta: 0,
      walletEssenceDelta: 0,
      walletGoldDelta: 0,
      guildCoinsDelta: 0
    };
  }
}, { immediate: true });

const hasGuildCoinsDelta = computed(() => (Number(edit.value.guildCoinsDelta) || 0) !== 0);

function formatDate(val: string | null | undefined): string {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(val);
  }
}

function avatarFullUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return url.startsWith('/') ? url : '/' + url;
}

async function loadUsers() {
  loading.value = true;
  errorMessage.value = '';
  statusMessage.value = '';
  try {
    const { data } = await api.get<{ users: User[] }>('/admin/users');
    users.value = data.users ?? [];
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Impossible de charger les utilisateurs.';
    users.value = [];
  } finally {
    loading.value = false;
  }
}

function selectUser(u: User) {
  selectedUser.value = u;
}

async function saveUser() {
  if (!selectedUser.value) return;
  saving.value = true;
  errorMessage.value = '';
  statusMessage.value = '';
  const id = selectedUser.value.id;
  const payload: Record<string, unknown> = {
    display_name: edit.value.display_name.trim() || undefined,
    email: edit.value.email.trim().toLowerCase() || undefined,
    elo: edit.value.elo,
    pvp_elo: edit.value.pvp_elo
  };
  const walletAdjustments: Record<string, number> = {};
  if ((Number(edit.value.walletCreditsDelta) || 0) !== 0) walletAdjustments.credits = Number(edit.value.walletCreditsDelta) || 0;
  if ((Number(edit.value.walletCoresDelta) || 0) !== 0) walletAdjustments.cores = Number(edit.value.walletCoresDelta) || 0;
  if ((Number(edit.value.walletFragmentsDelta) || 0) !== 0) walletAdjustments.fragments = Number(edit.value.walletFragmentsDelta) || 0;
  if ((Number(edit.value.walletEssenceDelta) || 0) !== 0) walletAdjustments.ascension_essence = Number(edit.value.walletEssenceDelta) || 0;
  if ((Number(edit.value.walletGoldDelta) || 0) !== 0) walletAdjustments.gold = Number(edit.value.walletGoldDelta) || 0;
  if (Object.keys(walletAdjustments).length > 0) {
    payload.wallet_adjustments = walletAdjustments;
  }
  const oppId = edit.value.last_opponent_id;
  if (oppId === '' || oppId === null) {
    payload.last_opponent_id = null;
  } else {
    const n = Number(oppId);
    if (Number.isInteger(n) && n >= 0) payload.last_opponent_id = n;
  }
  try {
    const { data } = await api.patch<User>(`/admin/users/${id}`, payload);
    const idx = users.value.findIndex((u) => u.id === id);
    if (idx >= 0 && data) users.value[idx] = data;
    selectedUser.value = data;
    statusMessage.value = 'Utilisateur mis à jour.';
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || err.response?.data?.error || 'Erreur lors de l\'enregistrement.';
  } finally {
    saving.value = false;
  }
}

async function deleteUser() {
  if (!selectedUser.value) return;
  const confirmed = window.confirm(`Supprimer définitivement le compte "${selectedUser.value.display_name || selectedUser.value.email}" ?`);
  if (!confirmed) return;
  saving.value = true;
  errorMessage.value = '';
  statusMessage.value = '';
  try {
    await api.delete(`/admin/users/${selectedUser.value.id}`);
    users.value = users.value.filter((u) => u.id !== selectedUser.value!.id);
    selectedUser.value = null;
    statusMessage.value = 'Compte supprimé.';
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || err.response?.data?.error || 'Erreur lors de la suppression.';
  } finally {
    saving.value = false;
  }
}

async function clearAvatar() {
  if (!selectedUser.value) return;
  saving.value = true;
  errorMessage.value = '';
  statusMessage.value = '';
  try {
    const { data } = await api.patch<User>(`/admin/users/${selectedUser.value.id}`, { avatar_url: null });
    const idx = users.value.findIndex((u) => u.id === selectedUser.value!.id);
    if (idx >= 0 && data) users.value[idx] = data;
    selectedUser.value = data;
    statusMessage.value = 'Avatar effacé.';
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Erreur.';
  } finally {
    saving.value = false;
  }
}

async function grantGuildCoins() {
  if (!selectedUser.value) return;
  const amount = Math.trunc(Number(edit.value.guildCoinsDelta) || 0);
  if (amount === 0) return;
  grantingGuildCoins.value = true;
  errorMessage.value = '';
  statusMessage.value = '';
  try {
    const { data } = await api.post<{ guild_coins: number; message?: string }>('/guild/dev/grant-coins', {
      user_id: selectedUser.value.id,
      amount
    });
    const nextGuildCoins = Number(data.guild_coins ?? 0);
    const updatedUser = {
      ...selectedUser.value,
      guild_coins: nextGuildCoins
    };
    const idx = users.value.findIndex((u) => u.id === selectedUser.value!.id);
    if (idx >= 0) {
      users.value[idx] = updatedUser;
    }
    selectedUser.value = updatedUser;
    edit.value.guildCoinsDelta = 0;
    statusMessage.value = data.message || 'Monnaie de guilde mise à jour.';
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || err.response?.data?.error || 'Erreur lors de la mise à jour de la monnaie de guilde.';
  } finally {
    grantingGuildCoins.value = false;
  }
}

loadUsers();
</script>

<style scoped>
.admin-users {
  padding: 24px 32px;
  max-width: 1400px;
  margin: 0 auto;
}

.admin-page-header {
  margin-bottom: 24px;
}

.admin-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #f8fafc;
  margin: 0 0 8px 0;
}

.admin-desc {
  font-size: 0.95rem;
  color: rgba(226, 232, 240, 0.85);
  margin: 0;
}

.admin-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.admin-error {
  color: #fca5a5;
  margin: 0 0 16px 0;
}

.admin-success {
  color: #86efac;
  margin: 0 0 16px 0;
}

.admin-loading,
.admin-empty {
  color: rgba(226, 232, 240, 0.8);
  margin: 16px 0;
}

.admin-layout-users {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.admin-table-wrap {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}

.admin-users-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  overflow: hidden;
}

.admin-users-table th,
.admin-users-table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.admin-users-table th {
  background: rgba(30, 41, 59, 0.8);
  color: #94a3b8;
  font-weight: 600;
  font-size: 0.85rem;
}

.admin-users-table tbody tr {
  cursor: pointer;
}

.admin-users-table tbody tr:hover {
  background: rgba(51, 65, 85, 0.4);
}

.admin-users-table tbody tr.selected {
  background: rgba(59, 130, 246, 0.2);
}

.cell-email {
  font-size: 0.9rem;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-date {
  font-size: 0.85rem;
  color: rgba(148, 163, 184, 0.9);
}

.admin-detail {
  width: 380px;
  flex-shrink: 0;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.admin-detail h2 {
  margin: 0 0 20px 0;
  font-size: 1.15rem;
  color: #e2e8f0;
}

.wallet-card {
  margin-bottom: 16px;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.35);
}

.wallet-card h3 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  color: #e2e8f0;
}

.wallet-current {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  margin-bottom: 16px;
  color: rgba(226, 232, 240, 0.92);
}

.wallet-adjustments {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}

.guild-wallet-current {
  margin-bottom: 16px;
  color: rgba(226, 232, 240, 0.92);
}

.guild-wallet-actions {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  justify-content: space-between;
}

.admin-user-form .form-row {
  margin-bottom: 16px;
}

.admin-user-form label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.9rem;
  color: rgba(148, 163, 184, 0.95);
}

.admin-user-form .nx-input {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.8);
  color: #e2e8f0;
  font-size: 0.95rem;
}

.admin-user-form .nx-input.full {
  width: 100%;
  box-sizing: border-box;
}

.admin-user-form .nx-input[type="number"] {
  width: 100px;
}

.admin-user-form .readonly {
  font-size: 0.9rem;
  color: rgba(148, 163, 184, 0.8);
}

.avatar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-preview {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(30, 41, 59, 0.8);
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

@media (max-width: 900px) {
  .admin-layout-users {
    flex-direction: column;
  }
  .admin-detail {
    width: 100%;
  }
}
</style>
