import { describe, it, expect } from 'vitest';
import { ZOHO_ACCOUNTS_US_API_URL, zohoAccountsConfigApiUrl } from './accounts.config';

describe('zohoAccountsConfigApiUrl()', () => {
  it('should resolve the "us" key to the US datacenter URL', () => {
    expect(zohoAccountsConfigApiUrl('us')).toBe(ZOHO_ACCOUNTS_US_API_URL);
  });

  it('should pass through a custom URL unchanged', () => {
    const customUrl = 'https://accounts.zoho.eu';
    expect(zohoAccountsConfigApiUrl(customUrl)).toBe(customUrl);
  });
});
