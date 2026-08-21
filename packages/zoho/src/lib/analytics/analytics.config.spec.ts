import { describe, it, expect } from 'vitest';
import { zohoAnalyticsConfigApiUrl } from './analytics.config';

describe('zohoAnalyticsConfigApiUrl()', () => {
  it('should resolve the "production" key to the production Analytics URL', () => {
    expect(zohoAnalyticsConfigApiUrl('production')).toBe('https://analyticsapi.zoho.com/restapi/v2');
  });

  it('should resolve the "sandbox" key to the production Analytics URL, as Analytics has no sandbox', () => {
    expect(zohoAnalyticsConfigApiUrl('sandbox')).toBe('https://analyticsapi.zoho.com/restapi/v2');
  });

  it('should pass through a custom regional URL unchanged', () => {
    const customUrl = 'https://analyticsapi.zoho.eu/restapi/v2';
    expect(zohoAnalyticsConfigApiUrl(customUrl)).toBe(customUrl);
  });
});
