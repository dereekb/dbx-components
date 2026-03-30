import { type EmailAddress, type FileSize, type HexColorCode, type PageNumber, type Pixels, type UnixDateTimeMillisecondsNumber } from '@dereekb/util';

// MARK: Data Types
/**
 * An identifier in Zoho Sign.
 */
export type ZohoSignId = string;

/**
 * Identifier of a request (envelope) in Zoho Sign.
 */
export type ZohoSignRequestId = string;

/**
 * Identifier of a document within a Zoho Sign request.
 */
export type ZohoSignDocumentId = string;

/**
 * Identifier of an action (recipient action) in Zoho Sign.
 */
export type ZohoSignActionId = string;

/**
 * Identifier of a folder in Zoho Sign.
 */
export type ZohoSignFolderId = string;

/**
 * Identifier of a request type (document category) in Zoho Sign.
 *
 * Also equivalent to ZohoSignTemplateId.
 *
 * @example '286906000001616000'
 */
export type ZohoSignRequestTypeId = string;

/**
 * Identifier of a template in Zoho Sign. Also equivalent to ZohoSignRequestTypeId.
 *
 * @example '286906000001616000'
 */
export type ZohoSignTemplateId = ZohoSignRequestTypeId;

/**
 * Identifier of a field type in Zoho Sign.
 */
export type ZohoSignFieldTypeId = string;

/**
 * Status of a Zoho Sign request.
 */
export type ZohoSignRequestStatus = 'inprogress' | 'completed' | 'recalled' | 'declined' | 'expired' | string;

/**
 * Recipient action type in Zoho Sign.
 */
export type ZohoSignActionType = 'SIGN' | 'VIEW' | 'INPERSONSIGN' | 'APPROVER';

/**
 * Verification type for a recipient.
 */
export type ZohoSignVerificationType = 'EMAIL' | 'SMS' | 'OFFLINE';

/**
 * Field type name for document fields.
 */
export type ZohoSignFieldTypeName = 'Checkbox' | 'Radiogroup' | 'Signature' | 'Initial' | 'Textfield' | 'Email' | 'Date' | 'Name' | 'Company' | 'Jobtitle' | 'CustomDate' | 'Dropdown' | 'Attachment' | 'Checkout' | string;

/**
 * Name format for name fields.
 */
export type ZohoSignNameFormat = 'FIRST_NAME' | 'LAST_NAME' | 'FULL_NAME';

/**
 * Field category classification.
 */
export type ZohoSignFieldCategory = 'textfield' | 'image' | 'datefield' | string;

// MARK: Field Type
/**
 * Definition of a field type available in Zoho Sign.
 */
export interface ZohoSignFieldType {
  readonly field_type_id: ZohoSignFieldTypeId;
  readonly field_type_name: ZohoSignFieldTypeName;
  readonly field_category: ZohoSignFieldCategory;
  readonly is_mandatory: boolean;
}

// MARK: Text Property
/**
 * Text styling properties for a field.
 */
export interface ZohoSignTextProperty {
  readonly font_size?: Pixels;
  readonly font_color?: HexColorCode;
  readonly font?: string;
  readonly is_italic?: boolean;
  readonly is_underline?: boolean;
  readonly is_bold?: boolean;
  readonly is_read_only?: boolean;
  readonly is_fixed_width?: boolean;
  readonly is_fixed_height?: boolean;
  readonly max_field_length?: number;
}

// MARK: Field Validation
/**
 * Validation settings for a field.
 */
export interface ZohoSignFieldValidation {
  readonly validation_type?: string;
  readonly validation_regex?: string;
  readonly validation_error_message?: string;
}

// MARK: Field
/**
 * A field placed on a document within a Zoho Sign request.
 */
export interface ZohoSignField {
  readonly field_name?: string;
  readonly field_id?: string;
  readonly field_label?: string;
  readonly field_type_name?: ZohoSignFieldTypeName;
  readonly document_id?: ZohoSignDocumentId;
  readonly action_id?: ZohoSignActionId;
  readonly is_mandatory?: boolean;
  readonly x_coord?: Pixels;
  readonly y_coord?: Pixels;
  readonly abs_width?: Pixels;
  readonly abs_height?: Pixels;
  readonly page_no?: PageNumber;
  readonly default_value?: string;
  readonly is_read_only?: boolean;
  readonly name_format?: ZohoSignNameFormat;
  readonly date_format?: string;
  readonly description_tooltip?: string;
  readonly text_property?: ZohoSignTextProperty;
  readonly validation?: ZohoSignFieldValidation;
}

// MARK: Action
/**
 * A recipient action within a Zoho Sign request.
 */
export interface ZohoSignAction {
  readonly action_id?: ZohoSignActionId;
  readonly action_type: ZohoSignActionType;
  readonly recipient_name: string;
  readonly recipient_email: EmailAddress;
  readonly signing_order?: number;
  readonly verify_recipient?: boolean;
  readonly verification_type?: ZohoSignVerificationType;
  readonly verification_code?: string;
  readonly private_notes?: string;
  readonly in_person_name?: string;
  readonly in_person_email?: EmailAddress;
  readonly fields?: ZohoSignActionFields;
}

/**
 * Fields grouped by type within an action.
 */
export interface ZohoSignActionFields {
  readonly check_boxes?: ZohoSignField[];
  readonly text_fields?: ZohoSignField[];
  readonly image_fields?: ZohoSignField[];
}

// MARK: Document
/**
 * A document within a Zoho Sign request.
 */
export interface ZohoSignDocument {
  readonly document_id: ZohoSignDocumentId;
  readonly document_name?: string;
  readonly document_size?: FileSize;
  readonly total_pages?: number;
  readonly document_order?: string;
}

// MARK: Request
/**
 * A Zoho Sign request (envelope) containing documents to be signed.
 */
export interface ZohoSignRequest {
  readonly request_id?: ZohoSignRequestId;
  readonly request_status?: ZohoSignRequestStatus;
  readonly request_name: string;
  readonly request_type_id?: ZohoSignRequestTypeId;
  readonly request_type_name?: string;
  readonly owner_id?: string;
  readonly owner_email?: EmailAddress;
  readonly owner_first_name?: string;
  readonly owner_last_name?: string;
  readonly description?: string;
  readonly notes?: string;
  readonly created_time?: UnixDateTimeMillisecondsNumber;
  readonly modified_time?: UnixDateTimeMillisecondsNumber;
  readonly action_time?: UnixDateTimeMillisecondsNumber;
  readonly sign_submitted_time?: UnixDateTimeMillisecondsNumber;
  readonly expire_by?: UnixDateTimeMillisecondsNumber;
  readonly expiration_days?: number;
  readonly sign_percentage?: number;
  readonly email_reminders?: boolean;
  readonly reminder_period?: number;
  readonly is_sequential?: boolean;
  readonly is_deleted?: boolean;
  readonly folder_id?: ZohoSignFolderId;
  readonly zsdocumentid?: string;
  readonly attachment_size?: number;
  readonly actions?: ZohoSignAction[];
  readonly document_ids?: ZohoSignDocument[];
  readonly document_fields?: ZohoSignDocumentFieldsEntry[];
  readonly templates_used?: unknown[];
  readonly attachments?: unknown[];
}

/**
 * Document fields entry associating document_id with its fields.
 */
export interface ZohoSignDocumentFieldsEntry {
  readonly document_id: ZohoSignDocumentId;
  readonly fields: ZohoSignField[];
}

// MARK: Form Data
/**
 * Form data returned for a completed request, containing field values.
 */
export interface ZohoSignDocumentFormData {
  readonly request_name: string;
  readonly zsdocumentid: string;
  readonly actions: ZohoSignFormDataAction[];
}

/**
 * Action within form data containing filled field values.
 */
export interface ZohoSignFormDataAction {
  readonly action_type: ZohoSignActionType;
  readonly signed_time?: string;
  readonly recipient_email: EmailAddress;
  readonly recipient_name: string;
  readonly fields: ZohoSignFormDataField[];
}

/**
 * A form data field with its label and filled value.
 */
export interface ZohoSignFormDataField {
  readonly field_label: string;
  readonly field_value: string;
}

// MARK: Request Input Data
/**
 * Input data for creating or updating a Zoho Sign request.
 */
export interface ZohoSignRequestData {
  readonly request_name: string;
  readonly is_sequential: boolean;
  readonly request_type_id?: ZohoSignRequestTypeId;
  readonly notes?: string;
  readonly expiration_days?: number;
  readonly email_reminders?: boolean;
  readonly reminder_period?: number;
  readonly folder_id?: ZohoSignFolderId;
  readonly actions: ZohoSignAction[];
}
