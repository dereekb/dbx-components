/**
 * Shared recursive file collector used by the app-introspection extractors.
 *
 * Several `*-app` / `*-lookup` extractors need the same depth-first walk:
 * crawl a root directory for source files whose name ends with a given
 * suffix, skipping `*.spec.ts` siblings, returning absolute paths sorted
 * lexicographically. Centralizing the walk here keeps each extractor a thin
 * domain-specific wrapper instead of re-implementing the traversal.
 */

import { readdir, stat } from 'node:fs/promises';
import { type Dirent } from 'node:fs';
import { join } from 'node:path';

const SPEC_SUFFIX = '.spec.ts';

/**
 * Recursively collects absolute paths of files under `rootAbs` whose name
 * ends with `suffix` (excluding `*.spec.ts`), sorted lexicographically.
 *
 * Best-effort: a missing or unreadable root yields `[]` rather than
 * throwing, and unreadable subdirectories are skipped.
 *
 * @param rootAbs - Absolute directory to crawl.
 * @param suffix - File-name suffix to match (e.g. `.api.ts`).
 * @returns The matching absolute file paths, sorted lexicographically.
 */
export async function collectFilesWithSuffix(rootAbs: string, suffix: string): Promise<readonly string[]> {
  const out: string[] = [];
  if (await isDirectoryPath(rootAbs)) {
    const stack: string[] = [rootAbs];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      const entries = await readDirEntriesSafe(current);
      const partition = partitionDirEntries({ entries, current, suffix });
      stack.push(...partition.dirs);
      out.push(...partition.files);
    }
    out.sort((a, b) => a.localeCompare(b));
  }
  return out;
}

interface PartitionDirEntriesInput {
  readonly entries: readonly Dirent[];
  readonly current: string;
  readonly suffix: string;
}

interface DirPartition {
  readonly dirs: readonly string[];
  readonly files: readonly string[];
}

/**
 * Splits one directory's entries into subdirectories to descend into and
 * matching source files to collect.
 *
 * @param input - The directory entries, the directory's absolute path, and the suffix to match.
 * @returns The subdirectory and matching-file absolute paths.
 */
function partitionDirEntries(input: PartitionDirEntriesInput): DirPartition {
  const { entries, current, suffix } = input;
  const dirs: string[] = [];
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(current, entry.name);
    if (entry.isDirectory()) {
      dirs.push(full);
    } else if (entry.isFile() && entry.name.endsWith(suffix) && !entry.name.endsWith(SPEC_SUFFIX)) {
      files.push(full);
    }
  }
  return { dirs, files };
}

/**
 * Reports whether `path` is a directory; returns `false` for a missing or
 * unreadable path rather than throwing.
 *
 * @param path - Absolute path to test.
 * @returns `true` when `path` resolves to a directory.
 */
async function isDirectoryPath(path: string): Promise<boolean> {
  let result = false;
  try {
    const stats = await stat(path);
    result = stats.isDirectory();
  } catch {
    result = false;
  }
  return result;
}

/**
 * Reads a directory's `Dirent` entries; returns an empty list when the
 * path is unreadable.
 *
 * @param path - Absolute directory path.
 * @returns The directory entries or `[]` on failure.
 */
async function readDirEntriesSafe(path: string): Promise<readonly Dirent[]> {
  let result: readonly Dirent[];
  try {
    result = await readdir(path, { withFileTypes: true });
  } catch {
    result = [];
  }
  return result;
}
