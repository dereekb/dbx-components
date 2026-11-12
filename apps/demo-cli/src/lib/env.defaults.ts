import { type CliEnvDefault, type CliExternalConnectionHints, type CliFirebaseConfig } from '@dereekb/dbx-cli';
import { EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE, FIRESTORE_SESSION_OIDC_SCOPE, OFFLINE_ACCESS_OIDC_SCOPE, OPENID_OIDC_SCOPE } from '@dereekb/firebase';
import { DEMO_FIREBASE_CLIENT_CONFIG, DEMO_ZOHO_ADMIN_EXTERNAL_CONNECTION_PROVIDER_TYPE, MICROSOFT_ADMIN_EXTERNAL_TOKEN_OIDC_SCOPE, MICROSOFT_READ_EXTERNAL_TOKEN_OIDC_SCOPE } from 'demo-firebase';
// eslint-disable-next-line @nx/enforce-module-boundaries -- firebase.json is workspace configuration, not an nx project; `apps/demo/src/environments/base.ts` reads its emulator ports the same way.
import firebaseInfo from '../../../../firebase.json';

const DEMO_LOCAL_APP_CLIENT_URL = 'http://localhost:9010';
const DEMO_PROD_APP_CLIENT_URL = 'https://components.dereekb.com';

const DEMO_LOCAL_API_BASE_URL = `${DEMO_LOCAL_APP_CLIENT_URL}/api`;
const DEMO_PROD_API_BASE_URL = `${DEMO_PROD_APP_CLIENT_URL}/api`;

const DEMO_LOCAL_OIDC_ISSUER = `${DEMO_LOCAL_APP_CLIENT_URL}/oidc`;
const DEMO_PROD_OIDC_ISSUER = `${DEMO_PROD_APP_CLIENT_URL}/oidc`;

/**
 * Default OIDC scopes the demo-cli requests on `auth login` — every scope the demo OAuth
 * server exposes (identity + full callModel CRUD + the direct-Firestore session). Trim with
 * `auth login --read-only-scopes` to drop `model.create`, `model.update`, and `model.delete`.
 *
 * `session.firestore` is admin-only. Requesting it as a non-admin is harmless rather than fatal: the
 * consent screen withholds admin-only scopes from a non-admin entirely, so the scope lands in the
 * consent submit's rejected set and login still succeeds without it.
 *
 * Keep in sync with `DEMO_OIDC_AVAILABLE_SCOPES` in `@dereekb/demo-firebase`. Deliberately WITHOUT
 * `token.external`: an everyday login must not be able to mint third-party tokens — that is the
 * {@link DEMO_CLI_EXTERNAL_TOKEN_SCOPES} env's job alone.
 */
export const DEFAULT_DEMO_CLI_SCOPES = `openid profile email demo offline_access model.create model.read model.update model.delete model.query ${FIRESTORE_SESSION_OIDC_SCOPE}`;

/**
 * The ONLY scopes the dedicated `external-token` envs request: enough to sign in and mint external
 * connection tokens, and nothing else.
 *
 * A separate grant rather than an extra scope on {@link DEFAULT_DEMO_CLI_SCOPES}: the grant that can
 * mint a third-party token cannot read or write any demo data, and the one that can never mints. The
 * `token.external` scope is unlocked only for an OIDC client an admin assigned the admin-only
 * `external-token` provider profile to, which also caps this grant at 8 hours.
 */
export const DEMO_CLI_EXTERNAL_TOKEN_SCOPES = `${OPENID_OIDC_SCOPE} ${OFFLINE_ACCESS_OIDC_SCOPE} ${EXTERNAL_CONNECTION_TOKEN_OIDC_SCOPE}`;

/**
 * Non-secret values `zoho-cli` needs alongside a minted `zoho_admin` token, emitted as the token
 * bundle's `hints` by `demo-cli external-token zoho_admin`, so zoho-cli need not be told the org ids
 * itself (its own configured org ids still win).
 *
 * PLACEHOLDERS: the demo ships no real Zoho org. A deployment replaces them with its Zoho Desk / Zoho
 * Analytics organization ids — here, or per machine in the stored env. They are printed unmasked by
 * `env show`, so never put a secret in a hint.
 */
export const DEMO_CLI_EXTERNAL_CONNECTION_HINTS: CliExternalConnectionHints = {
  [DEMO_ZOHO_ADMIN_EXTERNAL_CONNECTION_PROVIDER_TYPE]: {
    zohoDeskOrgId: 'REPLACE_WITH_ZOHO_DESK_ORG_ID',
    zohoAnalyticsOrgId: 'REPLACE_WITH_ZOHO_ANALYTICS_ORG_ID'
  }
};

/**
 * Firebase client config for the demo project, shared by both env defaults.
 *
 * Enables `CliContext.getFirestoreContext()` — the direct-Firestore session, where the CLI signs in
 * as the authenticated user and reads through the same security rules the Angular app is subject to.
 * Sourced from `demo-firebase` so the `appId` matches the web app demo-api mints App Check
 * attestations for.
 */
const DEMO_CLI_FIREBASE_CONFIG: CliFirebaseConfig = DEMO_FIREBASE_CLIENT_CONFIG;

/**
 * Local emulator targets, taken from the workspace `firebase.json` so the ports cannot drift from the
 * emulators the CLI is expected to talk to.
 *
 * The host is left to `DEFAULT_CLI_FIREBASE_EMULATOR_HOST` — `firebase.json` records `0.0.0.0`, which
 * is the emulators' bind address, not an address to connect to. App Check is auto-disabled whenever
 * emulator targets are active, since the emulators do not verify attestations.
 */
const DEMO_CLI_LOCAL_FIREBASE_CONFIG: CliFirebaseConfig = {
  ...DEMO_CLI_FIREBASE_CONFIG,
  emulators: {
    authPort: firebaseInfo.emulators.auth.port,
    firestorePort: firebaseInfo.emulators.firestore.port
  }
};

/**
 * `dev-mcp` / `prod-mcp` are aliases, not separate presets.
 *
 * An MCP-minted handoff declares its env name server-side and the redeeming CLI stores it under that
 * name, so pointing it at `local` would overwrite a hand-configured `local` env with a one-hour
 * credential. Giving the MCP flow its own NAME keeps the two apart, while listing it here means the
 * separate env still inherits this preset's `firebase` block and `appClientUrl` — which the handoff
 * bundle itself does not carry.
 */
export const DEFAULT_DEMO_LOCAL_ENV: CliEnvDefault = {
  names: ['local', 'dev', 'dev-mcp'],
  env: {
    apiBaseUrl: DEMO_LOCAL_API_BASE_URL,
    oidcIssuer: DEMO_LOCAL_OIDC_ISSUER,
    appClientUrl: DEMO_LOCAL_APP_CLIENT_URL,
    scopes: DEFAULT_DEMO_CLI_SCOPES,
    firebase: DEMO_CLI_LOCAL_FIREBASE_CONFIG
  }
};

export const DEFAULT_DEMO_PROD_ENV: CliEnvDefault = {
  names: ['prod', 'production', 'prod-mcp'],
  env: {
    apiBaseUrl: DEMO_PROD_API_BASE_URL,
    oidcIssuer: DEMO_PROD_OIDC_ISSUER,
    appClientUrl: DEMO_PROD_APP_CLIENT_URL,
    scopes: DEFAULT_DEMO_CLI_SCOPES,
    firebase: DEMO_CLI_FIREBASE_CONFIG
  }
};

/**
 * The local `external-token` env: a separate login against the local emulators whose grant carries
 * only {@link DEMO_CLI_EXTERNAL_TOKEN_SCOPES}, so it can mint external connection tokens and do nothing
 * else. Hints ({@link DEMO_CLI_EXTERNAL_CONNECTION_HINTS}) live only on the external-token envs — the
 * only ones whose grant can mint.
 *
 * One-time setup, with an OIDC client an admin assigned the `external-token` provider profile to (and
 * whose id the server lists in `DEMO_EXTERNAL_CONNECTION_TOKEN_OIDC_CLIENT_IDS` when deployed):
 *
 * ```
 * demo-cli auth setup --env external-token --client-id <id>
 * demo-cli auth login --env external-token
 * zoho-cli auth token-source set "demo-cli external-token zoho_admin --env external-token"
 * ```
 */
export const DEFAULT_DEMO_LOCAL_EXTERNAL_TOKEN_ENV: CliEnvDefault = {
  names: ['external-token', 'dev-external-token'],
  env: {
    apiBaseUrl: DEMO_LOCAL_API_BASE_URL,
    oidcIssuer: DEMO_LOCAL_OIDC_ISSUER,
    appClientUrl: DEMO_LOCAL_APP_CLIENT_URL,
    scopes: DEMO_CLI_EXTERNAL_TOKEN_SCOPES,
    externalConnectionHints: DEMO_CLI_EXTERNAL_CONNECTION_HINTS
  }
};

/**
 * The production counterpart of {@link DEFAULT_DEMO_LOCAL_EXTERNAL_TOKEN_ENV}; the token command is
 * `demo-cli external-token zoho_admin --env prod-external-token`.
 */
export const DEFAULT_DEMO_PROD_EXTERNAL_TOKEN_ENV: CliEnvDefault = {
  names: ['prod-external-token'],
  env: {
    apiBaseUrl: DEMO_PROD_API_BASE_URL,
    oidcIssuer: DEMO_PROD_OIDC_ISSUER,
    appClientUrl: DEMO_PROD_APP_CLIENT_URL,
    scopes: DEMO_CLI_EXTERNAL_TOKEN_SCOPES,
    externalConnectionHints: DEMO_CLI_EXTERNAL_CONNECTION_HINTS
  }
};

/**
 * {@link DEMO_CLI_EXTERNAL_TOKEN_SCOPES} plus the `token.external.microsoft_read` ceiling: a `microsoft`
 * mint from this grant is capped at the Read preset's Graph scopes — refused when the connection's grant
 * reaches past them, since Microsoft cannot narrow a token.
 *
 * A `microsoft` mint needs one of the two ceiling scopes on top of `token.external` — a grant holding
 * neither is refused with a 403 (`..._SCOPE_FORBIDDEN`), which is why the plain `external-token` env
 * cannot mint one.
 */
export const DEMO_CLI_MSGRAPH_READ_SCOPES = `${DEMO_CLI_EXTERNAL_TOKEN_SCOPES} ${MICROSOFT_READ_EXTERNAL_TOKEN_OIDC_SCOPE}`;

/**
 * {@link DEMO_CLI_EXTERNAL_TOKEN_SCOPES} plus the `token.external.microsoft_admin` ceiling: a `microsoft`
 * mint from this grant may carry the Read + Write preset's Graph scopes.
 */
export const DEMO_CLI_MSGRAPH_ADMIN_SCOPES = `${DEMO_CLI_EXTERNAL_TOKEN_SCOPES} ${MICROSOFT_ADMIN_EXTERNAL_TOKEN_OIDC_SCOPE}`;

/**
 * The local `msgraph-read` env: the {@link DEFAULT_DEMO_LOCAL_EXTERNAL_TOKEN_ENV} login plus the Read
 * ceiling ({@link DEMO_CLI_MSGRAPH_READ_SCOPES}), for msgraph-cli's token source.
 *
 * One-time setup, with the same kind of OIDC client as the `external-token` env:
 *
 * ```
 * demo-cli auth setup --env msgraph-read --client-id <id>
 * demo-cli auth login --env msgraph-read
 * msgraph-cli auth token-source set "demo-cli external-token microsoft --env msgraph-read"
 * ```
 *
 * The connection must have been connected with a preset covering the ceiling, or the mint is refused
 * with a 403 naming the preset to reconnect with.
 */
export const DEFAULT_DEMO_LOCAL_MSGRAPH_READ_ENV: CliEnvDefault = {
  names: ['msgraph-read', 'dev-msgraph-read'],
  env: { ...DEFAULT_DEMO_LOCAL_EXTERNAL_TOKEN_ENV.env, scopes: DEMO_CLI_MSGRAPH_READ_SCOPES }
};

/**
 * The local `msgraph-admin` env: {@link DEFAULT_DEMO_LOCAL_MSGRAPH_READ_ENV} with the Read + Write ceiling
 * ({@link DEMO_CLI_MSGRAPH_ADMIN_SCOPES}). Minting through it needs a connection made with "Read + Write".
 */
export const DEFAULT_DEMO_LOCAL_MSGRAPH_ADMIN_ENV: CliEnvDefault = {
  names: ['msgraph-admin', 'dev-msgraph-admin'],
  env: { ...DEFAULT_DEMO_LOCAL_EXTERNAL_TOKEN_ENV.env, scopes: DEMO_CLI_MSGRAPH_ADMIN_SCOPES }
};

/**
 * The production counterpart of {@link DEFAULT_DEMO_LOCAL_MSGRAPH_READ_ENV}.
 */
export const DEFAULT_DEMO_PROD_MSGRAPH_READ_ENV: CliEnvDefault = {
  names: ['prod-msgraph-read'],
  env: { ...DEFAULT_DEMO_PROD_EXTERNAL_TOKEN_ENV.env, scopes: DEMO_CLI_MSGRAPH_READ_SCOPES }
};

/**
 * The production counterpart of {@link DEFAULT_DEMO_LOCAL_MSGRAPH_ADMIN_ENV}.
 */
export const DEFAULT_DEMO_PROD_MSGRAPH_ADMIN_ENV: CliEnvDefault = {
  names: ['prod-msgraph-admin'],
  env: { ...DEFAULT_DEMO_PROD_EXTERNAL_TOKEN_ENV.env, scopes: DEMO_CLI_MSGRAPH_ADMIN_SCOPES }
};

export const DEFAULT_DEMO_CLI_ENVS: readonly CliEnvDefault[] = [
  DEFAULT_DEMO_LOCAL_ENV,
  DEFAULT_DEMO_PROD_ENV,
  DEFAULT_DEMO_LOCAL_EXTERNAL_TOKEN_ENV,
  DEFAULT_DEMO_PROD_EXTERNAL_TOKEN_ENV,
  DEFAULT_DEMO_LOCAL_MSGRAPH_READ_ENV,
  DEFAULT_DEMO_LOCAL_MSGRAPH_ADMIN_ENV,
  DEFAULT_DEMO_PROD_MSGRAPH_READ_ENV,
  DEFAULT_DEMO_PROD_MSGRAPH_ADMIN_ENV
];
