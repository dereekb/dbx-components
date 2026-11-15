import { type Maybe } from '@dereekb/util';
import { type MicrosoftGraphRequestInput, microsoftGraphRequest } from './graph.api';
import { type MicrosoftGraphContext } from './graph.config';
import { type MicrosoftGraphDriveItemRefInput, microsoftGraphDriveItemPath } from './graph.drive.api';
import { type MicrosoftGraphPage } from './graph.type';

/**
 * One worksheet of an Excel workbook.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/worksheet
 */
export interface MicrosoftGraphWorkbookWorksheet {
  /**
   * The worksheet id, e.g. `{00000000-0001-0000-0000-000000000000}`.
   */
  readonly id: string;
  readonly name: string;
  /**
   * Zero-based position of the worksheet in the workbook.
   */
  readonly position: number;
  /**
   * `Visible`, `Hidden` or `VeryHidden`.
   */
  readonly visibility: string;
}

/**
 * A cell value as Graph returns it: a string, number or boolean. An empty cell is an empty string.
 */
export type MicrosoftGraphWorkbookCellValue = string | number | boolean | null;

/**
 * A rectangular block of cells.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/range
 */
export interface MicrosoftGraphWorkbookRange {
  /**
   * The A1 address including the sheet, e.g. `Sheet1!A1:I359`.
   */
  readonly address: string;
  readonly addressLocal?: Maybe<string>;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly rowIndex?: Maybe<number>;
  readonly columnIndex?: Maybe<number>;
  readonly cellCount?: Maybe<number>;
  /**
   * The raw values, row by row.
   */
  readonly values: MicrosoftGraphWorkbookCellValue[][];
  /**
   * The displayed (formatted) text, row by row.
   */
  readonly text?: Maybe<string[][]>;
  readonly formulas?: Maybe<unknown[][]>;
  readonly numberFormat?: Maybe<unknown[][]>;
  readonly valueTypes?: Maybe<string[][]>;
}

/**
 * Returns the path of a workbook's worksheets collection.
 *
 * @param input - The drive and workbook item.
 * @returns The path, e.g. `/drives/{drive}/items/{id}/workbook/worksheets`.
 */
export function microsoftGraphWorkbookWorksheetsPath(input: MicrosoftGraphDriveItemRefInput): string {
  return microsoftGraphDriveItemPath(input, 'workbook/worksheets');
}

/**
 * Input for {@link microsoftGraphWorkbookRangePath}: the workbook, the worksheet, and which cells.
 */
export interface MicrosoftGraphWorkbookRangeInput extends MicrosoftGraphDriveItemRefInput {
  /**
   * The worksheet name or id.
   */
  readonly sheet: string;
  /**
   * An A1 address within the sheet, e.g. `A1:C50`. Omit for the sheet's used range.
   */
  readonly address?: Maybe<string>;
  /**
   * For the used range only: ignore cells that have formatting but no value. Defaults to true.
   */
  readonly valuesOnly?: Maybe<boolean>;
}

/**
 * Returns the path of a worksheet range: `range(address='…')` for an address, otherwise
 * `usedRange(valuesOnly=…)`.
 *
 * Worksheet ids carry braces, so the sheet segment is URL-encoded. The address is an OData string literal,
 * so a single quote is doubled.
 *
 * @param input - The workbook, worksheet and cells.
 * @returns The path.
 */
export function microsoftGraphWorkbookRangePath(input: MicrosoftGraphWorkbookRangeInput): string {
  const sheetPath = `${microsoftGraphWorkbookWorksheetsPath(input)}/${encodeURIComponent(input.sheet)}`;
  let result: string;

  if (input.address) {
    // A1 addresses keep their colon and dollar signs readable; anything else (a space) is encoded
    const address = encodeURIComponent(input.address.replaceAll("'", "''")).replaceAll('%3A', ':').replaceAll('%24', '$');
    result = `${sheetPath}/range(address='${address}')`;
  } else {
    result = `${sheetPath}/usedRange(valuesOnly=${input.valuesOnly ?? true})`;
  }

  return result;
}

/**
 * Builds the GET of a workbook's worksheets.
 *
 * @param input - The drive and workbook item.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/workbook-list-worksheets
 */
export function microsoftGraphListWorkbookWorksheetsRequest(input: MicrosoftGraphDriveItemRefInput): MicrosoftGraphRequestInput {
  return { method: 'GET', path: microsoftGraphWorkbookWorksheetsPath(input) };
}

/**
 * Builds the GET of a worksheet range.
 *
 * @param input - The workbook, worksheet and cells.
 * @returns The request.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/worksheet-usedrange
 * @see https://learn.microsoft.com/en-us/graph/api/worksheet-range
 */
export function microsoftGraphWorkbookRangeRequest(input: MicrosoftGraphWorkbookRangeInput): MicrosoftGraphRequestInput {
  return { method: 'GET', path: microsoftGraphWorkbookRangePath(input) };
}

/**
 * Lists the worksheets of an `.xlsx` in a drive. Requires `Files.Read` (or `.All`); a SharePoint library also
 * works with `Files.Read.All`.
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that loads the worksheets of one workbook.
 * @throws {Error} When neither an id nor a path is given.
 */
export function listWorkbookWorksheets(context: MicrosoftGraphContext): (input: MicrosoftGraphDriveItemRefInput) => Promise<MicrosoftGraphPage<MicrosoftGraphWorkbookWorksheet>> {
  const request = microsoftGraphRequest(context);

  return (input) => {
    if (!input.id && !input.path) {
      throw new Error('listWorkbookWorksheets requires an id or a path.');
    }

    return request(microsoftGraphListWorkbookWorksheetsRequest(input));
  };
}

/**
 * Reads a worksheet range: an address, or the sheet's used range. Requires `Files.Read` (or `.All`).
 *
 * @param context - Fetch function and access-token source each request is sent with.
 * @returns Function that loads one range.
 * @throws {Error} When neither an id nor a path is given.
 */
export function getWorkbookRange(context: MicrosoftGraphContext): (input: MicrosoftGraphWorkbookRangeInput) => Promise<MicrosoftGraphWorkbookRange> {
  const request = microsoftGraphRequest(context);

  return (input) => {
    if (!input.id && !input.path) {
      throw new Error('getWorkbookRange requires an id or a path.');
    }

    return request(microsoftGraphWorkbookRangeRequest(input));
  };
}

/**
 * Picks the worksheet a read targets: the one whose name (case-insensitive) or id matches, or the first by
 * position when no sheet is named.
 *
 * @param worksheets - The workbook's worksheets.
 * @param sheet - The worksheet name or id, if any.
 * @returns The worksheet, or undefined when none matches.
 */
export function findMicrosoftGraphWorkbookWorksheet(worksheets: readonly MicrosoftGraphWorkbookWorksheet[], sheet?: Maybe<string>): Maybe<MicrosoftGraphWorkbookWorksheet> {
  let result: Maybe<MicrosoftGraphWorkbookWorksheet>;

  if (sheet) {
    const lower = sheet.toLowerCase();
    result = worksheets.find((x) => x.id === sheet || x.name.toLowerCase() === lower);
  } else {
    result = [...worksheets].sort((a, b) => a.position - b.position)[0];
  }

  return result;
}

/**
 * Turns a range's rows into objects keyed by its first row. An empty header cell is keyed by its 1-based column
 * number (`column_3`), and a repeated header gets a numeric suffix (`Name_2`), so no value is dropped.
 *
 * @param rows - The range's rows (values or text); the first row is the header.
 * @returns One object per row after the header.
 */
export function microsoftGraphWorkbookRowsToObjects<T>(rows: readonly (readonly T[])[]): Record<string, T>[] {
  const [header, ...body] = rows;
  const seen = new Map<string, number>();

  const keys = (header ?? []).map((cell, index) => {
    const base = String(cell ?? '').trim() || `column_${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });

  return body.map((row) => {
    const record: Record<string, T> = {};
    keys.forEach((key, index) => {
      record[key] = row[index];
    });
    return record;
  });
}
