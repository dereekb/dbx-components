/**
 * Dev-surface helper that exposes the same route-model bindings the build-time
 * `route.manifest.json` carries, on demand from the in-memory source set.
 *
 * Both `dbx_route_resolve_url` and `dbx_route_lookup` render a "Page models"
 * section. Rather than re-implement the tag-merge + inheritance logic, this
 * reuses {@link buildRouteManifest} from `@dereekb/dbx-cli` and indexes its
 * flattened states (and its `missing-route-model` findings) by name — so the dev
 * output matches what the runtime `url-models` tool would see for the same app.
 */

import { buildRouteManifest, type RouteManifestModelEntry, type RouteSource } from '@dereekb/dbx-cli';

/**
 * A `stateName → …` index of the page-model data the route tools render: the
 * flattened model bindings plus the id-like route params that lack a
 * `@dbxRouteModel` binding (the `missing-route-model` findings).
 */
export interface PageModelsIndex {
  readonly modelsByState: ReadonlyMap<string, readonly RouteManifestModelEntry[]>;
  /**
   * For each state, the id-like route param names (`:id` → `id`) with no model
   * binding. Empty / absent for states that cover every id-like param.
   */
  readonly missingRouteModelsByState: ReadonlyMap<string, readonly string[]>;
}

/**
 * Builds a {@link PageModelsIndex} from the supplied sources by running the
 * shared route-manifest builder. The `app` name does not affect the model
 * bindings, so a placeholder is used.
 *
 * @param sources - The in-memory source set the route tools already loaded.
 * @returns Each state's flattened model bindings + missing id-like params, keyed by state name.
 */
export function buildPageModelsIndex(sources: readonly RouteSource[]): PageModelsIndex {
  const { manifest, warnings } = buildRouteManifest({ app: { name: 'app' }, sources });
  const modelsByState = new Map<string, readonly RouteManifestModelEntry[]>();
  for (const state of manifest.states) {
    modelsByState.set(state.name, state.models);
  }

  const missingRouteModelsByState = new Map<string, string[]>();
  for (const warning of warnings) {
    if (warning.kind === 'missing-route-model' && warning.stateName != null && warning.param != null) {
      const list = missingRouteModelsByState.get(warning.stateName) ?? [];
      list.push(warning.param);
      missingRouteModelsByState.set(warning.stateName, list);
    }
  }

  return { modelsByState, missingRouteModelsByState };
}

/**
 * Renders a model binding as a one-line markdown bullet, including its key
 * template, description, and `from` attribution when present.
 *
 * @param model - The model binding to render.
 * @returns The markdown bullet line.
 */
export function formatPageModelLine(model: RouteManifestModelEntry): string {
  const keyPart = model.keyTemplate == null ? '' : ` \`${model.keyTemplate}\``;
  const descriptionPart = model.description == null ? '' : ` — ${model.description}`;
  const fromPart = model.from == null ? '' : ` _(inherited from \`${model.from}\`)_`;
  return `- \`${model.modelType}\` (${model.kind})${keyPart}${descriptionPart}${fromPart}`;
}

/**
 * Renders the validation callout for an id-like route param that has no
 * `@dbxRouteModel` binding.
 *
 * @param param - The uncovered id-like route param name (without the leading `:`).
 * @returns The markdown callout line.
 *
 * @example
 * ```ts
 * formatMissingRouteModelLine('id');
 * // => '⚠️ Route param `:id` has no `@dbxRouteModel` binding — annotate the component class or state.'
 * ```
 */
export function formatMissingRouteModelLine(param: string): string {
  return `⚠️ Route param \`:${param}\` has no \`@dbxRouteModel\` binding — annotate the component class or state.`;
}
