import { createRequire } from 'node:module';
import { type FirestoreModelKey, type FirestoreModelType } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import {
  CLIENT_FIRESTORE_DRIVER_IDENTIFIER,
  type FirebaseClientFirestoreIdentityContext,
  type FirebaseClientFirestoreIdentityProblem,
  type FirebaseClientFirestoreIdentityReport,
  type FirebaseClientFirestoreSdkModuleIdentity,
  firebaseClientFirestoreIdentitySuggestion,
  inspectFirebaseClientFirestoreIdentity
} from '@dereekb/oauth-resource/firebase';
import { CliError } from '../util/output';

/**
 * The `drivers.firestoreDriverIdentifier` a client-SDK `FirestoreContext` reports. See
 * {@link CLIENT_FIRESTORE_DRIVER_IDENTIFIER}.
 */
export const CLI_CLIENT_FIRESTORE_DRIVER_IDENTIFIER = CLIENT_FIRESTORE_DRIVER_IDENTIFIER;

/**
 * The doctor `detail.stage` reported when the session's Firestore handle is not a usable client-SDK
 * `Firestore`.
 *
 * A distinct stage from `rules-protected-read` on purpose: the read never ran, so reporting it under
 * the read's stage is what made this failure look like a rules/App Check problem.
 */
export const FIRESTORE_SDK_IDENTITY_STAGE = 'firestore-sdk-identity';

/**
 * `CliError` code for a Firestore handle the client SDK does not recognize as its own.
 */
export const FIRESTORE_SDK_INSTANCE_MISMATCH_CODE = 'FIRESTORE_SDK_INSTANCE_MISMATCH';

/**
 * `CliError` code for a collection/document reference the SDK refused to build for a reason the
 * wiring identity check cannot explain — a bad `--parent`, or an app collection whose own
 * construction is broken.
 */
export const FIRESTORE_COLLECTION_UNRESOLVABLE_CODE = 'FIRESTORE_COLLECTION_UNRESOLVABLE';

/**
 * The distinct ways a session's Firestore handle can be unusable. See
 * {@link FirebaseClientFirestoreIdentityProblem}.
 */
export type CliFirestoreSdkIdentityProblem = FirebaseClientFirestoreIdentityProblem;

/**
 * Where one consumer resolved `@firebase/firestore` to, and at which version. See
 * {@link FirebaseClientFirestoreSdkModuleIdentity}.
 */
export type CliFirestoreSdkModuleIdentity = FirebaseClientFirestoreSdkModuleIdentity;

/**
 * The provenance + brand-check report {@link inspectCliFirestoreSdkIdentity} produces. See
 * {@link FirebaseClientFirestoreIdentityReport}.
 */
export type CliFirestoreSdkIdentityReport = FirebaseClientFirestoreIdentityReport;

/**
 * The slice of a session context {@link inspectCliFirestoreSdkIdentity} reads. See
 * {@link FirebaseClientFirestoreIdentityContext}.
 */
export type CliFirestoreSdkIdentityContext = FirebaseClientFirestoreIdentityContext;

/**
 * Input for {@link inspectCliFirestoreSdkIdentity}.
 */
export interface InspectCliFirestoreSdkIdentityInput {
  readonly firestoreContext?: Maybe<CliFirestoreSdkIdentityContext>;
}

/**
 * The CLI's name in the SDK-identity report and its suggestions.
 */
const CLI_FIRESTORE_IDENTITY_CONSUMER_NAME = '@dereekb/dbx-cli';

/**
 * This package's own module-resolution root.
 *
 * The duplicated-SDK hypothesis is exactly "do `@dereekb/dbx-cli` and `@dereekb/firebase` see the
 * same copy of `@firebase/firestore`", so the resolution has to start from HERE — resolving from
 * `@dereekb/oauth-resource/firebase` would answer a different question.
 */
const cliRequire = createRequire(import.meta.url);

/**
 * The CLI's operator-facing remediation for each problem, replacing the package-level default.
 *
 * Each names a step an operator of a `@dereekb/dbx-cli`-built CLI can actually take.
 */
const CLI_FIRESTORE_SDK_IDENTITY_SUGGESTIONS: Partial<Record<CliFirestoreSdkIdentityProblem, string>> = {
  'no-firestore-handle': 'The session produced no Firestore handle, so every collection reference built from it fails. This is a wiring fault, not a rules or App Check fault — re-run with `--verbose` to see the handshake, and verify the CLI resolves ONE `@dereekb/firebase`.',
  'foreign-firestore-instance': "The session's handle is not an instance of the loaded SDK's `Firestore`, and only one copy of `@firebase/firestore` is installed. The likeliest cause is a STALE CLI artifact running against a newer `@dereekb/*` in `node_modules` — rebuild the CLI, then re-run `doctor`."
};

/**
 * Checks that a session's Firestore handle is one the loaded client SDK will accept, and reports
 * where every consumer resolved the SDK from.
 *
 * The CLI wrapper over {@link inspectFirebaseClientFirestoreIdentity}: it supplies this package's own
 * `require` as the resolution root and names the CLI in the report, so `doctor`'s output is unchanged
 * by the move of the inspection core into `@dereekb/oauth-resource/firebase`.
 *
 * @param input - The session's `firestoreContext`, when one was built.
 * @returns The provenance + brand-check report.
 */
export function inspectCliFirestoreSdkIdentity(input: InspectCliFirestoreSdkIdentityInput): CliFirestoreSdkIdentityReport {
  return inspectFirebaseClientFirestoreIdentity({ firestoreContext: input.firestoreContext, consumerRequire: cliRequire, consumerName: CLI_FIRESTORE_IDENTITY_CONSUMER_NAME });
}

/**
 * The actionable next step for a failed {@link inspectCliFirestoreSdkIdentity}, keyed on which
 * problem was found.
 *
 * Each branch names the fix rather than the symptom — a raw SDK sentence sends an operator looking at
 * security rules and App Check, neither of which is ever the cause here.
 *
 * @param report - The report to describe.
 * @returns The suggestion, or `undefined` when the report passed.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliFirestoreSdkIdentitySuggestion(report: CliFirestoreSdkIdentityReport): Maybe<string> {
  return firebaseClientFirestoreIdentitySuggestion(report, CLI_FIRESTORE_SDK_IDENTITY_SUGGESTIONS, CLI_FIRESTORE_IDENTITY_CONSUMER_NAME);
}

/**
 * Input for {@link cliFirestoreWiringError}.
 */
export interface CliFirestoreWiringErrorInput {
  /**
   * The value the SDK threw.
   */
  readonly error: unknown;
  /**
   * What the CLI was doing, phrased to complete `Could not <operation>` — e.g.
   * `build the app's Firestore collections`.
   */
  readonly operation: string;
  readonly modelType?: FirestoreModelType;
  readonly collectionName?: string;
  /**
   * The `--parent` in play, when one was supplied. Reported either way: "no `--parent`" rules out the
   * subcollection route, which is otherwise the first thing an operator has to go and check.
   */
  readonly parentKey?: FirestoreModelKey;
  readonly firestoreContext?: Maybe<CliFirestoreSdkIdentityContext>;
}

/**
 * Re-raises a reference-construction failure as a `CliError` that names WHAT was being built and, when
 * the SDK handle is at fault, WHY.
 *
 * The failure this replaces is the least readable in the direct-Firestore path: `collection()` and
 * `doc()` reject a bad first argument with a message that names neither the model, the collection, the
 * `--parent`, nor the handle — and every one of those is known at the call site. A `CliError` already
 * raised upstream (an unknown model type, a malformed `--parent`) is passed through untouched, so this
 * can be applied unconditionally in a `catch`.
 *
 * @param input - The thrown value plus everything the call site knows about the reference it was building.
 * @returns The `CliError` to throw, or the original `CliError` when the failure was already named.
 */
export function cliFirestoreWiringError(input: CliFirestoreWiringErrorInput): Error {
  const { error, operation, modelType, collectionName, parentKey, firestoreContext } = input;
  let result: Error;

  if (error instanceof CliError) {
    result = error;
  } else {
    const facts = [modelType == null ? undefined : `model "${modelType}"`, collectionName == null ? undefined : `collection "${collectionName}"`, parentKey == null ? 'no --parent' : `--parent "${parentKey}"`].filter((x) => x != null);
    const report = inspectCliFirestoreSdkIdentity({ firestoreContext });
    const message = `Could not ${operation} (${facts.join(', ')}): ${error instanceof Error ? error.message : String(error)}`;

    result = new CliError({
      message,
      code: report.ok ? FIRESTORE_COLLECTION_UNRESOLVABLE_CODE : FIRESTORE_SDK_INSTANCE_MISMATCH_CODE,
      suggestion:
        cliFirestoreSdkIdentitySuggestion(report) ??
        `The Firestore handle itself checked out (driver "${report.firestoreDriverIdentifier ?? 'unknown'}", @firebase/firestore ${report.sdkFromConsumer.version ?? 'unknown'} at ${report.sdkFromConsumer.packageDir ?? 'unknown'}), so the rejected argument is the path, not the SDK. Check the --parent key and the app's collection factory for this model.`
    });
  }

  return result;
}
