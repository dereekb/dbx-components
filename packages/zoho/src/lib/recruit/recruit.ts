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
 * Attachments module name
 */
export const ZOHO_RECRUIT_ATTACHMENTS_MODULE = 'Attachments';

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

export const ZOHO_RECRUIT_RECORD_ATTACHMENT_METADATA_ATTACH_TYPE_RESUME = 'Resume';

export interface ZohoRecruitRecordAttachmentMetadataAttachType extends ZohoRecruitReferenceData {
  name: typeof ZOHO_RECRUIT_RECORD_ATTACHMENT_METADATA_ATTACH_TYPE_RESUME | string;
}

/**
 * Record id for an attachment.
 */
export type ZohoRecruitAttachmentRecordId = ZohoRecruitRecordId;

/**
 * The size of the attachment in bytes, stored as a string.
 */
export type ZohoRecruitRecordAttachmentMetadataSize = string;

/**
 * Metadata for a record's attachment.
 */
export interface ZohoRecruitRecordAttachmentMetadata {
  /**
   * The type of attachment
   */
  $attach_type: ZohoRecruitRecordAttachmentMetadataAttachType;
  /**
   * Last time the attachment was modified
   */
  Modified_Time: ISO8601DateString;
  /**
   * The category of the attachment
   */
  Category: ZohoRecruitRecordAttachmentMetadataAttachType;
  /**
   * The name of the attachment
   */
  File_Name: string;
  /**
   * The size of the attachment in bytes, stored as a string.
   */
  Size: ZohoRecruitRecordAttachmentMetadataSize;
  /**
   * The time the attachment was created
   */
  Created_Time: ISO8601DateString;
  /**
   * The parent record id for this attachment
   */
  Parent_Id: ZohoRecruitRecordId;
  /**
   * Owner of the attachment
   */
  Attachment_Owner: ZohoRecruitUserReferenceData;
  /**
   * Internal file identifier for the attachment
   */
  $file_id: string;
  /**
   * Type marker (e.g., "Attachment")
   */
  $type: 'Attachment' | string;
  /**
   * Direct URL to the attachment, when available
   */
  Attachment_URL: string | null;
  /**
   * User who last modified this attachment
   */
  Modified_By: ZohoRecruitUserReferenceData;
  /**
   * Attachment record id
   */
  id: ZohoRecruitAttachmentRecordId;
  /**
   * User who created this attachment
   */
  Created_By: ZohoRecruitUserReferenceData;
  /**
   * Whether the attachment is editable
   */
  $editable: boolean;
  /**
   * Module this attachment belongs to (e.g., Candidates)
   */
  $se_module: ZohoRecruitModuleName;
  /**
   * Link URL when the attachment is a link
   */
  $link_url?: string | null;
  /**
   * Number of linked documents
   */
  $link_docs: number;
}

/**
 * Update details returned by the server for an updated record.
 *
 * @deprecated use ZohoRecruitChangeObjectDetails instead.
 */
export type ZohoRecruitRecordUpdateDetails = ZohoRecruitChangeObjectDetails;
