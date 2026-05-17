/**
 * Filesystem inspection for `dbx_color_template_list_app`.
 *
 * Reads the Angular app's root config file plus the common fallbacks so
 * the extractor can locate `provideDbxStyleService(...)`. Only the files
 * that exist are returned; missing files are reported back to the caller
 * via the `presentFiles` summary.
 */

import { readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/**
 * One inspected source file.
 */
export interface ColorTemplateInspectedFile {
  readonly relPath: string;
  readonly text: string;
}

/**
 * Result of inspecting an Angular app for color-template wiring.
 */
export interface ColorTemplateInspection {
  /**
   * Caller-supplied (relative) path to the Angular app root.
   */
  readonly apiDir: string;
  /**
   * Whether the app directory exists.
   */
  readonly appExists: boolean;
  /**
   * Every candidate source file found beneath the app's `src/`.
   * Empty when the app directory is missing.
   */
  readonly files: readonly ColorTemplateInspectedFile[];
}

const CANDIDATE_RELPATHS: readonly string[] = ['src/root.app.config.ts', 'src/app.config.ts', 'src/app.module.ts', 'src/app/app.config.ts', 'src/app/app.module.ts'];

/**
 * Reads every candidate root-config file beneath an Angular app. Returns
 * only the files that exist so the extractor never has to branch on
 * missing-file errors. Falls back to scanning `src/**\/*.providers.ts`
 * when none of the well-known names match.
 *
 * @param apiAbs - Absolute path to the Angular app root.
 * @param apiRel - Caller-supplied relative path used in the returned report.
 * @returns The inspection result the extractor consumes.
 */
export async function inspectColorTemplates(apiAbs: string, apiRel: string): Promise<ColorTemplateInspection> {
  const present: ColorTemplateInspectedFile[] = [];
  let appExists = true;
  try {
    const candidates = await collectCandidatePaths(apiAbs);
    for (const candidate of candidates) {
      const text = await readFileIfExists(candidate);
      if (text === undefined) continue;
      const rel = relative(apiAbs, candidate).split(sep).join('/');
      present.push({ relPath: rel, text });
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      appExists = false;
    } else {
      throw err;
    }
  }
  const result: ColorTemplateInspection = { apiDir: apiRel, appExists, files: present };
  return result;
}

async function collectCandidatePaths(apiAbs: string): Promise<readonly string[]> {
  const explicit: string[] = [];
  for (const rel of CANDIDATE_RELPATHS) {
    explicit.push(join(apiAbs, rel));
  }
  const scanned = await scanProviderFiles(join(apiAbs, 'src'));
  return [...explicit, ...scanned];
}

async function scanProviderFiles(srcAbs: string): Promise<readonly string[]> {
  const { readdir } = await import('node:fs/promises');
  const out: string[] = [];
  const stack: string[] = [srcAbs];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.providers.ts')) {
        out.push(full);
      }
    }
  }
  return out;
}

async function readFileIfExists(absPath: string): Promise<string | undefined> {
  try {
    return await readFile(absPath, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR') {
      return undefined;
    }
    throw err;
  }
}
