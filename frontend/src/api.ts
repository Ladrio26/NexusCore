import { ref } from 'vue';
import axios from 'axios';
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const MAX_GET_RETRIES = 2;
const RETRY_DELAYS_MS = [400, 1000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ConfigWithRetry = InternalAxiosRequestConfig & { __retryCount?: number };

/** Retries sur GET (idempotent) quand le navigateur échoue avant réponse HTTP (QUIC, coupure, etc.). */
function shouldRetryNetworkError(err: AxiosError): boolean {
  if (err.response) return false;
  const cfg = err.config as ConfigWithRetry | undefined;
  if (!cfg) return false;
  const method = String(cfg.method || 'get').toLowerCase();
  if (method !== 'get') return false;
  const n = cfg.__retryCount ?? 0;
  if (n >= MAX_GET_RETRIES) return false;
  const code = err.code;
  const msg = String(err.message || '');
  if (code === 'ERR_CANCELED') return false;
  if (code === 'ECONNABORTED') return true;
  if (msg === 'Network Error') return true;
  if (/failed to fetch|networkerror|quic|load failed/i.test(msg)) return true;
  return false;
}

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
  async (err: AxiosError) => {
    if (err.response?.status === 401) {
      clearToken();
    }
    const cfg = err.config as ConfigWithRetry | undefined;
    if (cfg && shouldRetryNetworkError(err)) {
      const n = cfg.__retryCount ?? 0;
      cfg.__retryCount = n + 1;
      const delay = RETRY_DELAYS_MS[Math.min(n, RETRY_DELAYS_MS.length - 1)] ?? 500;
      await sleep(delay);
      return api.request(cfg) as Promise<AxiosResponse>;
    }
    return Promise.reject(err);
  }
);

export default api;
