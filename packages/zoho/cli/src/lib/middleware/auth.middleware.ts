import { createContextSlot } from '@dereekb/dbx-cli';
import type { MiddlewareFunction } from 'yargs';
import { loadCliConfig, configuredProducts } from '../config/cli.config';
import { createCliContext, type ZohoCliContext } from '../context/cli.context';
import { outputError } from '../util/output';
import type { ZohoRecruitApi, ZohoCrmApi, ZohoDeskApi } from '@dereekb/zoho/nestjs';

/**
 * Module-level context set by the auth middleware.
 *
 * Stored here instead of on argv to avoid triggering yargs strict-mode
 * "Unknown argument" errors.
 */
const _cliContextSlot = createContextSlot<ZohoCliContext>({
  notInitializedMessage: 'CLI context not initialized. This is a bug.'
});

/**
 * Builds a yargs middleware that loads the CLI config, ensures at least one Zoho product has resolvable credentials, and stores the constructed {@link ZohoCliContext} in a module-level slot for command handlers to consume via {@link getCliContext}.
 *
 * Commands listed in `skipCommands` (typically `auth` subcommands like `setup`/`clear`) bypass the check so users can configure credentials before they exist. On any failure the middleware writes a structured error envelope to stdout via {@link outputError} and exits the process with status `4`.
 *
 * @param skipCommands - Set of top-level command names that should not require authentication.
 * @returns A yargs `MiddlewareFunction` to register on the root parser.
 */
export function createAuthMiddleware(skipCommands: ReadonlySet<string>): MiddlewareFunction {
  return async (argv: any) => {
    const command = argv._?.[0];

    if (typeof command === 'string' && skipCommands.has(command)) {
      return;
    }

    try {
      const config = await loadCliConfig();

      if (!config) {
        outputError(new Error('Not authenticated. Run: zoho-cli auth setup --client-id X --client-secret Y --token Z'));
        process.exit(4);
      }

      const products = configuredProducts(config);

      if (products.length === 0) {
        outputError(new Error('No products configured with complete credentials. Run: zoho-cli auth setup'));
        process.exit(4);
      }

      _cliContextSlot.set(createCliContext(config));
    } catch (e) {
      outputError(e);
      process.exit(4);
    }
  };
}

/**
 * Retrieves the {@link ZohoCliContext} previously populated by {@link createAuthMiddleware}.
 *
 * @param _argv - Currently unused; kept for symmetry with `getRecruitApi`/`getCrmApi`/`getDeskApi` and to allow future per-argv routing without breaking call sites.
 * @returns The active CLI context for the current command invocation.
 * @throws {Error} When the auth middleware has not yet run (indicates a wiring bug).
 */
export function getCliContext(_argv?: any): ZohoCliContext {
  return _cliContextSlot.require();
}

/**
 * Returns the configured {@link ZohoRecruitApi} for the active command.
 *
 * @param argv - The yargs-parsed arguments object; forwarded to {@link getCliContext}.
 * @returns The Recruit API client.
 * @throws {Error} When Recruit is not configured with valid credentials, instructing the user how to run `zoho-cli auth setup`.
 */
export function getRecruitApi(argv: any): ZohoRecruitApi {
  const { recruitApi } = getCliContext(argv);

  if (!recruitApi) {
    throw new Error('Recruit not configured. Run: zoho-cli auth setup --client-id X --client-secret Y --token Z');
  }

  return recruitApi;
}

/**
 * Returns the configured {@link ZohoCrmApi} for the active command.
 *
 * @param argv - The yargs-parsed arguments object; forwarded to {@link getCliContext}.
 * @returns The CRM API client.
 * @throws {Error} When CRM is not configured with valid credentials, instructing the user how to run `zoho-cli auth setup --product crm`.
 */
export function getCrmApi(argv: any): ZohoCrmApi {
  const { crmApi } = getCliContext(argv);

  if (!crmApi) {
    throw new Error('CRM not configured. Run: zoho-cli auth setup --product crm --client-id X --client-secret Y --token Z');
  }

  return crmApi;
}

/**
 * Returns the configured {@link ZohoDeskApi} for the active command.
 *
 * @param argv - The yargs-parsed arguments object; forwarded to {@link getCliContext}.
 * @returns The Desk API client.
 * @throws {Error} When Desk is not configured with both valid credentials and an `orgId`, instructing the user how to run `zoho-cli auth setup --product desk`.
 */
export function getDeskApi(argv: any): ZohoDeskApi {
  const { deskApi } = getCliContext(argv);

  if (!deskApi) {
    throw new Error('Desk not configured. Run: zoho-cli auth setup --product desk --client-id X --client-secret Y --token Z --org-id YOUR_ORG_ID');
  }

  return deskApi;
}
