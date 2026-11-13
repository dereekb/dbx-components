import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { microsoftGraphFactory } from './graph.factory';
import { type MicrosoftGraphWorkbookWorksheet, findMicrosoftGraphWorkbookWorksheet, getWorkbookRange, listWorkbookWorksheets, microsoftGraphWorkbookRangePath, microsoftGraphWorkbookRowsToObjects, microsoftGraphWorkbookWorksheetsPath } from './graph.workbook.api';

function recordingGraph(answer: (request: Request) => Response) {
  const requests: Request[] = [];
  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request.clone());
    return answer(request);
  };

  const { graphContext } = microsoftGraphFactory({ fetchHandler })({ accessTokenGetter: () => 'token' });
  return { graphContext, requests };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

const SHEET_ID = '{00000000-0001-0000-0000-000000000000}';

describe('workbook addressing', () => {
  it('builds the worksheets path from an item id, a drive and a path', () => {
    expect(microsoftGraphWorkbookWorksheetsPath({ id: 'ITEM' })).toBe('/me/drive/items/ITEM/workbook/worksheets');
    expect(microsoftGraphWorkbookWorksheetsPath({ driveId: 'b!drive', id: 'ITEM' })).toBe('/drives/b!drive/items/ITEM/workbook/worksheets');
    expect(microsoftGraphWorkbookWorksheetsPath({ path: 'Reports/Q1 sheet.xlsx' })).toBe('/me/drive/root:/Reports/Q1%20sheet.xlsx:/workbook/worksheets');
  });

  it('reads the used range values-only by default and encodes the braced worksheet id', () => {
    // models: F-j live (2026-11-13): GET …/worksheets/%7B…%7D/usedRange(valuesOnly=true) on a SharePoint workbook
    expect(microsoftGraphWorkbookRangePath({ id: 'ITEM', sheet: SHEET_ID })).toBe('/me/drive/items/ITEM/workbook/worksheets/%7B00000000-0001-0000-0000-000000000000%7D/usedRange(valuesOnly=true)');
    expect(microsoftGraphWorkbookRangePath({ id: 'ITEM', sheet: 'Sheet 1', valuesOnly: false })).toBe('/me/drive/items/ITEM/workbook/worksheets/Sheet%201/usedRange(valuesOnly=false)');
  });

  it('reads an address as an OData string literal', () => {
    // models: F-j live (2026-11-13): range(address='A1:C3') → 3×3
    expect(microsoftGraphWorkbookRangePath({ id: 'ITEM', sheet: 'Sheet1', address: 'A1:C3' })).toBe("/me/drive/items/ITEM/workbook/worksheets/Sheet1/range(address='A1:C3')");
    expect(microsoftGraphWorkbookRangePath({ id: 'ITEM', sheet: 'Sheet1', address: '$A$1:$B$2' })).toBe("/me/drive/items/ITEM/workbook/worksheets/Sheet1/range(address='$A$1:$B$2')");
    expect(microsoftGraphWorkbookRangePath({ id: 'ITEM', sheet: 'Sheet1', address: "O'Neil A1" })).toBe("/me/drive/items/ITEM/workbook/worksheets/Sheet1/range(address='O''Neil%20A1')");
  });
});

describe('workbook reads', () => {
  it('lists worksheets and reads a range through the Graph client', async () => {
    const { graphContext, requests } = recordingGraph((request) => {
      // models: F-j live (2026-11-13): worksheet keys id/name/position/visibility; range keys address/rowCount/columnCount/values/…
      return request.url.includes('usedRange')
        ? jsonResponse({
            address: 'Sheet1!A1:B2',
            rowCount: 2,
            columnCount: 2,
            values: [
              ['Name', 'State'],
              ['Ada', 'CO']
            ]
          })
        : jsonResponse({ value: [{ id: SHEET_ID, name: 'Sheet1', position: 0, visibility: 'Visible' }] });
    });

    const sheets = await listWorkbookWorksheets(graphContext)({ driveId: 'b!drive', id: 'ITEM' });
    expect(sheets.value[0].name).toBe('Sheet1');

    const range = await getWorkbookRange(graphContext)({ driveId: 'b!drive', id: 'ITEM', sheet: SHEET_ID });
    expect(range.rowCount).toBe(2);
    expect(requests.map((x) => new URL(x.url).pathname)).toEqual(['/v1.0/drives/b!drive/items/ITEM/workbook/worksheets', '/v1.0/drives/b!drive/items/ITEM/workbook/worksheets/%7B00000000-0001-0000-0000-000000000000%7D/usedRange(valuesOnly=true)']);
  });

  it('refuses a read with neither an id nor a path', () => {
    const { graphContext } = recordingGraph(() => jsonResponse({}));
    expect(() => listWorkbookWorksheets(graphContext)({})).toThrow();
    expect(() => getWorkbookRange(graphContext)({ sheet: 'Sheet1' })).toThrow();
  });
});

describe('findMicrosoftGraphWorkbookWorksheet()', () => {
  const worksheets: MicrosoftGraphWorkbookWorksheet[] = [
    { id: '{B}', name: 'Texas', position: 1, visibility: 'Visible' },
    { id: '{A}', name: 'Colorado', position: 0, visibility: 'Visible' }
  ];

  it('picks the first sheet by position when none is named', () => {
    expect(findMicrosoftGraphWorkbookWorksheet(worksheets)?.name).toBe('Colorado');
  });

  it('matches a name case-insensitively, or an id', () => {
    expect(findMicrosoftGraphWorkbookWorksheet(worksheets, 'texas')?.id).toBe('{B}');
    expect(findMicrosoftGraphWorkbookWorksheet(worksheets, '{A}')?.name).toBe('Colorado');
    expect(findMicrosoftGraphWorkbookWorksheet(worksheets, 'Georgia')).toBeUndefined();
  });
});

describe('microsoftGraphWorkbookRowsToObjects()', () => {
  it('keys each row by the header row, naming blank headers and suffixing repeats', () => {
    const rows = [
      ['Name', '', 'Name'],
      ['Ada', 1, 'x'],
      ['Grace', 2, 'y']
    ];

    expect(microsoftGraphWorkbookRowsToObjects(rows)).toEqual([
      { Name: 'Ada', column_2: 1, Name_2: 'x' },
      { Name: 'Grace', column_2: 2, Name_2: 'y' }
    ]);
  });

  it('returns no rows for an empty range', () => {
    expect(microsoftGraphWorkbookRowsToObjects([])).toEqual([]);
  });
});
