import { describe, expect, it } from 'vitest';
import { applyTokens } from './substitute.js';

describe('applyTokens', () => {
  it('replaces every literal occurrence of each token', () => {
    const result = applyTokens('A A B', [
      { search: 'A', replace: 'x' },
      { search: 'B', replace: 'y' }
    ]);
    expect(result).toBe('x x y');
  });

  it('applies tokens in order so earlier replacements win on overlapping prefixes', () => {
    // The longer token must be listed first, else the shorter one corrupts it.
    const ordered = applyTokens('FOO_BAR FOO', [
      { search: 'FOO_BAR', replace: 'baz' },
      { search: 'FOO', replace: 'qux' }
    ]);
    expect(ordered).toBe('baz qux');

    const wrong = applyTokens('FOO_BAR FOO', [
      { search: 'FOO', replace: 'qux' },
      { search: 'FOO_BAR', replace: 'baz' }
    ]);
    expect(wrong).toBe('qux_BAR qux');
  });

  it('treats the search as a literal string, not a regex', () => {
    expect(applyTokens('a.b.c', [{ search: '.', replace: '-' }])).toBe('a-b-c');
  });

  it('deletes a token when the replacement is empty', () => {
    expect(applyTokens('xANGULAR_APP_PREFIXy', [{ search: 'ANGULAR_APP_PREFIX', replace: '' }])).toBe('xy');
  });
});
