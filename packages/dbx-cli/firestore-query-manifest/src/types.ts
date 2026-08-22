/**
 * Internal shapes shared by the query-manifest generator's stages.
 */

import type { CliFirestoreQueryMode, CliFirestoreQueryParam, CliFirestoreQueryRules, CliFirestoreQueryScope } from '../../src/lib/manifest/types.js';

/**
 * One catalog entry as collected from a component, before factory binding.
 */
export interface CollectedQueryEntry {
  readonly slug: string;
  readonly name: string;
  readonly module: string;
  readonly subpath: string;
  readonly model: string;
  readonly collection: string;
  readonly isNested: boolean;
  readonly scope: CliFirestoreQueryScope;
  readonly signature: string;
  readonly params: readonly CliFirestoreQueryParam[];
  readonly description?: string;
  readonly category?: string;
  readonly tags?: readonly string[];
  readonly example?: string;
  readonly relatedSlugs?: readonly string[];
  readonly manual?: boolean;
  readonly skip?: boolean;
  readonly excluded?: boolean;
  readonly dispatcher?: boolean;
  /**
   * Set by the query-mode stage; absent when the generator ran without `--rules`.
   */
  readonly queryMode?: CliFirestoreQueryMode;
  readonly rules?: CliFirestoreQueryRules;
}

/**
 * A collected entry paired with the outcome of binding its factory.
 */
export interface BoundQueryEntry {
  readonly entry: CollectedQueryEntry;
  /**
   * `false` when the identifier is not exported from the component's barrel chain — the entry is
   * still emitted, with `factory: undefined`.
   */
  readonly bound: boolean;
}
