import type { CommandModule, Argv } from 'yargs';
import { loadCliConfig, mergeCliConfig, clearCliConfig, maskSecret, configuredProducts, ZOHO_CLI_PRODUCTS, ZOHO_CLI_ORG_ID_PRODUCTS, type ZohoCliConfig, type ZohoCliProduct, type ZohoCliCredentials, type ZohoCliProductConfig } from '../config/cli.config';
import { noop, type Maybe } from '@dereekb/util';
import { createCliContext, toZohoCliProductApis } from '../context/cli.context';
import { outputResult, outputError } from '../util/output';

// MARK: Regions
const ZOHO_ACCOUNTS_URLS: Record<string, string> = {
  us: 'https://accounts.zoho.com',
  eu: 'https://accounts.zoho.eu',
  in: 'https://accounts.zoho.in',
  au: 'https://accounts.zoho.com.au',
  jp: 'https://accounts.zoho.jp'
};

// MARK: Scopes
const ZOHO_SCOPES: Record<string, string[]> = {
  recruit: ['ZohoRecruit.modules.ALL', 'ZohoRecruit.settings.all', 'ZohoRecruit.functions.execute.READ', 'ZohoRecruit.functions.execute.CREATE'],
  crm: ['ZohoCRM.modules.ALL', 'ZohoCRM.settings.ALL', 'ZohoCRM.functions.execute.READ', 'ZohoCRM.functions.execute.CREATE'],
  desk: ['Desk.tickets.ALL', 'Desk.tasks.ALL', 'Desk.contacts.ALL', 'Desk.settings.ALL', 'Desk.events.ALL', 'Desk.search.READ', 'Desk.articles.READ', 'Desk.basic.READ'],
  sign: ['ZohoSign.documents.ALL', 'ZohoSign.templates.ALL'],
  analytics: ['ZohoAnalytics.data.all', 'ZohoAnalytics.metadata.all', 'ZohoAnalytics.modeling.all']
};

/**
 * Redirect URI used when `--redirect-uri` is not given. Must match what the API console has registered.
 */
export const DEFAULT_AUTH_SETUP_REDIRECT_URI = 'http://localhost/oauth';

/**
 * `--org-id` help text, listing the org-scoped products from {@link ZOHO_CLI_ORG_ID_PRODUCTS} so the
 * documented set cannot drift from the set the code actually persists for.
 */
const ORG_ID_OPTION_DESCRIBE = `Organization ID, for the products scoped by one (${Array.from(ZOHO_CLI_ORG_ID_PRODUCTS).join(', ')})`;

/**
 * Extracts the authorization code from a full redirect URL or returns the input as-is if it's already a code.
 *
 * Lets users paste either the raw `code` query value or the entire browser-redirected URL into `--code`.
 *
 * @param input - The user-supplied value (raw code, full `http(s)://...` URL, or `undefined`).
 * @returns The extracted authorization code, or `undefined` when `input` itself is `undefined`.
 * @throws {Error} When `input` is a URL that lacks a `code` query parameter, or when it starts with `http://`/`https://` but cannot be parsed as a URL.
 */
function parseCodeFromInput(input: string | undefined): string | undefined {
  let result: string | undefined;

  if (!input) {
    result = undefined;
  } else if (input.startsWith('http://') || input.startsWith('https://')) {
    // If the input looks like a URL, extract the code query parameter
    try {
      const url = new URL(input);
      const code = url.searchParams.get('code');

      if (!code) {
        throw new Error('No "code" parameter found in the provided URL.');
      }

      result = code;
    } catch (e) {
      if (e instanceof TypeError) {
        throw new Error(`Invalid URL provided for --code: ${input}`, { cause: e });
      }

      throw e;
    }
  } else {
    result = input;
  }

  return result;
}

// MARK: Setup
const authSetupCommand: CommandModule = {
  command: 'setup',
  describe: 'Generate OAuth authorization URL, exchange code, or set refresh token directly',
  builder: (yargs: Argv) =>
    yargs
      .option('client-id', { type: 'string', describe: 'OAuth client ID (from https://api-console.zoho.com/)' })
      .option('client-secret', { type: 'string', describe: 'OAuth client secret' })
      .option('redirect-uri', { type: 'string', default: DEFAULT_AUTH_SETUP_REDIRECT_URI, describe: 'Redirect URI (must match API console config)' })
      .option('region', { type: 'string', default: 'us', choices: ['us', 'eu', 'in', 'au', 'jp'] as const, describe: 'Zoho region' })
      .option('scopes', { type: 'string', defaultDescription: '--product when given, otherwise recruit,crm,desk', describe: 'Comma-separated products for OAuth scopes (recruit,crm,desk,sign,analytics)' })
      .option('code', { type: 'string', describe: 'Authorization code or the full redirect URL (code is extracted automatically)' })
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
        throw new Error('--client-id and --client-secret are required. Get them from https://api-console.zoho.com/');
      }

      if (ctx.token) {
        await handleAuthSetupToken(ctx, existingConfig);
      } else if (ctx.code) {
        await handleAuthSetupCode(ctx, existingConfig);
      } else {
        await handleAuthSetupStep1(ctx, existingConfig);
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
 * @param existingConfig - Config currently on disk, when any.
 * @returns The resolved {@link AuthSetupContext}.
 */
export function buildAuthSetupContext(argv: AuthSetupArgv, existingConfig: Maybe<ZohoCliConfig>): AuthSetupContext {
  const region = argv.region ?? existingConfig?.shared?.region ?? 'us';
  // When a product is targeted, prefer its own stored client credentials before falling back to shared.
  // Products with a dedicated OAuth client (e.g. sign) rely on this so their client is not sourced from shared.
  const product = argv.product;
  const productConfig = product ? existingConfig?.[product] : undefined;
  return {
    product,
    clientId: argv.clientId ?? productConfig?.clientId ?? existingConfig?.shared?.clientId,
    clientSecret: argv.clientSecret ?? productConfig?.clientSecret ?? existingConfig?.shared?.clientSecret,
    redirectUri: argv.redirectUri ?? DEFAULT_AUTH_SETUP_REDIRECT_URI,
    region,
    scopes: authSetupScopes(argv.scopes, product),
    code: parseCodeFromInput(argv.code),
    token: argv.token,
    accountsUrl: ZOHO_ACCOUNTS_URLS[region] ?? ZOHO_ACCOUNTS_URLS['us'],
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
}

/**
 * Builds the per-product block that a `--product`-targeted `auth setup` / `auth set` persists.
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
 * @returns The product config patch to hand to `mergeCliConfig`.
 */
export function authProductConfigUpdate({ product, credentials, apiMode, orgId }: AuthProductConfigUpdateInput): ZohoCliProductConfig {
  return { ...credentials, apiUrl: apiMode ?? undefined, orgId: ZOHO_CLI_ORG_ID_PRODUCTS.has(product) ? (orgId ?? undefined) : undefined };
}

async function mergeCredsConfig(ctx: AuthSetupContext, creds: ZohoCliCredentials, existingShared: ZohoCliCredentials | undefined): Promise<ZohoCliConfig> {
  if (ctx.product) {
    return mergeCliConfig({
      shared: existingShared ?? { clientId: '', clientSecret: '', refreshToken: '' },
      [ctx.product]: authProductConfigUpdate({ product: ctx.product, credentials: creds, apiMode: ctx.apiMode, orgId: ctx.orgId })
    });
  }
  return mergeCliConfig({
    shared: { ...creds, region: ctx.region, apiMode: ctx.apiMode },
    desk: ctx.orgId ? { orgId: ctx.orgId } : undefined
  });
}

async function handleAuthSetupToken(ctx: AuthSetupContext, existingConfig: Maybe<ZohoCliConfig>): Promise<void> {
  const creds: ZohoCliCredentials = { clientId: ctx.clientId as string, clientSecret: ctx.clientSecret as string, refreshToken: ctx.token as string };
  const merged = await mergeCredsConfig(ctx, creds, existingConfig?.shared);
  outputResult({
    success: true,
    ...(ctx.product ? { product: ctx.product } : {}),
    refreshToken: maskSecret(ctx.token as string),
    configSaved: true,
    configuredProducts: configuredProducts(merged)
  });
}

async function handleAuthSetupCode(ctx: AuthSetupContext, existingConfig: Maybe<ZohoCliConfig>): Promise<void> {
  const tokenUrl = `${ctx.accountsUrl}/oauth/v2/token`;
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: ctx.clientId as string,
    client_secret: ctx.clientSecret as string,
    redirect_uri: ctx.redirectUri,
    code: ctx.code as string
  });
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const body = await response.json();

  if (body.error) {
    throw new Error(`Token exchange failed: ${body.error}`);
  }
  const refreshToken = body.refresh_token;
  if (!refreshToken) {
    throw new Error('No refresh_token in response. The authorization code may have expired (valid for 2 minutes). Generate a new one.');
  }

  const creds: ZohoCliCredentials = { clientId: ctx.clientId as string, clientSecret: ctx.clientSecret as string, refreshToken };
  const merged = await mergeCredsConfig(ctx, creds, existingConfig?.shared);

  outputResult({
    step: 2,
    success: true,
    product: ctx.product ?? 'shared',
    refreshToken: maskSecret(refreshToken),
    accessToken: body.access_token ? maskSecret(body.access_token) : null,
    scope: body.scope,
    configSaved: true,
    configuredProducts: configuredProducts(merged)
  });
}

/**
 * Persists the credentials a step-1 (`auth setup` without `--code`/`--token`) run supplied.
 *
 * Split out from {@link handleAuthSetupStep1} so the persistence is testable without the printed
 * authorization URL; step 1 is the run that must both store `--org-id` and leave an already stored
 * one alone when the flag is omitted.
 *
 * @param ctx - Resolved setup context for the run.
 * @param existingConfig - Config currently on disk, when any.
 * @returns The merged config that was written.
 */
export async function saveAuthSetupStep1Config(ctx: AuthSetupContext, existingConfig: Maybe<ZohoCliConfig>): Promise<ZohoCliConfig> {
  let result: ZohoCliConfig;

  if (ctx.product) {
    // Store the client under the product (preserving the shared client) so a dedicated-client product
    // like sign does not clobber the shared recruit/crm/desk client. Region/apiMode stay on shared.
    result = await mergeCliConfig({
      shared: {
        clientId: existingConfig?.shared?.clientId ?? '',
        clientSecret: existingConfig?.shared?.clientSecret ?? '',
        refreshToken: existingConfig?.shared?.refreshToken ?? '',
        region: ctx.region,
        apiMode: ctx.apiMode ?? existingConfig?.shared?.apiMode
      },
      [ctx.product]: authProductConfigUpdate({
        product: ctx.product,
        credentials: { clientId: ctx.clientId as string, clientSecret: ctx.clientSecret as string },
        apiMode: ctx.apiMode,
        orgId: ctx.orgId
      })
    });
  } else {
    // A shared setup authorizes the shared client, and desk is the only org-scoped product that uses
    // it — the others in ZOHO_CLI_ORG_ID_PRODUCTS have a dedicated client and are set up with --product.
    result = await mergeCliConfig({
      shared: {
        clientId: ctx.clientId as string,
        clientSecret: ctx.clientSecret as string,
        refreshToken: existingConfig?.shared?.refreshToken ?? '',
        region: ctx.region,
        apiMode: ctx.apiMode ?? existingConfig?.shared?.apiMode
      },
      desk: ctx.orgId ? { orgId: ctx.orgId } : undefined
    });
  }

  return result;
}

async function handleAuthSetupStep1(ctx: AuthSetupContext, existingConfig: Maybe<ZohoCliConfig>): Promise<void> {
  // A product-targeted setup authorizes that product's own OAuth client, so the URL requests only
  // that product's scopes; the shared setup requests the combined scopes from --scopes.
  const scopeStrings = ctx.product ? (ZOHO_SCOPES[ctx.product] ?? []) : ctx.scopes.flatMap((p) => ZOHO_SCOPES[p] ?? []);
  if (scopeStrings.length === 0) {
    throw new Error(`No valid products specified. Choose from: ${Object.keys(ZOHO_SCOPES).join(', ')}`);
  }
  const authUrl = `${ctx.accountsUrl}/oauth/v2/auth?scope=${scopeStrings.join(',')}&client_id=${encodeURIComponent(ctx.clientId as string)}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(ctx.redirectUri)}`;

  await saveAuthSetupStep1Config(ctx, existingConfig);

  const productFlag = ctx.product ? `--product ${ctx.product} ` : '';

  outputResult({
    step: 1,
    product: ctx.product ?? 'shared',
    instructions: 'Open the authorization URL in a browser. Authorize the application. Copy the "code" parameter from the redirect URL.',
    authorizationUrl: authUrl,
    redirectUri: ctx.redirectUri,
    scopes: scopeStrings,
    credentialsSaved: true,
    nextStep: `zoho-cli auth setup ${productFlag}--code "PASTE_REDIRECT_URL_OR_AUTH_CODE"`
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
      .option('region', { type: 'string', default: 'us', describe: 'Zoho region (us, eu, in, au, jp)' })
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
          shared: (await loadCliConfig())?.shared ?? { clientId: '', clientSecret: '', refreshToken: '' },
          [product]: authProductConfigUpdate({ product, credentials: creds, apiMode: argv.apiMode, orgId: argv.orgId })
        });
      } else {
        merged = await mergeCliConfig({
          shared: { ...creds, region: argv.region, apiMode: argv.apiMode },
          desk: argv.orgId ? { orgId: argv.orgId } : undefined
        });
      }

      outputResult({ saved: true, product: product ?? 'shared', configuredProducts: configuredProducts(merged) });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

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
  return productConfig ? { ...maskCredentials(productConfig), apiUrl: productConfig.apiUrl, ...(ZOHO_CLI_ORG_ID_PRODUCTS.has(product) ? { orgId: productConfig.orgId } : {}) } : null;
}

/**
 * Builds the masked view of the stored config that `auth show` prints.
 *
 * Product blocks are derived from {@link ZOHO_CLI_PRODUCTS} rather than written out one by one: a
 * product missing from a hand-maintained literal is reported as absent no matter what is on disk,
 * which is exactly how a fully configured analytics install showed nothing here. `orgId` is
 * surfaced for {@link ZOHO_CLI_ORG_ID_PRODUCTS}, whose calls cannot work without it.
 *
 * @param config - Loaded CLI configuration.
 * @returns Result object with every secret masked, and `null` for each product with no stored block.
 */
export function buildAuthShowResult(config: ZohoCliConfig): Record<string, unknown> {
  const productResults = Object.fromEntries(ZOHO_CLI_PRODUCTS.map((product) => [product, maskProductConfig(product, config[product])]));

  return {
    configured: true,
    shared: {
      ...maskCredentials(config.shared),
      region: config.shared?.region ?? 'us',
      apiMode: config.shared?.apiMode ?? 'production'
    },
    ...productResults,
    configuredProducts: configuredProducts(config)
  };
}

const authShowCommand: CommandModule = {
  command: 'show',
  describe: 'Show current configuration (secrets masked)',
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    try {
      const config = await loadCliConfig();
      outputResult(config ? buildAuthShowResult(config) : { configured: false });
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
        const products = configuredProducts(config);

        if (products.length === 0) {
          outputResult({ authenticated: false, error: 'No products have complete credentials. Run: zoho-cli auth setup' });
        } else {
          // Try token exchange for each configured product
          const context = createCliContext(config);
          const productApis = toZohoCliProductApis(context);
          const results: Record<string, unknown> = {};

          for (const product of products) {
            try {
              const api = productApis[product];

              if (!api) {
                results[product] = { authenticated: false, error: 'Not configured' };
                continue;
              }

              // Exchange through the product's own accounts API so the reported scope is the grant
              // that product actually authenticates with. Only the scope and lifetime are echoed —
              // never the access token itself.
              const tokenResponse = await api.zohoAccountsApi.accessToken();
              results[product] = { authenticated: true, scope: tokenResponse.scope, expiresIn: tokenResponse.expires_in };
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              results[product] = { authenticated: false, error: message };
            }
          }

          outputResult({ products: results });
        }
      } else {
        outputResult({ authenticated: false, error: 'No credentials configured. Run: zoho-cli auth setup' });
      }
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
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
  builder: (yargs: Argv) => yargs.command(authSetupCommand).command(authSetCommand).command(authShowCommand).command(authCheckCommand).command(authClearCommand).demandCommand(1, 'Please specify an auth subcommand.'),
  handler: noop
};
