import { userExternalConnectionStateCoder } from './userexternalconnection.state';

const TEST_SECRET = 'a'.repeat(64);
const OTHER_SECRET = 'b'.repeat(64);
const TEST_UID = 'test-uid-1234';
const CALCOM = 'calcom';
const ZOOM = 'zoom';

describe('userExternalConnectionStateCoder()', () => {
  const coder = userExternalConnectionStateCoder({ secret: TEST_SECRET });

  it('should round trip the uid through a minted state', () => {
    const state = coder.mintState({ uid: TEST_UID, providerType: CALCOM });
    expect(coder.verifyState({ state, providerType: CALCOM })?.uid).toBe(TEST_UID);
  });

  it('should produce a url-safe state', () => {
    // the state round trips through the provider, so it must not rely on how a third party re-encodes it
    const state = coder.mintState({ uid: TEST_UID, providerType: CALCOM });
    expect(state).toBe(encodeURIComponent(state));
  });

  it('should produce a different state each time', () => {
    // a fresh IV per mint, so a state is not a stable fingerprint of the user
    expect(coder.mintState({ uid: TEST_UID, providerType: CALCOM })).not.toBe(coder.mintState({ uid: TEST_UID, providerType: CALCOM }));
  });

  it('should reject a state minted for a different provider', () => {
    // one shared secret across providers, so the provider must be bound INTO the state
    const state = coder.mintState({ uid: TEST_UID, providerType: CALCOM });
    expect(coder.verifyState({ state, providerType: ZOOM })).toBeUndefined();
  });

  it('should reject a missing state', () => {
    expect(coder.verifyState({ state: undefined, providerType: CALCOM })).toBeUndefined();
    expect(coder.verifyState({ state: '', providerType: CALCOM })).toBeUndefined();
  });

  it('should reject a malformed state', () => {
    expect(coder.verifyState({ state: 'not-a-real-state', providerType: CALCOM })).toBeUndefined();
  });

  it('should reject a tampered state', () => {
    const state = coder.mintState({ uid: TEST_UID, providerType: CALCOM });
    const tampered = `${state.substring(0, state.length - 2)}${state.endsWith('A') ? 'B' : 'A'}`;

    expect(coder.verifyState({ state: tampered, providerType: CALCOM })).toBeUndefined();
  });

  it('should reject a state minted under a different secret', () => {
    const otherCoder = userExternalConnectionStateCoder({ secret: OTHER_SECRET });
    const state = otherCoder.mintState({ uid: TEST_UID, providerType: CALCOM });

    expect(coder.verifyState({ state, providerType: CALCOM })).toBeUndefined();
  });

  it('should reject an expired state', () => {
    const expiringCoder = userExternalConnectionStateCoder({ secret: TEST_SECRET, expiresIn: -1 });
    const state = expiringCoder.mintState({ uid: TEST_UID, providerType: CALCOM });

    expect(expiringCoder.verifyState({ state, providerType: CALCOM })).toBeUndefined();
  });
});
