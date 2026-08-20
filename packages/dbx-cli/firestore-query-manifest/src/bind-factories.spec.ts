import { describe, expect, it } from 'vitest';
import { bindQueryFactories } from './bind-factories.js';
import type { CollectedQueryEntry } from './types.js';

const ENTRY: CollectedQueryEntry = {
  slug: 'published-guestbooks-query',
  name: 'publishedGuestbooksQuery',
  module: 'demo-firebase',
  subpath: 'model/guestbook/guestbook.query',
  model: 'Guestbook',
  collection: 'gb',
  isNested: false,
  scope: 'COLLECTION',
  signature: 'publishedGuestbooksQuery(params: P): FirestoreQueryConstraint[]',
  params: []
};

describe('bindQueryFactories()', () => {
  it('binds an entry exported from the component barrel', () => {
    const result = bindQueryFactories({ componentRoot: '/c', entries: [ENTRY], isExported: () => true });
    expect(result.bound).toEqual([{ entry: ENTRY, bound: true }]);
    expect(result.warnings).toEqual([]);
  });

  it('still emits an unbound entry, with a [no-factory] warning', () => {
    const result = bindQueryFactories({ componentRoot: '/c', entries: [ENTRY], isExported: () => false });
    expect(result.bound).toEqual([{ entry: ENTRY, bound: false }]);
    expect(result.warnings).toEqual(['[no-factory] demo-firebase · published-guestbooks-query → publishedGuestbooksQuery not exported']);
  });

  it('looks each identifier up against the supplied component root', () => {
    const seen: unknown[] = [];
    bindQueryFactories({
      componentRoot: '/components/demo-firebase',
      entries: [ENTRY],
      isExported: (input) => {
        seen.push(input);
        return true;
      }
    });
    expect(seen).toEqual([{ packageRoot: '/components/demo-firebase', identifier: 'publishedGuestbooksQuery' }]);
  });
});
