import { describe } from 'vitest';
import { buildManifestCommands, type CliEnvConfig, type CreateCliInput } from '@dereekb/dbx-cli';
// eslint-disable-next-line @nx/enforce-module-boundaries -- @dereekb/dbx-cli/test is a test-only sibling sub-project; demo-cli specs are the intended consumer.
import { buildTestCliContext, listenOnNestAppForTest, runCliCommand, type RunCliCommandResult } from '@dereekb/dbx-cli/test';
// eslint-disable-next-line @nx/enforce-module-boundaries -- firebase-server/test ships test-only fixtures consumed by every demo spec; this is the established pattern.
import { type OAuthAuthorizedSuperTestFixture } from '@dereekb/firebase-server/test';
// eslint-disable-next-line @nx/enforce-module-boundaries -- demo-api fixture is intentionally shared with demo-cli specs; the import lives in src/test/ which is excluded from the production build.
import { type DemoApiFunctionContextFixture } from 'demo-api/test';
import { DEMO_CLI_DEFAULT_ENVS } from '../lib/env.defaults';
import { DEMO_CLI_API_MANIFEST, DEMO_CLI_MODEL_MANIFEST } from '../lib/manifest/api.manifest.generated';

export const DEMO_TEST_CLI_NAME = 'demo-cli';
export const DEMO_TEST_CLI_ENV_NAME = 'test';

/**
 * Builds a minimal {@link CliEnvConfig} pointing at a test-listening demo-api server.
 *
 * The OIDC/clientId/scopes fields are populated with placeholders because the in-process test wiring
 * skips OIDC discovery entirely (the `testCliContext` override on `createCli` replaces the auth
 * middleware). Only `apiBaseUrl` actually affects test HTTP routing.
 *
 * @param input - The listening server's URL bundle.
 * @param input.apiBaseUrl - The bound `apiBaseUrl` (e.g. `http://127.0.0.1:54321/api`).
 * @returns A valid {@link CliEnvConfig} accepted by {@link buildTestCliContext}.
 * @__NO_SIDE_EFFECTS__
 */
export function buildDemoCliTestEnv(input: { readonly apiBaseUrl: string }): CliEnvConfig {
  return {
    apiBaseUrl: input.apiBaseUrl,
    oidcIssuer: `${input.apiBaseUrl.replace(/\/api$/, '')}/oidc`,
    appClientUrl: input.apiBaseUrl.replace(/\/api$/, ''),
    clientId: 'demo-cli-test-client',
    redirectUri: 'http://127.0.0.1:0/callback',
    scopes: 'openid profile email demo offline_access model.read model.query model.create model.update model.delete'
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

      const env = buildDemoCliTestEnv({ apiBaseUrl });
      const testCliContext = buildTestCliContext({
        cliName: DEMO_TEST_CLI_NAME,
        envName: DEMO_TEST_CLI_ENV_NAME,
        env,
        accessToken: oauth.accessToken,
        modelManifest: DEMO_CLI_MODEL_MANIFEST
      });

      const input: CreateCliInput = {
        cliName: DEMO_TEST_CLI_NAME,
        defaultEnvs: DEMO_CLI_DEFAULT_ENVS,
        modelManifest: DEMO_CLI_MODEL_MANIFEST,
        apiCommands: buildManifestCommands(DEMO_CLI_API_MANIFEST, { modelManifest: DEMO_CLI_MODEL_MANIFEST }),
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
