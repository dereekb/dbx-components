import { CommaSeparatedString, ISO8601DateString, PageNumber } from '@dereekb/util';

/**
 * Zoho Recruit module name.
 *
 * Example "Candidates"
 */
export type ZohoRecruitModuleName = string;

/**
 * Zoho Recruit record id
 *
 * Example "576214000000569001"
 */
export type ZohoRecruitRecordId = string;

/**
 * Zoho Recruit custom view id
 */
export type ZohoRecruitCustomViewId = string;

/**
 * Zoho Recruit territory id
 */
export type ZohoRecruitTerritoryId = string;

export type ZohoRecruitFieldName = string;

export type ZohoRecruitDraftOrSaveState = 'draft' | 'save';

/**
 * Comma separated list of field names
 */
export type ZohoRecruitCommaSeparateFieldNames = CommaSeparatedString;

export type ZohoRecruitTrueFalseBoth = 'true' | 'false' | 'both';

export interface ZohoRecruitCreatedByData {
  name: string;
  id: string; // TODO: figure out what kind of id this is
}

export type ZohoRecruitRecord = Record<ZohoRecruitFieldName, any> & {
  id: ZohoRecruitRecordId;
  Updated_On: ISO8601DateString;
  Created_By: ZohoRecruitCreatedByData;
};
