/**
 * Diagnostic codes emitted by `dbx_model_fixture_validate_app`.
 *
 * Each member is the source of truth for its rule documentation.
 * `extract-rule-catalog` walks the JSDoc summary + `@dbxRule*` tags
 * off each member and emits the runtime catalog.
 *
 * NOTE: the existing `FixtureDiagnosticCode` literal union in
 * `./types.ts` uses kebab-case codes (`forwarder-missing` etc.) for
 * historical reasons. Enum members are TypeScript identifiers so we
 * map them via the explicit string literal — the enum NAME is
 * uppercase-snake for readability while the VALUE matches the
 * literal already emitted at validator runtime.
 */
export enum FixtureDiagnosticCodeEnum {
  /**
   * An Instance method has no Fixture forwarder.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every public Instance method should have a same-name Fixture forwarder.
   * @dbxRuleNotApplies Static helpers, private/protected methods, and methods that intentionally exist only on Instance.
   * @dbxRuleFix Run `dbx_model_fixture_forward apiDir=<apiDir> model=<Model>` to scaffold the missing forwarder.
   * @dbxRuleSeeAlso tool:dbx_model_fixture_forward
   */
  FORWARDER_MISSING = 'forwarder-missing',

  /**
   * A Fixture forwarder's signature drifts from the Instance method it
   * forwards to.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Forwarders whose parameter list, return type, or async-ness differs from the Instance source.
   * @dbxRuleNotApplies Forwarders that intentionally widen the Instance signature (rare — usually a refactor mismatch).
   * @dbxRuleFix Re-run `dbx_model_fixture_forward` to regenerate the forwarder, or hand-edit the Fixture method to match.
   */
  FORWARDER_DIVERGENT = 'forwarder-divergent',

  /**
   * A Fixture forwarder exists but its body re-implements the Instance
   * logic instead of delegating via `this.instance.<name>(...)`.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Forwarders whose body contains anything beyond a delegation call.
   * @dbxRuleNotApplies Forwarders intentionally adding pre/post hooks (rare; prefer encapsulating the hook in an Instance method).
   * @dbxRuleFix Replace the forwarder body with `return this.instance.<name>(...args)`.
   */
  FORWARDER_NOT_DELEGATING = 'forwarder-not-delegating',

  /**
   * A model is missing one of Fixture / Instance / Params / factory
   * call / singleton — the five-anchor triplet definition is incomplete.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every model that has at least one of the anchors.
   * @dbxRuleNotApplies Models intentionally not yet wired (uncommon — usually a forgotten scaffold step).
   * @dbxRuleFix Run `dbx_model_fixture_scaffold apiDir=<apiDir> model=<Model>` to generate the missing pieces.
   * @dbxRuleSeeAlso tool:dbx_model_fixture_scaffold
   */
  TRIPLET_INCOMPLETE = 'triplet-incomplete',

  /**
   * Model / Document generic args drift between the Fixture class, the
   * Instance class, and the `modelTestContextFactory` call.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every triplet's three generic-bearing positions (Fixture, Instance, factory).
   * @dbxRuleNotApplies Triplets that intentionally use a wider generic on Fixture (rare — almost always a typo or rename drift).
   * @dbxRuleFix Align the generics on all three positions; the model and document type names should match exactly.
   */
  GENERICS_MISALIGNED = 'generics-misaligned',

  /**
   * Sub-collection wiring (8-generic factory + parent-aware
   * `getCollection`) without a parent-fixture field on the Params type
   * — or vice versa.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Sub-collection archetypes (`sub-collection`, `sub-collection-traversal`).
   * @dbxRuleNotApplies Top-level archetypes (`top-level-simple`, `top-level-with-deps`) — they don't need a parent fixture field.
   * @dbxRuleFix Add the parent fixture field to the Params type (named after the parent's `firestoreModelIdentity` short alias).
   */
  ARCHETYPE_INCONSISTENT = 'archetype-inconsistent',

  /**
   * A parent fixture field's name doesn't match the parent's
   * `firestoreModelIdentity` short alias (e.g. `sg` for `SchoolGroup`).
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When a model registry is supplied AND the field's parent fixture model is registered.
   * @dbxRuleNotApplies Fields whose parent fixture is intentionally aliased; or runs without a model registry.
   * @dbxRuleFix Rename the field on the Params type to the parent's short alias from `firestoreModelIdentity`.
   */
  PARAMS_FIELD_NAMING = 'params-field-naming',

  /**
   * The fixture references a model not in the supplied model registry.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When a model registry is supplied.
   * @dbxRuleNotApplies Downstream apps without a hooked-up registry — the rule is skipped entirely in that case.
   * @dbxRuleFix Either register the model in the workspace's identity registry or remove the fixture if the model is no longer used.
   */
  MODEL_NOT_IN_REGISTRY = 'model-not-in-registry',

  /**
   * The model registry has the model but the fixture file doesn't
   * declare a TestContext triplet for it.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When a model registry is supplied.
   * @dbxRuleNotApplies Models the app intentionally tests through some other harness (rare).
   * @dbxRuleFix Run `dbx_model_fixture_scaffold apiDir=<apiDir> model=<Model>` to add the missing triplet.
   * @dbxRuleSeeAlso tool:dbx_model_fixture_scaffold
   */
  MODEL_WITHOUT_FIXTURE = 'model-without-fixture'
}

/**
 * String-literal union derived from {@link FixtureDiagnosticCodeEnum}.
 */
export type FixtureDiagnosticCodeString = `${FixtureDiagnosticCodeEnum}`;
