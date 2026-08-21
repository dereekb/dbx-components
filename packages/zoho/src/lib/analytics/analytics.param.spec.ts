import { describe, it, expect } from 'vitest';
import { zohoAnalyticsConfigParamString, zohoAnalyticsConfigQuerySuffix, zohoAnalyticsFormApiFetchJsonInput } from './analytics.param';

describe('zohoAnalyticsConfigParamString()', () => {
  it('should encode the config as a url-encoded CONFIG parameter', () => {
    const result = zohoAnalyticsConfigParamString({ responseFormat: 'csv' });

    expect(result).toBe('CONFIG=%7B%22responseFormat%22%3A%22csv%22%7D');
    expect(JSON.parse(new URLSearchParams(result).get('CONFIG') as string)).toEqual({ responseFormat: 'csv' });
  });

  it('should drop keys with an undefined value', () => {
    const result = zohoAnalyticsConfigParamString({ importType: 'append', onError: undefined });

    expect(JSON.parse(new URLSearchParams(result).get('CONFIG') as string)).toEqual({ importType: 'append' });
  });

  it('should return an empty string when no config is provided', () => {
    expect(zohoAnalyticsConfigParamString()).toBe('');
    expect(zohoAnalyticsConfigParamString(null)).toBe('');
  });

  it('should encode a criteria expression so its quotes survive the url', () => {
    const criteria = `"Sales"."Region"='West'`;
    const result = zohoAnalyticsConfigParamString({ criteria });

    expect(result).not.toContain(`'`);
    expect(JSON.parse(new URLSearchParams(result).get('CONFIG') as string)).toEqual({ criteria });
  });
});

describe('zohoAnalyticsConfigQuerySuffix()', () => {
  it('should prefix the encoded config with a question mark', () => {
    expect(zohoAnalyticsConfigQuerySuffix({ responseFormat: 'json' })).toBe('?CONFIG=%7B%22responseFormat%22%3A%22json%22%7D');
  });

  it('should return an empty string when no config is provided, leaving the url untouched', () => {
    expect(zohoAnalyticsConfigQuerySuffix()).toBe('');
  });
});

describe('zohoAnalyticsFormApiFetchJsonInput()', () => {
  it('should send the config as a form-urlencoded body and override the json content type', () => {
    const input = zohoAnalyticsFormApiFetchJsonInput('POST', { columns: { Region: 'East' } });

    expect(input.method).toBe('POST');
    expect(input.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(JSON.parse(new URLSearchParams(input.body as string).get('CONFIG') as string)).toEqual({ columns: { Region: 'East' } });
  });
});
