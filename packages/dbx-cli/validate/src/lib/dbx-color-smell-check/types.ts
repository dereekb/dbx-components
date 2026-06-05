/**
 * Report shapes for `dbx_color_smell_check`.
 *
 * The smell check groups inline `DbxColorConfig` literals across an app
 * by their normalised signature and surfaces each group as a finding
 * with either a matching existing template key or a placeholder
 * suggestion for a new template.
 */

/**
 * Normalised `DbxColorConfig` shape used for signature grouping.
 * Mirrors the four fields the smell check reads from each candidate
 * literal (the `template` field is intentionally excluded — literals
 * with `template` set are already using the service and not flagged).
 */
export interface NormalizedColorConfig {
  readonly color?: string;
  readonly contrast?: string;
  readonly tone?: number;
  readonly tonal?: boolean;
}

/**
 * Which source kind a literal was extracted from. Determines the
 * column/line semantics in the location record.
 */
export type ColorSmellLiteralSource = 'ts' | 'html';

/**
 * One inline literal that contributed to a finding.
 */
export interface ColorSmellLiteralLocation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly source: ColorSmellLiteralSource;
  /**
   * Verbatim snippet of the matched literal, trimmed to a single line.
   */
  readonly snippet: string;
  /**
   * Normalised view of the literal (the shape signature groups by).
   */
  readonly normalized: NormalizedColorConfig;
}

/**
 * Recommendation for replacing the duplicate literal. When an existing
 * template matches the signature, `existingTemplateKey` is set; otherwise
 * `proposedTemplateKey` carries a placeholder.
 */
export interface ColorSmellSuggestion {
  readonly existingTemplateKey?: string;
  readonly proposedTemplateKey?: string;
  readonly rationale: string;
}

/**
 * One grouped finding — every literal that shares a signature, plus the
 * recommendation for collapsing them onto a template.
 */
export interface ColorSmellFinding {
  readonly signature: string;
  readonly equivalent: readonly ColorSmellLiteralLocation[];
  readonly suggestion: ColorSmellSuggestion;
}

/**
 * Per-run summary.
 */
export interface ColorSmellSummary {
  readonly filesScanned: number;
  readonly literalsFound: number;
  readonly duplicateGroups: number;
  /**
   * Number of literals that were detected but skipped because they
   * referenced a dynamic expression (spread, computed value, etc.).
   */
  readonly dynamicLiteralsSkipped: number;
}

/**
 * Full report returned by `dbx_color_smell_check`.
 */
export interface ColorSmellCheckResult {
  readonly findings: readonly ColorSmellFinding[];
  readonly summary: ColorSmellSummary;
}
