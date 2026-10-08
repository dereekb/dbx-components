import type { CommandModule, Argv } from 'yargs';
import {
  loadCliConfig,
  loadCliConfigFile,
  mergeCliConfig,
  clearCliConfig,
  maskSecret,
  configuredProducts,
  resolveProductCredentials,
  getTokenCachePath,
  zohoCliCredentialSources,
  zohoCliRefreshTokenEnvVarName,
  zohoCliTokenCommandFromEnv,
  resolveZohoCliActiveTokenSource,
  saveCliTokenSourceConfig,
  ZOHO_CLI_TOKEN_COMMAND_ENV_VAR,
  ZOHO_CLI_PRODUCTS,
  ZOHO_CLI_ORG_ID_PRODUCTS,
  ZOHO_CLI_DEDICATED_CLIENT_PRODUCTS,
  type ZohoCliConfig,
  type ZohoCliProduct,
  type ZohoCliCredentials,
  type ZohoCliProductConfig,
  type ZohoCliCredentialBlockKey,
  type ZohoCliCredentialSource,
  type ZohoCliActiveTokenSource
} from '../config/cli.config';
import { clearCachedZohoCliTokenSourceToken, loadCachedZohoCliTokenSourceToken, loadZohoCliTokenSourceStatus, zohoCliTokenSourceCoverage, zohoCliTokenSourceReport, type ZohoCliTokenSourceStatus } from '../config/token.source';
import { DEFAULT_AUTH_LOGIN_REDIRECT_URI, ZOHO_CLI_REGION_CHOICES, exchangeZohoAuthorizationCode, loadZohoAuthUserEmail, parseZohoAuthRedirect, zohoCliScopesForProducts } from '../config/cli.oauth';
import { noop, generateOAuthState, type Maybe } from '@dereekb/util';
import { parseDurationStringToMilliseconds } from '@dereekb/date';
import { openUrlInBrowser, parseLoopbackRedirectUri, promptLine, startLoopbackRedirectCapture, type LoopbackRedirectCapture } from '@dereekb/dbx-cli';
import { zohoAccountsAuthorizeUrlFactory, zohoAccountsConfigApiUrl, zohoOAuthScopesFromScopeString, type ZohoOAuthScope } from '@dereekb/zoho';
import { fileZohoAccountsAccessTokenCacheService } from '@dereekb/zoho/nestjs';
import { createCliContext, toZohoCliProductApis } from '../context/cli.context';
import { outputResult, outputError } from '../util/output';

/**
 * Redirect URI `auth setup` uses when `--redirect-uri` is not given. Must match what the API console has registered.
 */
export const DEFAULT_AUTH_SETUP_REDIRECT_URI = 'http://localhost/oauth';

/**
 * `--org-id` help text, listing the org-scoped products from {@link ZOHO_CLI_ORG_ID_PRODUCTS} so the
 * documented set cannot drift from the set the code actually persists for.
 */
const ORG_ID_OPTION_DESCRIBE = `Organization ID, for the products scoped by one (${Array.from(ZOHO_CLI_ORG_ID_PRODUCTS).join(', ')})`;

/**
 * Where to create the OAuth client that `auth setup` / `auth login` authorize.
 */
const ZOHO_API_CONSOLE_URL = 'https://api-console.zoho.com/';

/**
 * Lists the products that resolve credentials once a write has landed.
 *
 * Read back through {@link loadCliConfig} rather than off the merged file, since a product may still
 * be configured through env vars the write deliberately did not copy.
 *
 * @param merged - The config file as just written.
 * @returns The configured products.
 */
async function configuredProductsAfterSave(merged: ZohoCliConfig): Promise<ZohoCliProduct[]> {
  return configuredProducts((await loadCliConfig()) ?? merged);
}

// MARK: Setup
const authSetupCommand: CommandModule = {
  command: 'setup',
  describe: 'Generate OAuth authorization URL, exchange code, or set refresh token directly (see also: auth login)',
  builder: (yargs: Argv) =>
    yargs
      .option('client-id', { type: 'string', describe: `OAuth client ID (from ${ZOHO_API_CONSOLE_URL})` })
      .option('client-secret', { type: 'string', describe: 'OAuth client secret' })
      .option('redirect-uri', { type: 'string', default: DEFAULT_AUTH_SETUP_REDIRECT_URI, describe: 'Redirect URI (must match API console config)' })
      .option('region', { type: 'string', defaultDescription: 'the stored region, otherwise us', choices: ZOHO_CLI_REGION_CHOICES, describe: 'Zoho datacenter' })
      .option('scopes', { type: 'string', defaultDescription: '--product when given, otherwise recruit,crm,desk', describe: 'Comma-separated products for OAuth scopes (recruit,crm,desk,sign,analytics)' })
      .option('code', { type: 'string', describe: 'Authorization code or the full redirect URL (code and datacenter are extracted automatically)' })
      .option('token', { type: 'string', describe: 'Set a refresh token directly (skips OAuth code exchange)' })
      .option('product', { type: 'string', choices: [...ZOHO_CLI_PRODUCTS] as const, describe: 'Store credentials for a specific product instead of shared' })
      .option('org-id', { type: 'string', describe: ORG_ID_OPTION_DESCRIBE })
      .option('api-mode', { type: 'string', default: 'production', choices: ['production', 'sandbox'] as const, describe: 'API mode' })
      .example([
        ['$0 auth setup --client-id 1000.ABC --client-secret xyz', 'Step 1: Get OAuth URL (saves shared credentials)'],
        ['$0 auth setup --code 1000.AUTH.CODE', 'Step 2: Exchange code for refresh token'],
        ['$0 auth setup --code "http://localhost/oauth?code=1000.AUTH.CODE&location=us"', 'Step 2: Paste the full redirect URL'],
        ['$0 auth setup --client-id 1000.ABC --client-secret xyz --token 1000.REFRESH.TOKEN', 'Set shared refresh token directly'],
        ['$0 auth setup --product crm --client-id 1000.CRM --client-secret xyz --token 1000.CRM.TOKEN', 'Set CRM-specific credentials'],
        ['$0 auth setup --product sign --client-id 1000.SIGN --client-secret xyz', 'Sign uses a separate OAuth client (sign-only scopes)'],
        ['$0 auth setup --product analytics --client-id 1000.ANALYTICS --client-secret xyz --org-id 1234567', 'Analytics uses a separate OAuth client; --scopes defaults to analytics']
      ]),
  handler: async (argv: any) => {
    try {
      const existingConfig = await loadCliConfig();
      const ctx = buildAuthSetupContext(argv, existingConfig);

      if (!ctx.clientId || !ctx.clientSecret) {
        throw new Error(`--client-id and --client-secret are required. Get them from ${ZOHO_API_CONSOLE_URL}`);
      }

      if (ctx.token) {
        await handleAuthSetupToken(ctx);
      } else if (ctx.code) {
        await handleAuthSetupCode(ctx);
      } else {
        await handleAuthSetupStep1(ctx);
      }
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

/**
 * The subset of `auth setup`'s parsed argv that {@link buildAuthSetupContext} reads.
 */
export interface AuthSetupArgv {
  readonly product?: ZohoCliProduct;
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly redirectUri?: string;
  readonly region?: string;
  readonly scopes?: string;
  readonly code?: string;
  readonly token?: string;
  readonly apiMode?: string;
  readonly orgId?: string;
}

export interface AuthSetupContext {
  readonly product: ZohoCliProduct | undefined;
  readonly clientId: string | undefined;
  readonly clientSecret: string | undefined;
  readonly redirectUri: string;
  /**
   * Datacenter to authorize against — or, with `--code`, the datacenter the pasted redirect says issued the code.
   */
  readonly region: string;
  readonly scopes: readonly string[];
  readonly code: string | undefined;
  readonly token: string | undefined;
  readonly accountsUrl: string;
  readonly apiMode: string | undefined;
  readonly orgId: string | undefined;
}

/**
 * Products whose scopes are requested when neither `--scopes` nor `--product` is given.
 */
const DEFAULT_AUTH_SETUP_SCOPES = 'recruit,crm,desk';

/**
 * Resolves which products' OAuth scopes the authorization URL should request.
 *
 * Falls back to the targeted `--product` before the shared default: a product with a dedicated
 * OAuth client ({@link ZOHO_CLI_DEDICATED_CLIENT_PRODUCTS}) authorized under the default trio gets a
 * token that lacks its scopes entirely, and every later call fails as an invalid token rather than
 * as a setup mistake.
 *
 * @param scopes - Raw comma-separated `--scopes` value, when given.
 * @param product - Product targeted by `--product`, when given.
 * @returns Product keys whose scopes should be requested.
 */
export function authSetupScopes(scopes: Maybe<string>, product: Maybe<ZohoCliProduct>): readonly string[] {
  return (scopes ?? product ?? DEFAULT_AUTH_SETUP_SCOPES).split(',').map((p: string) => p.trim());
}

/**
 * Resolves the parsed `auth setup` argv against the stored config into the context every step handler reads.
 *
 * @param argv - Parsed options for the run.
 * @param existingConfig - Config currently loaded, when any.
 * @returns The resolved {@link AuthSetupContext}.
 * @throws {Error} When `--code` is a redirect URL without a code, or names an unknown Zoho Accounts host.
 */
export function buildAuthSetupContext(argv: AuthSetupArgv, existingConfig: Maybe<ZohoCliConfig>): AuthSetupContext {
  // When a product is targeted, prefer its own stored client credentials before falling back to shared.
  // Products with a dedicated OAuth client (e.g. sign) rely on this so their client is not sourced from shared.
  const product = argv.product;
  const productConfig = product ? existingConfig?.[product] : undefined;
  const configuredRegion = argv.region ?? productConfig?.region ?? existingConfig?.shared?.region ?? 'us';
  // the code must be exchanged with the datacenter that issued it, which the pasted redirect names
  const parsedCode = argv.code ? parseZohoAuthRedirect({ pasted: argv.code, fallbackRegion: configuredRegion }) : undefined;
  const region = parsedCode?.region ?? configuredRegion;

  return {
    product,
    clientId: argv.clientId ?? productConfig?.clientId ?? existingConfig?.shared?.clientId,
    clientSecret: argv.clientSecret ?? productConfig?.clientSecret ?? existingConfig?.shared?.clientSecret,
    redirectUri: argv.redirectUri ?? DEFAULT_AUTH_SETUP_REDIRECT_URI,
    region,
    scopes: authSetupScopes(argv.scopes, product),
    code: parsedCode?.code,
    token: argv.token,
    accountsUrl: zohoAccountsConfigApiUrl(region),
    apiMode: argv.apiMode,
    orgId: argv.orgId
  };
}

/**
 * Inputs to {@link authProductConfigUpdate}.
 */
export interface AuthProductConfigUpdateInput {
  readonly product: ZohoCliProduct;
  readonly credentials?: Partial<ZohoCliCredentials>;
  readonly apiMode?: Maybe<string>;
  readonly orgId?: Maybe<string>;
  readonly region?: Maybe<string>;
  readonly redirectUri?: Maybe<string>;
}

/**
 * Builds the per-product block that a `--product`-targeted `auth setup` / `auth set` / `auth login` persists.
 *
 * `orgId` is carried only for {@link ZOHO_CLI_ORG_ID_PRODUCTS} — for any other product the flag is
 * meaningless, and storing it would advertise a scope the product does not have. Every caller goes
 * through here so the gate is defined once by the set instead of per-product at each call site; a
 * hardcoded `=== 'desk'` here is what silently dropped `--org-id` for analytics.
 *
 * A key with nothing to write is emitted as `undefined`, which `mergeCliConfig` treats as
 * "not provided" rather than as a clear — re-running setup without `--org-id` must not wipe a
 * stored one.
 *
 * @param input - Targeted product plus the values the run supplied.
 * @param input.product - Product the run targeted with `--product`.
 * @param input.credentials - Credentials the run supplied, when any.
 * @param input.apiMode - `--api-mode` for the run, when given.
 * @param input.orgId - `--org-id` for the run, when given; kept only for an org-scoped product.
 * @param input.region - Datacenter the product's client was authorized in, when known.
 * @param input.redirectUri - Redirect URI the product's client was authorized with, when known.
 * @returns The product config patch to hand to `mergeCliConfig`.
 */
export function authProductConfigUpdate({ product, credentials, apiMode, orgId, region, redirectUri }: AuthProductConfigUpdateInput): ZohoCliProductConfig {
  return { ...credentials, apiUrl: apiMode ?? undefined, orgId: ZOHO_CLI_ORG_ID_PRODUCTS.has(product) ? (orgId ?? undefined) : undefined, region: region ?? undefined, redirectUri: redirectUri ?? undefined };
}

async function mergeCredsConfig(ctx: AuthSetupContext, creds: ZohoCliCredentials): Promise<ZohoCliConfig> {
  if (ctx.product) {
    return mergeCliConfig({
      [ctx.product]: authProductConfigUpdate({ product: ctx.product, credentials: creds, apiMode: ctx.apiMode, orgId: ctx.orgId, region: ctx.region })
    });
  }
  return mergeCliConfig({
    shared: { ...creds, region: ctx.region, apiMode: ctx.apiMode },
    desk: ctx.orgId ? { orgId: ctx.orgId } : undefined
  });
}

async function handleAuthSetupToken(ctx: AuthSetupContext): Promise<void> {
  const creds: ZohoCliCredentials = { clientId: ctx.clientId as string, clientSecret: ctx.clientSecret as string, refreshToken: ctx.token as string };
  const merged = await mergeCredsConfig(ctx, creds);
  outputResult({
    success: true,
    ...(ctx.product ? { product: ctx.product } : {}),
    refreshToken: maskSecret(ctx.token as string),
    configSaved: true,
    configuredProducts: await configuredProductsAfterSave(merged)
  });
}

async function handleAuthSetupCode(ctx: AuthSetupContext): Promise<void> {
  const tokenResponse = await exchangeZohoAuthorizationCode({ clientId: ctx.clientId as string, clientSecret: ctx.clientSecret as string, region: ctx.region, code: ctx.code as string, redirectUri: ctx.redirectUri });
  const refreshToken = tokenResponse.refresh_token;
  const creds: ZohoCliCredentials = { clientId: ctx.clientId as string, clientSecret: ctx.clientSecret as string, refreshToken };
  const merged = await mergeCredsConfig(ctx, creds);

  outputResult({
    step: 2,
    success: true,
    product: ctx.product ?? 'shared',
    region: ctx.region,
    refreshToken: maskSecret(refreshToken),
    accessToken: tokenResponse.access_token ? maskSecret(tokenResponse.access_token) : null,
    scope: tokenResponse.scope,
    configSaved: true,
    configuredProducts: await configuredProductsAfterSave(merged)
  });
}

/**
 * Persists the credentials a step-1 (`auth setup` without `--code`/`--token`) run supplied.
 *
 * Split out from {@link handleAuthSetupStep1} so the persistence is testable without the printed
 * authorization URL; step 1 is the run that must both store `--org-id` and leave an already stored
 * one alone when the flag is omitted. The stored refresh token is never written here, so re-running
 * step 1 keeps a working one until step 2 replaces it.
 *
 * @param ctx - Resolved setup context for the run.
 * @returns The merged config that was written.
 */
export async function saveAuthSetupStep1Config(ctx: AuthSetupContext): Promise<ZohoCliConfig> {
  let result: ZohoCliConfig;

  if (ctx.product) {
    // Store the client under the product and leave shared alone, so a dedicated-client product like
    // sign does not clobber the shared recruit/crm/desk client.
    result = await mergeCliConfig({
      [ctx.product]: authProductConfigUpdate({
        product: ctx.product,
        credentials: { clientId: ctx.clientId as string, clientSecret: ctx.clientSecret as string },
        apiMode: ctx.apiMode,
        orgId: ctx.orgId,
        region: ctx.region
      })
    });
  } else {
    // A shared setup authorizes the shared client, and desk is the only org-scoped product that uses
    // it — the others in ZOHO_CLI_ORG_ID_PRODUCTS have a dedicated client and are set up with --product.
    result = await mergeCliConfig({
      shared: {
        clientId: ctx.clientId as string,
        clientSecret: ctx.clientSecret as string,
        region: ctx.region,
        apiMode: ctx.apiMode
      },
      desk: ctx.orgId ? { orgId: ctx.orgId } : undefined
    });
  }

  return result;
}

/**
 * Builds the authorization URL step 1 of `auth setup` prints.
 *
 * Built by `@dereekb/zoho`'s authorize URL factory, so it carries `access_type=offline` and
 * `prompt=consent` — without the latter, a re-consent comes back with no refresh token. Step 1 sends
 * no `state`: the code is pasted back by hand into a separate run that has no state to check against.
 *
 * @param ctx - Resolved setup context for the run.
 * @returns The authorization URL and the scopes it requests.
 * @throws {Error} When none of the requested products is a known one.
 */
export function authSetupAuthorizationUrl(ctx: AuthSetupContext): { readonly authorizationUrl: string; readonly scopes: ZohoOAuthScope[] } {
  // A product-targeted setup authorizes that product's own OAuth client, so the URL requests only
  // that product's scopes; the shared setup requests the combined scopes from --scopes.
  const scopes = zohoCliScopesForProducts(ctx.product ? [ctx.product] : ctx.scopes);
  const authorizationUrl = zohoAccountsAuthorizeUrlFactory({ clientId: ctx.clientId as string, redirectUri: ctx.redirectUri, scopes, accountsApiUrl: ctx.region })();
  return { authorizationUrl, scopes };
}

async function handleAuthSetupStep1(ctx: AuthSetupContext): Promise<void> {
  const { authorizationUrl, scopes } = authSetupAuthorizationUrl(ctx);

  await saveAuthSetupStep1Config(ctx);

  const productFlag = ctx.product ? `--product ${ctx.product} ` : '';

  outputResult({
    step: 1,
    product: ctx.product ?? 'shared',
    instructions: 'Open the authorization URL in a browser. Authorize the application. Copy the "code" parameter from the redirect URL.',
    authorizationUrl,
    redirectUri: ctx.redirectUri,
    scopes,
    credentialsSaved: true,
    nextStep: `zoho-cli auth setup ${productFlag}--code "PASTE_REDIRECT_URL_OR_AUTH_CODE"`,
    tip: `zoho-cli auth login ${productFlag}does both steps in one command: it opens the browser and captures the redirect on ${DEFAULT_AUTH_LOGIN_REDIRECT_URI} (register that redirect URI on the client first).`
  });
}

// MARK: Set
const authSetCommand: CommandModule = {
  command: 'set',
  describe: 'Save Zoho API credentials directly',
  builder: (yargs: Argv) =>
    yargs
      .option('client-id', { type: 'string', demandOption: true, describe: 'OAuth client ID' })
      .option('client-secret', { type: 'string', demandOption: true, describe: 'OAuth client secret' })
      .option('refresh-token', { type: 'string', demandOption: true, describe: 'OAuth refresh token' })
      .option('product', { type: 'string', choices: [...ZOHO_CLI_PRODUCTS] as const, describe: 'Store for a specific product instead of shared' })
      .option('region', { type: 'string', defaultDescription: 'the stored region, otherwise us', choices: ZOHO_CLI_REGION_CHOICES, describe: 'Zoho datacenter' })
      .option('org-id', { type: 'string', describe: ORG_ID_OPTION_DESCRIBE })
      .option('api-mode', { type: 'string', default: 'production', choices: ['production', 'sandbox'] as const, describe: 'API mode' })
      .example([
        ['$0 auth set --client-id abc --client-secret xyz --refresh-token 1000.abc.xyz', 'Set shared credentials'],
        ['$0 auth set --product crm --client-id abc --client-secret xyz --refresh-token 1000.crm.xyz', 'Set CRM-specific credentials']
      ]),
  handler: async (argv: any) => {
    try {
      const product = argv.product as ZohoCliProduct | undefined;
      const creds: ZohoCliCredentials = {
        clientId: argv.clientId,
        clientSecret: argv.clientSecret,
        refreshToken: argv.refreshToken
      };

      let merged: ZohoCliConfig;

      if (product) {
        merged = await mergeCliConfig({
          [product]: authProductConfigUpdate({ product, credentials: creds, apiMode: argv.apiMode, orgId: argv.orgId, region: argv.region })
        });
      } else {
        merged = await mergeCliConfig({
          shared: { ...creds, region: argv.region, apiMode: argv.apiMode },
          desk: argv.orgId ? { orgId: argv.orgId } : undefined
        });
      }

      outputResult({ saved: true, product: product ?? 'shared', configuredProducts: await configuredProductsAfterSave(merged) });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

// MARK: Login
/**
 * Default time `auth login` waits for the browser redirect before falling back to the paste prompt.
 *
 * Long enough to cover a first-time sign-in (account picker, MFA, consent screen), since the fallback
 * costs the user the whole flow again.
 */
const DEFAULT_AUTH_LOGIN_LISTEN_FOR = '5m';

const authLoginCommand: CommandModule = {
  command: 'login',
  describe: 'Authorize in the browser and store the refresh token (one command; captures the redirect on a local port)',
  builder: (yargs: Argv) =>
    yargs
      .option('product', { type: 'string', choices: [...ZOHO_CLI_PRODUCTS] as const, describe: 'Log in a specific product (with its own OAuth client) instead of shared' })
      .option('client-id', { type: 'string', defaultDescription: 'the stored client, otherwise prompted', describe: `OAuth client ID (from ${ZOHO_API_CONSOLE_URL})` })
      .option('client-secret', { type: 'string', defaultDescription: 'the stored client, otherwise prompted', describe: 'OAuth client secret' })
      .option('scopes', { type: 'string', defaultDescription: '--product when given, otherwise recruit,crm,desk', describe: 'Comma-separated products for OAuth scopes (recruit,crm,desk,sign,analytics)' })
      .option('region', { type: 'string', defaultDescription: 'the stored region, otherwise us', choices: ZOHO_CLI_REGION_CHOICES, describe: 'Zoho datacenter to authorize against (the one Zoho redirects back with wins)' })
      .option('redirect-uri', { type: 'string', defaultDescription: `the stored one, otherwise ${DEFAULT_AUTH_LOGIN_REDIRECT_URI}`, describe: 'Redirect URI registered on the Zoho client' })
      .option('redirect-port', { type: 'number', describe: 'Bind the loopback listener on this port instead of the redirect URI one. The resulting redirect URI must also be registered on the client.' })
      .option('open', { type: 'boolean', default: true, describe: 'Open the authorization URL in the default browser. Use --no-open to print it only.' })
      .option('listen', { type: 'boolean', default: true, describe: 'Capture the browser redirect on the loopback redirect URI. Use --no-listen to always paste it back by hand.' })
      .option('listen-for', { type: 'string', default: DEFAULT_AUTH_LOGIN_LISTEN_FOR, describe: 'How long to wait for the browser redirect before falling back to the paste prompt (e.g. 5m, 90s)' })
      .option('code', { type: 'string', describe: 'Skip the browser and pass the redirect URL or bare code directly' })
      .option('org-id', { type: 'string', describe: ORG_ID_OPTION_DESCRIBE })
      .option('api-mode', { type: 'string', choices: ['production', 'sandbox'] as const, describe: 'API mode' })
      .example([
        ['$0 auth login', 'Log in the shared client (recruit, crm, desk) in the browser'],
        ['$0 auth login --client-id 1000.ABC --client-secret xyz --org-id 1234567', 'First login: store the client and the Desk org id'],
        ['$0 auth login --product sign', 'Log in the dedicated Sign client'],
        ['$0 auth login --no-listen', 'Paste the redirect URL back by hand (e.g. over SSH)']
      ]),
  handler: async (argv: any) => {
    try {
      await handleAuthLogin(argv);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

/**
 * The subset of `auth login`'s parsed argv the flow reads.
 */
export interface AuthLoginArgv {
  readonly product?: ZohoCliProduct;
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly scopes?: string;
  readonly region?: string;
  readonly redirectUri?: string;
  readonly redirectPort?: number;
  readonly open?: boolean;
  readonly listen?: boolean;
  readonly listenFor?: string;
  readonly code?: string;
  readonly orgId?: string;
  readonly apiMode?: string;
}

export interface AuthLoginContext {
  /**
   * Product being logged in, or `undefined` for the shared client.
   */
  readonly product: Maybe<ZohoCliProduct>;
  readonly clientId: Maybe<string>;
  readonly clientSecret: Maybe<string>;
  readonly redirectUri: string;
  /**
   * Datacenter the authorization request is sent to.
   */
  readonly region: string;
  readonly scopes: ZohoOAuthScope[];
  readonly apiMode: Maybe<string>;
  readonly orgId: Maybe<string>;
}

/**
 * Resolves the parsed `auth login` argv against the loaded config.
 *
 * - Client id/secret: the flags, then the logged-in block's stored client, then the shared client —
 *   except for {@link ZOHO_CLI_DEDICATED_CLIENT_PRODUCTS}, which never borrow the shared client.
 * - Redirect URI: the flag, then the one the client was last logged in with, then {@link DEFAULT_AUTH_LOGIN_REDIRECT_URI}.
 * - Region: the flag, then the stored region, then `us`.
 *
 * Empty stored values (step 1 of `auth setup` stores an empty refresh token) count as absent.
 *
 * @param argv - Parsed options for the run.
 * @param existingConfig - Config currently loaded, when any.
 * @returns The resolved {@link AuthLoginContext}.
 * @throws {Error} When none of the requested products is a known one.
 */
export function buildAuthLoginContext(argv: AuthLoginArgv, existingConfig: Maybe<ZohoCliConfig>): AuthLoginContext {
  const product = argv.product;
  const productConfig = product ? existingConfig?.[product] : undefined;
  const sharedClientConfig = product && ZOHO_CLI_DEDICATED_CLIENT_PRODUCTS.has(product) ? undefined : existingConfig?.shared;
  const firstValue = (...values: Maybe<string>[]): Maybe<string> => values.find((x) => x != null && x !== '');

  return {
    product,
    clientId: firstValue(argv.clientId, productConfig?.clientId, sharedClientConfig?.clientId),
    clientSecret: firstValue(argv.clientSecret, productConfig?.clientSecret, sharedClientConfig?.clientSecret),
    redirectUri: firstValue(argv.redirectUri, productConfig?.redirectUri, sharedClientConfig?.redirectUri) ?? DEFAULT_AUTH_LOGIN_REDIRECT_URI,
    region: firstValue(argv.region, productConfig?.region, existingConfig?.shared?.region) ?? 'us',
    scopes: zohoCliScopesForProducts(authSetupScopes(argv.scopes, product)),
    apiMode: argv.apiMode,
    orgId: argv.orgId
  };
}

/**
 * What a completed `auth login` authorization produced.
 */
export interface AuthLoginResult {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
  /**
   * Datacenter that issued the grant.
   */
  readonly region: string;
  /**
   * Redirect URI the grant was authorized with.
   */
  readonly redirectUri: string;
}

/**
 * Persists a completed `auth login`.
 *
 * A shared login writes the shared block (plus Desk's org id when one was given, desk being the only
 * org-scoped product on the shared client). A product login writes only that product's block and
 * leaves shared untouched.
 *
 * @param ctx - Resolved login context for the run.
 * @param result - The authorized client and its new refresh token.
 * @returns The merged config that was written.
 */
export function saveAuthLoginResult(ctx: AuthLoginContext, result: AuthLoginResult): Promise<ZohoCliConfig> {
  const { clientId, clientSecret, refreshToken, region, redirectUri } = result;
  let merged: Promise<ZohoCliConfig>;

  if (ctx.product) {
    merged = mergeCliConfig({
      [ctx.product]: authProductConfigUpdate({ product: ctx.product, credentials: { clientId, clientSecret, refreshToken }, apiMode: ctx.apiMode, orgId: ctx.orgId, region, redirectUri })
    });
  } else {
    merged = mergeCliConfig({
      shared: { clientId, clientSecret, refreshToken, region, redirectUri, apiMode: ctx.apiMode ?? undefined },
      desk: ctx.orgId ? { orgId: ctx.orgId } : undefined
    });
  }

  return merged;
}

/**
 * Fills in a missing client id/secret by prompting for it on a terminal.
 *
 * @param ctx - Resolved login context for the run.
 * @returns The context with both client values present.
 * @throws {Error} When a value is missing and stdin is not a terminal to prompt on.
 */
async function promptAuthLoginClient(ctx: AuthLoginContext): Promise<AuthLoginContext & { readonly clientId: string; readonly clientSecret: string }> {
  if (!(ctx.clientId && ctx.clientSecret) && !process.stdin.isTTY) {
    throw new Error(`No stored OAuth client to log in with. Pass --client-id and --client-secret (create a client at ${ZOHO_API_CONSOLE_URL}).`);
  }

  let clientId = ctx.clientId;
  let clientSecret = ctx.clientSecret;

  if (!clientId) {
    // the question goes to stderr so stdout stays the JSON result
    process.stderr.write(`Zoho OAuth client ID (from ${ZOHO_API_CONSOLE_URL}): `);
    clientId = (await promptLine({ question: '' })).trim();
  }

  if (!clientSecret) {
    process.stderr.write('Zoho OAuth client secret: ');
    clientSecret = (await promptLine({ question: '', mask: true })).trim();
  }

  if (!clientId || !clientSecret) {
    throw new Error('A client id and client secret are both required to log in.');
  }

  return { ...ctx, clientId, clientSecret };
}

/**
 * Waits for the authorization redirect: the loopback listener raced against a paste prompt, so the
 * flow still finishes when the browser cannot reach this machine (SSH, a container).
 *
 * @param capture - The started listener, when one could be bound.
 * @param listenForMs - How long to wait on the listener before only the prompt remains.
 * @returns The redirect URL (or bare code) received.
 */
async function waitForAuthLoginRedirect(capture: Maybe<LoopbackRedirectCapture>, listenForMs: number): Promise<string> {
  let pasted: string;

  try {
    if (capture) {
      process.stderr.write(`Waiting for the redirect to ${capture.redirectUri} ... (or paste the redirect URL here)\n`);

      const controller = new AbortController();
      const prompt = promptLine({ question: '', signal: controller.signal });
      const redirected = capture.waitForRedirect(listenForMs);

      // whichever source loses is abandoned mid-flight; its rejection is expected, not unhandled
      prompt.catch(noop);
      redirected.catch(noop);

      try {
        pasted = await Promise.race([redirected, prompt]);
      } catch (e) {
        // only the listener's timeout reaches here — the prompt is still open, so keep waiting on it
        process.stderr.write(`${(e as Error).message}\n`);
        pasted = await prompt;
      } finally {
        // released only once a winner is settled, so an aborted prompt cannot win the race
        controller.abort();
      }
    } else {
      process.stderr.write('Paste the redirect URL (or the code) here: ');
      pasted = await promptLine({ question: '' });
    }
  } finally {
    // unconditional: a listener left bound keeps the process alive well past the command
    await capture?.close();
  }

  return pasted;
}

/**
 * Evicts the cached access tokens of every product that now resolves to the new grant.
 *
 * The token cache is keyed by product, not by grant, so without this the next call would keep using
 * an access token minted from the replaced refresh token until it expired.
 *
 * @param result - The new grant.
 * @returns Resolves once the cache entries are cleared.
 */
async function clearAuthLoginCachedTokens(result: AuthLoginResult): Promise<void> {
  const config = await loadCliConfig();
  const cacheService = fileZohoAccountsAccessTokenCacheService(getTokenCachePath(), false);
  const products = config
    ? ZOHO_CLI_PRODUCTS.filter((product) => {
        const resolved = resolveProductCredentials(config, product);
        return resolved?.clientId === result.clientId && resolved.refreshToken === result.refreshToken;
      })
    : [];

  await Promise.all(products.map((product) => cacheService.loadZohoAccessTokenCache(product).clearCachedToken()));
}

/**
 * Runs `auth login`: authorize in the browser, capture (or accept a pasted) redirect, exchange the
 * code with the datacenter that issued it, and store the refresh token.
 *
 * @param argv - Parsed options for the run.
 * @returns Resolves once the result is stored and reported.
 */
async function handleAuthLogin(argv: AuthLoginArgv): Promise<void> {
  const ctx = await promptAuthLoginClient(buildAuthLoginContext(argv, await loadCliConfig()));
  const listenFor = argv.listenFor ?? DEFAULT_AUTH_LOGIN_LISTEN_FOR;
  const listenForMs = parseDurationStringToMilliseconds(listenFor);

  if (!(listenForMs > 0)) {
    throw new Error(`--listen-for: invalid duration "${listenFor}". Use formats like "5m", "90s", or mixed units like "1h30m".`);
  }

  const state = generateOAuthState();
  const suppliedCode = argv.code;
  const shouldListen = suppliedCode == null && argv.listen !== false;
  const loopbackTarget = shouldListen ? parseLoopbackRedirectUri({ redirectUri: ctx.redirectUri, port: argv.redirectPort }) : undefined;
  let capture: Maybe<LoopbackRedirectCapture>;

  // the listener is started before the URL is built, since the port it binds is part of the redirect_uri
  if (loopbackTarget) {
    try {
      capture = await startLoopbackRedirectCapture({ target: loopbackTarget, successMessage: 'Zoho login complete — you can close this tab and return to your terminal.' });
    } catch (e) {
      process.stderr.write(`${(e as Error).message} Falling back to pasting the redirect URL.\n`);
    }
  } else if (shouldListen) {
    const productFlag = ctx.product ? `--product ${ctx.product} ` : '';
    process.stderr.write(
      `Redirect capture is unavailable: "${ctx.redirectUri}" has no loopback port to bind.\n  To capture the redirect automatically, add ${DEFAULT_AUTH_LOGIN_REDIRECT_URI} as an Authorized Redirect URI on the Zoho client, then run:\n    zoho-cli auth login ${productFlag}--redirect-uri ${DEFAULT_AUTH_LOGIN_REDIRECT_URI}\n`
    );
  }

  // identical to the resolved redirect URI unless --redirect-port moved it; the exchange must echo it back
  const redirectUri = capture?.redirectUri ?? ctx.redirectUri;
  let pasted: string;

  if (suppliedCode == null) {
    const authorizationUrl = zohoAccountsAuthorizeUrlFactory({ clientId: ctx.clientId, redirectUri, scopes: ctx.scopes, accountsApiUrl: ctx.region })({ state });

    // printed even when the browser opens: it is the fallback whenever the launch fails. stderr keeps stdout parseable.
    process.stderr.write(`Authorization URL:\n  ${authorizationUrl}\n`);

    if (argv.open !== false && !(await openUrlInBrowser({ url: authorizationUrl }))) {
      process.stderr.write('Could not open a browser automatically — open the URL above by hand.\n');
    }

    pasted = await waitForAuthLoginRedirect(capture, listenForMs);
  } else {
    pasted = suppliedCode;
  }

  // a --code pasted from an earlier run carries no state of this run's to check against
  const { code, region } = parseZohoAuthRedirect({ pasted, expectedState: suppliedCode == null ? state : undefined, fallbackRegion: ctx.region });
  const tokenResponse = await exchangeZohoAuthorizationCode({ clientId: ctx.clientId, clientSecret: ctx.clientSecret, region, code, redirectUri });
  const result: AuthLoginResult = { clientId: ctx.clientId, clientSecret: ctx.clientSecret, refreshToken: tokenResponse.refresh_token, region, redirectUri };
  const user = await loadZohoAuthUserEmail({ clientId: ctx.clientId, clientSecret: ctx.clientSecret, region, accessToken: tokenResponse.access_token });

  const merged = await saveAuthLoginResult(ctx, result);
  await clearAuthLoginCachedTokens(result);

  const block: ZohoCliCredentialBlockKey = ctx.product ?? 'shared';
  const envVarName = zohoCliRefreshTokenEnvVarName(block);

  if (process.env[envVarName]) {
    process.stderr.write(`Note: ${envVarName} is set, but the stored login now takes precedence over it.\n`);
  }

  outputResult({
    loggedIn: true,
    product: block,
    region,
    user,
    scopes: zohoOAuthScopesFromScopeString(tokenResponse.scope) ?? ctx.scopes,
    refreshToken: maskSecret(result.refreshToken),
    configuredProducts: await configuredProductsAfterSave(merged)
  });
}

// MARK: Show
function maskCredentials(creds: Maybe<Partial<ZohoCliCredentials>>) {
  return creds
    ? {
        clientId: creds.clientId ? maskSecret(creds.clientId) : undefined,
        clientSecret: creds.clientSecret ? maskSecret(creds.clientSecret) : undefined,
        refreshToken: creds.refreshToken ? maskSecret(creds.refreshToken) : undefined
      }
    : undefined;
}

function maskProductConfig(product: ZohoCliProduct, productConfig: Maybe<ZohoCliProductConfig>) {
  return productConfig ? { ...maskCredentials(productConfig), apiUrl: productConfig.apiUrl, ...(productConfig.region ? { region: productConfig.region } : {}), ...(ZOHO_CLI_ORG_ID_PRODUCTS.has(product) ? { orgId: productConfig.orgId } : {}) } : null;
}

/**
 * Builds the masked view of the stored config that `auth show` prints.
 *
 * Product blocks are derived from {@link ZOHO_CLI_PRODUCTS} rather than written out one by one: a
 * product missing from a hand-maintained literal is reported as absent no matter what is on disk,
 * which is exactly how a fully configured analytics install showed nothing here. `orgId` is
 * surfaced for {@link ZOHO_CLI_ORG_ID_PRODUCTS}, whose calls cannot work without it.
 *
 * `credentialSources`, when given, reports per block whether the credentials came from the config file
 * or env vars — a stored login wins over env, which is otherwise invisible here.
 *
 * `tokenSource`, when a token source is active, is reported (command, origin, covered products,
 * datacenter, expiry, scopes — never the token) and counted in `configuredProducts`.
 *
 * @param config - Loaded CLI configuration.
 * @param credentialSources - Per-block credential sources, from `zohoCliCredentialSources`.
 * @param tokenSource - The active token source's status, from `loadZohoCliTokenSourceStatus`.
 * @returns Result object with every secret masked, and `null` for each product with no stored block.
 */
export function buildAuthShowResult(config: ZohoCliConfig, credentialSources?: Maybe<Record<ZohoCliCredentialBlockKey, ZohoCliCredentialSource>>, tokenSource?: Maybe<ZohoCliTokenSourceStatus>): Record<string, unknown> {
  const productResults = Object.fromEntries(ZOHO_CLI_PRODUCTS.map((product) => [product, maskProductConfig(product, config[product])]));

  return {
    configured: true,
    shared: {
      ...maskCredentials(config.shared),
      region: config.shared?.region ?? 'us',
      apiMode: config.shared?.apiMode ?? 'production'
    },
    ...productResults,
    configuredProducts: configuredProducts(config, tokenSource?.resolved),
    ...(credentialSources ? { credentialSources } : {}),
    ...(tokenSource ? { tokenSource: zohoCliTokenSourceReport(tokenSource) } : {})
  };
}

const authShowCommand: CommandModule = {
  command: 'show',
  describe: 'Show current configuration (secrets masked)',
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    try {
      const config = await loadCliConfig();
      const fileConfig = await loadCliConfigFile();
      outputResult(config ? buildAuthShowResult(config, zohoCliCredentialSources(fileConfig), await loadZohoCliTokenSourceStatus(fileConfig)) : { configured: false });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

// MARK: Check
const authCheckCommand: CommandModule = {
  command: 'check',
  describe: 'Verify credentials by exchanging tokens',
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    try {
      const config = await loadCliConfig();

      if (config) {
        const tokenSourceStatus = await loadZohoCliTokenSourceStatus(await loadCliConfigFile());
        const tokenSource = tokenSourceStatus?.resolved;
        const tokenSourceResult = tokenSourceStatus ? { tokenSource: zohoCliTokenSourceReport(tokenSourceStatus) } : {};
        const products = configuredProducts(config, tokenSource);

        if (products.length === 0) {
          outputResult({ authenticated: false, error: 'No products have complete credentials or a token source covering them. Run: zoho-cli auth login, or zoho-cli auth token-source set "<command>"', ...tokenSourceResult });
        } else {
          // Try token exchange for each configured product
          const context = createCliContext(config, tokenSource);
          const productApis = toZohoCliProductApis(context);
          const results: Record<string, unknown> = {};

          for (const product of products) {
            try {
              const api = productApis[product];

              if (!api) {
                results[product] = { authenticated: false, error: 'Not configured' };
                continue;
              }

              if (tokenSource?.products.includes(product)) {
                // A token-source product has no refresh token to exchange: load the token through the
                // product's accounts API, which runs the token source. Never echo the token itself.
                const token = await api.zohoAccountsApi.accountsContext.loadAccessToken();
                results[product] = { authenticated: true, source: 'tokenSource', scope: token.scope, expiresAt: token.expiresAt.toISOString() };
              } else {
                // Exchange through the product's own accounts API so the reported scope is the grant
                // that product actually authenticates with. Only the scope and lifetime are echoed —
                // never the access token itself.
                const tokenResponse = await api.zohoAccountsApi.accessToken();
                results[product] = { authenticated: true, scope: tokenResponse.scope, expiresIn: tokenResponse.expires_in };
              }
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              results[product] = { authenticated: false, error: message };
            }
          }

          outputResult({ products: results, ...tokenSourceResult });
        }
      } else {
        outputResult({ authenticated: false, error: 'No credentials configured. Run: zoho-cli auth login' });
      }
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

// MARK: Token Source
/**
 * Result of {@link setAuthTokenSource}.
 */
export interface SetAuthTokenSourceResult {
  readonly saved: true;
  readonly command: string;
  /**
   * The {@link ZOHO_CLI_TOKEN_COMMAND_ENV_VAR} command, when set — it wins over the saved one for runs where it is set.
   */
  readonly envOverride?: string;
}

/**
 * Saves the token source command (`auth token-source set`).
 *
 * Writes only the `tokenSource` block — the `shared` and product credential blocks are left as they
 * are, and take over again for every product once the source is cleared. The cached token of a
 * replaced command is removed from the token file.
 *
 * @param command - The token source command, e.g. `demo-cli external-token zoho_admin`.
 * @returns What was saved.
 * @throws {Error} When the command is blank.
 */
export async function setAuthTokenSource(command: string): Promise<SetAuthTokenSourceResult> {
  const trimmed = command.trim();

  if (!trimmed) {
    throw new Error('The token source command cannot be empty.');
  }

  const previous = (await loadCliConfigFile())?.tokenSource?.command;
  await saveCliTokenSourceConfig({ command: trimmed });

  if (previous && previous !== trimmed) {
    await clearCachedZohoCliTokenSourceToken({ command: previous });
  }

  const envOverride = zohoCliTokenCommandFromEnv();
  return { saved: true, command: trimmed, ...(envOverride ? { envOverride } : {}) };
}

/**
 * Result of {@link clearAuthTokenSource}.
 */
export interface ClearAuthTokenSourceResult {
  readonly cleared: boolean;
  /**
   * The command that was removed, when one was saved.
   */
  readonly command?: string;
  /**
   * The {@link ZOHO_CLI_TOKEN_COMMAND_ENV_VAR} command, when set — it still applies to runs where it is set.
   */
  readonly envOverride?: string;
}

/**
 * Removes the saved token source (`auth token-source clear`) and its cached token.
 *
 * Only the `tokenSource` block is removed, so the stored credentials apply again to every product.
 *
 * @returns What was cleared.
 */
export async function clearAuthTokenSource(): Promise<ClearAuthTokenSourceResult> {
  const previous = (await loadCliConfigFile())?.tokenSource?.command;

  if (previous) {
    await saveCliTokenSourceConfig(undefined);
    await clearCachedZohoCliTokenSourceToken({ command: previous });
  }

  const envOverride = zohoCliTokenCommandFromEnv();
  return { cleared: previous != null, ...(previous ? { command: previous } : {}), ...(envOverride ? { envOverride } : {}) };
}

/**
 * Result of {@link buildAuthTokenSourceShowResult}.
 */
export interface AuthTokenSourceShowResult {
  /**
   * The saved command, or null.
   */
  readonly saved: Maybe<string>;
  /**
   * The {@link ZOHO_CLI_TOKEN_COMMAND_ENV_VAR} command, or null.
   */
  readonly envOverride: Maybe<string>;
  /**
   * The source in effect, or null when none is.
   */
  readonly active: Maybe<ZohoCliActiveTokenSource>;
  /**
   * What the active source's cached token covers, or null when no token is cached. Never the token.
   */
  readonly cached: Maybe<Record<string, unknown>>;
}

/**
 * Builds the `auth token-source show` result. Does NOT run the command: only a token already cached
 * in the token file is described (use `auth check` to run it).
 *
 * @returns The saved and env commands, the active source, and the cached token's coverage.
 */
export async function buildAuthTokenSourceShowResult(): Promise<AuthTokenSourceShowResult> {
  const fileConfig = await loadCliConfigFile();
  const active = resolveZohoCliActiveTokenSource(fileConfig);
  const cachedToken = active ? await loadCachedZohoCliTokenSourceToken({ command: active.command }) : undefined;
  let cached: Maybe<Record<string, unknown>> = null;

  if (cachedToken) {
    const { products, datacenter } = zohoCliTokenSourceCoverage(cachedToken);
    cached = { products, datacenter, expiresAt: cachedToken.expiresAt, scopes: cachedToken.scopes };
  }

  return {
    saved: fileConfig?.tokenSource?.command ?? null,
    envOverride: zohoCliTokenCommandFromEnv() ?? null,
    active: active ?? null,
    cached
  };
}

const authTokenSourceSetCommand: CommandModule = {
  command: 'set <token-command>',
  describe: 'Save a command that prints a Zoho access token bundle (e.g. "demo-cli external-token zoho_admin")',
  builder: (yargs: Argv) => yargs.positional('token-command', { type: 'string', demandOption: true, describe: 'The command to run (quote it as one argument)' }).example([['$0 auth token-source set "demo-cli external-token zoho_admin"', 'Use tokens minted by demo-cli for every product their scopes cover']]),
  handler: async (argv: any) => {
    try {
      const result = await setAuthTokenSource(String(argv.tokenCommand ?? ''));
      outputResult({ ...result, nextStep: 'zoho-cli auth check' });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const authTokenSourceShowCommand: CommandModule = {
  command: 'show',
  describe: `Show the saved token source, the ${ZOHO_CLI_TOKEN_COMMAND_ENV_VAR} override, and the cached token's coverage (never the token)`,
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    try {
      outputResult(await buildAuthTokenSourceShowResult());
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const authTokenSourceClearCommand: CommandModule = {
  command: 'clear',
  describe: 'Remove the saved token source; stored credentials apply again',
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    try {
      outputResult(await clearAuthTokenSource());
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const authTokenSourceCommand: CommandModule = {
  command: 'token-source',
  describe: `Use a command that mints Zoho access tokens instead of stored credentials (per run: ${ZOHO_CLI_TOKEN_COMMAND_ENV_VAR})`,
  builder: (yargs: Argv) => yargs.command(authTokenSourceSetCommand).command(authTokenSourceShowCommand).command(authTokenSourceClearCommand).demandCommand(1, 'Please specify a token-source subcommand.'),
  handler: noop
};

// MARK: Clear
const authClearCommand: CommandModule = {
  command: 'clear',
  describe: 'Remove stored credentials and token cache',
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    try {
      await clearCliConfig();
      outputResult({ cleared: true });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

// MARK: Auth
export const AUTH_COMMAND: CommandModule = {
  command: 'auth',
  describe: 'Manage Zoho API credentials',
  builder: (yargs: Argv) => yargs.command(authLoginCommand).command(authSetupCommand).command(authSetCommand).command(authShowCommand).command(authCheckCommand).command(authTokenSourceCommand).command(authClearCommand).demandCommand(1, 'Please specify an auth subcommand.'),
  handler: noop
};
