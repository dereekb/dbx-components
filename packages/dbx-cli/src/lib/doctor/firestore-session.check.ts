import { type Maybe } from '@dereekb/util';
import { discoverOidcMetadata, refreshAccessToken } from '../auth/oidc.client';
import { type CliEnvConfig, cliFirebaseEmulatorsInUse, isCliFirebaseConfigComplete, readEnvTokenEntry } from '../config/env';
import { buildCliPaths } from '../config/paths';
import { createCliTokenCacheStore, isTokenExpired } from '../config/token.cache';
import { type CliFirestoreBinding } from '../firestore/firestore.models';
import { type CliReadSourceReason } from '../firestore/firestore.read';
import { type CliFirestoreSessionContext, closeCliFirestoreSessionContext, createCliFirestoreSessionContext } from '../firestore/firestore.session';
import { isCliFirestoreQueryInvocable } from '../firestore/query-mode';
import { FIRESTORE_SDK_IDENTITY_STAGE, FIRESTORE_SDK_INSTANCE_MISMATCH_CODE, cliFirestoreSdkIdentitySuggestion, inspectCliFirestoreSdkIdentity } from '../firestore/firestore.sdk-identity';
import { type CliFirestoreQueryManifest, type CliModelManifest } from '../manifest/types';
import { type DoctorCheck, type DoctorCheckResult } from './doctor.command.factory';

/**
 * Name reported by the check {@link createFirestoreSessionDoctorCheck} builds.
 */
export const FIRESTORE_SESSION_DOCTOR_CHECK_NAME = 'firestore-session';

/**
 * An app-supplied read that proves the direct Firestore connection works end to end.
 *
 * The framework cannot know which collection is rules-protected in a given app, so the last hop —
 * "App Check accepted and a rules-protected read succeeded" — is delegated. Point it at a collection
 * an admin may list and a non-admin may not (e.g. `getDocs(query(collection(firestore, 'wk'), limit(1)))`).
 *
 * Return anything JSON-serializable; it is surfaced on the check's `detail.probe`.
 */
export type FirestoreSessionDoctorProbe = (context: CliFirestoreSessionContext) => Promise<unknown>;

export interface CreateFirestoreSessionDoctorCheckInput {
  /**
   * The rules-protected read that proves the session is genuinely usable. Strongly recommended —
   * without it the check stops after sign-in and cannot tell whether App Check was accepted.
   */
  readonly probe?: FirestoreSessionDoctorProbe;
  /**
   * Human-readable label for what the probe reads, surfaced in the check detail (e.g. `list /wk`).
   */
  readonly probeName?: string;
  /**
   * The same `firestore` binding passed to `runCli`. Doctor checks run PRE-AUTH with no `CliContext`,
   * so the binding cannot be discovered — pass it here and the check reports whether
   * `CliContext.getFirestoreModels` would exist, and therefore whether `--via auto` can ever go direct.
   */
  readonly firestore?: CliFirestoreBinding;
  /**
   * The same `modelManifest` passed to `runCli`, for the server-only model count.
   */
  readonly modelManifest?: CliModelManifest;
  /**
   * The same `firestoreQueryManifest` passed to `runCli`, for the invocable query-entry count.
   */
  readonly firestoreQueryManifest?: CliFirestoreQueryManifest;
}

/**
 * The read-routing summary the check reports alongside the session handshake — the `--via auto`
 * decision an operator would otherwise have to infer from three separate facts.
 */
export interface FirestoreSessionDoctorReadRouting {
  /**
   * Whether `CliContext.getFirestoreModels` exists — i.e. `runCli` was given a `firestore` binding.
   */
  readonly getFirestoreModels: boolean;
  /**
   * What `--via auto` would choose given the state this check just observed.
   */
  readonly readPreference: 'firestore' | 'api';
  readonly reason: CliReadSourceReason;
  /**
   * Query-catalog entries `firestore-query` can actually run: the factory bound to a real runtime
   * export AND `firestore.rules` does not refuse the query at every scope.
   *
   * `unavailable` entries are deliberately EXCLUDED. Counting them was the bug this number had:
   * an entry with a bound factory over a collection with no `/{path=**}/` rule reported as invocable
   * and then failed with `permission-denied` on every call, so `invocableQueryEntries: 128/128` was
   * a claim the CLI could not honour for about a third of the catalog.
   */
  readonly invocableQueryEntries: number;
  readonly totalQueryEntries: number;
  /**
   * Entries `firestore.rules` refuses at every scope (`queryMode: 'unavailable'`) — the query-level
   * analogue of {@link serverOnlyModels}, surfaced the same way because it has the same consequence.
   */
  readonly unavailableQueryEntries: number;
  /**
   * Entries that address ONE parent document's subcollection (`queryMode: 'parent-child'`), so they
   * run only when scoped with `--parent`.
   */
  readonly parentChildQueryEntries: number;
  /**
   * Whether the query manifest carries invocation modes at all — false when its generator ran
   * without `--rules`, in which case the two counts above are structurally `0` rather than
   * genuinely clean.
   */
  readonly queryModesScanned: boolean;
  /**
   * Models the manifest marks `@dbxModelServerOnly` — refused on every `--via` value.
   */
  readonly serverOnlyModels: number;
}

/**
 * Summarizes the `--via auto` routing decision from what doctor can observe.
 *
 * @param input - The wired bindings/manifests plus whether the session actually opened.
 * @param input.firestore - The `firestore` binding, when supplied.
 * @param input.modelManifest - The model manifest, when supplied.
 * @param input.firestoreQueryManifest - The query manifest, when supplied.
 * @param input.firebaseConfigComplete - Whether the env carries a complete Firebase client config.
 * @param input.sessionOpened - Whether the session handshake succeeded in this run.
 * @returns The routing summary.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildFirestoreSessionDoctorReadRouting(input: {
  readonly firestore?: CliFirestoreBinding;
  readonly modelManifest?: CliModelManifest;
  readonly firestoreQueryManifest?: CliFirestoreQueryManifest;
  readonly firebaseConfigComplete: boolean;
  readonly sessionOpened: boolean;
}): FirestoreSessionDoctorReadRouting {
  const getFirestoreModels = input.firestore != null;
  let reason: CliReadSourceReason;

  if (!getFirestoreModels) {
    reason = 'no-firestore-binding';
  } else if (!input.firebaseConfigComplete) {
    reason = 'firebase-config-incomplete';
  } else if (input.sessionOpened) {
    reason = 'session-available';
  } else {
    reason = 'session-unavailable';
  }

  const entries = input.firestoreQueryManifest ?? [];

  return {
    getFirestoreModels,
    readPreference: reason === 'session-available' ? 'firestore' : 'api',
    reason,
    invocableQueryEntries: entries.filter((e) => isCliFirestoreQueryInvocable(e)).length,
    totalQueryEntries: entries.length,
    unavailableQueryEntries: entries.filter((e) => e.queryMode === 'unavailable').length,
    parentChildQueryEntries: entries.filter((e) => e.queryMode === 'parent-child').length,
    queryModesScanned: entries.some((e) => e.queryMode != null),
    serverOnlyModels: (input.modelManifest ?? []).filter((m) => m.serverOnly === true).length
  };
}

/**
 * Builds the doctor check for the direct-Firestore session path.
 *
 * This is the **fail-loudly surface** for the feature: `CliContext.getFirestoreContext()` throws
 * rather than falling back to the HTTP model API, so `doctor` is where an operator finds out which
 * hop broke. It walks the whole chain in order:
 *
 * 1. the env carries a complete Firebase client config;
 * 2. a usable access token is available (cached, env-supplied, or refreshed);
 * 3. `GET /session/firestore` is reachable and mints a custom token (+ an App Check token when the
 *    API is configured with a web `appId`);
 * 4. `signInWithCustomToken` succeeds against the configured project;
 * 5. the session's Firestore handle is one the loaded client SDK accepts (`inspectCliFirestoreSdkIdentity`),
 *    reported as `stage: 'firestore-sdk-identity'`. Sits between the sign-in and the read because it
 *    is the hop whose failure otherwise MASQUERADES as the read's: the handshake returns a uid, and
 *    the read then dies on the SDK's `Expected first argument to collection() to be …` — a message
 *    that names neither the model nor the handle, and sends the operator to rules and App Check
 *    instead of to a duplicated SDK or a stale artifact;
 * 6. the app-supplied {@link FirestoreSessionDoctorProbe} performs one rules-protected read.
 *
 * Doctor checks run PRE-AUTH — `DoctorCheckInput` is only `{ cliName, envName, env, config }`, with no
 * token and no `CliContext` — so this loads credentials itself via `buildCliPaths` +
 * `createCliTokenCacheStore`, matching the built-in `token-cache-fresh` / `token-refresh-round-trip`
 * checks.
 *
 * @param input - Optional probe configuration.
 * @returns A {@link DoctorCheck} to append to a CLI's `doctor` check list.
 * @__NO_SIDE_EFFECTS__
 */
export function createFirestoreSessionDoctorCheck(input: CreateFirestoreSessionDoctorCheckInput = {}): DoctorCheck {
  const { probe, probeName } = input;

  /**
   * Folds the read-routing summary onto whatever the session chain produced, so `doctor` answers
   * "which path will a read take, and why" in one place instead of leaving it to be inferred.
   *
   * @param result - The session-chain result.
   * @param firebaseConfigComplete - Whether the env carries a complete Firebase client config.
   * @returns The result with `detail.readRouting` attached.
   */
  function withReadRouting(result: DoctorCheckResult, firebaseConfigComplete: boolean): DoctorCheckResult {
    const readRouting = buildFirestoreSessionDoctorReadRouting({
      ...(input.firestore === undefined ? {} : { firestore: input.firestore }),
      ...(input.modelManifest === undefined ? {} : { modelManifest: input.modelManifest }),
      ...(input.firestoreQueryManifest === undefined ? {} : { firestoreQueryManifest: input.firestoreQueryManifest }),
      firebaseConfigComplete,
      sessionOpened: result.ok
    });

    return { ...result, detail: { ...(typeof result.detail === 'object' && result.detail != null ? result.detail : {}), readRouting } };
  }

  return async ({ cliName, envName, env }) => {
    let result: DoctorCheckResult;

    if (envName && env) {
      const firebaseConfigComplete = isCliFirebaseConfigComplete(env.firebase);

      if (firebaseConfigComplete) {
        const accessToken = await resolveDoctorAccessToken({ cliName, envName, env });

        if (accessToken) {
          result = withReadRouting(await runFirestoreSessionProbe({ cliName, envName, env, accessToken, probe, probeName }), true);
        } else {
          result = withReadRouting(
            {
              name: FIRESTORE_SESSION_DOCTOR_CHECK_NAME,
              ok: false,
              detail: { reason: 'no-access-token' },
              suggestion: `Run \`${cliName} auth login --env ${envName}\`.`
            },
            true
          );
        }
      } else {
        result = withReadRouting(
          {
            name: FIRESTORE_SESSION_DOCTOR_CHECK_NAME,
            ok: false,
            detail: { reason: 'firebase-config-incomplete' },
            suggestion: `Set \`firebase.apiKey\`, \`firebase.projectId\`, and \`firebase.appId\` on env "${envName}" (or via ${envVarPrefix(cliName)}_FIREBASE_* environment variables).`
          },
          false
        );
      }
    } else {
      result = withReadRouting({ name: FIRESTORE_SESSION_DOCTOR_CHECK_NAME, ok: false, detail: { reason: 'no-env' }, suggestion: 'No env to check.' }, false);
    }

    return result;
  };
}

interface RunFirestoreSessionProbeInput {
  readonly cliName: string;
  readonly envName: string;
  readonly env: CliEnvConfig;
  readonly accessToken: string;
  readonly probe?: FirestoreSessionDoctorProbe;
  readonly probeName?: string;
}

async function runFirestoreSessionProbe(input: RunFirestoreSessionProbeInput): Promise<DoctorCheckResult> {
  const { cliName, envName, env, accessToken, probe, probeName } = input;
  const usingEmulators = cliFirebaseEmulatorsInUse(env.firebase);

  let context: Maybe<CliFirestoreSessionContext>;
  let handshakeError: Maybe<unknown>;

  try {
    context = await createCliFirestoreSessionContext({ cliName, envName, env, accessToken });
  } catch (e) {
    handshakeError = e;
  }

  let result: DoctorCheckResult;

  if (context) {
    const appCheckUsed = Boolean(context.session.appCheckToken) && !usingEmulators;
    // Runs BEFORE the probe on purpose. The handshake can succeed — a uid and an expiry come back —
    // and the read still fail at the point the session's Firestore handle becomes a collection
    // reference, which is a wiring/version fault the read's own error cannot describe. Reported even
    // when it passes, because the module provenance is what rules the duplicated-SDK hypothesis in or
    // out without an investigation.
    const sdkIdentity = inspectCliFirestoreSdkIdentity({ firestoreContext: context.firestoreContext });
    const baseDetail = {
      uid: context.session.uid,
      expiresAt: context.session.expiresAt,
      appCheckTokenMinted: Boolean(context.session.appCheckToken),
      appCheckUsed,
      usingEmulators,
      // the on-disk session cache is invisible from the outside — a cache hit means this run paid no
      // `GET /session/firestore`, which is the difference between a fast read and a slow one
      sessionFromCache: context.fromCache,
      sdkIdentity
    };

    if (!sdkIdentity.ok) {
      result = {
        name: FIRESTORE_SESSION_DOCTOR_CHECK_NAME,
        ok: false,
        detail: { ...baseDetail, stage: FIRESTORE_SDK_IDENTITY_STAGE, code: FIRESTORE_SDK_INSTANCE_MISMATCH_CODE, probe: 'not-attempted' },
        // non-null: `cliFirestoreSdkIdentitySuggestion` returns a string for every `problem`, and
        // `ok: false` guarantees one is set
        suggestion: cliFirestoreSdkIdentitySuggestion(sdkIdentity) as string
      };
    } else if (probe) {
      try {
        const probeResult = await probe(context);
        result = { name: FIRESTORE_SESSION_DOCTOR_CHECK_NAME, ok: true, detail: { ...baseDetail, probe: probeName ?? 'ok', probeResult } };
      } catch (e) {
        result = {
          name: FIRESTORE_SESSION_DOCTOR_CHECK_NAME,
          ok: false,
          detail: { ...baseDetail, stage: 'rules-protected-read', probe: probeName, error: e instanceof Error ? e.message : String(e) },
          suggestion: appCheckUsed
            ? 'Signed in, but the rules-protected read failed. Either the signed-in user lacks the claims the rules require, or the App Check token was rejected — verify the API mints for the same registered web app this env targets.'
            : 'Signed in without an App Check attestation. If the project enforces App Check on Firestore, configure `appCheckAppId` on the API session module.'
        };
      }
    } else {
      result = {
        name: FIRESTORE_SESSION_DOCTOR_CHECK_NAME,
        ok: true,
        detail: { ...baseDetail, probe: 'not-configured' },
        suggestion: 'Signed in, but no rules-protected read was attempted. Pass a `probe` to `createFirestoreSessionDoctorCheck` so the check can prove App Check is accepted and rules pass.'
      };
    }
  } else {
    result = {
      name: FIRESTORE_SESSION_DOCTOR_CHECK_NAME,
      ok: false,
      detail: { stage: 'session-handshake', error: handshakeError instanceof Error ? handshakeError.message : String(handshakeError) },
      suggestion: `The API must register the firebase-server session module and list '/api/session' in the OIDC \`protectedPaths\`, and the logged-in user must be an admin holding the \`session.firestore\` scope. Re-run \`${cliName} auth login --env ${envName}\` if the scope is newly added.`
    };
  }

  // This probe opens its OWN session rather than going through the context's memo, so the runner's
  // teardown does not cover it — and a doctor run that left it open would hang the CLI after
  // printing its report, which is exactly the failure `closeCliFirestoreSessionContext` exists to
  // prevent. Closing here rather than in the caller keeps ownership with whoever opened it.
  if (context) {
    await closeCliFirestoreSessionContext(context);
  }

  return result;
}

interface ResolveDoctorAccessTokenInput {
  readonly cliName: string;
  readonly envName: string;
  readonly env: CliEnvConfig;
}

/**
 * Resolves a usable access token the way the auth middleware does, but without mutating the cache —
 * doctor is a diagnostic and should not have side effects on stored credentials.
 *
 * @param input - The CLI name, env name, and resolved env.
 * @returns A usable access token, or `undefined` when none can be obtained.
 */
async function resolveDoctorAccessToken(input: ResolveDoctorAccessTokenInput): Promise<Maybe<string>> {
  const { cliName, envName, env } = input;
  const paths = buildCliPaths({ cliName });
  const tokens = createCliTokenCacheStore({ tokenCachePath: paths.tokenCachePath });
  const entry = (await tokens.get(envName)) ?? readEnvTokenEntry({ cliName });

  let result: Maybe<string>;

  if (entry?.accessToken && !isTokenExpired(entry)) {
    result = entry.accessToken;
  } else if (entry?.refreshToken && env.clientId && env.clientSecret) {
    try {
      const meta = await discoverOidcMetadata({ issuer: env.oidcIssuer, fallbackBaseUrl: env.apiBaseUrl });
      const refreshed = await refreshAccessToken({
        tokenEndpoint: meta.token_endpoint,
        clientId: env.clientId,
        clientSecret: env.clientSecret,
        refreshToken: entry.refreshToken
      });
      result = refreshed.access_token;
    } catch {
      result = undefined;
    }
  }

  return result;
}

function envVarPrefix(cliName: string): string {
  return cliName.replaceAll('-', '_').toUpperCase();
}
