/**
 * Filesystem inspection for the `dbx_model_test_*` cluster.
 *
 * Reads a single `.spec.ts` file from disk and feeds its text through the
 * pure {@link extractSpecTreeFromText} parser. When `apiDir` is supplied,
 * the helper also reads the app's `src/test/fixture.ts` via
 * `inspectAppFixtures()` so the parser can use the authoritative workspace
 * prefix and the full set of `<prefix><Model>Context` function names.
 *
 * Centralising disk I/O here keeps the extractor and search modules pure;
 * specs build trees from inline text without touching the filesystem.
 */

import { readFile } from 'node:fs/promises';
import { inspectAppFixtures } from '../model-fixture-shared/index.js';
import { extractSpecTreeFromText } from './extract.js';
import type { SpecFileTree } from './types.js';

/**
 * Reads `<specAbs>` and returns the parsed tree. When `apiDir` is supplied,
 * the helper additionally inspects `<apiAbs>/src/test/fixture.ts` so the
 * parser can use the authoritative workspace prefix and the full set of
 * fixture-context names.
 *
 * @param config - inspection inputs
 * @param config.specAbs - absolute path to the `.spec.ts` file
 * @param config.specRel - caller-relative path metadata
 * @param config.apiAbs - optional absolute path to the API app root
 * @param config.apiRel - optional caller-relative path metadata for the app
 * @returns the parsed tree
 */
export async function inspectSpecFile(config: { readonly specAbs: string; readonly specRel: string; readonly apiAbs?: string; readonly apiRel?: string }): Promise<SpecFileTree> {
  const { specAbs, specRel, apiAbs, apiRel } = config;
  const text = await readFile(specAbs, 'utf8');
  let prefix: string | undefined;
  let knownFixtureNames: readonly string[] | undefined;
  if (apiAbs !== undefined && apiRel !== undefined) {
    try {
      const fixtures = await inspectAppFixtures(apiAbs, apiRel);
      prefix = fixtures.prefix;
      const lowerPrefix = prefix !== undefined ? prefix.charAt(0).toLowerCase() + prefix.slice(1) : '';
      knownFixtureNames = fixtures.entries.map((entry) => `${lowerPrefix}${entry.model}Context`);
    } catch {
      // Fall through to import-based detection — apiDir is optional.
    }
  }
  const tree = extractSpecTreeFromText({ text, specPath: specRel, prefix, knownFixtureNames });
  return tree;
}
