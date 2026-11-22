/**
 * Return `value` if it is a same-site relative path ("/jokes?x=1"), else "/".
 * Rejects absolute URLs, protocol-relative "//host" and "/\host" (browsers
 * treat a backslash like a slash), so sign-in can't become an open redirect.
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  // Control characters (tabs, newlines) are stripped by URL parsers and can
  // turn "/\t/evil.com" into "//evil.com".
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}

/**
 * Turn Auth.js's callback URL (usually absolute, already restricted to our
 * origin by Auth.js) into a same-site path, or null if it isn't usable.
 */
export function callbackUrlToPath(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  // Cookie values may arrive still percent-encoded ("http%3A%2F%2F...").
  if (/^https?%3A/i.test(value)) {
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  if (typeof value !== "string") return null;
  if (value.startsWith("/")) {
    const path = safeRedirectPath(value, "");
    return path === "" ? null : path;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Keep only the path: never send the visitor to another origin.
    const path = safeRedirectPath(url.pathname + url.search + url.hash, "");
    return path === "" ? null : path;
  } catch {
    return null;
  }
}

/** Query parameter the header reads to show "Sign-in didn't finish." */
export const SIGNIN_FAILED_PARAM = "signin";
export const SIGNIN_FAILED_VALUE = "failed";

/**
 * Add `signin=failed` to a same-site path, keeping its other query params
 * and hash: "/jokes?x=1" -> "/jokes?x=1&signin=failed".
 */
export function withSignInFailed(path: string): string {
  const safe = safeRedirectPath(path);
  // A dummy origin lets URL parse the path; only the path part is used.
  const url = new URL(safe, "http://localhost");
  url.searchParams.set(SIGNIN_FAILED_PARAM, SIGNIN_FAILED_VALUE);
  return url.pathname + url.search + url.hash;
}

/** Cookies where Auth.js keeps the page a sign-in started from. */
export const CALLBACK_URL_COOKIES = [
  "__Secure-authjs.callback-url",
  "authjs.callback-url",
] as const;

/**
 * Where a failed or cancelled sign-in should land: the page it started from
 * (from `callbackUrl` or Auth.js's callback cookie), with `signin=failed`.
 */
export function signInFailedRedirectPath(input: {
  callbackUrl: string | null;
  getCookie: (name: string) => string | undefined;
  /** Auth.js's `error` param. Without one, return without the failed flag. */
  error?: string | null;
}): string {
  const fromQuery = callbackUrlToPath(input.callbackUrl);
  const fromCookie = CALLBACK_URL_COOKIES.map((name) =>
    callbackUrlToPath(input.getCookie(name)),
  ).find((path) => path !== null);
  const path = fromQuery ?? fromCookie ?? "/";
  // Never bounce back into the auth routes themselves.
  const isAuthRoute =
    /^\/auth(\/|$|\?)/.test(path) || /^\/api\/auth(\/|$|\?)/.test(path);
  const target = isAuthRoute ? "/" : path;
  return input.error === null ? target : withSignInFailed(target);
}
