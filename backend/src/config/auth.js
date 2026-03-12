const ROLE_PLAYER = 'player';
const ROLE_ADMIN = 'admin';

function parseNormalizedList(rawValue) {
  return new Set(
    String(rawValue || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeRole(role) {
  return String(role || '').trim().toLowerCase() === ROLE_ADMIN
    ? ROLE_ADMIN
    : ROLE_PLAYER;
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET is required');
  }
  return secret;
}

export function resolveEffectiveRole(userLike) {
  const user = userLike || {};
  const explicitRole = normalizeRole(user.role);
  if (explicitRole === ROLE_ADMIN) {
    return ROLE_ADMIN;
  }

  const adminEmails = parseNormalizedList(process.env.ADMIN_EMAILS);
  const adminDisplayNames = parseNormalizedList(process.env.ADMIN_DISPLAY_NAMES);
  const email = normalizeText(user.email);
  const displayName = normalizeText(user.display_name ?? user.displayName);

  if ((email && adminEmails.has(email)) || (displayName && adminDisplayNames.has(displayName))) {
    return ROLE_ADMIN;
  }

  return ROLE_PLAYER;
}

export function isAdminRole(role) {
  return normalizeRole(role) === ROLE_ADMIN;
}

export { ROLE_ADMIN, ROLE_PLAYER };
