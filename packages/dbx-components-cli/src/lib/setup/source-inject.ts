/**
 * Marker-anchored source injection — the deterministic mechanism add-ons use to
 * wire themselves into the TypeScript source the CLI scaffolded.
 *
 * Each base template carries inert `// @dbx-addon:<id>:<file>:<site>` marker
 * comments at every injection site. An add-on's `configure` phase inserts its
 * token-substituted snippet immediately after (or before) the matching marker,
 * guarded by a unique sentinel so re-runs are no-ops. When the marker — or the
 * file — is absent (a hand-built or pre-marker project) nothing is written and
 * the exact edit is returned for the operator to apply by hand.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { type Maybe } from '@dereekb/util';

/**
 * Where a snippet is inserted relative to its marker line.
 */
export type SourceInjectionPlacement = 'after' | 'before';

/**
 * The marker-comment prefix all add-on injection markers share.
 */
export const DBX_ADDON_MARKER_PREFIX = '@dbx-addon';

/**
 * Builds the canonical marker string for an add-on injection site:
 * `@dbx-addon:<addonId>:<fileTag>:<site>`.
 *
 * @param input - The marker parts.
 * @param input.addonId - The add-on id (e.g. `oidc`).
 * @param input.fileTag - The target-file tag (e.g. `root-config`).
 * @param input.site - The site within the file (e.g. `providers`).
 * @returns The marker string (without the leading comment token).
 */
export function dbxAddonMarker(input: { readonly addonId: string; readonly fileTag: string; readonly site: string }): string {
  return `${DBX_ADDON_MARKER_PREFIX}:${input.addonId}:${input.fileTag}:${input.site}`;
}

/**
 * One marker injection request.
 */
export interface MarkerInjection {
  /**
   * Absolute path to the file to edit.
   */
  readonly filePath: string;
  /**
   * The marker substring to locate (matched anywhere on a line).
   */
  readonly marker: string;
  /**
   * The text to insert (already token-substituted). May be multi-line.
   */
  readonly snippet: string;
  /**
   * A unique substring proving this snippet is present; when found, the
   * injection is a no-op (idempotency guard).
   */
  readonly sentinel: string;
  /**
   * Insert after (default) or before the marker line.
   */
  readonly placement?: Maybe<SourceInjectionPlacement>;
  /**
   * Match the marker line's leading whitespace on each snippet line (default `true`).
   */
  readonly indentFromMarker?: Maybe<boolean>;
}

/**
 * The outcome of a single injection.
 */
export type SourceInjectionStatus = 'applied' | 'already-present' | 'marker-missing' | 'file-missing';

/**
 * The result of a single injection.
 */
export interface SourceInjectionResult {
  readonly filePath: string;
  readonly marker: string;
  readonly status: SourceInjectionStatus;
  /**
   * The snippet to apply by hand, set only for `marker-missing` / `file-missing`.
   */
  readonly manualSnippet?: Maybe<string>;
}

/**
 * Whether a status means the snippet must be applied manually.
 *
 * @param status - An injection status.
 * @returns `true` for `marker-missing` / `file-missing`.
 */
export function isManualInjectionStatus(status: SourceInjectionStatus): boolean {
  return status === 'marker-missing' || status === 'file-missing';
}

/**
 * The leading whitespace of a line.
 *
 * @param line - A source line.
 * @returns The leading whitespace run (possibly empty).
 */
function leadingWhitespace(line: string): string {
  const match = /^[ \t]*/.exec(line);
  return match ? match[0] : '';
}

/**
 * Prefixes every non-empty line of a snippet with the given indent.
 *
 * @param snippet - The snippet to indent.
 * @param indent - The leading whitespace to apply.
 * @returns The indented snippet.
 */
function indentSnippet(snippet: string, indent: string): string {
  return snippet
    .split('\n')
    .map((line) => (line.length > 0 ? `${indent}${line}` : line))
    .join('\n');
}

/**
 * Injects a snippet at its marker. Idempotent via the sentinel; prints-only (no
 * write) when the marker or file is missing.
 *
 * @param input - The injection request.
 * @param options - When `dryRun` is set, the would-be edit is computed but not written.
 * @returns The injection result.
 */
export function injectAtMarker(input: MarkerInjection, options?: Maybe<{ readonly dryRun?: Maybe<boolean> }>): SourceInjectionResult {
  let result: SourceInjectionResult;

  if (existsSync(input.filePath)) {
    const content = readFileSync(input.filePath, 'utf8');

    if (content.includes(input.sentinel)) {
      result = { filePath: input.filePath, marker: input.marker, status: 'already-present' };
    } else {
      const lines = content.split('\n');
      const markerIndex = lines.findIndex((line) => line.includes(input.marker));

      if (markerIndex < 0) {
        result = { filePath: input.filePath, marker: input.marker, status: 'marker-missing', manualSnippet: input.snippet };
      } else {
        const indent = (input.indentFromMarker ?? true) ? leadingWhitespace(lines[markerIndex]) : '';
        const rendered = indentSnippet(input.snippet, indent);
        const insertAt = (input.placement ?? 'after') === 'after' ? markerIndex + 1 : markerIndex;
        const nextLines = [...lines.slice(0, insertAt), rendered, ...lines.slice(insertAt)];

        if (!options?.dryRun) {
          writeFileSync(input.filePath, nextLines.join('\n'));
        }

        result = { filePath: input.filePath, marker: input.marker, status: 'applied' };
      }
    }
  } else {
    result = { filePath: input.filePath, marker: input.marker, status: 'file-missing', manualSnippet: input.snippet };
  }

  return result;
}

/**
 * Applies a list of injections in order.
 *
 * @param injections - The injection requests.
 * @param options - When `dryRun` is set, no files are written.
 * @returns One result per injection, in input order.
 */
export function injectAll(injections: readonly MarkerInjection[], options?: Maybe<{ readonly dryRun?: Maybe<boolean> }>): readonly SourceInjectionResult[] {
  return injections.map((injection) => injectAtMarker(injection, options));
}

/**
 * Renders a paste-ready instruction block for the injections that could not be
 * applied automatically (marker / file missing).
 *
 * @param results - Injection results to summarize.
 * @param options - When `relativeTo` is set, file paths are reported relative to it.
 * @returns The manual-instruction markdown, or `undefined` when nothing is manual.
 */
export function formatManualInjectionInstructions(results: readonly SourceInjectionResult[], options?: Maybe<{ readonly relativeTo?: Maybe<string> }>): Maybe<string> {
  const manual = results.filter((result) => isManualInjectionStatus(result.status));
  let output: Maybe<string>;

  if (manual.length > 0) {
    const lines: string[] = ['Manual wiring required (apply these edits by hand):', ''];
    for (const result of manual) {
      const path = options?.relativeTo ? relative(options.relativeTo, result.filePath) : result.filePath;
      const reason = result.status === 'file-missing' ? 'file not found' : `marker "${result.marker}" not found`;
      lines.push(`### ${path} — ${reason}`, '', '```', result.manualSnippet ?? '', '```', '');
    }
    output = lines.join('\n').trimEnd();
  }

  return output;
}
