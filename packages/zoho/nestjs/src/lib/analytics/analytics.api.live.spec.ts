import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { type DynamicModule, Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Getter, type Maybe, MS_IN_SECOND, cachedGetter } from '@dereekb/util';
import { expectFail, expectFailAssertErrorType, itShouldFail } from '@dereekb/util/test';
import { ZOHO_ANALYTICS_SUCCESS_STATUS, ZohoServerFetchResponseError, isZohoAnalyticsJobComplete, type ZohoAnalyticsName, type ZohoAnalyticsRow, type ZohoAnalyticsViewId, type ZohoAnalyticsView, type ZohoAnalyticsWorkspaceId } from '@dereekb/zoho';
import { appZohoAnalyticsModuleMetadata } from './analytics.module';
import { ZohoAnalyticsApi } from './analytics.api';
import { fileZohoAccountsAccessTokenCacheService, ZohoAccountsAccessTokenCacheService } from '../accounts/accounts.service';

/**
 * Treats the placeholder values shipped in the committed `.env` as "no credentials".
 *
 * The repo commits `ZOHO_API_URL=placeholder` and friends, so a bare presence check would never
 * skip on a machine that has only the committed defaults.
 *
 * @param value - Raw environment variable value.
 * @returns The value, or undefined when it is missing or a committed placeholder.
 */
function real(value: Maybe<string>): Maybe<string> {
  return value && value !== 'placeholder' ? value : undefined;
}

/**
 * Workspace this suite runs against. See `docs/analytics-testing.md` for how to create it.
 *
 * This MUST be a throwaway workspace: the suite truncates its test table on nearly every test.
 */
const TEST_WORKSPACE_ID: Maybe<ZohoAnalyticsWorkspaceId> = real(process.env['ZOHO_ANALYTICS_TEST_WORKSPACE_ID']);

/**
 * Org id and refresh token the Analytics module needs. Read here only to decide whether to run —
 * the module itself resolves them through the ConfigService.
 */
const TEST_ORG_ID = real(process.env['ZOHO_ANALYTICS_ORG_ID'] ?? process.env['ZOHO_ORG_ID']);
const TEST_REFRESH_TOKEN = real(process.env['ZOHO_ANALYTICS_ACCOUNTS_REFRESH_TOKEN'] ?? process.env['ZOHO_ACCOUNTS_REFRESH_TOKEN']);

/**
 * Whether the live suite has everything it needs. All three are required: without the org id every
 * endpoint but `GET /orgs` fails with 8083, and without a workspace id there is nothing to write to.
 */
const RUN_LIVE_TESTS = Boolean(TEST_WORKSPACE_ID && TEST_ORG_ID && TEST_REFRESH_TOKEN);

/**
 * Table this suite provisions inside the test workspace on first run and reuses afterwards.
 *
 * The name is also the SQL/criteria identifier, so it must stay free of spaces and quotes.
 */
const TEST_TABLE_NAME: ZohoAnalyticsName = 'DbxComponentsLiveTest';

/**
 * Rows the test table is reset to before each write test.
 *
 * Deliberately tiny — every import costs API units against the org's daily allowance, and the
 * assertions only need enough rows to tell "matched the criteria" from "hit everything".
 */
const BASELINE_ROWS: ZohoAnalyticsRow[] = [
  { Region: 'East', Rep: 'Ada', Amount: 100 },
  { Region: 'East', Rep: 'Grace', Amount: 200 },
  { Region: 'West', Rep: 'Alan', Amount: 300 }
];

const BASELINE_EAST_ROW_COUNT = 2;
const BASELINE_WEST_ROW_COUNT = 1;

/**
 * Criteria matching the single baseline West row.
 *
 * Zoho criteria are SQL-ish and quote the table and column: `"Table"."Column"='value'`.
 */
const WEST_ROW_CRITERIA = `"${TEST_TABLE_NAME}"."Region"='West'`;

/**
 * Wall-clock allowance for a live call. `zoho-nestjs` sets a 20s testTimeout, which is enough for a
 * single request but not for a token refresh followed by an import.
 */
const LIVE_TEST_TIMEOUT_MS = 60 * MS_IN_SECOND;

/**
 * Wall-clock allowance for a polled async job, which Zoho queues behind other jobs in the org.
 */
const LIVE_JOB_TEST_TIMEOUT_MS = 120 * MS_IN_SECOND;

/**
 * Poll settings for the async job tests. Tighter than the library default (150 polls) so a stuck
 * job fails the test instead of running out the suite's clock.
 */
const LIVE_JOB_POLL = { pollWait: 3 * MS_IN_SECOND, maxPolls: 30 };

/**
 * The JSON envelope of an export.
 *
 * Zoho's OpenAPI spec does not pin this — it declares every export as a file download regardless of
 * `responseFormat` — so the shape here is the one the live API returned: a single `data` array, with
 * every value stringified (a numeric column comes back as `'100'`, not `100`).
 */
interface ZohoAnalyticsExportedJson {
  readonly data: ZohoAnalyticsRow[];
}

const cacheService = fileZohoAccountsAccessTokenCacheService();

@Module(appZohoAnalyticsModuleMetadata({}))
export class TestZohoAnalyticsModule {}

/**
 * Reads the row array out of a JSON export response.
 *
 * @param response - Raw export response.
 * @returns The exported rows, or an empty array when the body carries none.
 */
async function readExportedRows(response: Response): Promise<ZohoAnalyticsRow[]> {
  const json = (await response.json()) as ZohoAnalyticsExportedJson;
  return json.data;
}

/**
 * Shape assertions against the LIVE Zoho Analytics v2 API.
 *
 * These exist because the client was written against Zoho's published OpenAPI spec rather than a
 * live account, and several response shapes in that spec are unusual enough to be worth confirming
 * against real payloads — single objects returned under plural keys, a `viewType` that changes case
 * between endpoints, partial import failures reported inside a 200, and row CRUD that sends its
 * CONFIG as a form body where the prose docs show a query string.
 *
 * Opt-in: skipped unless `ZOHO_ANALYTICS_TEST_WORKSPACE_ID`, `ZOHO_ANALYTICS_ORG_ID`, and an
 * Analytics refresh token are set. Note that nx caches test results and no env var is a hash input,
 * so pass `--skip-nx-cache` when toggling credentials on or off.
 *
 * The suite provisions its own {@link TEST_TABLE_NAME} table inside the configured workspace on
 * first run and reuses it afterwards, so the workspace itself only has to exist and be empty.
 */
describe.runIf(RUN_LIVE_TESTS)('analytics.api (live)', () => {
  const workspaceId = TEST_WORKSPACE_ID as ZohoAnalyticsWorkspaceId;

  let nest: TestingModule;
  let api: ZohoAnalyticsApi;
  let testViewId: ZohoAnalyticsViewId;

  /**
   * Finds the test table in the workspace, creating it from {@link BASELINE_ROWS} the first time.
   *
   * Cached so the lookup and any creation happen once for the whole file rather than per test.
   */
  const loadTestTable: Getter<Promise<ZohoAnalyticsView>> = cachedGetter(async () => {
    const { data } = await api.getViews({ workspaceId });
    const existing = data.views.find((view) => view.viewName === TEST_TABLE_NAME);
    let result: Maybe<ZohoAnalyticsView> = existing;

    if (!result) {
      const created = await api.importDataInNewTable({
        workspaceId,
        config: { tableName: TEST_TABLE_NAME, autoIdentify: true, onError: 'abort' },
        rows: BASELINE_ROWS
      });

      const refreshed = await api.getViews({ workspaceId });
      result = refreshed.data.views.find((view) => view.viewName === TEST_TABLE_NAME);

      if (!result) {
        throw new Error(`analytics.api (live): created table "${TEST_TABLE_NAME}" (viewId ${created.data.viewId}) was not returned by getViews().`);
      }
    }

    return result;
  });

  /**
   * Resets the test table to exactly {@link BASELINE_ROWS}, so each write test starts from a known
   * row set regardless of what the previous one left behind.
   *
   * @returns Promise that resolves once the table has been replaced.
   */
  async function resetTestTable(): Promise<void> {
    await api.importDataInTable({
      workspaceId,
      viewId: testViewId,
      config: { importType: 'truncateadd', autoIdentify: true, onError: 'abort' },
      rows: BASELINE_ROWS
    });
  }

  /**
   * Exports the current contents of the test table as rows.
   *
   * @returns The rows currently in the test table.
   */
  async function loadTestTableRows(): Promise<ZohoAnalyticsRow[]> {
    const response = await api.exportData({ workspaceId, viewId: testViewId, config: { responseFormat: 'json' } });
    return readExportedRows(response);
  }

  beforeAll(async () => {
    const providers = [
      {
        provide: ZohoAccountsAccessTokenCacheService,
        useValue: cacheService
      }
    ];

    const rootModule: DynamicModule = {
      module: TestZohoAnalyticsModule,
      providers,
      exports: providers,
      global: true
    };

    nest = await Test.createTestingModule({ imports: [rootModule] }).compile();
    api = nest.get(ZohoAnalyticsApi);

    const view = await loadTestTable();
    testViewId = view.viewId;
  }, LIVE_JOB_TEST_TIMEOUT_MS);

  afterAll(async () => {
    if (api != null && testViewId != null) {
      await resetTestTable();
    }
  }, LIVE_TEST_TIMEOUT_MS);

  // MARK: Metadata
  describe('orgs', () => {
    describe('getOrgs()', () => {
      it(
        'should return the configured org',
        async () => {
          const result = await api.getOrgs();

          expect(result.status).toBe(ZOHO_ANALYTICS_SUCCESS_STATUS);
          expect(Array.isArray(result.data.orgs)).toBe(true);
          expect(result.data.orgs.map((org) => org.orgId)).toContain(TEST_ORG_ID);
        },
        LIVE_TEST_TIMEOUT_MS
      );
    });
  });

  describe('workspaces', () => {
    describe('getAllWorkspaces()', () => {
      it(
        'should split the result into ownedWorkspaces and sharedWorkspaces, including the test workspace',
        async () => {
          const result = await api.getAllWorkspaces();
          const { ownedWorkspaces, sharedWorkspaces } = result.data;

          expect(Array.isArray(ownedWorkspaces)).toBe(true);
          expect(Array.isArray(sharedWorkspaces)).toBe(true);
          expect([...ownedWorkspaces, ...sharedWorkspaces].map((workspace) => workspace.workspaceId)).toContain(workspaceId);
        },
        LIVE_TEST_TIMEOUT_MS
      );
    });

    describe('getOwnedWorkspaces()', () => {
      it(
        'should return a flat workspaces array, unlike getAllWorkspaces()',
        async () => {
          const result = await api.getOwnedWorkspaces();

          expect(Array.isArray(result.data.workspaces)).toBe(true);
          expect(result.data.workspaces[0]?.workspaceName).toBeDefined();
        },
        LIVE_TEST_TIMEOUT_MS
      );
    });

    describe('getWorkspaceDetails()', () => {
      it(
        'should return a single workspace object under the plural workspaces key',
        async () => {
          const result = await api.getWorkspaceDetails({ workspaceId });

          expect(Array.isArray(result.data.workspaces)).toBe(false);
          expect(result.data.workspaces.workspaceId).toBe(workspaceId);
          expect(result.data.workspaces.workspaceName).toBeDefined();
        },
        LIVE_TEST_TIMEOUT_MS
      );
    });
  });

  describe('views', () => {
    describe('getViews()', () => {
      it(
        'should list the test table',
        async () => {
          const result = await api.getViews({ workspaceId });
          const view = result.data.views.find((x) => x.viewName === TEST_TABLE_NAME);

          expect(view).toBeDefined();
          expect(view?.viewId).toBe(testViewId);
          // mixed case, not the 'TABLE' the type's suggested literals once claimed
          expect(view?.viewType).toBe('Table');
        },
        LIVE_TEST_TIMEOUT_MS
      );
    });

    describe('getViewDetails()', () => {
      it(
        'should return a single view object under the plural views key',
        async () => {
          const result = await api.getViewDetails({ viewId: testViewId });

          expect(Array.isArray(result.data.views)).toBe(false);
          expect(result.data.views.viewId).toBe(testViewId);
          expect(result.data.views.viewName).toBe(TEST_TABLE_NAME);
          // same casing as the listing — the two endpoints do NOT disagree, they just return
          // different field sets
          expect(result.data.views.viewType).toBe('Table');
          expect(result.data.views.workspaceId).toBe(workspaceId);
        },
        LIVE_TEST_TIMEOUT_MS
      );
    });

    describe('getTableMetadata()', () => {
      it(
        'should return the columns the baseline rows created',
        async () => {
          const result = await api.getTableMetadata({ workspaceId, viewId: testViewId });
          const columnNames = result.data.columns.map((column) => column.columnName);

          expect(columnNames).toContain('Region');
          expect(columnNames).toContain('Rep');
          expect(columnNames).toContain('Amount');
        },
        LIVE_TEST_TIMEOUT_MS
      );
    });
  });

  // MARK: Import
  describe('import', () => {
    beforeEach(async () => {
      await resetTestTable();
    }, LIVE_TEST_TIMEOUT_MS);

    describe('importDataInTable()', () => {
      it(
        'should append rows without removing the existing ones',
        async () => {
          const result = await api.importDataInTable({
            workspaceId,
            viewId: testViewId,
            config: { importType: 'append', autoIdentify: true, onError: 'abort' },
            rows: [{ Region: 'North', Rep: 'Edsger', Amount: 400 }]
          });

          expect(result.status).toBe(ZOHO_ANALYTICS_SUCCESS_STATUS);
          expect(result.data.importSummary.successRowCount).toBe(1);

          const rows = await loadTestTableRows();
          expect(rows.length).toBe(BASELINE_ROWS.length + 1);
        },
        LIVE_TEST_TIMEOUT_MS
      );

      it(
        'should replace the whole table on truncateadd',
        async () => {
          const result = await api.importDataInTable({
            workspaceId,
            viewId: testViewId,
            config: { importType: 'truncateadd', autoIdentify: true, onError: 'abort' },
            rows: [{ Region: 'South', Rep: 'Barbara', Amount: 500 }]
          });

          expect(result.status).toBe(ZOHO_ANALYTICS_SUCCESS_STATUS);
          expect(result.data.importSummary.successRowCount).toBe(1);

          const rows = await loadTestTableRows();
          expect(rows.length).toBe(1);
        },
        LIVE_TEST_TIMEOUT_MS
      );

      it(
        'should report a dropped row inside a success response rather than throwing',
        async () => {
          const result = await api.importDataInTable({
            workspaceId,
            viewId: testViewId,
            config: { importType: 'append', autoIdentify: true, onError: 'skiprow' },
            rows: [
              { Region: 'North', Rep: 'Edsger', Amount: 400 },
              { Region: 'North', Rep: 'Broken', Amount: 'not-a-number' }
            ]
          });

          const { importSummary, importErrors } = result.data;
          const droppedRows = (importSummary.totalRowCount ?? 0) - (importSummary.successRowCount ?? 0);

          // a partial failure is a 200 with the loss described in the summary — the whole reason
          // callers cannot treat a resolved import as "everything landed".
          // importErrors is tested for CONTENT, not presence: Zoho returns '' when nothing failed,
          // so a presence check would pass on a clean import and assert nothing
          expect(result.status).toBe(ZOHO_ANALYTICS_SUCCESS_STATUS);
          expect(droppedRows > 0 || (importErrors?.length ?? 0) > 0).toBe(true);
        },
        LIVE_TEST_TIMEOUT_MS
      );
    });

    describe('importDataInTableAndAwaitJob()', () => {
      it(
        'should complete the queued job and carry the import summary in jobInfo',
        async () => {
          const result = await api.importDataInTableAndAwaitJob({
            workspaceId,
            viewId: testViewId,
            config: { importType: 'append', autoIdentify: true, onError: 'abort' },
            rows: [{ Region: 'North', Rep: 'Edsger', Amount: 400 }],
            poll: LIVE_JOB_POLL
          });

          expect(isZohoAnalyticsJobComplete(result.data.jobCode)).toBe(true);
          expect(result.data.jobInfo?.importSummary.successRowCount).toBe(1);

          const rows = await loadTestTableRows();
          expect(rows.length).toBe(BASELINE_ROWS.length + 1);
        },
        LIVE_JOB_TEST_TIMEOUT_MS
      );
    });
  });

  // MARK: Export
  describe('export', () => {
    beforeAll(async () => {
      await resetTestTable();
    }, LIVE_TEST_TIMEOUT_MS);

    describe('exportData()', () => {
      it(
        'should export every baseline row as json',
        async () => {
          const rows = await loadTestTableRows();

          expect(rows.length).toBe(BASELINE_ROWS.length);
          expect(rows[0]?.['Region']).toBeDefined();
        },
        LIVE_TEST_TIMEOUT_MS
      );

      it(
        'should export only the rows matching the criteria',
        async () => {
          const response = await api.exportData({ workspaceId, viewId: testViewId, config: { responseFormat: 'json', criteria: WEST_ROW_CRITERIA } });
          const rows = await readExportedRows(response);

          expect(rows.length).toBe(BASELINE_WEST_ROW_COUNT);
        },
        LIVE_TEST_TIMEOUT_MS
      );

      it(
        'should export csv with a header row',
        async () => {
          const response = await api.exportData({ workspaceId, viewId: testViewId, config: { responseFormat: 'csv', includeHeader: true } });
          const body = await response.text();
          const [header] = body.split('\n');

          expect(header).toContain('Region');
          expect(body.split('\n').filter((line) => line.trim().length > 0).length).toBe(BASELINE_ROWS.length + 1);
        },
        LIVE_TEST_TIMEOUT_MS
      );
    });

    describe('exportDataAndAwaitJob()', () => {
      it(
        'should complete the job and expose a downloadable export',
        async () => {
          const job = await api.exportDataAndAwaitJob({
            workspaceId,
            viewId: testViewId,
            config: { responseFormat: 'csv' },
            poll: LIVE_JOB_POLL
          });

          expect(isZohoAnalyticsJobComplete(job.data.jobCode)).toBe(true);

          const download = await api.downloadExport({ workspaceId, jobId: job.data.jobId });
          const body = await download.text();

          expect(download.ok).toBe(true);
          expect(body).toContain('Region');
        },
        LIVE_JOB_TEST_TIMEOUT_MS
      );
    });

    describe('createExportJobForSqlQuery()', () => {
      it(
        'should queue a job for a SQL query over the test table',
        async () => {
          const created = await api.createExportJobForSqlQuery({
            workspaceId,
            config: { responseFormat: 'json', sqlQuery: `SELECT "Region", "Amount" FROM "${TEST_TABLE_NAME}" WHERE "Region" = 'East'` }
          });

          expect(created.status).toBe(ZOHO_ANALYTICS_SUCCESS_STATUS);
          expect(created.data.jobId).toBeDefined();

          const job = await api.getExportJob({ workspaceId, jobId: created.data.jobId });
          expect(job.data.jobId).toBe(created.data.jobId);
        },
        LIVE_JOB_TEST_TIMEOUT_MS
      );
    });
  });

  // MARK: Rows
  describe('rows', () => {
    beforeEach(async () => {
      await resetTestTable();
    }, LIVE_TEST_TIMEOUT_MS);

    describe('addRow()', () => {
      it(
        'should add a single row and echo back the added columns',
        async () => {
          const result = await api.addRow({ workspaceId, viewId: testViewId, config: { columns: { Region: 'North', Rep: 'Edsger', Amount: 400 } } });

          expect(result.status).toBe(ZOHO_ANALYTICS_SUCCESS_STATUS);
          expect(result.data.addedColumns?.['Region']).toBe('North');
          // values echo back stringified, and invalidColumns is an empty object rather than absent
          expect(result.data.addedColumns?.['Amount']).toBe('400');
          expect(Object.keys(result.data.invalidColumns ?? {})).toEqual([]);

          const rows = await loadTestTableRows();
          expect(rows.length).toBe(BASELINE_ROWS.length + 1);
        },
        LIVE_TEST_TIMEOUT_MS
      );
    });

    describe('updateRows()', () => {
      it(
        'should update only the rows matching the criteria',
        async () => {
          const result = await api.updateRows({ workspaceId, viewId: testViewId, config: { columns: { Rep: 'Updated' }, criteria: WEST_ROW_CRITERIA } });

          expect(result.status).toBe(ZOHO_ANALYTICS_SUCCESS_STATUS);
          expect(result.data.updatedRows).toBe(BASELINE_WEST_ROW_COUNT);

          const rows = await loadTestTableRows();
          expect(rows.filter((row) => row['Rep'] === 'Updated').length).toBe(BASELINE_WEST_ROW_COUNT);
        },
        LIVE_TEST_TIMEOUT_MS
      );
    });

    describe('deleteRows()', () => {
      it(
        'should delete only the rows matching the criteria',
        async () => {
          const result = await api.deleteRows({ workspaceId, viewId: testViewId, config: { criteria: WEST_ROW_CRITERIA } });

          expect(result.status).toBe(ZOHO_ANALYTICS_SUCCESS_STATUS);
          expect(result.data.deletedRows).toBe(BASELINE_WEST_ROW_COUNT);

          const rows = await loadTestTableRows();
          expect(rows.length).toBe(BASELINE_EAST_ROW_COUNT);
        },
        LIVE_TEST_TIMEOUT_MS
      );
    });
  });

  // MARK: Errors
  describe('errors', () => {
    itShouldFail('with a ZohoServerFetchResponseError for an unknown workspace id', async () => {
      await expectFail(() => api.getViews({ workspaceId: '0000000000000000000' }), expectFailAssertErrorType(ZohoServerFetchResponseError));
    });
  });
});
