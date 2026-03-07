import { type ZohoSearchRecordsCriteriaString, type ZohoSearchRecordsCriteriaTree, type ZohoSearchRecordsCriteriaFilterType, type ZohoSearchRecordsCriteriaEntry, zohoSearchRecordsCriteriaString, zohoSearchRecordsCriteriaStringForTree, zohoSearchRecordsCriteriaEntryToCriteriaString, escapeZohoFieldValueForCriteriaString, MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA } from '../shared/criteria';

/**
 * Maximum number of criteria allowed per CRM search query (10).
 *
 * "You can search for a maximum of 10 criteria (with the same or different column) with equals and starts_with conditions."
 *
 * Re-exports {@link MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA}.
 *
 * @see https://www.zoho.com/crm/developer/docs/api/v8/search-records.html
 */
export const MAX_ZOHO_CRM_SEARCH_MODULE_RECORDS_CRITERIA = MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA;

/**
 * CRM-specific alias for {@link ZohoSearchRecordsCriteriaString}.
 *
 * Encoded criteria string used in CRM search API query parameters.
 * Format: `(field:filter:value)` entries joined by `and`/`or` operators.
 */
export type ZohoCrmSearchRecordsCriteriaString = ZohoSearchRecordsCriteriaString;

/**
 * CRM-specific re-export of {@link zohoSearchRecordsCriteriaString}.
 *
 * Compiles a criteria tree element (entry array, nested tree, or raw string) into a
 * URL-ready criteria string. Returns `undefined` when the input is nullish or empty.
 */
export const zohoCrmSearchRecordsCriteriaString = zohoSearchRecordsCriteriaString;

/**
 * CRM-specific re-export of {@link zohoSearchRecordsCriteriaStringForTree}.
 *
 * Compiles a {@link ZohoCrmSearchRecordsCriteriaTree} into a criteria string by
 * recursively resolving nested AND/OR groups.
 */
export const zohoCrmSearchRecordsCriteriaStringForTree = zohoSearchRecordsCriteriaStringForTree;

/**
 * CRM-specific alias for {@link ZohoSearchRecordsCriteriaTree}.
 *
 * Recursive tree structure for building complex search criteria with nested AND/OR groups.
 * If both `and` and `or` are provided at the same level, the OR group is merged into the AND group.
 */
export type ZohoCrmSearchRecordsCriteriaTree<T = any> = ZohoSearchRecordsCriteriaTree<T>;

/**
 * CRM-specific union of all valid input shapes for building a criteria string:
 * - {@link ZohoCrmSearchRecordsCriteriaEntryArray} — array of field/filter/value entries (AND-joined)
 * - {@link ZohoCrmSearchRecordsCriteriaTree} — nested AND/OR group structure
 * - {@link ZohoCrmSearchRecordsCriteriaString} — pre-compiled raw criteria string
 */
export type ZohoCrmSearchRecordsCriteriaTreeElement<T = any> = ZohoCrmSearchRecordsCriteriaEntryArray<T> | ZohoCrmSearchRecordsCriteriaTree<T> | ZohoCrmSearchRecordsCriteriaString;

/**
 * CRM-specific alias for {@link ZohoSearchRecordsCriteriaFilterType}.
 *
 * Available filter operators: `'starts_with'`, `'equals'`, `'contains'`.
 */
export type ZohoCrmSearchRecordsCriteriaFilterType = ZohoSearchRecordsCriteriaFilterType;

/**
 * Array of CRM criteria entries that are AND-joined when compiled to a criteria string.
 */
export type ZohoCrmSearchRecordsCriteriaEntryArray<T = any> = ZohoCrmSearchRecordsCriteriaEntry<T>[];

/**
 * CRM-specific alias for {@link ZohoSearchRecordsCriteriaEntry}.
 *
 * Single search criteria entry specifying a field name, filter operator, and match value.
 * The `field` is type-safe against the record type `T` when its keys are primitive.
 */
export type ZohoCrmSearchRecordsCriteriaEntry<T = any> = ZohoSearchRecordsCriteriaEntry<T>;

/**
 * CRM-specific re-export of {@link escapeZohoFieldValueForCriteriaString}.
 *
 * Escapes parentheses and commas in a field value for use in a criteria string.
 */
export const escapeZohoCrmFieldValueForCriteriaString = escapeZohoFieldValueForCriteriaString;

/**
 * CRM-specific re-export of {@link zohoSearchRecordsCriteriaEntryToCriteriaString}.
 *
 * Converts a single criteria entry into a parenthesized criteria string
 * in the format `(field:filter:escapedValue)`.
 */
export const zohoCrmSearchRecordsCriteriaEntryToCriteriaString = zohoSearchRecordsCriteriaEntryToCriteriaString;
