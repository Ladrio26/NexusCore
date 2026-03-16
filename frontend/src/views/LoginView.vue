<template>
  <section class="auth">
    <div class="auth-card nx-panel">
      <h2 class="nx-title">Connexion</h2>
      <form @submit.prevent="onSubmit">
        <label>
          Pseudo
          <input v-model="pseudo" type="text" required maxlength="64" placeholder="Ton pseudo" />
        </label>
        <label>
          Mot de passe
          <input v-model="password" type="password" required />
        </label>
        <div class="actions">
          <button type="submit" class="nx-btn" :disabled="loading">Se connecter</button>
          <router-link to="/register" class="btn secondary">Créer un compte</router-link>
        </div>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import api, { setToken } from '../api';

const router = useRouter();
const pseudo = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

async function onSubmit() {
  error.value = '';
  loading.value = true;
  try {
    const { data } = await api.post('/auth/login', { pseudo: pseudo.value.trim(), password: password.value });
    setToken(data.token);
    await router.replace('/collection');
  } catch (err: any) {
    const msg = err.response?.data?.error === 'INVALID_CREDENTIALS'
      ? 'Pseudo ou mot de passe incorrect.'
      : err.response?.data?.message || 'Erreur de connexion.';
    error.value = msg;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  background-image: url('/images/NexusLogin.png');
  background-position: center center;
  background-repeat: no-repeat;
  background-size: cover;
}

.auth-card {
  background: rgba(15, 23, 42, 0.95);
  border-radius: 1rem;
  padding: 2rem;
  width: 360px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.4);
  margin-top: 10vh;
}

h2 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  text-align: center;
}

form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

label {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  gap: 0.25rem;
}

input {
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.6);
  background: rgba(15, 23, 42, 0.7);
  color: #e5e7eb;
}

.actions {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

button {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(to right, #38bdf8, #6366f1);
  color: white;
  font-weight: 600;
}

.error {
  color: #f97373;
  font-size: 0.9rem;
  margin: 0;
}

@media (max-width: 768px) {
  .auth-card {
    width: 100%;
    max-width: 90%;
    padding: 1.5rem;
    margin: 0;
  }
}

button:disabled {
  opacity: 0.7;
}

.btn.secondary {
  flex: 1;
  text-align: center;
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.6);
  background: transparent;
  color: #e5e7eb;
  text-decoration: none;
  font-size: 0.9rem;
}
</style>

