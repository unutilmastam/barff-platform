import { type CookieOptions, type Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'barff_access_token';
export const REFRESH_TOKEN_COOKIE = 'barff_refresh_token';

/**
 * Cookie settings for browser clients (`CLAUDE.md` §12).
 *
 * - `httpOnly` — JavaScript cannot read the token, so an XSS bug cannot steal
 *   a long-lived session.
 * - `sameSite: 'lax'` — the apps are on sibling subdomains of barff.uz and use
 *   a shared cookie domain, so cross-site POSTs are the CSRF risk to close.
 *   `strict` would break returning to the dealer portal from an external link.
 * - `secure` — configured, and forced true in production by the env schema.
 *
 * The refresh cookie is scoped to the refresh endpoint: it is the
 * account-takeover credential, so it should not ride along on every request to
 * every route.
 */
function baseOptions(config: { domain: string | undefined; secure: boolean }): CookieOptions {
  return {
    httpOnly: true,
    secure: config.secure,
    sameSite: 'lax',
    ...(config.domain === undefined ? {} : { domain: config.domain }),
  };
}

export function setAuthCookies(
  response: Response,
  tokens: { accessToken: string; refreshToken: string },
  ttl: { accessSeconds: number; refreshSeconds: number },
  config: { domain: string | undefined; secure: boolean },
  refreshPath: string,
): void {
  const options = baseOptions(config);

  response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...options,
    path: '/',
    maxAge: ttl.accessSeconds * 1000,
  });

  response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...options,
    path: refreshPath,
    maxAge: ttl.refreshSeconds * 1000,
  });
}

/**
 * Clears both cookies.
 *
 * The options must match those used to set them — a differing path or domain
 * silently leaves the original cookie in place, and the user stays logged in
 * after asking to log out.
 */
export function clearAuthCookies(
  response: Response,
  config: { domain: string | undefined; secure: boolean },
  refreshPath: string,
): void {
  const options = baseOptions(config);
  response.clearCookie(ACCESS_TOKEN_COOKIE, { ...options, path: '/' });
  response.clearCookie(REFRESH_TOKEN_COOKIE, { ...options, path: refreshPath });
}
