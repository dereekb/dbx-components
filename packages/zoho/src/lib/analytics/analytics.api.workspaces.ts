import { type ZohoAnalyticsResponse, type ZohoAnalyticsWorkspaceId } from './analytics';
import { type ZohoAnalyticsContext } from './analytics.config';
import { type ZohoAnalyticsWorkspace, type ZohoAnalyticsWorkspaceSummary } from './analytics.org';
import { zohoAnalyticsApiFetchJsonInput } from './analytics.param';

/**
 * Payload of a {@link ZohoAnalyticsGetAllWorkspacesResponse}.
 *
 * `GET /workspaces` splits its result into owned and shared workspaces, unlike the
 * `/workspaces/owned` and `/workspaces/shared` endpoints which each return a single
 * `workspaces` array.
 */
export interface ZohoAnalyticsGetAllWorkspacesResponseData {
  readonly ownedWorkspaces: ZohoAnalyticsWorkspaceSummary[];
  readonly sharedWorkspaces: ZohoAnalyticsWorkspaceSummary[];
}

/**
 * Response for `GET /workspaces`.
 */
export type ZohoAnalyticsGetAllWorkspacesResponse = ZohoAnalyticsResponse<ZohoAnalyticsGetAllWorkspacesResponseData>;

/**
 * Lists every workspace the authenticated user can access, grouped by ownership.
 */
export type ZohoAnalyticsGetAllWorkspacesFunction = () => Promise<ZohoAnalyticsGetAllWorkspacesResponse>;

/**
 * Creates a {@link ZohoAnalyticsGetAllWorkspacesFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that lists all accessible workspaces, grouped into owned and shared.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/all-workspace.html
 */
export function zohoAnalyticsGetAllWorkspaces(context: ZohoAnalyticsContext): ZohoAnalyticsGetAllWorkspacesFunction {
  return () => context.fetchJson<ZohoAnalyticsGetAllWorkspacesResponse>(`/workspaces`, zohoAnalyticsApiFetchJsonInput('GET'));
}

/**
 * Payload of a workspace listing that returns a single flat array.
 */
export interface ZohoAnalyticsGetWorkspacesResponseData {
  readonly workspaces: ZohoAnalyticsWorkspaceSummary[];
}

/**
 * Response for `GET /workspaces/owned` and `GET /workspaces/shared`.
 */
export type ZohoAnalyticsGetWorkspacesResponse = ZohoAnalyticsResponse<ZohoAnalyticsGetWorkspacesResponseData>;

/**
 * Lists a single category of workspaces.
 */
export type ZohoAnalyticsGetWorkspacesFunction = () => Promise<ZohoAnalyticsGetWorkspacesResponse>;

/**
 * Creates a {@link ZohoAnalyticsGetWorkspacesFunction} for the workspaces owned by the
 * authenticated user.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that lists the owned workspaces.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/owned-workspace.html
 */
export function zohoAnalyticsGetOwnedWorkspaces(context: ZohoAnalyticsContext): ZohoAnalyticsGetWorkspacesFunction {
  return () => context.fetchJson<ZohoAnalyticsGetWorkspacesResponse>(`/workspaces/owned`, zohoAnalyticsApiFetchJsonInput('GET'));
}

/**
 * Creates a {@link ZohoAnalyticsGetWorkspacesFunction} for the workspaces shared with the
 * authenticated user.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that lists the shared workspaces.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/shared-workspace.html
 */
export function zohoAnalyticsGetSharedWorkspaces(context: ZohoAnalyticsContext): ZohoAnalyticsGetWorkspacesFunction {
  return () => context.fetchJson<ZohoAnalyticsGetWorkspacesResponse>(`/workspaces/shared`, zohoAnalyticsApiFetchJsonInput('GET'));
}

/**
 * Input for retrieving a single workspace's details.
 */
export interface ZohoAnalyticsGetWorkspaceDetailsInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
}

/**
 * Payload of a {@link ZohoAnalyticsGetWorkspaceDetailsResponse}.
 *
 * The key is plural but holds a single workspace object.
 */
export interface ZohoAnalyticsGetWorkspaceDetailsResponseData {
  readonly workspaces: ZohoAnalyticsWorkspace;
}

/**
 * Response for `GET /workspaces/{workspaceId}`.
 */
export type ZohoAnalyticsGetWorkspaceDetailsResponse = ZohoAnalyticsResponse<ZohoAnalyticsGetWorkspaceDetailsResponseData>;

/**
 * Retrieves the details of a single workspace.
 */
export type ZohoAnalyticsGetWorkspaceDetailsFunction = (input: ZohoAnalyticsGetWorkspaceDetailsInput) => Promise<ZohoAnalyticsGetWorkspaceDetailsResponse>;

/**
 * Creates a {@link ZohoAnalyticsGetWorkspaceDetailsFunction} bound to the given context.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that retrieves a workspace by id.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/workspace-details.html
 */
export function zohoAnalyticsGetWorkspaceDetails(context: ZohoAnalyticsContext): ZohoAnalyticsGetWorkspaceDetailsFunction {
  return (input: ZohoAnalyticsGetWorkspaceDetailsInput) => context.fetchJson<ZohoAnalyticsGetWorkspaceDetailsResponse>(`/workspaces/${input.workspaceId}`, zohoAnalyticsApiFetchJsonInput('GET'));
}
