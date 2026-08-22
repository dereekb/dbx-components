import { type Maybe, unique } from '@dereekb/util';
import { type ZohoAnalyticsName, type ZohoAnalyticsRow } from './analytics';
import { type ZohoAnalyticsImportFileType } from './analytics.import';

/**
 * Byte order mark some tools prepend to a UTF-8 CSV export. Left in place it becomes part of the
 * first column's name, which then matches no column in the target table.
 */
const ZOHO_ANALYTICS_BOM_CODE_POINT = 0xfeff;

/**
 * Rows of import data alongside the column names the data declares.
 *
 * The column names are tracked separately from the rows because the two can disagree: a CSV header
 * can declare a column that no row populates, and JSON rows are free to omit keys. An import is
 * matched against the declared names, so a diff has to see them even when no row carries a value.
 */
export interface ZohoAnalyticsRowData {
  /**
   * Column names the data declares, in the order they appear.
   */
  readonly columnNames: ZohoAnalyticsName[];
  /**
   * The parsed rows.
   */
  readonly rows: ZohoAnalyticsRow[];
}

/**
 * Field delimiter of the CSV being read. Defaults to a comma.
 */
export type ZohoAnalyticsCsvDelimiter = string;

/**
 * Splits CSV text into rows of raw cell strings, following RFC 4180.
 *
 * Handles quoted cells carrying the delimiter, a newline, or an escaped `""` quote, and accepts
 * either `\n` or `\r\n` line endings. A leading byte order mark is dropped so it does not end up in
 * the first column's name.
 *
 * @param content - The CSV text to split.
 * @param delimiter - Field delimiter to split cells on.
 * @returns The rows, each as an array of unescaped cell strings.
 */
function csvCells(content: string, delimiter: ZohoAnalyticsCsvDelimiter): string[][] {
  const text = content.codePointAt(0) === ZOHO_ANALYTICS_BOM_CODE_POINT ? content.slice(1) : content;
  const rows: string[][] = [];

  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let pending = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          quoted = false;
          i += 1;
        }
      } else {
        cell += char;
        i += 1;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
      pending = true;
      i += 1;
    } else if (char === delimiter) {
      cells.push(cell);
      cell = '';
      pending = true;
      i += 1;
    } else if (char === '\n' || char === '\r') {
      cells.push(cell);
      rows.push(cells);
      cells = [];
      cell = '';
      pending = false;
      i += char === '\r' && text[i + 1] === '\n' ? 2 : 1;
    } else {
      cell += char;
      pending = true;
      i += 1;
    }
  }

  if (pending || cell !== '' || cells.length > 0) {
    cells.push(cell);
    rows.push(cells);
  }

  return rows;
}

/**
 * Reads CSV text into {@link ZohoAnalyticsRowData}, taking the first row as the header.
 *
 * Duplicate header names collapse into one column, matching what an import does: the later value
 * wins. Trailing cells beyond the header's width are dropped rather than given a synthetic name,
 * since an import has no column to put them in either.
 *
 * @param content - The CSV text to read.
 * @param delimiter - Field delimiter of the CSV. Defaults to a comma.
 * @returns The declared column names and parsed rows. Both are empty for blank content.
 */
export function zohoAnalyticsRowDataFromCsv(content: string, delimiter?: Maybe<ZohoAnalyticsCsvDelimiter>): ZohoAnalyticsRowData {
  const cells = csvCells(content, delimiter ?? ',');
  const [header, ...bodyCells] = cells;
  let result: ZohoAnalyticsRowData;

  if (header == null) {
    result = { columnNames: [], rows: [] };
  } else {
    const headerNames = header.map((x) => x.trim());
    const rows = bodyCells.map((rowCells) => {
      const row: Record<ZohoAnalyticsName, unknown> = {};
      headerNames.forEach((columnName, index) => {
        if (columnName !== '') {
          row[columnName] = rowCells[index] ?? '';
        }
      });
      return row;
    });

    result = { columnNames: unique(headerNames.filter((x) => x !== '')), rows };
  }

  return result;
}

/**
 * Reads JSON import text into {@link ZohoAnalyticsRowData}.
 *
 * Zoho Analytics expects a JSON import to be an array of row objects, so that is what this accepts;
 * a lone object is treated as a single row for convenience.
 *
 * The declared column names are the union of the rows' keys in first-seen order, since JSON rows are
 * free to omit keys and no separate header declares them.
 *
 * @param content - The JSON text to read.
 * @returns The declared column names and parsed rows.
 * @throws {Error} When the text is not valid JSON, or is neither an array of objects nor an object.
 */
export function zohoAnalyticsRowDataFromJson(content: string): ZohoAnalyticsRowData {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`zohoAnalyticsRowDataFromJson(): the content is not valid JSON. ${(e as Error).message}`, { cause: e });
  }

  const isRow = (value: unknown) => value != null && typeof value === 'object' && !Array.isArray(value);
  const candidates = Array.isArray(parsed) ? parsed : [parsed];

  if (!candidates.every(isRow)) {
    throw new Error('zohoAnalyticsRowDataFromJson(): the content must be an array of row objects, as a Zoho Analytics JSON import is.');
  }

  const rows = candidates as ZohoAnalyticsRow[];
  return { columnNames: unique(rows.flatMap((row) => Object.keys(row))), rows };
}

/**
 * Input for reading the contents of an import file into rows.
 */
export interface ZohoAnalyticsRowDataFromFileContentInput {
  /**
   * The file's text.
   */
  readonly content: string;
  /**
   * Format of the text.
   */
  readonly fileType: ZohoAnalyticsImportFileType;
  /**
   * Field delimiter, for a CSV. Defaults to a comma.
   */
  readonly delimiter?: Maybe<ZohoAnalyticsCsvDelimiter>;
}

/**
 * Reads the contents of an import file into {@link ZohoAnalyticsRowData}, dispatching on its format.
 *
 * @param input - The file's text and format.
 * @returns The declared column names and parsed rows.
 */
export function zohoAnalyticsRowDataFromFileContent(input: ZohoAnalyticsRowDataFromFileContentInput): ZohoAnalyticsRowData {
  const { content, fileType, delimiter } = input;
  return fileType === 'json' ? zohoAnalyticsRowDataFromJson(content) : zohoAnalyticsRowDataFromCsv(content, delimiter);
}
