import { describe, expect, it } from 'vitest';
import { exportConfigFromArgv, parseColumnList } from './analytics.export.command';

describe('parseColumnList()', () => {
  it('should split and trim the column list', () => {
    expect(parseColumnList('Region, Amount ')).toEqual(['Region', 'Amount']);
  });

  it('should return undefined when nothing is given', () => {
    expect(parseColumnList(undefined)).toBeUndefined();
    expect(parseColumnList('')).toBeUndefined();
  });

  it('should return undefined when only separators are given', () => {
    // sending [''] would ask Zoho to export a column with no name
    expect(parseColumnList(',')).toBeUndefined();
    expect(parseColumnList(' , ')).toBeUndefined();
  });
});

describe('exportConfigFromArgv()', () => {
  it('should carry the format and criteria through untouched', () => {
    const criteria = `"Sales"."Region"='West'`;
    const config = exportConfigFromArgv({ format: 'json', criteria });

    expect(config.responseFormat).toBe('json');
    expect(config.criteria).toBe(criteria);
  });

  it('should parse the columns option into selectedColumns', () => {
    expect(exportConfigFromArgv({ format: 'csv', columns: 'Region, Amount' }).selectedColumns).toEqual(['Region', 'Amount']);
  });

  it('should leave selectedColumns undefined when no columns are given, so the export is not narrowed', () => {
    expect(exportConfigFromArgv({ format: 'csv' }).selectedColumns).toBeUndefined();
  });
});
