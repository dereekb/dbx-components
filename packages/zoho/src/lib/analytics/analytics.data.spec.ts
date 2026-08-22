import { describe, expect, it } from 'vitest';
import { zohoAnalyticsRowDataFromCsv, zohoAnalyticsRowDataFromFileContent, zohoAnalyticsRowDataFromJson } from './analytics.data';

describe('zohoAnalyticsRowDataFromCsv()', () => {
  it('should read the header as the column names and the rest as rows', () => {
    const result = zohoAnalyticsRowDataFromCsv('Region,Sales\nEast,100\nWest,200');

    expect(result.columnNames).toEqual(['Region', 'Sales']);
    expect(result.rows).toEqual([
      { Region: 'East', Sales: '100' },
      { Region: 'West', Sales: '200' }
    ]);
  });

  it('should keep a quoted cell carrying the delimiter intact', () => {
    const result = zohoAnalyticsRowDataFromCsv('Region,Note\nEast,"a, b"');
    expect(result.rows).toEqual([{ Region: 'East', Note: 'a, b' }]);
  });

  it('should keep a quoted cell carrying a newline intact', () => {
    const result = zohoAnalyticsRowDataFromCsv('Region,Note\nEast,"line1\nline2"\nWest,x');

    expect(result.rows).toEqual([
      { Region: 'East', Note: 'line1\nline2' },
      { Region: 'West', Note: 'x' }
    ]);
  });

  it('should unescape a doubled quote inside a quoted cell', () => {
    const result = zohoAnalyticsRowDataFromCsv('Region,Note\nEast,"say ""hi"""');
    expect(result.rows).toEqual([{ Region: 'East', Note: 'say "hi"' }]);
  });

  it('should accept crlf line endings', () => {
    const result = zohoAnalyticsRowDataFromCsv('Region,Sales\r\nEast,100\r\n');

    expect(result.columnNames).toEqual(['Region', 'Sales']);
    expect(result.rows).toEqual([{ Region: 'East', Sales: '100' }]);
  });

  it('should not produce a trailing empty row for a trailing newline', () => {
    expect(zohoAnalyticsRowDataFromCsv('Region\nEast\n').rows).toHaveLength(1);
  });

  it('should drop a leading byte order mark so it does not join the first column name', () => {
    // left in place the BOM becomes part of "Region", which then matches no column in the table
    const result = zohoAnalyticsRowDataFromCsv('﻿Region,Sales\nEast,100');
    expect(result.columnNames).toEqual(['Region', 'Sales']);
  });

  it('should trim whitespace around the header names', () => {
    expect(zohoAnalyticsRowDataFromCsv('Region , Sales\nEast,100').columnNames).toEqual(['Region', 'Sales']);
  });

  it('should treat a missing trailing cell as empty rather than absent', () => {
    expect(zohoAnalyticsRowDataFromCsv('Region,Sales\nEast').rows).toEqual([{ Region: 'East', Sales: '' }]);
  });

  it('should keep an empty trailing cell', () => {
    expect(zohoAnalyticsRowDataFromCsv('Region,Sales\nEast,').rows).toEqual([{ Region: 'East', Sales: '' }]);
  });

  it('should split on a custom delimiter', () => {
    const result = zohoAnalyticsRowDataFromCsv('Region;Sales\nEast;100', ';');
    expect(result.rows).toEqual([{ Region: 'East', Sales: '100' }]);
  });

  it('should ignore an unnamed header column, since an import has nowhere to put it', () => {
    const result = zohoAnalyticsRowDataFromCsv('Region,,Sales\nEast,x,100');

    expect(result.columnNames).toEqual(['Region', 'Sales']);
    expect(result.rows).toEqual([{ Region: 'East', Sales: '100' }]);
  });

  it('should collapse a duplicated header name into one column', () => {
    const result = zohoAnalyticsRowDataFromCsv('Region,Region\nEast,West');

    expect(result.columnNames).toEqual(['Region']);
    expect(result.rows).toEqual([{ Region: 'West' }]);
  });

  it('should return nothing for empty content', () => {
    expect(zohoAnalyticsRowDataFromCsv('')).toEqual({ columnNames: [], rows: [] });
  });

  it('should read a header with no rows as columns and no data', () => {
    const result = zohoAnalyticsRowDataFromCsv('Region,Sales');

    expect(result.columnNames).toEqual(['Region', 'Sales']);
    expect(result.rows).toEqual([]);
  });
});

describe('zohoAnalyticsRowDataFromJson()', () => {
  it('should read an array of row objects', () => {
    const result = zohoAnalyticsRowDataFromJson('[{"Region":"East","Sales":100}]');

    expect(result.columnNames).toEqual(['Region', 'Sales']);
    expect(result.rows).toEqual([{ Region: 'East', Sales: 100 }]);
  });

  it('should take the union of the rows keys, since json rows may omit them', () => {
    const result = zohoAnalyticsRowDataFromJson('[{"Region":"East"},{"Sales":100}]');
    expect(result.columnNames).toEqual(['Region', 'Sales']);
  });

  it('should accept a lone object as a single row', () => {
    const result = zohoAnalyticsRowDataFromJson('{"Region":"East"}');
    expect(result.rows).toEqual([{ Region: 'East' }]);
  });

  it('should read an empty array as no columns and no rows', () => {
    expect(zohoAnalyticsRowDataFromJson('[]')).toEqual({ columnNames: [], rows: [] });
  });

  it('should fail for content that is not valid json', () => {
    expect(() => zohoAnalyticsRowDataFromJson('{nope')).toThrow();
  });

  it('should fail for an array of values rather than row objects', () => {
    expect(() => zohoAnalyticsRowDataFromJson('[1,2,3]')).toThrow();
  });

  it('should fail for a nested array, which is not the shape zoho imports', () => {
    expect(() => zohoAnalyticsRowDataFromJson('[["Region"],["East"]]')).toThrow();
  });
});

describe('zohoAnalyticsRowDataFromFileContent()', () => {
  it('should dispatch on the file type', () => {
    expect(zohoAnalyticsRowDataFromFileContent({ content: '[{"a":1}]', fileType: 'json' }).rows).toEqual([{ a: 1 }]);
    expect(zohoAnalyticsRowDataFromFileContent({ content: 'a\n1', fileType: 'csv' }).rows).toEqual([{ a: '1' }]);
  });

  it('should pass the delimiter through for a csv', () => {
    expect(zohoAnalyticsRowDataFromFileContent({ content: 'a;b\n1;2', fileType: 'csv', delimiter: ';' }).columnNames).toEqual(['a', 'b']);
  });
});
