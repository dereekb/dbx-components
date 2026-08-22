import { Inject, Injectable } from '@nestjs/common';
import {
  type ZohoAnalytics,
  type ZohoAnalyticsContext,
  zohoAnalyticsFactory,
  zohoAnalyticsGetOrgs,
  zohoAnalyticsGetAllWorkspaces,
  zohoAnalyticsGetOwnedWorkspaces,
  zohoAnalyticsGetSharedWorkspaces,
  zohoAnalyticsGetWorkspaceDetails,
  zohoAnalyticsGetViews,
  zohoAnalyticsGetViewDetails,
  zohoAnalyticsGetTableMetadata,
  zohoAnalyticsImportDataInTable,
  zohoAnalyticsImportDataInNewTable,
  zohoAnalyticsCreateImportJobInTable,
  zohoAnalyticsCreateImportJobInNewTable,
  zohoAnalyticsGetImportJob,
  zohoAnalyticsImportDataInTableAndAwaitJob,
  zohoAnalyticsExportData,
  zohoAnalyticsCreateExportJob,
  zohoAnalyticsCreateExportJobForSqlQuery,
  zohoAnalyticsGetExportJob,
  zohoAnalyticsDownloadExport,
  zohoAnalyticsExportDataAndAwaitJob,
  zohoAnalyticsAddRow,
  zohoAnalyticsUpdateRows,
  zohoAnalyticsDeleteRows
} from '@dereekb/zoho';
import { ZohoAnalyticsServiceConfig } from './analytics.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';

/**
 * Injectable wrapper around the Zoho Analytics API.
 *
 * Each accessor is a configured pass-through to the corresponding `@dereekb/zoho` function, bound
 * to this instance's authenticated {@link ZohoAnalyticsContext}.
 */
@Injectable()
export class ZohoAnalyticsApi {
  readonly zohoAnalytics: ZohoAnalytics;

  /**
   * The authenticated context used by every Analytics operation.
   *
   * @returns The context carrying the configured fetch, config, and rate limiter.
   */
  get analyticsContext(): ZohoAnalyticsContext {
    return this.zohoAnalytics.analyticsContext;
  }

  /**
   * The shared rate limiter instance.
   *
   * @returns The rate limiter pacing requests against the Analytics frequency limit.
   */
  get zohoRateLimiter() {
    return this.zohoAnalytics.analyticsContext.zohoRateLimiter;
  }

  /**
   * Initializes the Analytics client by combining the service config with the accounts context for
   * OAuth token management.
   *
   * @param config - Zoho Analytics service configuration.
   * @param zohoAccountsApi - Accounts API used for OAuth token management.
   */
  constructor(
    @Inject(ZohoAnalyticsServiceConfig) readonly config: ZohoAnalyticsServiceConfig,
    @Inject(ZohoAccountsApi) readonly zohoAccountsApi: ZohoAccountsApi
  ) {
    this.zohoAnalytics = zohoAnalyticsFactory({
      ...config.factoryConfig,
      accountsContext: zohoAccountsApi.accountsContext
    })(config.zohoAnalytics);
  }

  // MARK: Organization Accessors
  /**
   * Configured pass-through for {@link zohoAnalyticsGetOrgs}.
   *
   * Lists the organizations available to the authenticated user. The only operation that works without a configured
   * `orgId`.
   *
   * @returns Bound get orgs function.
   */
  get getOrgs() {
    return zohoAnalyticsGetOrgs(this.analyticsContext);
  }

  // MARK: Workspace Accessors
  /**
   * Configured pass-through for {@link zohoAnalyticsGetAllWorkspaces}.
   *
   * Lists every accessible workspace, grouped into owned and shared.
   *
   * @returns Bound get all workspaces function.
   */
  get getAllWorkspaces() {
    return zohoAnalyticsGetAllWorkspaces(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetOwnedWorkspaces}.
   *
   * Lists the workspaces owned by the authenticated user.
   *
   * @returns Bound get owned workspaces function.
   */
  get getOwnedWorkspaces() {
    return zohoAnalyticsGetOwnedWorkspaces(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetSharedWorkspaces}.
   *
   * Lists the workspaces shared with the authenticated user.
   *
   * @returns Bound get shared workspaces function.
   */
  get getSharedWorkspaces() {
    return zohoAnalyticsGetSharedWorkspaces(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetWorkspaceDetails}.
   *
   * Retrieves a single workspace by id.
   *
   * @returns Bound get workspace details function.
   */
  get getWorkspaceDetails() {
    return zohoAnalyticsGetWorkspaceDetails(this.analyticsContext);
  }

  // MARK: View Accessors
  /**
   * Configured pass-through for {@link zohoAnalyticsGetViews}.
   *
   * Lists every view in a workspace.
   *
   * @returns Bound get views function.
   */
  get getViews() {
    return zohoAnalyticsGetViews(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetViewDetails}.
   *
   * Retrieves a single view by its globally unique id.
   *
   * @returns Bound get view details function.
   */
  get getViewDetails() {
    return zohoAnalyticsGetViewDetails(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetTableMetadata}.
   *
   * Retrieves a table's column metadata.
   *
   * @returns Bound get table metadata function.
   */
  get getTableMetadata() {
    return zohoAnalyticsGetTableMetadata(this.analyticsContext);
  }

  // MARK: Import Accessors
  /**
   * Configured pass-through for {@link zohoAnalyticsImportDataInTable}.
   *
   * Imports data into an existing table and waits for the result.
   *
   * @returns Bound import data in table function.
   */
  get importDataInTable() {
    return zohoAnalyticsImportDataInTable(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsImportDataInNewTable}.
   *
   * Creates a table from the imported data.
   *
   * @returns Bound import data in new table function.
   */
  get importDataInNewTable() {
    return zohoAnalyticsImportDataInNewTable(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsCreateImportJobInTable}.
   *
   * Queues an asynchronous import into an existing table.
   *
   * @returns Bound create import job in table function.
   */
  get createImportJobInTable() {
    return zohoAnalyticsCreateImportJobInTable(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsCreateImportJobInNewTable}.
   *
   * Queues an asynchronous import that creates a new table.
   *
   * @returns Bound create import job in new table function.
   */
  get createImportJobInNewTable() {
    return zohoAnalyticsCreateImportJobInNewTable(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetImportJob}.
   *
   * Retrieves an import job's status.
   *
   * @returns Bound get import job function.
   */
  get getImportJob() {
    return zohoAnalyticsGetImportJob(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsImportDataInTableAndAwaitJob}.
   *
   * Queues an asynchronous import and polls until the job reaches a terminal state.
   *
   * @returns Bound import data in table and await job function.
   */
  get importDataInTableAndAwaitJob() {
    return zohoAnalyticsImportDataInTableAndAwaitJob(this.analyticsContext);
  }

  // MARK: Export Accessors
  /**
   * Configured pass-through for {@link zohoAnalyticsExportData}.
   *
   * Exports a view's data, resolving with the raw response.
   *
   * @returns Bound export data function.
   */
  get exportData() {
    return zohoAnalyticsExportData(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsCreateExportJob}.
   *
   * Queues an asynchronous export of a view.
   *
   * @returns Bound create export job function.
   */
  get createExportJob() {
    return zohoAnalyticsCreateExportJob(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsCreateExportJobForSqlQuery}.
   *
   * Queues an asynchronous export of a SQL query's results.
   *
   * @returns Bound create export job for SQL query function.
   */
  get createExportJobForSqlQuery() {
    return zohoAnalyticsCreateExportJobForSqlQuery(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetExportJob}.
   *
   * Retrieves an export job's status.
   *
   * @returns Bound get export job function.
   */
  get getExportJob() {
    return zohoAnalyticsGetExportJob(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsDownloadExport}.
   *
   * Downloads the file produced by a completed export job.
   *
   * @returns Bound download export function.
   */
  get downloadExport() {
    return zohoAnalyticsDownloadExport(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsExportDataAndAwaitJob}.
   *
   * Queues an asynchronous export and polls until the job reaches a terminal state.
   *
   * @returns Bound export data and await job function.
   */
  get exportDataAndAwaitJob() {
    return zohoAnalyticsExportDataAndAwaitJob(this.analyticsContext);
  }

  // MARK: Row Accessors
  /**
   * Configured pass-through for {@link zohoAnalyticsAddRow}.
   *
   * Adds a single row to a table. Prefer an import for bulk data.
   *
   * @returns Bound add row function.
   */
  get addRow() {
    return zohoAnalyticsAddRow(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsUpdateRows}.
   *
   * Updates rows matching a criteria expression.
   *
   * @returns Bound update rows function.
   */
  get updateRows() {
    return zohoAnalyticsUpdateRows(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsDeleteRows}.
   *
   * Deletes rows matching a criteria expression.
   *
   * @returns Bound delete rows function.
   */
  get deleteRows() {
    return zohoAnalyticsDeleteRows(this.analyticsContext);
  }
}
