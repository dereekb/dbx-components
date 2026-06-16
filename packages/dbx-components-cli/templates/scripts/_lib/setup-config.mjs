// Shared helper for reading the dbx.setup.json project manifest written by setup-project.sh.
// All per-integration setup scripts (e.g. scripts/zoho/setup-zoho.mjs) read from this.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const MANIFEST_FILENAME = 'dbx.setup.json';
const SUPPORTED_SCHEMA = 1;

export function findProjectRoot(start = process.cwd()) {
  let dir = resolve(start);
  let result = null;

  while (result === null) {
    if (existsSync(join(dir, MANIFEST_FILENAME))) {
      result = dir;
    } else {
      const parent = dirname(dir);
      if (parent === dir) {
        throw new Error(`Could not find ${MANIFEST_FILENAME} in ${start} or any parent directory.`);
      }
      dir = parent;
    }
  }

  return result;
}

export async function readDbxSetup({ rootDir } = {}) {
  const projectRoot = rootDir ?? findProjectRoot();
  const manifestPath = join(projectRoot, MANIFEST_FILENAME);
  const raw = await readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (parsed.schema !== SUPPORTED_SCHEMA) {
    throw new Error(`Unsupported ${MANIFEST_FILENAME} schema: ${parsed.schema}. Supported: ${SUPPORTED_SCHEMA}.`);
  }

  return {
    ...parsed,
    projectRoot,
    appCodePrefix: derivePrefixVariants(parsed.appCodePrefix)
  };
}

export function derivePrefixVariants(camelInput) {
  if (typeof camelInput !== 'string' || camelInput.length === 0) {
    throw new Error('appCodePrefix must be a non-empty string.');
  }

  return {
    raw: camelInput,
    camel: camelInput,
    pascal: camelInput.charAt(0).toUpperCase() + camelInput.slice(1),
    lower: camelInput.toLowerCase(),
    upper: camelInput.toUpperCase()
  };
}
