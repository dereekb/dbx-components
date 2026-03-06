import { type ZohoSearchRecordsCriteriaString, type ZohoSearchRecordsCriteriaTree, type ZohoSearchRecordsCriteriaFilterType, type ZohoSearchRecordsCriteriaEntry, zohoSearchRecordsCriteriaString, zohoSearchRecordsCriteriaStringForTree, zohoSearchRecordsCriteriaEntryToCriteriaString, MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA } from '../shared/criteria';

/**
 * Can search up to 10 criteria at a time.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/search-records.html
 *
 * "You can search for a maximum of 10 criteria (with the same or different column) with equals and starts_with conditions."
 */
export const MAX_ZOHO_RECRUIT_SEARCH_MODULE_RECORDS_CRITERIA = MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA;

/**
 * Recruit-specific alias for a serialized search criteria string.
 */
export type ZohoRecruitSearchRecordsCriteriaString = ZohoSearchRecordsCriteriaString;

/**
 * Builds a Recruit search criteria string from an array of criteria entries.
 */
export const zohoRecruitSearchRecordsCriteriaString = zohoSearchRecordsCriteriaString;

/**
 * Builds a Recruit search criteria string from a criteria tree structure.
 */
export const zohoRecruitSearchRecordsCriteriaStringForTree = zohoSearchRecordsCriteriaStringForTree;

/**
 * Recruit-specific alias for a criteria tree, enabling nested AND/OR grouping of search conditions.
 */
export type ZohoRecruitSearchRecordsCriteriaTree<T = any> = ZohoSearchRecordsCriteriaTree<T>;

/**
 * Union of valid elements within a Recruit search criteria tree (entry arrays, nested trees, or raw criteria strings).
 */
export type ZohoRecruitSearchRecordsCriteriaTreeElement<T = any> = ZohoRecruitSearchRecordsCriteriaEntryArray<T> | ZohoRecruitSearchRecordsCriteriaTree<T> | ZohoRecruitSearchRecordsCriteriaString;

/**
 * Recruit-specific alias for a criteria filter type (e.g., 'equals', 'starts_with').
 */
export type ZohoRecruitSearchRecordsCriteriaFilterType = ZohoSearchRecordsCriteriaFilterType;

/**
 * Array of Recruit search criteria entries, typically combined with AND logic.
 */
export type ZohoRecruitSearchRecordsCriteriaEntryArray<T = any> = ZohoRecruitSearchRecordsCriteriaEntry<T>[];

/**
 * Recruit-specific alias for a single search criteria entry specifying field, filter type, and value.
 */
export type ZohoRecruitSearchRecordsCriteriaEntry<T = any> = ZohoSearchRecordsCriteriaEntry<T>;

/**
 * Serializes a single Recruit criteria entry into its string representation for use in API queries.
 */
export const zohoRecruitSearchRecordsCriteriaEntryToCriteriaString = zohoSearchRecordsCriteriaEntryToCriteriaString;
