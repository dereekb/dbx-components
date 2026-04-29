/**
 * Archetype classifier specs.
 *
 * Table-driven cases covering each archetype with realistic factory + params
 * shapes (including HelloSubs-derived inputs).
 */

import { describe, expect, it } from 'vitest';
import { classifyFixtureArchetype } from './archetype.js';
import type { FactoryCall, FixtureParamsType } from './types.js';

interface Case {
  readonly name: string;
  readonly factory?: FactoryCall;
  readonly params?: FixtureParamsType;
  readonly expected: 'top-level-simple' | 'top-level-with-deps' | 'sub-collection' | 'sub-collection-traversal';
}

const CASES: readonly Case[] = [
  {
    name: 'top-level-simple — partial alias, no deps',
    factory: {
      factoryName: 'demoGuestbookContextFactory',
      genericArgs: [],
      hasParamsGetCollection: false,
      hasCollectionForDocument: false,
      hasInitDocument: false,
      line: 1
    },
    params: {
      name: 'DemoApiGuestbookTestContextParams',
      kind: 'alias',
      extendsPartial: false,
      aliasOfPartial: true,
      fields: [],
      line: 1
    },
    expected: 'top-level-simple'
  },
  {
    name: 'top-level-with-deps — extends Partial + sibling fixture',
    factory: {
      factoryName: 'demoProfileContextFactory',
      genericArgs: [],
      hasParamsGetCollection: false,
      hasCollectionForDocument: false,
      hasInitDocument: false,
      line: 1
    },
    params: {
      name: 'DemoApiProfileTestContextParams',
      kind: 'interface',
      extendsPartial: false,
      aliasOfPartial: false,
      fields: [{ name: 'u', typeText: 'DemoApiAuthorizedUserTestContextFixture', optional: false, fixtureModel: 'AuthorizedUser' }],
      line: 1
    },
    expected: 'top-level-with-deps'
  },
  {
    name: 'sub-collection — getCollection reads params (HelloSubs JobLocationTimesheetSummary)',
    factory: {
      factoryName: 'hellosubsJobLocationTimesheetSummaryContextFactory',
      genericArgs: [],
      hasParamsGetCollection: true,
      hasCollectionForDocument: false,
      hasInitDocument: false,
      parentFixtureFieldFromGetCollection: 'jl',
      line: 1
    },
    params: {
      name: 'HellosubsApiJobLocationTimesheetSummaryTestContextParams',
      kind: 'interface',
      extendsPartial: false,
      aliasOfPartial: false,
      fields: [{ name: 'jl', typeText: 'HellosubsApiJobLocationTestContextFixture', optional: false, fixtureModel: 'JobLocation' }],
      line: 1
    },
    expected: 'sub-collection'
  },
  {
    name: 'sub-collection-traversal — collectionForDocument also present',
    factory: {
      factoryName: 'demoGuestbookEntryContextFactory',
      genericArgs: [],
      hasParamsGetCollection: true,
      hasCollectionForDocument: true,
      hasInitDocument: true,
      parentFixtureFieldFromGetCollection: 'g',
      line: 1
    },
    params: {
      name: 'DemoApiGuestbookEntryTestContextParams',
      kind: 'interface',
      extendsPartial: true,
      aliasOfPartial: false,
      fields: [
        { name: 'init', typeText: 'boolean', optional: true },
        { name: 'u', typeText: 'DemoApiAuthorizedUserTestContextFixture', optional: false, fixtureModel: 'AuthorizedUser' },
        { name: 'g', typeText: 'DemoApiGuestbookTestContextFixture', optional: false, fixtureModel: 'Guestbook' }
      ],
      line: 1
    },
    expected: 'sub-collection-traversal'
  },
  {
    name: 'falls through to top-level-simple when factory is missing',
    expected: 'top-level-simple'
  }
];

describe('classifyFixtureArchetype', () => {
  for (const c of CASES) {
    it(c.name, () => {
      expect(classifyFixtureArchetype({ factory: c.factory, params: c.params })).toBe(c.expected);
    });
  }
});
