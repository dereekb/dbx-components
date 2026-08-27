import type { CommandModule, Argv } from 'yargs';
import type { Maybe } from '@dereekb/util';
import { loadCliConfig, getConfigFilePath, getTokenCachePath, configuredProducts, ZOHO_CLI_ORG_ID_PRODUCTS, type ZohoCliConfig, type ZohoCliProduct } from '../config/cli.config';
import { createCliContext, toZohoCliProductApis, type ZohoCliProductApi, type ZohoCliProductApis } from '../context/cli.context';
import { outputResult } from '../util/output';
import { access, constants } from 'node:fs';
import { dirname } from 'node:path';

export interface DoctorCheck {
  readonly name: string;
  readonly status: 'pass' | 'warn' | 'fail';
  readonly message?: string;
}

/**
 * Whether a `doctor` run reports the install as healthy.
 *
 * @param checks - Every check the run produced.
 * @returns `true` only when every check passed — a `warn` is not healthy, it is merely not fatal.
 */
export function doctorChecksHealthy(checks: readonly DoctorCheck[]): boolean {
  return checks.every((c) => c.status === 'pass');
}

export const DOCTOR_COMMAND: CommandModule = {
  command: 'doctor',
  describe: 'Check CLI configuration and connectivity',
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    const config = await loadCliConfig();
    const checks: DoctorCheck[] = [];

    checks.push(checkConfigLoaded(config));
    const sharedCheck = checkSharedCredentials(config);
    if (sharedCheck) checks.push(sharedCheck);
    checks.push(await checkTokenCacheDir());

    if (config) {
      const products = configuredProducts(config);
      checks.push(checkConfiguredProducts(products), ...(await checkTokenExchanges(config, products)), ...checkOrgIdProducts(config, products));
    }

    const allPassed = doctorChecksHealthy(checks);
    outputResult({ checks, healthy: allPassed });

    if (!allPassed) {
      process.exit(checks.some((c) => c.status === 'fail') ? 1 : 0);
    }
  }
};

function checkConfigLoaded(config: Awaited<ReturnType<typeof loadCliConfig>>): DoctorCheck {
  if (config) {
    return { name: 'config', status: 'pass', message: `Config loaded from ${getConfigFilePath()}` };
  }
  return { name: 'config', status: 'fail', message: 'No config found. Run: zoho-cli auth setup' };
}

function checkSharedCredentials(config: Awaited<ReturnType<typeof loadCliConfig>>): DoctorCheck | undefined {
  if (config?.shared?.clientId && config?.shared?.clientSecret && config?.shared?.refreshToken) {
    return { name: 'shared-credentials', status: 'pass', message: 'Shared credentials present' };
  }
  if (config) {
    return { name: 'shared-credentials', status: 'warn', message: 'Missing shared credentials. Per-product credentials may still work.' };
  }
  return undefined;
}

async function checkTokenCacheDir(): Promise<DoctorCheck> {
  const cacheDir = dirname(getTokenCachePath());
  const writable = await checkWritable(cacheDir);
  if (writable) {
    return { name: 'token-cache', status: 'pass', message: `Token cache directory writable: ${cacheDir}` };
  }
  return { name: 'token-cache', status: 'warn', message: `Token cache directory not writable: ${cacheDir}` };
}

function checkConfiguredProducts(products: readonly ZohoCliProduct[]): DoctorCheck {
  if (products.length > 0) {
    return { name: 'products', status: 'pass', message: `Configured products: ${products.join(', ')}` };
  }
  return { name: 'products', status: 'fail', message: 'No products have complete credentials' };
}

async function checkTokenExchanges(config: NonNullable<Awaited<ReturnType<typeof loadCliConfig>>>, products: readonly ZohoCliProduct[]): Promise<DoctorCheck[]> {
  const productApis: ZohoCliProductApis = toZohoCliProductApis(createCliContext(config));
  const results: DoctorCheck[] = [];
  for (const product of products) {
    results.push(await checkTokenExchange(productApis[product], product));
  }
  return results;
}

async function checkTokenExchange(api: Maybe<ZohoCliProductApi>, product: ZohoCliProduct): Promise<DoctorCheck> {
  if (!api) {
    return { name: `${product}-token`, status: 'warn', message: `${product}: API not configured` };
  }
  let result: DoctorCheck;
  try {
    // the product's own accounts API, so the reported scope is the grant it authenticates with
    const tokenResponse = await api.zohoAccountsApi.accessToken();
    result = { name: `${product}-token`, status: 'pass', message: `${product}: Token exchange successful. Scope: ${tokenResponse.scope}` };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    result = { name: `${product}-token`, status: 'fail', message: `${product}: Token exchange failed: ${message}` };
  }
  return result;
}

/**
 * Org-id check for every product scoped by one ({@link ZOHO_CLI_ORG_ID_PRODUCTS}).
 *
 * Generalized over the set rather than written per product so a future org-scoped product is covered
 * the moment it joins: an analytics install with no org id used to report `healthy: true` while every
 * analytics command but `orgs list` failed, because only desk had a check.
 *
 * A product the CLI already reports as configured but that has no org id FAILS — its org-scoped calls
 * cannot work, and nothing else in the run says so. A product with no org id that is not configured
 * only warns: desk is dropped from {@link configuredProducts} without one, so this is the "desk is
 * simply not set up" case rather than a broken install.
 *
 * @param config - Loaded CLI configuration.
 * @param products - Products {@link configuredProducts} reports as usable.
 * @returns One check per org-scoped product.
 */
export function checkOrgIdProducts(config: ZohoCliConfig, products: readonly ZohoCliProduct[]): DoctorCheck[] {
  return Array.from(ZOHO_CLI_ORG_ID_PRODUCTS).map((product) => {
    const orgId = config[product]?.orgId;
    const name = `${product}-org-id`;
    let result: DoctorCheck;

    if (orgId) {
      result = { name, status: 'pass', message: `${product}: Org ID configured: ${orgId}` };
    } else if (products.includes(product)) {
      result = { name, status: 'fail', message: `${product}: No org ID configured, but ${product} is reported as configured — every org-scoped ${product} command will fail. Run: zoho-cli auth set --product ${product} --org-id <ORG_ID>` };
    } else {
      result = { name, status: 'warn', message: `${product}: No org ID. ${product} commands unavailable.` };
    }

    return result;
  });
}

function checkWritable(dirPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    access(dirPath, constants.W_OK, (err) => {
      resolve(!err);
    });
  });
}
