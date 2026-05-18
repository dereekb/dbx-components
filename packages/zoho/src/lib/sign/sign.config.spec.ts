import { describe, it, expect } from 'vitest';
import { zohoSignConfigApiUrl } from './sign.config';

describe('zohoSignConfigApiUrl()', () => {
  it('should resolve the "sandbox" key to the sandbox Sign URL', () => {
    expect(zohoSignConfigApiUrl('sandbox')).toBe('https://signsandbox.zoho.com/api/v1');
  });

  it('should resolve the "production" key to the production Sign URL', () => {
    expect(zohoSignConfigApiUrl('production')).toBe('https://sign.zoho.com/api/v1');
  });

  it('should pass through a custom URL unchanged', () => {
    const customUrl = 'https://sign.zoho.eu/api/v1';
    expect(zohoSignConfigApiUrl(customUrl)).toBe(customUrl);
  });
});
