/**
 * Filesystem inspection for the `dbx_model_fixture_*` cluster.
 *
 * Reads `<apiDir>/src/test/fixture.ts` from disk and feeds the text through
 * `extractAppFixtures()`. Centralising the I/O keeps the pure layers free of
 * file-system concerns; specs build extractions directly without touching
 * the disk.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppFixturesExtraction } from './types.js';
import { extractAppFixturesFromText } from './extract.js';

/**
 * Conventional location of the test fixture file inside an API app.
 */
export const FIXTURE_RELATIVE_PATH = 'src/test/fixture.ts';

/**
 * Reads `<apiDir>/src/test/fixture.ts` and returns the parsed extraction.
 *
 * @param apiAbs - absolute path to the API app root
 * @param apiRel - caller-supplied relative path (used for messages and
 *   path metadata; unused for I/O)
 * @returns the parsed extraction
 */
export async function inspectAppFixtures(apiAbs: string, apiRel: string): Promise<AppFixturesExtraction> {
  const absolutePath = join(apiAbs, FIXTURE_RELATIVE_PATH);
  const relativePath = `${apiRel}/${FIXTURE_RELATIVE_PATH}`;
  const text = await readFile(absolutePath, 'utf8');
  return extractAppFixturesFromText({ text, fixturePath: relativePath });
}
