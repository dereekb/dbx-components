/**
 * Violation codes emitted by `dbx_model_firebase_index_validate_app`.
 *
 * Each member is the source of truth for its rule documentation.
 * `extract-rule-catalog` walks the JSDoc summary + `@dbxRule*` tags
 * off each member and emits the runtime catalog. See
 * `src/tools/rule-catalog/types.ts` for the tag vocabulary.
 *
 * Codes are emitted in three places:
 *   - the `validate-app` MCP tool (this folder's `format-warnings.ts`)
 *   - `dbx_app_validate`'s firebase-index cluster (diff-only codes)
 *   - the `scan-model-firebase-indexes` CLI (passes the same code through)
 *
 * Keep the `MODEL_FIREBASE_INDEX_` prefix on every code so a grep across
 * the catalog stays one-shot.
 */
export enum ModelFirebaseIndexValidateAppCode {
  // MARK: Extract — structural
  /**
   * A `@dbxModelFirebaseIndex`-tagged export has no resolvable function name.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When the JSDoc marker sits above a default export or an arrow assigned to a non-identifier binding.
   * @dbxRuleNotApplies Named `export function ...` declarations — the extractor reads the name directly.
   * @dbxRuleFix Convert the export to `export function <name>(...) {}` so the slug + lookup table get a stable identifier.
   * @dbxRuleSeeAlso tool:dbx_model_firebase_index_validate_app
   */
  MODEL_FIREBASE_INDEX_MISSING_NAME = 'MODEL_FIREBASE_INDEX_MISSING_NAME',

  /**
   * A tagged factory is missing the required `@dbxModelFirebaseIndexModel <Type>` tag.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every `@dbxModelFirebaseIndex`-tagged export.
   * @dbxRuleNotApplies Helpers that opt out of index emission via `@dbxModelFirebaseIndexSkip` and aren't tagged themselves.
   * @dbxRuleFix Add `@dbxModelFirebaseIndexModel <TypeName>` referencing the Firestore model whose collection the query targets.
   * @dbxRuleTemplate ```ts
   * /**
   *  * @dbxModelFirebaseIndex
   *  * @dbxModelFirebaseIndexModel <ModelName>
   *  *\/
   * export function <name>Query(): FirestoreQueryConstraint[] { ... }
   * ```
   * @dbxRuleSeeAlso tool:dbx_model_firebase_index_validate_app
   */
  MODEL_FIREBASE_INDEX_MISSING_MODEL_TAG = 'MODEL_FIREBASE_INDEX_MISSING_MODEL_TAG',

  /**
   * `@dbxModelFirebaseIndexModel` references a type the identity resolver does not know about.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When the model name on the tag does not resolve to a `firestoreModelIdentity(...)` declaration in the scanned project.
   * @dbxRuleNotApplies Models whose identity lives in an upstream package not included in the scan globs — extend the scan config instead.
   * @dbxRuleFix Either fix the typo or add a `firestoreModelIdentity('<short>', '<plural>')` declaration in the component.
   * @dbxRuleSeeAlso doc:dbx__guide__new-model
   */
  MODEL_FIREBASE_INDEX_UNRESOLVED_MODEL = 'MODEL_FIREBASE_INDEX_UNRESOLVED_MODEL',

  /**
   * `@dbxModelFirebaseIndexScope` was set to an unsupported value.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every tagged factory that declares an explicit scope tag.
   * @dbxRuleNotApplies Factories that omit the tag — scope falls back to COLLECTION_GROUP for nested models, COLLECTION for root models.
   * @dbxRuleFix Set the tag value to exactly `COLLECTION` or `COLLECTION_GROUP`.
   */
  MODEL_FIREBASE_INDEX_UNSUPPORTED_SCOPE = 'MODEL_FIREBASE_INDEX_UNSUPPORTED_SCOPE',

  /**
   * Two tagged factories resolve to the same slug — the second is dropped from the manifest.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When two `@dbxModelFirebaseIndex` exports share the same `@dbxModelFirebaseIndexSlug` (or the same auto-derived slug from their names).
   * @dbxRuleNotApplies Intentional aliases — they should target the same composite, in which case keep one factory.
   * @dbxRuleFix Pick distinct slugs (or distinct function names) so each factory is addressable.
   */
  MODEL_FIREBASE_INDEX_DUPLICATE_SLUG = 'MODEL_FIREBASE_INDEX_DUPLICATE_SLUG',

  /**
   * A constraint helper is called that the extractor does not recognise.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When a tagged body invokes a function named like a helper but absent from `FIRESTORE_QUERY_HELPERS`.
   * @dbxRuleNotApplies Helpers that resolve via transitive resolution to another tagged factory — those go through `MODEL_FIREBASE_INDEX_UNANNOTATED_QUERY_HELPER` instead.
   * @dbxRuleFix Either swap to a registered helper (e.g. `whereDateIsBeforeWithSort`) or extend `FIRESTORE_QUERY_HELPERS` in `dbx-components-mcp` with a descriptor.
   */
  MODEL_FIREBASE_INDEX_UNKNOWN_HELPER = 'MODEL_FIREBASE_INDEX_UNKNOWN_HELPER',

  /**
   * A `where` / `orderBy` / helper call's field-path argument is not a string literal.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When the extractor sees an identifier, template, or computed expression in the field-path slot.
   * @dbxRuleNotApplies Calls whose field path is a plain `'literal'` string — those parse cleanly.
   * @dbxRuleFix Replace the dynamic expression with a string literal. If the path varies, split the factory and use `@dbxModelFirebaseIndexPath` tags.
   */
  MODEL_FIREBASE_INDEX_UNRESOLVED_FIELD = 'MODEL_FIREBASE_INDEX_UNRESOLVED_FIELD',

  /**
   * A tagged body has conditional fields but no `@dbxModelFirebaseIndexPath` declarations.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Legacy fallback when a tagged body somehow has conditional fields after the structural check skipped it. New code paths surface `MODEL_FIREBASE_INDEX_COMPLEX_QUERY_BODY` first.
   * @dbxRuleNotApplies Branch-free bodies — no path tag is necessary when every constraint executes unconditionally.
   * @dbxRuleFix Add one `@dbxModelFirebaseIndexPath <fields>` tag per call pattern, or restructure into one branch-free factory per target index.
   */
  MODEL_FIREBASE_INDEX_MISSING_PATHS = 'MODEL_FIREBASE_INDEX_MISSING_PATHS',

  /**
   * `@dbxModelFirebaseIndexPath` references a field no `where` / `orderBy` / helper call in the body produces.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every path tag whose field list contains an unknown identifier.
   * @dbxRuleNotApplies Path tags whose fields all map to body calls.
   * @dbxRuleFix Either fix the field name in the path tag or extend the body to produce that constraint.
   */
  MODEL_FIREBASE_INDEX_UNKNOWN_PATH_FIELD = 'MODEL_FIREBASE_INDEX_UNKNOWN_PATH_FIELD',

  /**
   * A transitive callee returns `FirestoreQueryConstraint(s)` but is not `@dbxModelFirebaseIndex`-tagged.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When a tagged factory inlines an untagged helper that returns query constraints — constraints still splice, but the helper escapes the catalog.
   * @dbxRuleNotApplies Helpers explicitly marked `@dbxModelFirebaseIndexSkip` — they opt out of emitting their own composite while still contributing to callers.
   * @dbxRuleFix Tag the callee with `@dbxModelFirebaseIndex` (giving it its own composite) or mark it `@dbxModelFirebaseIndexSkip` (excluded but still spliced into callers).
   */
  MODEL_FIREBASE_INDEX_UNANNOTATED_QUERY_HELPER = 'MODEL_FIREBASE_INDEX_UNANNOTATED_QUERY_HELPER',

  /**
   * Transitive constraint resolution hit a cycle (`A → B → A`).
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When a tagged factory transitively calls itself through one or more other tagged factories.
   * @dbxRuleNotApplies Composition graphs without back-edges — those resolve cleanly.
   * @dbxRuleFix Break the recursion in source — split the shared constraints into a leaf factory that neither caller re-enters.
   */
  MODEL_FIREBASE_INDEX_TRANSITIVE_CYCLE = 'MODEL_FIREBASE_INDEX_TRANSITIVE_CYCLE',

  /**
   * A transitive callee returns constraints but its declaration is not reachable (likely a cross-package `.d.ts` import).
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When the resolved callee has no body (declaration-only) and so its constraints cannot be spliced.
   * @dbxRuleNotApplies Callees declared in the scanned source tree — those resolve normally.
   * @dbxRuleFix Inline the constraint sequence locally, or extend `FIRESTORE_QUERY_HELPERS` in `dbx-components-mcp` with a descriptor for the helper.
   */
  MODEL_FIREBASE_INDEX_UNRESOLVABLE_TRANSITIVE_CALLEE = 'MODEL_FIREBASE_INDEX_UNRESOLVABLE_TRANSITIVE_CALLEE',

  /**
   * A tagged query body uses `if` / `switch` / ternary / loop — not branch-free.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `@dbxModelFirebaseIndex`-tagged factory whose body contains a branching construct, except those tagged `@dbxModelFirebaseIndexDispatcher`.
   * @dbxRuleNotApplies Bodies that only use `??` / `&&` / `||` for argument defaulting — those are still considered branch-free.
   * @dbxRuleFix Split the function into one tagged factory per target index (each branch-free), or — if it only routes between other tagged queries — mark it `@dbxModelFirebaseIndexDispatcher` and return per-index results from each branch.
   * @dbxRuleTemplate ```ts
   * /**
   *  * @dbxModelFirebaseIndex
   *  * @dbxModelFirebaseIndexModel Job
   *  * @dbxModelFirebaseIndexDispatcher
   *  *\/
   * export function jobsQuery(params: JobsQueryParams): FirestoreQueryConstraint[] {
   *   switch (params.kind) {
   *     case 'byWeek': return jobsByWeekQuery(params);
   *     default:       return jobsByStatusQuery(params);
   *   }
   * }
   * ```
   * @dbxRuleSeeAlso tool:dbx_model_firebase_index_validate_app
   */
  MODEL_FIREBASE_INDEX_COMPLEX_QUERY_BODY = 'MODEL_FIREBASE_INDEX_COMPLEX_QUERY_BODY',

  /**
   * A `@dbxModelFirebaseIndexDispatcher` calls `where` / `orderBy` / a registered helper directly.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every dispatcher whose body emits its own constraints instead of delegating to other tagged query functions.
   * @dbxRuleNotApplies Dispatchers whose every branch is `return <perIndexQuery>(...)` — the canonical shape.
   * @dbxRuleFix Move the constraint construction into a sibling `@dbxModelFirebaseIndex` factory and have the dispatcher `return` its result. If the function should not be a dispatcher, drop the `@dbxModelFirebaseIndexDispatcher` tag.
   * @dbxRuleSeeAlso tool:dbx_model_firebase_index_validate_app
   */
  MODEL_FIREBASE_INDEX_NON_DELEGATING_DISPATCHER = 'MODEL_FIREBASE_INDEX_NON_DELEGATING_DISPATCHER',

  // MARK: Analyze — Firestore shape
  /**
   * A constraint sequence has more than one range-filtered field.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every analyzed sequence whose `where` calls put `<`, `<=`, `>`, `>=`, `!=`, or `not-in` on more than one field path.
   * @dbxRuleNotApplies Sequences that range-filter at most one field — Firestore's standard composite-index shape.
   * @dbxRuleFix Restructure the query so only one field has a range filter; convert the others to equality filters or move them into a separate factory.
   */
  MODEL_FIREBASE_INDEX_MULTIPLE_RANGE_FIELDS = 'MODEL_FIREBASE_INDEX_MULTIPLE_RANGE_FIELDS',

  /**
   * Two `orderBy` calls in the same constraint sequence disagree on direction for the same field.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When the same field path appears in multiple `orderBy` calls with both `asc` and `desc`.
   * @dbxRuleNotApplies Sequences with at most one direction per field.
   * @dbxRuleFix Pick one direction per field, or split into two factories — Firestore can only deploy one direction at a time per composite.
   */
  MODEL_FIREBASE_INDEX_ORDERBY_CONFLICT = 'MODEL_FIREBASE_INDEX_ORDERBY_CONFLICT',

  /**
   * A field uses the `array-contains-any` operator — index support is partial.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every constraint sequence with at least one `array-contains-any` `where`.
   * @dbxRuleNotApplies Queries using `array-contains` (singular) — those have full composite support. Also suppressed when the factory is tagged `@dbxModelFirebaseIndexAllowArrayContainsAny`.
   * @dbxRuleFix Confirm the deployed composite supports `array-contains-any` for the field set and add `@dbxModelFirebaseIndexAllowArrayContainsAny` to silence the advisory, or restructure to `array-contains` with a denormalised flag.
   */
  MODEL_FIREBASE_INDEX_UNSUPPORTED_ARRAY_CONTAINS_ANY = 'MODEL_FIREBASE_INDEX_UNSUPPORTED_ARRAY_CONTAINS_ANY',

  // MARK: Diff — drift between factories and committed JSON
  /**
   * A composite index required by tagged factories is missing from the committed `firestore.indexes.json`.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every entry in the generated composite set that has no equal entry in the committed JSON.
   * @dbxRuleNotApplies Factories tagged `@dbxModelFirebaseIndexManual` — their shapes are author-managed and excluded from drift.
   * @dbxRuleFix Run the `scan-model-firebase-indexes` / `generate-firestore-indexes` CLIs and commit the regenerated `firestore.indexes.json`.
   */
  MODEL_FIREBASE_INDEX_COMPOSITE_ADDED = 'MODEL_FIREBASE_INDEX_COMPOSITE_ADDED',

  /**
   * A composite index in the committed `firestore.indexes.json` has no factory backing it.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every entry in the committed JSON that has no equal entry in the generated set.
   * @dbxRuleNotApplies Composites managed by hand — tag the corresponding factory with `@dbxModelFirebaseIndexManual` so the validator treats the deployed shape as expected.
   * @dbxRuleFix Either delete the stale composite, or add a `@dbxModelFirebaseIndexManual` factory describing its shape so the validator treats it as expected.
   */
  MODEL_FIREBASE_INDEX_COMPOSITE_REMOVED = 'MODEL_FIREBASE_INDEX_COMPOSITE_REMOVED',

  /**
   * A `fieldOverrides` entry required by tagged factories is missing from the committed `firestore.indexes.json`.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every fieldOverride required by an analyzed factory and absent from the committed JSON.
   * @dbxRuleNotApplies fieldOverrides covered by an `@dbxModelFirebaseIndexManual` factory.
   * @dbxRuleFix Regenerate `firestore.indexes.json` via the scan + generate CLIs and commit.
   */
  MODEL_FIREBASE_INDEX_FIELD_OVERRIDE_ADDED = 'MODEL_FIREBASE_INDEX_FIELD_OVERRIDE_ADDED',

  /**
   * A `fieldOverrides` entry exists in the committed JSON but no factory requires it.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every fieldOverride in the committed JSON without a matching generated entry.
   * @dbxRuleNotApplies fieldOverrides covered by a hand-managed `@dbxModelFirebaseIndexManual` factory.
   * @dbxRuleFix Either delete the stale entry or add a `@dbxModelFirebaseIndexManual` factory so the validator treats it as expected.
   */
  MODEL_FIREBASE_INDEX_FIELD_OVERRIDE_REMOVED = 'MODEL_FIREBASE_INDEX_FIELD_OVERRIDE_REMOVED',

  // MARK: Tool — runtime configuration
  /**
   * The scan could not run — missing config, missing package.json, or an invalid manifest.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When `buildModelFirebaseIndexManifest` returns any outcome other than `success` (no-config, invalid-scan-config, no-package, invalid-package, invalid-manifest).
   * @dbxRuleNotApplies Components that successfully build a manifest — their downstream warnings get specific codes.
   * @dbxRuleFix Read the embedded message; add or fix `dbx-mcp.scan.json`, ensure the component has a `package.json`, or correct the manifest shape so extraction can complete.
   */
  MODEL_FIREBASE_INDEX_BUILD_FAILED = 'MODEL_FIREBASE_INDEX_BUILD_FAILED',

  /**
   * The committed `firestore.indexes.json` exists but could not be parsed.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When `readFile` succeeds but `JSON.parse` fails, or the top-level value is not an object.
   * @dbxRuleNotApplies Components whose indexes file is absent — that path emits the missing-file note in the header instead.
   * @dbxRuleFix Restore the file to valid JSON with a top-level `{ "indexes": [...], "fieldOverrides": [...] }` object — re-run `firebase init firestore` or restore from git history.
   */
  MODEL_FIREBASE_INDEX_INDEXES_FILE_INVALID = 'MODEL_FIREBASE_INDEX_INDEXES_FILE_INVALID'
}

/**
 * String-literal union derived from {@link ModelFirebaseIndexValidateAppCode}.
 */
export type ModelFirebaseIndexValidateAppCodeString = `${ModelFirebaseIndexValidateAppCode}`;
