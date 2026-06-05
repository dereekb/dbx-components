/**
 * Spec-file discovery for the `dbx_model_test_list_app` tool.
 *
 * Walks `<apiDir>/src/app/function/` and returns every `*.spec.ts` file
 * grouped by its parent folder, with each file pre-classified via
 * {@link classifySpecFile} so the wrapper can render listings and drift
 * reports without re-parsing filenames.
 *
 * The walker is shallow (one level deep — exactly the model-group folders),
 * matching the convention used across hellosubs / demo-api. Files nested
 * deeper are still picked up but reported under their immediate parent
 * folder so the classifier's group-vs-folder check stays meaningful.
 */

import { readdir, stat } from 'node:fs/promises';
import { type Dirent } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { classifySpecFile, type SpecFileClassification } from '@dereekb/util';

/**
 * Conventional subdirectory under an API app that houses model-group tests.
 */
export const FUNCTION_DIR_REL = 'src/app/function';

/**
 * One discovered model group with its spec files (classified).
 */
export interface DiscoveredSpecGroup {
  readonly group: string;
  /**
   * Caller-relative path to the group folder (e.g.
   * `apps/hellosubs-api/src/app/function/job`).
   */
  readonly folderRel: string;
  readonly files: readonly DiscoveredSpecFile[];
}

/**
 * One discovered spec file with its classification + caller-relative path.
 */
export interface DiscoveredSpecFile {
  readonly filename: string;
  /**
   * Caller-relative path to the file (e.g.
   * `apps/hellosubs-api/src/app/function/job/job.crud.spec.ts`).
   */
  readonly fileRel: string;
  readonly classification: SpecFileClassification;
}

/**
 * Aggregate result of {@link discoverSpecFilesByGroup}.
 */
export interface DiscoveredSpecCatalog {
  /**
   * Caller-relative path to the API app (echoed for the formatter).
   */
  readonly apiRel: string;
  /**
   * Caller-relative path to the function-tests root (e.g.
   * `apps/hellosubs-api/src/app/function`).
   */
  readonly functionDirRel: string;
  readonly groups: readonly DiscoveredSpecGroup[];
  /**
   * Total `.spec.ts` files discovered across all groups (canonical + drift).
   */
  readonly totalSpecFiles: number;
  /**
   * Total drift entries — i.e. classifications with `isCanonical === false`
   * that are not `non-spec` / `non-group`.
   */
  readonly totalDriftFiles: number;
}

/**
 * Walks `<apiAbs>/src/app/function/` and returns the grouped, classified
 * catalog. Folders with no `.spec.ts` files are omitted. Files in the
 * function root that don't live under a group folder are also omitted (the
 * convention is one group folder per top-level entry).
 *
 * @param config - Inputs.
 * @param config.apiAbs - Absolute path to the API app root.
 * @param config.apiRel - Caller-relative API-app path (used for output paths).
 * @returns The discovered catalog.
 */
export async function discoverSpecFilesByGroup(config: { readonly apiAbs: string; readonly apiRel: string }): Promise<DiscoveredSpecCatalog> {
  const { apiAbs, apiRel } = config;
  const functionDirAbs = join(apiAbs, FUNCTION_DIR_REL);
  const functionDirRel = toPosix(`${apiRel}/${FUNCTION_DIR_REL}`);
  const exists = await directoryExists(functionDirAbs);
  const groups: DiscoveredSpecGroup[] = [];
  let totalSpecFiles = 0;
  let totalDriftFiles = 0;
  if (exists) {
    const entries = await readDirSafe(functionDirAbs);
    const groupFolders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const folderName of groupFolders) {
      const groupAbs = join(functionDirAbs, folderName);
      const folderRel = toPosix(`${functionDirRel}/${folderName}`);
      const specFiles = await collectSpecFiles({ folderAbs: groupAbs, folderRel, parentFolderName: folderName, apiAbs, apiRel });
      if (specFiles.length === 0) {
        continue;
      }
      groups.push({ group: folderName, folderRel, files: specFiles });
      totalSpecFiles += specFiles.length;
      totalDriftFiles += specFiles.filter((f) => !f.classification.isCanonical && f.classification.kind !== 'non-spec' && f.classification.kind !== 'non-group').length;
    }
  }
  return {
    apiRel,
    functionDirRel,
    groups,
    totalSpecFiles,
    totalDriftFiles
  };
}

async function collectSpecFiles(config: { readonly folderAbs: string; readonly folderRel: string; readonly parentFolderName: string; readonly apiAbs: string; readonly apiRel: string }): Promise<readonly DiscoveredSpecFile[]> {
  const { folderAbs, parentFolderName, apiAbs, apiRel } = config;
  const collected: DiscoveredSpecFile[] = [];
  const stack: { readonly dirAbs: string; readonly relativeDirName: string }[] = [{ dirAbs: folderAbs, relativeDirName: parentFolderName }];
  while (stack.length > 0) {
    const current = stack.pop() as { readonly dirAbs: string; readonly relativeDirName: string };
    const entries = await readDirSafe(current.dirAbs);
    for (const entry of entries) {
      const fullAbs = join(current.dirAbs, entry.name);
      if (entry.isDirectory()) {
        stack.push({ dirAbs: fullAbs, relativeDirName: entry.name });
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.spec.ts')) continue;
      const fileRel = toPosix(`${apiRel}/${relative(apiAbs, fullAbs)}`);
      const classification = classifySpecFile({ filename: entry.name, parentFolderName: current.relativeDirName });
      collected.push({ filename: entry.name, fileRel, classification });
    }
  }
  collected.sort((a, b) => a.fileRel.localeCompare(b.fileRel));
  return collected;
}

async function readDirSafe(path: string): Promise<readonly Dirent[]> {
  let result: readonly Dirent[];
  try {
    result = await readdir(path, { withFileTypes: true });
  } catch {
    result = [];
  }
  return result;
}

async function directoryExists(path: string): Promise<boolean> {
  let result = false;
  try {
    const stats = await stat(path);
    result = stats.isDirectory();
  } catch {
    result = false;
  }
  return result;
}

function toPosix(p: string): string {
  return p.split(sep).join('/');
}
