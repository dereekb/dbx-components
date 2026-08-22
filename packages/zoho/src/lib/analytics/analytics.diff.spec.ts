import { describe, expect, it } from 'vitest';
import { type ZohoAnalyticsColumn, type ZohoAnalyticsColumnDataType } from './analytics.view';
import { type ZohoAnalyticsSchemaDiffInput, isZohoAnalyticsSchemaDiffClean, zohoAnalyticsSchemaDiff } from './analytics.diff';
import { zohoAnalyticsRowDataFromCsv } from './analytics.data';

/**
 * Builds a column with only the fields a diff reads, keeping the tables in these cases readable.
 */
function column(columnName: string, dataType?: ZohoAnalyticsColumnDataType, extra?: Partial<ZohoAnalyticsColumn>): ZohoAnalyticsColumn {
  return { columnId: `id-${columnName}`, columnName, dataType, ...extra };
}

/**
 * Diffs a CSV against the given columns, which is how the CLI uses this.
 */
function diffCsv(csv: string, columns: ZohoAnalyticsColumn[], options?: Partial<ZohoAnalyticsSchemaDiffInput>) {
  return zohoAnalyticsSchemaDiff({ ...zohoAnalyticsRowDataFromCsv(csv), columns, ...options });
}

describe('zohoAnalyticsSchemaDiff()', () => {
  describe('column matching', () => {
    it('should match columns present in both, and report no drift', () => {
      const diff = diffCsv('Region,Sales\nEast,100', [column('Region', 'PLAIN'), column('Sales', 'NUMBER')]);

      expect(diff.matchedColumns).toEqual(['Region', 'Sales']);
      expect(diff.droppedColumns).toEqual([]);
      expect(diff.emptyColumns).toEqual([]);
      expect(diff.conflicts).toEqual([]);
      expect(diff.rowCount).toBe(1);
      expect(isZohoAnalyticsSchemaDiffClean(diff)).toBe(true);
    });

    it('should report a column only in the file as dropped, since an import discards it silently', () => {
      const diff = diffCsv('Region,Territory\nEast,NE', [column('Region', 'PLAIN')]);

      expect(diff.droppedColumns).toEqual([{ columnName: 'Territory', valueCount: 1 }]);
      expect(isZohoAnalyticsSchemaDiffClean(diff)).toBe(false);
    });

    it('should count only the rows carrying a value for a dropped column', () => {
      const diff = diffCsv('Region,Territory\nEast,NE\nWest,\nNorth,NW', [column('Region', 'PLAIN')]);
      expect(diff.droppedColumns).toEqual([{ columnName: 'Territory', valueCount: 2 }]);
    });

    it('should report a column only in the table as empty', () => {
      const diff = diffCsv('Region\nEast', [column('Region', 'PLAIN'), column('RepEmail', 'EMAIL', { isNullable: true })]);
      expect(diff.emptyColumns).toEqual([{ columnName: 'RepEmail', dataType: 'EMAIL', isNullable: true, required: false }]);
    });

    it('should mark an omitted column required when it is not nullable and has no default', () => {
      const diff = diffCsv('Region\nEast', [column('Region', 'PLAIN'), column('Total', 'NUMBER', { isNullable: false })]);
      expect(diff.emptyColumns[0].required).toBe(true);
    });

    it('should not mark an omitted non-nullable column required when it has a default', () => {
      const diff = diffCsv('Region\nEast', [column('Region', 'PLAIN'), column('Total', 'NUMBER', { isNullable: false, defaultValue: '0' })]);
      expect(diff.emptyColumns[0].required).toBe(false);
    });

    it('should report a header a row never populates, since an import matches on the header', () => {
      // the CSV declares Territory but every row leaves it blank; it is still a column with no home
      const diff = diffCsv('Region,Territory\nEast,', [column('Region', 'PLAIN')]);
      expect(diff.droppedColumns).toEqual([{ columnName: 'Territory', valueCount: 0 }]);
    });
  });

  describe('case mismatches', () => {
    it('should report a name differing only in case separately from dropped and empty', () => {
      const diff = diffCsv('region\nEast', [column('Region', 'PLAIN')]);

      expect(diff.caseMismatchedColumns).toEqual([{ dataColumnName: 'region', tableColumnName: 'Region' }]);
      expect(diff.droppedColumns).toEqual([]);
      expect(diff.emptyColumns).toEqual([]);
      expect(diff.matchedColumns).toEqual([]);
    });

    it('should count a case mismatch as drift, since whether zoho matches it is unverified', () => {
      expect(isZohoAnalyticsSchemaDiffClean(diffCsv('region\nEast', [column('Region', 'PLAIN')]))).toBe(false);
    });

    it('should not type check a case-mismatched column, as it is not known to be matched', () => {
      const diff = diffCsv('sales\nnope', [column('Sales', 'NUMBER')]);
      expect(diff.conflicts).toEqual([]);
    });
  });

  describe('type conflicts', () => {
    it('should report a non-numeric value in a number column', () => {
      const diff = diffCsv('Sales\n100\nn/a', [column('Sales', 'NUMBER')]);

      expect(diff.conflicts).toEqual([{ columnName: 'Sales', dataType: 'NUMBER', reason: 'notANumber', conflictCount: 1, samples: [{ row: 2, value: 'n/a' }] }]);
    });

    it('should number sample rows from the first row of values, not the csv header', () => {
      const diff = diffCsv('Sales\nbad', [column('Sales', 'NUMBER')]);
      expect(diff.conflicts[0].samples).toEqual([{ row: 1, value: 'bad' }]);
    });

    it('should report a fractional value in a whole-number column, which zoho truncates', () => {
      const diff = diffCsv('Sales\n100.5', [column('Sales', 'NUMBER')]);
      expect(diff.conflicts[0].reason).toBe('notAnInteger');
    });

    it('should accept a fractional value in a decimal column', () => {
      expect(diffCsv('Sales\n100.5', [column('Sales', 'DECIMAL_NUMBER')]).conflicts).toEqual([]);
    });

    it('should accept a formatted currency value rather than calling it non-numeric', () => {
      // zoho parses these using the import separator config, so flagging them would be a false alarm
      expect(diffCsv('Total\n"$1,200.50"', [column('Total', 'CURRENCY')]).conflicts).toEqual([]);
    });

    it('should accept a percent sign in a percent column', () => {
      expect(diffCsv('Rate\n12%', [column('Rate', 'PERCENT')]).conflicts).toEqual([]);
    });

    it('should report a negative value in a positive-number column', () => {
      const diff = diffCsv('Count\n-5', [column('Count', 'POSITIVE_NUMBER')]);
      expect(diff.conflicts[0].reason).toBe('negative');
    });

    it('should report a value that is not a date', () => {
      const diff = diffCsv('OrderDate\n2024-01-15\nsoon', [column('OrderDate', 'DATE')]);
      expect(diff.conflicts).toEqual([{ columnName: 'OrderDate', dataType: 'DATE', reason: 'notADate', conflictCount: 1, samples: [{ row: 2, value: 'soon' }] }]);
    });

    it('should accept a day-first or dot-separated date rather than calling it unparseable', () => {
      // Date.parse rejects these, but zoho accepts them with a dateFormat, so they are not conflicts
      expect(diffCsv('OrderDate\n15/01/2024\n2024.01.15', [column('OrderDate', 'DATE')]).conflicts).toEqual([]);
    });

    it('should report a value that is not a boolean', () => {
      const diff = diffCsv('Active\ntrue\nmaybe', [column('Active', 'BOOLEAN')]);
      expect(diff.conflicts[0].reason).toBe('notABoolean');
    });

    it('should accept the common boolean spellings', () => {
      expect(diffCsv('Active\ntrue\nFALSE\nyes\nN\n1\n0', [column('Active', 'BOOLEAN')]).conflicts).toEqual([]);
    });

    it('should report a value that is not an email', () => {
      const diff = diffCsv('RepEmail\na@b.co\nnot-an-email', [column('RepEmail', 'EMAIL')]);
      expect(diff.conflicts[0].reason).toBe('notAnEmail');
    });

    it('should report a value that is not a url', () => {
      const diff = diffCsv('Site\nhttps://a.co\nwww.a.co\nnope', [column('Site', 'URL')]);
      expect(diff.conflicts).toEqual([{ columnName: 'Site', dataType: 'URL', reason: 'notAUrl', conflictCount: 1, samples: [{ row: 3, value: 'nope' }] }]);
    });

    it('should report a text value longer than the column max size', () => {
      const diff = diffCsv('Note\nabcdef', [column('Note', 'PLAIN', { columnMaxSize: 3 })]);
      expect(diff.conflicts[0].reason).toBe('tooLong');
    });

    it('should not apply the max size to a numeric column, whose size is not a character count', () => {
      expect(diffCsv('Sales\n1000000', [column('Sales', 'NUMBER', { columnMaxSize: 3 })]).conflicts).toEqual([]);
    });

    it('should report a blank value in a column that is not nullable and has no default', () => {
      const diff = diffCsv('Region,Sales\nEast,', [column('Region', 'PLAIN'), column('Sales', 'NUMBER', { isNullable: false })]);
      expect(diff.conflicts[0].reason).toBe('emptyInNonNullable');
    });

    it('should accept a blank value in a nullable column', () => {
      expect(diffCsv('Sales\n', [column('Sales', 'NUMBER', { isNullable: true })]).conflicts).toEqual([]);
    });

    it('should accept a blank value in a non-nullable column carrying a default', () => {
      expect(diffCsv('Sales\n', [column('Sales', 'NUMBER', { isNullable: false, defaultValue: '0' })]).conflicts).toEqual([]);
    });

    it('should not validate a column whose data type it does not recognize', () => {
      // ZohoAnalyticsColumnDataType is a suggested string, so an unfamiliar type is assumed valid
      expect(diffCsv('Place\nanything', [column('Place', 'SOMETHING_NEW')]).conflicts).toEqual([]);
    });

    it('should not validate a column with no declared data type', () => {
      expect(diffCsv('Place\nanything', [column('Place')]).conflicts).toEqual([]);
    });

    it('should report a column failing two different ways as two conflicts', () => {
      const diff = diffCsv('Count\n-5\nabc', [column('Count', 'POSITIVE_NUMBER')]);

      expect(diff.conflicts).toHaveLength(2);
      expect(diff.conflicts.map((x) => x.reason).sort()).toEqual(['negative', 'notANumber']);
    });

    it('should count every offending row while keeping only the sample limit', () => {
      const diff = diffCsv('Sales\na\nb\nc\nd\ne', [column('Sales', 'NUMBER')], { maxSamples: 2 });

      expect(diff.conflicts[0].conflictCount).toBe(5);
      expect(diff.conflicts[0].samples).toEqual([
        { row: 1, value: 'a' },
        { row: 2, value: 'b' }
      ]);
    });

    it('should keep three samples by default', () => {
      const diff = diffCsv('Sales\na\nb\nc\nd', [column('Sales', 'NUMBER')]);
      expect(diff.conflicts[0].samples).toHaveLength(3);
    });
  });

  describe('json rows', () => {
    it('should type check a real number rather than only its text form', () => {
      const diff = zohoAnalyticsSchemaDiff({ columnNames: ['Sales'], rows: [{ Sales: 100.5 }], columns: [column('Sales', 'NUMBER')] });
      expect(diff.conflicts[0].reason).toBe('notAnInteger');
    });

    it('should treat a null value as blank rather than as the text "null"', () => {
      const diff = zohoAnalyticsSchemaDiff({ columnNames: ['Sales'], rows: [{ Sales: null }], columns: [column('Sales', 'NUMBER', { isNullable: true })] });
      expect(diff.conflicts).toEqual([]);
    });

    it('should accept a real boolean in a boolean column', () => {
      const diff = zohoAnalyticsSchemaDiff({ columnNames: ['Active'], rows: [{ Active: true }], columns: [column('Active', 'BOOLEAN')] });
      expect(diff.conflicts).toEqual([]);
    });
  });

  describe('empty inputs', () => {
    it('should report every table column as empty for a file with no columns', () => {
      const diff = zohoAnalyticsSchemaDiff({ columnNames: [], rows: [], columns: [column('Region', 'PLAIN')] });

      expect(diff.emptyColumns.map((x) => x.columnName)).toEqual(['Region']);
      expect(diff.rowCount).toBe(0);
    });

    it('should report every file column as dropped when the table has none', () => {
      const diff = diffCsv('Region\nEast', []);
      expect(diff.droppedColumns).toEqual([{ columnName: 'Region', valueCount: 1 }]);
    });
  });
});

describe('isZohoAnalyticsSchemaDiffClean()', () => {
  it('should not count an omitted nullable column as drift by default', () => {
    // omitting a nullable column is what a partial append import looks like
    const diff = diffCsv('Region\nEast', [column('Region', 'PLAIN'), column('RepEmail', 'EMAIL', { isNullable: true })]);

    expect(diff.emptyColumns).toHaveLength(1);
    expect(isZohoAnalyticsSchemaDiffClean(diff)).toBe(true);
  });

  it('should count an omitted nullable column as drift under strict', () => {
    const diff = diffCsv('Region\nEast', [column('Region', 'PLAIN'), column('RepEmail', 'EMAIL', { isNullable: true })]);
    expect(isZohoAnalyticsSchemaDiffClean(diff, { strict: true })).toBe(false);
  });

  it('should count an omitted required column as drift even without strict', () => {
    const diff = diffCsv('Region\nEast', [column('Region', 'PLAIN'), column('Total', 'NUMBER', { isNullable: false })]);
    expect(isZohoAnalyticsSchemaDiffClean(diff)).toBe(false);
  });

  it('should count a type conflict as drift', () => {
    expect(isZohoAnalyticsSchemaDiffClean(diffCsv('Sales\nbad', [column('Sales', 'NUMBER')]))).toBe(false);
  });

  it('should be clean for an exact match with valid values', () => {
    expect(isZohoAnalyticsSchemaDiffClean(diffCsv('Sales\n100', [column('Sales', 'NUMBER')]), { strict: true })).toBe(true);
  });
});
