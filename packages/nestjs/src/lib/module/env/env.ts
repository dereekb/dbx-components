/**
 * Checks process.env.NODE_ENV for "test".
 *
 * @returns true if the current Node environment is "test", false otherwise
 */
export function isTestNodeEnv(): boolean {
  return process.env['NODE_ENV'] === 'test';
}
