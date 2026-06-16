#!/usr/bin/env node
/**
 * Bundles `packages/dbx-components-cli/templates/**` into a single
 * `templates.zip` that ships inside the published `@dereekb/dbx-components-cli`
 * package. The `setup` command group reads its scaffold subtrees out of this zip
 * at runtime (with a filesystem fallback for source/dev/test runs).
 *
 * Pure Node + adm-zip. Walks the template tree with deterministic ordering and a
 * fixed entry timestamp so repeat builds produce byte-identical archives.
 *
 * Usage: node tools/build-templates-archive.mjs [templatesDir] [outFile]
 *   templatesDir defaults to packages/dbx-components-cli/templates
 *   outFile      defaults to dist/packages/dbx-components-cli/templates.zip
 */

import AdmZip from 'adm-zip';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';

const WORKSPACE_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const DEFAULT_TEMPLATES_DIR = join(WORKSPACE_ROOT, 'packages/dbx-components-cli/templates');
const DEFAULT_OUT_FILE = join(WORKSPACE_ROOT, 'dist/packages/dbx-components-cli/templates.zip');

// Fixed timestamp (2020-01-01T00:00:00Z) keeps the archive reproducible across builds.
const FIXED_ENTRY_TIME = new Date(Date.UTC(2020, 0, 1, 0, 0, 0));

/**
 * Recursively lists every file under `dir`, returning workspace-style relative
 * paths (forward slashes) sorted for deterministic archive ordering.
 *
 * @param {string} dir - Absolute directory to walk.
 * @param {string} baseDir - Absolute root the returned paths are relative to.
 * @returns {string[]} Sorted relative file paths.
 */
function listFilesRecursive(dir, baseDir) {
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(abs, baseDir));
    } else if (entry.isFile()) {
      out.push(relative(baseDir, abs).split(sep).join('/'));
    }
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Builds the templates archive.
 *
 * @param {string} templatesDir - Absolute templates source directory.
 * @param {string} outFile - Absolute output path for the zip.
 * @returns {number} The number of files written into the archive.
 */
function buildArchive(templatesDir, outFile) {
  const relPaths = listFilesRecursive(templatesDir, templatesDir);
  const zip = new AdmZip();
  for (const relPath of relPaths) {
    const content = readFileSync(join(templatesDir, relPath));
    zip.addFile(relPath, content);
    const added = zip.getEntry(relPath);
    if (added) {
      added.header.time = FIXED_ENTRY_TIME;
    }
  }
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, zip.toBuffer());
  return relPaths.length;
}

const templatesDir = resolve(process.cwd(), process.argv[2] ?? DEFAULT_TEMPLATES_DIR);
const outFile = resolve(process.cwd(), process.argv[3] ?? DEFAULT_OUT_FILE);

const count = buildArchive(templatesDir, outFile);
console.log(`build-templates-archive: wrote ${count} entries to ${relative(WORKSPACE_ROOT, outFile)}`);
