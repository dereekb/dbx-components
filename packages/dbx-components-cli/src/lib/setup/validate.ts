/**
 * Structure validation: given the destination files a module is expected to
 * produce (computed from the archive subtree the same way `scaffold` computes
 * its writes), check which are present on disk. This is "validate the basic
 * structure of the app" — it does not inspect file content.
 */

import { existsSync } from 'node:fs';
import { relative } from 'node:path';

/**
 * The presence result for one module.
 */
export interface ModuleValidationResult {
  readonly moduleId: string;
  /**
   * Expected dest paths that exist, relative to the validation root.
   */
  readonly present: readonly string[];
  /**
   * Expected dest paths that are missing, relative to the validation root.
   */
  readonly missing: readonly string[];
}

/**
 * Inputs for {@link validateExpectedFiles}.
 */
export interface ValidateExpectedFilesInput {
  readonly moduleId: string;
  /**
   * Absolute destination paths the module is expected to have written.
   */
  readonly expectedFiles: readonly string[];
  /**
   * Root the reported paths are relativized against.
   */
  readonly validationRoot: string;
}

/**
 * Checks which expected destination files exist on disk.
 *
 * @param input - Module id, expected absolute paths, and the relativization root.
 * @returns The present / missing split for the module.
 */
export function validateExpectedFiles(input: ValidateExpectedFilesInput): ModuleValidationResult {
  const { moduleId, expectedFiles, validationRoot } = input;
  const present: string[] = [];
  const missing: string[] = [];
  for (const abs of expectedFiles) {
    const rel = relative(validationRoot, abs);
    if (existsSync(abs)) {
      present.push(rel);
    } else {
      missing.push(rel);
    }
  }
  return { moduleId, present: present.sort(), missing: missing.sort() };
}

/**
 * Whether any module result reports a missing file.
 *
 * @param results - Per-module validation results.
 * @returns `true` when at least one expected file is missing.
 */
export function validationHasMissing(results: readonly ModuleValidationResult[]): boolean {
  return results.some((result) => result.missing.length > 0);
}

/**
 * Renders a human-readable markdown report of the validation results.
 *
 * @param results - Per-module validation results.
 * @returns Markdown text.
 */
export function formatValidationMarkdown(results: readonly ModuleValidationResult[]): string {
  const lines: string[] = ['# dbx-components setup validation', ''];
  for (const result of results) {
    const total = result.present.length + result.missing.length;
    const status = result.missing.length === 0 ? '✅' : '❌';
    lines.push(`## ${status} ${result.moduleId} — ${result.present.length}/${total} present`);
    if (result.missing.length > 0) {
      lines.push('', 'Missing:');
      for (const missing of result.missing) {
        lines.push(`- ${missing}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
