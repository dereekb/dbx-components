import { describe, expect, it, vi } from 'vitest';
import { type Maybe } from '@dereekb/util';
import { FIRESTORE_SESSION_OIDC_SCOPE } from '@dereekb/firebase';
import { type FirebaseServerAuthData } from '../auth.context.server';
import { MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from '../api.scope';
import { DEFAULT_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS, MAX_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS, MIN_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS, type FirestoreSessionAdminPredicate, type SessionApiModuleConfig, firestoreSessionAppCheckTtlMillis } from './session.api.config';
import { FIRESTORE_SESSION_FORBIDDEN_ERROR_CODE, FirestoreSessionApiService } from './session.api.service';

// MARK: Helpers
const TEST_UID = 'testuid';
const TEST_APP_ID = '1:1234567890:web:abcdef';

function authWithScope(scope: Maybe<string>, uid: string = TEST_UID): FirebaseServerAuthData {
  return { uid, token: scope == null ? {} : { scope } } as unknown as FirebaseServerAuthData;
}

interface MakeServiceInput {
  readonly config?: Maybe<SessionApiModuleConfig>;
  readonly adminPredicate?: Maybe<FirestoreSessionAdminPredicate>;
}

interface MakeServiceResult {
  readonly service: FirestoreSessionApiService;
  readonly createCustomToken: ReturnType<typeof vi.fn>;
  readonly createAppCheckToken: ReturnType<typeof vi.fn>;
}

function makeService(input: MakeServiceInput = {}): MakeServiceResult {
  const createCustomToken = vi.fn(async () => 'custom-token');
  const createAppCheckToken = vi.fn(async () => ({ token: 'app-check-token', ttlMillis: DEFAULT_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS }));

  const app = {
    auth: () => ({ createCustomToken }),
    appCheck: () => ({ createToken: createAppCheckToken })
  } as any;

  const service = new FirestoreSessionApiService(app, input.config ?? undefined, input.adminPredicate ?? undefined);
  return { service, createCustomToken, createAppCheckToken };
}

async function codeOfRejection(fn: () => Promise<unknown>): Promise<string | undefined> {
  let caught: any;

  try {
    await fn();
  } catch (e) {
    caught = e;
  }

  const details = caught?.details ?? caught?.errorInfo?.details ?? caught;
  return details?.code ?? caught?.code;
}

// MARK: Tests
describe('firestoreSessionAppCheckTtlMillis()', () => {
  it('should default to the Admin SDK default when unset', () => {
    expect(firestoreSessionAppCheckTtlMillis(undefined)).toBe(DEFAULT_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS);
  });

  it('should clamp a too-short ttl up to the minimum', () => {
    expect(firestoreSessionAppCheckTtlMillis(1000)).toBe(MIN_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS);
  });

  it('should clamp a too-long ttl down to the maximum', () => {
    expect(firestoreSessionAppCheckTtlMillis(MAX_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS * 4)).toBe(MAX_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS);
  });
});

describe('FirestoreSessionApiService', () => {
  describe('createFirestoreSession()', () => {
    it('should reject an unauthenticated caller', async () => {
      const { service, createCustomToken } = makeService({ adminPredicate: () => true });
      await expect(service.createFirestoreSession(undefined)).rejects.toBeDefined();
      expect(createCustomToken).not.toHaveBeenCalled();
    });

    it('should fail closed when no admin predicate is provided', async () => {
      const { service, createCustomToken } = makeService();
      const code = await codeOfRejection(() => service.createFirestoreSession(authWithScope(FIRESTORE_SESSION_OIDC_SCOPE)));

      expect(code).toBe(FIRESTORE_SESSION_FORBIDDEN_ERROR_CODE);
      expect(createCustomToken).not.toHaveBeenCalled();
    });

    it('should reject a caller the admin predicate denies', async () => {
      const { service, createCustomToken } = makeService({ adminPredicate: () => false });
      const code = await codeOfRejection(() => service.createFirestoreSession(authWithScope(FIRESTORE_SESSION_OIDC_SCOPE)));

      expect(code).toBe(FIRESTORE_SESSION_FORBIDDEN_ERROR_CODE);
      expect(createCustomToken).not.toHaveBeenCalled();
    });

    it('should reject an OIDC caller missing the session scope', async () => {
      const { service, createCustomToken } = makeService({ adminPredicate: () => true });
      const code = await codeOfRejection(() => service.createFirestoreSession(authWithScope('openid model.read')));

      expect(code).toBe(MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE);
      expect(createCustomToken).not.toHaveBeenCalled();
    });

    it('should allow a non-OIDC caller that passes the admin predicate (scope enforcement is skipped)', async () => {
      const { service } = makeService({ adminPredicate: () => true });
      const result = await service.createFirestoreSession(authWithScope(undefined));
      expect(result.customToken).toBe('custom-token');
    });

    it('should mint a custom token for the calling uid', async () => {
      const { service, createCustomToken } = makeService({ adminPredicate: () => true });
      const result = await service.createFirestoreSession(authWithScope(FIRESTORE_SESSION_OIDC_SCOPE));

      expect(createCustomToken).toHaveBeenCalledWith(TEST_UID);
      expect(result.uid).toBe(TEST_UID);
      expect(result.customToken).toBe('custom-token');
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('should omit the App Check token when no appCheckAppId is configured', async () => {
      const { service, createAppCheckToken } = makeService({ adminPredicate: () => true });
      const result = await service.createFirestoreSession(authWithScope(FIRESTORE_SESSION_OIDC_SCOPE));

      expect(result.appCheckToken).toBeUndefined();
      expect(createAppCheckToken).not.toHaveBeenCalled();
    });

    it('should mint an App Check token for the configured web appId', async () => {
      const { service, createAppCheckToken } = makeService({ adminPredicate: () => true, config: { appCheckAppId: TEST_APP_ID } });
      const result = await service.createFirestoreSession(authWithScope(FIRESTORE_SESSION_OIDC_SCOPE));

      expect(createAppCheckToken).toHaveBeenCalledWith(TEST_APP_ID, { ttlMillis: DEFAULT_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS });
      expect(result.appCheckToken).toBe('app-check-token');
    });

    it('should clamp a configured App Check ttl into the accepted range', async () => {
      const { service, createAppCheckToken } = makeService({ adminPredicate: () => true, config: { appCheckAppId: TEST_APP_ID, appCheckTokenTtlMillis: 1 } });
      await service.createFirestoreSession(authWithScope(FIRESTORE_SESSION_OIDC_SCOPE));

      expect(createAppCheckToken).toHaveBeenCalledWith(TEST_APP_ID, { ttlMillis: MIN_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS });
    });

    it('should expire the session with its shortest-lived credential', async () => {
      const shortTtl = MIN_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS;
      const createCustomToken = vi.fn(async () => 'custom-token');
      const createAppCheckToken = vi.fn(async () => ({ token: 'app-check-token', ttlMillis: shortTtl }));
      const app = { auth: () => ({ createCustomToken }), appCheck: () => ({ createToken: createAppCheckToken }) } as any;
      const service = new FirestoreSessionApiService(app, { appCheckAppId: TEST_APP_ID, appCheckTokenTtlMillis: shortTtl }, () => true);

      const before = Date.now();
      const result = await service.createFirestoreSession(authWithScope(FIRESTORE_SESSION_OIDC_SCOPE));
      const expiresAt = new Date(result.expiresAt).getTime();

      expect(expiresAt).toBeGreaterThanOrEqual(before + shortTtl);
      expect(expiresAt).toBeLessThan(before + shortTtl + 5000);
    });

    it('should honor an app-supplied requiredScope override', async () => {
      const { service } = makeService({ adminPredicate: () => true, config: { requiredScope: 'custom.scope' } });
      const code = await codeOfRejection(() => service.createFirestoreSession(authWithScope(FIRESTORE_SESSION_OIDC_SCOPE)));
      expect(code).toBe(MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE);

      const allowed = await service.createFirestoreSession(authWithScope('custom.scope'));
      expect(allowed.customToken).toBe('custom-token');
    });

    it('should skip scope enforcement when requiredScope is explicitly null', async () => {
      const { service } = makeService({ adminPredicate: () => true, config: { requiredScope: null } });
      const result = await service.createFirestoreSession(authWithScope('openid'));
      expect(result.customToken).toBe('custom-token');
    });
  });
});
