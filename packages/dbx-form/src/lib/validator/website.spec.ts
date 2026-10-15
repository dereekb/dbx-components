import { describe, it, expect } from 'vitest';
import { FormControl } from '@angular/forms';
import { IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY, isWebsiteUrlValidator, type IsWebsiteUrlValidatorConfig } from './website';

function isValid(value: string, config?: IsWebsiteUrlValidatorConfig): boolean {
  return new FormControl(value, isWebsiteUrlValidator(config)).valid;
}

describe('isWebsiteUrlValidator()', () => {
  it('should accept a website url with an http/https prefix', () => {
    expect(isValid('https://dereekb.com/callback')).toBe(true);
  });

  it('should return null for a valid value so the validator works on its own', () => {
    expect(isWebsiteUrlValidator()(new FormControl('https://dereekb.com/callback'))).toBeNull();
  });

  it('should reject a custom-scheme URI by default', () => {
    const control = new FormControl('cursor://anysphere.cursor-mcp/oauth/callback', isWebsiteUrlValidator());

    expect(control.valid).toBe(false);
    expect(control.errors?.[IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY]).toBeDefined();
  });

  describe('allowCustomSchemeUris', () => {
    const config: IsWebsiteUrlValidatorConfig = { requirePrefix: true, allowPorts: true, allowCustomSchemeUris: true };

    it('should accept custom-scheme URIs', () => {
      expect(isValid('cursor://anysphere.cursor-mcp/oauth/callback', config)).toBe(true);
      expect(isValid('com.example.app:/oauth2redirect', config)).toBe(true);
    });

    it('should still accept website urls', () => {
      expect(isValid('https://dereekb.com/callback', config)).toBe(true);
      expect(isValid('http://localhost:8080/callback', config)).toBe(true);
    });

    it('should reject unsafe schemes', () => {
      expect(isValid('javascript://alert(1)', config)).toBe(false);
    });

    it('should reject values that are not URIs', () => {
      expect(isValid('not a uri', config)).toBe(false);
    });

    it('should mention app URIs in the error message', () => {
      const control = new FormControl('not a uri', isWebsiteUrlValidator(config));
      expect(control.errors?.[IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY]?.message).toContain('app URI');
    });

    it('should not check custom-scheme URIs against validDomains', () => {
      expect(isValid('cursor://anysphere.cursor-mcp/oauth/callback', { ...config, validDomains: ['dereekb.com'] })).toBe(true);
    });
  });
});
