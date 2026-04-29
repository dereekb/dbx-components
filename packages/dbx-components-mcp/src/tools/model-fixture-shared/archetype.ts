/**
 * Pure archetype classifier for `modelTestContextFactory(...)` calls.
 *
 * Inputs come from the AST extractor — already-parsed factory call metadata
 * and Params type fields. Output is one of the four archetypes used by the
 * lookup, validate, and scaffold tools to speak the right dialect for each
 * entry.
 */

import type { FactoryCall, FixtureArchetype, FixtureParamsType } from './types.js';

/**
 * Inputs accepted by `classifyFixtureArchetype()`.
 */
export interface ClassifyFixtureArchetypeInput {
  readonly factory?: FactoryCall;
  readonly params?: FixtureParamsType;
}

/**
 * Classifies a fixture entry into one of the four archetypes.
 *
 * Sub-collection archetypes are detected by the factory's
 * `getCollection(fi, params)` signature reading a parent fixture's document
 * off `params`, OR by the presence of `collectionForDocument`. Top-level
 * variants are split by whether the Params interface holds non-self fixture
 * dependencies.
 *
 * Falls back to `top-level-simple` when the factory call is absent (e.g.
 * the file declares a Fixture/Instance pair but registration was deleted)
 * — the validator surfaces the missing factory separately.
 *
 * @param input - parsed factory call + params metadata
 * @returns the archetype enum
 */
export function classifyFixtureArchetype(input: ClassifyFixtureArchetypeInput): FixtureArchetype {
  const { factory, params } = input;
  const subCollection = isSubCollection(factory);
  let archetype: FixtureArchetype;
  if (subCollection) {
    archetype = factory?.hasCollectionForDocument ? 'sub-collection-traversal' : 'sub-collection';
  } else if (paramsHasFixtureDependencies(params)) {
    archetype = 'top-level-with-deps';
  } else {
    archetype = 'top-level-simple';
  }
  return archetype;
}

/**
 * Returns `true` when the factory's `getCollection` reads a parent fixture
 * off `params` (the canonical sub-collection signature).
 *
 * @param factory - parsed factory metadata
 * @returns `true` for sub-collection wiring
 */
function isSubCollection(factory: FactoryCall | undefined): boolean {
  if (factory === undefined) return false;
  return factory.hasParamsGetCollection || factory.hasCollectionForDocument;
}

/**
 * Returns `true` when at least one Params field's type resolves to a
 * sibling `<Prefix><X>TestContextFixture`.
 *
 * @param params - parsed Params type metadata
 * @returns `true` when the Params interface has fixture dependency edges
 */
function paramsHasFixtureDependencies(params: FixtureParamsType | undefined): boolean {
  if (params === undefined) return false;
  for (const field of params.fields) {
    if (field.fixtureModel !== undefined) return true;
  }
  return false;
}
