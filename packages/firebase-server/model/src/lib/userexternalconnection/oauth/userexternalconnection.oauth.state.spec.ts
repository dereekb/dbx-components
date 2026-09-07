import { describe, expect, it } from 'vitest';
import { type ConfigService } from '@nestjs/config';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as CALCOM, ZOOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as ZOOM } from '@dereekb/firebase';
import { generatePkceCodeChallenge, generatePkceCodeVerifier, type Maybe } from '@dereekb/util';
import { TESTING_USER_EXTERNAL_CONNECTION_STATE_SECRET, USER_EXTERNAL_CONNECTION_STATE_SECRET_CONFIG_KEY, isUserExternalConnectionSignInStateActor, type UserExternalConnectionStateActor, userExternalConnectionStateCoder, userExternalConnectionStateCoderFactory } from './userexternalconnection.oauth.state';

/**
 * Reads the uid off a verified actor, or undefined for a sign-in actor (which has none).
 *
 * A helper rather than a cast, so a spec asserting a uid cannot silently pass against a sign-in state.
 *
 * @param actor - The verified actor.
 * @returns The uid, when the actor is a connect actor.
 */
function connectUid(actor: Maybe<UserExternalConnectionStateActor>): Maybe<string> {
  return actor != null && !isUserExternalConnectionSignInStateActor(actor) ? actor.uid : undefined;
}

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
    expect(connectUid(coder.verifyState({ state, providerType: CALCOM }))).toBe(TEST_UID);
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

    expect(connectUid(userExternalConnectionStateCoder({ secret: TEST_SECRET }).verifyState({ state, providerType: CALCOM }))).toBe(TEST_UID);
  });

  it('falls back to the testing secret in a testing environment', () => {
    // an unconfigured `.env` reaches here as a `placeholder` sentinel, which would otherwise throw
    // at Nest startup because the encryption validates its key eagerly
    const coder = userExternalConnectionStateCoderFactory(makeConfigService('placeholder'), makeEnvService({ isTestingEnv: true }));
    const state = coder.mintState({ uid: TEST_UID, providerType: CALCOM });

    expect(connectUid(userExternalConnectionStateCoder({ secret: TESTING_USER_EXTERNAL_CONNECTION_STATE_SECRET }).verifyState({ state, providerType: CALCOM }))).toBe(TEST_UID);
  });

  it('throws when the secret is missing outside a testing environment', () => {
    expect(() => userExternalConnectionStateCoderFactory(makeConfigService(), makeEnvService())).toThrow();
  });

  it('throws when the secret is not 64 hex characters outside a testing environment', () => {
    expect(() => userExternalConnectionStateCoderFactory(makeConfigService('placeholder'), makeEnvService())).toThrow();
  });
});

describe('userExternalConnectionStateCoder() sign-in states', () => {
  const coder = userExternalConnectionStateCoder({ secret: TEST_SECRET });
  const CHALLENGE = 'a-client-code-challenge';

  it('should round trip the challenge through a minted sign-in state', () => {
    const state = coder.mintState({ mode: 'signin', providerType: CALCOM, challenge: CHALLENGE });
    const actor = coder.verifyState({ state, providerType: CALCOM });

    expect(isUserExternalConnectionSignInStateActor(actor)).toBe(true);
    expect(isUserExternalConnectionSignInStateActor(actor) ? actor.challenge : undefined).toBe(CHALLENGE);
  });

  it('should carry NO uid on a sign-in state', () => {
    // a sign-in has no user yet — resolving one is the callback's job, and a uid here would mean the
    // browser could nominate the account it signs in as
    const state = coder.mintState({ mode: 'signin', providerType: CALCOM, challenge: CHALLENGE });
    expect(connectUid(coder.verifyState({ state, providerType: CALCOM }))).toBeUndefined();
  });

  it('should carry the provider code verifier through the handoff', () => {
    const state = coder.mintState({ mode: 'signin', providerType: CALCOM, challenge: CHALLENGE, codeVerifier: 'provider-verifier' });
    const actor = coder.verifyState({ state, providerType: CALCOM });

    expect(actor?.codeVerifier).toBe('provider-verifier');
  });

  it('should carry the return path through the handoff', () => {
    const state = coder.mintState({ mode: 'signin', providerType: CALCOM, challenge: CHALLENGE, returnPath: '/app/home' });
    const actor = coder.verifyState({ state, providerType: CALCOM });

    expect(isUserExternalConnectionSignInStateActor(actor) ? actor.returnPath : undefined).toBe('/app/home');
  });

  it('should reject a sign-in state minted for a different provider', () => {
    const state = coder.mintState({ mode: 'signin', providerType: CALCOM, challenge: CHALLENGE });
    expect(coder.verifyState({ state, providerType: ZOOM })).toBeUndefined();
  });

  it('should reject a sign-in state carrying no challenge', () => {
    // without a challenge the ticket could be redeemed by anyone who intercepted the redirect
    const state = coder.mintState({ mode: 'signin', providerType: CALCOM, challenge: '' });
    expect(coder.verifyState({ state, providerType: CALCOM })).toBeUndefined();
  });

  it('should treat a state minted with no mode as a connect state', () => {
    // a state already in flight when sign-in mode shipped carries no `mode` and must still verify
    const legacyCoder = userExternalConnectionStateCoder({ secret: TEST_SECRET });
    const state = legacyCoder.mintState({ uid: TEST_UID, providerType: CALCOM });
    const actor = coder.verifyState({ state, providerType: CALCOM });

    expect(isUserExternalConnectionSignInStateActor(actor)).toBe(false);
    expect(connectUid(actor)).toBe(TEST_UID);
  });
});

describe('userExternalConnectionStateCoder() sign-in tickets', () => {
  const coder = userExternalConnectionStateCoder({ secret: TEST_SECRET });

  async function mintTicketForVerifier(verifier: string, customToken = 'a-custom-token') {
    const challenge = await generatePkceCodeChallenge(verifier);
    return coder.mintTicket({ customToken, challenge, uid: TEST_UID });
  }

  it('should return the custom token to the holder of the verifier', async () => {
    const verifier = generatePkceCodeVerifier();
    const ticket = await mintTicketForVerifier(verifier);

    await expect(coder.verifyTicket({ ticket, verifier })).resolves.toEqual({ customToken: 'a-custom-token', uid: TEST_UID });
  });

  it('should reject a ticket presented with the WRONG verifier', async () => {
    // the whole point: a stolen ticket is useless without the verifier that never left the browser
    const ticket = await mintTicketForVerifier(generatePkceCodeVerifier());

    await expect(coder.verifyTicket({ ticket, verifier: generatePkceCodeVerifier() })).resolves.toBeUndefined();
  });

  it('should reject a ticket presented with no verifier', async () => {
    const ticket = await mintTicketForVerifier(generatePkceCodeVerifier());

    await expect(coder.verifyTicket({ ticket, verifier: null })).resolves.toBeUndefined();
  });

  it('should reject a ticket minted under another secret', async () => {
    const otherCoder = userExternalConnectionStateCoder({ secret: OTHER_SECRET });
    const verifier = generatePkceCodeVerifier();
    const challenge = await generatePkceCodeChallenge(verifier);
    const ticket = otherCoder.mintTicket({ customToken: 'a-custom-token', challenge, uid: TEST_UID });

    await expect(coder.verifyTicket({ ticket, verifier })).resolves.toBeUndefined();
  });

  it('should reject an expired ticket', async () => {
    const expiringCoder = userExternalConnectionStateCoder({ secret: TEST_SECRET, ticketExpiresIn: -1 });
    const verifier = generatePkceCodeVerifier();
    const challenge = await generatePkceCodeChallenge(verifier);
    const ticket = expiringCoder.mintTicket({ customToken: 'a-custom-token', challenge, uid: TEST_UID });

    await expect(expiringCoder.verifyTicket({ ticket, verifier })).resolves.toBeUndefined();
  });

  it('should reject a STATE submitted where a ticket is expected', async () => {
    // both are sealed with the same secret, so the payload type tag is the only thing separating them
    const verifier = generatePkceCodeVerifier();
    const challenge = await generatePkceCodeChallenge(verifier);
    const state = coder.mintState({ mode: 'signin', providerType: CALCOM, challenge });

    await expect(coder.verifyTicket({ ticket: state, verifier })).resolves.toBeUndefined();
  });

  it('should reject a TICKET submitted where a state is expected', async () => {
    const ticket = await mintTicketForVerifier(generatePkceCodeVerifier());
    expect(coder.verifyState({ state: ticket, providerType: CALCOM })).toBeUndefined();
  });
});
