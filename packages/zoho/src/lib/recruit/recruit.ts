import { CommaSeparatedString, EmailAddress, ISO8601DateString, UniqueModelWithId, WebsiteUrl, isStandardInternetAccessibleWebsiteUrl } from '@dereekb/util';

// MARK: Data Types
/**
 * Zoho Recruit module name.
 *
 * Example "Candidates"
 */
export type ZohoRecruitModuleName = string;

/**
 * Candidates module name
 */
export const ZOHO_RECRUIT_CANDIDATES_MODULE = 'Candidates';

/**
 * Job Openings module name
 */
export const ZOHO_RECRUIT_JOB_OPENINGS_MODULE = 'Job_Openings';

/**
 * Notes module name
 */
export const ZOHO_RECRUIT_NOTES_MODULE = 'Notes';

/**
 * Emails module name
 */
export const ZOHO_RECRUIT_EMAILS_MODULE = 'Emails';

/**
 * Contains a reference to a module.
 */
export interface ZohoRecruitModuleNameRef {
  readonly module: ZohoRecruitModuleName;
}

/**
 * The API name of a function that is accessible via the Recruit REST API
 */
export type ZohoRecruitRestFunctionApiName = string;

/**
 * An identifier in Zoho Recruit.
 */
export type ZohoRecruitId = string;

/**
 * Identifier of a Candidate record in Zoho Recruit.
 */
export type ZohoRecruitCandidateId = string;

/**
 * Identifier of a Job Opening record in Zoho Recruit.
 */
export type ZohoRecruitJobOpeningId = string;

/**
 * Zoho Recruit record id
 *
 * Example "576214000000569001"
 */
export type ZohoRecruitRecordId = string;

/**
 * Zoho Recruit type id
 *
 * Example "576214000000820595"
 */
export type ZohoRecruitTypeId = string;

/**
 * Zoho Recruit user identifier.
 *
 * Users can be found in the Users and Controls section in settings.
 */
export type ZohoRecruitUserId = string;

/**
 * Zoho Recruit custom view id
 */
export type ZohoRecruitCustomViewId = string;

/**
 * Zoho Recruit territory id
 */
export type ZohoRecruitTerritoryId = string;

/**
 * The name of a field on a record.
 */
export type ZohoRecruitFieldName = string;

export type ZohoRecruitDraftOrSaveState = 'draft' | 'save';

/**
 * Comma separated list of field names
 */
export type ZohoRecruitCommaSeparateFieldNames = CommaSeparatedString;

export type ZohoRecruitTrueFalseBoth = 'true' | 'false' | 'both';

export interface ZohoRecruitReferenceData {
  name: string;
  id: ZohoRecruitId;
}

/**
 * Reference pair of a Zoho Recruit user name and id
 */
export interface ZohoRecruitUserReferenceData {
  name: string;
  id: ZohoRecruitUserId;
}

export interface ZohoRecruitReferenceDataWithModule extends ZohoRecruitReferenceData, ZohoRecruitModuleNameRef {}

export type ZohoRecruitCreatedByData = ZohoRecruitUserReferenceData;
export type ZohoRecruitCandidateOwner = ZohoRecruitUserReferenceData;

export interface ZohoRecruitModifiedByData extends ZohoRecruitReferenceData {
  zuid: ZohoRecruitId;
}

export type ZohoRecruitParentReferenceData = ZohoRecruitReferenceDataWithModule;

/**
 * Zoho Recruit only allows URLs that can be resolved via the internet (I.E. uses a normal tdl)
 *
 * The following are considered invalid:
 * - localhost:8080
 * - ht://dereekb.com
 */
export type ZohoRecruitValidUrl = WebsiteUrl;

/**
 * Update details returned by the server for a created/updated object.
 */
export interface ZohoRecruitChangeObjectDetails {
  id: ZohoRecruitRecordId;
  Modified_Time: ISO8601DateString;
  Modified_By: ZohoRecruitCreatedByData;
  Created_Time: ISO8601DateString;
  Created_By: ZohoRecruitCreatedByData;
}

// MARK: Zoho Recruit Record
/**
 * Base Zoho Recruit field data type.
 */
export interface ZohoRecruitRecordFieldsData {}

export interface ZohoRecordDraftStateData {
  /**
   * Used to update a draft record or to convert a draft to a normal record.
   *
   * When creating, passing "draft" will create the record as a draft.
   */
  $state?: ZohoRecruitDraftOrSaveState;
}

export type NewZohoRecruitRecordData<T = ZohoRecruitRecordFieldsData> = T & ZohoRecordDraftStateData;

/**
 * A ZohoRecruit record containing the corresponding record's id.
 */
export type UpdateZohoRecruitRecordData = UniqueModelWithId & ZohoRecruitRecordFieldsData & ZohoRecordDraftStateData;

/**
 * A ZohoRecruit record containing record details.
 */
export type ZohoRecruitRecord = UniqueModelWithId & ZohoRecruitRecordFieldsData;

/**
 * Returns true if it is a valid ZohoRecruitValidUrl.
 */
export const isZohoRecruitValidUrl: (input: WebsiteUrl) => input is ZohoRecruitValidUrl = isStandardInternetAccessibleWebsiteUrl;

/**
 * The posting title of a job opening.
 */
export type ZohoRecruitJobOpeningPostingTitle = string;

/**
 * The status of a candidate.
 */
export type ZohoRecruitCandidateStatus = string;

/**
 * Metadata for a record's email.
 */
export interface ZohoRecruitRecordEmailMetadata {
  /**
   * Whether or not an attachment is present.
   */
  attachment: boolean;
  /**
   * The subject of the email.
   */
  subject: string;
  /**
   * The email address the email was sent to.
   */
  to: EmailAddress;
  /**
   * The email address the email was sent from.
   */
  from: EmailAddress;
  /**
   * The date the email was sent.
   */
  sent_on: ISO8601DateString;
  /**
   * The status of the email.
   */
  status: ZohoRecruitRecordEmailMetadataStatus[];
}

export type ZohoRecruitRecordEmailMetadataStatusType = 'sent' | string;

export interface ZohoRecruitRecordEmailMetadataStatus {
  type: ZohoRecruitRecordEmailMetadataStatusType;
}

/**
 * Update details returned by the server for an updated record.
 *
 * @deprecated use ZohoRecruitChangeObjectDetails instead.
 */
export type ZohoRecruitRecordUpdateDetails = ZohoRecruitChangeObjectDetails;
