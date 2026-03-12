/**
 * Avatar par défaut (fallback). Ne jamais supposer que avatar_url existe.
 */
import defaultAvatar from '@/assets/avatars/default-avatar.svg';

export { defaultAvatar };

export type UserWithAvatar = { avatar_url?: string | null } | null | undefined;

/** Détecte une URL d’avatar uploadé (servie par le backend). */
function isUploadedAvatarUrl(url: string): boolean {
  return url.startsWith('/uploads/avatars/') && url.length > 16;
}

/**
 * Retourne l'URL de l'avatar utilisateur ou l'avatar par défaut.
 * Les avatars uploadés sont préfixés par /api pour passer par le même proxy que l’API.
 */
export function getAvatarUrl(user: UserWithAvatar): string {
  if (!user || !user.avatar_url) return defaultAvatar;
  const url = user.avatar_url.trim();
  if (!url) return defaultAvatar;
  const path = url.startsWith('/') ? url : `/${url}`;
  if (isUploadedAvatarUrl(path)) return '/api' + path;
  return path;
}
