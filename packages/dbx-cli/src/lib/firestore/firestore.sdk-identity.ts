import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { Firestore } from 'firebase/firestore';
import { type FirestoreModelKey, type FirestoreModelType } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { CliError } from '../util/output';

/**
 * The `drivers.firestoreDriverIdentifier` a client-SDK `FirestoreContext` reports.
 *
 * `clientFirebaseFirestoreContextFactory` stamps this; the server's
 * `googleCloudFirestoreContextFactory` stamps `@google-cloud/firestore` instead. Comparing against
 * it is how {@link inspectCliFirestoreSdkIdentity} tells an admin-SDK context handed to the CLI apart
 * from a genuinely broken client one.
 */
export const CLI_CLIENT_FIRESTORE_DRIVER_IDENTIFIER = '@firebase/firestore';

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
 * The distinct ways a session's Firestore handle can be unusable, in the order
 * {@link inspectCliFirestoreSdkIdentity} tests them — most specific diagnosis first.
 */
export type CliFirestoreSdkIdentityProblem =
  /**
   * `firestoreContext` is absent, or its `firestore` is null/undefined. Every `collection()` call
   * built off it throws `Expected first argument to collection() to be a CollectionReference, a
   * DocumentReference or FirebaseFirestore` — the SDK's message for ANY non-Firestore first
   * argument, which is why it never named this.
   */
  | 'no-firestore-handle'
  /**
   * The context reports a driver other than {@link CLI_CLIENT_FIRESTORE_DRIVER_IDENTIFIER} — an
   * admin/`@google-cloud/firestore` context reached the client-SDK read path.
   */
  | 'unexpected-driver'
  /**
   * Two copies of `@firebase/firestore` are loaded, so the handle minted by one fails the other's
   * brand check.
   */
  | 'duplicated-firestore-sdk'
  /**
   * The handle is present and the driver looks right, but it is not an instance of THIS copy of the
   * SDK's `Firestore` class and no duplicate install explains it.
   */
  | 'foreign-firestore-instance';

/**
 * Where one consumer resolved `@firebase/firestore` to, and at which version.
 *
 * Reported for both `@dereekb/dbx-cli` and `@dereekb/firebase` because the whole point of the
 * duplicated-SDK hypothesis is that those two answers can differ.
 */
export interface CliFirestoreSdkModuleIdentity {
  /**
   * The resolved package directory, or `undefined` when resolution failed.
   */
  readonly packageDir?: Maybe<string>;
  readonly version?: Maybe<string>;
  /**
   * Why resolution failed, when it did.
   */
  readonly error?: Maybe<string>;
}

/**
 * The provenance + brand-check report {@link inspectCliFirestoreSdkIdentity} produces.
 *
 * Everything here is reported whether or not the check passed: a `sdkDuplicated: true` alongside
 * `ok: true` is a latent hazard worth seeing before it becomes an outage.
 */
export interface CliFirestoreSdkIdentityReport {
  readonly ok: boolean;
  readonly problem?: CliFirestoreSdkIdentityProblem;
  readonly firestorePresent: boolean;
  /**
   * Whether the handle passes `instanceof Firestore` against the copy of `@firebase/firestore` THIS
   * package loaded.
   */
  readonly firestoreIsSdkInstance: boolean;
  /**
   * The handle's constructor name, which distinguishes a duplicate `Firestore` (same name, different
   * class) from a genuinely foreign object.
   */
  readonly firestoreConstructor?: Maybe<string>;
  readonly firestoreDriverIdentifier?: Maybe<string>;
  /**
   * The version of the `firebase` umbrella package resolved at runtime.
   */
  readonly firebaseVersion?: Maybe<string>;
  readonly sdkFromDbxCli: CliFirestoreSdkModuleIdentity;
  readonly sdkFromDbxFirebase: CliFirestoreSdkModuleIdentity;
  /**
   * True when the two resolutions above name DIFFERENT package directories.
   */
  readonly sdkDuplicated: boolean;
}

/**
 * The slice of a session context {@link inspectCliFirestoreSdkIdentity} reads.
 *
 * Deliberately looser than `FirestoreContext`: this check exists precisely for the case where the
 * object is not the shape its declared type claims, so narrowing it here would assume away the
 * failure. A real `CliFirestoreSessionContext['firestoreContext']` is structurally assignable.
 */
export interface CliFirestoreSdkIdentityContext {
  readonly firestore?: unknown;
  readonly drivers?: {
    readonly firestoreDriverIdentifier?: unknown;
  };
}

/**
 * Input for {@link inspectCliFirestoreSdkIdentity}.
 */
export interface InspectCliFirestoreSdkIdentityInput {
  readonly firestoreContext?: Maybe<CliFirestoreSdkIdentityContext>;
}

/**
 * Checks that a session's Firestore handle is one THIS copy of the client SDK will accept, and
 * reports where every consumer resolved the SDK from.
 *
 * Exists because `collection()` refuses any non-`Firestore` first argument with one message —
 * `Expected first argument to collection() to be a CollectionReference, a DocumentReference or
 * FirebaseFirestore` — that names neither the model, nor the collection, nor which of the three
 * distinct causes ({@link CliFirestoreSdkIdentityProblem}) produced it. Every downstream CLI built on
 * `@dereekb/dbx-cli` shares that hazard, so the diagnosis belongs here rather than in an app.
 *
 * The `instanceof` test is the load-bearing one and it is deliberately NOT structural: an identity
 * check across the package boundary is the only thing that can detect a duplicated
 * `@firebase/firestore`, which is exactly what a structural check would hide. (Contrast
 * `firestore.error.ts`, which narrows a thrown `FirebaseError` structurally — there the goal is to
 * classify an error even when copies differ, so the tradeoff runs the other way.)
 *
 * @param input - The session's `firestoreContext`, when one was built.
 * @returns The provenance + brand-check report.
 */
export function inspectCliFirestoreSdkIdentity(input: InspectCliFirestoreSdkIdentityInput): CliFirestoreSdkIdentityReport {
  const firestore = input.firestoreContext?.firestore;
  const driverIdentifier = input.firestoreContext?.drivers?.firestoreDriverIdentifier;
  const firestoreDriverIdentifier = typeof driverIdentifier === 'string' ? driverIdentifier : undefined;
  const firestorePresent = firestore != null;
  const firestoreIsSdkInstance = firestore instanceof Firestore;
  const firestoreConstructor = firestoreConstructorName(firestore);
  const modules = resolveCliFirestoreSdkModules();
  const sdkDuplicated = modules.sdkFromDbxCli.packageDir != null && modules.sdkFromDbxFirebase.packageDir != null && modules.sdkFromDbxCli.packageDir !== modules.sdkFromDbxFirebase.packageDir;

  let problem: Maybe<CliFirestoreSdkIdentityProblem>;

  if (!firestorePresent) {
    problem = 'no-firestore-handle';
  } else if (firestoreDriverIdentifier != null && firestoreDriverIdentifier !== CLI_CLIENT_FIRESTORE_DRIVER_IDENTIFIER) {
    problem = 'unexpected-driver';
  } else if (!firestoreIsSdkInstance) {
    problem = sdkDuplicated ? 'duplicated-firestore-sdk' : 'foreign-firestore-instance';
  }

  return {
    ok: problem == null,
    ...(problem == null ? {} : { problem }),
    firestorePresent,
    firestoreIsSdkInstance,
    ...(firestoreConstructor == null ? {} : { firestoreConstructor }),
    ...(firestoreDriverIdentifier == null ? {} : { firestoreDriverIdentifier }),
    ...modules,
    sdkDuplicated
  };
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
  let result: Maybe<string>;

  switch (report.problem) {
    case 'no-firestore-handle':
      result = 'The session produced no Firestore handle, so every collection reference built from it fails. This is a wiring fault, not a rules or App Check fault — re-run with `--verbose` to see the handshake, and verify the CLI resolves ONE `@dereekb/firebase`.';
      break;
    case 'unexpected-driver':
      result = `The \`FirestoreContext\` reports driver "${report.firestoreDriverIdentifier}", not "${CLI_CLIENT_FIRESTORE_DRIVER_IDENTIFIER}". An admin-SDK context reached the client-SDK read path — build the CLI's context with \`clientFirebaseFirestoreContextFactory\`, not \`googleCloudFirestoreContextFactory\`.`;
      break;
    case 'duplicated-firestore-sdk':
      result = `Two copies of \`@firebase/firestore\` are loaded — \`@dereekb/dbx-cli\` resolves ${report.sdkFromDbxCli.packageDir}, \`@dereekb/firebase\` resolves ${report.sdkFromDbxFirebase.packageDir} — so the handle one minted fails the other's brand check. Dedupe the install (\`npm ls @firebase/firestore\`) and rebuild the CLI.`;
      break;
    case 'foreign-firestore-instance':
      result = `The session's handle (\`${report.firestoreConstructor ?? 'unknown'}\`) is not an instance of the loaded SDK's \`Firestore\`, and only one copy of \`@firebase/firestore\` is installed. The likeliest cause is a STALE CLI artifact running against a newer \`@dereekb/*\` in \`node_modules\` — rebuild the CLI, then re-run \`doctor\`.`;
      break;
    default:
      result = undefined;
      break;
  }

  return result;
}

/**
 * `CliError` code for a collection/document reference the SDK refused to build for a reason the
 * wiring identity check cannot explain — a bad `--parent`, or an app collection whose own
 * construction is broken.
 */
export const FIRESTORE_COLLECTION_UNRESOLVABLE_CODE = 'FIRESTORE_COLLECTION_UNRESOLVABLE';

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
        `The Firestore handle itself checked out (driver "${report.firestoreDriverIdentifier ?? 'unknown'}", @firebase/firestore ${report.sdkFromDbxCli.version ?? 'unknown'} at ${report.sdkFromDbxCli.packageDir ?? 'unknown'}), so the rejected argument is the path, not the SDK. Check the --parent key and the app's collection factory for this model.`
    });
  }

  return result;
}

/**
 * The handle's constructor name, when it has one.
 *
 * @param firestore - The candidate handle.
 * @returns The constructor name, or `undefined`.
 */
function firestoreConstructorName(firestore: unknown): Maybe<string> {
  const name = firestore == null ? undefined : (firestore as { readonly constructor?: { readonly name?: unknown } }).constructor?.name;
  return typeof name === 'string' ? name : undefined;
}

/**
 * The resolution half of {@link CliFirestoreSdkIdentityReport} — everything derivable from
 * `node_modules` alone, with no session in hand.
 */
type CliFirestoreSdkModules = Pick<CliFirestoreSdkIdentityReport, 'sdkFromDbxCli' | 'sdkFromDbxFirebase' | 'firebaseVersion'>;

/**
 * Resolves `@firebase/firestore` from both this package and `@dereekb/firebase`, plus the `firebase`
 * umbrella version.
 *
 * `createRequire` rather than `import.meta.resolve` because the resolution has to be performed
 * relative to ANOTHER package's location (`@dereekb/firebase`'s entry file) to answer the question
 * that matters — whether the two consumers see the same copy.
 *
 * @returns The two module identities and the umbrella version, each degrading to an `error` field
 *   rather than throwing: this runs inside a diagnostic, and a failed resolution is itself a finding.
 */
function resolveCliFirestoreSdkModules(): CliFirestoreSdkModules {
  const requireFromDbxCli = createRequire(import.meta.url);
  const sdkFromDbxCli = resolveFirestoreSdkIdentity(requireFromDbxCli);
  let sdkFromDbxFirebase: CliFirestoreSdkModuleIdentity;

  try {
    sdkFromDbxFirebase = resolveFirestoreSdkIdentity(createRequire(requireFromDbxCli.resolve('@dereekb/firebase')));
  } catch (e) {
    sdkFromDbxFirebase = { error: e instanceof Error ? e.message : String(e) };
  }

  let firebaseVersion: Maybe<string>;

  try {
    firebaseVersion = readPackageVersion(requireFromDbxCli, 'firebase/package.json');
  } catch {
    // the umbrella version is context for the report, not a finding on its own
    firebaseVersion = undefined;
  }

  return { sdkFromDbxCli, sdkFromDbxFirebase, ...(firebaseVersion == null ? {} : { firebaseVersion }) };
}

/**
 * Resolves `@firebase/firestore`'s package directory + version through one `require`.
 *
 * Resolves `package.json` rather than the package entry because the entry differs per export
 * condition (`index.node.cjs.js` vs `index.node.mjs`), which would report two copies where there is
 * one. The `package.json` path is condition-independent, so its directory is a stable identity.
 *
 * @param resolver - The `require` to resolve through.
 * @returns The module identity, with `error` set when resolution failed.
 */
function resolveFirestoreSdkIdentity(resolver: NodeJS.Require): CliFirestoreSdkModuleIdentity {
  let result: CliFirestoreSdkModuleIdentity;

  try {
    const packageJsonPath = resolver.resolve('@firebase/firestore/package.json');
    const version = readPackageVersion(resolver, '@firebase/firestore/package.json');
    result = { packageDir: dirname(packageJsonPath), ...(version == null ? {} : { version }) };
  } catch (e) {
    result = { error: e instanceof Error ? e.message : String(e) };
  }

  return result;
}

/**
 * Reads a resolvable `package.json`'s `version`.
 *
 * @param resolver - The `require` to load through.
 * @param specifier - The `package.json` specifier.
 * @returns The version string, or `undefined` when absent.
 */
function readPackageVersion(resolver: NodeJS.Require, specifier: string): Maybe<string> {
  const contents = resolver(specifier) as { readonly version?: unknown };
  return typeof contents.version === 'string' ? contents.version : undefined;
}
