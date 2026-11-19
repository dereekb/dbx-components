import { describe, expect, it } from 'vitest';
import { msGraphCliCategoriesWith, msGraphCliCategoriesWithout, planMsGraphCliMailTag } from './mail.tag';

describe('msGraphCliCategoriesWith()', () => {
  it('adds the category at the end, keeping the order', () => {
    expect(msGraphCliCategoriesWith(['Vendors', 'Red'], 'msgraph-cli: delete')).toEqual(['Vendors', 'Red', 'msgraph-cli: delete']);
    expect(msGraphCliCategoriesWith(undefined, 'x')).toEqual(['x']);
  });

  it('does not add a category already present, compared case-insensitively', () => {
    expect(msGraphCliCategoriesWith(['A', 'MSGRAPH-CLI: DELETE'], 'msgraph-cli: delete')).toEqual(['A', 'MSGRAPH-CLI: DELETE']);
  });
});

describe('msGraphCliCategoriesWithout()', () => {
  it('removes every case-insensitive match and keeps the rest in order', () => {
    expect(msGraphCliCategoriesWithout(['A', 'Tag', 'B', 'TAG'], 'tag')).toEqual(['A', 'B']);
    expect(msGraphCliCategoriesWithout(null, 'tag')).toEqual([]);
  });
});

describe('planMsGraphCliMailTag()', () => {
  const items = [
    { id: 'a', categories: [] },
    { id: 'b', categories: ['tag'] },
    { id: 'c', categories: ['Other'] }
  ];

  it('tags the untagged messages and counts the already tagged', () => {
    expect(planMsGraphCliMailTag({ mode: 'tag', name: 'Tag', items })).toEqual({
      toChange: [
        { id: 'a', categories: ['Tag'] },
        { id: 'c', categories: ['Other', 'Tag'] }
      ],
      alreadyTagged: 1,
      notTagged: 0
    });
  });

  it('untags the tagged messages and counts the rest as not tagged', () => {
    expect(planMsGraphCliMailTag({ mode: 'untag', name: 'TAG', items })).toEqual({ toChange: [{ id: 'b', categories: [] }], alreadyTagged: 0, notTagged: 2 });
  });
});
