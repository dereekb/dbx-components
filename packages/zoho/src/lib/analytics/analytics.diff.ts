import { type Maybe } from '@dereekb/util';
import { type ZohoAnalyticsName, type ZohoAnalyticsRow } from './analytics';
import { type ZohoAnalyticsColumn, type ZohoAnalyticsColumnDataType } from './analytics.view';
import { type ZohoAnalyticsRowData } from './analytics.data';

/**
 * Default number of offending values kept per conflict, so a column that is wrong in every row
 * reports a usable example rather than a copy of the file.
 */
export const DEFAULT_ZOHO_ANALYTICS_SCHEMA_DIFF_MAX_SAMPLES = 3;

/**
 * Why an incoming value does not fit the column it was matched to.
 *
 * - `notANumber` the value is not numeric at all.
 * - `notAnInteger` the value is numeric but has a fractional part a whole-number column truncates.
 * - `negative` the value is negative in a column that only accepts positives.
 * - `notADate` the value is neither parseable as a date nor shaped like one.
 * - `notABoolean` the value is not one of the recognized true/false spellings.
 * - `notAnEmail` the value is not shaped like an email address.
 * - `notAUrl` the value is not shaped like a URL.
 * - `tooLong` the value is longer than the column's `columnMaxSize`.
 * - `emptyInNonNullable` the value is blank in a column that is not nullable and has no default.
 */
export type ZohoAnalyticsSchemaDiffConflictReason = 'notANumber' | 'notAnInteger' | 'negative' | 'notADate' | 'notABoolean' | 'notAnEmail' | 'notAUrl' | 'tooLong' | 'emptyInNonNullable';

/**
 * One offending value, kept as an example of a conflict.
 */
export interface ZohoAnalyticsSchemaDiffConflictSample {
  /**
   * 1-based position of the row within the data.
   *
   * A CSV header is not counted, so row 1 is the first row of values — one line lower in the file.
   */
  readonly row: number;
  /**
   * The offending value, as text.
   */
  readonly value: string;
}

/**
 * A matched column carrying values that do not fit its declared data type.
 *
 * Reported once per column and reason, so a column that is wrong in two different ways appears
 * twice rather than merging the counts.
 */
export interface ZohoAnalyticsSchemaDiffConflict {
  readonly columnName: ZohoAnalyticsName;
  readonly dataType: ZohoAnalyticsColumnDataType;
  readonly reason: ZohoAnalyticsSchemaDiffConflictReason;
  /**
   * How many rows hit this conflict, which can exceed the number of samples kept.
   */
  readonly conflictCount: number;
  readonly samples: ZohoAnalyticsSchemaDiffConflictSample[];
}

/**
 * A column the data declares that the target table does not have.
 *
 * An import matches data to columns by name, so nothing is written for these — the values are
 * silently discarded rather than reported as an error.
 */
export interface ZohoAnalyticsSchemaDiffDroppedColumn {
  readonly columnName: ZohoAnalyticsName;
  /**
   * How many rows carry a non-blank value for it, i.e. how much data the import would discard.
   */
  readonly valueCount: number;
}

/**
 * A column the target table has that the data does not declare.
 *
 * An `append` or `updateadd` import leaves these at their default; a `truncateadd` import blanks the
 * column across the whole table, since it deletes every existing row first.
 */
export interface ZohoAnalyticsSchemaDiffEmptyColumn {
  readonly columnName: ZohoAnalyticsName;
  readonly dataType?: ZohoAnalyticsColumnDataType;
  readonly isNullable?: boolean;
  /**
   * Whether omitting the column is expected to fail rather than just leave a gap: it is explicitly
   * not nullable and carries no default value.
   */
  readonly required: boolean;
}

/**
 * A column whose name matches a table column except for case or surrounding whitespace.
 *
 * Reported on its own rather than as a dropped column because whether Zoho matches these has not
 * been verified against the live API: if it does not, the data is discarded, and if it does, the
 * import succeeds. Either way the mismatch is worth fixing before finding out.
 */
export interface ZohoAnalyticsSchemaDiffCaseMismatch {
  readonly dataColumnName: ZohoAnalyticsName;
  readonly tableColumnName: ZohoAnalyticsName;
}

/**
 * The difference between a set of rows about to be imported and the table receiving them.
 *
 * Purely descriptive: every category is reported and none is weighted against another. Use
 * {@link isZohoAnalyticsSchemaDiffClean} to reduce it to a pass/fail verdict.
 */
export interface ZohoAnalyticsSchemaDiff {
  /**
   * Names matched exactly between the data and the table.
   */
  readonly matchedColumns: ZohoAnalyticsName[];
  readonly droppedColumns: ZohoAnalyticsSchemaDiffDroppedColumn[];
  readonly emptyColumns: ZohoAnalyticsSchemaDiffEmptyColumn[];
  readonly caseMismatchedColumns: ZohoAnalyticsSchemaDiffCaseMismatch[];
  readonly conflicts: ZohoAnalyticsSchemaDiffConflict[];
  /**
   * How many rows were compared.
   */
  readonly rowCount: number;
}

/**
 * Input for comparing rows against a table's columns.
 */
export interface ZohoAnalyticsSchemaDiffInput extends ZohoAnalyticsRowData {
  /**
   * The target table's column metadata, as returned by `getTableMetadata()`.
   */
  readonly columns: ZohoAnalyticsColumn[];
  /**
   * How many offending values to keep per conflict. Defaults to
   * {@link DEFAULT_ZOHO_ANALYTICS_SCHEMA_DIFF_MAX_SAMPLES}.
   */
  readonly maxSamples?: Maybe<number>;
}

/**
 * Characters stripped from a value before reading it as a number, so a formatted figure is not
 * mistaken for a non-numeric one.
 *
 * A `CURRENCY` or `PERCENT` column routinely receives values like `'$1,200.50'` or `'12%'`, which
 * Zoho parses using the import's separator config. Reporting those as conflicts would bury the real
 * ones.
 */
const ZOHO_ANALYTICS_NUMBER_FORMAT_CHARS_REGEX = /[\s,%$£€¥]/g;

/**
 * Values a boolean column accepts, lowercased.
 */
const ZOHO_ANALYTICS_BOOLEAN_VALUES = new Set(['true', 'false', 'yes', 'no', 'y', 'n', 't', 'f', '1', '0']);

/**
 * Matches a value made only of digits and date punctuation, e.g. `'15/01/2024'` or `'2024.01.15'`.
 *
 * `Date.parse()` rejects the day-first and dot-separated forms that Zoho accepts with a `dateFormat`,
 * so those are treated as plausible dates rather than conflicts. The point is to catch values that
 * are obviously not dates — `'n/a'`, `'soon'` — not to reimplement Zoho's date parsing.
 */
const ZOHO_ANALYTICS_DATE_SHAPED_REGEX = /^[\d\s/.:+-]+$/;

/**
 * Data types whose values are text, and so are bounded by `columnMaxSize`.
 */
const ZOHO_ANALYTICS_TEXT_DATA_TYPES = new Set<string>(['PLAIN', 'MULTI_LINE', 'EMAIL', 'URL']);

/**
 * Reads a value as the text an import would send for it.
 *
 * @param value - The value to read.
 * @returns The value as trimmed text; empty for null and undefined.
 */
function valueText(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

/**
 * Shape an email address is expected to take. Deliberately loose: the point is to catch a value that
 * is plainly not an address, not to adjudicate the grammar.
 */
const ZOHO_ANALYTICS_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Prefix that makes a value a URL to Zoho even though it carries no scheme.
 */
const ZOHO_ANALYTICS_SCHEMELESS_URL_REGEX = /^www\./i;

/**
 * Input for reading a numeric value against the bounds of its column.
 */
interface NumberConflictInput {
  readonly text: string;
  /**
   * Whether the column accepts a value below zero.
   */
  readonly allowNegative: boolean;
  /**
   * Whether the column keeps a fractional part rather than truncating it.
   */
  readonly allowFraction: boolean;
}

/**
 * Determines why a numeric value does not fit its column, if it does not.
 *
 * Separator and currency characters are stripped first, so a formatted figure is read as the number
 * Zoho would parse rather than reported as a non-numeric one.
 *
 * @param input - The value and the bounds of its column; see {@link NumberConflictInput}.
 * @returns The reason it does not fit, or undefined when it does.
 */
function numberConflictReason(input: NumberConflictInput): Maybe<ZohoAnalyticsSchemaDiffConflictReason> {
  const { text, allowNegative, allowFraction } = input;
  const value = Number(text.replaceAll(ZOHO_ANALYTICS_NUMBER_FORMAT_CHARS_REGEX, ''));
  let result: Maybe<ZohoAnalyticsSchemaDiffConflictReason>;

  if (!Number.isFinite(value)) {
    result = 'notANumber';
  } else if (!allowNegative && value < 0) {
    result = 'negative';
  } else if (!allowFraction && !Number.isInteger(value)) {
    result = 'notAnInteger';
  }

  return result;
}

/**
 * Reads a value against one column data type, keyed by the type's uppercased name.
 */
type ZohoAnalyticsColumnValueValidator = (text: string) => Maybe<ZohoAnalyticsSchemaDiffConflictReason>;

/**
 * Value check per column data type.
 *
 * A type absent from this map is not validated: {@link ZohoAnalyticsColumnDataType} is a suggested
 * string, so an unfamiliar type is assumed to be one Zoho accepts rather than treated as a conflict.
 */
const ZOHO_ANALYTICS_COLUMN_VALUE_VALIDATORS: Record<string, ZohoAnalyticsColumnValueValidator> = {
  NUMBER: (text) => numberConflictReason({ text, allowNegative: true, allowFraction: false }),
  AUTO_NUMBER: (text) => numberConflictReason({ text, allowNegative: true, allowFraction: false }),
  POSITIVE_NUMBER: (text) => numberConflictReason({ text, allowNegative: false, allowFraction: false }),
  DECIMAL_NUMBER: (text) => numberConflictReason({ text, allowNegative: true, allowFraction: true }),
  CURRENCY: (text) => numberConflictReason({ text, allowNegative: true, allowFraction: true }),
  PERCENT: (text) => numberConflictReason({ text, allowNegative: true, allowFraction: true }),
  DATE: (text) => (Number.isNaN(Date.parse(text)) && !ZOHO_ANALYTICS_DATE_SHAPED_REGEX.test(text) ? 'notADate' : undefined),
  BOOLEAN: (text) => (ZOHO_ANALYTICS_BOOLEAN_VALUES.has(text.toLowerCase()) ? undefined : 'notABoolean'),
  EMAIL: (text) => (ZOHO_ANALYTICS_EMAIL_REGEX.test(text) ? undefined : 'notAnEmail'),
  URL: (text) => (URL.canParse(text) || ZOHO_ANALYTICS_SCHEMELESS_URL_REGEX.test(text) ? undefined : 'notAUrl')
};

/**
 * Decides whether a value overruns its column's declared size.
 *
 * Only applied to text columns: `columnMaxSize` on a numeric column bounds its magnitude, not its
 * character count, so measuring the text against it would be wrong.
 *
 * @param text - The value as text.
 * @param column - The column it was matched to.
 * @param dataType - The column's uppercased data type, if it declared one.
 * @returns True when the value is too long for the column.
 */
function isValueTooLong(text: string, column: ZohoAnalyticsColumn, dataType: Maybe<string>): boolean {
  const bounded = dataType == null || ZOHO_ANALYTICS_TEXT_DATA_TYPES.has(dataType);
  return column.columnMaxSize != null && text.length > column.columnMaxSize && bounded;
}

/**
 * Determines why a value does not fit its column, if it does not.
 *
 * @param value - The incoming value.
 * @param column - The column it was matched to.
 * @returns The reason it does not fit, or undefined when it does.
 */
function conflictReason(value: unknown, column: ZohoAnalyticsColumn): Maybe<ZohoAnalyticsSchemaDiffConflictReason> {
  const text = valueText(value);
  const dataType = column.dataType?.toUpperCase();
  let result: Maybe<ZohoAnalyticsSchemaDiffConflictReason>;

  if (text === '') {
    result = column.isNullable === false && column.defaultValue == null ? 'emptyInNonNullable' : undefined;
  } else if (isValueTooLong(text, column, dataType)) {
    result = 'tooLong';
  } else {
    result = dataType == null ? undefined : ZOHO_ANALYTICS_COLUMN_VALUE_VALIDATORS[dataType]?.(text);
  }

  return result;
}

/**
 * Key used to group conflicts, so each column and reason pair is reported once.
 *
 * @param columnName - The column at fault.
 * @param reason - Why the value does not fit.
 * @returns The grouping key.
 */
function conflictKey(columnName: ZohoAnalyticsName, reason: ZohoAnalyticsSchemaDiffConflictReason): string {
  return `${columnName} ${reason}`;
}

/**
 * Compares rows about to be imported against the columns of the table receiving them.
 *
 * Answers the question an import cannot: what of this data has nowhere to land, what the table
 * expects that the data does not carry, and which values will not survive their column's type. An
 * import reports none of that up front — a name that matches no column is discarded silently, since
 * Zoho matches data to columns by name.
 *
 * Comparison is by exact name, with case-and-whitespace-only near misses split out into
 * {@link ZohoAnalyticsSchemaDiff.caseMismatchedColumns} rather than counted as dropped or empty.
 *
 * @param input - The rows, their declared column names, and the table's column metadata.
 * @returns The difference between the two.
 *
 * @example
 * ```ts
 * const { data } = await api.getTableMetadata({ workspaceId, viewId });
 * const diff = zohoAnalyticsSchemaDiff({ ...zohoAnalyticsRowDataFromCsv(csv), columns: data.columns });
 *
 * if (!isZohoAnalyticsSchemaDiffClean(diff)) {
 *   throw new Error(`${diff.droppedColumns.length} columns would be dropped.`);
 * }
 * ```
 */
export function zohoAnalyticsSchemaDiff(input: ZohoAnalyticsSchemaDiffInput): ZohoAnalyticsSchemaDiff {
  const { columns, columnNames, rows, maxSamples } = input;
  const sampleLimit = maxSamples ?? DEFAULT_ZOHO_ANALYTICS_SCHEMA_DIFF_MAX_SAMPLES;

  const columnsByName = new Map(columns.map((column) => [column.columnName, column]));
  const tableNamesByComparable = new Map(columns.map((column) => [column.columnName.trim().toLowerCase(), column.columnName]));
  const dataNames = new Set(columnNames);

  const matchedColumns: ZohoAnalyticsName[] = [];
  const droppedNames: ZohoAnalyticsName[] = [];
  const caseMismatchedColumns: ZohoAnalyticsSchemaDiffCaseMismatch[] = [];
  const caseMatchedTableNames = new Set<ZohoAnalyticsName>();

  columnNames.forEach((dataColumnName) => {
    const tableColumnName = tableNamesByComparable.get(dataColumnName.trim().toLowerCase());

    if (columnsByName.has(dataColumnName)) {
      matchedColumns.push(dataColumnName);
    } else if (tableColumnName == null) {
      droppedNames.push(dataColumnName);
    } else {
      caseMismatchedColumns.push({ dataColumnName, tableColumnName });
      caseMatchedTableNames.add(tableColumnName);
    }
  });

  const droppedColumns = droppedNames.map((columnName) => ({
    columnName,
    valueCount: rows.reduce((count, row) => (valueText(row[columnName]) === '' ? count : count + 1), 0)
  }));

  const emptyColumns = columns
    .filter((column) => !dataNames.has(column.columnName) && !caseMatchedTableNames.has(column.columnName))
    .map((column) => ({
      columnName: column.columnName,
      dataType: column.dataType,
      isNullable: column.isNullable,
      required: column.isNullable === false && column.defaultValue == null
    }));

  const conflictsByKey = new Map<string, { readonly conflict: ZohoAnalyticsSchemaDiffConflict; count: number; readonly samples: ZohoAnalyticsSchemaDiffConflictSample[] }>();

  rows.forEach((row: ZohoAnalyticsRow, rowIndex) => {
    matchedColumns.forEach((columnName) => {
      const column = columnsByName.get(columnName) as ZohoAnalyticsColumn;
      const reason = conflictReason(row[columnName], column);

      if (reason != null) {
        const key = conflictKey(columnName, reason);
        let entry = conflictsByKey.get(key);

        if (entry == null) {
          const samples: ZohoAnalyticsSchemaDiffConflictSample[] = [];
          entry = { conflict: { columnName, dataType: column.dataType as ZohoAnalyticsColumnDataType, reason, conflictCount: 0, samples }, count: 0, samples };
          conflictsByKey.set(key, entry);
        }

        entry.count += 1;

        if (entry.samples.length < sampleLimit) {
          entry.samples.push({ row: rowIndex + 1, value: valueText(row[columnName]) });
        }
      }
    });
  });

  const conflicts = Array.from(conflictsByKey.values()).map((entry) => ({ ...entry.conflict, conflictCount: entry.count }));

  return { matchedColumns, droppedColumns, emptyColumns, caseMismatchedColumns, conflicts, rowCount: rows.length };
}

/**
 * Options for reducing a {@link ZohoAnalyticsSchemaDiff} to a verdict.
 */
export interface IsZohoAnalyticsSchemaDiffCleanOptions {
  /**
   * Also treat a nullable column the data omits as drift.
   *
   * Off by default: omitting a nullable column is how a partial `append` import is supposed to look,
   * so counting it would make the common case fail. A column that is not nullable and has no default
   * counts as drift either way.
   */
  readonly strict?: Maybe<boolean>;
}

/**
 * Decides whether a diff found anything that would change or lose data on import.
 *
 * Drift is: a dropped column, a case-mismatched column, a value that does not fit its column, or an
 * omitted column the table requires. A nullable column the data omits is reported by the diff but is
 * not drift unless `strict` is set.
 *
 * @param diff - The diff to judge.
 * @param options - Whether to also count omitted nullable columns; see {@link IsZohoAnalyticsSchemaDiffCleanOptions}.
 * @returns True when the data can be imported without loss or surprise.
 */
export function isZohoAnalyticsSchemaDiffClean(diff: ZohoAnalyticsSchemaDiff, options?: Maybe<IsZohoAnalyticsSchemaDiffCleanOptions>): boolean {
  const blockingEmptyColumns = options?.strict ? diff.emptyColumns.length : diff.emptyColumns.filter((x) => x.required).length;
  return diff.droppedColumns.length === 0 && diff.caseMismatchedColumns.length === 0 && diff.conflicts.length === 0 && blockingEmptyColumns === 0;
}
