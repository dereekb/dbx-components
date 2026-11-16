import { describe, expect, it } from 'vitest';
import { type UserExternalConnectionCapability, type UserExternalConnectionErrorCode, type UserExternalConnectionScopePreset } from '@dereekb/firebase';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type UserExternalConnectionCredentials } from '../userexternalconnection.private';
import { type UserExternalConnectionAccessor } from '../userexternalconnection.accessor.service';
import { type UserExternalConnectionLinkLoginParams, type UserExternalConnectionServerActions } from '../userexternalconnection.action.server';
import { generatePkceCodeChallenge, generatePkceCodeVerifier } from '@dereekb/util';
import { type UserExternalConnectionProviderPolicyRegistry, userExternalConnectionProviderPolicyRegistry } from '../userexternalconnection.policy';
import { type ResolveUserExternalConnectionSignInInput, type UserExternalConnectionSignInResult, type UserExternalConnectionSignInService } from '../userexternalconnection.signin';
import { userExternalConnectionStateCoder, type UserExternalConnectionStateCoder } from './userexternalconnection.oauth.state';
import { type UserExternalConnectionOAuthServiceConfig } from './userexternalconnection.oauth.config';
import {
  USER_EXTERNAL_CONNECTION_OVER_GRANTED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_IDENTITY_UNAVAILABLE_ERROR_CODE,
  userExternalConnectionAlreadyExistsError,
  userExternalConnectionConnectErrorCode,
  userExternalConnectionOverGrantedError,
  userExternalConnectionSignInEmailConflictError,
  userExternalConnectionSignInErrorCode
} from '../userexternalconnection.error';
import {
  AbstractUserExternalConnectionOAuthService,
  normalizeUserExternalConnectionProviderScopes,
  USER_EXTERNAL_CONNECTION_CONNECT_ERROR_PARAM,
  USER_EXTERNAL_CONNECTION_CONNECT_ERROR_PROVIDER_PARAM,
  USER_EXTERNAL_CONNECTION_SIGN_IN_ERROR_PARAM,
  userExternalConnectionConnectFailureRedirectUrl,
  type UserExternalConnectionOAuthCallbackQueryValues,
  type UserExternalConnectionOAuthExchangeInput,
  type UserExternalConnectionOAuthAuthorizeUrlInput
} from './userexternalconnection.oauth.service';

const TEST_PROVIDER_TYPE = 'testprovider';
const TEST_UID = 'test-uid';
const TEST_STATE_SECRET = 'd'.repeat(64);

const TEST_REDIRECT_URI = 'http://localhost:9901/oauth/testprovider/callback';
const TEST_SUCCESS_URL = 'http://localhost:9010/app/settings';
const TEST_FAILURE_URL = 'http://localhost:9010/app/settings?failed=1';
const TEST_SIGN_IN_FAILURE_URL = 'http://localhost:9010/auth/login?signin=failed';

const TEST_CONFIG: UserExternalConnectionOAuthServiceConfig = {
  userExternalConnectionOAuth: {
    providerType: TEST_PROVIDER_TYPE,
    redirectUri: TEST_REDIRECT_URI,
    successUrl: TEST_SUCCESS_URL,
    failureUrl: TEST_FAILURE_URL
  }
};

const TEST_PRESET_CONFIG: UserExternalConnectionOAuthServiceConfig = {
  userExternalConnectionOAuth: {
    ...TEST_CONFIG.userExternalConnectionOAuth,
    scopePresets: [
      { key: 'read', label: 'Read', scopes: ['read'] },
      { key: 'readwrite', label: 'Read + Write', scopes: ['read', 'write'] }
    ],
    defaultScopePreset: 'read'
  }
};

interface CapturedConnect {
  readonly uid: string;
  readonly providerType: string;
  readonly credentials: UserExternalConnectionCredentials;
}

interface CapturedError {
  readonly uid: string;
  readonly providerType: string;
  readonly error?: UserExternalConnectionErrorCode | null;
}

interface CapturingServerActions {
  readonly actions: UserExternalConnectionServerActions;
  readonly accessor: UserExternalConnectionAccessor;
  readonly connects: CapturedConnect[];
  readonly links: UserExternalConnectionLinkLoginParams[];
  readonly errors: CapturedError[];
  readonly reads: { readonly uid: string; readonly providerType: string }[];
}

interface CapturingServerActionsConfig {
  /**
   * The credentials the accessor's credentials read resolves with.
   */
  readonly stored?: Maybe<UserExternalConnectionCredentials>;
  /**
   * When true, the accessor's credentials read rejects instead of resolving.
   */
  readonly readFails?: boolean;
}

/**
 * Stub actions and accessor capturing every write and read, standing in for the real Firestore-backed
 * pair.
 *
 * @param config - What the credentials read should resolve with, if anything.
 * @returns The stub actions and accessor plus the captured calls.
 */
function capturingServerActions(config: CapturingServerActionsConfig = {}): CapturingServerActions {
  const connects: CapturedConnect[] = [];
  const links: UserExternalConnectionLinkLoginParams[] = [];
  const errors: CapturedError[] = [];
  const reads: { uid: string; providerType: string }[] = [];

  const actions = {
    connectUserExternalConnection: async (params: CapturedConnect) => {
      connects.push(params);
    },
    linkUserExternalConnectionLogin: async (params: UserExternalConnectionLinkLoginParams) => {
      links.push(params);
    },
    markUserExternalConnectionError: async (params: CapturedError) => {
      errors.push(params);
    }
  } as unknown as UserExternalConnectionServerActions;

  const accessor: UserExternalConnectionAccessor = {
    accessorForUser:
      ({ uid }) =>
      (providerType) => ({
        uid,
        providerType,
        readUserExternalConnectionCredentials: async () => {
          reads.push({ uid, providerType });

          if (config.readFails) {
            throw new Error('read failed');
          }

          return config.stored;
        },
        readUserExternalConnectionForProvider: async () => ({ uid, providerType, entry: undefined, credentials: config.stored })
      })
  };

  return { actions, accessor, connects, links, errors, reads };
}

/**
 * The smallest possible concrete provider: the two abstract members and nothing else.
 *
 * No provider package is involved, so what these tests exercise is the framework's own half of the
 * handoff rather than any one adapter's.
 */
class TestUserExternalConnectionOAuthService extends AbstractUserExternalConnectionOAuthService {
  exchangeResult: UserExternalConnectionCredentials = { accessToken: 'access-token', refreshToken: 'exchanged-refresh-token', issuedAt: new Date().toISOString() };
  seenExchangeInput: Maybe<UserExternalConnectionOAuthExchangeInput>;
  seenAuthorizeInput: Maybe<UserExternalConnectionOAuthAuthorizeUrlInput>;
  override requirePkce: Maybe<boolean> = undefined;

  constructor(
    readonly config: UserExternalConnectionOAuthServiceConfig,
    readonly stateCoder: UserExternalConnectionStateCoder,
    readonly userExternalConnectionActions: UserExternalConnectionServerActions,
    readonly userExternalConnectionAccessor: UserExternalConnectionAccessor,
    override readonly userExternalConnectionSignInService?: Maybe<UserExternalConnectionSignInService>,
    override readonly userExternalConnectionProviderPolicyRegistry?: Maybe<UserExternalConnectionProviderPolicyRegistry>
  ) {
    super();
  }

  protected authorizeUrlForState(input: UserExternalConnectionOAuthAuthorizeUrlInput): WebsiteUrl {
    this.seenAuthorizeInput = input;
    return `https://provider.example/authorize?state=${input.state}`;
  }

  protected async credentialsForAuthorizationCode(input: UserExternalConnectionOAuthExchangeInput): Promise<UserExternalConnectionCredentials> {
    this.seenExchangeInput = input;
    return this.exchangeResult;
  }
}

describe('AbstractUserExternalConnectionOAuthService', () => {
  const stateCoder = userExternalConnectionStateCoder({ secret: TEST_STATE_SECRET });

  function signedState(): string {
    return stateCoder.mintState({ uid: TEST_UID, providerType: TEST_PROVIDER_TYPE });
  }

  function makeService(captured: CapturingServerActions): TestUserExternalConnectionOAuthService {
    return new TestUserExternalConnectionOAuthService(TEST_CONFIG, stateCoder, captured.actions, captured.accessor);
  }

  describe('handleCallback() refresh token retention', () => {
    it('should carry the stored refresh token forward when the exchange returned none', async () => {
      // the paired write replaces credentials wholesale, so persisting as-is would destroy a working
      // refresh token while leaving the entry "connected"
      const captured = capturingServerActions({ stored: { accessToken: 'old-access-token', refreshToken: 'stored-refresh-token', issuedAt: new Date().toISOString() } });
      const service = makeService(captured);

      service.exchangeResult = { accessToken: 'new-access-token', issuedAt: new Date().toISOString() };

      const result = await service.handleCallback({ code: 'code', state: signedState() });

      expect(result.success).toBe(true);
      expect(captured.connects).toHaveLength(1);
      expect(captured.connects[0].credentials.refreshToken).toBe('stored-refresh-token');
      expect(captured.connects[0].credentials.accessToken).toBe('new-access-token');
    });

    it('should persist as-is when the exchange returned none and nothing is stored', async () => {
      const captured = capturingServerActions({ stored: undefined });
      const service = makeService(captured);

      service.exchangeResult = { accessToken: 'new-access-token', issuedAt: new Date().toISOString() };

      const result = await service.handleCallback({ code: 'code', state: signedState() });

      expect(result.success).toBe(true);
      expect(captured.connects).toHaveLength(1);
      expect(captured.connects[0].credentials.refreshToken).toBeUndefined();
    });

    it('should never read the stored credentials when the exchange returned a refresh token', async () => {
      // the rotating-provider path: the read costs nothing because it never happens
      const captured = capturingServerActions({ stored: { accessToken: 'old-access-token', refreshToken: 'stored-refresh-token', issuedAt: new Date().toISOString() } });
      const service = makeService(captured);

      await service.handleCallback({ code: 'code', state: signedState() });

      expect(captured.reads).toHaveLength(0);
      expect(captured.connects[0].credentials.refreshToken).toBe('exchanged-refresh-token');
    });

    it('should fail the handoff when the stored credentials cannot be read', async () => {
      // failing loudly beats persisting credentials with a dropped refresh token
      const captured = capturingServerActions({ readFails: true });
      const service = makeService(captured);

      service.exchangeResult = { accessToken: 'new-access-token', issuedAt: new Date().toISOString() };

      const result = await service.handleCallback({ code: 'code', state: signedState() });

      expect(result.success).toBe(false);
      expect(result.redirectUrl).toBe(TEST_FAILURE_URL);
      expect(captured.connects).toHaveLength(0);
      expect(captured.errors).toHaveLength(1);
    });
  });

  describe('handleCallback() query pass-through', () => {
    it('should pass the raw callback query to the exchange unchanged', async () => {
      const captured = capturingServerActions();
      const service = makeService(captured);

      const query: UserExternalConnectionOAuthCallbackQueryValues = { code: 'code', state: 'state', location: 'us', 'accounts-server': 'https://accounts.zoho.com' };

      await service.handleCallback({ code: 'code', state: signedState(), query });

      expect(service.seenExchangeInput?.query).toBe(query);
      expect(service.seenExchangeInput?.redirectUri).toBe(TEST_REDIRECT_URI);
    });

    it('should leave the query undefined when the caller passed none', async () => {
      const captured = capturingServerActions();
      const service = makeService(captured);

      await service.handleCallback({ code: 'code', state: signedState() });

      expect(service.seenExchangeInput?.query).toBeUndefined();
    });
  });

  describe('authorizeUrlForRequest() PKCE', () => {
    const linkPolicy = userExternalConnectionProviderPolicyRegistry([{ providerType: TEST_PROVIDER_TYPE, unique: true, signIn: true }]);

    function makePkceService(requirePkce: boolean, policy?: UserExternalConnectionProviderPolicyRegistry): TestUserExternalConnectionOAuthService {
      const captured = capturingServerActions();
      const service = new TestUserExternalConnectionOAuthService(TEST_CONFIG, stateCoder, captured.actions, captured.accessor, undefined, policy);
      service.requirePkce = requirePkce;
      return service;
    }

    it('should re-mint a connect state with a sealed verifier and send its challenge when requirePkce is set', async () => {
      const service = makePkceService(true);
      const state = signedState();
      const url = await service.authorizeUrlForRequest({ query: { state } } as never);

      expect(url).toBeDefined();

      const input = service.seenAuthorizeInput;
      expect(input?.codeChallenge).toBeTruthy();
      expect(input?.mode).toBe('connect');
      expect(input?.state).not.toBe(state);

      const actor = stateCoder.verifyState({ state: input?.state, providerType: TEST_PROVIDER_TYPE });
      expect(actor?.mode).toBe('connect');
      expect(actor && 'uid' in actor ? actor.uid : undefined).toBe(TEST_UID);
      expect(actor?.codeVerifier).toBeTruthy();
      expect(await generatePkceCodeChallenge(actor?.codeVerifier as string)).toBe(input?.codeChallenge);
    });

    it('should re-mint a link state with a sealed verifier and send its challenge when requirePkce is set', async () => {
      const service = makePkceService(true, linkPolicy);
      const state = stateCoder.mintState({ mode: 'link', uid: TEST_UID, providerType: TEST_PROVIDER_TYPE });
      const url = await service.authorizeUrlForRequest({ query: { state } } as never);

      expect(url).toBeDefined();

      const input = service.seenAuthorizeInput;
      expect(input?.mode).toBe('link');

      const actor = stateCoder.verifyState({ state: input?.state, providerType: TEST_PROVIDER_TYPE });
      expect(actor?.mode).toBe('link');
      expect(actor && 'uid' in actor ? actor.uid : undefined).toBe(TEST_UID);
      expect(await generatePkceCodeChallenge(actor?.codeVerifier as string)).toBe(input?.codeChallenge);
    });

    it('should pass the state through unchanged and send no challenge without requirePkce', async () => {
      const service = makePkceService(false);
      const state = signedState();

      await service.authorizeUrlForRequest({ query: { state } } as never);

      expect(service.seenAuthorizeInput?.state).toBe(state);
      expect(service.seenAuthorizeInput?.codeChallenge).toBeUndefined();
    });

    it('should derive the challenge of a state that was minted with a verifier', async () => {
      // closes the latent mismatch where a verifier-bearing connect state sent no challenge while the
      // exchange still sent the verifier
      const service = makePkceService(false);
      const codeVerifier = generatePkceCodeVerifier();
      const state = stateCoder.mintState({ uid: TEST_UID, providerType: TEST_PROVIDER_TYPE, codeVerifier });

      await service.authorizeUrlForRequest({ query: { state } } as never);

      expect(service.seenAuthorizeInput?.state).toBe(state);
      expect(service.seenAuthorizeInput?.codeChallenge).toBe(await generatePkceCodeChallenge(codeVerifier));
    });

    it('should carry the scope preset forward when re-minting a connect state', async () => {
      const captured = capturingServerActions();
      const service = new TestUserExternalConnectionOAuthService(TEST_PRESET_CONFIG, stateCoder, captured.actions, captured.accessor);
      service.requirePkce = true;

      await service.authorizeUrlForRequest({ query: { state: stateCoder.mintState({ uid: TEST_UID, providerType: TEST_PROVIDER_TYPE, scopePreset: 'readwrite' }) } } as never);

      const actor = stateCoder.verifyState({ state: service.seenAuthorizeInput?.state, providerType: TEST_PROVIDER_TYPE });
      expect(actor?.codeVerifier).toBeTruthy();
      expect(actor?.mode === 'connect' ? actor.scopePreset : undefined).toBe('readwrite');
      expect(service.seenAuthorizeInput?.scopePreset?.key).toBe('readwrite');
    });

    it('should send the re-minted verifier to the exchange on the callback', async () => {
      const service = makePkceService(true);

      await service.authorizeUrlForRequest({ query: { state: signedState() } } as never);

      const remintedState = service.seenAuthorizeInput?.state;
      const actor = stateCoder.verifyState({ state: remintedState, providerType: TEST_PROVIDER_TYPE });
      const result = await service.handleCallback({ code: 'code', state: remintedState });

      expect(result.success).toBe(true);
      expect(service.seenExchangeInput?.codeVerifier).toBeTruthy();
      expect(service.seenExchangeInput?.codeVerifier).toBe(actor?.codeVerifier);
    });
  });
});

interface CapturingSignInService {
  readonly service: UserExternalConnectionSignInService;
  readonly resolved: ResolveUserExternalConnectionSignInInput[];
  readonly minted: string[];
}

/**
 * A sign-in service that resolves every identity to one uid and mints a fixed token, capturing what
 * it was asked.
 *
 * @param uid - The uid every sign-in resolves to.
 * @param customToken - The token to mint.
 * @returns The stub service plus the captured calls.
 */
function capturingSignInService(uid: string = 'signed-in-uid', customToken: string = 'a-custom-token'): CapturingSignInService {
  const resolved: ResolveUserExternalConnectionSignInInput[] = [];
  const minted: string[] = [];

  const service: UserExternalConnectionSignInService = {
    resolveSignIn: async (input) => {
      resolved.push(input);
      const result: UserExternalConnectionSignInResult = { uid, created: false };
      return result;
    },
    mintCustomTokenForUser: async (input) => {
      minted.push(input.uid);
      return customToken;
    }
  };

  return { service, resolved, minted };
}

describe('AbstractUserExternalConnectionOAuthService sign-in', () => {
  const stateCoder = userExternalConnectionStateCoder({ secret: TEST_STATE_SECRET });
  const signInPolicy = userExternalConnectionProviderPolicyRegistry([{ providerType: TEST_PROVIDER_TYPE, unique: true, signIn: true }]);

  function makeSignInService(captured: CapturingServerActions, signIn: CapturingSignInService = capturingSignInService(), policy = signInPolicy) {
    return new TestUserExternalConnectionOAuthService(TEST_CONFIG, stateCoder, captured.actions, captured.accessor, signIn.service, policy);
  }

  async function signInStateForVerifier(verifier: string, returnPath?: string): Promise<string> {
    const challenge = await generatePkceCodeChallenge(verifier);
    return stateCoder.mintState({ mode: 'signin', providerType: TEST_PROVIDER_TYPE, challenge, returnPath });
  }

  it('should link the resolved uid and redirect with a ticket', async () => {
    const captured = capturingServerActions();
    const signIn = capturingSignInService();
    const service = makeSignInService(captured, signIn);

    service.exchangeResult = { accessToken: 'access-token', refreshToken: 'refresh-token', issuedAt: new Date().toISOString(), externalAccountId: 'external-1', label: 'Someone' };

    const verifier = generatePkceCodeVerifier();
    const result = await service.handleCallback({ code: 'a-code', state: await signInStateForVerifier(verifier) });

    expect(result.success).toBe(true);
    expect(signIn.resolved[0]?.identity.externalAccountId).toBe('external-1');
    expect(signIn.minted).toEqual(['signed-in-uid']);
    // a sign-in establishes the LOGIN LINK, written from the identity it resolved against
    expect(captured.links[0]?.uid).toBe('signed-in-uid');
    expect(captured.links[0]?.identity.externalAccountId).toBe('external-1');
    // and NOT the data connection: the identity grant it carries is not the data grant
    expect(captured.connects).toHaveLength(0);
    expect(new URL(result.redirectUrl).searchParams.get('ticket')).toBeTruthy();
  });

  it('should ALSO write the data connection when the policy enables signInConnects', async () => {
    // the opt-in for an app whose sign-in scopes are a superset of its data scopes
    const captured = capturingServerActions();
    const service = makeSignInService(captured, capturingSignInService(), userExternalConnectionProviderPolicyRegistry([{ providerType: TEST_PROVIDER_TYPE, unique: true, signIn: true, signInConnects: true }]));

    service.exchangeResult = { accessToken: 'access-token', issuedAt: new Date().toISOString(), externalAccountId: 'external-1' };

    const result = await service.handleCallback({ code: 'a-code', state: await signInStateForVerifier(generatePkceCodeVerifier()) });

    expect(result.success).toBe(true);
    expect(captured.links).toHaveLength(1);
    expect(captured.connects[0]?.uid).toBe('signed-in-uid');
    // forced to describe the identity the sign-in resolved against, so the `ec` key the NEXT sign-in
    // looks up cannot disagree with the account that just signed in
    expect(captured.connects[0]?.credentials.externalAccountId).toBe('external-1');
  });

  it('should hand the ticket back only to the holder of the verifier', async () => {
    const captured = capturingServerActions();
    const service = makeSignInService(captured);

    service.exchangeResult = { accessToken: 'access-token', issuedAt: new Date().toISOString(), externalAccountId: 'external-1' };

    const verifier = generatePkceCodeVerifier();
    const { redirectUrl } = await service.handleCallback({ code: 'a-code', state: await signInStateForVerifier(verifier) });
    const ticket = new URL(redirectUrl).searchParams.get('ticket') as string;

    await expect(service.exchangeSignInTicket({ ticket, verifier })).resolves.toEqual({ customToken: 'a-custom-token' });
    await expect(service.exchangeSignInTicket({ ticket, verifier: generatePkceCodeVerifier() })).resolves.toBeUndefined();
  });

  it('should FAIL a sign-in whose identity carries no external account id', async () => {
    // with no stable id there is nothing to key the account on, and the next sign-in would not
    // recognize the same person
    const captured = capturingServerActions();
    const service = makeSignInService(captured);

    service.exchangeResult = { accessToken: 'access-token', issuedAt: new Date().toISOString() };

    const result = await service.handleCallback({ code: 'a-code', state: await signInStateForVerifier(generatePkceCodeVerifier()) });

    expect(result.success).toBe(false);
    // the configured failure url, now carrying the allowlisted reason
    const failure = new URL(result.redirectUrl);
    expect(`${failure.origin}${failure.pathname}`).toBe('http://localhost:9010/app/settings');
    expect(failure.searchParams.get(USER_EXTERNAL_CONNECTION_SIGN_IN_ERROR_PARAM)).toBe(USER_EXTERNAL_CONNECTION_SIGN_IN_IDENTITY_UNAVAILABLE_ERROR_CODE);
    expect(captured.connects).toHaveLength(0);
  });

  describe('failure redirect', () => {
    const signInFailureConfig: UserExternalConnectionOAuthServiceConfig = { userExternalConnectionOAuth: { ...TEST_CONFIG.userExternalConnectionOAuth, signInFailureUrl: TEST_SIGN_IN_FAILURE_URL } };

    function makeFailureService(captured: CapturingServerActions, signIn: Maybe<CapturingSignInService> = capturingSignInService()) {
      return new TestUserExternalConnectionOAuthService(signInFailureConfig, stateCoder, captured.actions, captured.accessor, signIn?.service, signInPolicy);
    }

    it('should send a failed SIGN-IN to the sign-in failure url with the reason code', async () => {
      // a failed sign-in leaves the browser signed out, so the auth-gated connect failure page is
      // the wrong place to explain it
      const captured = capturingServerActions();
      const service = makeFailureService(captured);

      service.exchangeResult = { accessToken: 'access-token', issuedAt: new Date().toISOString() };

      const { success, redirectUrl } = await service.handleCallback({ code: 'a-code', state: await signInStateForVerifier(generatePkceCodeVerifier()) });
      const url = new URL(redirectUrl);

      expect(success).toBe(false);
      expect(url.pathname).toBe('/auth/login');
      expect(url.searchParams.get('signin')).toBe('failed');
      expect(url.searchParams.get(USER_EXTERNAL_CONNECTION_SIGN_IN_ERROR_PARAM)).toBe(USER_EXTERNAL_CONNECTION_SIGN_IN_IDENTITY_UNAVAILABLE_ERROR_CODE);
    });

    it('should report the EMAIL CONFLICT reason the sign-in service raised', async () => {
      const captured = capturingServerActions();
      const rejecting = capturingSignInService();
      const service = makeFailureService(captured, {
        ...rejecting,
        service: {
          ...rejecting.service,
          resolveSignIn: async () => {
            throw userExternalConnectionSignInEmailConflictError(TEST_PROVIDER_TYPE);
          }
        }
      });

      service.exchangeResult = { accessToken: 'access-token', issuedAt: new Date().toISOString(), externalAccountId: 'external-1' };

      const { redirectUrl } = await service.handleCallback({ code: 'a-code', state: await signInStateForVerifier(generatePkceCodeVerifier()) });

      expect(new URL(redirectUrl).searchParams.get(USER_EXTERNAL_CONNECTION_SIGN_IN_ERROR_PARAM)).toBe(USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE);
    });

    it('should attach NO reason for a failure that is not on the allowlist', async () => {
      // the allowlist is what keeps an internal failure's shape out of a url the user can read
      const captured = capturingServerActions();
      const rejecting = capturingSignInService();
      const service = makeFailureService(captured, {
        ...rejecting,
        service: {
          ...rejecting.service,
          resolveSignIn: async () => {
            throw new Error('an internal detail nobody should see');
          }
        }
      });

      service.exchangeResult = { accessToken: 'access-token', issuedAt: new Date().toISOString(), externalAccountId: 'external-1' };

      const { redirectUrl } = await service.handleCallback({ code: 'a-code', state: await signInStateForVerifier(generatePkceCodeVerifier()) });
      const url = new URL(redirectUrl);

      expect(url.pathname).toBe('/auth/login');
      expect(url.searchParams.get(USER_EXTERNAL_CONNECTION_SIGN_IN_ERROR_PARAM)).toBeNull();
      expect(redirectUrl).not.toContain('internal detail');
    });

    it('should leave a failed CONNECT on the connect failure url', async () => {
      const captured = capturingServerActions({ readFails: true });
      const service = makeFailureService(captured);

      service.exchangeResult = { accessToken: 'new-access-token', issuedAt: new Date().toISOString() };

      const { redirectUrl } = await service.handleCallback({ code: 'code', state: stateCoder.mintState({ uid: TEST_UID, providerType: TEST_PROVIDER_TYPE }) });

      expect(redirectUrl).toBe(TEST_FAILURE_URL);
    });
  });

  describe('userExternalConnectionSignInErrorCode()', () => {
    it('should read an allowlisted code off the thrown error', () => {
      expect(userExternalConnectionSignInErrorCode(userExternalConnectionSignInEmailConflictError(TEST_PROVIDER_TYPE))).toBe(USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE);
    });

    it('should refuse a code that is not on the allowlist', () => {
      // an off-list code is a code the browser was never meant to see
      expect(userExternalConnectionSignInErrorCode(userExternalConnectionAlreadyExistsError(TEST_UID))).toBeUndefined();
    });

    it('should return nothing for a plain error', () => {
      expect(userExternalConnectionSignInErrorCode(new Error('boom'))).toBeUndefined();
      expect(userExternalConnectionSignInErrorCode(undefined)).toBeUndefined();
    });
  });

  it('should NOT mark a connection error for a failed sign-in', async () => {
    // a denied sign-in has no uid at all — there is nothing to mark, and marking would need one
    const captured = capturingServerActions();
    const service = makeSignInService(captured);

    service.exchangeResult = { accessToken: 'access-token', issuedAt: new Date().toISOString() };
    await service.handleCallback({ code: 'a-code', state: await signInStateForVerifier(generatePkceCodeVerifier()) });

    expect(captured.errors).toHaveLength(0);
  });

  it('should refuse a sign-in when the policy has not enabled it', async () => {
    const captured = capturingServerActions();
    const service = makeSignInService(captured, capturingSignInService(), userExternalConnectionProviderPolicyRegistry([]));

    service.exchangeResult = { accessToken: 'access-token', issuedAt: new Date().toISOString(), externalAccountId: 'external-1' };

    const result = await service.handleCallback({ code: 'a-code', state: await signInStateForVerifier(generatePkceCodeVerifier()) });

    expect(result.success).toBe(false);
    expect(captured.connects).toHaveLength(0);
  });

  it('should refuse a ticket exchange when the policy has not enabled sign-in', async () => {
    const captured = capturingServerActions();
    const enabled = makeSignInService(captured);
    enabled.exchangeResult = { accessToken: 'access-token', issuedAt: new Date().toISOString(), externalAccountId: 'external-1' };

    const verifier = generatePkceCodeVerifier();
    const { redirectUrl } = await enabled.handleCallback({ code: 'a-code', state: await signInStateForVerifier(verifier) });
    const ticket = new URL(redirectUrl).searchParams.get('ticket') as string;

    const disabled = makeSignInService(capturingServerActions(), capturingSignInService(), userExternalConnectionProviderPolicyRegistry([]));
    await expect(disabled.exchangeSignInTicket({ ticket, verifier })).resolves.toBeUndefined();
  });

  it('should send the provider code verifier from the state to the exchange', async () => {
    const captured = capturingServerActions();
    const service = makeSignInService(captured);

    service.exchangeResult = { accessToken: 'access-token', issuedAt: new Date().toISOString(), externalAccountId: 'external-1' };

    const challenge = await generatePkceCodeChallenge(generatePkceCodeVerifier());
    const state = stateCoder.mintState({ mode: 'signin', providerType: TEST_PROVIDER_TYPE, challenge, codeVerifier: 'provider-verifier' });

    await service.handleCallback({ code: 'a-code', state });

    expect(service.seenExchangeInput?.codeVerifier).toBe('provider-verifier');
  });

  it('should honor an allowlisted return path in the redirect', async () => {
    const captured = capturingServerActions();
    const service = new TestUserExternalConnectionOAuthService({ userExternalConnectionOAuth: { ...TEST_CONFIG.userExternalConnectionOAuth, allowedReturnPaths: ['/app/home'] } }, stateCoder, captured.actions, captured.accessor, capturingSignInService().service, signInPolicy);

    service.exchangeResult = { accessToken: 'access-token', issuedAt: new Date().toISOString(), externalAccountId: 'external-1' };

    const { redirectUrl } = await service.handleCallback({ code: 'a-code', state: await signInStateForVerifier(generatePkceCodeVerifier(), '/app/home') });

    expect(new URL(redirectUrl).pathname).toBe('/app/home');
  });

  it('should refuse sign-in entirely when no sign-in service is registered', async () => {
    // a policy that says yes with nothing able to resolve a uid must fail at the front door
    const captured = capturingServerActions();
    const service = new TestUserExternalConnectionOAuthService(TEST_CONFIG, stateCoder, captured.actions, captured.accessor, null, signInPolicy);

    expect(service.signInEnabled).toBe(false);

    service.exchangeResult = { accessToken: 'access-token', issuedAt: new Date().toISOString(), externalAccountId: 'external-1' };
    const result = await service.handleCallback({ code: 'a-code', state: await signInStateForVerifier(generatePkceCodeVerifier()) });

    expect(result.success).toBe(false);
  });
});

describe('AbstractUserExternalConnectionOAuthService scope presets', () => {
  const stateCoder = userExternalConnectionStateCoder({ secret: TEST_STATE_SECRET });

  function makePresetService(config: UserExternalConnectionOAuthServiceConfig = TEST_PRESET_CONFIG): TestUserExternalConnectionOAuthService {
    const captured = capturingServerActions();
    return new TestUserExternalConnectionOAuthService(config, stateCoder, captured.actions, captured.accessor, undefined, userExternalConnectionProviderPolicyRegistry([{ providerType: TEST_PROVIDER_TYPE, unique: true, signIn: true }]));
  }

  it('should expose the configured presets and look them up by key', () => {
    const service = makePresetService();
    expect(service.scopePresets.map((x) => x.key)).toEqual(['read', 'readwrite']);
    expect(service.scopePresetForKey('readwrite')?.label).toBe('Read + Write');
    expect(service.scopePresetForKey('admin')).toBeUndefined();
    expect(service.scopePresetForKey(undefined)).toBeUndefined();
    expect(service.defaultScopePreset?.key).toBe('read');
  });

  it('should pass the preset the state names to the adapter', async () => {
    const service = makePresetService();
    await service.authorizeUrlForRequest({ query: { state: stateCoder.mintState({ uid: TEST_UID, providerType: TEST_PROVIDER_TYPE, scopePreset: 'readwrite' }) } } as never);
    expect(service.seenAuthorizeInput?.scopePreset?.key).toBe('readwrite');
  });

  it('should fall back to the default preset when the state names none', async () => {
    const service = makePresetService();
    await service.authorizeUrlForRequest({ query: { state: stateCoder.mintState({ uid: TEST_UID, providerType: TEST_PROVIDER_TYPE }) } } as never);
    expect(service.seenAuthorizeInput?.scopePreset?.key).toBe('read');
  });

  it('should pass no preset when the state names none and there is no default', async () => {
    const service = makePresetService({ userExternalConnectionOAuth: { ...TEST_PRESET_CONFIG.userExternalConnectionOAuth, defaultScopePreset: undefined } });
    await service.authorizeUrlForRequest({ query: { state: stateCoder.mintState({ uid: TEST_UID, providerType: TEST_PROVIDER_TYPE }) } } as never);
    expect(service.seenAuthorizeInput).toBeDefined();
    expect(service.seenAuthorizeInput?.scopePreset).toBeUndefined();
  });

  it('should refuse a state naming an unknown preset', async () => {
    const service = makePresetService();
    const url = await service.authorizeUrlForRequest({ query: { state: stateCoder.mintState({ uid: TEST_UID, providerType: TEST_PROVIDER_TYPE, scopePreset: 'admin' }) } } as never);
    expect(url).toBeUndefined();
    expect(service.seenAuthorizeInput).toBeUndefined();
  });

  it('should pass no preset for a link state', async () => {
    const service = makePresetService();
    await service.authorizeUrlForRequest({ query: { state: stateCoder.mintState({ mode: 'link', uid: TEST_UID, providerType: TEST_PROVIDER_TYPE }) } } as never);
    expect(service.seenAuthorizeInput?.mode).toBe('link');
    expect(service.seenAuthorizeInput?.scopePreset).toBeUndefined();
  });
});

describe('AbstractUserExternalConnectionOAuthService over-grant', () => {
  const stateCoder = userExternalConnectionStateCoder({ secret: TEST_STATE_SECRET });

  interface OverGrantServiceConfig {
    readonly config?: UserExternalConnectionOAuthServiceConfig;
    readonly policyRegistry?: Maybe<UserExternalConnectionProviderPolicyRegistry>;
  }

  function makeOverGrantService(captured: CapturingServerActions, input: OverGrantServiceConfig = {}): TestUserExternalConnectionOAuthService {
    return new TestUserExternalConnectionOAuthService(input.config ?? TEST_PRESET_CONFIG, stateCoder, captured.actions, captured.accessor, undefined, input.policyRegistry);
  }

  function connectState(scopePreset?: string): string {
    return stateCoder.mintState({ uid: TEST_UID, providerType: TEST_PROVIDER_TYPE, scopePreset });
  }

  function grant(scopes: Maybe<UserExternalConnectionCapability[]>): UserExternalConnectionCredentials {
    return { accessToken: 'access-token', refreshToken: 'exchanged-refresh-token', issuedAt: new Date().toISOString(), scopes };
  }

  it('should refuse a connect whose grant is wider than the preset, writing nothing', async () => {
    const captured = capturingServerActions();
    const service = makeOverGrantService(captured);
    service.exchangeResult = grant(['read', 'write']);

    const result = await service.handleCallback({ code: 'code', state: connectState('read') });
    const url = new URL(result.redirectUrl);

    expect(result.success).toBe(false);
    expect(url.searchParams.get(USER_EXTERNAL_CONNECTION_CONNECT_ERROR_PARAM)).toBe(USER_EXTERNAL_CONNECTION_OVER_GRANTED_ERROR_CODE);
    expect(url.searchParams.get(USER_EXTERNAL_CONNECTION_CONNECT_ERROR_PROVIDER_PARAM)).toBe(TEST_PROVIDER_TYPE);
    expect(url.searchParams.get('failed')).toBe('1'); // keeps the failure url's own query
    expect(captured.connects).toHaveLength(0);
    expect(captured.errors).toHaveLength(0); // a refusal never marks a (possibly working) connection
    expect(captured.reads).toHaveLength(0); // refused before the refresh-token carry-forward read
  });

  it('should check the default preset when the state named none', async () => {
    const captured = capturingServerActions();
    const service = makeOverGrantService(captured);
    service.exchangeResult = grant(['read', 'write']);

    const result = await service.handleCallback({ code: 'code', state: connectState() });

    expect(result.success).toBe(false);
    expect(captured.connects).toHaveLength(0);
  });

  it("should store the wider grant when the policy's onOverGrant is allow", async () => {
    const captured = capturingServerActions();
    const service = makeOverGrantService(captured, { policyRegistry: userExternalConnectionProviderPolicyRegistry([{ providerType: TEST_PROVIDER_TYPE, onOverGrant: 'allow' }]) });
    service.exchangeResult = grant(['read', 'write']);

    const result = await service.handleCallback({ code: 'code', state: connectState('read') });

    expect(result.success).toBe(true);
    expect(captured.connects[0].credentials.scopes).toEqual(['read', 'write']);
  });

  it('should connect a grant equal to the preset', async () => {
    const captured = capturingServerActions();
    const service = makeOverGrantService(captured);
    service.exchangeResult = grant(['read', 'write']);

    const result = await service.handleCallback({ code: 'code', state: connectState('readwrite') });

    expect(result.success).toBe(true);
    expect(captured.connects).toHaveLength(1);
  });

  it('should accept an under-grant', async () => {
    const captured = capturingServerActions();
    const service = makeOverGrantService(captured);
    service.exchangeResult = grant(['read']);

    const result = await service.handleCallback({ code: 'code', state: connectState('readwrite') });

    expect(result.success).toBe(true);
    expect(captured.connects[0].credentials.scopes).toEqual(['read']);
  });

  it('should connect an exchange that reported no scopes', async () => {
    for (const scopes of [undefined, []]) {
      const captured = capturingServerActions();
      const service = makeOverGrantService(captured);
      service.exchangeResult = grant(scopes);

      const result = await service.handleCallback({ code: 'code', state: connectState('read') });

      expect(result.success).toBe(true);
      expect(captured.connects).toHaveLength(1);
    }
  });

  it('should not check a provider with no presets', async () => {
    const captured = capturingServerActions();
    const service = makeOverGrantService(captured, { config: TEST_CONFIG });
    service.exchangeResult = grant(['read', 'write', 'admin']);

    const result = await service.handleCallback({ code: 'code', state: connectState() });

    expect(result.success).toBe(true);
  });

  it("should compare through the provider's normalizeScopes on both sides", async () => {
    class NormalizingService extends TestUserExternalConnectionOAuthService {
      override normalizeScopes(scopes: readonly UserExternalConnectionCapability[]): UserExternalConnectionCapability[] {
        return scopes.map((x) => x.toLowerCase());
      }
    }

    const captured = capturingServerActions();
    const service = new NormalizingService(TEST_PRESET_CONFIG, stateCoder, captured.actions, captured.accessor);
    service.exchangeResult = grant(['READ']);

    const result = await service.handleCallback({ code: 'code', state: connectState('read') });

    expect(result.success).toBe(true);
  });

  it('should check against an overridden requestedScopesForScopePreset() even without presets', async () => {
    class RequestingService extends TestUserExternalConnectionOAuthService {
      override requestedScopesForScopePreset(_scopePreset: Maybe<UserExternalConnectionScopePreset>): Maybe<readonly UserExternalConnectionCapability[]> {
        return ['read'];
      }
    }

    const captured = capturingServerActions();
    const service = new RequestingService(TEST_CONFIG, stateCoder, captured.actions, captured.accessor);
    service.exchangeResult = grant(['read', 'write']);

    const result = await service.handleCallback({ code: 'code', state: connectState() });

    expect(result.success).toBe(false);
    expect(captured.connects).toHaveLength(0);
    expect(captured.errors).toHaveLength(0);
  });

  it('should still mark any other connect failure and redirect to the bare failure url', async () => {
    const captured = capturingServerActions({ readFails: true });
    const service = makeOverGrantService(captured);
    service.exchangeResult = { accessToken: 'access-token', issuedAt: new Date().toISOString(), scopes: ['read'] };

    const result = await service.handleCallback({ code: 'code', state: connectState('read') });

    expect(result.success).toBe(false);
    expect(result.redirectUrl).toBe(TEST_FAILURE_URL);
    expect(captured.errors).toHaveLength(1);
  });

  describe('userExternalConnectionConnectFailureRedirectUrl()', () => {
    it('should add the code and provider while keeping the base query', () => {
      const url = new URL(userExternalConnectionConnectFailureRedirectUrl({ baseUrl: TEST_FAILURE_URL, providerType: TEST_PROVIDER_TYPE, errorCode: USER_EXTERNAL_CONNECTION_OVER_GRANTED_ERROR_CODE }));

      expect(url.searchParams.get('failed')).toBe('1');
      expect(url.searchParams.get(USER_EXTERNAL_CONNECTION_CONNECT_ERROR_PARAM)).toBe(USER_EXTERNAL_CONNECTION_OVER_GRANTED_ERROR_CODE);
      expect(url.searchParams.get(USER_EXTERNAL_CONNECTION_CONNECT_ERROR_PROVIDER_PARAM)).toBe(TEST_PROVIDER_TYPE);
    });

    it('should return the base url unchanged without a code', () => {
      expect(userExternalConnectionConnectFailureRedirectUrl({ baseUrl: TEST_FAILURE_URL, providerType: TEST_PROVIDER_TYPE })).toBe(TEST_FAILURE_URL);
    });
  });

  describe('userExternalConnectionConnectErrorCode()', () => {
    it('should read the over-granted code', () => {
      const error = userExternalConnectionOverGrantedError({ providerType: TEST_PROVIDER_TYPE, requestedScopes: ['read'], grantedScopes: ['read', 'write'], extraScopes: ['write'] });
      expect(userExternalConnectionConnectErrorCode(error)).toBe(USER_EXTERNAL_CONNECTION_OVER_GRANTED_ERROR_CODE);
    });

    it('should not report a code outside the allowlist', () => {
      expect(userExternalConnectionConnectErrorCode(userExternalConnectionSignInEmailConflictError(TEST_PROVIDER_TYPE))).toBeUndefined();
      expect(userExternalConnectionConnectErrorCode(new Error('internal detail'))).toBeUndefined();
    });
  });

  describe('normalizeUserExternalConnectionProviderScopes()', () => {
    it('should pass the scopes through, deduped, without a service', () => {
      expect(normalizeUserExternalConnectionProviderScopes(undefined, ['read', 'write', 'read'])).toEqual(['read', 'write']);
    });
  });
});
