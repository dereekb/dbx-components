/**
 * Extraction types shared by the `dbx_model_fixture_*` tool cluster.
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
 *
 * The validation diagnostic types (`FixtureDiagnostic`, `FixtureValidationResult`,
 * the diagnostic-code union, and the model registry) live alongside the
 * `validateAppFixtures` implementation in `@dereekb/dbx-components-mcp`, since
 * they depend on the rule-catalog remediation layer.
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
 * Classification of a Fixture/Instance pair by what it represents.
 *
 * - `firestore-model` — the default; the pair is registered via
 *   `modelTestContextFactory(...)` and corresponds to a Firestore document
 *   model. All validator rules apply.
 * - `authorized-user` — the pair is part of the framework's `AuthorizedUser`
 *   family (extends `AuthorizedUserTestContextFixture`/`Instance` or is
 *   registered via `authorizedUserContextFactory`). Model-specific rules
 *   (`triplet-incomplete`, `archetype-inconsistent`, etc.) are skipped.
 * - `non-model` — the pair is explicitly opted out of model validation via
 *   the `@dbxFixtureNotModel` JSDoc tag on the Fixture or Instance class.
 *   Same rule gating as `authorized-user`.
 */
export type FixtureKind = 'firestore-model' | 'authorized-user' | 'non-model';

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
  /**
   * Classification of what the Fixture/Instance pair represents. Defaults to
   * `firestore-model`; framework-provided non-model families and pairs
   * tagged with `@dbxFixtureNotModel` opt out of model-specific validator
   * rules.
   */
  readonly kind: FixtureKind;
  /**
   * When `kind !== 'firestore-model'`, identifies the framework family that
   * matched (e.g. `'authorized-user'`) so lookup/list output can describe
   * the pair. Set together with `kind`.
   */
  readonly nonModelFamily?: 'authorized-user' | 'jsdoc-tag';
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
