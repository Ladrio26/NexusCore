/**
 * Retourne l'URL absolue de l'image personnage pour une unité.
 * Convention : le fichier porte le nom du PREMIER MOT du nom d'unité (ex. "Dolo, L'Épine Absolue" → Dolo.png).
 * Ajoute un PNG dans le dossier personnages avec ce nom pour qu'il s'affiche automatiquement.
 * Chemin configurable via VITE_PERSONNAGES_BASE.
 */
function getPersonnagesBase(): string {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  const base = env?.VITE_PERSONNAGES_BASE;
  if (base && typeof base === 'string' && base.trim()) {
    return base.trim().replace(/\/$/, '');
  }
  const appBase = env?.BASE_URL;
  const prefix = appBase && typeof appBase === 'string' ? appBase.replace(/\/$/, '') : '';
  return prefix ? `${prefix}/personnages` : '/personnages';
}

function getAppBasePrefix(): string {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  const appBase = env?.BASE_URL;
  if (!appBase || typeof appBase !== 'string') return '';
  return appBase.replace(/\/$/, '');
}

/** Dérive le nom de fichier : premier mot du nom, première lettre en majuscule, reste inchangé (ex. JB → JB.png, Dolo → Dolo.png). */
function unitNameToImageFilename(name: string): string {
  const firstWord = name.split(/[\s,]+/)[0]?.trim();
  if (!firstWord) return '';
  const base = firstWord.length === 1
    ? firstWord.toUpperCase()
    : firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
  return `${base}.png`;
}

/** URL des images uploadées (servies par le backend). */
function isUploadedUnitImageUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith('/uploads/units/') && url.length > 16;
}

function isStaticUnitImageUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith('/personnages/') && url.length > 13;
}

function isAbsoluteUrl(url: string): boolean {
  return /^(https?:)?\/\//i.test(url) || /^data:/i.test(url) || /^blob:/i.test(url);
}

/**
 * Retourne l'URL d'affichage de l'image d'unité.
 * Si l'unité a une image_url (upload admin), on l'utilise (préfixée par /api en dev).
 * Sinon on dérive depuis le nom (dossier personnages).
 */
export function getUnitImageUrl(unit: { name?: string | null; image_url?: string | null } | null | undefined): string | null {
  if (!unit) return null;
  const raw = unit.image_url?.trim();
  if (raw && isAbsoluteUrl(raw)) {
    return raw;
  }

  const uploaded = raw ? raw.replace(/^\/+/, '/') : '';
  if (uploaded && (isUploadedUnitImageUrl(uploaded) || uploaded.startsWith('uploads/units/'))) {
    const normalized = uploaded.startsWith('/') ? uploaded : `/${uploaded}`;
    return `/api${normalized}`;
  }
  if (uploaded && (isStaticUnitImageUrl(uploaded) || uploaded.startsWith('personnages/'))) {
    const normalized = uploaded.startsWith('/') ? uploaded : `/${uploaded}`;
    const prefix = getAppBasePrefix();
    return prefix ? `${prefix}${normalized}` : normalized;
  }

  const name = unit.name?.trim();
  if (!name) return null;
  const filename = unitNameToImageFilename(name);
  if (!filename) return null;
  const personnagesBase = getPersonnagesBase();
  const sep = personnagesBase.startsWith('http') ? (personnagesBase.endsWith('/') ? '' : '/') : (personnagesBase.endsWith('/') ? '' : '/');
  return `${personnagesBase}${sep}${filename}`;
}
