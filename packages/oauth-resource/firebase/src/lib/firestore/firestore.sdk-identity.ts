import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { Firestore } from 'firebase/firestore';
import { type Maybe } from '@dereekb/util';

/**
 * The `drivers.firestoreDriverIdentifier` a client-SDK `FirestoreContext` reports.
 *
 * `clientFirebaseFirestoreContextFactory` stamps this; the server's
 * `googleCloudFirestoreContextFactory` stamps `@google-cloud/firestore` instead. Comparing against
 * it is how {@link inspectFirebaseClientFirestoreIdentity} tells an admin-SDK context that reached
 * the client-SDK read path apart from a genuinely broken client one.
 */
export const CLIENT_FIRESTORE_DRIVER_IDENTIFIER = '@firebase/firestore';

/**
 * The distinct ways a session's Firestore handle can be unusable, in the order
 * {@link inspectFirebaseClientFirestoreIdentity} tests them — most specific diagnosis first.
 */
export type FirebaseClientFirestoreIdentityProblem =
  /**
   * `firestoreContext` is absent, or its `firestore` is null/undefined. Every `collection()` call
   * built off it throws `Expected first argument to collection() to be a CollectionReference, a
   * DocumentReference or FirebaseFirestore` — the SDK's message for ANY non-Firestore first
   * argument, which is why it never named this.
   */
  | 'no-firestore-handle'
  /**
   * The context reports a driver other than {@link CLIENT_FIRESTORE_DRIVER_IDENTIFIER} — an
   * admin/`@google-cloud/firestore` context reached the client-SDK read path.
   *
   * This is the guard for the security property the whole user-scoped session path rests on: the
   * client SDK is the only Firestore transport that carries a user ID token and is therefore
   * rules-evaluated. An Admin-SDK context reaching here is a bug, not a fallback.
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
 * Reported for both the calling consumer and `@dereekb/firebase` because the whole point of the
 * duplicated-SDK hypothesis is that those two answers can differ.
 */
export interface FirebaseClientFirestoreSdkModuleIdentity {
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
 * The provenance + brand-check report {@link inspectFirebaseClientFirestoreIdentity} produces.
 *
 * Everything here is reported whether or not the check passed: a `sdkDuplicated: true` alongside
 * `ok: true` is a latent hazard worth seeing before it becomes an outage.
 */
export interface FirebaseClientFirestoreIdentityReport {
  readonly ok: boolean;
  readonly problem?: FirebaseClientFirestoreIdentityProblem;
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
  /**
   * Where the CONSUMER (this package, or whoever supplied a `consumerRequire`) resolves the SDK.
   */
  readonly sdkFromConsumer: FirebaseClientFirestoreSdkModuleIdentity;
  readonly sdkFromDbxFirebase: FirebaseClientFirestoreSdkModuleIdentity;
  /**
   * True when the two resolutions above name DIFFERENT package directories.
   */
  readonly sdkDuplicated: boolean;
}

/**
 * The slice of a session context {@link inspectFirebaseClientFirestoreIdentity} reads.
 *
 * Deliberately looser than `FirestoreContext`: this check exists precisely for the case where the
 * object is not the shape its declared type claims, so narrowing it here would assume away the
 * failure. A real `FirebaseUserSession['firestoreContext']` is structurally assignable.
 */
export interface FirebaseClientFirestoreIdentityContext {
  readonly firestore?: unknown;
  readonly drivers?: {
    readonly firestoreDriverIdentifier?: unknown;
  };
}

/**
 * Input for {@link inspectFirebaseClientFirestoreIdentity}.
 */
export interface InspectFirebaseClientFirestoreIdentityInput {
  readonly firestoreContext?: Maybe<FirebaseClientFirestoreIdentityContext>;
  /**
   * `createRequire(import.meta.url)` from the CONSUMER package. The duplicated-SDK hypothesis is
   * exactly "do these two consumers see the same copy", so the resolution root must be the
   * caller's. Defaults to this package's own.
   */
  readonly consumerRequire?: Maybe<NodeJS.Require>;
  /**
   * Names the consumer in the suggestion text. Defaults to `'@dereekb/oauth-resource/firebase'`.
   */
  readonly consumerName?: Maybe<string>;
}

/**
 * Default {@link InspectFirebaseClientFirestoreIdentityInput.consumerName}.
 */
export const DEFAULT_FIRESTORE_IDENTITY_CONSUMER_NAME = '@dereekb/oauth-resource/firebase';

/**
 * Checks that a session's Firestore handle is one THIS copy of the client SDK will accept, and
 * reports where every consumer resolved the SDK from.
 *
 * Exists because `collection()` refuses any non-`Firestore` first argument with one message —
 * `Expected first argument to collection() to be a CollectionReference, a DocumentReference or
 * FirebaseFirestore` — that names neither the model, nor the collection, nor which of the four
 * distinct causes ({@link FirebaseClientFirestoreIdentityProblem}) produced it.
 *
 * Lives in this package rather than in a consumer because the `instanceof Firestore` brand check
 * must be performed by the module that CONSTRUCTS the handle, and that module is
 * `openFirebaseUserSession`.
 *
 * The `instanceof` test is the load-bearing one and it is deliberately NOT structural: an identity
 * check across the package boundary is the only thing that can detect a duplicated
 * `@firebase/firestore`, which is exactly what a structural check would hide.
 *
 * @param input - The session's `firestoreContext`, when one was built, plus the consumer's
 *   resolution root.
 * @returns The provenance + brand-check report.
 */
export function inspectFirebaseClientFirestoreIdentity(input: InspectFirebaseClientFirestoreIdentityInput): FirebaseClientFirestoreIdentityReport {
  const firestore = input.firestoreContext?.firestore;
  const driverIdentifier = input.firestoreContext?.drivers?.firestoreDriverIdentifier;
  const firestoreDriverIdentifier = typeof driverIdentifier === 'string' ? driverIdentifier : undefined;
  const firestorePresent = firestore != null;
  const firestoreIsSdkInstance = firestore instanceof Firestore;
  const firestoreConstructor = firestoreConstructorName(firestore);
  const modules = resolveFirebaseClientFirestoreSdkModules(input.consumerRequire);
  const sdkDuplicated = modules.sdkFromConsumer.packageDir != null && modules.sdkFromDbxFirebase.packageDir != null && modules.sdkFromConsumer.packageDir !== modules.sdkFromDbxFirebase.packageDir;

  let problem: Maybe<FirebaseClientFirestoreIdentityProblem>;

  if (!firestorePresent) {
    problem = 'no-firestore-handle';
  } else if (firestoreDriverIdentifier != null && firestoreDriverIdentifier !== CLIENT_FIRESTORE_DRIVER_IDENTIFIER) {
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
 * The actionable next step for a failed {@link inspectFirebaseClientFirestoreIdentity}, keyed on
 * which problem was found.
 *
 * Each branch names the fix rather than the symptom — a raw SDK sentence sends an operator looking at
 * security rules and App Check, neither of which is ever the cause here.
 *
 * @param report - The report to describe.
 * @param overrides - Per-problem replacement text, for a consumer whose operator-facing wording
 *   names its own remediation (`re-run with --verbose`, `rebuild the CLI`, …).
 * @param consumerName - Names the consumer in the duplicated-SDK text. Defaults to
 *   {@link DEFAULT_FIRESTORE_IDENTITY_CONSUMER_NAME}.
 * @returns The suggestion, or `undefined` when the report passed.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function firebaseClientFirestoreIdentitySuggestion(report: FirebaseClientFirestoreIdentityReport, overrides?: Maybe<Partial<Record<FirebaseClientFirestoreIdentityProblem, string>>>, consumerName?: Maybe<string>): Maybe<string> {
  const consumer = consumerName || DEFAULT_FIRESTORE_IDENTITY_CONSUMER_NAME;
  const override = report.problem == null ? undefined : overrides?.[report.problem];
  let result: Maybe<string>;

  if (override == null) {
    switch (report.problem) {
      case 'no-firestore-handle':
        result = `The session produced no Firestore handle, so every collection reference built from it fails. This is a wiring fault, not a rules or App Check fault — verify the handshake completed and that ${consumer} resolves ONE \`@dereekb/firebase\`.`;
        break;
      case 'unexpected-driver':
        result = `The \`FirestoreContext\` reports driver "${report.firestoreDriverIdentifier}", not "${CLIENT_FIRESTORE_DRIVER_IDENTIFIER}". An admin-SDK context reached the client-SDK read path — build the context with \`clientFirebaseFirestoreContextFactory\`, not \`googleCloudFirestoreContextFactory\`.`;
        break;
      case 'duplicated-firestore-sdk':
        result = `Two copies of \`@firebase/firestore\` are loaded — ${consumer} resolves ${report.sdkFromConsumer.packageDir}, \`@dereekb/firebase\` resolves ${report.sdkFromDbxFirebase.packageDir} — so the handle one minted fails the other's brand check. Dedupe the install (\`npm ls @firebase/firestore\`) and rebuild.`;
        break;
      case 'foreign-firestore-instance':
        result = `The session's handle (\`${report.firestoreConstructor ?? 'unknown'}\`) is not an instance of the loaded SDK's \`Firestore\`, and only one copy of \`@firebase/firestore\` is installed. The likeliest cause is a STALE build artifact running against a newer \`@dereekb/*\` in \`node_modules\` — rebuild ${consumer}'s consumer and re-run.`;
        break;
      default:
        result = undefined;
        break;
    }
  } else {
    result = override;
  }

  return result;
}

// MARK: Internal
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
 * The resolution half of {@link FirebaseClientFirestoreIdentityReport} — everything derivable from
 * `node_modules` alone, with no session in hand.
 */
type FirebaseClientFirestoreSdkModules = Pick<FirebaseClientFirestoreIdentityReport, 'sdkFromConsumer' | 'sdkFromDbxFirebase' | 'firebaseVersion'>;

/**
 * Resolves `@firebase/firestore` from both the consumer and `@dereekb/firebase`, plus the `firebase`
 * umbrella version.
 *
 * `createRequire` rather than `import.meta.resolve` because the resolution has to be performed
 * relative to ANOTHER package's location (`@dereekb/firebase`'s entry file) to answer the question
 * that matters — whether the two consumers see the same copy.
 *
 * @param consumerRequire - The consumer's own `require`. Defaults to this package's.
 * @returns The two module identities and the umbrella version, each degrading to an `error` field
 *   rather than throwing: this runs inside a diagnostic, and a failed resolution is itself a finding.
 */
function resolveFirebaseClientFirestoreSdkModules(consumerRequire: Maybe<NodeJS.Require>): FirebaseClientFirestoreSdkModules {
  const requireFromConsumer = consumerRequire ?? createRequire(import.meta.url);
  const sdkFromConsumer = resolveFirestoreSdkIdentity(requireFromConsumer);
  let sdkFromDbxFirebase: FirebaseClientFirestoreSdkModuleIdentity;

  try {
    sdkFromDbxFirebase = resolveFirestoreSdkIdentity(createRequire(requireFromConsumer.resolve('@dereekb/firebase')));
  } catch (e) {
    sdkFromDbxFirebase = { error: e instanceof Error ? e.message : String(e) };
  }

  let firebaseVersion: Maybe<string>;

  try {
    firebaseVersion = readPackageVersion(requireFromConsumer, 'firebase/package.json');
  } catch {
    // the umbrella version is context for the report, not a finding on its own
    firebaseVersion = undefined;
  }

  return { sdkFromConsumer, sdkFromDbxFirebase, ...(firebaseVersion == null ? {} : { firebaseVersion }) };
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
function resolveFirestoreSdkIdentity(resolver: NodeJS.Require): FirebaseClientFirestoreSdkModuleIdentity {
  let result: FirebaseClientFirestoreSdkModuleIdentity;

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
