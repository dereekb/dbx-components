/**
 * Checks process.env.NODE_ENV for "test"
 */
export function isTestNodeEnv(): boolean {
  return process.env['NODE_ENV'] === 'test';
}
