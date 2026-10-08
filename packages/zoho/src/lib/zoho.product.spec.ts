import { describe, it, expect } from 'vitest';
import { ZOHO_PRODUCTS, zohoProductConfigApiUrlForDatacenter, zohoProductForOAuthScope, zohoProductsForOAuthScopes } from './zoho.product';
import { zohoCrmConfigApiUrl } from './crm/crm.config';
import { zohoRecruitConfigApiUrl } from './recruit/recruit.config';
import { zohoDeskConfigApiUrl } from './desk/desk.config';
import { zohoSignConfigApiUrl } from './sign/sign.config';
import { zohoAnalyticsConfigApiUrl } from './analytics/analytics.config';

describe('zohoProductForOAuthScope()', () => {
  it('should map each product scope namespace to its product', () => {
    expect(zohoProductForOAuthScope('ZohoCRM.modules.ALL')).toBe('crm');
    expect(zohoProductForOAuthScope('ZohoRecruit.settings.all')).toBe('recruit');
    expect(zohoProductForOAuthScope('Desk.tickets.ALL')).toBe('desk');
    expect(zohoProductForOAuthScope('ZohoSign.documents.ALL')).toBe('sign');
    expect(zohoProductForOAuthScope('ZohoAnalytics.data.all')).toBe('analytics');
  });

  it('should match case-insensitively', () => {
    expect(zohoProductForOAuthScope('zohocrm.modules.read')).toBe('crm');
  });

  it('should return undefined for a scope that belongs to no product client', () => {
    expect(zohoProductForOAuthScope('AaaServer.profile.READ')).toBeUndefined();
    expect(zohoProductForOAuthScope('ZohoBooks.fullaccess.all')).toBeUndefined();
  });
});

describe('zohoProductsForOAuthScopes()', () => {
  it('should return each covered product once, in ZOHO_PRODUCTS order', () => {
    expect(zohoProductsForOAuthScopes(['Desk.tickets.ALL', 'ZohoCRM.modules.ALL', 'ZohoCRM.settings.ALL', 'AaaServer.profile.READ'])).toEqual(['crm', 'desk']);
  });

  it('should accept a comma-delimited scope string', () => {
    expect(zohoProductsForOAuthScopes('ZohoRecruit.modules.ALL,ZohoAnalytics.metadata.all')).toEqual(['recruit', 'analytics']);
  });

  it('should return no products for missing scopes', () => {
    expect(zohoProductsForOAuthScopes(undefined)).toEqual([]);
    expect(zohoProductsForOAuthScopes('')).toEqual([]);
  });
});

describe('zohoProductConfigApiUrlForDatacenter()', () => {
  it('should match the existing production urls for the us datacenter', () => {
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'crm' })).toBe(zohoCrmConfigApiUrl('production'));
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'recruit' })).toBe(zohoRecruitConfigApiUrl('production'));
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'desk' })).toBe(zohoDeskConfigApiUrl('production'));
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'sign' })).toBe(zohoSignConfigApiUrl('production'));
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'analytics' })).toBe(zohoAnalyticsConfigApiUrl('production'));
  });

  it('should match the existing sandbox urls for the us datacenter', () => {
    ZOHO_PRODUCTS.forEach((product) => {
      const expected = { crm: zohoCrmConfigApiUrl, recruit: zohoRecruitConfigApiUrl, desk: zohoDeskConfigApiUrl, sign: zohoSignConfigApiUrl, analytics: zohoAnalyticsConfigApiUrl }[product]('sandbox');
      expect(zohoProductConfigApiUrlForDatacenter({ product, datacenter: 'us', mode: 'sandbox' })).toBe(expected);
    });
  });

  it('should resolve the eu datacenter hosts', () => {
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'crm', datacenter: 'eu' })).toBe('https://www.zohoapis.eu/crm');
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'recruit', datacenter: 'eu' })).toBe('https://recruit.zoho.eu/recruit');
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'desk', datacenter: 'eu' })).toBe('https://desk.zoho.eu/api/v1');
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'sign', datacenter: 'eu' })).toBe('https://sign.zoho.eu/api/v1');
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'analytics', datacenter: 'eu' })).toBe('https://analyticsapi.zoho.eu/restapi/v2');
  });

  it('should keep the sandbox distinction outside the us datacenter', () => {
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'crm', datacenter: 'au', mode: 'sandbox' })).toBe('https://crmsandbox.zoho.com.au/crm');
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'recruit', datacenter: 'in', mode: 'sandbox' })).toBe('https://recruitsandbox.zoho.in/recruit');
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'sign', datacenter: 'jp', mode: 'sandbox' })).toBe('https://signsandbox.zoho.jp/api/v1');
  });

  it('should use the zohocloud.ca and zohoapis.ca hosts for the ca datacenter', () => {
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'crm', datacenter: 'ca' })).toBe('https://www.zohoapis.ca/crm');
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'desk', datacenter: 'ca' })).toBe('https://desk.zohocloud.ca/api/v1');
    expect(zohoProductConfigApiUrlForDatacenter({ product: 'analytics', datacenter: 'ca' })).toBe('https://analyticsapi.zohocloud.ca/restapi/v2');
  });
});
