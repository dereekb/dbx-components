import { describe, expect, it } from 'vitest';
import { DOCS_API_READ_PATH, DOCS_API_SEARCH_PATH, docsApiReadPath, docsApiSearchPath } from './docs.api';

describe('docsApiSearchPath()', () => {
  it('should encode the query', () => {
    const path = docsApiSearchPath({ query: 'guestbook signing & more' });
    expect(path.startsWith(`${DOCS_API_SEARCH_PATH}?`)).toBe(true);
    expect(new URLSearchParams(path.split('?')[1]).get('q')).toBe('guestbook signing & more');
  });

  it('should omit a null limit', () => {
    expect(docsApiSearchPath({ query: 'a', limit: null })).toBe('/docs/search?q=a');
    expect(docsApiSearchPath({ query: 'a' })).toBe('/docs/search?q=a');
  });

  it('should include a limit', () => {
    expect(docsApiSearchPath({ query: 'a', limit: 3 })).toBe('/docs/search?q=a&limit=3');
  });
});

describe('docsApiReadPath()', () => {
  it('should encode an id that contains a slash', () => {
    expect(docsApiReadPath({ id: 'guestbook/signing' })).toBe(`${DOCS_API_READ_PATH}?id=guestbook%2Fsigning`);
  });

  it('should omit an empty or null section', () => {
    expect(docsApiReadPath({ id: 'a', section: '' })).toBe('/docs/read?id=a');
    expect(docsApiReadPath({ id: 'a', section: null })).toBe('/docs/read?id=a');
  });

  it('should include a section', () => {
    expect(docsApiReadPath({ id: 'notification/types', section: 'calendar-event-invite-calinv' })).toBe('/docs/read?id=notification%2Ftypes&section=calendar-event-invite-calinv');
  });
});
