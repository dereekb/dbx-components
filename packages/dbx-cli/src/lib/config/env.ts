import { type Maybe } from '@dereekb/util';
import { type CliTokenEntry } from './token.cache';

/**
 * The default OAuth/OIDC scopes requested by the CLI when none are configured.
 */
export const DEFAULT_CLI_OIDC_SCOPES = 'openid profile email';

/**
 * The `model.*` write scopes filtered out by {@link filterReadOnlyModelScopes}.
 *
 * Mirrors the write half of the dbx-components callModel CRUD scope set
 * (`CALL_MODEL_OIDC_SCOPES` in `@dereekb/firebase`) — duplicated here so the
 * CLI doesn't take a server-side dependency just to know the names.
 */
export const MODEL_WRITE_OIDC_SCOPES = ['model.create', 'model.update', 'model.delete'] as const;

/**
 * The default redirect URI used by the CLI.
 *
 * Opens up to nothing in the browser so the user can copy/paste the resulting token url back into the CLI.
 */
export const DEFAULT_CLI_REDIRECT_URI = 'http://127.0.0.1:0/callback';

/**
 * The generic OIDC scopes a `--service-token` login adds to the requested set.
 *
 * `token.service` triggers the admin-only, long-lived, non-rotating behavior server-side;
 * `offline_access` is required so a refresh token is issued (the durable credential the server env
 * consumes). The app's own resource scope (e.g. `demo`) is intentionally NOT included here — it
 * already lives in the configured `env.scopes`, keeping this generic CLI app-agnostic.
 */
export const SERVICE_TOKEN_REQUIRED_OIDC_SCOPES = ['token.service', 'offline_access'] as const;

/**
 * Returns the input scope string with the `model.create`, `model.update`, and `model.delete`
 * scopes removed, preserving every other scope (including `model.read` and `model.query`).
 *
 * Drives the `auth login --read-only-scopes` flag: when a CLI's env defaults request the
 * full callModel CRUD scope set, this trims the request down to read/query only.
 *
 * @param scopes - Space-separated scope list, or `undefined` to filter the default scopes.
 * @returns The filtered space-separated scope list.
 */
export function filterReadOnlyModelScopes(scopes: Maybe<string>): string {
  const writeScopes = new Set<string>(MODEL_WRITE_OIDC_SCOPES);
  return (scopes ?? DEFAULT_CLI_OIDC_SCOPES)
    .split(/\s+/)
    .filter((s) => s.length > 0 && !writeScopes.has(s))
    .join(' ');
}

/**
 * Returns the input scope string with the {@link SERVICE_TOKEN_REQUIRED_OIDC_SCOPES} unioned in
 * (de-duplicated), preserving every other already-requested scope.
 *
 * Drives the `auth login --service-token` flag. Combinable with `filterReadOnlyModelScopes` — apply
 * the read-only filter first, then this, so a service token can still be read-only.
 *
 * @param scopes - Space-separated scope list, or `undefined` to augment the default scopes.
 * @returns The augmented space-separated scope list.
 */
export function withServiceTokenScopes(scopes: Maybe<string>): string {
  const result = new Set<string>((scopes ?? DEFAULT_CLI_OIDC_SCOPES).split(/\s+/).filter((s) => s.length > 0));

  for (const scope of SERVICE_TOKEN_REQUIRED_OIDC_SCOPES) {
    result.add(scope);
  }

  return Array.from(result).join(' ');
}

/**
 * A built-in env config preset shipped with a CLI app.
 *
 * Each preset is addressable by one or more {@link names} (so e.g. `dev` and `local` can resolve
 * to the same default). Values from the user's persisted env shadow these defaults; missing fields
 * fall back to the default.
 */
export interface CliEnvDefault {
  /**
   * Names this default config is addressable by. Each name must be unique across the registered
   * defaults — an env name resolves to at most one default.
   */
  readonly names: readonly string[];
  /**
   * The default config values. Any field can be omitted; the user's stored env (and env-var
   * overrides) shadow these values at resolution time.
   */
  readonly env: Partial<CliEnvConfig>;
}

/**
 * Returns the {@link CliEnvDefault} whose `names` includes the given env name, or `undefined`.
 */
export interface FindCliEnvDefaultInput {
  readonly name: string;
  readonly defaults?: readonly CliEnvDefault[];
}

/**
 * Returns the {@link CliEnvDefault} whose `names` includes the given env name, or `undefined`.
 *
 * @param input - The lookup inputs.
 * @param input.name - The env name to look up.
 * @param input.defaults - The list of registered defaults to search.
 * @returns The matching {@link CliEnvDefault}, or `undefined` when no default registers `name`.
 */
export function findCliEnvDefault(input: FindCliEnvDefaultInput): Maybe<CliEnvDefault> {
  return input.defaults?.find((d) => d.names.includes(input.name));
}

/**
 * Merges a stored env on top of a default env. User-set fields take precedence; empty strings are
 * treated as "not set" so that an `env add <name>` call that didn't pass `--api-base-url` still
 * picks up the default.
 */
export interface MergeCliEnvWithDefaultInput {
  readonly env?: Maybe<CliEnvConfig>;
  readonly defaultEnv?: Maybe<Partial<CliEnvConfig>>;
}

/**
 * Merges a stored env on top of a default env, treating empty strings on either side as "not set".
 *
 * @param input - The merge inputs.
 * @param input.env - The user's persisted env config (or `null`/`undefined`).
 * @param input.defaultEnv - The matching {@link CliEnvDefault}'s partial env values, if any.
 * @returns The merged {@link CliEnvConfig}, or `undefined` when both inputs are empty.
 */
export function mergeCliEnvWithDefault(input: MergeCliEnvWithDefaultInput): Maybe<CliEnvConfig> {
  const e = input.env;
  const d = input.defaultEnv;
  let result: Maybe<CliEnvConfig>;

  if (e || d) {
    result = {
      apiBaseUrl: nonEmpty(e?.apiBaseUrl) ?? nonEmpty(d?.apiBaseUrl) ?? '',
      oidcIssuer: nonEmpty(e?.oidcIssuer) ?? nonEmpty(d?.oidcIssuer) ?? '',
      appClientUrl: nonEmpty(e?.appClientUrl) ?? nonEmpty(d?.appClientUrl),
      clientId: nonEmpty(e?.clientId) ?? nonEmpty(d?.clientId),
      clientSecret: nonEmpty(e?.clientSecret) ?? nonEmpty(d?.clientSecret),
      redirectUri: nonEmpty(e?.redirectUri) ?? nonEmpty(d?.redirectUri),
      scopes: nonEmpty(e?.scopes) ?? nonEmpty(d?.scopes),
      firebase: mergeCliFirebaseConfig(e?.firebase, d?.firebase)
    };
  }

  return result;
}

/**
 * Merges a stored Firebase client config on top of a default one, field by field, so an env can
 * override just the `projectId` of a registered default without restating the whole block.
 *
 * @param env - The user's persisted Firebase config, if any.
 * @param defaultEnv - The registered default's Firebase config, if any.
 * @returns The merged config, or `undefined` when neither side supplies one.
 */
export function mergeCliFirebaseConfig(env: Maybe<CliFirebaseConfig>, defaultEnv: Maybe<CliFirebaseConfig>): CliFirebaseConfig | undefined {
  let result: CliFirebaseConfig | undefined;

  if (env || defaultEnv) {
    const emulators = mergeCliFirebaseEmulatorsConfig(env?.emulators, defaultEnv?.emulators);

    result = {
      apiKey: nonEmpty(env?.apiKey) ?? nonEmpty(defaultEnv?.apiKey),
      authDomain: nonEmpty(env?.authDomain) ?? nonEmpty(defaultEnv?.authDomain),
      projectId: nonEmpty(env?.projectId) ?? nonEmpty(defaultEnv?.projectId),
      appId: nonEmpty(env?.appId) ?? nonEmpty(defaultEnv?.appId),
      ...(emulators ? { emulators } : undefined)
    };
  }

  return result;
}

function mergeCliFirebaseEmulatorsConfig(env: Maybe<CliFirebaseEmulatorsConfig>, defaultEnv: Maybe<CliFirebaseEmulatorsConfig>): CliFirebaseEmulatorsConfig | undefined {
  let result: CliFirebaseEmulatorsConfig | undefined;

  if (env || defaultEnv) {
    result = {
      useEmulators: env?.useEmulators ?? defaultEnv?.useEmulators,
      host: nonEmpty(env?.host) ?? nonEmpty(defaultEnv?.host),
      authPort: env?.authPort ?? defaultEnv?.authPort,
      firestorePort: env?.firestorePort ?? defaultEnv?.firestorePort
    };
  }

  return result;
}

function nonEmpty(value: Maybe<string>): string | undefined {
  return value != null && value.length > 0 ? value : undefined;
}

/**
 * Local Firebase emulator targets for a CLI env.
 *
 * Mirrors the semantics of `DbxFirebaseEmulatorsConfig` in `@dereekb/dbx-firebase` (whose parse
 * helper is Angular-bound and not reusable here): the presence of this object means "use emulators"
 * unless {@link useEmulators} is explicitly `false`.
 *
 * App Check is auto-disabled whenever emulators are in use — the emulators do not verify
 * attestations, and `initializeAppCheck` against a fake project only gets in the way.
 */
export interface CliFirebaseEmulatorsConfig {
  /**
   * Set `false` to keep the emulator targets configured but inactive. Defaults to `true`.
   */
  readonly useEmulators?: boolean;
  /**
   * Host the emulators are reachable at. Defaults to {@link DEFAULT_CLI_FIREBASE_EMULATOR_HOST}.
   */
  readonly host?: string;
  /**
   * Port of the Auth emulator. When unset, Auth is not redirected to an emulator.
   */
  readonly authPort?: number;
  /**
   * Port of the Firestore emulator. When unset, Firestore is not redirected to an emulator.
   */
  readonly firestorePort?: number;
}

/**
 * Firebase client-SDK configuration for a CLI env, used only by the direct-Firestore session
 * (`CliContext.getFirestoreContext`). Everything else the CLI does goes over the model HTTP API and
 * needs none of this.
 *
 * These are the same public values the app's browser client initializes with — copy them from the
 * target app's environment file. `appId` in particular must be the registered **web** app, since the
 * server mints its App Check attestation for that app.
 */
export interface CliFirebaseConfig {
  /**
   * The Firebase web API key.
   */
  readonly apiKey?: string;
  /**
   * The project's auth domain (e.g. `my-project.firebaseapp.com`).
   */
  readonly authDomain?: string;
  /**
   * The Firebase project id.
   */
  readonly projectId?: string;
  /**
   * The registered **web** app id (e.g. `1:1234567890:web:abcdef`).
   */
  readonly appId?: string;
  /**
   * Optional emulator targets for local development.
   */
  readonly emulators?: CliFirebaseEmulatorsConfig;
}

/**
 * Default host used for Firebase emulator connections when a {@link CliFirebaseEmulatorsConfig}
 * omits one.
 */
export const DEFAULT_CLI_FIREBASE_EMULATOR_HOST = 'localhost';

/**
 * Returns true when the env carries the minimum Firebase client config needed to open a direct
 * Firestore session.
 *
 * Deliberately separate from {@link isCliEnvConfigComplete}: the Firebase config is optional, and
 * folding it into the general completeness check would break every CLI that only uses the model API.
 *
 * @param firebase - The env's Firebase client config, if any.
 * @returns `true` when `apiKey`, `projectId`, and `appId` are all present and non-empty.
 */
export function isCliFirebaseConfigComplete(firebase: Maybe<CliFirebaseConfig>): firebase is Required<Pick<CliFirebaseConfig, 'apiKey' | 'projectId' | 'appId'>> & CliFirebaseConfig {
  return Boolean(firebase?.apiKey && firebase?.projectId && firebase?.appId);
}

/**
 * Returns true when the env's emulator config is present and active.
 *
 * @param firebase - The env's Firebase client config, if any.
 * @returns `true` when emulators are configured and not explicitly disabled.
 */
export function cliFirebaseEmulatorsInUse(firebase: Maybe<CliFirebaseConfig>): boolean {
  const emulators = firebase?.emulators;
  return Boolean(emulators && emulators.useEmulators !== false && (emulators.authPort != null || emulators.firestorePort != null));
}

/**
 * Environment-targeting config for a CLI invocation.
 *
 * Each env (e.g. `local`, `staging`, `prod`) holds the API base URL plus the OIDC client
 * registration the user copied from the target app's web UI. Tokens are cached separately
 * (see {@link CliTokenEntry}).
 *
 * The term "env" is used instead of "profile" to avoid colliding with the demo's
 * `Profile` Firestore model — so user-facing flags read `--env local`, not `--profile local`.
 */
export interface CliEnvConfig {
  /**
   * The base URL for the API. The CLI POSTs `<apiBaseUrl>/model/call` for the callModel passthrough.
   */
  readonly apiBaseUrl: string;
  /**
   * The OIDC issuer URL — typically the OIDC controller mount under the API.
   *
   * The CLI fetches `<oidcIssuer>/.well-known/openid-configuration` first (per RFC 8414) and
   * falls back to `<apiBaseUrl>/.well-known/openid-configuration` if the issuer-prefixed path
   * is not served.
   */
  readonly oidcIssuer: string;
  /**
   * Optional base URL for the app's client (frontend). When set, the CLI rebases the discovered
   * `authorization_endpoint` onto this origin so the user is sent to the frontend (which proxies
   * `/oidc/**` to the backend) instead of being sent directly to the API.
   *
   * Useful in local development where the API runs on a separate port from the frontend
   * dev server. In production, leave this unset when the API and frontend share an origin.
   */
  readonly appClientUrl?: string;
  /**
   * The OAuth client ID registered with the target app.
   */
  readonly clientId?: string;
  /**
   * The OAuth client secret registered with the target app.
   */
  readonly clientSecret?: string;
  /**
   * The redirect URI registered with the OAuth client. The CLI does not bind a server — it parses
   * the URL the user pastes back, so this can be any value the OIDC provider accepts as a
   * registered redirect URI (e.g. `http://127.0.0.1:0/callback` or another loopback/placeholder URL).
   *
   * Defaults to {@link DEFAULT_CLI_REDIRECT_URI}.
   */
  readonly redirectUri?: string;
  /**
   * Space-separated OAuth scopes to request. Defaults to {@link DEFAULT_CLI_OIDC_SCOPES}.
   */
  readonly scopes?: string;
  /**
   * Optional Firebase client config enabling the direct-Firestore session
   * (`CliContext.getFirestoreContext()`). Optional by design — a CLI that only calls the model API
   * never needs it, and requiring it would break every existing consumer.
   */
  readonly firebase?: CliFirebaseConfig;
}

/**
 * Resolves the active env name from a flag, env-var, or the persisted config default.
 *
 * Resolution order:
 *   1. CLI `--env` flag
 *   2. `<CLINAME>_ENV` environment variable
 *   3. The `activeEnv` field in the persisted config
 */
export interface ResolveActiveEnvInput {
  readonly flagEnv?: string;
  readonly envVarName: string;
  readonly defaultEnv?: string;
}

/**
 * Resolves the active env name from a flag, env var, or persisted default.
 *
 * @param input - The resolution inputs.
 * @param input.flagEnv - The value passed via `--env` (highest priority).
 * @param input.envVarName - The name of the `<CLINAME>_ENV` env var to consult.
 * @param input.defaultEnv - The persisted `activeEnv` from the config (lowest priority).
 * @returns The first non-empty value among the inputs, or `undefined` when none is set.
 */
export function resolveActiveEnvName(input: ResolveActiveEnvInput): Maybe<string> {
  return input.flagEnv ?? process.env[input.envVarName] ?? input.defaultEnv;
}

/**
 * Applies env-var overrides on top of a stored {@link CliEnvConfig}.
 *
 * The conventional env vars for a CLI named `demo-cli` are:
 *   - `DEMO_CLI_API_BASE_URL`
 *   - `DEMO_CLI_OIDC_ISSUER`
 *   - `DEMO_CLI_APP_CLIENT_URL`
 *   - `DEMO_CLI_CLIENT_ID`
 *   - `DEMO_CLI_CLIENT_SECRET`
 *   - `DEMO_CLI_REDIRECT_URI`
 *   - `DEMO_CLI_SCOPES`
 *
 * Plus the optional direct-Firestore session config:
 *   - `DEMO_CLI_FIREBASE_API_KEY`
 *   - `DEMO_CLI_FIREBASE_AUTH_DOMAIN`
 *   - `DEMO_CLI_FIREBASE_PROJECT_ID`
 *   - `DEMO_CLI_FIREBASE_APP_ID`
 *   - `DEMO_CLI_FIREBASE_EMULATOR_HOST`
 *   - `DEMO_CLI_FIREBASE_AUTH_EMULATOR_PORT`
 *   - `DEMO_CLI_FIREBASE_FIRESTORE_EMULATOR_PORT`
 */
export interface EnvVarOverrideInput {
  readonly cliName: string;
  readonly env: Maybe<CliEnvConfig>;
}

/**
 * Reads `<CLINAME_PREFIX>_*` env vars and overlays them on top of the stored env.
 *
 * @param input - The override inputs.
 * @param input.cliName - The CLI name (used to derive the env-var prefix; e.g. `demo-cli` → `DEMO_CLI`).
 * @param input.env - The base {@link CliEnvConfig} to overlay env-var values on top of.
 * @returns The merged {@link CliEnvConfig}, or `undefined` when both the stored env and every override are empty.
 */
export function applyEnvVarOverrides(input: EnvVarOverrideInput): Maybe<CliEnvConfig> {
  const prefix = input.cliName.replaceAll('-', '_').toUpperCase();
  const apiBaseUrl = process.env[`${prefix}_API_BASE_URL`];
  const oidcIssuer = process.env[`${prefix}_OIDC_ISSUER`];
  const appClientUrl = process.env[`${prefix}_APP_CLIENT_URL`];
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  const redirectUri = process.env[`${prefix}_REDIRECT_URI`];
  const scopes = process.env[`${prefix}_SCOPES`];

  const firebaseApiKey = process.env[`${prefix}_FIREBASE_API_KEY`];
  const firebaseAuthDomain = process.env[`${prefix}_FIREBASE_AUTH_DOMAIN`];
  const firebaseProjectId = process.env[`${prefix}_FIREBASE_PROJECT_ID`];
  const firebaseAppId = process.env[`${prefix}_FIREBASE_APP_ID`];
  const firebaseEmulatorHost = process.env[`${prefix}_FIREBASE_EMULATOR_HOST`];
  const firebaseAuthEmulatorPort = parsePort(process.env[`${prefix}_FIREBASE_AUTH_EMULATOR_PORT`]);
  const firebaseFirestoreEmulatorPort = parsePort(process.env[`${prefix}_FIREBASE_FIRESTORE_EMULATOR_PORT`]);

  const hasFirebaseOverrides = Boolean(firebaseApiKey || firebaseAuthDomain || firebaseProjectId || firebaseAppId || firebaseEmulatorHost || firebaseAuthEmulatorPort != null || firebaseFirestoreEmulatorPort != null);
  const hasOverrides = apiBaseUrl || oidcIssuer || appClientUrl || clientId || clientSecret || redirectUri || scopes || hasFirebaseOverrides;
  let result: Maybe<CliEnvConfig>;

  if (!input.env && !hasOverrides) {
    result = undefined;
  } else {
    const firebase = mergeCliFirebaseConfig(
      {
        apiKey: firebaseApiKey,
        authDomain: firebaseAuthDomain,
        projectId: firebaseProjectId,
        appId: firebaseAppId,
        ...(firebaseEmulatorHost || firebaseAuthEmulatorPort != null || firebaseFirestoreEmulatorPort != null
          ? {
              emulators: {
                host: firebaseEmulatorHost,
                authPort: firebaseAuthEmulatorPort,
                firestorePort: firebaseFirestoreEmulatorPort
              }
            }
          : undefined)
      },
      input.env?.firebase
    );

    result = {
      apiBaseUrl: apiBaseUrl ?? input.env?.apiBaseUrl ?? '',
      oidcIssuer: oidcIssuer ?? input.env?.oidcIssuer ?? '',
      appClientUrl: appClientUrl ?? input.env?.appClientUrl,
      clientId: clientId ?? input.env?.clientId,
      clientSecret: clientSecret ?? input.env?.clientSecret,
      redirectUri: redirectUri ?? input.env?.redirectUri,
      scopes: scopes ?? input.env?.scopes,
      ...(input.env?.firebase || hasFirebaseOverrides ? { firebase } : undefined)
    };
  }

  return result;
}

function parsePort(value: Maybe<string>): number | undefined {
  const parsed = value != null && value.length > 0 ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Returns true when the env has the minimum fields needed to attempt an OAuth login or token refresh.
 *
 * @param env - The env config to check.
 * @returns `true` when `apiBaseUrl`, `oidcIssuer`, `clientId`, `clientSecret`, and `redirectUri` are all present and non-empty.
 */
export function isCliEnvConfigComplete(env: Maybe<CliEnvConfig>): env is Required<Pick<CliEnvConfig, 'apiBaseUrl' | 'oidcIssuer' | 'clientId' | 'clientSecret' | 'redirectUri'>> & CliEnvConfig {
  return Boolean(env?.apiBaseUrl && env?.oidcIssuer && env?.clientId && env?.clientSecret && env?.redirectUri);
}

/**
 * Inputs to {@link readEnvTokenEntry}.
 */
export interface ReadEnvTokenEntryInput {
  readonly cliName: string;
}

/**
 * Reads an OAuth token entry from environment variables, for non-interactive server consumption.
 *
 * Reads `<PREFIX>_REFRESH_TOKEN` (required) plus the optional `<PREFIX>_ACCESS_TOKEN` and
 * `<PREFIX>_TOKEN_SCOPE`, where `PREFIX = cliName.replaceAll('-', '_').toUpperCase()` (the existing
 * env-var prefix convention). The intended credential is a long-lived, non-rotating service token
 * (see `auth login --service-token`).
 *
 * Returns `undefined` when no refresh token is present. When only a refresh token is supplied, the
 * returned entry has `accessToken: ''` and `expiresAt: 0` so the first use is forced to mint an
 * access token via a refresh. The entry is flagged `fromEnv: true` so the middleware does not write
 * it back to the on-disk cache.
 *
 * @param input - The lookup inputs.
 * @param input.cliName - The CLI name used to derive the env-var prefix (e.g. `demo-cli` → `DEMO_CLI`).
 * @returns The env-sourced {@link CliTokenEntry}, or `undefined` when no refresh token is set.
 */
export function readEnvTokenEntry(input: ReadEnvTokenEntryInput): Maybe<CliTokenEntry> {
  const prefix = input.cliName.replaceAll('-', '_').toUpperCase();
  const refreshToken = nonEmpty(process.env[`${prefix}_REFRESH_TOKEN`]);
  let result: Maybe<CliTokenEntry>;

  if (refreshToken) {
    const accessToken = nonEmpty(process.env[`${prefix}_ACCESS_TOKEN`]);
    const scope = nonEmpty(process.env[`${prefix}_TOKEN_SCOPE`]);

    result = {
      accessToken: accessToken ?? '',
      refreshToken,
      // No reliable expiry is supplied via env, so force a refresh on first use (expiresAt 0 = expired).
      expiresAt: 0,
      ...(scope ? { scope } : {}),
      fromEnv: true
    };
  }

  return result;
}
