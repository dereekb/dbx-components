import { describe, expect, it } from 'vitest';
import { importMatchingColumns, inferFileType } from './analytics.import.command';

describe('inferFileType()', () => {
  it('should infer the type from a csv or json extension', () => {
    expect(inferFileType('rows.csv')).toBe('csv');
    expect(inferFileType('rows.json')).toBe('json');
  });

  it('should ignore the case of the extension', () => {
    expect(inferFileType('ROWS.CSV')).toBe('csv');
    expect(inferFileType('rows.Json')).toBe('json');
  });

  it('should use the last extension of a dotted path', () => {
    expect(inferFileType('/tmp/my.export.2026.csv')).toBe('csv');
  });

  it('should return undefined for an extension Zoho cannot import', () => {
    // the import then relies on --file-type, and fails on the CONFIG when neither is given
    expect(inferFileType('rows.xlsx')).toBeUndefined();
    expect(inferFileType('rows')).toBeUndefined();
  });
});

describe('importMatchingColumns()', () => {
  it('should split and trim the column list', () => {
    expect(importMatchingColumns('updateadd', 'Region, Rep ')).toEqual(['Region', 'Rep']);
  });

  it('should return undefined when no columns are given for a mode that does not need them', () => {
    expect(importMatchingColumns('append', undefined)).toBeUndefined();
    expect(importMatchingColumns('truncateadd', '')).toBeUndefined();
  });

  it('should discard blank entries rather than sending unnamed columns', () => {
    expect(importMatchingColumns('append', 'Region,,Rep,')).toEqual(['Region', 'Rep']);
  });

  it('should fail for the updateadd mode with no columns, since it would upsert against nothing', () => {
    expect(() => importMatchingColumns('updateadd', undefined)).toThrow();
    expect(() => importMatchingColumns('updateadd', '')).toThrow();
  });

  it('should fail for the updateadd mode when the columns are only separators', () => {
    // a bare ',' splits into two empty names, which passed a length check before they were filtered
    expect(() => importMatchingColumns('updateadd', ' , ')).toThrow();
  });
});
