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
   * @returns Lists the organizations available to the authenticated user. The only operation that
   * works without a configured `orgId`.
   */
  get getOrgs() {
    return zohoAnalyticsGetOrgs(this.analyticsContext);
  }

  // MARK: Workspace Accessors
  /**
   * Configured pass-through for {@link zohoAnalyticsGetAllWorkspaces}.
   *
   * @returns Lists every accessible workspace, grouped into owned and shared.
   */
  get getAllWorkspaces() {
    return zohoAnalyticsGetAllWorkspaces(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetOwnedWorkspaces}.
   *
   * @returns Lists the workspaces owned by the authenticated user.
   */
  get getOwnedWorkspaces() {
    return zohoAnalyticsGetOwnedWorkspaces(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetSharedWorkspaces}.
   *
   * @returns Lists the workspaces shared with the authenticated user.
   */
  get getSharedWorkspaces() {
    return zohoAnalyticsGetSharedWorkspaces(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetWorkspaceDetails}.
   *
   * @returns Retrieves a single workspace by id.
   */
  get getWorkspaceDetails() {
    return zohoAnalyticsGetWorkspaceDetails(this.analyticsContext);
  }

  // MARK: View Accessors
  /**
   * Configured pass-through for {@link zohoAnalyticsGetViews}.
   *
   * @returns Lists every view in a workspace.
   */
  get getViews() {
    return zohoAnalyticsGetViews(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetViewDetails}.
   *
   * @returns Retrieves a single view by its globally unique id.
   */
  get getViewDetails() {
    return zohoAnalyticsGetViewDetails(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetTableMetadata}.
   *
   * @returns Retrieves a table's column metadata.
   */
  get getTableMetadata() {
    return zohoAnalyticsGetTableMetadata(this.analyticsContext);
  }

  // MARK: Import Accessors
  /**
   * Configured pass-through for {@link zohoAnalyticsImportDataInTable}.
   *
   * @returns Imports data into an existing table and waits for the result.
   */
  get importDataInTable() {
    return zohoAnalyticsImportDataInTable(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsImportDataInNewTable}.
   *
   * @returns Creates a table from the imported data.
   */
  get importDataInNewTable() {
    return zohoAnalyticsImportDataInNewTable(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsCreateImportJobInTable}.
   *
   * @returns Queues an asynchronous import into an existing table.
   */
  get createImportJobInTable() {
    return zohoAnalyticsCreateImportJobInTable(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsCreateImportJobInNewTable}.
   *
   * @returns Queues an asynchronous import that creates a new table.
   */
  get createImportJobInNewTable() {
    return zohoAnalyticsCreateImportJobInNewTable(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetImportJob}.
   *
   * @returns Retrieves an import job's status.
   */
  get getImportJob() {
    return zohoAnalyticsGetImportJob(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsImportDataInTableAndAwaitJob}.
   *
   * @returns Queues an asynchronous import and polls until the job reaches a terminal state.
   */
  get importDataInTableAndAwaitJob() {
    return zohoAnalyticsImportDataInTableAndAwaitJob(this.analyticsContext);
  }

  // MARK: Export Accessors
  /**
   * Configured pass-through for {@link zohoAnalyticsExportData}.
   *
   * @returns Exports a view's data, resolving with the raw response.
   */
  get exportData() {
    return zohoAnalyticsExportData(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsCreateExportJob}.
   *
   * @returns Queues an asynchronous export of a view.
   */
  get createExportJob() {
    return zohoAnalyticsCreateExportJob(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsCreateExportJobForSqlQuery}.
   *
   * @returns Queues an asynchronous export of a SQL query's results.
   */
  get createExportJobForSqlQuery() {
    return zohoAnalyticsCreateExportJobForSqlQuery(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsGetExportJob}.
   *
   * @returns Retrieves an export job's status.
   */
  get getExportJob() {
    return zohoAnalyticsGetExportJob(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsDownloadExport}.
   *
   * @returns Downloads the file produced by a completed export job.
   */
  get downloadExport() {
    return zohoAnalyticsDownloadExport(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsExportDataAndAwaitJob}.
   *
   * @returns Queues an asynchronous export and polls until the job reaches a terminal state.
   */
  get exportDataAndAwaitJob() {
    return zohoAnalyticsExportDataAndAwaitJob(this.analyticsContext);
  }

  // MARK: Row Accessors
  /**
   * Configured pass-through for {@link zohoAnalyticsAddRow}.
   *
   * @returns Adds a single row to a table. Prefer an import for bulk data.
   */
  get addRow() {
    return zohoAnalyticsAddRow(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsUpdateRows}.
   *
   * @returns Updates rows matching a criteria expression.
   */
  get updateRows() {
    return zohoAnalyticsUpdateRows(this.analyticsContext);
  }

  /**
   * Configured pass-through for {@link zohoAnalyticsDeleteRows}.
   *
   * @returns Deletes rows matching a criteria expression.
   */
  get deleteRows() {
    return zohoAnalyticsDeleteRows(this.analyticsContext);
  }
}
