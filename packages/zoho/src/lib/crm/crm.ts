import { type CommaSeparatedString, type EmailAddress, type ISO8601DateString, type UniqueModelWithId, type WebsiteUrl, isStandardInternetAccessibleWebsiteUrl } from '@dereekb/util';

// MARK: Data Types
/**
 * Zoho CRM module name.
 *
 * Example "Leads"
 */
export type ZohoCrmModuleName = string;

/**
 * Leads module name
 */
export const ZOHO_CRM_LEADS_MODULE = 'Leads';

/**
 * Accounts module name
 */
export const ZOHO_CRM_ACCOUNTS_MODULE = 'Accounts';

/**
 * Contacts module name
 */
export const ZOHO_CRM_CONTACTS_MODULE = 'Contacts';

/**
 * Deals module name
 */
export const ZOHO_CRM_DEALS_MODULE = 'Deals';

/**
 * Campaigns module name
 */
export const ZOHO_CRM_CAMPAIGNS_MODULE = 'Campaigns';

/**
 * Tasks module name
 */
export const ZOHO_CRM_TASKS_MODULE = 'Tasks';

/**
 * Cases module name
 */
export const ZOHO_CRM_CASES_MODULE = 'Cases';

/**
 * Notes module name
 */
export const ZOHO_CRM_NOTES_MODULE = 'Notes';

/**
 * Emails module name
 */
export const ZOHO_CRM_EMAILS_MODULE = 'Emails';

/**
 * Attachments module name
 */
export const ZOHO_CRM_ATTACHMENTS_MODULE = 'Attachments';

/**
 * Contains a reference to a module.
 */
export interface ZohoCrmModuleNameRef {
  readonly module: ZohoCrmModuleName;
}

/**
 * The API name of a function that is accessible via the Crm REST API
 */
export type ZohoCrmRestFunctionApiName = string;

/**
 * An identifier in Zoho Crm.
 */
export type ZohoCrmId = string;

/**
 * Identifier of a Lead record in Zoho CRM.
 */
export type ZohoCrmLeadId = string;

/**
 * Identifier of an Account record in Zoho CRM.
 */
export type ZohoCrmAccountId = string;

/**
 * Identifier of a Contact record in Zoho CRM.
 */
export type ZohoCrmContactId = string;

/**
 * Identifier of a Deal record in Zoho CRM.
 */
export type ZohoCrmDealId = string;

/**
 * Identifier of a Campaign record in Zoho CRM.
 */
export type ZohoCrmCampaignId = string;

/**
 * Identifier of a Task record in Zoho CRM.
 */
export type ZohoCrmTaskId = string;

/**
 * Identifier of a Case record in Zoho CRM.
 */
export type ZohoCrmCaseId = string;

/**
 * Zoho Crm record id
 *
 * Example "576214000000569001"
 */
export type ZohoCrmRecordId = string;

/**
 * Zoho Crm type id
 *
 * Example "576214000000820595"
 */
export type ZohoCrmTypeId = string;

/**
 * Zoho Crm user identifier.
 *
 * Users can be found in the Users and Controls section in settings.
 */
export type ZohoCrmUserId = string;

/**
 * Zoho Crm custom view id
 */
export type ZohoCrmCustomViewId = string;

/**
 * Zoho Crm territory id
 */
export type ZohoCrmTerritoryId = string;

/**
 * The name of a field on a record.
 */
export type ZohoCrmFieldName = string;

export type ZohoCrmDraftOrSaveState = 'draft' | 'save';

/**
 * Comma separated list of field names
 */
export type ZohoCrmCommaSeparateFieldNames = CommaSeparatedString;

export type ZohoCrmTrueFalseBoth = 'true' | 'false' | 'both';

export interface ZohoCrmReferenceData {
  name: string;
  id: ZohoCrmId;
}

/**
 * Reference pair of a Zoho Crm user name and id
 */
export interface ZohoCrmUserReferenceData {
  name: string;
  id: ZohoCrmUserId;
}

export interface ZohoCrmReferenceDataWithModule extends ZohoCrmReferenceData, ZohoCrmModuleNameRef {}

export type ZohoCrmCreatedByData = ZohoCrmUserReferenceData;
export type ZohoCrmRecordOwner = ZohoCrmUserReferenceData;

export interface ZohoCrmModifiedByData extends ZohoCrmReferenceData {
  zuid: ZohoCrmId;
}

export type ZohoCrmParentReferenceData = ZohoCrmReferenceDataWithModule;

/**
 * Zoho Crm only allows URLs that can be resolved via the internet (I.E. uses a normal tdl)
 *
 * The following are considered invalid:
 * - localhost:8080
 * - ht://dereekb.com
 */
export type ZohoCrmValidUrl = WebsiteUrl;

/**
 * Update details returned by the server for a created/updated object.
 */
export interface ZohoCrmChangeObjectDetails {
  id: ZohoCrmRecordId;
  Modified_Time: ISO8601DateString;
  Modified_By: ZohoCrmCreatedByData;
  Created_Time: ISO8601DateString;
  Created_By: ZohoCrmCreatedByData;
}

// MARK: Zoho Crm Record
/**
 * Base Zoho Crm field data type.
 */
export interface ZohoCrmRecordFieldsData {}

export interface ZohoCrmRecordDraftStateData {
  /**
   * Used to update a draft record or to convert a draft to a normal record.
   *
   * When creating, passing "draft" will create the record as a draft.
   */
  $state?: ZohoCrmDraftOrSaveState;
}

export type NewZohoCrmRecordData<T = ZohoCrmRecordFieldsData> = T & ZohoCrmRecordDraftStateData;

/**
 * A ZohoCrm record containing the corresponding record's id.
 */
export type UpdateZohoCrmRecordData = UniqueModelWithId & ZohoCrmRecordFieldsData & ZohoCrmRecordDraftStateData;

/**
 * A ZohoCrm record containing record details.
 */
export type ZohoCrmRecord = UniqueModelWithId & ZohoCrmRecordFieldsData;

/**
 * Returns true if it is a valid ZohoCrmValidUrl.
 */
export const isZohoCrmValidUrl: (input: WebsiteUrl) => input is ZohoCrmValidUrl = isStandardInternetAccessibleWebsiteUrl;

/**
 * The status of a record.
 */
export type ZohoCrmRecordStatus = string;

/**
 * Metadata for a record's email.
 */
export interface ZohoCrmRecordEmailMetadata {
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
  status: ZohoCrmRecordEmailMetadataStatus[];
}

export type ZohoCrmRecordEmailMetadataStatusType = 'sent' | string;

export interface ZohoCrmRecordEmailMetadataStatus {
  type: ZohoCrmRecordEmailMetadataStatusType;
}

export const ZOHO_CRM_RECORD_ATTACHMENT_METADATA_ATTACH_TYPE_RESUME = 'Resume';

export interface ZohoCrmRecordAttachmentMetadataAttachType extends ZohoCrmReferenceData {
  name: typeof ZOHO_CRM_RECORD_ATTACHMENT_METADATA_ATTACH_TYPE_RESUME | string;
}

/**
 * Record id for an attachment.
 */
export type ZohoCrmAttachmentRecordId = ZohoCrmRecordId;

/**
 * The size of the attachment in bytes, stored as a string.
 */
export type ZohoCrmRecordAttachmentMetadataSize = string;

/**
 * Attachment category id
 */
export type ZohoCrmAttachmentCategoryId = string;

/**
 * Known attachment category names
 */
export type KnownZohoCrmAttachmentCategoryName = 'Resume' | 'Offer' | 'Contracts' | 'Criminal records' | 'Mandatory reporter' | 'Teaching certification' | 'Health records' | 'Others' | 'Cover Letter' | 'Formatted Resume';

/**
 * Attachment category name
 *
 * I.E. "Resume"
 */
export type ZohoCrmAttachmentCategoryName = KnownZohoCrmAttachmentCategoryName | string;

/**
 * The type of attachment.
 *
 * "Attachment" - Download the attachment to retrieve the value.
 * "Link URL" - Use the Attachment_URL property to retrieve the value.
 */
export type ZohoCrmAttachmentType = 'Attachment' | 'Link URL';

/**
 * Metadata for a record's attachment.
 */
export interface ZohoCrmRecordAttachmentMetadata {
  /**
   * The type of attachment
   */
  $attach_type: ZohoCrmRecordAttachmentMetadataAttachType;
  /**
   * Last time the attachment was modified
   */
  Modified_Time: ISO8601DateString;
  /**
   * The category of the attachment
   */
  Category: ZohoCrmRecordAttachmentMetadataAttachType;
  /**
   * The name of the attachment
   */
  File_Name: string;
  /**
   * The size of the attachment in bytes, stored as a string.
   */
  Size: ZohoCrmRecordAttachmentMetadataSize;
  /**
   * The time the attachment was created
   */
  Created_Time: ISO8601DateString;
  /**
   * The parent record id for this attachment
   */
  Parent_Id: ZohoCrmRecordId;
  /**
   * Owner of the attachment
   */
  Attachment_Owner: ZohoCrmUserReferenceData;
  /**
   * Internal file identifier for the attachment
   */
  $file_id: string;
  /**
   * Type of attachment, and how to retrieve the value.
   */
  $type: ZohoCrmAttachmentType;
  /**
   * Direct URL to the attachment, when available
   */
  Attachment_URL: string | null;
  /**
   * User who last modified this attachment
   */
  Modified_By: ZohoCrmUserReferenceData;
  /**
   * Attachment record id
   */
  id: ZohoCrmAttachmentRecordId;
  /**
   * User who created this attachment
   */
  Created_By: ZohoCrmUserReferenceData;
  /**
   * Whether the attachment is editable
   */
  $editable: boolean;
  /**
   * Module this attachment belongs to (e.g., Leads)
   */
  $se_module: ZohoCrmModuleName;
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
 * @deprecated use ZohoCrmChangeObjectDetails instead.
 */
export type ZohoCrmRecordUpdateDetails = ZohoCrmChangeObjectDetails;
