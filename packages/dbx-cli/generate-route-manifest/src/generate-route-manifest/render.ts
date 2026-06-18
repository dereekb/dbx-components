/**
 * Pure rendering layer for `dbx-cli-generate-route-manifest`.
 *
 * Delegates the heavy lifting to {@link buildRouteManifest} in `@dereekb/dbx-cli`
 * but isolates it behind a thin seam with an injectable `now`, so the spec can
 * snapshot the manifest a fixture produces without touching disk. The `main.ts`
 * entry handles glob/fs reads and the models-input JSON parse, then calls in
 * here.
 */

import { buildRouteManifest, type BuildRouteManifestApp, type RouteManifest, type RouteManifestWarning, type RouteSource } from '@dereekb/dbx-cli';

/**
 * Input to {@link renderRouteManifest}.
 */
export interface RenderRouteManifestInput {
  readonly app: BuildRouteManifestApp;
  readonly sources: readonly RouteSource[];
  readonly modelTypes?: readonly string[];
}

/**
 * Output of {@link renderRouteManifest}: the rendered manifest plus warnings.
 */
export interface RenderRouteManifestResult {
  readonly manifest: RouteManifest;
  readonly warnings: readonly RouteManifestWarning[];
}

/**
 * Renders the route manifest from already-loaded sources.
 *
 * @param input - The app identity, in-memory sources, and optional model-type catalog.
 * @param now - Override for the `generatedAt` timestamp (tests pass a fixed value).
 * @returns The rendered manifest and collected warnings.
 *
 * @example
 * ```ts
 * renderRouteManifest({ app: { name: 'demo' }, sources }, new Date('2026-01-01T00:00:00.000Z'));
 * ```
 */
export function renderRouteManifest(input: RenderRouteManifestInput, now: Date = new Date()): RenderRouteManifestResult {
  return buildRouteManifest({ app: input.app, sources: input.sources, ...(input.modelTypes == null ? {} : { modelTypes: input.modelTypes }) }, now);
}

/**
 * Formats one manifest warning as a severity-prefixed stderr line
 * (`error:` / `warning:`), so a malformed-tag error is visually distinct from a
 * non-blocking finding in the generator output.
 *
 * @param warning - The warning to format.
 * @returns The formatted log line.
 *
 * @example
 * ```ts
 * formatRouteManifestWarning({ kind: 'malformed-tag', severity: 'error', message: '…' });
 * // => '[generate-route-manifest] error: malformed-tag: …'
 * ```
 */
export function formatRouteManifestWarning(warning: RouteManifestWarning): string {
  return `[generate-route-manifest] ${warning.severity}: ${warning.kind}: ${warning.message}`;
}

/**
 * Input to {@link countRouteManifestGenerationErrors}.
 */
export interface CountRouteManifestGenerationErrorsInput {
  readonly warnings: readonly RouteManifestWarning[];
  readonly strict: boolean;
  /**
   * Warning KINDS explicitly tolerated by `--allow-warning=<kind>`: a
   * `warning`-severity finding of one of these kinds never counts toward the
   * failure total, even under `--strict` / `--max-warnings`. `error`-severity
   * findings (e.g. a malformed tag) are NOT allowlistable.
   */
  readonly allowWarning?: readonly string[];
  /**
   * `--max-warnings=<N>`: when set, generation fails if the number of
   * non-allowlisted `warning`-severity findings exceeds this cap (independent of
   * `--strict`). `--max-warnings=0` fails on any new (non-allowlisted) warning.
   */
  readonly maxWarnings?: number;
}

/**
 * Counts the findings that should fail generation: every `error`-severity
 * finding (never allowlistable), plus the non-allowlisted `warning`-severity
 * findings when `--strict` is set or when they exceed `--max-warnings`.
 *
 * @param input - The collected warnings, `--strict`, and the allowlist / cap.
 * @returns The number of findings that should cause a non-zero exit.
 *
 * @example
 * ```ts
 * countRouteManifestGenerationErrors({ warnings, strict: false }); // counts only error-severity findings
 * countRouteManifestGenerationErrors({ warnings, strict: true, allowWarning: ['unknown-route-param'] }); // tolerates that kind
 * countRouteManifestGenerationErrors({ warnings, strict: false, maxWarnings: 0 }); // fails on any new warning
 * ```
 */
export function countRouteManifestGenerationErrors(input: CountRouteManifestGenerationErrorsInput): number {
  const allow = new Set(input.allowWarning ?? []);
  // `error`-severity findings (e.g. malformed-tag) always block and are not allowlistable.
  const errorCount = input.warnings.filter((warning) => warning.severity === 'error').length;
  // Non-allowlisted `warning`-severity findings: promoted to blocking under --strict, or when they
  // exceed --max-warnings.
  const blockableWarnings = input.warnings.filter((warning) => warning.severity === 'warning' && !allow.has(warning.kind));
  const exceedsMax = input.maxWarnings !== undefined && blockableWarnings.length > input.maxWarnings;
  const blockingWarningCount = input.strict || exceedsMax ? blockableWarnings.length : 0;
  return errorCount + blockingWarningCount;
}

/**
 * Extracts the known Firestore model types from a parsed `--models-input` JSON
 * (an MCP manifest with a `models` array). Used to enable the manifest builder's
 * `unknown-model-type` validation. Returns an empty list when the shape is not
 * recognized.
 *
 * @param parsed - The parsed JSON of the models-input file.
 * @returns The list of declared `modelType` values.
 *
 * @example
 * ```ts
 * extractModelTypesFromModelsInput({ models: [{ modelType: 'guestbook' }] }); // => ['guestbook']
 * ```
 */
export function extractModelTypesFromModelsInput(parsed: unknown): readonly string[] {
  const models = (parsed as { models?: unknown })?.models;
  const out: string[] = [];
  if (Array.isArray(models)) {
    for (const model of models) {
      const modelType = (model as { modelType?: unknown })?.modelType;
      if (typeof modelType === 'string' && modelType.length > 0) {
        out.push(modelType);
      }
    }
  }
  return out;
}
