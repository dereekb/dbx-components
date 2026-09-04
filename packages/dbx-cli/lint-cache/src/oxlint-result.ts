import { resolve } from 'node:path';
import type { Maybe } from '@dereekb/util';

/**
 * One span attached to an oxlint diagnostic. The first label carries the primary
 * location; later labels are related sites (e.g. "declared here" / "redeclared here").
 */
interface OxlintRawLabel {
  readonly label?: string;
  readonly span?: {
    readonly offset?: number;
    readonly length?: number;
    readonly line?: number;
    readonly column?: number;
  };
}

interface OxlintRawDiagnostic {
  /**
   * `plugin(rule-name)` — e.g. `unicorn(no-empty-file)`, `eslint(no-unused-expressions)`.
   * Absent for parse/config errors, which oxlint reports with no rule attached.
   */
  readonly code?: string;
  readonly severity?: string;
  readonly message?: string;
  readonly filename?: string;
  readonly help?: string;
  readonly labels?: readonly OxlintRawLabel[];
}

/**
 * The top-level object oxlint writes for `--format=json`.
 */
interface OxlintRawResult {
  readonly diagnostics?: readonly OxlintRawDiagnostic[];
  readonly number_of_files?: number;
  readonly number_of_rules?: number;
}

export interface OxlintNormalizedMessage {
  readonly ruleId: Maybe<string>;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly endLine: Maybe<number>;
  readonly endColumn: Maybe<number>;
  readonly fixable: boolean;
}

export interface OxlintNormalizedFile {
  /**
   * Absolute path, so the caller can relativize it against the workspace root exactly as it does for ESLint's output.
   */
  readonly filePath: string;
  readonly messages: readonly OxlintNormalizedMessage[];
}

export interface OxlintNormalizedResult {
  readonly files: readonly OxlintNormalizedFile[];
  /**
   * Every file oxlint scanned, not just the ones with findings. oxlint reports
   * this directly, where the ESLint formatter emits one entry per scanned file
   * and the count is derived from the array length.
   */
  readonly fileCount: number;
}

/**
 * Extracts the single top-level JSON object from a stream that also contains
 * non-JSON noise.
 *
 * `nx run <project>:oxlint --format=json` writes oxlint's JSON to stdout, but Nx
 * prefixes it with its own `> nx run …` / `> oxlint …` banner and appends a run
 * summary — and oxlint has no `--output-file` flag to route around it. Scanning for
 * the first `{` and tracking brace depth *while respecting string literals and
 * escapes* is what makes this safe: a `}` inside a lint message or a Windows-style
 * escaped path cannot terminate the object early.
 *
 * @param stdout - The raw combined output captured from the Nx run.
 * @returns The substring spanning the balanced top-level JSON object.
 * @throws {Error} When no `{` is present, or the object never closes.
 */
export function extractJsonObject(stdout: string): string {
  const start = stdout.indexOf('{');
  if (start < 0) {
    throw new Error('no JSON object found in oxlint output');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;

  for (let i = start; i < stdout.length && end < 0; i += 1) {
    const ch = stdout[i];
    if (escaped) {
      escaped = false;
    } else if (ch === '\\') {
      if (inString) escaped = true;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString) {
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) end = i;
      }
    }
  }

  if (end < 0) {
    throw new Error('unterminated JSON object in oxlint output');
  }

  return stdout.slice(start, end + 1);
}

/**
 * Splits oxlint's `plugin(rule)` code into the `plugin/rule` id shape the rest of
 * the cache (and the ESLint tier) uses.
 *
 * oxlint namespaces its core rules under the `eslint` plugin, so `eslint(no-x)`
 * becomes the bare `no-x` that the same rule carries under ESLint — which keeps a
 * `--rule` query working identically across both tiers.
 *
 * @param code - The raw `code` field from an oxlint diagnostic, if present.
 * @returns The normalized rule id, or `null` for diagnostics with no rule (parse/config errors).
 */
export function oxlintRuleId(code: Maybe<string>): Maybe<string> {
  let result: Maybe<string> = null;
  if (code) {
    const match = /^(?<plugin>[^()]+)\((?<rule>[^()]+)\)$/.exec(code);
    if (match?.groups) {
      const { plugin, rule } = match.groups;
      result = plugin === 'eslint' ? rule : `${plugin}/${rule}`;
    } else {
      result = code;
    }
  }
  return result;
}

export interface ParseOxlintResultInput {
  readonly stdout: string;
  /**
   * Absolute path the diagnostics' relative `filename` values resolve against (the target's cwd).
   */
  readonly cwd: string;
}

/**
 * Parses oxlint's `--format=json` output into the normalized per-file shape that
 * `buildCache` consumes, grouping the flat diagnostic list by file.
 *
 * oxlint reports `severity: "error" | "warning"` directly rather than ESLint's
 * numeric 1/2, emits paths relative to the run's cwd rather than absolute ones,
 * and emits no fix metadata in its JSON formatter at all — so every message is
 * recorded as non-fixable rather than guessed at. (oxlint *can* apply fixes via
 * `--fix`; it just does not say which findings were fixable.)
 *
 * @param input - The captured stdout and the cwd its relative filenames resolve against.
 * @returns The diagnostics grouped by file plus the total scanned-file count.
 */
export function parseOxlintResult(input: ParseOxlintResultInput): OxlintNormalizedResult {
  const raw = JSON.parse(extractJsonObject(input.stdout)) as OxlintRawResult;
  const byFile = new Map<string, OxlintNormalizedMessage[]>();

  for (const d of raw.diagnostics ?? []) {
    const filePath = d.filename == null ? '<unknown>' : resolve(input.cwd, d.filename);
    const span = d.labels?.[0]?.span;
    const message: OxlintNormalizedMessage = {
      ruleId: oxlintRuleId(d.code),
      severity: d.severity === 'warning' ? 'warning' : 'error',
      message: d.message ?? '',
      line: span?.line ?? 0,
      column: span?.column ?? 0,
      endLine: null,
      endColumn: null,
      fixable: false
    };
    const existing = byFile.get(filePath);
    if (existing) existing.push(message);
    else byFile.set(filePath, [message]);
  }

  const files: OxlintNormalizedFile[] = Array.from(byFile.entries())
    .map(([filePath, messages]) => ({ filePath, messages }))
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  return { files, fileCount: raw.number_of_files ?? files.length };
}
