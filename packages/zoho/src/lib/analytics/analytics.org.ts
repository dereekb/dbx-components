import { type ZohoAnalyticsOrgId, type ZohoAnalyticsTimestampString } from './analytics';

/**
 * An organization in Zoho Analytics.
 *
 * The org id is required by the `ZANALYTICS-ORGID` header on every other endpoint, making
 * `GET /orgs` the bootstrap call for a newly configured client.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/get-org.html
 */
export interface ZohoAnalyticsOrg {
  readonly orgId: ZohoAnalyticsOrgId;
  readonly orgName: string;
  readonly orgDesc?: string;
  readonly createdBy?: string;
  readonly createdByZuId?: string;
  /**
   * Subscription plan name, e.g. `'Premium'`. Determines the daily API unit quota.
   */
  readonly planName?: string;
  readonly isDefault?: boolean;
  /**
   * Number of workspaces in the organization.
   *
   * Spelled with a lowercase `w` to match the field name the Zoho Analytics API returns.
   */
  readonly numberOfworkspaces?: number;
  /**
   * The authenticated user's role in the organization, e.g. `'Account Admin'`.
   */
  readonly role?: string;
}

/**
 * A workspace summary as returned by the workspace listing endpoints.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/all-workspace.html
 */
export interface ZohoAnalyticsWorkspaceSummary {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly workspaceDesc?: string;
  readonly orgId?: ZohoAnalyticsOrgId;
  readonly createdTime?: ZohoAnalyticsTimestampString;
  readonly createdBy?: string;
  readonly isDefault?: boolean;
}

/**
 * Full details of a single workspace.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/workspace-details.html
 */
export type ZohoAnalyticsWorkspace = ZohoAnalyticsWorkspaceSummary;
