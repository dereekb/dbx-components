/**
 * Runtime reader for the bundled template archive.
 *
 * The published package ships a `templates.zip` (built by
 * `tools/build-templates-archive.mjs`) sitting next to the bundled CLI entry.
 * The `setup` command group reads each module's scaffold subtree out of that
 * archive. For source/dev/test runs — where no zip has been built — the reader
 * transparently falls back to walking `packages/dbx-components-cli/templates/`
 * on disk, so tests and local runs work without a build step.
 */

import AdmZip from 'adm-zip';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import { type Maybe } from '@dereekb/util';

/**
 * Read-only view over the bundled template tree. Entry paths are archive-root
 * relative and always use forward slashes (e.g. `apps/api/src/main.ts`).
 */
export interface TemplateArchive {
  /**
   * Lists every file entry whose path is at or under the given subtree prefix.
   *
   * @param prefix - Archive-root relative directory prefix (no leading slash, e.g. `components/app`).
   * @returns Sorted archive-root relative file paths under the prefix.
   */
  readonly listSubtree: (prefix: string) => readonly string[];
  /**
   * Reads a single entry's raw bytes.
   *
   * @param entryPath - Archive-root relative file path.
   * @returns The entry contents, or `undefined` when the entry is absent.
   */
  readonly readEntry: (entryPath: string) => Maybe<Buffer>;
}

/**
 * Normalizes a prefix so subtree matching is path-segment aware (a `components`
 * prefix must not match `components-extra/...`).
 *
 * @param prefix - The raw subtree prefix.
 * @returns The normalized prefix (trailing slash, or empty for the whole tree).
 */
function normalizeSubtreePrefix(prefix: string): string {
  const trimmed = prefix.replaceAll(/^\/+|\/+$/g, '');
  return trimmed.length > 0 ? `${trimmed}/` : '';
}

/**
 * Builds a {@link TemplateArchive} backed by an in-memory adm-zip instance.
 *
 * @param zip - The opened archive.
 * @returns A reader over the zip's entries.
 */
function templateArchiveFromZip(zip: AdmZip): TemplateArchive {
  const entryPaths = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .map((entry) => entry.entryName)
    .sort();

  return {
    listSubtree: (prefix) => {
      const normalized = normalizeSubtreePrefix(prefix);
      return entryPaths.filter((entryPath) => normalized === '' || entryPath.startsWith(normalized));
    },
    readEntry: (entryPath) => {
      const entry = zip.getEntry(entryPath);
      return entry ? entry.getData() : undefined;
    }
  };
}

/**
 * Recursively lists every file under `dir`, returning archive-style relative
 * paths (forward slashes), sorted.
 *
 * @param dir - Absolute directory to walk.
 * @param baseDir - Absolute root the returned paths are relative to.
 * @returns Sorted relative file paths.
 */
function listFilesRecursive(dir: string, baseDir: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(abs, baseDir));
    } else if (entry.isFile()) {
      out.push(relative(baseDir, abs).split(sep).join('/'));
    }
  }
  return out.sort();
}

/**
 * Builds a {@link TemplateArchive} that reads directly from a templates
 * directory on disk. Used as the source/dev/test fallback and by tests that
 * point at a fixture tree.
 *
 * @param templatesDir - Absolute path to the templates root directory.
 * @returns A reader over the directory's files.
 */
export function templateArchiveFromDirectory(templatesDir: string): TemplateArchive {
  const relPaths = listFilesRecursive(templatesDir, templatesDir);
  return {
    listSubtree: (prefix) => {
      const normalized = normalizeSubtreePrefix(prefix);
      return relPaths.filter((relPath) => normalized === '' || relPath.startsWith(normalized));
    },
    readEntry: (entryPath) => {
      const abs = join(templatesDir, entryPath);
      return existsSync(abs) ? readFileSync(abs) : undefined;
    }
  };
}

/**
 * Opens the template archive for the running CLI: prefers the bundled
 * `templates.zip` sitting next to the module, falling back to the on-disk
 * `templates/` directory when the zip is absent (source/dev/test runs).
 *
 * @returns The resolved {@link TemplateArchive}.
 */
export function openTemplateArchive(): TemplateArchive {
  const zipPath = fileURLToPath(new URL('./templates.zip', import.meta.url));
  let archive: TemplateArchive;
  if (existsSync(zipPath)) {
    archive = templateArchiveFromZip(new AdmZip(zipPath));
  } else {
    // Source/dev/test: archive.ts lives at src/lib/setup/, templates/ is three levels up.
    const templatesDir = fileURLToPath(new URL('../../../templates', import.meta.url));
    archive = templateArchiveFromDirectory(templatesDir);
  }
  return archive;
}
