import { ref } from 'vue';
import axios from 'axios';

const TOKEN_KEY = 'nexus_token';

/** Source réactive pour que le header (nav) se mette à jour sans recharger la page. */
export const authToken = ref<string | null>(localStorage.getItem(TOKEN_KEY));

export function getToken(): string | null {
  return authToken.value ?? localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  authToken.value = token;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  authToken.value = null;
}

/** Décode le payload JWT (sans vérification signature) pour lire les infos UI. Retourne null si invalide. */
export function getCurrentUserFromToken(): { display_name?: string; role?: string } | null {
  const token = getToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
}

export const ADMIN_ROLE = 'admin';

export function isAdminUser(): boolean {
  const user = getCurrentUserFromToken();
  return String(user?.role || '').trim().toLowerCase() === ADMIN_ROLE;
}

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data == null) {
    delete config.headers['Content-Type'];
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

/** Détecte si la réponse est une page HTML au lieu de JSON. */
function isHtmlResponse(data: unknown): boolean {
  if (typeof data !== 'string') return false;
  const t = data.trimStart();
  return t.startsWith('<!') || t.startsWith('<html') || t.includes('</html>');
}

api.interceptors.response.use(
  (r) => {
    if (isHtmlResponse(r.data)) {
      const status = r.status ?? 200;
      const isMaintenance = status === 503;
      return Promise.reject({
        response: {
          status,
          data: {
            message: isMaintenance
              ? 'Service temporairement indisponible (maintenance).'
              : 'Réponse invalide du serveur (HTML reçu au lieu de JSON). Vérifiez que l’API est bien accessible.'
          }
        }
      });
    }
    return r;
  },
  (err) => {
    if (err.response?.status === 401) {
      clearToken();
    }
    return Promise.reject(err);
  }
);

export default api;
