import { describe, expect, it } from 'vitest';
import { toZohoCliProductApis, type ZohoCliContext, type ZohoCliProductApi } from './cli.context';
import { ZOHO_CLI_PRODUCTS } from '../config/cli.config';

/**
 * Builds a context whose every `<product>Api` slot holds that product's name as a sentinel, so a
 * mapping that returns another product's API is visible as the wrong string.
 */
function sentinelContext(): ZohoCliContext {
  const context: Record<string, unknown> = {};
  ZOHO_CLI_PRODUCTS.forEach((product) => {
    context[`${product}Api`] = product as unknown as ZohoCliProductApi;
  });
  return context as unknown as ZohoCliContext;
}

describe('toZohoCliProductApis()', () => {
  // analytics used to fall through to the desk branch, so `auth check` / `doctor` reported Desk's
  // granted scope under the analytics key while the analytics credentials were never exercised
  it('should map every product to its own api', () => {
    const apis = toZohoCliProductApis(sentinelContext());

    ZOHO_CLI_PRODUCTS.forEach((product) => {
      expect(apis[product]).toBe(product);
    });
  });

  it('should map an unconfigured product to undefined', () => {
    const apis = toZohoCliProductApis({ recruitApi: undefined, crmApi: undefined, deskApi: undefined, signApi: undefined, analyticsApi: undefined });

    ZOHO_CLI_PRODUCTS.forEach((product) => {
      expect(apis[product]).toBeUndefined();
    });
  });
});
