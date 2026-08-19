import { type Maybe } from '@dereekb/util';
import { discoverOidcMetadata, refreshAccessToken } from '../auth/oidc.client';
import { type CliEnvConfig, cliFirebaseEmulatorsInUse, isCliFirebaseConfigComplete, readEnvTokenEntry } from '../config/env';
import { buildCliPaths } from '../config/paths';
import { createCliTokenCacheStore, isTokenExpired } from '../config/token.cache';
import { type CliFirestoreSessionContext, createCliFirestoreSessionContext } from '../firestore/firestore.session';
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
 * 5. the app-supplied {@link FirestoreSessionDoctorProbe} performs one rules-protected read.
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

  return async ({ cliName, envName, env }) => {
    let result: DoctorCheckResult;

    if (envName && env) {
      if (isCliFirebaseConfigComplete(env.firebase)) {
        const accessToken = await resolveDoctorAccessToken({ cliName, envName, env });

        if (accessToken) {
          result = await runFirestoreSessionProbe({ cliName, envName, env, accessToken, probe, probeName });
        } else {
          result = {
            name: FIRESTORE_SESSION_DOCTOR_CHECK_NAME,
            ok: false,
            detail: { reason: 'no-access-token' },
            suggestion: `Run \`${cliName} auth login --env ${envName}\`.`
          };
        }
      } else {
        result = {
          name: FIRESTORE_SESSION_DOCTOR_CHECK_NAME,
          ok: false,
          detail: { reason: 'firebase-config-incomplete' },
          suggestion: `Set \`firebase.apiKey\`, \`firebase.projectId\`, and \`firebase.appId\` on env "${envName}" (or via ${envVarPrefix(cliName)}_FIREBASE_* environment variables).`
        };
      }
    } else {
      result = { name: FIRESTORE_SESSION_DOCTOR_CHECK_NAME, ok: false, detail: { reason: 'no-env' }, suggestion: 'No env to check.' };
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
    const baseDetail = {
      uid: context.session.uid,
      expiresAt: context.session.expiresAt,
      appCheckTokenMinted: Boolean(context.session.appCheckToken),
      appCheckUsed,
      usingEmulators
    };

    if (probe) {
      try {
        const probeResult = await probe(context);
        result = { name: FIRESTORE_SESSION_DOCTOR_CHECK_NAME, ok: true, detail: { ...baseDetail, probe: probeName ?? 'ok', probeResult } };
      } catch (e) {
        result = {
          name: FIRESTORE_SESSION_DOCTOR_CHECK_NAME,
          ok: false,
          detail: { ...baseDetail, stage: 'rules-protected-read', probe: probeName, error: e instanceof Error ? e.message : String(e) },
          suggestion: appCheckUsed ? 'Signed in, but the rules-protected read failed. Either the signed-in user lacks the claims the rules require, or the App Check token was rejected — verify the API mints for the same registered web app this env targets.' : 'Signed in without an App Check attestation. If the project enforces App Check on Firestore, configure `appCheckAppId` on the API session module.'
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
