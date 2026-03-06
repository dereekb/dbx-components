import { type ZohoSearchRecordsCriteriaString, type ZohoSearchRecordsCriteriaTree, type ZohoSearchRecordsCriteriaFilterType, type ZohoSearchRecordsCriteriaEntry, zohoSearchRecordsCriteriaString, zohoSearchRecordsCriteriaStringForTree, zohoSearchRecordsCriteriaEntryToCriteriaString, escapeZohoFieldValueForCriteriaString, MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA } from '../shared/criteria';

/**
 * Can search up to 10 criteria at a time.
 *
 * https://www.zoho.com/crm/developer/docs/api/v8/search-records.html
 *
 * "You can search for a maximum of 10 criteria (with the same or different column) with equals and starts_with conditions."
 */
export const MAX_ZOHO_CRM_SEARCH_MODULE_RECORDS_CRITERIA = MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA;

/**
 * CRM-specific alias for a raw criteria query string.
 */
export type ZohoCrmSearchRecordsCriteriaString = ZohoSearchRecordsCriteriaString;

/**
 * Builds a criteria query string from an array of criteria entries joined by AND/OR.
 */
export const zohoCrmSearchRecordsCriteriaString = zohoSearchRecordsCriteriaString;

/**
 * Builds a criteria query string from a tree structure, supporting nested AND/OR groups.
 */
export const zohoCrmSearchRecordsCriteriaStringForTree = zohoSearchRecordsCriteriaStringForTree;

/**
 * CRM-specific alias for a criteria tree with nested filter groups.
 */
export type ZohoCrmSearchRecordsCriteriaTree<T = any> = ZohoSearchRecordsCriteriaTree<T>;

/**
 * Union of possible elements within a CRM criteria tree.
 */
export type ZohoCrmSearchRecordsCriteriaTreeElement<T = any> = ZohoCrmSearchRecordsCriteriaEntryArray<T> | ZohoCrmSearchRecordsCriteriaTree<T> | ZohoCrmSearchRecordsCriteriaString;

/**
 * CRM-specific alias for a criteria filter type (e.g. equals, starts_with).
 */
export type ZohoCrmSearchRecordsCriteriaFilterType = ZohoSearchRecordsCriteriaFilterType;

/**
 * CRM-specific alias for an array of criteria entries.
 */
export type ZohoCrmSearchRecordsCriteriaEntryArray<T = any> = ZohoCrmSearchRecordsCriteriaEntry<T>[];

/**
 * CRM-specific alias for a single criteria entry describing a field, operator, and value.
 */
export type ZohoCrmSearchRecordsCriteriaEntry<T = any> = ZohoSearchRecordsCriteriaEntry<T>;

/**
 * Escapes special characters in a field value so it can be safely embedded in a criteria string.
 */
export const escapeZohoCrmFieldValueForCriteriaString = escapeZohoFieldValueForCriteriaString;

/**
 * Converts a single criteria entry into its string representation (e.g. `(field:equals:value)`).
 */
export const zohoCrmSearchRecordsCriteriaEntryToCriteriaString = zohoSearchRecordsCriteriaEntryToCriteriaString;
