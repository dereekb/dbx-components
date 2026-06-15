/**
 * ts-morph consumer of the `@dbxRouteModel` / `@dbxRouteModelList` grammar.
 *
 * The pure grammar parser lives in `./route-model-tag.ts` (zero ts-morph) so it
 * can be reused by the `@dereekb/dbx-cli/eslint` rule without dragging ts-morph
 * into a bundled ESLint plugin. This module reads the tags off a ts-morph
 * `SourceFile` and re-exports the grammar symbols so existing importers
 * (`route-manifest.ts`, the route barrel) keep working unchanged.
 */

import type { JSDoc, SourceFile } from 'ts-morph';
import { ROUTE_MODEL_TAG, type RawRouteModelTag } from './route-model-tag.js';

export { parseRouteModelTag, ROUTE_MODEL_TAG, ROUTE_MODEL_LIST_TAG, type RawRouteModelTag, type ParseRouteModelTagResult, type ParsedRouteModel, type RouteModelKind } from './route-model-tag.js';

// MARK: Component extraction
/**
 * Extracts every `@dbxRouteModel*` tag declared on the named component class in
 * a source file. Returns an empty list when the class is absent or carries no
 * route-model tags.
 *
 * @param sourceFile - The ts-morph source file declaring the component.
 * @param component - The component class name to read tags from.
 * @returns The raw route-model tags found on the class.
 */
export function extractComponentRouteModelTags(sourceFile: SourceFile, component: string): readonly RawRouteModelTag[] {
  const cls = sourceFile.getClass(component);
  return cls === undefined ? [] : collectRouteModelTags(cls.getJsDocs());
}

function collectRouteModelTags(jsDocs: readonly JSDoc[]): readonly RawRouteModelTag[] {
  const out: RawRouteModelTag[] = [];
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      const name = tag.getTagName();
      if (name.startsWith(ROUTE_MODEL_TAG)) {
        out.push({ name, text: tag.getCommentText()?.trim() ?? '' });
      }
    }
  }
  return out;
}
