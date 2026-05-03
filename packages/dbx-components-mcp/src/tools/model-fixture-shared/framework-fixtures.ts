/**
 * Catalog of framework-provided fixture families that produce
 * `<…>TestContextFixture` / `<…>TestContextInstance` class pairs but are NOT
 * backed by a Firestore model.
 *
 * The fixture validator and lookup/list formatters consult this list to
 * recognize the pattern automatically — downstream apps that subclass these
 * bases (or register via the listed factory) get accurate classification and
 * skip the `triplet-incomplete` / model-registry diagnostics that otherwise
 * fire on every Fixture/Instance pair.
 *
 * Add a new entry here whenever the framework introduces another non-model
 * fixture family. Both the inheritance signal (`baseFixtureClass` /
 * `baseInstanceClass`) and the factory-call signal (`factoryName`) are
 * supported; either alone is sufficient.
 */
export interface FrameworkNonModelFixtureFamily {
  /**
   * Discriminator written to {@link FixtureEntry.kind} when the family
   * matches.
   */
  readonly kind: 'authorized-user';
  /**
   * Variable name of the framework factory used to register the pair, e.g.
   * `authorizedUserContextFactory`. Matched against the call expression
   * inside the entry's factory body.
   */
  readonly factoryName: string;
  /**
   * Class name of the framework-provided Fixture base that downstream
   * subclasses extend.
   */
  readonly baseFixtureClass: string;
  /**
   * Class name of the framework-provided Instance base that downstream
   * subclasses extend.
   */
  readonly baseInstanceClass: string;
  /**
   * Module path the bases and factory are exported from. Surfaced in
   * lookup/list output so consumers know where to import from.
   */
  readonly module: string;
  /**
   * One-line human description rendered in the fixture lookup/list output.
   */
  readonly description: string;
}

export const KNOWN_NON_MODEL_FIXTURE_FAMILIES: readonly FrameworkNonModelFixtureFamily[] = [
  {
    kind: 'authorized-user',
    factoryName: 'authorizedUserContextFactory',
    baseFixtureClass: 'AuthorizedUserTestContextFixture',
    baseInstanceClass: 'AuthorizedUserTestContextInstance',
    module: '@dereekb/firebase-server/test',
    description: 'Authorized Firebase auth user (with custom claims). Not backed by a Firestore document.'
  }
] as const;

/**
 * JSDoc tag the extractor honors to mark a Fixture/Instance pair as
 * intentionally non-model. Either Fixture or Instance class can carry the
 * tag; presence on either is sufficient.
 */
export const NON_MODEL_JSDOC_TAG = 'dbxFixtureNotModel';

/**
 * Looks up a framework family by factory call name.
 *
 * @param factoryCallName - the identifier name appearing in the factory body
 *   call expression (e.g. `authorizedUserContextFactory`)
 * @returns the matched family, or `undefined`
 */
export function findFamilyByFactoryName(factoryCallName: string): FrameworkNonModelFixtureFamily | undefined {
  return KNOWN_NON_MODEL_FIXTURE_FAMILIES.find((f) => f.factoryName === factoryCallName);
}

/**
 * Looks up a framework family by Fixture or Instance base class name.
 *
 * @param baseClassName - the class identifier on the `extends` clause
 * @returns the matched family, or `undefined`
 */
export function findFamilyByBaseClass(baseClassName: string): FrameworkNonModelFixtureFamily | undefined {
  return KNOWN_NON_MODEL_FIXTURE_FAMILIES.find((f) => f.baseFixtureClass === baseClassName || f.baseInstanceClass === baseClassName);
}
