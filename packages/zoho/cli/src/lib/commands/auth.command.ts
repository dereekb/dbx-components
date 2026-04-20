import type { CommandModule, Argv } from 'yargs';
import { loadCliConfig, mergeCliConfig, clearCliConfig, maskSecret, configuredProducts, ZOHO_CLI_PRODUCTS, type ZohoCliConfig, type ZohoCliProduct, type ZohoCliCredentials, type ZohoCliProductConfig } from '../config/cli.config';
import { noop } from '../util/noop';
import { createCliContext } from '../context/cli.context';
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
  desk: ['Desk.tickets.ALL', 'Desk.contacts.READ', 'Desk.contacts.WRITE', 'Desk.basic.READ', 'Desk.settings.READ', 'Desk.search.READ'],
  sign: ['ZohoSign.documents.ALL', 'ZohoSign.templates.ALL']
};

// MARK: Setup
const authSetupCommand: CommandModule = {
  command: 'setup',
  describe: 'Generate OAuth authorization URL, exchange code, or set refresh token directly',
  builder: (yargs: Argv) =>
    yargs
      .option('client-id', { type: 'string', describe: 'OAuth client ID (from https://api-console.zoho.com/)' })
      .option('client-secret', { type: 'string', describe: 'OAuth client secret' })
      .option('redirect-uri', { type: 'string', default: 'http://localhost/oauth', describe: 'Redirect URI (must match API console config)' })
      .option('region', { type: 'string', default: 'us', choices: ['us', 'eu', 'in', 'au', 'jp'] as const, describe: 'Zoho region' })
      .option('scopes', { type: 'string', default: 'recruit,crm', describe: 'Comma-separated products for OAuth scopes (recruit,crm,desk,sign)' })
      .option('code', { type: 'string', describe: 'Authorization code from the redirect URL' })
      .option('token', { type: 'string', describe: 'Set a refresh token directly (skips OAuth code exchange)' })
      .option('product', { type: 'string', choices: [...ZOHO_CLI_PRODUCTS] as const, describe: 'Store credentials for a specific product instead of shared' })
      .option('org-id', { type: 'string', describe: 'Zoho Desk organization ID' })
      .option('api-mode', { type: 'string', default: 'production', choices: ['production', 'sandbox'] as const, describe: 'API mode' })
      .example([
        ['$0 auth setup --client-id 1000.ABC --client-secret xyz', 'Step 1: Get OAuth URL (saves shared credentials)'],
        ['$0 auth setup --code 1000.AUTH.CODE', 'Step 2: Exchange code for refresh token'],
        ['$0 auth setup --client-id 1000.ABC --client-secret xyz --token 1000.REFRESH.TOKEN', 'Set shared refresh token directly'],
        ['$0 auth setup --product crm --client-id 1000.CRM --client-secret xyz --token 1000.CRM.TOKEN', 'Set CRM-specific credentials']
      ]),
  handler: async (argv: any) => {
    try {
      const existingConfig = await loadCliConfig();
      const product = argv.product as ZohoCliProduct | undefined;
      const clientId = (argv.clientId as string | undefined) ?? existingConfig?.shared?.clientId;
      const clientSecret = (argv.clientSecret as string | undefined) ?? existingConfig?.shared?.clientSecret;
      const redirectUri = argv.redirectUri as string;
      const region = (argv.region as string | undefined) ?? existingConfig?.shared?.region ?? 'us';
      const scopes = (argv.scopes as string).split(',').map((p: string) => p.trim());
      const code = argv.code as string | undefined;
      const token = argv.token as string | undefined;
      const accountsUrl = ZOHO_ACCOUNTS_URLS[region] ?? ZOHO_ACCOUNTS_URLS['us'];

      if (!clientId || !clientSecret) {
        throw new Error('--client-id and --client-secret are required. Get them from https://api-console.zoho.com/');
      }

      if (token) {
        // Direct token set
        const creds: ZohoCliCredentials = { clientId, clientSecret, refreshToken: token };

        if (product) {
          // Per-product credentials
          const productUpdate: ZohoCliProductConfig = {
            ...creds,
            apiUrl: argv.apiMode,
            orgId: product === 'desk' ? argv.orgId : undefined
          };

          const merged = await mergeCliConfig({
            shared: existingConfig?.shared ?? { clientId: '', clientSecret: '', refreshToken: '' },
            [product]: productUpdate
          });

          outputResult({
            success: true,
            product,
            refreshToken: maskSecret(token),
            configSaved: true,
            configuredProducts: configuredProducts(merged)
          });
        } else {
          // Shared credentials
          const merged = await mergeCliConfig({
            shared: { ...creds, region, apiMode: argv.apiMode },
            desk: argv.orgId ? { orgId: argv.orgId } : undefined
          });

          outputResult({
            success: true,
            refreshToken: maskSecret(token),
            configSaved: true,
            configuredProducts: configuredProducts(merged)
          });
        }
      } else if (!code) {
        // Step 1: Generate authorization URL and save client credentials
        const scopeStrings = scopes.flatMap((p) => ZOHO_SCOPES[p] ?? []);

        if (scopeStrings.length === 0) {
          throw new Error(`No valid products specified. Choose from: ${Object.keys(ZOHO_SCOPES).join(', ')}`);
        }

        const authUrl = `${accountsUrl}/oauth/v2/auth?scope=${scopeStrings.join(',')}&client_id=${encodeURIComponent(clientId)}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(redirectUri)}`;

        // Save client credentials
        await mergeCliConfig({
          shared: {
            clientId,
            clientSecret,
            refreshToken: existingConfig?.shared?.refreshToken ?? '',
            region,
            apiMode: argv.apiMode ?? existingConfig?.shared?.apiMode
          },
          desk: argv.orgId ? { orgId: argv.orgId } : undefined
        });

        outputResult({
          step: 1,
          instructions: 'Open the authorization URL in a browser. Authorize the application. Copy the "code" parameter from the redirect URL.',
          authorizationUrl: authUrl,
          redirectUri,
          scopes: scopeStrings,
          credentialsSaved: true,
          nextStep: 'zoho-cli auth setup --code YOUR_AUTH_CODE'
        });
      } else {
        // Step 2: Exchange code for refresh token
        const tokenUrl = `${accountsUrl}/oauth/v2/token`;
        const params = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code
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

        const creds: ZohoCliCredentials = { clientId, clientSecret, refreshToken };
        let merged: ZohoCliConfig;

        if (product) {
          merged = await mergeCliConfig({
            shared: existingConfig?.shared ?? { clientId: '', clientSecret: '', refreshToken: '' },
            [product]: { ...creds, apiUrl: argv.apiMode, orgId: product === 'desk' ? argv.orgId : undefined }
          });
        } else {
          merged = await mergeCliConfig({
            shared: { ...creds, region, apiMode: argv.apiMode },
            desk: argv.orgId ? { orgId: argv.orgId } : undefined
          });
        }

        outputResult({
          step: 2,
          success: true,
          product: product ?? 'shared',
          refreshToken: maskSecret(refreshToken),
          accessToken: body.access_token ? maskSecret(body.access_token) : null,
          scope: body.scope,
          configSaved: true,
          configuredProducts: configuredProducts(merged)
        });
      }
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

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
      .option('org-id', { type: 'string', describe: 'Zoho Desk organization ID' })
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
          [product]: { ...creds, apiUrl: argv.apiMode, orgId: product === 'desk' ? argv.orgId : undefined }
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
const authShowCommand: CommandModule = {
  command: 'show',
  describe: 'Show current configuration (secrets masked)',
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    try {
      const config = await loadCliConfig();

      if (!config) {
        outputResult({ configured: false });
        return;
      }

      function maskCreds(creds: Partial<ZohoCliCredentials> | undefined) {
        if (!creds) {
          return undefined;
        }

        return {
          clientId: creds.clientId ? maskSecret(creds.clientId) : undefined,
          clientSecret: creds.clientSecret ? maskSecret(creds.clientSecret) : undefined,
          refreshToken: creds.refreshToken ? maskSecret(creds.refreshToken) : undefined
        };
      }

      outputResult({
        configured: true,
        shared: {
          ...maskCreds(config.shared),
          region: config.shared?.region ?? 'us',
          apiMode: config.shared?.apiMode ?? 'production'
        },
        recruit: config.recruit ? { ...maskCreds(config.recruit), apiUrl: config.recruit.apiUrl } : null,
        crm: config.crm ? { ...maskCreds(config.crm), apiUrl: config.crm.apiUrl } : null,
        desk: config.desk ? { ...maskCreds(config.desk), apiUrl: config.desk.apiUrl, orgId: config.desk.orgId } : null,
        configuredProducts: configuredProducts(config)
      });
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

      if (!config) {
        outputResult({ authenticated: false, error: 'No credentials configured. Run: zoho-cli auth setup' });
        return;
      }

      const products = configuredProducts(config);

      if (products.length === 0) {
        outputResult({ authenticated: false, error: 'No products have complete credentials. Run: zoho-cli auth setup' });
        return;
      }

      // Try token exchange for each configured product
      const context = createCliContext(config);
      const results: Record<string, unknown> = {};

      for (const product of products) {
        try {
          const api = product === 'recruit' ? context.recruitApi : product === 'crm' ? context.crmApi : context.deskApi;

          if (!api) {
            results[product] = { authenticated: false, error: 'Not configured' };
            continue;
          }

          // Access the underlying accounts API to verify token exchange
          const accountsApi = (api as any).zohoAccountsApi;
          const tokenResponse = await accountsApi.accessToken();
          results[product] = { authenticated: true, scope: tokenResponse.scope, expiresIn: tokenResponse.expires_in };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          results[product] = { authenticated: false, error: message };
        }
      }

      outputResult({ products: results });
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
export const authCommand: CommandModule = {
  command: 'auth',
  describe: 'Manage Zoho API credentials',
  builder: (yargs: Argv) => yargs.command(authSetupCommand).command(authSetCommand).command(authShowCommand).command(authCheckCommand).command(authClearCommand).demandCommand(1, 'Please specify an auth subcommand.'),
  handler: noop
};
