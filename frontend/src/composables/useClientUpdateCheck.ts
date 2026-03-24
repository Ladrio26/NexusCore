/**
 * Détecte un nouveau déploiement du front via `build-id.json` (même origine).
 * Pas de reload automatique : bannière avec action explicite du joueur.
 *
 * Important :
 * - En `npm run dev`, les vérifs sont **désactivées** par défaut (sinon faux positifs à chaud).
 *   Pour tester en local : `.env.local` → `VITE_CLIENT_BUILD_CHECK_DEV=true` puis relancer Vite.
 * - Pour tester comme en prod : `npm run build && npm run preview`.
 * - La bannière n’apparaît que si `build-id.json` **sur le réseau** diffère de `localStorage` (nouveau déploiement).
 */
import { onMounted, onUnmounted, ref } from 'vue';

const ACK_KEY = 'nexus_client_build_ack';

function envMs(key: string, fallback: number, min: number): number {
  const raw = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

/** Défaut 5 min ; surcharge possible via `VITE_BUILD_CHECK_INTERVAL_MS` (minimum 15 s). */
const POLL_INTERVAL_MS = envMs('VITE_BUILD_CHECK_INTERVAL_MS', 5 * 60 * 1000, 15_000);

/** En dev, activer avec `VITE_CLIENT_BUILD_CHECK_DEV=true` dans `.env.local`. */
const BUILD_CHECK_IN_DEV = import.meta.env.VITE_CLIENT_BUILD_CHECK_DEV === 'true';

function isCheckEnabled(): boolean {
  if (import.meta.env.DEV && !BUILD_CHECK_IN_DEV) return false;
  return true;
}

export function useClientUpdateCheck() {
  const showUpdateBanner = ref(false);
  const pendingBuildId = ref<string | null>(null);
  let pollTimerId: ReturnType<typeof setInterval> | null = null;
  /** Évite des requêtes concurrentes (intervalle + visibility). */
  let checkInFlight = false;

  async function fetchBuildId(): Promise<string | null> {
    try {
      const base = import.meta.env.BASE_URL || '/';
      const path = base.endsWith('/') ? `${base}build-id.json` : `${base}/build-id.json`;
      // Évite un 304 / cache intermédiaire qui garderait un ancien id alors que le fichier a changé
      const url = `${path}${path.includes('?') ? '&' : '?'}_=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = (await res.json()) as { buildId?: unknown };
      return typeof data?.buildId === 'string' && data.buildId ? data.buildId : null;
    } catch {
      return null;
    }
  }

  async function runCheck() {
    if (!isCheckEnabled()) return;
    if (checkInFlight) return;
    checkInFlight = true;
    try {
      const buildId = await fetchBuildId();
      if (!buildId) return;

      const ack = localStorage.getItem(ACK_KEY);
      if (!ack) {
        localStorage.setItem(ACK_KEY, buildId);
        showUpdateBanner.value = false;
        pendingBuildId.value = null;
        return;
      }

      if (ack === buildId) {
        showUpdateBanner.value = false;
        pendingBuildId.value = null;
        return;
      }

      pendingBuildId.value = buildId;
      showUpdateBanner.value = true;
    } finally {
      checkInFlight = false;
    }
  }

  function acknowledgeAndReload() {
    const id = pendingBuildId.value;
    if (id) {
      localStorage.setItem(ACK_KEY, id);
    }
    location.reload();
  }

  function onVisibility() {
    if (document.visibilityState !== 'visible') return;
    void runCheck();
  }

  onMounted(() => {
    void runCheck();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    pollTimerId = window.setInterval(() => {
      void runCheck();
    }, POLL_INTERVAL_MS);
  });

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onVisibility);
    if (pollTimerId != null) {
      window.clearInterval(pollTimerId);
      pollTimerId = null;
    }
  });

  return {
    showUpdateBanner,
    acknowledgeAndReload
  };
}
