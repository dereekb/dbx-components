import { afterAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { clientFirebaseFirestoreContextFactory } from '@dereekb/firebase';
import { CLIENT_FIRESTORE_DRIVER_IDENTIFIER, firebaseClientFirestoreIdentitySuggestion, inspectFirebaseClientFirestoreIdentity } from './firestore.sdk-identity';

/**
 * A real client-SDK `Firestore` and the `FirestoreContext` built from it. `initializeApp` /
 * `getFirestore` are offline — no request goes out until a read is issued — so the healthy case is
 * checked against the genuine object rather than a stand-in, which is the whole point of an identity
 * check.
 */
const app = initializeApp({ apiKey: 'fake-api-key', projectId: 'demo-sdk-identity', appId: '1:1:web:1' }, 'oauth-resource-firebase-sdk-identity-spec');
const healthyContext = clientFirebaseFirestoreContextFactory(getFirestore(app));

afterAll(async () => {
  await deleteApp(app);
});

describe('inspectFirebaseClientFirestoreIdentity()', () => {
  it('passes for a real client-SDK context', () => {
    const report = inspectFirebaseClientFirestoreIdentity({ firestoreContext: healthyContext });

    expect(report.ok).toBe(true);
    expect(report.problem).toBeUndefined();
    expect(report.firestorePresent).toBe(true);
    expect(report.firestoreIsSdkInstance).toBe(true);
    expect(report.firestoreDriverIdentifier).toBe(CLIENT_FIRESTORE_DRIVER_IDENTIFIER);
    expect(firebaseClientFirestoreIdentitySuggestion(report)).toBeUndefined();
  });

  it('reports the module provenance whether or not the check passed', () => {
    // the fact that would have settled the duplicated-SDK hypothesis without an investigation
    const report = inspectFirebaseClientFirestoreIdentity({ firestoreContext: healthyContext });

    expect(report.sdkFromConsumer.packageDir).toBeTruthy();
    expect(report.sdkFromConsumer.version).toBeTruthy();
    expect(report.firebaseVersion).toBeTruthy();

    // The second resolution goes through `@dereekb/firebase` AS A PACKAGE, which only exists in a
    // downstream install. In this repo the spec runs against `packages/firebase`'s SOURCE via tsconfig
    // paths, so there is no package to resolve from and the report says so with an `error` instead of
    // inventing a directory. Either answer is correct; a silent `undefined` with no error would not be.
    if (report.sdkFromDbxFirebase.packageDir == null) {
      expect(report.sdkFromDbxFirebase.error).toBeTruthy();
    } else {
      expect(report.sdkFromDbxFirebase.packageDir).toBe(report.sdkFromConsumer.packageDir);
    }

    // unprovable is not the same as duplicated — a failed resolution must never accuse
    expect(report.sdkDuplicated).toBe(false);
  });

  it('names an absent Firestore handle rather than letting collection() fail on it', () => {
    const report = inspectFirebaseClientFirestoreIdentity({ firestoreContext: { firestore: undefined, drivers: { firestoreDriverIdentifier: CLIENT_FIRESTORE_DRIVER_IDENTIFIER } } });

    expect(report.ok).toBe(false);
    expect(report.problem).toBe('no-firestore-handle');
    expect(report.firestorePresent).toBe(false);
    expect(firebaseClientFirestoreIdentitySuggestion(report)).toContain('wiring fault');
  });

  it('treats a missing firestoreContext the same as a missing handle', () => {
    const report = inspectFirebaseClientFirestoreIdentity({});

    expect(report.ok).toBe(false);
    expect(report.problem).toBe('no-firestore-handle');
  });

  it('names a foreign object handed to the client-SDK read path', () => {
    const report = inspectFirebaseClientFirestoreIdentity({ firestoreContext: { firestore: { notAFirestore: true }, drivers: { firestoreDriverIdentifier: CLIENT_FIRESTORE_DRIVER_IDENTIFIER } } });

    expect(report.ok).toBe(false);
    expect(report.problem).toBe('foreign-firestore-instance');
    expect(report.firestorePresent).toBe(true);
    expect(report.firestoreIsSdkInstance).toBe(false);
    expect(firebaseClientFirestoreIdentitySuggestion(report)).toContain('STALE build artifact');
  });

  it('names an admin-SDK context ahead of the brand check', () => {
    // a `googleCloudFirestoreContextFactory` context reaching the client path fails `instanceof` too,
    // but "wrong driver" is the diagnosis that names the fix — and it is the guard that keeps an
    // Admin-SDK handle (which is NOT rules-evaluated) out of the user-scoped read path
    const report = inspectFirebaseClientFirestoreIdentity({ firestoreContext: { firestore: { settings: () => undefined }, drivers: { firestoreDriverIdentifier: '@google-cloud/firestore' } } });

    expect(report.ok).toBe(false);
    expect(report.problem).toBe('unexpected-driver');
    expect(firebaseClientFirestoreIdentitySuggestion(report)).toContain('clientFirebaseFirestoreContextFactory');
  });

  it('tolerates a context with no drivers at all', () => {
    const report = inspectFirebaseClientFirestoreIdentity({ firestoreContext: { firestore: { notAFirestore: true } } });

    expect(report.problem).toBe('foreign-firestore-instance');
    expect(report.firestoreDriverIdentifier).toBeUndefined();
  });

  it('resolves the SDK through a supplied consumerRequire', () => {
    // the duplicated-SDK hypothesis is "do these two consumers see the same copy", so the resolution
    // root must be the CALLER's, not this package's
    const failing = (() => undefined) as unknown as NodeJS.Require;
    failing.resolve = (() => {
      throw new Error('cannot resolve from here');
    }) as unknown as NodeJS.RequireResolve;

    const report = inspectFirebaseClientFirestoreIdentity({ firestoreContext: healthyContext, consumerRequire: failing });

    expect(report.sdkFromConsumer.packageDir).toBeUndefined();
    expect(report.sdkFromConsumer.error).toContain('cannot resolve from here');
    expect(report.sdkDuplicated).toBe(false);
  });
});

describe('firebaseClientFirestoreIdentitySuggestion()', () => {
  it('prefers a consumer-supplied override for the problem found', () => {
    const report = inspectFirebaseClientFirestoreIdentity({ firestoreContext: { firestore: undefined } });

    expect(firebaseClientFirestoreIdentitySuggestion(report, { 'no-handle-typo': 'unused' } as never)).toContain('wiring fault');
    expect(firebaseClientFirestoreIdentitySuggestion(report, { 'no-firestore-handle': 're-run with `--verbose`' })).toBe('re-run with `--verbose`');
  });

  it('names the consumer in the default text', () => {
    const report = inspectFirebaseClientFirestoreIdentity({ firestoreContext: { firestore: undefined } });

    expect(firebaseClientFirestoreIdentitySuggestion(report, undefined, '@dereekb/dbx-cli')).toContain('@dereekb/dbx-cli');
  });

  it('returns undefined for a passing report even with overrides supplied', () => {
    const report = inspectFirebaseClientFirestoreIdentity({ firestoreContext: healthyContext });

    expect(firebaseClientFirestoreIdentitySuggestion(report, { 'no-firestore-handle': 'x' })).toBeUndefined();
  });
});
