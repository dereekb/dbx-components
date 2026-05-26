import type { CommandModule, Argv } from 'yargs';
import { loadCliConfig, getConfigFilePath, getTokenCachePath, configuredProducts } from '../config/cli.config';
import { createCliContext } from '../context/cli.context';
import { outputResult } from '../util/output';
import { access, constants } from 'node:fs';
import { dirname } from 'node:path';

interface DoctorCheck {
  readonly name: string;
  readonly status: 'pass' | 'warn' | 'fail';
  readonly message?: string;
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
      checks.push(checkConfiguredProducts(products), ...(await checkTokenExchanges(config, products)));
      const deskCheck = checkDeskOrgId(config, products);
      if (deskCheck) checks.push(deskCheck);
    }

    const allPassed = checks.every((c) => c.status === 'pass');
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

function checkConfiguredProducts(products: readonly string[]): DoctorCheck {
  if (products.length > 0) {
    return { name: 'products', status: 'pass', message: `Configured products: ${products.join(', ')}` };
  }
  return { name: 'products', status: 'fail', message: 'No products have complete credentials' };
}

async function checkTokenExchanges(config: NonNullable<Awaited<ReturnType<typeof loadCliConfig>>>, products: readonly string[]): Promise<DoctorCheck[]> {
  const context = createCliContext(config);
  const results: DoctorCheck[] = [];
  for (const product of products) {
    results.push(await checkTokenExchange(context, product));
  }
  return results;
}

async function checkTokenExchange(context: ReturnType<typeof createCliContext>, product: string): Promise<DoctorCheck> {
  const api = pickProductApi(context, product);
  if (!api) {
    return { name: `${product}-token`, status: 'warn', message: `${product}: API not configured` };
  }
  let result: DoctorCheck;
  try {
    const accountsApi = (api as any).zohoAccountsApi;
    const tokenResponse = await accountsApi.accessToken();
    result = { name: `${product}-token`, status: 'pass', message: `${product}: Token exchange successful. Scope: ${tokenResponse.scope}` };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    result = { name: `${product}-token`, status: 'fail', message: `${product}: Token exchange failed: ${message}` };
  }
  return result;
}

function pickProductApi(context: ReturnType<typeof createCliContext>, product: string): unknown {
  if (product === 'recruit') return context.recruitApi;
  if (product === 'crm') return context.crmApi;
  return context.deskApi;
}

function checkDeskOrgId(config: NonNullable<Awaited<ReturnType<typeof loadCliConfig>>>, products: readonly string[]): DoctorCheck | undefined {
  if (config.desk?.orgId) {
    return { name: 'desk-org-id', status: 'pass', message: `Desk org ID configured: ${config.desk.orgId}` };
  }
  if (!products.includes('desk')) {
    return { name: 'desk-org-id', status: 'warn', message: 'No Desk org ID. Desk commands unavailable.' };
  }
  return undefined;
}

function checkWritable(dirPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    access(dirPath, constants.W_OK, (err) => {
      resolve(!err);
    });
  });
}
