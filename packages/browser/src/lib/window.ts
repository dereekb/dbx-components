// MARK: Window Location Utiltiies

/**
 * Whether or not the current host is localhost. Useful for determining local dev environments.
 */
export function isLocalhost(): boolean {
  return window.location.hostname === 'localhost';
}

/**
 * Constructs a full URL by combining the current window's base URL with the given relative path.
 *
 * @param path - Relative path to append to the base URL
 * @returns Full URL string
 *
 * @example
 * ```typescript
 * // On https://example.com:3000
 * const url = makeWindowPath('/api/users'); // "https://example.com:3000/api/users"
 * ```
 */
export function makeWindowPath(path: string): string {
  return `${getBaseWindowUrl()}${path}`;
}

/**
 * Returns the base URL of the current window, including protocol, hostname, and port (if present).
 *
 * @returns Base URL string without trailing slash
 *
 * @example
 * ```typescript
 * // On https://example.com:8080/some/path
 * const base = getBaseWindowUrl(); // "https://example.com:8080"
 * ```
 */
export function getBaseWindowUrl(): string {
  const port = window.location.port ? ':' + window.location.port : '';
  return `${window.location.protocol}//${window.location.hostname}${port}`;
}

/**
 * Returns the current window pathname concatenated with the query string.
 *
 * Useful for capturing the full relative URL for redirect-after-login or deep linking scenarios.
 *
 * @returns Pathname and query string (e.g. "/app/dashboard?tab=settings")
 *
 * @example
 * ```typescript
 * // On https://example.com/app/dashboard?tab=settings
 * const path = getWindowPathNameWithQuery(); // "/app/dashboard?tab=settings"
 * ```
 */
export function getWindowPathNameWithQuery(): string {
  return window.location.pathname + window.location.search;
}
