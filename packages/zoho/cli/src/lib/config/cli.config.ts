import { type Maybe } from '@dereekb/util';
import { type CliCommandOutputConfig, type CliOutputConfig, mergeOutputConfig as dbxMergeOutputConfig } from '@dereekb/dbx-cli';
import { readJsonFile, removeFile } from '@dereekb/nestjs';
import { writeFile, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export type ZohoCliProduct = 'recruit' | 'crm' | 'desk';

export const ZOHO_CLI_PRODUCTS: ZohoCliProduct[] = ['recruit', 'crm', 'desk'];

/**
 * Credentials for a single OAuth client.
 */
export interface ZohoCliCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
}

/**
 * Per-product configuration.
 */
export interface ZohoCliProductConfig extends Partial<ZohoCliCredentials> {
  readonly apiUrl?: string;
  readonly orgId?: string;
}

/**
 * Per-command output settings (alias of dbx-cli's {@link CliCommandOutputConfig}).
 */
export type ZohoCliCommandOutputConfig = CliCommandOutputConfig;

/**
 * Output configuration with global defaults and optional per-command overrides
 * (alias of dbx-cli's {@link CliOutputConfig}).
 */
export type ZohoCliOutputConfig = CliOutputConfig;

/**
 * Full CLI config file structure.
 *
 * Shared credentials are used as fallback when a product doesn't have its own.
 * Per-product overrides live under `recruit`, `crm`, `desk`.
 */
export interface ZohoCliConfig {
  readonly shared: ZohoCliCredentials & {
    readonly region?: string;
    readonly apiMode?: string;
  };
  readonly recruit?: ZohoCliProductConfig;
  readonly crm?: ZohoCliProductConfig;
  readonly desk?: ZohoCliProductConfig;
  readonly output?: ZohoCliOutputConfig;
}

/**
 * Resolved credentials for a single product — guaranteed to have all required fields.
 */
export interface ZohoCliResolvedProductCredentials extends ZohoCliCredentials {
  readonly region: string;
  readonly apiMode: string;
  readonly apiUrl?: string;
  readonly orgId?: string;
}

/**
 * Returns the absolute path to the per-user zoho-cli config directory under the user's home.
 *
 * @returns Absolute filesystem path of the `~/.zoho-cli` directory.
 */
export function getConfigDir(): string {
  return join(homedir(), '.zoho-cli');
}

/**
 * Returns the absolute path to the persisted CLI config JSON file.
 *
 * @returns Absolute filesystem path of `~/.zoho-cli/config.json`.
 */
export function getConfigFilePath(): string {
  return join(getConfigDir(), 'config.json');
}

/**
 * Returns the absolute path to the on-disk OAuth access-token cache used by the CLI.
 *
 * @returns Absolute filesystem path of `~/.zoho-cli/.tokens.json`.
 */
export function getTokenCachePath(): string {
  return join(getConfigDir(), '.tokens.json');
}

/**
 * Reads a config value from environment variables using the NestJS convention:
 * service-specific first (ZOHO_{SERVICE}_{KEY}), then shared fallback (ZOHO_{KEY}).
 *
 * @param key - Suffix portion of the env var name following the `ZOHO_` (or `ZOHO_{SERVICE}_`) prefix.
 * @param servicePrefix - Optional uppercased product prefix (e.g. `RECRUIT`, `CRM`, `DESK`); when provided, the service-specific variable is checked before the shared one.
 * @returns The first matching env var value, or `undefined` when neither is set.
 */
function envVar(key: string, servicePrefix?: string): Maybe<string> {
  const serviceSpecific = servicePrefix ? process.env[`ZOHO_${servicePrefix}_${key}`] : undefined;
  const result: Maybe<string> = serviceSpecific ?? process.env[`ZOHO_${key}`];
  return result;
}

/**
 * Loads the full CLI config, merging file config with environment variable overrides.
 *
 * @returns The merged {@link ZohoCliConfig}, or `undefined` when no config file exists and no shared OAuth env vars are present.
 */
export async function loadCliConfig(): Promise<Maybe<ZohoCliConfig>> {
  const filePath = getConfigFilePath();
  const fileConfig = await readJsonFile<ZohoCliConfig>(filePath);

  // Check shared env vars
  const envClientId = envVar('ACCOUNTS_CLIENT_ID');
  const envClientSecret = envVar('ACCOUNTS_CLIENT_SECRET');
  const envRefreshToken = envVar('ACCOUNTS_REFRESH_TOKEN');
  const hasSharedEnvConfig = envClientId && envClientSecret && envRefreshToken;
  let result: Maybe<ZohoCliConfig>;

  if (!fileConfig && !hasSharedEnvConfig) {
    result = undefined;
  } else {
    const shared = {
      clientId: envClientId ?? fileConfig?.shared?.clientId ?? '',
      clientSecret: envClientSecret ?? fileConfig?.shared?.clientSecret ?? '',
      refreshToken: envRefreshToken ?? fileConfig?.shared?.refreshToken ?? '',
      region: envVar('ACCOUNTS_URL') ?? fileConfig?.shared?.region,
      apiMode: envVar('API_URL') ?? fileConfig?.shared?.apiMode
    };

    // Build per-product overrides from env vars
    const productConfigFromEnv = (product: string): Maybe<ZohoCliProductConfig> => {
      const prefix = product.toUpperCase();
      const apiUrl = envVar('API_URL', prefix);
      const orgId = product === 'desk' ? envVar('DESK_ORG_ID') : undefined;
      const fileProduct = fileConfig?.[product as ZohoCliProduct];

      // Only include env overrides that are actually service-specific (not the shared fallback)
      const envSpecificClientId = process.env[`ZOHO_${prefix}_ACCOUNTS_CLIENT_ID`];
      const envSpecificClientSecret = process.env[`ZOHO_${prefix}_ACCOUNTS_CLIENT_SECRET`];
      const envSpecificRefreshToken = process.env[`ZOHO_${prefix}_ACCOUNTS_REFRESH_TOKEN`];
      const hasEnvSpecific = envSpecificClientId || envSpecificClientSecret || envSpecificRefreshToken;

      let productResult: Maybe<ZohoCliProductConfig>;

      if (!fileProduct && !hasEnvSpecific && !orgId) {
        productResult = undefined;
      } else {
        productResult = {
          clientId: envSpecificClientId ?? fileProduct?.clientId,
          clientSecret: envSpecificClientSecret ?? fileProduct?.clientSecret,
          refreshToken: envSpecificRefreshToken ?? fileProduct?.refreshToken,
          apiUrl: apiUrl ?? fileProduct?.apiUrl,
          orgId: orgId ?? fileProduct?.orgId
        };
      }

      return productResult;
    };

    result = {
      shared,
      recruit: productConfigFromEnv('recruit') ?? fileConfig?.recruit,
      crm: productConfigFromEnv('crm') ?? fileConfig?.crm,
      desk: productConfigFromEnv('desk') ?? fileConfig?.desk,
      output: fileConfig?.output
    };
  }

  return result;
}

/**
 * Resolves credentials for a specific product.
 * Uses product-specific credentials if available, otherwise falls back to shared.
 *
 * @param config - Loaded CLI configuration containing the shared block and any per-product overrides.
 * @param product - Target Zoho product whose credentials should be resolved.
 * @returns Fully populated {@link ZohoCliResolvedProductCredentials}, or `undefined` if any of `clientId`, `clientSecret`, or `refreshToken` cannot be sourced from product or shared config.
 */
export function resolveProductCredentials(config: ZohoCliConfig, product: ZohoCliProduct): Maybe<ZohoCliResolvedProductCredentials> {
  const productConfig = config[product];
  const shared = config.shared;

  const clientId = productConfig?.clientId ?? shared.clientId;
  const clientSecret = productConfig?.clientSecret ?? shared.clientSecret;
  const refreshToken = productConfig?.refreshToken ?? shared.refreshToken;

  let result: Maybe<ZohoCliResolvedProductCredentials>;

  if (!clientId || !clientSecret || !refreshToken) {
    result = undefined;
  } else {
    result = {
      clientId,
      clientSecret,
      refreshToken,
      region: shared.region ?? 'us',
      apiMode: productConfig?.apiUrl ?? shared.apiMode ?? 'production',
      orgId: productConfig?.orgId
    };
  }

  return result;
}

/**
 * Saves the full CLI config to disk.
 *
 * Creates the config directory recursively if missing, then writes the JSON-serialized config to {@link getConfigFilePath}.
 *
 * @param config - Complete config object to persist; written verbatim with 2-space indentation.
 */
export async function saveCliConfig(config: ZohoCliConfig): Promise<void> {
  const filePath = getConfigFilePath();
  mkdirSync(getConfigDir(), { recursive: true });

  return new Promise<void>((resolve, reject) => {
    writeFile(filePath, JSON.stringify(config, null, 2), {}, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Merges new values into the existing config, preserving unmodified fields.
 *
 * Per-product blocks (`recruit`, `crm`, `desk`) are shallow-merged when provided; output config is deep-merged via dbx-cli's {@link dbxMergeOutputConfig} so explicit `undefined` keys in `updates.output` clear existing values.
 *
 * @param updates - Partial config patch; only keys present in this object are touched.
 * @returns The fully merged config that was written to disk.
 */
export async function mergeCliConfig(updates: Partial<ZohoCliConfig>): Promise<ZohoCliConfig> {
  const existing = await loadCliConfig();
  const merged: ZohoCliConfig = {
    shared: { ...existing?.shared, ...updates.shared } as ZohoCliConfig['shared'],
    recruit: updates.recruit === undefined ? existing?.recruit : { ...existing?.recruit, ...updates.recruit },
    crm: updates.crm === undefined ? existing?.crm : { ...existing?.crm, ...updates.crm },
    desk: updates.desk === undefined ? existing?.desk : { ...existing?.desk, ...updates.desk },
    output: updates.output === undefined ? existing?.output : dbxMergeOutputConfig(existing?.output, updates.output)
  };

  await saveCliConfig(merged);
  return merged;
}

/**
 * Re-export of dbx-cli's `resolveOutputConfig` so existing zoho-cli consumers keep the same
 * module surface. New code can import from `@dereekb/dbx-cli` directly.
 */
export { resolveOutputConfig } from '@dereekb/dbx-cli';

/**
 * Clears all output config (dumpDir, pick, per-command overrides).
 *
 * Uses explicit `undefined` values so {@link dbxMergeOutputConfig} detects the keys
 * via `'key' in updates` and overwrites rather than falling back to existing values.
 * `JSON.stringify` then strips the undefined properties from the saved config file.
 */
export async function clearOutputConfig(): Promise<void> {
  await mergeCliConfig({ output: { dumpDir: undefined, pick: undefined, commands: undefined } });
}

/**
 * Removes both the persisted CLI config file and the on-disk OAuth token cache.
 *
 * Used by `auth clear` to fully reset CLI authentication state on the local machine.
 */
export async function clearCliConfig(): Promise<void> {
  const configPath = getConfigFilePath();
  const tokenPath = getTokenCachePath();
  await removeFile(configPath);
  await removeFile(tokenPath);
}

/**
 * Returns the list of products that have resolvable credentials.
 *
 * A product is considered configured when {@link resolveProductCredentials} returns a value; Desk additionally requires `orgId` to be present.
 *
 * @param config - Loaded CLI configuration to inspect.
 * @returns Subset of {@link ZOHO_CLI_PRODUCTS} for which the CLI can construct an authenticated API client.
 */
export function configuredProducts(config: ZohoCliConfig): ZohoCliProduct[] {
  return ZOHO_CLI_PRODUCTS.filter((p) => {
    const resolved = resolveProductCredentials(config, p);
    const valid = resolved != null && (p !== 'desk' || resolved.orgId != null);
    return valid;
  });
}

/**
 * Re-export of dbx-cli's secret-masking helper. Auth/show commands import via this module so the
 * masking pattern stays consistent across CLIs.
 */
export { maskSecret } from '@dereekb/dbx-cli';
