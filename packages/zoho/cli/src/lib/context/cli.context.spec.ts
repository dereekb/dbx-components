import { describe, expect, it } from 'vitest';
import { createCliContext } from './cli.context';
import { ZOHO_CLI_PRODUCTS, type ZohoCliConfig, type ZohoCliProduct } from '../config/cli.config';

/**
 * A config where every product authenticates with its own, distinct OAuth client, so a product mapped to
 * another product's accounts client is visible as the wrong client id.
 *
 * @returns The config.
 */
function distinctCredentialsConfig(): ZohoCliConfig {
  const creds = (product: ZohoCliProduct) => ({ clientId: `${product}-id`, clientSecret: `${product}-secret`, refreshToken: `${product}-token` });

  return {
    shared: { clientId: '', clientSecret: '', refreshToken: '' },
    recruit: creds('recruit'),
    crm: creds('crm'),
    desk: { ...creds('desk'), orgId: 'desk-org' },
    sign: creds('sign'),
    analytics: { ...creds('analytics'), orgId: 'analytics-org' }
  };
}

describe('createCliContext()', () => {
  describe('productAccounts', () => {
    // analytics used to fall through to the desk branch, so `auth check` / `doctor` reported Desk's
    // granted scope under the analytics key while the analytics credentials were never exercised
    it("should map every product to its own grant's accounts client", () => {
      const { productAccounts } = createCliContext(distinctCredentialsConfig());

      ZOHO_CLI_PRODUCTS.forEach((product) => {
        expect(productAccounts[product]?.accountsContext.config.clientId).toBe(`${product}-id`);
      });

      expect(productAccounts.analytics).not.toBe(productAccounts.desk);
    });

    it('should map an unconfigured product to undefined', () => {
      const context = createCliContext({ shared: { clientId: '', clientSecret: '', refreshToken: '' } });

      ZOHO_CLI_PRODUCTS.forEach((product) => {
        expect(context.productAccounts[product]).toBeUndefined();
      });

      expect(context.recruitContext).toBeUndefined();
      expect(context.analyticsContext).toBeUndefined();
    });

    it('should share one accounts client between products on the same grant', () => {
      const shared = { clientId: 'shared-id', clientSecret: 'shared-secret', refreshToken: 'shared-token' };
      const { productAccounts } = createCliContext({ shared, desk: { ...shared, orgId: 'desk-org' } });

      expect(productAccounts.recruit).toBeDefined();
      expect(productAccounts.recruit).toBe(productAccounts.crm);
      expect(productAccounts.recruit).toBe(productAccounts.desk);
    });

    it('should not report a desk client without an org id', () => {
      const shared = { clientId: 'shared-id', clientSecret: 'shared-secret', refreshToken: 'shared-token' };
      const context = createCliContext({ shared });

      expect(context.deskContext).toBeUndefined();
      expect(context.productAccounts.desk).toBeUndefined();
    });
  });

  describe('product contexts', () => {
    it('should build each configured product context with its org id', () => {
      const context = createCliContext(distinctCredentialsConfig());

      expect(context.recruitContext).toBeDefined();
      expect(context.crmContext).toBeDefined();
      expect(context.signContext).toBeDefined();
      expect(context.deskContext?.config.orgId).toBe('desk-org');
      expect(context.analyticsContext?.config.orgId).toBe('analytics-org');
    });
  });
});
