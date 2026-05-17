import { describe, it, expect } from 'vitest';
import { zohoCrmConfigApiUrl } from './crm.config';

describe('zohoCrmConfigApiUrl()', () => {
  it('should resolve the "sandbox" key to the sandbox CRM URL', () => {
    expect(zohoCrmConfigApiUrl('sandbox')).toBe('https://crmsandbox.zoho.com/crm');
  });

  it('should resolve the "production" key to the production CRM URL', () => {
    expect(zohoCrmConfigApiUrl('production')).toBe('https://www.zohoapis.com/crm');
  });

  it('should pass through a custom URL unchanged', () => {
    const customUrl = 'https://crm.zoho.eu/crm';
    expect(zohoCrmConfigApiUrl(customUrl)).toBe(customUrl);
  });
});
