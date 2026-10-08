import { describe, it, expect } from 'vitest';
import { ZOHO_ACCOUNTS_US_API_URL, ZOHO_DATACENTER_API_DOMAINS, ZOHO_DATACENTER_DOMAINS, type ZohoAccountsApiUrlKey, zohoAccountsApiUrlKeyForApiDomain, zohoAccountsApiUrlKeyForLocation, zohoAccountsApiUrlKeyForToken, zohoAccountsConfigApiUrl, zohoDatacenterApiDomain, zohoDatacenterDomain } from './accounts.config';

describe('zohoAccountsConfigApiUrl()', () => {
  it('should resolve the "us" key to the US datacenter URL', () => {
    expect(zohoAccountsConfigApiUrl('us')).toBe(ZOHO_ACCOUNTS_US_API_URL);
  });

  it('should pass through a custom URL unchanged', () => {
    const customUrl = 'https://accounts.zoho.eu';
    expect(zohoAccountsConfigApiUrl(customUrl)).toBe(customUrl);
  });
});

describe('zohoAccountsApiUrlKeyForLocation()', () => {
  it('should resolve a known location case-insensitively', () => {
    expect(zohoAccountsApiUrlKeyForLocation('eu')).toBe('eu');
    expect(zohoAccountsApiUrlKeyForLocation(' AU ')).toBe('au');
  });

  it('should return undefined for an unsupported or missing location', () => {
    expect(zohoAccountsApiUrlKeyForLocation('cn')).toBeUndefined();
    expect(zohoAccountsApiUrlKeyForLocation('toString')).toBeUndefined();
    expect(zohoAccountsApiUrlKeyForLocation(undefined)).toBeUndefined();
  });
});

describe('zohoAccountsApiUrlKeyForApiDomain()', () => {
  it('should resolve every known api domain to its datacenter', () => {
    (Object.keys(ZOHO_DATACENTER_API_DOMAINS) as ZohoAccountsApiUrlKey[]).forEach((key) => {
      expect(zohoAccountsApiUrlKeyForApiDomain(ZOHO_DATACENTER_API_DOMAINS[key])).toBe(key);
    });
  });

  it('should tolerate a trailing slash and a missing www prefix', () => {
    expect(zohoAccountsApiUrlKeyForApiDomain('https://www.zohoapis.eu/')).toBe('eu');
    expect(zohoAccountsApiUrlKeyForApiDomain('https://zohoapis.com.au')).toBe('au');
    expect(zohoAccountsApiUrlKeyForApiDomain('zohoapis.in')).toBe('in');
  });

  it('should not confuse the us domain with a longer one that contains it', () => {
    expect(zohoAccountsApiUrlKeyForApiDomain('https://www.zohoapis.com.au')).toBe('au');
    expect(zohoAccountsApiUrlKeyForApiDomain('https://www.zohoapis.com')).toBe('us');
  });

  it('should return undefined for an unknown domain', () => {
    expect(zohoAccountsApiUrlKeyForApiDomain('https://www.zohoapis.com.cn')).toBeUndefined();
    expect(zohoAccountsApiUrlKeyForApiDomain('https://example.com')).toBeUndefined();
    expect(zohoAccountsApiUrlKeyForApiDomain(undefined)).toBeUndefined();
  });
});

describe('zohoAccountsApiUrlKeyForToken()', () => {
  it('should prefer the location over the api domain', () => {
    expect(zohoAccountsApiUrlKeyForToken({ location: 'eu', apiDomain: 'https://www.zohoapis.com' })).toBe('eu');
  });

  it('should fall back to the api domain when the location is missing or unknown', () => {
    expect(zohoAccountsApiUrlKeyForToken({ apiDomain: 'https://www.zohoapis.jp' })).toBe('jp');
    expect(zohoAccountsApiUrlKeyForToken({ location: 'cn', apiDomain: 'https://www.zohoapis.ca' })).toBe('ca');
  });

  it('should return undefined when neither identifies a datacenter', () => {
    expect(zohoAccountsApiUrlKeyForToken({})).toBeUndefined();
  });
});

describe('zohoDatacenterDomain()', () => {
  it('should default to the us datacenter', () => {
    expect(zohoDatacenterDomain()).toBe('zoho.com');
    expect(zohoDatacenterApiDomain()).toBe('https://www.zohoapis.com');
  });

  it('should match the accounts host of every datacenter', () => {
    (Object.keys(ZOHO_DATACENTER_DOMAINS) as ZohoAccountsApiUrlKey[]).forEach((datacenter) => {
      expect(zohoAccountsConfigApiUrl(datacenter)).toBe(`https://accounts.${zohoDatacenterDomain({ datacenter })}`);
    });
  });
});
