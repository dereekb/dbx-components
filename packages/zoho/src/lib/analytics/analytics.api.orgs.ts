import { type ZohoAnalyticsResponse } from './analytics';
import { type ZohoAnalyticsContext } from './analytics.config';
import { type ZohoAnalyticsOrg } from './analytics.org';
import { zohoAnalyticsApiFetchJsonInput } from './analytics.param';

/**
 * Payload of a {@link ZohoAnalyticsGetOrgsResponse}.
 */
export interface ZohoAnalyticsGetOrgsResponseData {
  readonly orgs: ZohoAnalyticsOrg[];
}

/**
 * Response for `GET /orgs`.
 */
export type ZohoAnalyticsGetOrgsResponse = ZohoAnalyticsResponse<ZohoAnalyticsGetOrgsResponseData>;

/**
 * Lists the organizations the authenticated user belongs to.
 */
export type ZohoAnalyticsGetOrgsFunction = () => Promise<ZohoAnalyticsGetOrgsResponse>;

/**
 * Creates a {@link ZohoAnalyticsGetOrgsFunction} bound to the given context.
 *
 * This is the only Zoho Analytics endpoint that does not require the `ZANALYTICS-ORGID` header,
 * which makes it the bootstrap call used to discover the org id that every other endpoint needs.
 *
 * @param context - Authenticated Zoho Analytics context providing fetch and rate limiting.
 * @returns Function that lists the organizations available to the authenticated user.
 *
 * @see https://www.zoho.com/analytics/api/v2/metadata-api/get-org.html
 *
 * @example
 * ```ts
 * const getOrgs = zohoAnalyticsGetOrgs(context);
 * const { data } = await getOrgs();
 * const orgId = data.orgs.find((x) => x.isDefault)?.orgId;
 * ```
 */
export function zohoAnalyticsGetOrgs(context: ZohoAnalyticsContext): ZohoAnalyticsGetOrgsFunction {
  return () => context.fetchJson<ZohoAnalyticsGetOrgsResponse>(`/orgs`, zohoAnalyticsApiFetchJsonInput('GET'));
}
