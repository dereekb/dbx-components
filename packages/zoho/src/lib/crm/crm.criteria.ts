import { type ZohoSearchRecordsCriteriaString, type ZohoSearchRecordsCriteriaTree, type ZohoSearchRecordsCriteriaFilterType, type ZohoSearchRecordsCriteriaEntry, zohoSearchRecordsCriteriaString, zohoSearchRecordsCriteriaStringForTree, zohoSearchRecordsCriteriaEntryToCriteriaString, escapeZohoFieldValueForCriteriaString, MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA } from '../shared/criteria';

/**
 * Can search up to 10 criteria at a time.
 *
 * https://www.zoho.com/crm/developer/docs/api/v8/search-records.html
 *
 * "You can search for a maximum of 10 criteria (with the same or different column) with equals and starts_with conditions."
 */
export const MAX_ZOHO_CRM_SEARCH_MODULE_RECORDS_CRITERIA = MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA;

export type ZohoCrmSearchRecordsCriteriaString = ZohoSearchRecordsCriteriaString;

export const zohoCrmSearchRecordsCriteriaString = zohoSearchRecordsCriteriaString;

export const zohoCrmSearchRecordsCriteriaStringForTree = zohoSearchRecordsCriteriaStringForTree;

export interface ZohoCrmSearchRecordsCriteriaTree<T = any> extends ZohoSearchRecordsCriteriaTree<T> {}

export type ZohoCrmSearchRecordsCriteriaTreeElement<T = any> = ZohoCrmSearchRecordsCriteriaEntryArray<T> | ZohoCrmSearchRecordsCriteriaTree<T> | ZohoCrmSearchRecordsCriteriaString;

export type ZohoCrmSearchRecordsCriteriaFilterType = ZohoSearchRecordsCriteriaFilterType;

export type ZohoCrmSearchRecordsCriteriaEntryArray<T = any> = ZohoCrmSearchRecordsCriteriaEntry<T>[];

export interface ZohoCrmSearchRecordsCriteriaEntry<T = any> extends ZohoSearchRecordsCriteriaEntry<T> {}

export const escapeZohoCrmFieldValueForCriteriaString = escapeZohoFieldValueForCriteriaString;

export const zohoCrmSearchRecordsCriteriaEntryToCriteriaString = zohoSearchRecordsCriteriaEntryToCriteriaString;
