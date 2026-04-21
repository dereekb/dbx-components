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

export const doctorCommand: CommandModule = {
  command: 'doctor',
  describe: 'Check CLI configuration and connectivity',
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    const checks: DoctorCheck[] = [];

    // Check 1: Config file exists
    const config = await loadCliConfig();

    if (config) {
      checks.push({ name: 'config', status: 'pass', message: `Config loaded from ${getConfigFilePath()}` });
    } else {
      checks.push({ name: 'config', status: 'fail', message: 'No config found. Run: zoho-cli auth setup' });
    }

    // Check 2: Shared credentials present
    if (config?.shared?.clientId && config?.shared?.clientSecret && config?.shared?.refreshToken) {
      checks.push({ name: 'shared-credentials', status: 'pass', message: 'Shared credentials present' });
    } else if (config) {
      checks.push({ name: 'shared-credentials', status: 'warn', message: 'Missing shared credentials. Per-product credentials may still work.' });
    }

    // Check 3: Token cache directory writable
    const cacheDir = dirname(getTokenCachePath());
    const cacheDirWritable = await checkWritable(cacheDir);

    if (cacheDirWritable) {
      checks.push({ name: 'token-cache', status: 'pass', message: `Token cache directory writable: ${cacheDir}` });
    } else {
      checks.push({ name: 'token-cache', status: 'warn', message: `Token cache directory not writable: ${cacheDir}` });
    }

    // Check 4: Configured products
    if (config) {
      const products = configuredProducts(config);

      if (products.length > 0) {
        checks.push({ name: 'products', status: 'pass', message: `Configured products: ${products.join(', ')}` });
      } else {
        checks.push({ name: 'products', status: 'fail', message: 'No products have complete credentials' });
      }

      // Check 5: Token exchange for each configured product
      const context = createCliContext(config);

      for (const product of products) {
        try {
          const api = product === 'recruit' ? context.recruitApi : product === 'crm' ? context.crmApi : context.deskApi;

          if (api) {
            const accountsApi = (api as any).zohoAccountsApi;
            const tokenResponse = await accountsApi.accessToken();
            checks.push({ name: `${product}-token`, status: 'pass', message: `${product}: Token exchange successful. Scope: ${tokenResponse.scope}` });
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          checks.push({ name: `${product}-token`, status: 'fail', message: `${product}: Token exchange failed: ${message}` });
        }
      }

      // Check 6: Desk orgId
      if (config.desk?.orgId) {
        checks.push({ name: 'desk-org-id', status: 'pass', message: `Desk org ID configured: ${config.desk.orgId}` });
      } else if (!products.includes('desk')) {
        checks.push({ name: 'desk-org-id', status: 'warn', message: 'No Desk org ID. Desk commands unavailable.' });
      }
    }

    const allPassed = checks.every((c) => c.status === 'pass');
    outputResult({ checks, healthy: allPassed });

    if (!allPassed) {
      process.exit(checks.some((c) => c.status === 'fail') ? 1 : 0);
    }
  }
};

function checkWritable(dirPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    access(dirPath, constants.W_OK, (err) => {
      resolve(!err);
    });
  });
}
