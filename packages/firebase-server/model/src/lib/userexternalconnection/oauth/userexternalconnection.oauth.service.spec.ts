import { describe, expect, it } from 'vitest';
import { type UserExternalConnectionErrorCode } from '@dereekb/firebase';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type UserExternalConnectionCredentials } from '../userexternalconnection.private';
import { type UserExternalConnectionAccessor } from '../userexternalconnection.accessor.service';
import { type UserExternalConnectionServerActions } from '../userexternalconnection.action.server';
import { generatePkceCodeChallenge, generatePkceCodeVerifier } from '@dereekb/util';
import { type UserExternalConnectionProviderPolicyRegistry, userExternalConnectionProviderPolicyRegistry } from '../userexternalconnection.policy';
import { type ResolveUserExternalConnectionSignInInput, type UserExternalConnectionSignInResult, type UserExternalConnectionSignInService } from '../userexternalconnection.signin';
import { userExternalConnectionStateCoder, type UserExternalConnectionStateCoder } from './userexternalconnection.oauth.state';
import { type UserExternalConnectionOAuthServiceConfig } from './userexternalconnection.oauth.config';
import { AbstractUserExternalConnectionOAuthService, type UserExternalConnectionOAuthCallbackQueryValues, type UserExternalConnectionOAuthExchangeInput, type UserExternalConnectionOAuthAuthorizeUrlInput } from './userexternalconnection.oauth.service';

const TEST_PROVIDER_TYPE = 'testprovider';
const TEST_UID = 'test-uid';
const TEST_STATE_SECRET = 'd'.repeat(64);

const TEST_REDIRECT_URI = 'http://localhost:9901/oauth/testprovider/callback';
const TEST_SUCCESS_URL = 'http://localhost:9010/app/settings';
const TEST_FAILURE_URL = 'http://localhost:9010/app/settings?failed=1';

const TEST_CONFIG: UserExternalConnectionOAuthServiceConfig = {
  userExternalConnectionOAuth: {
    providerType: TEST_PROVIDER_TYPE,
    redirectUri: TEST_REDIRECT_URI,
    successUrl: TEST_SUCCESS_URL,
    failureUrl: TEST_FAILURE_URL
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
  const errors: CapturedError[] = [];
  const reads: { uid: string; providerType: string }[] = [];

  const actions = {
    connectUserExternalConnection: async (params: CapturedConnect) => {
      connects.push(params);
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

  return { actions, accessor, connects, errors, reads };
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

  it('should connect the resolved uid and redirect with a ticket', async () => {
    const captured = capturingServerActions();
    const signIn = capturingSignInService();
    const service = makeSignInService(captured, signIn);

    service.exchangeResult = { accessToken: 'access-token', refreshToken: 'refresh-token', issuedAt: new Date().toISOString(), externalAccountId: 'external-1', label: 'Someone' };

    const verifier = generatePkceCodeVerifier();
    const result = await service.handleCallback({ code: 'a-code', state: await signInStateForVerifier(verifier) });

    expect(result.success).toBe(true);
    expect(signIn.resolved[0]?.identity.externalAccountId).toBe('external-1');
    expect(signIn.minted).toEqual(['signed-in-uid']);
    // the same paired write a connect uses — a user who signed in through a provider IS connected to it
    expect(captured.connects[0]?.uid).toBe('signed-in-uid');
    expect(new URL(result.redirectUrl).searchParams.get('ticket')).toBeTruthy();
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
    expect(result.redirectUrl).toBe(TEST_FAILURE_URL);
    expect(captured.connects).toHaveLength(0);
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
