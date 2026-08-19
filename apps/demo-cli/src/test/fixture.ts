import { describe } from 'vitest';
import { buildManifestCommands, cliFirestoreBinding, type CliEnvConfig, type CliFirebaseConfig, type CreateCliInput } from '@dereekb/dbx-cli';
import { FIRESTORE_SESSION_OIDC_SCOPE } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
// eslint-disable-next-line @nx/enforce-module-boundaries -- @dereekb/dbx-cli/test is a test-only sibling sub-project; demo-cli specs are the intended consumer.
import { buildTestCliContext, listenOnNestAppForTest, runCliCommand, type RunCliCommandResult } from '@dereekb/dbx-cli/test';
// eslint-disable-next-line @nx/enforce-module-boundaries -- firebase-server/test ships test-only fixtures consumed by every demo spec; this is the established pattern.
import { type OAuthAuthorizedSuperTestFixture } from '@dereekb/firebase-server/test';
// eslint-disable-next-line @nx/enforce-module-boundaries -- demo-api fixture is intentionally shared with demo-cli specs; the import lives in src/test/ which is excluded from the production build.
import { type DemoApiFunctionContextFixture } from 'demo-api/test';
import { demoFirebaseModelServices, makeDemoFirestoreCollections } from 'demo-firebase';
import { DEMO_CLI_ACTION_COMMANDS } from '../lib/actions';
import { DEMO_DOCTOR_CHECKS } from '../lib/doctor.checks';
import { DEFAULT_DEMO_CLI_ENVS } from '../lib/env.defaults';
import { DEMO_CLI_API_MANIFEST, DEMO_CLI_MODEL_MANIFEST } from '../lib/manifest/api.manifest.generated';
import { DEMO_CLI_FIRESTORE_QUERY_MANIFEST } from '../lib/manifest/query.manifest.generated';

/**
 * The same direct-Firestore binding `src/index.ts` hands `runCli`, so a spec drives the shipped
 * `firestore-get` / `firestore-query` / `--via firestore` wiring rather than a test-only stand-in.
 */
const DEMO_TEST_CLI_FIRESTORE_BINDING = cliFirestoreBinding({ collections: makeDemoFirestoreCollections, models: demoFirebaseModelServices });

export const DEMO_TEST_CLI_NAME = 'demo-cli';
export const DEMO_TEST_CLI_ENV_NAME = 'test';

/**
 * Builds the {@link CliFirebaseConfig} for the direct-Firestore session under test.
 *
 * Nothing here comes from `DEMO_FIREBASE_CLIENT_CONFIG`, because a test run does not target the real
 * demo project — the emulators partition by project id, so the config has to name the same one the API
 * is running against:
 *
 * - `projectId` must be the fixture's own `app.options.projectId`. It is per-test-context, and reading
 *   it from `GCLOUD_PROJECT` is not reliable (`firebase-functions-test` rewrites the env). Point the
 *   client at a different project and the handshake still "succeeds" — the Auth emulator happily
 *   exchanges the custom token in that other namespace — but the signed-in user is a *different* user
 *   with none of the stored custom claims, and Firestore reads hit an empty project.
 * - The emulator host/ports come from the env vars `initFirebaseAdminTestEnvironment` sets, so they
 *   cannot drift from the emulators the API itself is talking to.
 *
 * `apiKey` and `appId` are placeholders: the Auth emulator does not validate the API key, and App Check
 * is auto-disabled whenever emulator targets are active (the emulators do not verify attestations).
 *
 * @param input - The Firebase project the test fixture is running against.
 * @param input.projectId - The fixture's admin `app.options.projectId`.
 * @returns The emulator-targeted Firebase client config, or `undefined` when the emulator env vars are
 *   absent (in which case a session cannot be opened and the specs that need one should not run).
 * @__NO_SIDE_EFFECTS__
 */
export function buildDemoCliTestFirebaseConfig(input: { readonly projectId: Maybe<string> }): CliFirebaseConfig | undefined {
  const auth = splitHostPort(process.env['FIREBASE_AUTH_EMULATOR_HOST']);
  const firestore = splitHostPort(process.env['FIRESTORE_EMULATOR_HOST']);
  const projectId = input.projectId;
  let result: CliFirebaseConfig | undefined;

  if (auth && firestore && projectId) {
    result = {
      apiKey: 'demo-cli-test-api-key',
      projectId,
      appId: '1:000000000000:web:democlitest',
      emulators: {
        host: auth.host,
        authPort: auth.port,
        firestorePort: firestore.port
      }
    };
  }

  return result;
}

function splitHostPort(value: string | undefined): { readonly host: string; readonly port: number } | undefined {
  const index = value ? value.lastIndexOf(':') : -1;
  const port = index > 0 ? Number(value?.slice(index + 1)) : Number.NaN;
  return Number.isFinite(port) ? { host: (value as string).slice(0, index), port } : undefined;
}

/**
 * Builds a minimal {@link CliEnvConfig} pointing at a test-listening demo-api server.
 *
 * The OIDC/clientId/scopes fields are populated with placeholders because the in-process test wiring
 * skips OIDC discovery entirely (the `testCliContext` override on `createCli` replaces the auth
 * middleware). Only `apiBaseUrl` actually affects test HTTP routing.
 *
 * The `firebase` block is always attached — it costs nothing until a command reaches for
 * `getFirestoreContext()`, which is lazy — so any spec can open a direct-Firestore session.
 *
 * @param input - The listening server's URL bundle and the fixture's Firebase project.
 * @param input.apiBaseUrl - The bound `apiBaseUrl` (e.g. `http://127.0.0.1:54321/api`).
 * @param input.projectId - The fixture's admin `app.options.projectId`, for the direct-Firestore session.
 * @returns A valid {@link CliEnvConfig} accepted by {@link buildTestCliContext}.
 * @__NO_SIDE_EFFECTS__
 */
export function buildDemoCliTestEnv(input: { readonly apiBaseUrl: string; readonly projectId: Maybe<string> }): CliEnvConfig {
  const firebase = buildDemoCliTestFirebaseConfig({ projectId: input.projectId });

  return {
    apiBaseUrl: input.apiBaseUrl,
    oidcIssuer: `${input.apiBaseUrl.replace(/\/api$/, '')}/oidc`,
    appClientUrl: input.apiBaseUrl.replace(/\/api$/, ''),
    clientId: 'demo-cli-test-client',
    redirectUri: 'http://127.0.0.1:0/callback',
    scopes: `openid profile email demo offline_access model.read model.query model.create model.update model.delete ${FIRESTORE_SESSION_OIDC_SCOPE}`,
    ...(firebase ? { firebase } : undefined)
  };
}

export interface WithDemoTestCliParams {
  readonly f: DemoApiFunctionContextFixture;
  readonly oauth: OAuthAuthorizedSuperTestFixture;
}

export interface DemoTestCliBuildContext {
  /**
   * Run a demo-cli command in-process and capture its stdout/stderr/argv/errors.
   *
   * Each call builds a fresh yargs `Argv` from the cached {@link CreateCliInput}, so middleware
   * state and option defaults never leak across tests.
   */
  readonly runCli: (args: readonly string[]) => Promise<RunCliCommandResult>;
  /**
   * The live API base URL the CLI is pointed at (e.g. `http://127.0.0.1:54321/api`).
   */
  readonly apiBaseUrl: () => string;
  /**
   * The OAuth-issued access token the CLI is using (re-resolved per test, since the OAuth fixture
   * provisions a fresh token per spec).
   */
  readonly accessToken: () => string;
}

/**
 * Wraps a `describe('(cli)', ...)` block that:
 *   1. Binds the fixture's NestJS app to a random localhost port (idempotent if already bound).
 *   2. Exposes a `runCli(args)` helper that drives demo-cli in-process with `testCliContext` set
 *      from the OAuth fixture's `accessToken` and the listening server's `apiBaseUrl`.
 *
 * Each `runCli` invocation builds a fresh yargs `Argv` so middleware state doesn't leak.
 *
 * @param params - The parent fixtures (`f` from `demoApiFunctionContextFactory`, `oauth` from
 *   `demoOAuthAuthorizedSuperTestContext`).
 * @param buildTests - Callback that receives `{ runCli, apiBaseUrl, accessToken }` and registers
 *   the actual `it(...)` cases.
 */
export function withDemoTestCli(params: WithDemoTestCliParams, buildTests: (ctx: DemoTestCliBuildContext) => void): void {
  const { f, oauth } = params;

  describe('(cli)', () => {
    let cachedApiBaseUrl = '';

    async function resolveCliInput(): Promise<CreateCliInput> {
      const app = await f.loadInitializedNestApplication();
      const { apiBaseUrl } = await listenOnNestAppForTest({ app, apiPrefix: 'api' });
      cachedApiBaseUrl = apiBaseUrl;

      const env = buildDemoCliTestEnv({ apiBaseUrl, projectId: f.instance.app.options.projectId });
      const testCliContext = buildTestCliContext({
        cliName: DEMO_TEST_CLI_NAME,
        envName: DEMO_TEST_CLI_ENV_NAME,
        env,
        accessToken: oauth.accessToken,
        modelManifest: DEMO_CLI_MODEL_MANIFEST,
        firestore: DEMO_TEST_CLI_FIRESTORE_BINDING
      });

      const input: CreateCliInput = {
        cliName: DEMO_TEST_CLI_NAME,
        defaultEnvs: DEFAULT_DEMO_CLI_ENVS,
        modelManifest: DEMO_CLI_MODEL_MANIFEST,
        firestore: DEMO_TEST_CLI_FIRESTORE_BINDING,
        firestoreQueryManifest: DEMO_CLI_FIRESTORE_QUERY_MANIFEST,
        apiCommands: buildManifestCommands(DEMO_CLI_API_MANIFEST, { modelManifest: DEMO_CLI_MODEL_MANIFEST }),
        actionCommands: DEMO_CLI_ACTION_COMMANDS,
        // the same list `src/index.ts` hands `runCli`. Without it the in-process CLI runs only the
        // dbx-cli built-in checks, so `doctor` silently omits `firestore-session` -- and a spec
        // asserting on it would be asserting against a CLI that is not the shipped one.
        doctorChecks: DEMO_DOCTOR_CHECKS,
        testCliContext
      };

      return input;
    }

    const ctx: DemoTestCliBuildContext = {
      runCli: async (args) => {
        const input = await resolveCliInput();
        return runCliCommand(input, args);
      },
      apiBaseUrl: () => cachedApiBaseUrl,
      accessToken: () => oauth.accessToken
    };

    buildTests(ctx);
  });
}
