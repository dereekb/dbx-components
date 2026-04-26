/**
 * Shared formatting helpers used by the per-domain validator `format.ts`
 * modules (model, model-folder, model-api, system, notification, storagefile).
 *
 * Three report shapes are supported:
 *
 *   - {@link formatFolderGroupedResult} — single-folder validators (model, system).
 *     Groups violations by `v.folder`.
 *   - {@link formatTwoSideResult}       — two-directory validators (notification, storagefile).
 *     Groups violations by `v.side` (`component` / `api`).
 *   - {@link formatFileGroupedResult}   — file-and-inner-key validators (model, model-api).
 *     Groups violations by `v.file` then by a caller-supplied inner key.
 *
 * The lower-level building blocks ({@link formatStatusLabel},
 * {@link groupViolations}, {@link formatViolationLine}) are exported for any
 * domain that needs custom layout beyond the three canned shapes.
 */

/**
 * Severity of a single validator violation. Errors fail the run; warnings
 * surface advisory issues without changing the pass/fail outcome.
 */
export type ViolationSeverity = 'error' | 'warning';

/**
 * Minimum shape every domain's `Violation` satisfies. Used by the shared
 * line formatter so it can produce the canonical `- **[LABEL] CODE** ...`
 * line without knowing about domain-specific fields.
 */
export interface ViolationLine {
  readonly severity: ViolationSeverity;
  readonly code: string;
  readonly message: string;
}

/**
 * Renders the headline pass/fail label.
 *
 * @param errorCount - number of error-severity violations
 * @param warningCount - number of warning-severity violations
 * @returns `FAIL` when there are any errors, `PASS WITH WARNINGS` when only warnings, otherwise `PASS`
 */
export function formatStatusLabel(errorCount: number, warningCount: number): string {
  let result: string;
  if (errorCount > 0) {
    result = 'FAIL';
  } else if (warningCount > 0) {
    result = 'PASS WITH WARNINGS';
  } else {
    result = 'PASS';
  }
  return result;
}

/**
 * Groups a violation list by an arbitrary key while preserving insertion
 * order within each bucket. Used by per-domain formatters that emit one
 * markdown section per file / folder / side / model.
 *
 * @param violations - the violations to bucket
 * @param keyFn - extracts the bucket key for a single violation
 * @returns insertion-ordered map of key → violations
 */
export function groupViolations<TViolation, TKey>(violations: readonly TViolation[], keyFn: (violation: TViolation) => TKey): Map<TKey, readonly TViolation[]> {
  const out = new Map<TKey, TViolation[]>();
  for (const v of violations) {
    const key = keyFn(v);
    const existing = out.get(key);
    if (existing) {
      existing.push(v);
    } else {
      out.set(key, [v]);
    }
  }
  return out;
}

/**
 * Renders a single violation as the canonical markdown bullet:
 *
 *   - **[ERROR] CODE**`<locationPart>` — `<message>`
 *
 * `locationPart` is intentionally raw so each domain can choose its own
 * format (e.g. `' _(line 12)_'` or `' _(file: foo.ts)_'`); pass an empty
 * string when the violation has no location detail.
 *
 * @param violation - the violation to format
 * @param locationPart - pre-formatted location suffix appended after the code (may be empty)
 * @returns the markdown bullet line
 */
export function formatViolationLine(violation: ViolationLine, locationPart: string): string {
  const label = violation.severity === 'error' ? 'ERROR' : 'WARN';
  return `- **[${label}] ${violation.code}**${locationPart} — ${violation.message}`;
}

// MARK: Folder-grouped report (model, system)

/**
 * Minimum violation shape required by {@link formatFolderGroupedResult}.
 */
export interface FolderGroupedViolation extends ViolationLine {
  readonly folder: string;
  readonly file: string | undefined;
}

/**
 * Minimum result shape required by {@link formatFolderGroupedResult}.
 */
export interface FolderGroupedResult {
  readonly violations: readonly FolderGroupedViolation[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly foldersChecked: number;
}

/**
 * Renders a single-folder validator result as the canonical markdown report
 * used by `dbx_validate_model_folder` and `dbx_system_m_validate_folder`.
 * Violations are grouped by folder so callers see one section per directory.
 *
 * @param config - shared call config
 * @param config.title - heading text (e.g. `'Model folder validation'`)
 * @param config.result - the aggregated validator outcome
 * @returns the markdown report
 */
export function formatFolderGroupedResult<TResult extends FolderGroupedResult>(config: { readonly title: string; readonly result: TResult }): string {
  const { title, result } = config;
  const { violations, errorCount, warningCount, foldersChecked } = result;
  const lines: string[] = [`# ${title} — ${formatStatusLabel(errorCount, warningCount)}`, '', `Checked ${foldersChecked} folder(s). ${errorCount} error(s), ${warningCount} warning(s).`];
  if (violations.length === 0) {
    return lines.join('\n');
  }
  const byFolder = groupViolations(violations, (v) => v.folder);
  for (const [folder, folderViolations] of byFolder) {
    lines.push('', `## ${folder}`);
    for (const v of folderViolations) {
      lines.push(formatViolationLine(v, v.file ? ` _(file: ${v.file})_` : ''));
    }
  }
  return lines.join('\n');
}

// MARK: Two-side report (notification, storagefile)

/**
 * Side of a two-directory validator. `component` = the `-firebase` package;
 * `api` = the API app that wires the services.
 */
export type ValidationSide = 'component' | 'api';

/**
 * Minimum violation shape required by {@link formatTwoSideResult}.
 */
export interface TwoSideViolation extends ViolationLine {
  readonly side: ValidationSide;
  readonly file: string | undefined;
}

/**
 * Minimum result shape required by {@link formatTwoSideResult}.
 */
export interface TwoSideResult {
  readonly violations: readonly TwoSideViolation[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly componentDir: string;
  readonly apiDir: string;
}

/**
 * Renders a two-directory validator result as the canonical markdown report
 * used by `dbx_notification_m_validate_folder` and
 * `dbx_storagefile_m_validate_folder`. Violations are grouped by side
 * (component / api) so each row points at the directory needing the fix.
 *
 * @param config - shared call config
 * @param config.title - heading text (e.g. `'Notification folder validation'`)
 * @param config.result - the aggregated validator outcome
 * @returns the markdown report
 */
export function formatTwoSideResult<TResult extends TwoSideResult>(config: { readonly title: string; readonly result: TResult }): string {
  const { title, result } = config;
  const { violations, errorCount, warningCount, componentDir, apiDir } = result;
  const lines: string[] = [`# ${title} — ${formatStatusLabel(errorCount, warningCount)}`, '', `Component: \`${componentDir}\` · API: \`${apiDir}\``, `${errorCount} error(s), ${warningCount} warning(s).`];
  if (violations.length === 0) {
    return lines.join('\n');
  }
  const grouped = groupViolations(violations, (v) => v.side);
  for (const side of ['component', 'api'] as const) {
    const sideViolations = grouped.get(side);
    if (sideViolations && sideViolations.length > 0) {
      lines.push('', `## ${side === 'component' ? 'Component' : 'API'}`);
      for (const v of sideViolations) {
        lines.push(formatViolationLine(v, v.file ? ` _(file: ${v.file})_` : ''));
      }
    }
  }
  return lines.join('\n');
}

// MARK: File-grouped report (model, model-api)

/**
 * Minimum violation shape required by {@link formatFileGroupedResult}.
 */
export interface FileGroupedViolation extends ViolationLine {
  readonly file: string;
  readonly line: number | undefined;
}

/**
 * Minimum result shape required by {@link formatFileGroupedResult}.
 */
export interface FileGroupedResult {
  readonly violations: readonly FileGroupedViolation[];
  readonly errorCount: number;
  readonly warningCount: number;
}

/**
 * Renders a file-grouped validator result as the canonical markdown report
 * used by `dbx_validate_firebase_model` and `dbx_validate_model_api`.
 * Violations are grouped by file, then by a caller-supplied inner key
 * (model name / rule group).
 *
 * @param config - shared call config
 * @param config.title - heading text (e.g. `'Firebase model validation'`)
 * @param config.summary - first-paragraph summary excluding the trailing
 *   error/warning counts (e.g. `'Checked 5 file(s), 12 model(s).'`); the
 *   counts are appended automatically.
 * @param config.innerKey - extracts the secondary grouping key from each violation
 * @param config.result - the aggregated validator outcome
 * @returns the markdown report
 */
export function formatFileGroupedResult<TResult extends FileGroupedResult>(config: { readonly title: string; readonly summary: string; readonly innerKey: (violation: TResult['violations'][number]) => string; readonly result: TResult }): string {
  const { title, summary, innerKey, result } = config;
  const { violations, errorCount, warningCount } = result;
  const lines: string[] = [`# ${title} — ${formatStatusLabel(errorCount, warningCount)}`, '', `${summary} ${errorCount} error(s), ${warningCount} warning(s).`];
  if (violations.length === 0) {
    return lines.join('\n');
  }
  const byFile = groupViolations(violations, (v) => v.file);
  for (const [file, fileViolations] of byFile) {
    lines.push('', `## ${file}`);
    const byInner = groupViolations(fileViolations, (v) => innerKey(v));
    for (const [inner, innerViolations] of byInner) {
      lines.push('', `### ${inner}`);
      for (const v of innerViolations) {
        const location = v.line !== undefined ? `line ${v.line}` : 'file-level';
        lines.push(formatViolationLine(v, ` _(${location})_`));
      }
    }
  }
  return lines.join('\n');
}
