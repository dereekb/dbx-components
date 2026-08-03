import { describe, expect, it } from 'vitest';
import { type UserExternalConnectionErrorCode } from '@dereekb/firebase';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type UserExternalConnectionCredentials } from '../userexternalconnection.private';
import { type UserExternalConnectionAccessor } from '../userexternalconnection.accessor.server';
import { type UserExternalConnectionServerActions } from '../userexternalconnection.action.server';
import { userExternalConnectionStateCoder, type UserExternalConnectionStateCoder } from './userexternalconnection.oauth.state';
import { type UserExternalConnectionOAuthServiceConfig } from './userexternalconnection.oauth.config';
import { AbstractUserExternalConnectionOAuthService, type UserExternalConnectionOAuthCallbackQueryValues, type UserExternalConnectionOAuthExchangeInput, type UserExternalConnectionOAuthState } from './userexternalconnection.oauth.service';

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

  const accessor = {
    readUserExternalConnectionCredentials: async (params: { uid: string; providerType: string }) => {
      reads.push(params);

      if (config.readFails) {
        throw new Error('read failed');
      }

      return config.stored;
    }
  } as unknown as UserExternalConnectionAccessor;

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
    readonly userExternalConnectionAccessor: UserExternalConnectionAccessor
  ) {
    super();
  }

  protected authorizeUrlForState(state: UserExternalConnectionOAuthState): WebsiteUrl {
    return `https://provider.example/authorize?state=${state}`;
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
