import { type CliEnvDefault, type CliFirebaseConfig } from '@dereekb/dbx-cli';
import { FIRESTORE_SESSION_OIDC_SCOPE } from '@dereekb/firebase';
import { DEMO_FIREBASE_CLIENT_CONFIG } from 'demo-firebase';
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
 * Keep in sync with `DEMO_OIDC_AVAILABLE_SCOPES` in `@dereekb/demo-firebase`.
 */
export const DEFAULT_DEMO_CLI_SCOPES = `openid profile email demo offline_access model.create model.read model.update model.delete model.query ${FIRESTORE_SESSION_OIDC_SCOPE}`;

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

export const DEFAULT_DEMO_LOCAL_ENV: CliEnvDefault = {
  names: ['local', 'dev'],
  env: {
    apiBaseUrl: DEMO_LOCAL_API_BASE_URL,
    oidcIssuer: DEMO_LOCAL_OIDC_ISSUER,
    appClientUrl: DEMO_LOCAL_APP_CLIENT_URL,
    scopes: DEFAULT_DEMO_CLI_SCOPES,
    firebase: DEMO_CLI_LOCAL_FIREBASE_CONFIG
  }
};

export const DEFAULT_DEMO_PROD_ENV: CliEnvDefault = {
  names: ['prod', 'production'],
  env: {
    apiBaseUrl: DEMO_PROD_API_BASE_URL,
    oidcIssuer: DEMO_PROD_OIDC_ISSUER,
    appClientUrl: DEMO_PROD_APP_CLIENT_URL,
    scopes: DEFAULT_DEMO_CLI_SCOPES,
    firebase: DEMO_CLI_FIREBASE_CONFIG
  }
};

export const DEFAULT_DEMO_CLI_ENVS: readonly CliEnvDefault[] = [DEFAULT_DEMO_LOCAL_ENV, DEFAULT_DEMO_PROD_ENV];
