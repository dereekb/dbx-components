import { type Maybe } from '@dereekb/util';
import { type ZohoAnalyticsResponse, type ZohoAnalyticsViewId, type ZohoAnalyticsWorkspaceId } from './analytics';
import { type ZohoAnalyticsContext } from './analytics.config';
import { zohoAnalyticsApiFetchJsonInput, zohoAnalyticsConfigQuerySuffix } from './analytics.param';

// MARK: Shared
/**
 * Response returned by a Modeling API delete.
 *
 * Zoho answers a successful delete with `204 No Content`, so there is no envelope to read and the
 * client resolves `null` rather than a {@link ZohoAnalyticsResponse}. The type stays a `Maybe` of the
 * envelope rather than `void` so a caller is not lied to if Zoho ever starts returning one, and so
 * the failure envelope Analytics sometimes returns with a 200 still flows through the interceptor.
 *
 * A resolved delete is therefore the whole result: there is no count, no id, and nothing to inspect.
 * Confirm a delete landed by listing the views again, not by reading this.
 */
export type ZohoAnalyticsModelingDeleteResponse = Maybe<ZohoAnalyticsResponse<unknown>>;

// MARK: Delete View
/**
 * Options for deleting a view.
 *
 * The one option widens the blast radius, so it follows the same rule as
 * `ZohoAnalyticsDeleteRowsConfig`'s `deleteAllRows`: it is never inferred. Left unset, a table that
 * other views are built on is refused rather than silently taking them with it.
 */
export interface ZohoAnalyticsDeleteViewConfig {
  /**
   * Also deletes every view derived from this one — the reports, dashboards and query tables built
   * on the table being deleted.
   *
   * Without it a table carrying dependents is rejected instead of deleted.
   */
  readonly deleteDependentViews?: boolean;
}

/**
 * Input for deleting a view.
 */
export interface ZohoAnalyticsDeleteViewInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
  readonly viewId: ZohoAnalyticsViewId;
  readonly config?: Maybe<ZohoAnalyticsDeleteViewConfig>;
}

/**
 * Response for `DELETE /workspaces/{workspaceId}/views/{viewId}`.
 */
export type ZohoAnalyticsDeleteViewResponse = ZohoAnalyticsModelingDeleteResponse;

/**
 * Deletes a view — a table, query table, report or dashboard.
 */
export type ZohoAnalyticsDeleteViewFunction = (input: ZohoAnalyticsDeleteViewInput) => Promise<ZohoAnalyticsDeleteViewResponse>;

/**
 * Creates a {@link ZohoAnalyticsDeleteViewFunction} bound to the given context.
 *
 * This is the inverse of `zohoAnalyticsImportDataInNewTable()`, and the only way to remove a table
 * the client created — without it a table can only be dropped by hand in the Analytics UI.
 *
 * **The deletion is irreversible.** Zoho has no undo and no recycle bin for a deleted view, so the
 * only recovery is recreating the table and re-importing its data. To empty a table while keeping
 * it, use `zohoAnalyticsDeleteRows()` or a `truncateadd` import instead.
 *
 * Unlike the other Modeling writes, the `CONFIG` goes in the QUERY STRING rather than a form body —
 * Zoho documents this endpoint under "query parameters", and the live API agrees.
 *
 * Requires the `ZohoAnalytics.modeling.delete` OAuth scope, which the broader
 * `ZohoAnalytics.modeling.create` grant does NOT imply: a token without it fails every delete with
 * error 8540 rather than with a permission error naming the view.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that deletes a view.
 *
 * @see https://www.zoho.com/analytics/api/v2/modeling-api/delete-view.html
 */
export function zohoAnalyticsDeleteView(context: ZohoAnalyticsContext): ZohoAnalyticsDeleteViewFunction {
  return (input: ZohoAnalyticsDeleteViewInput) => context.fetchJson<ZohoAnalyticsDeleteViewResponse>(`/workspaces/${input.workspaceId}/views/${input.viewId}${zohoAnalyticsConfigQuerySuffix(input.config)}`, zohoAnalyticsApiFetchJsonInput('DELETE'));
}

// MARK: Delete Workspace
/**
 * Input for deleting a workspace.
 */
export interface ZohoAnalyticsDeleteWorkspaceInput {
  readonly workspaceId: ZohoAnalyticsWorkspaceId;
}

/**
 * Response for `DELETE /workspaces/{workspaceId}`.
 */
export type ZohoAnalyticsDeleteWorkspaceResponse = ZohoAnalyticsModelingDeleteResponse;

/**
 * Deletes a workspace and everything in it.
 */
export type ZohoAnalyticsDeleteWorkspaceFunction = (input: ZohoAnalyticsDeleteWorkspaceInput) => Promise<ZohoAnalyticsDeleteWorkspaceResponse>;

/**
 * Creates a {@link ZohoAnalyticsDeleteWorkspaceFunction} bound to the given context.
 *
 * **This is the most destructive call in the client, and it is irreversible.** It removes the
 * workspace along with every table, report and dashboard inside it. The endpoint takes no `CONFIG`
 * at all, so there is no cascade flag to withhold — passing the id IS the whole request.
 *
 * That is also why this carries no `deleteAllRows`-style confirmation flag: unlike a row delete,
 * nothing here can be under-specified into a wider blast radius, so a required literal would be
 * ceremony rather than a guard. The real hazard is that the input is shaped exactly like
 * `zohoAnalyticsGetWorkspaceDetails()`'s, so a mistyped call site reads as a lookup — guard it at
 * the boundary that has no code review, which is why the `zoho-cli` command demands the workspace
 * id a second time via `--confirm`.
 *
 * Requires the `ZohoAnalytics.modeling.delete` OAuth scope; see {@link zohoAnalyticsDeleteView}.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that deletes a workspace.
 *
 * @see https://www.zoho.com/analytics/api/v2/modeling-api/delete-workspace.html
 */
export function zohoAnalyticsDeleteWorkspace(context: ZohoAnalyticsContext): ZohoAnalyticsDeleteWorkspaceFunction {
  return (input: ZohoAnalyticsDeleteWorkspaceInput) => context.fetchJson<ZohoAnalyticsDeleteWorkspaceResponse>(`/workspaces/${input.workspaceId}`, zohoAnalyticsApiFetchJsonInput('DELETE'));
}
