/**
 * Shared emission primitives for the build-time manifest generators.
 *
 * Every generator ends the same way: group the runtime imports it needs by
 * package, render a banner + module source, format it with the workspace
 * prettier config so the output matches a `prettier --write` of the committed
 * file, then skip the write when the bytes are unchanged so incremental builds
 * see a preserved mtime. That tail lives here once instead of being copied
 * into each `<generator>/src/emit.ts`.
 */

import { compareStrings } from '@dereekb/util';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { format, resolveConfig } from 'prettier';

// MARK: Types
/**
 * One named runtime import a generated module needs.
 */
export interface GeneratedTsImport {
  /**
   * Module specifier to import from — typically a package name.
   */
  readonly packageName: string;
  /**
   * Identifier to import.
   */
  readonly identifier: string;
}

/**
 * Result of {@link writeGeneratedTsFile}.
 *
 * `unchanged` means the file already held byte-identical content and was left
 * untouched, preserving its mtime.
 */
export type WriteGeneratedTsFileOutcome = 'wrote' | 'unchanged';

/**
 * Inputs for {@link writeGeneratedTsFile}.
 */
export interface WriteGeneratedTsFileInput {
  /**
   * Absolute path of the file to write.
   */
  readonly outputFile: string;
  /**
   * Full file contents.
   */
  readonly contents: string;
}

// MARK: Functions
/**
 * Groups named imports by their module specifier and renders one
 * `import { … } from '…';` line per package, packages sorted by specifier and
 * identifiers sorted within each line.
 *
 * @param imports - Every identifier the generated module references, with the package it comes from.
 * @returns One import line per distinct package, in specifier order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderGroupedImportLines(imports: readonly GeneratedTsImport[]): string[] {
  const importsByPackage = new Map<string, Set<string>>();

  for (const { packageName, identifier } of imports) {
    if (!packageName || !identifier) continue;
    const set = importsByPackage.get(packageName) ?? new Set<string>();
    set.add(identifier);
    importsByPackage.set(packageName, set);
  }

  return [...importsByPackage.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pkg, names]) => {
      const sortedNames = [...names].sort(compareStrings).join(', ');
      return `import { ${sortedNames} } from '${pkg}';`;
    });
}

/**
 * Formats generated TypeScript source with the workspace prettier config
 * resolved for `outputFile`, so the emitted bytes match what
 * `prettier --write` would produce on the committed file.
 *
 * @param source - The unformatted module source.
 * @param outputFile - Path the source will be written to; selects the prettier config and parser.
 * @returns The formatted source.
 */
export async function formatGeneratedTs(source: string, outputFile: string): Promise<string> {
  const config = await resolveConfig(outputFile);
  return format(source, { ...config, filepath: outputFile });
}

/**
 * Writes generated content to disk, creating the containing directory when
 * missing and skipping the write entirely when the existing file is
 * byte-identical.
 *
 * Skipping matters for incremental builds: rewriting identical bytes would
 * bump the mtime and invalidate every downstream target.
 *
 * @param input - Output path and full contents.
 * @returns `'unchanged'` when the write was skipped, `'wrote'` otherwise.
 */
export function writeGeneratedTsFile(input: WriteGeneratedTsFileInput): WriteGeneratedTsFileOutcome {
  const { outputFile, contents } = input;
  const outputDir = dirname(outputFile);
  let result: WriteGeneratedTsFileOutcome;

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  if (existsSync(outputFile) && readFileSync(outputFile, 'utf8') === contents) {
    result = 'unchanged';
  } else {
    writeFileSync(outputFile, contents);
    result = 'wrote';
  }

  return result;
}
