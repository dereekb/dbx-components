import { demoCalcomOAuthStateCoder } from './calcom.state';

const TEST_SECRET = 'a'.repeat(64);
const OTHER_SECRET = 'b'.repeat(64);
const TEST_UID = 'test-uid-1234';

describe('demoCalcomOAuthStateCoder()', () => {
  const coder = demoCalcomOAuthStateCoder({ secret: TEST_SECRET });

  it('should round trip the uid through a minted state', () => {
    const state = coder.mintState(TEST_UID);
    expect(coder.verifyState(state)?.uid).toBe(TEST_UID);
  });

  it('should produce a url-safe state', () => {
    // the state round trips through Cal.com, so it must not rely on how a third party re-encodes it
    const state = coder.mintState(TEST_UID);
    expect(state).toBe(encodeURIComponent(state));
  });

  it('should produce a different state each time', () => {
    // a fresh IV per mint, so a state is not a stable fingerprint of the user
    expect(coder.mintState(TEST_UID)).not.toBe(coder.mintState(TEST_UID));
  });

  it('should reject a missing state', () => {
    expect(coder.verifyState(undefined)).toBeUndefined();
    expect(coder.verifyState('')).toBeUndefined();
  });

  it('should reject a malformed state', () => {
    expect(coder.verifyState('not-a-real-state')).toBeUndefined();
  });

  it('should reject a tampered state', () => {
    const state = coder.mintState(TEST_UID);
    const tampered = `${state.substring(0, state.length - 2)}${state.endsWith('A') ? 'B' : 'A'}`;

    expect(coder.verifyState(tampered)).toBeUndefined();
  });

  it('should reject a state minted under a different secret', () => {
    const otherCoder = demoCalcomOAuthStateCoder({ secret: OTHER_SECRET });
    expect(coder.verifyState(otherCoder.mintState(TEST_UID))).toBeUndefined();
  });

  it('should reject an expired state', () => {
    const expiringCoder = demoCalcomOAuthStateCoder({ secret: TEST_SECRET, expiresIn: -1 });
    expect(expiringCoder.verifyState(expiringCoder.mintState(TEST_UID))).toBeUndefined();
  });
});
