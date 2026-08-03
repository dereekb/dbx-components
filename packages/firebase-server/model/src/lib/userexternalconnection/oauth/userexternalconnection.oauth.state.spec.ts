import { describe, expect, it } from 'vitest';
import { type ConfigService } from '@nestjs/config';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as CALCOM, ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as ZOOM } from '@dereekb/firebase';
import { TESTING_USER_EXTERNAL_CONNECTION_STATE_SECRET, USER_EXTERNAL_CONNECTION_STATE_SECRET_CONFIG_KEY, userExternalConnectionStateCoder, userExternalConnectionStateCoderFactory } from './userexternalconnection.oauth.state';

const TEST_SECRET = 'a'.repeat(64);
const OTHER_SECRET = 'b'.repeat(64);
const TEST_UID = 'test-uid-1234';

function makeConfigService(value?: string): ConfigService {
  return {
    get: (key: string) => (key === USER_EXTERNAL_CONNECTION_STATE_SECRET_CONFIG_KEY ? value : undefined)
  } as unknown as ConfigService;
}

function makeEnvService(overrides: Partial<FirebaseServerEnvService> = {}): FirebaseServerEnvService {
  return {
    isProduction: true,
    isStaging: false,
    isTestingEnv: false,
    ...overrides
  } as unknown as FirebaseServerEnvService;
}

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

describe('userExternalConnectionStateCoderFactory()', () => {
  it('uses the configured secret', () => {
    const coder = userExternalConnectionStateCoderFactory(makeConfigService(TEST_SECRET), makeEnvService());
    const state = coder.mintState({ uid: TEST_UID, providerType: CALCOM });

    expect(userExternalConnectionStateCoder({ secret: TEST_SECRET }).verifyState({ state, providerType: CALCOM })?.uid).toBe(TEST_UID);
  });

  it('falls back to the testing secret in a testing environment', () => {
    // an unconfigured `.env` reaches here as a `placeholder` sentinel, which would otherwise throw
    // at Nest startup because the encryption validates its key eagerly
    const coder = userExternalConnectionStateCoderFactory(makeConfigService('placeholder'), makeEnvService({ isTestingEnv: true }));
    const state = coder.mintState({ uid: TEST_UID, providerType: CALCOM });

    expect(userExternalConnectionStateCoder({ secret: TESTING_USER_EXTERNAL_CONNECTION_STATE_SECRET }).verifyState({ state, providerType: CALCOM })?.uid).toBe(TEST_UID);
  });

  it('throws when the secret is missing outside a testing environment', () => {
    expect(() => userExternalConnectionStateCoderFactory(makeConfigService(), makeEnvService())).toThrow();
  });

  it('throws when the secret is not 64 hex characters outside a testing environment', () => {
    expect(() => userExternalConnectionStateCoderFactory(makeConfigService('placeholder'), makeEnvService())).toThrow();
  });
});
