import { describe, expect, it } from 'vitest';
import { type DbxStyleDemoStyleTemplate, isDbxStyleDemoStyleLoaderConfig, isDbxStyleDemoStyleTemplate, mergeDbxStyleDemoStyleTemplates } from './style.template';

describe('mergeDbxStyleDemoStyleTemplates()', () => {
  it('should return an empty style set for an empty input', () => {
    const result = mergeDbxStyleDemoStyleTemplates([]);
    expect(result.style).toEqual({});
    expect(result.classes).toEqual([]);
  });

  it('should merge style POJOs with later templates winning on conflicting keys', () => {
    const templates: DbxStyleDemoStyleTemplate[] = [
      { key: 'a', style: { '--token-x': 'red', '--token-y': 'green' } },
      { key: 'b', style: { '--token-x': 'blue' } }
    ];

    const result = mergeDbxStyleDemoStyleTemplates(templates);
    expect(result.style).toEqual({ '--token-x': 'blue', '--token-y': 'green' });
  });

  it('should accumulate classes across templates, de-duplicated and order-preserving', () => {
    const templates: DbxStyleDemoStyleTemplate[] = [
      { key: 'a', className: 'one two' },
      { key: 'b', className: ['two', 'three'] },
      { key: 'c', className: 'one' }
    ];

    const result = mergeDbxStyleDemoStyleTemplates(templates);
    expect(result.classes).toEqual(['one', 'two', 'three']);
  });

  it('should ignore templates that contribute neither style nor className', () => {
    const result = mergeDbxStyleDemoStyleTemplates([{ key: 'empty' }]);
    expect(result.style).toEqual({});
    expect(result.classes).toEqual([]);
  });
});

describe('isDbxStyleDemoStyleTemplate()', () => {
  it('should return false for a bare template-key string', () => {
    expect(isDbxStyleDemoStyleTemplate('corner-shape-large')).toBe(false);
  });

  it('should return true for a template object carrying a string key', () => {
    expect(isDbxStyleDemoStyleTemplate({ key: 'corner-shape-large' })).toBe(true);
  });

  it('should return false for null/undefined', () => {
    expect(isDbxStyleDemoStyleTemplate(null)).toBe(false);
    expect(isDbxStyleDemoStyleTemplate(undefined)).toBe(false);
  });
});

describe('isDbxStyleDemoStyleLoaderConfig()', () => {
  it('should return false for a key string', () => {
    expect(isDbxStyleDemoStyleLoaderConfig('corner-shape-large')).toBe(false);
  });

  it('should return false for an array of keys', () => {
    expect(isDbxStyleDemoStyleLoaderConfig(['a', 'b'])).toBe(false);
  });

  it('should return true for a config object with a templates property', () => {
    expect(isDbxStyleDemoStyleLoaderConfig({ templates: ['a'] })).toBe(true);
  });

  it('should return false for null/undefined', () => {
    expect(isDbxStyleDemoStyleLoaderConfig(null)).toBe(false);
    expect(isDbxStyleDemoStyleLoaderConfig(undefined)).toBe(false);
  });
});
