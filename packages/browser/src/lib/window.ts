// MARK: Window Location Utiltiies

/**
 * Whether or not the current host is localhost. Useful for determining local dev environments.
 */
export function isLocalhost(): boolean {
  return window.location.hostname === 'localhost';
}

export function makeWindowPath(path: string): string {
  return `${getBaseWindowUrl()}${path}`;
}

export function getBaseWindowUrl(): string {
  const port = window.location.port ? ':' + window.location.port : '';
  return `${window.location.protocol}//${window.location.hostname}${port}`;
}

export function getWindowPathNameWithQuery(): string {
  return window.location.pathname + window.location.search;
}
