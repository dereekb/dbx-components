/**
 * Violation codes emitted by `dbx_model_server_only_validate_app`.
 *
 * The validator reconciles the THREE independent declarations of "no client may read this model":
 *
 *   1. `@dbxModelServerOnly` on the model interface — the design-time tag the model extractor
 *      carries onto `CliModelManifestEntry.serverOnly`, so the CLI can refuse locally.
 *   2. `serverOnly: true` on the `firebaseModelServiceFactory` config — the runtime flag
 *      `ModelApiGetService` reads before `useModel`, which is what actually refuses the read.
 *   3. The rules-derived verdict from `firestore.rules` — no match block, or read grants that are
 *      all constant-`false`.
 *
 * Any two of the three disagreeing is a bug, and which one is missing determines the severity: a
 * missing runtime flag is a live authorization leak (the model API hands a client a document the
 * rules would never let it read), while a missing tag is only a lost fast-path.
 *
 * Each member is the source of truth for its rule documentation. `extract-rule-catalog` walks the
 * JSDoc summary + `@dbxRule*` tags off each member and emits the runtime catalog.
 *
 * Keep the `MODEL_SERVER_ONLY_` prefix on every code so a grep across the catalog stays one-shot.
 */
export enum ModelServerOnlyValidateAppCode {
  /**
   * The rules file grants no client read for the model's collection, but its service config has no `serverOnly: true`.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies A registered `firebaseModelServiceFactory` whose model collection is `denied` or `unmatched` for both `get` and `list` in `firestore.rules`.
   * @dbxRuleNotApplies Models whose collection has any non-constant-`false` read grant — those are legitimately client-readable.
   * @dbxRuleFix Add `serverOnly: true` to the model's `firebaseModelServiceFactory({ … })` config, beside `roleMapForModel`. Without it `ModelApiGetService` authorizes the read via `roleMapForModel` under the Admin SDK and hands a client a document `firestore.rules` would never release.
   * @dbxRuleTemplate ```ts
   * export const <model>FirebaseModelServiceFactory = firebaseModelServiceFactory<Ctx, <Model>, <Model>Document, <Model>Roles>({
   *   // SERVER-ONLY: firestore.rules grants no client read for `<collection>`.
   *   serverOnly: true,
   *   roleMapForModel: …,
   *   getFirestoreCollection: …
   * });
   * ```
   * @dbxRuleSeeAlso tool:dbx_firestore_rules_scan
   */
  MODEL_SERVER_ONLY_MISSING_RUNTIME_FLAG = 'MODEL_SERVER_ONLY_MISSING_RUNTIME_FLAG',

  /**
   * The rules file grants no client read for the model's collection, but its interface has no `@dbxModelServerOnly` tag.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies A model whose collection is server-only per `firestore.rules` and whose interface is resolvable in the scanned sources.
   * @dbxRuleNotApplies Models whose document data is a type alias rather than an interface (there is nothing to tag) — reported as `MODEL_SERVER_ONLY_NO_INTERFACE` instead.
   * @dbxRuleFix Add `@dbxModelServerOnly` to the model interface's JSDoc. The tag is what carries `serverOnly` onto the generated model manifest, letting the CLI refuse the read before choosing a transport instead of round-tripping to an API that will refuse it anyway.
   * @dbxRuleSeeAlso tool:dbx_firestore_rules_scan
   */
  MODEL_SERVER_ONLY_MISSING_TAG = 'MODEL_SERVER_ONLY_MISSING_TAG',

  /**
   * A model declares `serverOnly` (tag and/or runtime flag) but its collection IS client-readable per the rules.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Any model carrying `@dbxModelServerOnly` or `serverOnly: true` whose collection has a non-constant-`false` `get` or `list` grant.
   * @dbxRuleNotApplies A deliberate belt-and-braces refusal — but state it in the rules too, by removing the client read grant, so the two artifacts do not disagree.
   * @dbxRuleFix Either drop the `serverOnly` declaration (the model IS readable), or remove the read grant from `firestore.rules` so both artifacts say the same thing. A model that is server-only in code and readable in the rules is a refusal that only one of the two read paths honours.
   * @dbxRuleSeeAlso tool:dbx_firestore_rules_scan
   */
  MODEL_SERVER_ONLY_RULES_ALLOW_READ = 'MODEL_SERVER_ONLY_RULES_ALLOW_READ',

  /**
   * The interface tag and the runtime flag disagree with each other.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies A model where exactly one of `@dbxModelServerOnly` / `serverOnly: true` is present, independent of what the rules say.
   * @dbxRuleNotApplies Models where both are present or both absent.
   * @dbxRuleFix Set both. The tag drives the CLI's local refusal and the MCP catalog; the flag drives the server's actual refusal. One without the other means the two read paths disagree about the same model.
   */
  MODEL_SERVER_ONLY_TAG_FLAG_MISMATCH = 'MODEL_SERVER_ONLY_TAG_FLAG_MISMATCH',

  /**
   * An interface carries `@dbxModelServerOnly` but no `@dbxModel`, so the tag never reaches the model manifest.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Any interface tagged `@dbxModelServerOnly` without a `@dbxModel` tag.
   * @dbxRuleNotApplies Interfaces that are not Firestore model documents at all — remove the `@dbxModelServerOnly` tag from those.
   * @dbxRuleFix Add `@dbxModel` to the interface. The model extractor only assembles manifest entries for `@dbxModel`-tagged interfaces, so a lone `@dbxModelServerOnly` is inert — `CliModelManifestEntry.serverOnly` never gets set and the CLI's local refusal never fires for the model.
   */
  MODEL_SERVER_ONLY_TAG_WITHOUT_MODEL_TAG = 'MODEL_SERVER_ONLY_TAG_WITHOUT_MODEL_TAG',

  /**
   * A model declared `serverOnly: true` at runtime but has no taggable interface (its document data is a type alias).
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Models whose service factory's data type argument resolves to a `type` alias (e.g. a framework-internal paged-items page) rather than an `interface`.
   * @dbxRuleNotApplies Models with a declared interface — those go through `MODEL_SERVER_ONLY_MISSING_TAG`.
   * @dbxRuleFix Nothing to fix in most cases: the runtime flag is the load-bearing half and it is set. Recorded so the tag/flag reconciliation does not report a phantom mismatch for a model that has no interface to tag.
   */
  MODEL_SERVER_ONLY_NO_INTERFACE = 'MODEL_SERVER_ONLY_NO_INTERFACE',

  /**
   * A registered model service's collection could not be resolved to a `firestoreModelIdentity(...)` declaration.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When no scanned source declares an identity for the model type a `@dbxModelServiceFactory` tag names.
   * @dbxRuleNotApplies Models whose identity lives in a scanned directory — those resolve.
   * @dbxRuleFix Widen the validator's `modelDirs` to include the package that declares the identity (framework models live in `packages/firebase/src/lib/model`). Without the identity there is no collection name, so the rules leg of the reconciliation cannot run for this model.
   */
  MODEL_SERVER_ONLY_UNRESOLVED_IDENTITY = 'MODEL_SERVER_ONLY_UNRESOLVED_IDENTITY',

  /**
   * A model carries `serverOnly` but does not appear in the generated CLI model manifest.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When a `manifestFile` is supplied and a server-only model type has no entry in it.
   * @dbxRuleNotApplies Runs without a `manifestFile` — the check is skipped entirely.
   * @dbxRuleFix The runtime gate still covers the model; only the CLI's LOCAL pre-transport refusal is missed, so the read costs a round-trip to an API that refuses it. Either tag the model interface with `@dbxModel` (an untagged interface is never assembled into a manifest entry) or widen the manifest generator's discovery to reach the package that declares the model.
   */
  MODEL_SERVER_ONLY_NOT_IN_MANIFEST = 'MODEL_SERVER_ONLY_NOT_IN_MANIFEST'
}

/**
 * String-literal union of every {@link ModelServerOnlyValidateAppCode} member.
 */
export type ModelServerOnlyValidateAppCodeString = `${ModelServerOnlyValidateAppCode}`;
