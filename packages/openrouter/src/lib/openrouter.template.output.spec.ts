import { describe, expect, it } from 'vitest';
import { checkOpenRouterTemplateOpenRouterInput, checkOpenRouterTemplateOutputText, findOpenRouterTemplateUrlHosts, isOpenRouterTemplateUrlHostAllowed } from './openrouter.template.output';

describe('checkOpenRouterTemplateOutputText()', () => {
  const allowedUrlDomains = ['hellosubs.co'];

  it('should pass and trim a plain message', () => {
    expect(checkOpenRouterTemplateOutputText({ text: '  Hi Ana, see you Monday.  ', maxLength: 160 })).toEqual({ valid: true, text: 'Hi Ana, see you Monday.', errors: [], hosts: [], disallowedHosts: [] });
  });

  it('should refuse an empty message', () => {
    expect(checkOpenRouterTemplateOutputText({ text: '   ', maxLength: 160 }).valid).toBe(false);
  });

  it('should refuse a message over the length limit', () => {
    expect(checkOpenRouterTemplateOutputText({ text: 'a'.repeat(161), maxLength: 160 }).valid).toBe(false);
    expect(checkOpenRouterTemplateOutputText({ text: 'a'.repeat(160), maxLength: 160 }).valid).toBe(true);
  });

  it('should allow a URL on an allowed domain or one of its subdomains', () => {
    expect(checkOpenRouterTemplateOutputText({ text: 'Open https://hellosubs.co/jobs', maxLength: 160, allowedUrlDomains }).valid).toBe(true);
    expect(checkOpenRouterTemplateOutputText({ text: 'Open https://app.hellosubs.co/jobs?x=1', maxLength: 160, allowedUrlDomains }).valid).toBe(true);
    expect(checkOpenRouterTemplateOutputText({ text: 'Open www.hellosubs.co today', maxLength: 160, allowedUrlDomains }).valid).toBe(true);
    expect(checkOpenRouterTemplateOutputText({ text: 'Open HelloSubs.co/jobs.', maxLength: 160, allowedUrlDomains }).valid).toBe(true);
  });

  it('should refuse a scheme URL to another domain', () => {
    const result = checkOpenRouterTemplateOutputText({ text: 'Open https://evil.com/jobs', maxLength: 160, allowedUrlDomains });
    expect(result.valid).toBe(false);
    expect(result.disallowedHosts).toEqual(['evil.com']);
  });

  it('should refuse a www host, a bare domain and an email on another domain', () => {
    expect(checkOpenRouterTemplateOutputText({ text: 'Visit www.evil.com', maxLength: 160, allowedUrlDomains }).valid).toBe(false);
    expect(checkOpenRouterTemplateOutputText({ text: 'Visit evil.com/claim now', maxLength: 160, allowedUrlDomains }).valid).toBe(false);
    expect(checkOpenRouterTemplateOutputText({ text: 'Email bob@evil.com', maxLength: 160, allowedUrlDomains }).valid).toBe(false);
  });

  it('should refuse a host that only starts with an allowed domain', () => {
    expect(checkOpenRouterTemplateOutputText({ text: 'Open https://hellosubs.co.evil.com', maxLength: 160, allowedUrlDomains }).valid).toBe(false);
    expect(checkOpenRouterTemplateOutputText({ text: 'Open hellosubs.co.evil.com', maxLength: 160, allowedUrlDomains }).valid).toBe(false);
    expect(checkOpenRouterTemplateOutputText({ text: 'Open https://nothellosubs.co', maxLength: 160, allowedUrlDomains }).valid).toBe(false);
  });

  it('should read the host after any user info', () => {
    expect(checkOpenRouterTemplateOutputText({ text: 'Open https://hellosubs.co@evil.com/x', maxLength: 160, allowedUrlDomains }).disallowedHosts).toContain('evil.com');
  });

  it('should refuse every URL when no domain is allowed', () => {
    expect(checkOpenRouterTemplateOutputText({ text: 'Open https://hellosubs.co', maxLength: 160 }).valid).toBe(false);
  });

  it('should not flag times, money or abbreviations', () => {
    expect(checkOpenRouterTemplateOutputText({ text: 'Starts 9.30am, pays $12.50/hr, e.g. Mon.', maxLength: 160 }).valid).toBe(true);
  });
});

describe('findOpenRouterTemplateUrlHosts()', () => {
  it('should find each distinct host once', () => {
    expect(findOpenRouterTemplateUrlHosts('https://a.com/x and a.com and ftp://b.org:21/y')).toEqual(['a.com', 'b.org']);
  });
});

describe('isOpenRouterTemplateUrlHostAllowed()', () => {
  it('should match the domain and its subdomains only', () => {
    expect(isOpenRouterTemplateUrlHostAllowed('hellosubs.co', ['HelloSubs.co'])).toBe(true);
    expect(isOpenRouterTemplateUrlHostAllowed('a.b.hellosubs.co.', ['hellosubs.co'])).toBe(true);
    expect(isOpenRouterTemplateUrlHostAllowed('xhellosubs.co', ['hellosubs.co'])).toBe(false);
    expect(isOpenRouterTemplateUrlHostAllowed('hellosubs.co', [''])).toBe(false);
  });
});

describe('checkOpenRouterTemplateOpenRouterInput()', () => {
  it('should refuse an input over the limit', () => {
    expect(checkOpenRouterTemplateOpenRouterInput('abc', 2)).toBeDefined();
    expect(checkOpenRouterTemplateOpenRouterInput('abc', 3)).toBeUndefined();
    expect(checkOpenRouterTemplateOpenRouterInput('abc', undefined)).toBeUndefined();
  });
});
