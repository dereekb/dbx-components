/**
 * Shared types for `dbx_model_list_component`.
 *
 * The tool walks a downstream `-firebase` component's
 * `src/lib/model/*` folders, extracting the basic identity surface
 * (model name, identity const, collection prefix, parent identity)
 * for every non-reserved model. When the caller also supplies an
 * `apiDir`, each model is annotated with whether the API has a
 * fixture context for it — answering the "what's missing fixtures
 * in this app" audit in one call.
 */

/**
 * One extracted model the tool surfaces.
 */
export interface ComponentModelEntry {
  /**
   * The model folder basename (e.g. `profile`, `assessment`).
   */
  readonly folder: string;
  /**
   * The PascalCase model name derived from the identity const
   * (e.g. `Profile`, `Assessment`). When the identity const cannot
   * be located the fallback is the folder name PascalCased.
   */
  readonly modelName: string;
  /**
   * The identity constant name (e.g. `profileIdentity`).
   * `undefined` when not detected.
   */
  readonly identityConst: string | undefined;
  /**
   * Collection prefix passed to `firestoreModelIdentity(..., 'p')`.
   */
  readonly collectionPrefix: string | undefined;
  /**
   * Collection name (modelType) passed to
   * `firestoreModelIdentity(..., 'profile', 'p')`.
   */
  readonly collectionName: string | undefined;
  /**
   * Parent identity const for subcollection models (e.g.
   * `userIdentity`). `undefined` for root collections.
   */
  readonly parentIdentityConst: string | undefined;
  /**
   * Source file the identity was extracted from, relative to the
   * component root.
   */
  readonly sourceFile: string;
  /**
   * Whether the API app's `src/test/fixture.ts` declares a
   * `<Prefix><Model>TestContext{Fixture,Instance,Params}` triplet
   * for this model. Only populated when the caller supplies an
   * `apiDir`; otherwise `undefined`.
   */
  readonly fixtureCovered: boolean | undefined;
}

/**
 * One reserved folder the tool intentionally skipped (with a pointer
 * to the dedicated cluster validator).
 */
export interface SkippedReservedFolder {
  readonly folder: string;
  readonly recommendedTool: string;
}

/**
 * Aggregate report returned to the caller.
 */
export interface ComponentModelReport {
  readonly componentDir: string;
  readonly modelRoot: string;
  readonly models: readonly ComponentModelEntry[];
  readonly skipped: readonly SkippedReservedFolder[];
  /**
   * Folders that contain `<name>.ts` but the extractor couldn't
   * locate a `firestoreModelIdentity(...)` call — kept so the agent
   * can surface "this folder looks like a model but identity wiring
   * is missing".
   */
  readonly unidentifiedFolders: readonly string[];
  /**
   * Reflects whether the caller passed `apiDir` and the cross-reference
   * resolved successfully. `undefined` when no `apiDir` was supplied;
   * an error string when `apiDir` was supplied but the fixture file
   * couldn't be read.
   */
  readonly fixtureCoverageStatus: 'ok' | 'no-api-dir' | { readonly kind: 'error'; readonly message: string };
}
