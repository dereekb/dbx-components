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
let _currentCliContext: ZohoCliContext | undefined;

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

      _currentCliContext = createCliContext(config);
    } catch (e) {
      outputError(e);
      process.exit(4);
    }
  };
}

export function getCliContext(_argv?: any): ZohoCliContext {
  if (!_currentCliContext) {
    throw new Error('CLI context not initialized. This is a bug.');
  }

  return _currentCliContext;
}

export function getRecruitApi(argv: any): ZohoRecruitApi {
  const { recruitApi } = getCliContext(argv);

  if (!recruitApi) {
    throw new Error('Recruit not configured. Run: zoho-cli auth setup --client-id X --client-secret Y --token Z');
  }

  return recruitApi;
}

export function getCrmApi(argv: any): ZohoCrmApi {
  const { crmApi } = getCliContext(argv);

  if (!crmApi) {
    throw new Error('CRM not configured. Run: zoho-cli auth setup --product crm --client-id X --client-secret Y --token Z');
  }

  return crmApi;
}

export function getDeskApi(argv: any): ZohoDeskApi {
  const { deskApi } = getCliContext(argv);

  if (!deskApi) {
    throw new Error('Desk not configured. Run: zoho-cli auth setup --product desk --client-id X --client-secret Y --token Z --org-id YOUR_ORG_ID');
  }

  return deskApi;
}
