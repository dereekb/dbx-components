import { afterAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { clientFirebaseFirestoreContextFactory } from '@dereekb/firebase';
import { CliError } from '../util/output';
import { CLI_CLIENT_FIRESTORE_DRIVER_IDENTIFIER, FIRESTORE_COLLECTION_UNRESOLVABLE_CODE, FIRESTORE_SDK_INSTANCE_MISMATCH_CODE, cliFirestoreSdkIdentitySuggestion, cliFirestoreWiringError, inspectCliFirestoreSdkIdentity } from './firestore.sdk-identity';

/**
 * A real client-SDK `Firestore` and the `FirestoreContext` built from it. `initializeApp` /
 * `getFirestore` are offline — no request goes out until a read is issued — so the healthy case is
 * checked against the genuine object rather than a stand-in, which is the whole point of an identity
 * check.
 */
const app = initializeApp({ apiKey: 'fake-api-key', projectId: 'demo-sdk-identity', appId: '1:1:web:1' }, 'dbx-cli-sdk-identity-spec');
const healthyContext = clientFirebaseFirestoreContextFactory(getFirestore(app));

afterAll(async () => {
  await deleteApp(app);
});

/**
 * The message `collection()` throws for ANY non-`Firestore` first argument — the string this whole
 * module exists to replace, reproduced verbatim so the tests pin the real shape.
 */
const SDK_INVALID_ARGUMENT_MESSAGE = 'Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore';

function sdkInvalidArgumentError(): Error {
  return Object.assign(new Error(SDK_INVALID_ARGUMENT_MESSAGE), { code: 'invalid-argument', name: 'FirebaseError' });
}

describe('inspectCliFirestoreSdkIdentity()', () => {
  it('passes for a real client-SDK context', () => {
    const report = inspectCliFirestoreSdkIdentity({ firestoreContext: healthyContext });

    expect(report.ok).toBe(true);
    expect(report.problem).toBeUndefined();
    expect(report.firestorePresent).toBe(true);
    expect(report.firestoreIsSdkInstance).toBe(true);
    expect(report.firestoreDriverIdentifier).toBe(CLI_CLIENT_FIRESTORE_DRIVER_IDENTIFIER);
    expect(cliFirestoreSdkIdentitySuggestion(report)).toBeUndefined();
  });

  it('reports the module provenance whether or not the check passed', () => {
    // the fact that would have settled the duplicated-SDK hypothesis without an investigation
    const report = inspectCliFirestoreSdkIdentity({ firestoreContext: healthyContext });

    expect(report.sdkFromDbxCli.packageDir).toBeTruthy();
    expect(report.sdkFromDbxCli.version).toBeTruthy();
    expect(report.firebaseVersion).toBeTruthy();

    // The second resolution goes through `@dereekb/firebase` AS A PACKAGE, which only exists in a
    // downstream install. In this repo the spec runs against `packages/firebase`'s SOURCE via tsconfig
    // paths, so there is no package to resolve from and the report says so with an `error` instead of
    // inventing a directory. Either answer is correct; a silent `undefined` with no error would not be.
    if (report.sdkFromDbxFirebase.packageDir == null) {
      expect(report.sdkFromDbxFirebase.error).toBeTruthy();
    } else {
      expect(report.sdkFromDbxFirebase.packageDir).toBe(report.sdkFromDbxCli.packageDir);
    }

    // unprovable is not the same as duplicated — a failed resolution must never accuse
    expect(report.sdkDuplicated).toBe(false);
  });

  it('names an absent Firestore handle rather than letting collection() fail on it', () => {
    const report = inspectCliFirestoreSdkIdentity({ firestoreContext: { firestore: undefined, drivers: { firestoreDriverIdentifier: CLI_CLIENT_FIRESTORE_DRIVER_IDENTIFIER } } });

    expect(report.ok).toBe(false);
    expect(report.problem).toBe('no-firestore-handle');
    expect(report.firestorePresent).toBe(false);
    expect(cliFirestoreSdkIdentitySuggestion(report)).toContain('wiring fault');
  });

  it('treats a missing firestoreContext the same as a missing handle', () => {
    const report = inspectCliFirestoreSdkIdentity({});

    expect(report.ok).toBe(false);
    expect(report.problem).toBe('no-firestore-handle');
  });

  it('names a foreign object handed to the client-SDK read path', () => {
    const report = inspectCliFirestoreSdkIdentity({ firestoreContext: { firestore: { notAFirestore: true }, drivers: { firestoreDriverIdentifier: CLI_CLIENT_FIRESTORE_DRIVER_IDENTIFIER } } });

    expect(report.ok).toBe(false);
    expect(report.problem).toBe('foreign-firestore-instance');
    expect(report.firestorePresent).toBe(true);
    expect(report.firestoreIsSdkInstance).toBe(false);
    expect(cliFirestoreSdkIdentitySuggestion(report)).toContain('STALE CLI artifact');
  });

  it('names an admin-SDK context ahead of the brand check', () => {
    // a `googleCloudFirestoreContextFactory` context reaching the CLI fails `instanceof` too, but
    // "wrong driver" is the diagnosis that names the fix
    const report = inspectCliFirestoreSdkIdentity({ firestoreContext: { firestore: { settings: () => undefined }, drivers: { firestoreDriverIdentifier: '@google-cloud/firestore' } } });

    expect(report.ok).toBe(false);
    expect(report.problem).toBe('unexpected-driver');
    expect(cliFirestoreSdkIdentitySuggestion(report)).toContain('clientFirebaseFirestoreContextFactory');
  });

  it('tolerates a context with no drivers at all', () => {
    const report = inspectCliFirestoreSdkIdentity({ firestoreContext: { firestore: { notAFirestore: true } } });

    expect(report.problem).toBe('foreign-firestore-instance');
    expect(report.firestoreDriverIdentifier).toBeUndefined();
  });
});

describe('cliFirestoreWiringError()', () => {
  it('names the model, collection, and parent the SDK message omits', () => {
    const error = cliFirestoreWiringError({
      error: sdkInvalidArgumentError(),
      operation: 'scope the collection group to one parent document',
      modelType: 'guestbookEntry',
      collectionName: 'gbe',
      parentKey: 'gb/abc',
      firestoreContext: healthyContext
    });

    expect(error).toBeInstanceOf(CliError);
    expect(error.message).toContain('model "guestbookEntry"');
    expect(error.message).toContain('collection "gbe"');
    expect(error.message).toContain('--parent "gb/abc"');
    expect(error.message).toContain(SDK_INVALID_ARGUMENT_MESSAGE);
  });

  it('records that no --parent was in play, which rules out the subcollection route', () => {
    const error = cliFirestoreWiringError({ error: sdkInvalidArgumentError(), operation: "build the app's Firestore collections from the session context", firestoreContext: healthyContext });

    expect(error.message).toContain('no --parent');
  });

  it('blames the path, not the SDK, when the handle checks out', () => {
    const error = cliFirestoreWiringError({ error: sdkInvalidArgumentError(), operation: 'resolve the Firestore collection for this query', modelType: 'gbe', firestoreContext: healthyContext });

    expect((error as CliError).code).toBe(FIRESTORE_COLLECTION_UNRESOLVABLE_CODE);
    expect((error as CliError).suggestion).toContain('rejected argument is the path, not the SDK');
  });

  it('blames the SDK instance when the handle is absent', () => {
    const error = cliFirestoreWiringError({ error: sdkInvalidArgumentError(), operation: "build the app's Firestore collections from the session context", modelType: 'gbe', firestoreContext: { firestore: undefined } });

    expect((error as CliError).code).toBe(FIRESTORE_SDK_INSTANCE_MISMATCH_CODE);
    expect((error as CliError).suggestion).toContain('wiring fault');
  });

  it('passes an already-named CliError through untouched', () => {
    // upstream already reports unknown model types and malformed `--parent` keys precisely; re-wrapping
    // them would bury the better message
    const original = new CliError({ message: 'Unknown model type "nope".', code: 'INVALID_ARGUMENT' });
    const error = cliFirestoreWiringError({ error: original, operation: 'resolve the Firestore collection for this query', modelType: 'nope' });

    expect(error).toBe(original);
  });
});
