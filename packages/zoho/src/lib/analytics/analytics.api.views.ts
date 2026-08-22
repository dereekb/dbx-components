import { type ZohoAnalyticsResponse, type ZohoAnalyticsViewId, type ZohoAnalyticsWorkspaceId } from './analytics';
import { type ZohoAnalyticsContext } from './analytics.config';
import { type ZohoAnalyticsColumn, type ZohoAnalyticsView, type ZohoAnalyticsViewDetails } from './analytics.view';
import { zohoAnalyticsApiFetchJsonInput } from './analytics.param';

/**
 * Input for listing the views of a workspace.
 */
export interface ZohoAnalyticsGetViewsInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
}

/**
 * Payload of a {@link ZohoAnalyticsGetViewsResponse}.
 */
export interface ZohoAnalyticsGetViewsResponseData {
  readonly views: ZohoAnalyticsView[];
}

/**
 * Response for `GET /workspaces/{workspaceId}/views`.
 */
export type ZohoAnalyticsGetViewsResponse = ZohoAnalyticsResponse<ZohoAnalyticsGetViewsResponseData>;

/**
 * Lists the views of a workspace.
 */
export type ZohoAnalyticsGetViewsFunction = (input: ZohoAnalyticsGetViewsInput) => Promise<ZohoAnalyticsGetViewsResponse>;

/**
 * Creates a {@link ZohoAnalyticsGetViewsFunction} bound to the given context.
 *
 * This endpoint is not paginated — Zoho's OpenAPI specification declares no parameters for it, so
 * the full set of views is always returned.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that lists every view in a workspace.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/get-views.html
 */
export function zohoAnalyticsGetViews(context: ZohoAnalyticsContext): ZohoAnalyticsGetViewsFunction {
  return (input: ZohoAnalyticsGetViewsInput) => context.fetchJson<ZohoAnalyticsGetViewsResponse>(`/workspaces/${input.workspaceId}/views`, zohoAnalyticsApiFetchJsonInput('GET'));
}

/**
 * Input for retrieving a single view's details.
 */
export interface ZohoAnalyticsGetViewDetailsInput {
  readonly viewId: ZohoAnalyticsViewId;
}

/**
 * Payload of a {@link ZohoAnalyticsGetViewDetailsResponse}.
 *
 * The key is plural but holds a single view object.
 */
export interface ZohoAnalyticsGetViewDetailsResponseData {
  readonly views: ZohoAnalyticsViewDetails;
}

/**
 * Response for `GET /views/{viewId}`.
 */
export type ZohoAnalyticsGetViewDetailsResponse = ZohoAnalyticsResponse<ZohoAnalyticsGetViewDetailsResponseData>;

/**
 * Retrieves the details of a single view.
 */
export type ZohoAnalyticsGetViewDetailsFunction = (input: ZohoAnalyticsGetViewDetailsInput) => Promise<ZohoAnalyticsGetViewDetailsResponse>;

/**
 * Creates a {@link ZohoAnalyticsGetViewDetailsFunction} bound to the given context.
 *
 * Unlike the view listing, this endpoint is not workspace-scoped: view ids are globally unique, so
 * the path is `/views/{viewId}` rather than `/workspaces/{workspaceId}/views/{viewId}`. It returns a
 * different field set than the listing rather than a superset — see {@link ZohoAnalyticsViewDetails}.
 * Both endpoints report `viewType` in the same mixed case (`'Table'`), verified live.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that retrieves a view by id.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/view-details.html
 */
export function zohoAnalyticsGetViewDetails(context: ZohoAnalyticsContext): ZohoAnalyticsGetViewDetailsFunction {
  return (input: ZohoAnalyticsGetViewDetailsInput) => context.fetchJson<ZohoAnalyticsGetViewDetailsResponse>(`/views/${input.viewId}`, zohoAnalyticsApiFetchJsonInput('GET'));
}

/**
 * Input for retrieving the column metadata of a table.
 */
export interface ZohoAnalyticsGetTableMetadataInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly viewId: ZohoAnalyticsViewId;
}

/**
 * Payload of a {@link ZohoAnalyticsGetTableMetadataResponse}.
 */
export interface ZohoAnalyticsGetTableMetadataResponseData {
  readonly columns: ZohoAnalyticsColumn[];
}

/**
 * Response for `GET /workspaces/{workspaceId}/views/{viewId}/metadata`.
 */
export type ZohoAnalyticsGetTableMetadataResponse = ZohoAnalyticsResponse<ZohoAnalyticsGetTableMetadataResponseData>;

/**
 * Retrieves the column metadata of a table.
 */
export type ZohoAnalyticsGetTableMetadataFunction = (input: ZohoAnalyticsGetTableMetadataInput) => Promise<ZohoAnalyticsGetTableMetadataResponse>;

/**
 * Creates a {@link ZohoAnalyticsGetTableMetadataFunction} bound to the given context.
 *
 * Use this before an import to confirm the target table's column names, since an import matches
 * incoming data to columns by name.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that retrieves a table's column metadata.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/get-table-metadata.html
 */
export function zohoAnalyticsGetTableMetadata(context: ZohoAnalyticsContext): ZohoAnalyticsGetTableMetadataFunction {
  return (input: ZohoAnalyticsGetTableMetadataInput) => context.fetchJson<ZohoAnalyticsGetTableMetadataResponse>(`/workspaces/${input.workspaceId}/views/${input.viewId}/metadata`, zohoAnalyticsApiFetchJsonInput('GET'));
}
