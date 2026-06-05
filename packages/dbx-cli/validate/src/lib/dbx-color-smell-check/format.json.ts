import type { ColorSmellCheckResult } from './types.js';

/**
 * Serialises the smell-check result as pretty-printed JSON for callers
 * that want machine-readable output.
 *
 * @param result - The smell-check output to serialise.
 * @returns The JSON body.
 */
export function formatResultAsJson(result: ColorSmellCheckResult): string {
  return JSON.stringify(result, null, 2);
}
