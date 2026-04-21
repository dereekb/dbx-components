import { type Maybe } from '@dereekb/util';
import { readFile, writeFile, rm, mkdirSync } from 'node:fs';
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

export function getConfigDir(): string {
  return join(homedir(), '.zoho-cli');
}

export function getConfigFilePath(): string {
  return join(getConfigDir(), 'config.json');
}

export function getTokenCachePath(): string {
  return join(getConfigDir(), '.tokens.json');
}

/**
 * Reads a config value from environment variables using the NestJS convention:
 * service-specific first (ZOHO_{SERVICE}_{KEY}), then shared fallback (ZOHO_{KEY}).
 */
function envVar(key: string, servicePrefix?: string): Maybe<string> {
  if (servicePrefix) {
    const serviceSpecific = process.env[`ZOHO_${servicePrefix}_${key}`];

    if (serviceSpecific) {
      return serviceSpecific;
    }
  }

  return process.env[`ZOHO_${key}`];
}

/**
 * Loads the full CLI config, merging file config with environment variable overrides.
 */
export async function loadCliConfig(): Promise<Maybe<ZohoCliConfig>> {
  const filePath = getConfigFilePath();
  const fileConfig = await readConfigFile<ZohoCliConfig>(filePath);

  // Check shared env vars
  const envClientId = envVar('ACCOUNTS_CLIENT_ID');
  const envClientSecret = envVar('ACCOUNTS_CLIENT_SECRET');
  const envRefreshToken = envVar('ACCOUNTS_REFRESH_TOKEN');
  const hasSharedEnvConfig = envClientId && envClientSecret && envRefreshToken;

  if (!fileConfig && !hasSharedEnvConfig) {
    return undefined;
  }

  const shared = {
    clientId: envClientId ?? fileConfig?.shared?.clientId ?? '',
    clientSecret: envClientSecret ?? fileConfig?.shared?.clientSecret ?? '',
    refreshToken: envRefreshToken ?? fileConfig?.shared?.refreshToken ?? '',
    region: envVar('ACCOUNTS_URL') ?? fileConfig?.shared?.region,
    apiMode: envVar('API_URL') ?? fileConfig?.shared?.apiMode
  };

  // Build per-product overrides from env vars
  function productConfigFromEnv(product: string): Maybe<ZohoCliProductConfig> {
    const prefix = product.toUpperCase();
    const clientId = envVar('ACCOUNTS_CLIENT_ID', prefix);
    const clientSecret = envVar('ACCOUNTS_CLIENT_SECRET', prefix);
    const refreshToken = envVar('ACCOUNTS_REFRESH_TOKEN', prefix);
    const apiUrl = envVar('API_URL', prefix);
    const orgId = product === 'desk' ? envVar('DESK_ORG_ID') : undefined;
    const fileProduct = fileConfig?.[product as ZohoCliProduct];

    // Only include env overrides that are actually service-specific (not the shared fallback)
    const envSpecificClientId = process.env[`ZOHO_${prefix}_ACCOUNTS_CLIENT_ID`];
    const envSpecificClientSecret = process.env[`ZOHO_${prefix}_ACCOUNTS_CLIENT_SECRET`];
    const envSpecificRefreshToken = process.env[`ZOHO_${prefix}_ACCOUNTS_REFRESH_TOKEN`];
    const hasEnvSpecific = envSpecificClientId || envSpecificClientSecret || envSpecificRefreshToken;

    if (!fileProduct && !hasEnvSpecific && !orgId) {
      return undefined;
    }

    return {
      clientId: envSpecificClientId ?? fileProduct?.clientId,
      clientSecret: envSpecificClientSecret ?? fileProduct?.clientSecret,
      refreshToken: envSpecificRefreshToken ?? fileProduct?.refreshToken,
      apiUrl: apiUrl ?? fileProduct?.apiUrl,
      orgId: orgId ?? fileProduct?.orgId
    };
  }

  const result: ZohoCliConfig = {
    shared,
    recruit: productConfigFromEnv('recruit') ?? fileConfig?.recruit,
    crm: productConfigFromEnv('crm') ?? fileConfig?.crm,
    desk: productConfigFromEnv('desk') ?? fileConfig?.desk
  };

  return result;
}

/**
 * Resolves credentials for a specific product.
 * Uses product-specific credentials if available, otherwise falls back to shared.
 */
export function resolveProductCredentials(config: ZohoCliConfig, product: ZohoCliProduct): Maybe<ZohoCliResolvedProductCredentials> {
  const productConfig = config[product];
  const shared = config.shared;

  const clientId = productConfig?.clientId ?? shared.clientId;
  const clientSecret = productConfig?.clientSecret ?? shared.clientSecret;
  const refreshToken = productConfig?.refreshToken ?? shared.refreshToken;

  if (!clientId || !clientSecret || !refreshToken) {
    return undefined;
  }

  return {
    clientId,
    clientSecret,
    refreshToken,
    region: shared.region ?? 'us',
    apiMode: productConfig?.apiUrl ?? shared.apiMode ?? 'production',
    orgId: productConfig?.orgId
  };
}

/**
 * Saves the full CLI config to disk.
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
 */
export async function mergeCliConfig(updates: Partial<ZohoCliConfig>): Promise<ZohoCliConfig> {
  const existing = await loadCliConfig();
  const merged: ZohoCliConfig = {
    shared: { ...existing?.shared, ...updates.shared } as ZohoCliConfig['shared'],
    recruit: updates.recruit !== undefined ? { ...existing?.recruit, ...updates.recruit } : existing?.recruit,
    crm: updates.crm !== undefined ? { ...existing?.crm, ...updates.crm } : existing?.crm,
    desk: updates.desk !== undefined ? { ...existing?.desk, ...updates.desk } : existing?.desk
  };

  await saveCliConfig(merged);
  return merged;
}

export async function clearCliConfig(): Promise<void> {
  const configPath = getConfigFilePath();
  const tokenPath = getTokenCachePath();
  await removeFile(configPath);
  await removeFile(tokenPath);
}

/**
 * Returns the list of products that have resolvable credentials.
 */
export function configuredProducts(config: ZohoCliConfig): ZohoCliProduct[] {
  return ZOHO_CLI_PRODUCTS.filter((p) => {
    const resolved = resolveProductCredentials(config, p);

    if (!resolved) {
      return false;
    }

    if (p === 'desk' && !resolved.orgId) {
      return false;
    }

    return true;
  });
}

function readConfigFile<T>(filePath: string): Promise<Maybe<T>> {
  return new Promise<Maybe<T>>((resolve) => {
    readFile(filePath, { encoding: 'utf-8' }, (err, data) => {
      if (err) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(undefined);
      }
    });
  });
}

function removeFile(filePath: string): Promise<void> {
  return new Promise<void>((resolve) => {
    rm(filePath, () => resolve());
  });
}

export function maskSecret(value: string): string {
  if (value.length <= 4) {
    return '***';
  }

  return value.substring(0, 4) + '***';
}
