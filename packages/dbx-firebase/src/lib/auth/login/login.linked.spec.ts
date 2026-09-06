import { describe, expect, it } from 'vitest';
import { mergeDbxFirebaseLinkedLoginMethodTypes } from './login.linked';

describe('mergeDbxFirebaseLinkedLoginMethodTypes()', () => {
  it('should return the native list when there are no other sources', () => {
    expect(mergeDbxFirebaseLinkedLoginMethodTypes([['google', 'password']])).toEqual(['google', 'password']);
  });

  it('should append a source the native list cannot see', () => {
    // the whole point: a custom-token provider has NO providerData entry, so it can only ever arrive
    // from a registered source
    expect(mergeDbxFirebaseLinkedLoginMethodTypes([['google'], ['discord']])).toEqual(['google', 'discord']);
  });

  it('should dedupe a type reported by more than one source', () => {
    expect(mergeDbxFirebaseLinkedLoginMethodTypes([['google'], ['discord'], ['discord', 'zoho']])).toEqual(['google', 'discord', 'zoho']);
  });

  it('should keep the order the sources reported, native first', () => {
    // the unlink list renders in this order, so it must be the declaration order rather than sorted
    expect(mergeDbxFirebaseLinkedLoginMethodTypes([['password', 'google'], ['discord']])).toEqual(['password', 'google', 'discord']);
  });

  it('should tolerate a source with nothing to report', () => {
    expect(mergeDbxFirebaseLinkedLoginMethodTypes([['google'], null, [], undefined])).toEqual(['google']);
  });

  it('should be empty when nothing is linked', () => {
    expect(mergeDbxFirebaseLinkedLoginMethodTypes([[], []])).toEqual([]);
  });
});
