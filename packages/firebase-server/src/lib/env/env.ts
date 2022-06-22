/**
 * Checks process.env.NODE_ENV for "test"
 */
export function isTestNodeEnv() {
  return process.env.NODE_ENV === 'test';
}
