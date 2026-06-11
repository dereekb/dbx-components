/**
 * Dev-surface helper that exposes the same route-model bindings the build-time
 * `route.manifest.json` carries, on demand from the in-memory source set.
 *
 * Both `dbx_route_resolve_url` and `dbx_route_lookup` render a "Page models"
 * section. Rather than re-implement the tag-merge + inheritance logic, this
 * reuses {@link buildRouteManifest} from `@dereekb/dbx-cli` and indexes its
 * flattened states by name — so the dev output matches what the runtime
 * `url-models` tool would see for the same app.
 */

import { buildRouteManifest, type RouteManifestModelEntry, type RouteSource } from '@dereekb/dbx-cli';

/**
 * Builds a `stateName → models` index from the supplied sources by running the
 * shared route-manifest builder. The `app` name does not affect the model
 * bindings, so a placeholder is used.
 *
 * @param sources - The in-memory source set the route tools already loaded.
 * @returns Each state's flattened (own + inherited) model bindings, keyed by state name.
 */
export function buildPageModelsIndex(sources: readonly RouteSource[]): ReadonlyMap<string, readonly RouteManifestModelEntry[]> {
  const { manifest } = buildRouteManifest({ app: { name: 'app' }, sources });
  const index = new Map<string, readonly RouteManifestModelEntry[]>();
  for (const state of manifest.states) {
    index.set(state.name, state.models);
  }
  return index;
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
