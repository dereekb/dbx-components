import { createContextSlot } from '@dereekb/dbx-cli';
import type { MiddlewareFunction } from 'yargs';
import type { Maybe } from '@dereekb/util';
import type { ZohoAnalyticsContext, ZohoCrmContext, ZohoDeskContext, ZohoRecruitContext, ZohoSignContext } from '@dereekb/zoho';
import { loadCliConfig, configuredProducts, zohoCliTokenSourceSelectionFromArgv, type ZohoCliProduct } from '../config/cli.config';
import { loadZohoCliResolvedTokenSource } from '../config/token.source';
import { createCliContext, type ZohoCliContext } from '../context/cli.context';
import { isZohoCliTokenRejectedError, outputError } from '../util/output';

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
 * The products this run's command requested a client for (through `getRecruitContext()` etc.), so a rejected token is
 * cleared for exactly those products.
 */
const _requestedProducts = new Set<ZohoCliProduct>();

/**
 * How to set up a token source instead of credentials, appended to the "not configured" errors.
 */
const TOKEN_SOURCE_SETUP_HINT = 'or use a token source: zoho-cli auth token-source set "<command>"';

/**
 * Builds a yargs middleware that loads the CLI config, ensures at least one Zoho product has resolvable credentials, and stores the constructed {@link ZohoCliContext} in a module-level slot for command handlers to consume via {@link getCliContext}.
 *
 * When a token source is active (`--token-source <name>`, `ZOHO_CLI_TOKEN_SOURCE`, `ZOHO_CLI_TOKEN_COMMAND`, the saved `activeTokenSource`, else the saved `tokenSource` block — see `resolveZohoCliActiveTokenSource`), its token is loaded first — running its command unless a cached token is still valid — and the products its scopes cover authenticate through it. A failing token source, or a selected name with no saved source, fails the command with that error.
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
      const config = await loadCliConfig(zohoCliTokenSourceSelectionFromArgv(argv));

      if (!config) {
        outputError(new Error(`Not authenticated. Run: zoho-cli auth login (or zoho-cli auth setup --client-id X --client-secret Y --token Z), ${TOKEN_SOURCE_SETUP_HINT}`));
        process.exit(4);
      }

      const tokenSource = await loadZohoCliResolvedTokenSource(config);
      const products = configuredProducts(config, tokenSource);

      if (products.length === 0) {
        const message = tokenSource ? `No products configured: the token source "${tokenSource.source.command}" grants no Zoho product scopes the CLI supports, and no product has complete credentials.` : `No products configured with complete credentials. Run: zoho-cli auth setup, ${TOKEN_SOURCE_SETUP_HINT}`;
        outputError(new Error(message));
        process.exit(4);
      }

      setCliContext(createCliContext(config, tokenSource));
    } catch (e) {
      outputError(e);
      process.exit(4);
    }
  };
}

/**
 * Retrieves the {@link ZohoCliContext} previously populated by {@link createAuthMiddleware}.
 *
 * @param _argv - Currently unused; kept for symmetry with `getRecruitContext`/`getCrmContext`/`getDeskContext` and to allow future per-argv routing without breaking call sites.
 * @returns The active CLI context for the current command invocation.
 * @throws {Error} When the auth middleware has not yet run (indicates a wiring bug).
 */
export function getCliContext(_argv?: any): ZohoCliContext {
  return _cliContextSlot.require();
}

/**
 * Installs the {@link ZohoCliContext} for this run (the auth middleware does), and starts a fresh record of the products
 * the run's command requests. Pass `undefined` to clear it.
 *
 * @param context - The context, or undefined to clear.
 */
export function setCliContext(context: Maybe<ZohoCliContext>): void {
  _cliContextSlot.set(context);
  _requestedProducts.clear();
}

/**
 * Returns the {@link ZohoCliContext} when the auth middleware built one, without throwing. Commands that skip the auth
 * middleware (`auth`, `doctor`) have none.
 *
 * @returns The active CLI context, or undefined.
 */
export function peekCliContext(): Maybe<ZohoCliContext> {
  return _cliContextSlot.get();
}

/**
 * Returns the products this run's command requested a client for.
 *
 * @returns The requested products, in request order.
 */
export function requestedZohoCliProducts(): ZohoCliProduct[] {
  return [..._requestedProducts];
}

/**
 * Returns the configured product context, recording the product as requested by this run's command.
 *
 * @param product - The product.
 * @param value - The product's context, when configured.
 * @param notConfiguredMessage - The error message when it is not.
 * @returns The context.
 * @throws {Error} When the product is not configured.
 */
function requireProductContext<T>(product: ZohoCliProduct, value: Maybe<T>, notConfiguredMessage: string): T {
  if (!value) {
    throw new Error(notConfiguredMessage);
  }

  _requestedProducts.add(product);
  return value;
}

/**
 * Returns the configured {@link ZohoRecruitContext} for the active command.
 *
 * @param argv - The yargs-parsed arguments object; forwarded to {@link getCliContext}.
 * @returns The Recruit context.
 * @throws {Error} When Recruit is not configured with valid credentials, instructing the user how to run `zoho-cli auth setup`.
 */
export function getRecruitContext(argv: any): ZohoRecruitContext {
  return requireProductContext('recruit', getCliContext(argv).recruitContext, `Recruit not configured. Run: zoho-cli auth setup --client-id X --client-secret Y --token Z, ${TOKEN_SOURCE_SETUP_HINT}`);
}

/**
 * Returns the configured {@link ZohoCrmContext} for the active command.
 *
 * @param argv - The yargs-parsed arguments object; forwarded to {@link getCliContext}.
 * @returns The CRM context.
 * @throws {Error} When CRM is not configured with valid credentials, instructing the user how to run `zoho-cli auth setup --product crm`.
 */
export function getCrmContext(argv: any): ZohoCrmContext {
  return requireProductContext('crm', getCliContext(argv).crmContext, `CRM not configured. Run: zoho-cli auth setup --product crm --client-id X --client-secret Y --token Z, ${TOKEN_SOURCE_SETUP_HINT}`);
}

/**
 * Returns the configured {@link ZohoDeskContext} for the active command.
 *
 * @param argv - The yargs-parsed arguments object; forwarded to {@link getCliContext}.
 * @returns The Desk context.
 * @throws {Error} When Desk is not configured with both valid credentials and an `orgId`, instructing the user how to run `zoho-cli auth setup --product desk`.
 */
export function getDeskContext(argv: any): ZohoDeskContext {
  return requireProductContext('desk', getCliContext(argv).deskContext, 'Desk not configured. Run: zoho-cli auth setup --product desk --client-id X --client-secret Y --token Z --org-id YOUR_ORG_ID (a token source covering Desk also needs an org id: ZOHO_DESK_ORG_ID, auth set --product desk --org-id, or its zohoDeskOrgId hint)');
}

/**
 * Returns the configured {@link ZohoSignContext} for the active command.
 *
 * Zoho Sign uses a dedicated OAuth client, so it must be configured with its own credentials
 * (it never falls back to the shared client).
 *
 * @param argv - The yargs-parsed arguments object; forwarded to {@link getCliContext}.
 * @returns The Sign context.
 * @throws {Error} When Sign is not configured with its own valid credentials, instructing the user how to run `zoho-cli auth setup --product sign`.
 */
export function getSignContext(argv: any): ZohoSignContext {
  return requireProductContext('sign', getCliContext(argv).signContext, 'Sign not configured. Zoho Sign requires its own OAuth client. Run: zoho-cli auth setup --product sign --client-id X --client-secret Y --token Z');
}

/**
 * Returns the configured {@link ZohoAnalyticsContext} for the active command.
 *
 * Zoho Analytics is treated as a dedicated-OAuth-client product, so it must be configured with its
 * own credentials (it never falls back to the shared client).
 *
 * @param argv - The yargs-parsed arguments object; forwarded to {@link getCliContext}.
 * @returns The Analytics context.
 * @throws {Error} When Analytics is not configured with its own valid credentials, instructing the user how to run `zoho-cli auth setup --product analytics`.
 */
export function getAnalyticsContext(argv: any): ZohoAnalyticsContext {
  return requireProductContext('analytics', getCliContext(argv).analyticsContext, 'Analytics not configured. Zoho Analytics requires its own OAuth client. Run: zoho-cli auth setup --product analytics --client-id X --client-secret Y --token Z --org-id YOUR_ORG_ID');
}

/**
 * The failure path of every zoho-cli command handler: prints the error envelope as one JSON line on stdout and exits 1.
 *
 * When Zoho rejected the access token (`TOKEN_REJECTED`) after the command requested a product client, it first AWAITS
 * clearing the cached token behind those products (the token source's `.tokens.json` entry, or an own grant's memory +
 * file entry), so the next run mints a new token instead of reading the rejected one back. Awaiting matters: exiting
 * straight after printing could cut off the library's own fire-and-forget reset.
 *
 * @param error - The thrown value.
 * @returns Never resolves normally; the process exits.
 */
export async function exitZohoCliCommandWithError(error: unknown): Promise<never> {
  const context = peekCliContext();
  const requested = requestedZohoCliProducts();

  if (context && requested.length > 0 && isZohoCliTokenRejectedError(error)) {
    const tokenSourceProducts = context.tokenSource?.products;
    const coveredByTokenSource = tokenSourceProducts != null && requested.some((x) => tokenSourceProducts.includes(x));
    await context.resetCachedTokens(requested);
    outputError(error, { tokenSource: coveredByTokenSource });
  } else {
    outputError(error);
  }

  return process.exit(1);
}
