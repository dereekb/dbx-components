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
