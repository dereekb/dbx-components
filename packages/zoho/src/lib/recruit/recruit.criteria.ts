/* eslint-disable @typescript-eslint/no-explicit-any -- generic defaults use any for maximum flexibility */
import { type ZohoSearchRecordsCriteriaString, type ZohoSearchRecordsCriteriaTree, type ZohoSearchRecordsCriteriaFilterType, type ZohoSearchRecordsCriteriaEntry, zohoSearchRecordsCriteriaString, zohoSearchRecordsCriteriaStringForTree, zohoSearchRecordsCriteriaEntryToCriteriaString, MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA } from '../shared/criteria';

/**
 * Maximum number of criteria allowed per Recruit search query (10).
 *
 * "You can search for a maximum of 10 criteria (with the same or different column) with equals and starts_with conditions."
 *
 * Re-exports {@link MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA}.
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/search-records.html
 */
export const MAX_ZOHO_RECRUIT_SEARCH_MODULE_RECORDS_CRITERIA = MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA;

/**
 * Recruit-specific alias for {@link ZohoSearchRecordsCriteriaString}.
 *
 * Encoded criteria string used in Recruit search API query parameters.
 * Format: `(field:filter:value)` entries joined by `and`/`or` operators.
 */
export type ZohoRecruitSearchRecordsCriteriaString = ZohoSearchRecordsCriteriaString;

/**
 * Recruit-specific re-export of {@link zohoSearchRecordsCriteriaString}.
 *
 * Compiles a criteria tree element (entry array, nested tree, or raw string) into a
 * URL-ready criteria string. Returns `undefined` when the input is nullish or empty.
 */
export const zohoRecruitSearchRecordsCriteriaString = zohoSearchRecordsCriteriaString;

/**
 * Recruit-specific re-export of {@link zohoSearchRecordsCriteriaStringForTree}.
 *
 * Compiles a {@link ZohoRecruitSearchRecordsCriteriaTree} into a criteria string by
 * recursively resolving nested AND/OR groups.
 */
export const zohoRecruitSearchRecordsCriteriaStringForTree = zohoSearchRecordsCriteriaStringForTree;

/**
 * Recruit-specific alias for {@link ZohoSearchRecordsCriteriaTree}.
 *
 * Recursive tree structure for building complex search criteria with nested AND/OR groups.
 * If both `and` and `or` are provided at the same level, the OR group is merged into the AND group.
 */
export type ZohoRecruitSearchRecordsCriteriaTree<T = any> = ZohoSearchRecordsCriteriaTree<T>;

/**
 * Recruit-specific union of all valid input shapes for building a criteria string:
 * - {@link ZohoRecruitSearchRecordsCriteriaEntryArray} — array of field/filter/value entries (AND-joined)
 * - {@link ZohoRecruitSearchRecordsCriteriaTree} — nested AND/OR group structure
 * - {@link ZohoRecruitSearchRecordsCriteriaString} — pre-compiled raw criteria string
 */
export type ZohoRecruitSearchRecordsCriteriaTreeElement<T = any> = ZohoRecruitSearchRecordsCriteriaEntryArray<T> | ZohoRecruitSearchRecordsCriteriaTree<T> | ZohoRecruitSearchRecordsCriteriaString;

/**
 * Recruit-specific alias for {@link ZohoSearchRecordsCriteriaFilterType}.
 *
 * Available filter operators: `'starts_with'`, `'equals'`, `'contains'`.
 */
export type ZohoRecruitSearchRecordsCriteriaFilterType = ZohoSearchRecordsCriteriaFilterType;

/**
 * Array of Recruit criteria entries that are AND-joined when compiled to a criteria string.
 */
export type ZohoRecruitSearchRecordsCriteriaEntryArray<T = any> = ZohoRecruitSearchRecordsCriteriaEntry<T>[];

/**
 * Recruit-specific alias for {@link ZohoSearchRecordsCriteriaEntry}.
 *
 * Single search criteria entry specifying a field name, filter operator, and match value.
 * The `field` is type-safe against the record type `T` when its keys are primitive.
 */
export type ZohoRecruitSearchRecordsCriteriaEntry<T = any> = ZohoSearchRecordsCriteriaEntry<T>;

/**
 * Recruit-specific re-export of {@link zohoSearchRecordsCriteriaEntryToCriteriaString}.
 *
 * Converts a single criteria entry into a parenthesized criteria string
 * in the format `(field:filter:escapedValue)`.
 */
export const zohoRecruitSearchRecordsCriteriaEntryToCriteriaString = zohoSearchRecordsCriteriaEntryToCriteriaString;
