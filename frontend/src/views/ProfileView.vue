<template>
  <section class="profile-page">
    <div class="profile-card nx-panel">
      <h2 class="nx-title">Mon profil</h2>

      <!-- Section 1 — Avatar -->
      <div class="profile-section">
        <h3 class="section-title">Avatar</h3>
        <div class="avatar-block">
          <div class="avatar-wrap">
            <img :src="avatarDisplay" alt="Avatar" class="profile-avatar" />
            <div v-if="avatarLoading" class="avatar-spinner" aria-hidden="true" />
          </div>
          <div class="avatar-actions">
            <input
              ref="fileInput"
              type="file"
              accept="image/png, image/jpeg, image/jpg"
              class="input-file"
              @change="onFileSelect"
            />
            <button type="button" class="nx-btn nx-btn-small" @click="triggerFileInput" :disabled="avatarLoading">
              Changer avatar
            </button>
            <button
              v-if="user?.avatar_url"
              type="button"
              class="nx-btn nx-btn-small btn-remove-avatar"
              @click="removeAvatar"
              :disabled="avatarLoading"
            >
              Supprimer avatar
            </button>
          </div>
          <p v-if="avatarError" class="error">{{ avatarError }}</p>
          <p v-if="avatarSuccess" class="success">{{ avatarSuccess }}</p>
        </div>
      </div>

      <!-- Section 2 — Informations -->
      <div class="profile-section">
        <h3 class="section-title">Informations</h3>
        <label>
          Nom (affiché)
          <input v-model="displayName" type="text" maxlength="64" placeholder="Ton pseudo" />
        </label>
        <button type="button" class="nx-btn" @click="updateProfile" :disabled="profileLoading">
          Mettre à jour le profil
        </button>
        <p v-if="profileMessage" :class="profileSuccess ? 'success' : 'error'">{{ profileMessage }}</p>
      </div>

      <!-- Section 3 — Mot de passe -->
      <div class="profile-section">
        <h3 class="section-title">Mot de passe</h3>
        <label>
          Nouveau mot de passe
          <input v-model="newPassword" type="password" placeholder="Min. 8 caractères" />
        </label>
        <label>
          Confirmation
          <input v-model="confirmPassword" type="password" placeholder="Confirmer le mot de passe" />
        </label>
        <button type="button" class="nx-btn" @click="updatePassword" :disabled="passwordLoading">
          Changer le mot de passe
        </button>
        <p v-if="passwordMessage" :class="passwordSuccess ? 'success' : 'error'">{{ passwordMessage }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import api from '../api';
import { getAvatarUrl } from '@/utils/avatar';

const user = ref<{ id: number; email: string; display_name: string; avatar_url?: string | null } | null>(null);
const displayName = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const avatarPreview = ref<string | null>(null);
const avatarLoading = ref(false);
const avatarError = ref('');
const avatarSuccess = ref('');
const profileLoading = ref(false);
const profileMessage = ref('');
const profileSuccess = ref(false);
const newPassword = ref('');
const confirmPassword = ref('');
const passwordLoading = ref(false);
const passwordMessage = ref('');
const passwordSuccess = ref(false);

const avatarDisplay = computed(() => {
  if (avatarPreview.value) return avatarPreview.value;
  return getAvatarUrl(user.value);
});

onMounted(async () => {
  try {
    const { data } = await api.get('/auth/me');
    user.value = data.user;
    displayName.value = data.user?.display_name ?? '';
  } catch {
    user.value = null;
  }
});

function triggerFileInput() {
  fileInput.value?.click();
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  avatarError.value = '';
  avatarSuccess.value = '';
  if (avatarPreview.value) {
    URL.revokeObjectURL(avatarPreview.value);
    avatarPreview.value = null;
  }
  if (!file) return;
  const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!allowed.includes(file.type)) {
    avatarError.value = 'Format accepté : PNG ou JPEG uniquement.';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    avatarError.value = 'Taille max. 2 Mo.';
    return;
  }
  avatarPreview.value = URL.createObjectURL(file);
  uploadAvatar(file);
  input.value = '';
}

onUnmounted(() => {
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value);
});

async function uploadAvatar(file: File) {
  avatarError.value = '';
  avatarSuccess.value = '';
  avatarLoading.value = true;
  const form = new FormData();
  form.append('avatar', file);
  try {
    const { data } = await api.post('/profile/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    avatarSuccess.value = 'Avatar mis à jour.';
    if (data.avatar_url !== undefined) {
      if (!user.value) user.value = { id: 0, email: '', display_name: '' };
      user.value.avatar_url = data.avatar_url;
    }
    if (avatarPreview.value) {
      URL.revokeObjectURL(avatarPreview.value);
      avatarPreview.value = null;
    }
    window.dispatchEvent(new CustomEvent('profile-updated'));
  } catch (err: any) {
    avatarError.value = err.response?.data?.message || err.response?.data?.error || 'Erreur lors de l’upload.';
  } finally {
    avatarLoading.value = false;
  }
}

async function removeAvatar() {
  avatarError.value = '';
  avatarSuccess.value = '';
  avatarLoading.value = true;
  try {
    await api.delete('/profile/avatar');
    avatarSuccess.value = 'Avatar supprimé.';
    if (user.value) user.value.avatar_url = null;
    if (avatarPreview.value) {
      URL.revokeObjectURL(avatarPreview.value);
      avatarPreview.value = null;
    }
    window.dispatchEvent(new CustomEvent('profile-updated'));
  } catch (err: any) {
    avatarError.value = err.response?.data?.message || err.response?.data?.error || 'Erreur.';
  } finally {
    avatarLoading.value = false;
  }
}

async function updateProfile() {
  profileMessage.value = '';
  profileLoading.value = true;
  try {
    await api.put('/profile', { display_name: displayName.value.trim() });
    profileSuccess.value = true;
    profileMessage.value = 'Profil mis à jour.';
    if (user.value) user.value.display_name = displayName.value.trim();
    window.dispatchEvent(new CustomEvent('profile-updated'));
  } catch (err: any) {
    profileSuccess.value = false;
    profileMessage.value = err.response?.data?.message || err.response?.data?.error || 'Erreur.';
  } finally {
    profileLoading.value = false;
  }
}

async function updatePassword() {
  passwordMessage.value = '';
  if (newPassword.value.length < 8) {
    passwordMessage.value = 'Le mot de passe doit faire au moins 8 caractères.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordMessage.value = 'Les deux champs doivent être identiques.';
    return;
  }
  passwordLoading.value = true;
  try {
    await api.put('/profile', { password: newPassword.value });
    passwordSuccess.value = true;
    passwordMessage.value = 'Mot de passe modifié.';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (err: any) {
    passwordSuccess.value = false;
    passwordMessage.value = err.response?.data?.message || err.response?.data?.error || 'Erreur.';
  } finally {
    passwordLoading.value = false;
  }
}
</script>

<style scoped>
.profile-page {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 60vh;
  padding: 1rem 0;
}

.profile-card {
  width: 100%;
  max-width: 420px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #e5e7eb;
  margin: 0 0 0.75rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.3);
}

.profile-section label {
  display: block;
  margin-bottom: 0.75rem;
}
.profile-section label input {
  width: 100%;
  margin-top: 0.35rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.8);
  color: #f9fafb;
}

.avatar-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.avatar-wrap {
  position: relative;
}
.avatar-spinner {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid rgba(0, 255, 255, 0.3);
  border-top-color: #00ffff;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-remove-avatar {
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.4);
}
.btn-remove-avatar:hover {
  background: rgba(248, 113, 113, 0.1);
}

.profile-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.4);
}

.avatar-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.input-file {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.error {
  color: #fca5a5;
  font-size: 0.9rem;
  margin: 0;
}
.success {
  color: #86efac;
  font-size: 0.9rem;
  margin: 0;
}
</style>
