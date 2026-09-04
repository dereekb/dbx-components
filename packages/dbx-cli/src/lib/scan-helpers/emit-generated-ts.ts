/**
 * Shared emission primitives for the build-time manifest generators.
 *
 * Every generator ends the same way: group the runtime imports it needs by
 * package, render a banner + module source, format it with the workspace
 * oxfmt config so the output matches an `oxfmt --write` of the committed
 * file, then skip the write when the bytes are unchanged so incremental builds
 * see a preserved mtime. That tail lives here once instead of being copied
 * into each `<generator>/src/emit.ts`.
 */

import { compareStrings } from '@dereekb/util';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { format, type FormatConfig } from 'oxfmt';

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

  return Array.from(importsByPackage.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pkg, names]) => {
      const sortedNames = Array.from(names).sort(compareStrings).join(', ');
      return `import { ${sortedNames} } from '${pkg}';`;
    });
}

/**
 * Name of the oxfmt configuration file searched for by {@link resolveOxfmtConfig}.
 */
const OXFMT_CONFIG_FILENAME = '.oxfmtrc.json';

/**
 * Keys present in `.oxfmtrc.json` that are not formatting options and must be
 * stripped before the config is handed to oxfmt's `format`.
 *
 * `$schema` is editor metadata and `ignorePatterns` only applies to the CLI's
 * file discovery — `format` is always called on an explicit source string.
 */
const OXFMT_NON_FORMAT_CONFIG_KEYS = ['$schema', 'ignorePatterns'] as const;

/**
 * Resolves the nearest `.oxfmtrc.json` by walking up from `fromFile`.
 *
 * oxfmt's programmatic `format` does not perform the config-file discovery the
 * CLI does, so generators have to load the workspace config themselves for
 * emitted bytes to match an `oxfmt --write` of the committed file.
 *
 * @param fromFile - Path to start the upward search from.
 * @returns The parsed formatting options, or an empty object when no config file is found.
 */
export function resolveOxfmtConfig(fromFile: string): FormatConfig {
  const { root } = parse(fromFile);
  let directory = dirname(fromFile);
  let config: FormatConfig = {};

  for (;;) {
    const candidate = join(directory, OXFMT_CONFIG_FILENAME);

    if (existsSync(candidate)) {
      const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as Record<string, unknown>;
      for (const key of OXFMT_NON_FORMAT_CONFIG_KEYS) {
        delete parsed[key];
      }
      config = parsed as FormatConfig;
      break;
    }

    if (directory === root) {
      break;
    }

    directory = dirname(directory);
  }

  return config;
}

/**
 * Formats generated TypeScript source with the workspace oxfmt config
 * resolved for `outputFile`, so the emitted bytes match what
 * `oxfmt --write` would produce on the committed file.
 *
 * @param source - The unformatted module source.
 * @param outputFile - Path the source will be written to; selects the oxfmt config and parser.
 * @returns The formatted source.
 */
export async function formatGeneratedTs(source: string, outputFile: string): Promise<string> {
  const config = resolveOxfmtConfig(outputFile);
  const { code, errors } = await format(outputFile, source, config);

  if (errors.length > 0) {
    throw new Error(`formatGeneratedTs(): oxfmt failed to format "${outputFile}": ${errors.map((x) => x.message).join(', ')}`);
  }

  return code;
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
