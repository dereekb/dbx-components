import { CALCOM_OAUTH_INVALID_GRANT_ERROR_CODE, CalcomOAuthAccessTokenError, CalcomOAuthAuthFailureError, CalcomServerError, CalcomServerFetchResponseError } from '@dereekb/calcom';
import { CalcomApi, CalcomOAuthApi, type CalcomOAuthServiceConfig, type CalcomServiceConfig, memoryCalcomOAuthAccessTokenCacheService } from '@dereekb/calcom/nestjs';
import { CALCOM_USER_EXTERNAL_CONNECTION_PROVIDER_TYPE as CALCOM, type UserExternalConnectionEntry, type UserExternalConnectionErrorCode } from '@dereekb/firebase';
import { USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE, USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE, type UserExternalConnectionAccessor, type UserExternalConnectionCredentials, type UserExternalConnectionCredentialsAndFailureWriter } from '@dereekb/firebase-server/model';
import { userExternalConnectionCalcomUserContextService, userExternalConnectionErrorCodeFromCalcomError } from '@dereekb/firebase-server/calcom';
import { type Maybe } from '@dereekb/util';
import { FetchResponseError, type ConfiguredFetch } from '@dereekb/util/fetch';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoUserExternalConnectionContext, demoUserExternalConnectionTestCredentials } from '../../../test/fixture';

const STUB_UID = 'test-uid';

/**
 * An OAuth client the stubbed tests below never authenticate with.
 *
 * The app's REAL Cal.com configuration is exercised further down, through the service the app
 * provides. This one exists only so a `CalcomApi` can be constructed around a fetch that fails.
 */
const stubOAuthServiceConfig: CalcomOAuthServiceConfig = {
  calcomOAuth: {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret'
  }
};

/**
 * Builds a fetch response error the way a non-ok Cal.com response would.
 *
 * @param status - The HTTP status the response carried.
 * @returns The equivalent FetchResponseError.
 */
function fetchResponseError(status: number): FetchResponseError {
  return new FetchResponseError(new Response(null, { status }));
}

/**
 * Builds the error Cal.com's API error parser produces for a response body it could read.
 *
 * @param status - The HTTP status the response carried.
 * @returns The equivalent CalcomServerFetchResponseError.
 */
function calcomServerFetchResponseError(status: number): CalcomServerFetchResponseError {
  return new CalcomServerFetchResponseError({ code: status, message: `status ${status}` }, fetchResponseError(status));
}

function makeStubEntry(overrides?: Partial<UserExternalConnectionEntry>): UserExternalConnectionEntry {
  return {
    st: 'connected',
    uat: new Date('2026-03-01T00:00:00.000Z'),
    ...overrides
  };
}

interface CapturedError {
  readonly uid: string;
  readonly providerType: string;
  readonly error?: Maybe<UserExternalConnectionErrorCode>;
}

interface StubbedConnection {
  readonly entry?: Maybe<UserExternalConnectionEntry>;
  readonly credentials?: Maybe<UserExternalConnectionCredentials>;
}

/**
 * Assembles the service over a stubbed connection and a Cal.com API whose every request fails.
 *
 * The ONE thing that cannot be real in a test is the provider answering, so the fetch is overridden at
 * the factory level rather than stubbed at the API surface — the request still travels through
 * Cal.com's own error handling, and the service sees exactly the error a live rejection would raise.
 * Nothing here reaches the network, and no access token is ever resolved: the override replaces the
 * fetch whose header factory would have asked for one.
 *
 * @param stored - The connection state the accessor reports.
 * @param failWith - The error every request rejects with.
 * @returns The service and the errors it recorded on the connection.
 */
function makeStubbedService(stored: StubbedConnection, failWith?: Maybe<unknown>) {
  const errors: CapturedError[] = [];

  const accessor: UserExternalConnectionAccessor = {
    accessorForUser:
      ({ uid }) =>
      (providerType) => ({
        uid,
        providerType,
        readUserExternalConnectionCredentials: async () => stored.credentials,
        readUserExternalConnectionForProvider: async () => ({ uid, providerType, entry: stored.entry, credentials: stored.credentials })
      })
  };

  const actions: UserExternalConnectionCredentialsAndFailureWriter = {
    refreshUserExternalConnectionCredentials: async () => undefined,
    markUserExternalConnectionError: async (params) => {
      errors.push(params);
    }
  };

  const failingFetch: ConfiguredFetch = async () => {
    if (failWith != null) {
      throw failWith;
    }

    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const calcomOAuthApi = new CalcomOAuthApi(stubOAuthServiceConfig, memoryCalcomOAuthAccessTokenCacheService());
  const calcomServiceConfig: CalcomServiceConfig = {
    calcom: {},
    factoryConfig: {
      oauthContext: calcomOAuthApi.oauthContext,
      fetchFactory: () => failingFetch
    }
  };

  const calcomApi = new CalcomApi(calcomServiceConfig, calcomOAuthApi);

  return { service: userExternalConnectionCalcomUserContextService({ calcomApi, accessor, actions }), errors };
}

/**
 * Runs a call expected to reject and returns the error code it carried.
 *
 * @param fn - The call expected to reject.
 * @returns The error's code, or undefined when it carried none.
 */
async function errorCodeFor(fn: () => Promise<unknown>): Promise<Maybe<string>> {
  let code: Maybe<string>;

  try {
    await fn();
    throw new Error('expected the call to reject, but it resolved');
  } catch (e) {
    code = (e as { details?: { code?: string } }).details?.code;
  }

  return code;
}

describe('userExternalConnectionErrorCodeFromCalcomError()', () => {
  it('should record a refused refresh token as expired', () => {
    // `invalid_grant` cannot tell a revoked grant from an already-spent refresh token, so claiming the
    // user revoked access would send the UI down the wrong path
    expect(userExternalConnectionErrorCodeFromCalcomError(new CalcomOAuthAccessTokenError(CALCOM_OAUTH_INVALID_GRANT_ERROR_CODE))).toBe('expired');
  });

  it('should record a failure to produce an access token as unauthorized', () => {
    expect(userExternalConnectionErrorCodeFromCalcomError(new CalcomOAuthAuthFailureError('Token Refresh Failed'))).toBe('unauthorized');
  });

  it('should record a 401 as unauthorized', () => {
    expect(userExternalConnectionErrorCodeFromCalcomError(calcomServerFetchResponseError(401))).toBe('unauthorized');
  });

  it('should record a 401 whose body could not be parsed as unauthorized', () => {
    expect(userExternalConnectionErrorCodeFromCalcomError(fetchResponseError(401))).toBe('unauthorized');
  });

  it('should NOT record a 403', () => {
    // Cal.com uses 403 for an authenticated caller that may not touch the resource — the connection
    // itself is fine, and marking it broken would send the user to a reconnect that fixes nothing
    expect(userExternalConnectionErrorCodeFromCalcomError(calcomServerFetchResponseError(403))).not.toBeDefined();
    expect(userExternalConnectionErrorCodeFromCalcomError(fetchResponseError(403))).not.toBeDefined();
  });

  it('should NOT record a rate limit', () => {
    expect(userExternalConnectionErrorCodeFromCalcomError(calcomServerFetchResponseError(429))).not.toBeDefined();
  });

  it('should NOT record a server error', () => {
    expect(userExternalConnectionErrorCodeFromCalcomError(calcomServerFetchResponseError(500))).not.toBeDefined();
  });

  it('should NOT record an error returned with an ok response', () => {
    // no response to read a status from, so nothing says the grant was refused
    expect(userExternalConnectionErrorCodeFromCalcomError(new CalcomServerError({ code: 'bad_request', message: 'bad request' }))).not.toBeDefined();
  });

  it('should NOT record an arbitrary failure', () => {
    expect(userExternalConnectionErrorCodeFromCalcomError(new Error('socket hang up'))).not.toBeDefined();
  });
});

/**
 * How the service behaves when Cal.com refuses the grant.
 *
 * Stubbed rather than run against the app, because the app cannot make Cal.com answer with a 401 on
 * demand. Everything else about the service is exercised against the real app below.
 */
describe('userExternalConnectionCalcomUserContextService() with a refused grant', () => {
  const stored: StubbedConnection = { entry: makeStubEntry(), credentials: demoUserExternalConnectionTestCredentials() };

  it('should record the failure on the connection and rethrow', async () => {
    const { service, errors } = makeStubbedService(stored, calcomServerFetchResponseError(401));
    const instance = await service.calcomUserContextForUser({ uid: STUB_UID });

    await expect(instance.getMe()).rejects.toBeDefined();

    expect(errors).toHaveLength(1);
    expect(errors[0].uid).toBe(STUB_UID);
    expect(errors[0].providerType).toBe(CALCOM);
    expect(errors[0].error).toBe('unauthorized');
  });

  it('should record a failure raised while resolving the access token', async () => {
    // Cal.com resolves the token inside the request's header factory, so a dead refresh token
    // surfaces through the same fetch a 401 response does
    const { service, errors } = makeStubbedService(stored, new CalcomOAuthAccessTokenError(CALCOM_OAUTH_INVALID_GRANT_ERROR_CODE));
    const instance = await service.calcomUserContextForUser({ uid: STUB_UID });

    await expect(instance.getMe()).rejects.toBeDefined();

    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBe('expired');
  });

  it('should NOT record a failure the connection is not responsible for', async () => {
    const { service, errors } = makeStubbedService(stored, calcomServerFetchResponseError(429));
    const instance = await service.calcomUserContextForUser({ uid: STUB_UID });

    await expect(instance.getMe()).rejects.toBeDefined();

    expect(errors).toHaveLength(0);
  });

  it('should not write again when the entry already records the same failure', async () => {
    // a caller looping calls against a dead connection would otherwise write a transaction per
    // attempt to say what the document already says
    const { service, errors } = makeStubbedService({ ...stored, entry: makeStubEntry({ st: 'error', er: 'unauthorized' }) }, calcomServerFetchResponseError(401));
    const instance = await service.calcomUserContextForUser({ uid: STUB_UID });

    await expect(instance.getMe()).rejects.toBeDefined();

    expect(errors).toHaveLength(0);
  });

  it('should write when the entry records a DIFFERENT failure', async () => {
    const { service, errors } = makeStubbedService({ ...stored, entry: makeStubEntry({ st: 'error', er: 'insufficient_scope' }) }, calcomServerFetchResponseError(401));
    const instance = await service.calcomUserContextForUser({ uid: STUB_UID });

    await expect(instance.getMe()).rejects.toBeDefined();

    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBe('unauthorized');
  });
});

/**
 * The service as the app actually provides it, against the real emulator-backed connection pair.
 *
 * What is proven here and cannot be proven over stubs: that the app PROVIDES the service at all — its
 * three dependencies are declared in three different modules, so a wiring mistake would otherwise
 * surface on the first real Cal.com call — that the app's real Cal.com configuration can produce a
 * per-user context, and that the refresh token the context is built from survives the encrypted round
 * trip through the private document.
 *
 * The live Cal.com round trip is not here. It needs a real connected account and is verified by hand.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('userExternalConnectionCalcomUserContextService', () => {
    it('should be provided by the app', () => {
      expect(f.userExternalConnectionCalcomUserContextService).toBeDefined();
    });

    demoAuthorizedUserContext({ f }, (u) => {
      demoUserExternalConnectionContext({ f, u }, (uec) => {
        describe('calcomUserContextForUser()', () => {
          it('should throw for a user who has not connected Cal.com', async () => {
            const code = await errorCodeFor(() => f.userExternalConnectionCalcomUserContextService.calcomUserContextForUser({ uid: u.uid }));
            expect(code).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE);
          });

          it('should throw after a disconnect', async () => {
            await uec.connect({ providerType: CALCOM });
            await uec.disconnect({ providerType: CALCOM, retainEntry: true });

            const code = await errorCodeFor(() => f.userExternalConnectionCalcomUserContextService.calcomUserContextForUser({ uid: u.uid }));
            expect(code).toBe(USER_EXTERNAL_CONNECTION_PROVIDER_NOT_CONNECTED_ERROR_CODE);
          });

          it('should throw when the stored credentials carry no refresh token', async () => {
            // Cal.com issues an access token only in exchange for a refresh token, so there is nothing
            // to act with and no way to renew — a reconnect is the only remedy
            await uec.connect({ providerType: CALCOM, credentials: demoUserExternalConnectionTestCredentials({ refreshToken: undefined }) });

            const code = await errorCodeFor(() => f.userExternalConnectionCalcomUserContextService.calcomUserContextForUser({ uid: u.uid }));
            expect(code).toBe(USER_EXTERNAL_CONNECTION_CREDENTIALS_EXPIRED_ERROR_CODE);
          });

          it('should return a user-scoped instance for a connected user', async () => {
            await uec.connect({ providerType: CALCOM });

            const instance = await f.userExternalConnectionCalcomUserContextService.calcomUserContextForUser({ uid: u.uid });

            // the user context, not the app's server context — the whole point of the service. Reaching
            // this also proves the app's Cal.com configuration exposes the per-user OAuth path, which a
            // configured API key used to disable outright
            expect(instance.context.type).toBe('user');
          });

          it('should return an instance for an entry in the error status', async () => {
            // the entry keeps its credentials precisely so a refresh can repair it, and the refresh
            // Cal.com runs through the cache writes back as `connected` — so refusing here would
            // strand a user whose connection a single successful call would have healed
            await uec.connect({ providerType: CALCOM });
            await uec.markError({ providerType: CALCOM, error: 'expired' });

            const instance = await f.userExternalConnectionCalcomUserContextService.calcomUserContextForUser({ uid: u.uid });
            expect(instance.context.type).toBe('user');
          });
        });
      });
    });
  });
});
