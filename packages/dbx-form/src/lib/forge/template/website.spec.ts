import { describe, it, expect } from 'vitest';
import { dbxForgeWebsiteUrlField } from './website';

// MARK: dbxForgeWebsiteUrlField
describe('dbxForgeWebsiteUrlField()', () => {
  it('should create an input field', () => {
    const field = dbxForgeWebsiteUrlField();
    expect(field.type).toBe('input');
  });

  it('should default key to website', () => {
    const field = dbxForgeWebsiteUrlField();
    expect(field.key).toBe('website');
  });

  it('should default label to Website Url', () => {
    const field = dbxForgeWebsiteUrlField();
    expect(field.label).toBe('Website Url');
  });

  it('should use text input type', () => {
    const field = dbxForgeWebsiteUrlField();
    expect(field.props?.type).toBe('text');
  });

  it('should allow overriding the key', () => {
    const field = dbxForgeWebsiteUrlField({ key: 'homepage' });
    expect(field.key).toBe('homepage');
  });

  it('should allow overriding the label', () => {
    const field = dbxForgeWebsiteUrlField({ label: 'Homepage' });
    expect(field.label).toBe('Homepage');
  });

  it('should set required when specified', () => {
    const field = dbxForgeWebsiteUrlField({ required: true });
    expect(field.required).toBe(true);
  });

  it('should map description to hint in props', () => {
    const field = dbxForgeWebsiteUrlField({ description: 'Enter your website' });
    expect(field.props?.hint).toBe('Enter your website');
  });
});
