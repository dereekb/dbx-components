/**
 * Types shared by the `dbx_model_fixture_*` tool cluster.
 *
 * The cluster reads an app's `<root>/src/test/fixture.ts`, identifies every
 * `<Prefix><Model>TestContext{Fixture,Instance,Params}` triplet plus its
 * `modelTestContextFactory(...)` call, and returns information used by the
 * lookup, list, validate, scaffold, and forward tools.
 *
 * The classifier (see `archetype.ts`) sorts each entry into one of four
 * archetypes. The validator and scaffold tools speak the dialect of the
 * archetype so 8-generic sub-collection factories aren't conflated with the
 * 7-generic top-level shape.
 */

/**
 * Configuration archetypes for `modelTestContextFactory(...)` calls.
 *
 * - `top-level-simple` — 7 generics, `getCollection(fi)` is single-arg, no
 *   parent-fixture dependency on `Params`.
 * - `top-level-with-deps` — top-level model whose `Params` interface adds
 *   sibling fixture refs (e.g. an authorized user). `getCollection` remains
 *   single-arg.
 * - `sub-collection` — 8 generics with the explicit `FirestoreCollection`
 *   generic; `getCollection(fi, params)` reads a parent fixture's document
 *   off `params`.
 * - `sub-collection-traversal` — sub-collection variant that also wires
 *   `collectionForDocument` so the framework can traverse a child document
 *   back to its parent collection.
 */
export type FixtureArchetype = 'top-level-simple' | 'top-level-with-deps' | 'sub-collection' | 'sub-collection-traversal';

/**
 * One method declared on an Instance or Fixture class. `signature` is the raw
 * parameter list copied verbatim from ts-morph (including parameter types and
 * default values) so the forward tool can reproduce it without rewriting type
 * text.
 */
export interface FixtureMethod {
  readonly name: string;
  readonly isStatic: boolean;
  readonly isAsync: boolean;
  readonly visibility: 'public' | 'private' | 'protected';
  readonly parameterText: string;
  readonly returnTypeText?: string;
  readonly line: number;
  readonly endLine: number;
}

/**
 * One field on a `<Prefix><Model>TestContextParams` interface.
 *
 * `fixtureModel` is set when the field's type resolves to a sibling
 * `<Prefix><Model>TestContextFixture`. The pair `{ field, fixtureModel }`
 * forms a dependency edge consumed by the validator's parent-fixture-naming
 * rule.
 */
export interface FixtureParamsField {
  readonly name: string;
  readonly typeText: string;
  readonly optional: boolean;
  readonly fixtureModel?: string;
  readonly array?: boolean;
}

/**
 * Parsed metadata for a `<Prefix><Model>TestContextParams` interface or type
 * alias.
 *
 * `extendsPartial` is `true` when the interface extends `Partial<Model>` (the
 * common case for top-level models). `aliasOfPartial` is `true` for the
 * `type Foo = Partial<Bar>` alias pattern used by simple guestbook-style
 * params. Standalone interfaces with no `extends` clause set both to `false`
 * — typical for sub-collection params that don't carry the model's own
 * fields.
 */
export interface FixtureParamsType {
  readonly name: string;
  readonly kind: 'interface' | 'alias';
  readonly extendsPartial: boolean;
  readonly aliasOfPartial: boolean;
  readonly modelName?: string;
  readonly fields: readonly FixtureParamsField[];
  readonly line: number;
}

/**
 * The two-arg metadata for the `modelTestContextFactory<...>(...)` call.
 *
 * The validator compares `genericArgs[0]`/`genericArgs[1]` (model + document
 * type) against the Fixture/Instance class generic args; the scaffold tool
 * reproduces the same generic count when adding new entries.
 */
export interface FactoryCall {
  readonly factoryName: string;
  readonly singletonName?: string;
  readonly genericArgs: readonly string[];
  readonly hasParamsGetCollection: boolean;
  readonly hasCollectionForDocument: boolean;
  readonly hasInitDocument: boolean;
  readonly parentFixtureFieldFromGetCollection?: string;
  readonly line: number;
}

/**
 * One `<Prefix><Model>TestContext{Fixture,Instance,Params}` triplet.
 *
 * The triplet is keyed by `model` (the bare model name with the workspace
 * prefix stripped). All five anchors must be present for the validator to
 * treat the triplet as complete.
 */
export interface FixtureEntry {
  readonly model: string;
  readonly prefix: string;
  readonly archetype: FixtureArchetype;
  readonly fixtureClassName: string;
  readonly instanceClassName: string;
  readonly paramsTypeName: string;
  readonly factoryName?: string;
  readonly singletonName?: string;
  readonly fixtureExtendsGenerics: readonly string[];
  readonly instanceExtendsGenerics: readonly string[];
  readonly fixtureMethods: readonly FixtureMethod[];
  readonly instanceMethods: readonly FixtureMethod[];
  readonly params?: FixtureParamsType;
  readonly factory?: FactoryCall;
  readonly fixtureLine: number;
  readonly fixtureEndLine: number;
  readonly instanceLine: number;
  readonly instanceEndLine: number;
}

/**
 * Aggregate result returned by `extractAppFixtures()`.
 *
 * `prefix` is detected from the `<Prefix>ContextFixture` class in the file —
 * scaffolding and validation derive everything from this single anchor so no
 * tool hard-codes `DemoApi` or `HellosubsApi`.
 *
 * `unrecognizedClassNames` collects classes that match the
 * `*TestContextFixture` / `*TestContextInstance` suffix but couldn't be
 * paired into a triplet, so the validator can flag orphans.
 */
export interface AppFixturesExtraction {
  readonly fixturePath: string;
  readonly prefix?: string;
  readonly entries: readonly FixtureEntry[];
  readonly unrecognizedClassNames: readonly string[];
  readonly identityImports: readonly string[];
}

/**
 * Severity of a validation diagnostic. The validator returns `error` for
 * structural issues (a missing class in the triplet) and `warning` for
 * convention-only issues (a parent field name that doesn't match the
 * registered short alias).
 */
export type FixtureDiagnosticSeverity = 'error' | 'warning';

/**
 * Diagnostic codes emitted by `validateAppFixtures()`.
 *
 * - `forwarder-missing` — Instance method has no Fixture forwarder.
 * - `forwarder-divergent` — Fixture method's signature drifts from the
 *   Instance method it forwards to.
 * - `forwarder-not-delegating` — Fixture method exists but its body re-
 *   implements logic instead of calling `this.instance.<name>(...)`.
 * - `triplet-incomplete` — one of Fixture / Instance / Params / factory /
 *   singleton is missing for a model.
 * - `generics-misaligned` — Model / Document generic arg drifts between
 *   Fixture, Instance, and the factory call.
 * - `archetype-inconsistent` — sub-collection wiring without a parent
 *   fixture field (or vice versa).
 * - `params-field-naming` — parent fixture field name doesn't match the
 *   parent's `firestoreModelIdentity` short alias.
 * - `model-not-in-registry` — fixture's model isn't in the supplied model
 *   registry.
 * - `model-without-fixture` — registry has the model but the fixture file
 *   doesn't declare it (informational).
 */
import type { FixtureDiagnosticCodeEnum } from './codes.js';
import type { RemediationHint } from '../rule-catalog/types.js';

/**
 * String-literal union derived from {@link FixtureDiagnosticCodeEnum}.
 * Source of truth for code metadata is the enum's per-member JSDoc;
 * the template-literal type widens the enum back to its underlying
 * kebab-case strings so existing emit-sites still typecheck.
 */
export type FixtureDiagnosticCode = `${FixtureDiagnosticCodeEnum}`;

/**
 * One validation diagnostic.
 */
export interface FixtureDiagnostic {
  readonly code: FixtureDiagnosticCode;
  readonly severity: FixtureDiagnosticSeverity;
  readonly message: string;
  readonly model?: string;
  readonly line?: number;
  /**
   * Auto-attached remediation hint pulled from the rule catalog at
   * emission time. `undefined` when no catalog entry exists for the
   * code (the formatter renders no nested block in that case).
   */
  readonly remediation?: RemediationHint;
}

/**
 * Result returned by `validateAppFixtures()`.
 */
export interface FixtureValidationResult {
  readonly fixturePath: string;
  readonly diagnostics: readonly FixtureDiagnostic[];
  readonly errorCount: number;
  readonly warningCount: number;
}

/**
 * Subset of `FirebaseModel` used by the validator's cross-reference rule.
 *
 * The validator accepts an opaque registry interface so it can be fed by
 * `FIREBASE_MODELS` (the @dereekb/firebase catalog) or by an app-local
 * registry without coupling to the larger registry surface.
 */
export interface FixtureModelRegistryEntry {
  readonly name: string;
  readonly modelType: string;
  readonly collectionPrefix: string;
}

/**
 * Pluggable model registry used by `validateAppFixtures()`. Consumers either
 * hand in a list of entries or skip the parent-naming + cross-reference
 * rules entirely.
 */
export interface FixtureModelRegistry {
  readonly entries: readonly FixtureModelRegistryEntry[];
}
