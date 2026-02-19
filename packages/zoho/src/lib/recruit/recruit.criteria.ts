import { type Maybe } from '@dereekb/util';
import { type ZohoSearchRecordsCriteriaString, type ZohoSearchRecordsCriteriaTree, type ZohoSearchRecordsCriteriaFilterType, type ZohoSearchRecordsCriteriaEntry, zohoSearchRecordsCriteriaString, zohoSearchRecordsCriteriaStringForTree, zohoSearchRecordsCriteriaEntryToCriteriaString, escapeZohoFieldValueForCriteriaString, MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA } from '../shared/criteria';

/**
 * Can search up to 10 criteria at a time.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/search-records.html
 *
 * "You can search for a maximum of 10 criteria (with the same or different column) with equals and starts_with conditions."
 */
export const MAX_ZOHO_RECRUIT_SEARCH_MODULE_RECORDS_CRITERIA = MAX_ZOHO_SEARCH_MODULE_RECORDS_CRITERIA;

export type ZohoRecruitSearchRecordsCriteriaString = ZohoSearchRecordsCriteriaString;

export const zohoRecruitSearchRecordsCriteriaString = zohoSearchRecordsCriteriaString;

export const zohoRecruitSearchRecordsCriteriaStringForTree = zohoSearchRecordsCriteriaStringForTree;

export interface ZohoRecruitSearchRecordsCriteriaTree<T = any> extends ZohoSearchRecordsCriteriaTree<T> {}

export type ZohoRecruitSearchRecordsCriteriaTreeElement<T = any> = ZohoRecruitSearchRecordsCriteriaEntryArray<T> | ZohoRecruitSearchRecordsCriteriaTree<T> | ZohoRecruitSearchRecordsCriteriaString;

export type ZohoRecruitSearchRecordsCriteriaFilterType = ZohoSearchRecordsCriteriaFilterType;

export type ZohoRecruitSearchRecordsCriteriaEntryArray<T = any> = ZohoRecruitSearchRecordsCriteriaEntry<T>[];

export interface ZohoRecruitSearchRecordsCriteriaEntry<T = any> extends ZohoSearchRecordsCriteriaEntry<T> {}

export const zohoRecruitSearchRecordsCriteriaEntryToCriteriaString = zohoSearchRecordsCriteriaEntryToCriteriaString;
