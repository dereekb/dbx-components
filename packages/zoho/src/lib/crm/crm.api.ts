import { type ZohoDataArrayResultRef, type ZohoPageFilter, type ZohoPageResult, emptyZohoPageResult, zohoFetchPageFactory } from './../zoho.api.page';
import { type FetchFileResponse, type FetchJsonBody, type FetchJsonInput, type FetchPage, type FetchPageFactory, type FetchPageFactoryOptions, makeUrlSearchParams, parseFetchFileResponse } from '@dereekb/util/fetch';
import { type ZohoCrmConfigApiUrlInput, type ZohoCrmContext, zohoCrmConfigApiUrl } from './crm.config';
import {
  type ZohoCrmCommaSeparateFieldNames,
  type ZohoCrmCustomViewId,
  type ZohoCrmDraftOrSaveState,
  type ZohoCrmFieldName,
  type ZohoCrmModuleNameRef,
  type ZohoCrmChangeObjectDetails,
  type ZohoCrmRecord,
  type ZohoCrmRecordId,
  type ZohoCrmTerritoryId,
  type ZohoCrmTrueFalseBoth,
  type ZohoCrmRestFunctionApiName,
  type ZohoCrmUserId,
  type ZohoCrmModuleName,
  ZOHO_CRM_EMAILS_MODULE,
  type ZohoCrmRecordEmailMetadata,
  ZOHO_CRM_ATTACHMENTS_MODULE,
  type ZohoCrmRecordAttachmentMetadata,
  type ZohoCrmAttachmentRecordId,
  type ZohoCrmAttachmentCategoryId,
  type KnownZohoCrmAttachmentCategoryName
} from './crm';
import { zohoCrmSearchRecordsCriteriaString, type ZohoCrmSearchRecordsCriteriaTreeElement } from './crm.criteria';
import { type ArrayOrValue, type EmailAddress, type Maybe, type PhoneNumber, type SortingOrder, type UniqueModelWithId, type WebsiteUrlWithPrefix, asArray, joinStringsWithCommas } from '@dereekb/util';
import { assertZohoCrmRecordDataArrayResultHasContent, zohoCrmRecordCrudError } from './crm.error.api';
import { ZOHO_SUCCESS_STATUS, ZohoServerFetchResponseDataArrayError, type ZohoServerErrorDataWithDetails, type ZohoServerErrorStatus, type ZohoServerSuccessCode, type ZohoServerSuccessStatus } from '../zoho.error.api';
import { type ZohoDateTimeString } from '../zoho.type';
import { BaseError } from 'make-error';

// MARK: Insert/Update/Upsert Response
/**
 * The maximum number of records allowed for most CRUD functions.
 *
 * This is a limit enforced by the Zoho Crm API
 */
export const ZOHO_CRM_CRUD_FUNCTION_MAX_RECORDS_LIMIT = 100;

export type ZohoCrmUpdateRecordResult<T> = ZohoCrmMultiRecordResult<T, ZohoCrmChangeObjectResponseSuccessEntry, ZohoCrmChangeObjectResponseErrorEntry>;
export type ZohoCrmUpdateRecordResponse = ZohoCrmChangeObjectResponse;

export type ZohoCrmCreateRecordData<T> = Omit<T, 'id'>;

export interface ZohoCrmCreateSingleRecordInput<T> extends ZohoCrmModuleNameRef {
  readonly data: ZohoCrmCreateRecordData<T>;
}

export interface ZohoCrmCreateMultiRecordInput<T> extends ZohoCrmModuleNameRef {
  readonly data: ZohoCrmCreateRecordData<T>[];
}

export type ZohoCrmCreateRecordLikeFunction = ZohoCrmCreateMultiRecordFunction & ZohoCrmCreateSingleRecordFunction;
export type ZohoCrmCreateSingleRecordFunction = <T>(input: ZohoCrmCreateSingleRecordInput<T>) => Promise<ZohoCrmChangeObjectDetails>;
export type ZohoCrmCreateMultiRecordFunction = <T>(input: ZohoCrmCreateMultiRecordInput<T>) => Promise<ZohoCrmUpdateRecordResult<T>>;

export type ZohoCrmUpdateRecordInput<T> = ZohoCrmUpdateSingleRecordInput<T> | ZohoCrmUpdateMultiRecordInput<T>;
export type ZohoCrmUpdateRecordData<T> = UniqueModelWithId & Partial<T>;

export interface ZohoCrmUpdateSingleRecordInput<T> extends ZohoCrmModuleNameRef {
  readonly data: ZohoCrmUpdateRecordData<T>;
}

export interface ZohoCrmUpdateMultiRecordInput<T> extends ZohoCrmModuleNameRef {
  readonly data: ZohoCrmUpdateRecordData<T>[];
}

export type ZohoCrmUpdateRecordLikeFunction = ZohoCrmUpdateMultiRecordFunction & ZohoCrmUpdateSingleRecordFunction;
export type ZohoCrmUpdateMultiRecordFunction = <T>(input: ZohoCrmUpdateMultiRecordInput<T>) => Promise<ZohoCrmUpdateRecordResult<T>>;
export type ZohoCrmUpdateSingleRecordFunction = <T>(input: ZohoCrmUpdateSingleRecordInput<T>) => Promise<ZohoCrmChangeObjectDetails>;

export type ZohoCrmUpsertRecordData<T> = ZohoCrmCreateRecordData<T> | ZohoCrmUpdateRecordData<T>;

export interface ZohoCrmUpsertSingleRecordInput<T> extends ZohoCrmModuleNameRef {
  readonly data: ZohoCrmUpsertRecordData<T>;
}

export interface ZohoCrmUpsertMultiRecordInput<T> extends ZohoCrmModuleNameRef {
  readonly data: ZohoCrmUpsertRecordData<T>[];
}

export type ZohoCrmUpsertRecordLikeFunction = ZohoCrmUpsertMultiRecordFunction & ZohoCrmUpsertSingleRecordFunction;
export type ZohoCrmUpsertMultiRecordFunction = <T>(input: ZohoCrmUpsertMultiRecordInput<T>) => Promise<ZohoCrmUpdateRecordResult<T>>;
export type ZohoCrmUpsertSingleRecordFunction = <T>(input: ZohoCrmUpsertSingleRecordInput<T>) => Promise<ZohoCrmChangeObjectDetails>;

/**
 * The APIs for Insert, Upsert, and Update have the same structure.
 *
 * @returns
 */
function updateRecordLikeFunction(context: ZohoCrmContext, fetchUrlPrefix: '' | '/upsert', fetchMethod: 'POST' | 'PUT'): ZohoCrmUpdateRecordLikeFunction {
  return (<T>({ data, module }: ZohoCrmUpdateRecordInput<T>) =>
    context
      .fetchJson<ZohoCrmUpdateRecordResponse>(`/v8/${module}${fetchUrlPrefix}`, zohoCrmApiFetchJsonInput(fetchMethod, { data: asArray(data) }))
      .catch(zohoCrmCatchZohoCrmChangeObjectLikeResponseError)
      .then((x: ZohoCrmUpdateRecordResponse) => {
        const isInputMultipleItems = Array.isArray(data);
        const result = zohoCrmMultiRecordResult<Partial<T>, ZohoCrmChangeObjectResponseSuccessEntry, ZohoCrmChangeObjectResponseErrorEntry>(asArray(data), x.data);

        if (isInputMultipleItems) {
          return result;
        } else {
          const { successItems, errorItems } = result;

          if (errorItems[0] != null) {
            throw zohoCrmRecordCrudError(errorItems[0].result);
          } else {
            return successItems[0].result.details;
          }
        }
      })) as ZohoCrmUpdateRecordLikeFunction;
}

// MARK: Insert Record
export type ZohoCrmInsertRecordFunction = ZohoCrmCreateRecordLikeFunction;

/**
 * Inserts one or more records into Crm.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/insert-records.html
 *
 * @param context
 * @returns
 */
export function zohoCrmInsertRecord(context: ZohoCrmContext): ZohoCrmInsertRecordFunction {
  return updateRecordLikeFunction(context, '', 'POST') as ZohoCrmInsertRecordFunction;
}

// MARK: Upsert Record
/**
 * Upsert function that can do either an insert or and update ased on the input.
 */
export type ZohoCrmUpsertRecordFunction = ZohoCrmUpsertRecordLikeFunction;

/**
 * Updates or inserts one or more records in Crm.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/upsert-records.html
 *
 * @param context
 * @returns
 */
export function zohoCrmUpsertRecord(context: ZohoCrmContext): ZohoCrmUpsertRecordFunction {
  return updateRecordLikeFunction(context, '/upsert', 'POST') as ZohoCrmUpsertRecordFunction;
}

// MARK: Update Record
export type ZohoCrmUpdateRecordFunction = ZohoCrmUpdateRecordLikeFunction;

/**
 * Updates one or more records in Crm.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/update-records.html
 *
 * @param context
 * @returns
 */
export function zohoCrmUpdateRecord(context: ZohoCrmContext): ZohoCrmUpdateRecordFunction {
  return updateRecordLikeFunction(context, '', 'PUT') as ZohoCrmUpdateRecordFunction;
}

// MARK: Delete Record
export type ZohoCrmDeleteRecordFunction = (input: ZohoCrmDeleteRecordInput) => Promise<ZohoCrmDeleteRecordResponse>;

export interface ZohoCrmDeleteRecordInput extends ZohoCrmModuleNameRef {
  /**
   * Id or array of ids to delete.
   */
  readonly ids: ArrayOrValue<ZohoCrmRecordId>;
  readonly wf_trigger?: boolean;
}

export interface ZohoCrmDeleteRecordResponseSuccessEntry extends ZohoCrmChangeObjectLikeResponseSuccessEntryMeta {
  readonly details: {
    readonly id: ZohoCrmRecordId;
  };
}

export type ZohoCrmDeleteRecordResponse = ZohoCrmChangeObjectLikeResponseSuccessAndErrorPairs<ZohoCrmDeleteRecordResponseSuccessEntry>;

export type ZohoCrmDeleteRecordResult = ZohoCrmChangeObjectResponseSuccessEntry[];

/**
 * Deletes one or more records from the given module.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/delete-records.html
 *
 * @param context
 * @returns ZohoCrmDeleteRecordFunction
 */
export function zohoCrmDeleteRecord(context: ZohoCrmContext): ZohoCrmDeleteRecordFunction {
  return ({ ids, module, wf_trigger }: ZohoCrmDeleteRecordInput) => {
    return context
      .fetchJson<ZohoCrmDeleteRecordResponse>(`/v8/${module}?${makeUrlSearchParams({ ids, wf_trigger })}`, zohoCrmApiFetchJsonInput('DELETE'))
      .catch(zohoCrmCatchZohoCrmChangeObjectLikeResponseError)
      .then(zohoCrmChangeObjectLikeResponseSuccessAndErrorPairs);
  };
}

// MARK: Get Record By Id
export interface ZohoCrmGetRecordByIdInput extends ZohoCrmModuleNameRef {
  readonly id: ZohoCrmRecordId;
}

export type ZohoCrmGetRecordByIdResponse<T = ZohoCrmRecord> = ZohoDataArrayResultRef<T>;

export type ZohoCrmGetRecordByIdResult<T = ZohoCrmRecord> = T;
export type ZohoCrmGetRecordByIdFunction = <T = ZohoCrmRecord>(input: ZohoCrmGetRecordByIdInput) => Promise<ZohoCrmGetRecordByIdResult<T>>;

/**
 * Retrieves a specific record from the given module.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/get-records.html
 *
 * @param context
 * @returns
 */
export function zohoCrmGetRecordById(context: ZohoCrmContext): ZohoCrmGetRecordByIdFunction {
  return <T>(input: ZohoCrmGetRecordByIdInput) =>
    context
      .fetchJson<ZohoCrmGetRecordByIdResponse<T>>(`/v8/${input.module}/${input.id}`, zohoCrmApiFetchJsonInput('GET'))
      .then(assertZohoCrmRecordDataArrayResultHasContent(input.module))
      .then((x) => x.data[0]);
}

// MARK: Get Records
export interface ZohoCrmGetRecordsPageFilter extends ZohoPageFilter {
  readonly converted?: ZohoCrmTrueFalseBoth;
  readonly approved?: ZohoCrmTrueFalseBoth;
}

export interface ZohoCrmGetRecordsFieldsRef {
  readonly fields: ArrayOrValue<ZohoCrmFieldName> | ZohoCrmCommaSeparateFieldNames;
}

export interface ZohoCrmGetRecordsInput extends ZohoCrmModuleNameRef, ZohoCrmGetRecordsPageFilter, ZohoCrmGetRecordsFieldsRef {
  readonly sort_order?: SortingOrder;
  readonly sort_by?: ZohoCrmFieldName;
  readonly cvid?: ZohoCrmCustomViewId;
  readonly territory_id?: ZohoCrmTerritoryId;
  readonly include_child?: boolean;
  readonly $state?: ZohoCrmDraftOrSaveState;
}

export type ZohoCrmGetRecordsResponse<T = ZohoCrmRecord> = ZohoPageResult<T>;
export type ZohoCrmGetRecordsFunction = <T = ZohoCrmRecord>(input: ZohoCrmGetRecordsInput) => Promise<ZohoCrmGetRecordsResponse<T>>;

/**
 * Retrieves records from the given module. Used for paginating across all records.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/get-records.html
 *
 * @param context
 * @returns
 */
export function zohoCrmGetRecords(context: ZohoCrmContext): ZohoCrmGetRecordsFunction {
  return ((input: ZohoCrmGetRecordsInput) => context.fetchJson<ZohoCrmGetRecordsResponse>(`/v8/${input.module}?${zohoCrmUrlSearchParamsMinusModule(input).toString()}`, zohoCrmApiFetchJsonInput('GET'))) as ZohoCrmGetRecordsFunction;
}

// MARK: Search Reecords
/**
 * Configuration for searching records.
 *
 * Only criteria, email, phone, or word will be used at a single time.
 */
export interface ZohoCrmSearchRecordsInput<T = ZohoCrmRecord> extends ZohoCrmModuleNameRef, ZohoCrmGetRecordsPageFilter {
  readonly criteria?: Maybe<ZohoCrmSearchRecordsCriteriaTreeElement<T>>;
  readonly cvid?: Maybe<ZohoCrmCustomViewId>;
  readonly email?: Maybe<EmailAddress>;
  readonly phone?: Maybe<PhoneNumber>;
  readonly word?: Maybe<string>;
}

export type ZohoCrmSearchRecordsResponse<T = ZohoCrmRecord> = ZohoCrmGetRecordsResponse<T>;
export type ZohoCrmSearchRecordsFunction = <T = ZohoCrmRecord>(input: ZohoCrmSearchRecordsInput<T>) => Promise<ZohoCrmSearchRecordsResponse<T>>;

/**
 * Searches records from the given module.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/search-records.html
 *
 * @param context
 * @returns
 */
export function zohoCrmSearchRecords(context: ZohoCrmContext): ZohoCrmSearchRecordsFunction {
  function searchRecordsUrlSearchParams<T = ZohoCrmRecord>(input: ZohoCrmSearchRecordsInput<T>) {
    const baseInput = { ...input };
    delete baseInput.criteria;

    if (input.criteria != null) {
      const criteriaString = zohoCrmSearchRecordsCriteriaString<T>(input.criteria);
      baseInput.criteria = criteriaString;
    }

    if (!baseInput.word && !input.cvid && !input.criteria && !input.email && !input.phone) {
      throw new Error('At least one of word, cvid, criteria, email, or phone must be provided');
    }

    const urlParams = zohoCrmUrlSearchParamsMinusModule(baseInput);
    return urlParams;
  }

  return (<T = ZohoCrmRecord>(input: ZohoCrmSearchRecordsInput<T>) => context.fetchJson<ZohoCrmSearchRecordsResponse<T>>(`/v8/${input.module}/search?${searchRecordsUrlSearchParams(input).toString()}`, zohoCrmApiFetchJsonInput('GET')).then((x) => x ?? { data: [], info: { more_records: false } })) as ZohoCrmSearchRecordsFunction;
}

export type ZohoCrmSearchRecordsPageFactory = <T = ZohoCrmRecord>(input: ZohoCrmSearchRecordsInput<T>, options?: Maybe<FetchPageFactoryOptions<ZohoCrmSearchRecordsInput<T>, ZohoCrmSearchRecordsResponse<T>>>) => FetchPage<ZohoCrmSearchRecordsInput<T>, ZohoCrmSearchRecordsResponse<T>>;

export function zohoCrmSearchRecordsPageFactory(context: ZohoCrmContext): ZohoCrmSearchRecordsPageFactory {
  return zohoFetchPageFactory(zohoCrmSearchRecords(context));
}

// MARK: Related Records
export interface ZohoCrmGetRelatedRecordsFunctionConfig {
  readonly targetModule: ZohoCrmModuleName;
  /**
   * If true, will return an empty page result instead of null when no results are found.
   *
   * Defaults to true.
   */
  readonly returnEmptyRecordsInsteadOfNull?: boolean;
}

export type ZohoCrmGetRelatedRecordsFunctionFactory = <T = ZohoCrmRecord>(input: ZohoCrmGetRelatedRecordsFunctionConfig) => ZohoCrmGetRelatedRecordsFunction<T>;

export type ZohoCrmGetRelatedRecordsPageFilter = ZohoPageFilter;
export interface ZohoCrmGetRelatedRecordsRequest extends ZohoCrmGetRecordByIdInput, ZohoCrmGetRelatedRecordsPageFilter {
  /**
   * Optional, Use to filter the related records of the primary/target record with said ids.
   *
   * For example, providing this value will return the Notes with these ids when searching on related Notes for the primary/target record.
   */
  readonly ids?: Maybe<ArrayOrValue<ZohoCrmRecordId>>;
  /**
   * @deprecated set variables on request object directly instead of using this filter.
   */
  readonly filter?: Maybe<ZohoCrmGetRelatedRecordsPageFilter>;
}

/**
 * A variant of ZohoCrmGetRelatedRecordsRequest that includes a required fields property.
 */
export interface ZohoCrmGetRelatedRecordsRequestWithFields extends ZohoCrmGetRelatedRecordsRequest, ZohoCrmGetRecordsFieldsRef {}

export type ZohoCrmGetRelatedRecordsResponse<T = ZohoCrmRecord> = ZohoPageResult<T>;
export type ZohoCrmGetRelatedRecordsFunction<T = ZohoCrmRecord> = (input: ZohoCrmGetRelatedRecordsRequest) => Promise<ZohoCrmGetRelatedRecordsResponse<T>>;

/**
 * Creates a ZohoCrmGetRelatedRecordsFunctionFactory, which can be used to create ZohoCrmGetRelatedRecordsFunction<T> that targets retrieving related records of a given type.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/get-related-records.html
 *
 * @param context the ZohoCrmContext to use
 * @returns a ZohoCrmGetRelatedRecordsFunctionFactory
 */
export function zohoCrmGetRelatedRecordsFunctionFactory(context: ZohoCrmContext): ZohoCrmGetRelatedRecordsFunctionFactory {
  return <T = ZohoCrmRecord>(config: ZohoCrmGetRelatedRecordsFunctionConfig) => {
    const { targetModule, returnEmptyRecordsInsteadOfNull = true } = config;
    return (input: ZohoCrmGetRelatedRecordsRequest) => context.fetchJson<ZohoCrmGetRelatedRecordsResponse<T>>(`/v8/${input.module}/${input.id}/${targetModule}?${zohoCrmUrlSearchParamsMinusIdAndModule(input, input.filter).toString()}`, zohoCrmApiFetchJsonInput('GET')).then((x) => x ?? (returnEmptyRecordsInsteadOfNull !== false ? emptyZohoPageResult<T>() : x));
  };
}

// MARK: Emails

/**
 * Type filter to use when fetching emails for a record.
 *
 * https://www.zoho.com/crm/developer/docs/api/v8/get-email-rel-list.html
 */
export type ZohoCrmGetEmailsForRecordTypeFilter = 'sent_from_crm' | 'scheduled_in_crm' | 'drafts' | 'user_emails' | 'all_contacts_sent_crm_emails' | 'all_contacts_scheduled_crm_emails' | 'all_contacts_draft_crm_emails';

export type ZohoCrmGetEmailsForRecordRequest = ZohoCrmGetRelatedRecordsRequest & {
  /**
   * The type of emails to fetch.
   */
  readonly type?: Maybe<ZohoCrmGetEmailsForRecordTypeFilter>;
  /**
   * The ID of the user whose emails you want to fetch.
   *
   * Note that you can use this parameter only with type=user_emails.
   */
  readonly owner_id?: Maybe<ZohoCrmRecordId>;
};

export type ZohoCrmGetEmailsForRecordResponse = ZohoPageResult<ZohoCrmRecordEmailMetadata>;
export type ZohoCrmGetEmailsForRecordFunction = (input: ZohoCrmGetEmailsForRecordRequest) => Promise<ZohoCrmGetEmailsForRecordResponse>;

export type ZohoCrmGetEmailsForRecordRawApiResponse = Omit<ZohoCrmGetEmailsForRecordResponse, 'data'> & {
  Emails: ZohoCrmGetEmailsForRecordResponse['data'];
};

export function zohoCrmGetEmailsForRecord(context: ZohoCrmContext): ZohoCrmGetEmailsForRecordFunction {
  const getEmailsFactory = zohoCrmGetRelatedRecordsFunctionFactory(context)<ZohoCrmRecordEmailMetadata>({ targetModule: ZOHO_CRM_EMAILS_MODULE });
  return (input: ZohoCrmGetEmailsForRecordRequest) =>
    getEmailsFactory(input).then((x) => {
      const data = x.data ?? (x as unknown as ZohoCrmGetEmailsForRecordRawApiResponse).Emails;
      return { ...x, data };
    });
}

export type ZohoCrmGetEmailsForRecordPageFactory = FetchPageFactory<ZohoCrmGetEmailsForRecordRequest, ZohoCrmGetEmailsForRecordResponse>;

export function zohoCrmGetEmailsForRecordPageFactory(context: ZohoCrmContext): ZohoCrmGetEmailsForRecordPageFactory {
  return zohoFetchPageFactory(zohoCrmGetEmailsForRecord(context));
}

// MARK: Attachments
export type ZohoCrmGetAttachmentsForRecordRequest = ZohoCrmGetRelatedRecordsRequest & ZohoCrmGetRecordsFieldsRef;
export type ZohoCrmGetAttachmentsForRecordResponse = ZohoPageResult<ZohoCrmRecordAttachmentMetadata>;
export type ZohoCrmGetAttachmentsForRecordFunction = (input: ZohoCrmGetAttachmentsForRecordRequest) => Promise<ZohoCrmGetAttachmentsForRecordResponse>;

export function zohoCrmGetAttachmentsForRecord(context: ZohoCrmContext): ZohoCrmGetAttachmentsForRecordFunction {
  return zohoCrmGetRelatedRecordsFunctionFactory(context)<ZohoCrmRecordAttachmentMetadata>({ targetModule: ZOHO_CRM_ATTACHMENTS_MODULE });
}

export type ZohoCrmGetAttachmentsForRecordPageFactory = FetchPageFactory<ZohoCrmGetAttachmentsForRecordRequest, ZohoCrmGetAttachmentsForRecordResponse>;

export function zohoCrmGetAttachmentsForRecordPageFactory(context: ZohoCrmContext): ZohoCrmGetAttachmentsForRecordPageFactory {
  return zohoFetchPageFactory(zohoCrmGetAttachmentsForRecord(context));
}

/**
 * Maximum attachment size allowed by Zoho Crm.
 *
 * 20MB
 */
export const ZOHO_CRM_ATTACHMENT_MAX_SIZE = 20 * 1024 * 1024;

export interface ZohoCrmUploadAttachmentForRecordRequest extends ZohoCrmGetRecordByIdInput {
  /**
   * Requires the use of a FormData object.
   *
   * Max of 20MB are allowed
   *
   * @deprecated Use attachmentUrl instead for now.
   */
  readonly formData?: FormData;
  /**
   * File url to pull the file from.
   *
   * Either this or formData must be provided.
   */
  readonly attachmentUrl?: WebsiteUrlWithPrefix;
  /**
   * The category id(s) of the attachment.
   *
   * Either this or attachments_category must be provided.
   */
  readonly attachmentCategoryId?: ArrayOrValue<ZohoCrmAttachmentCategoryId>;
  /**
   * The category name(s) of the attachment.
   *
   * Either this or attachments_category_id must be provided.
   *
   * Example: "Resume"
   */
  readonly attachmentCategoryName?: ArrayOrValue<KnownZohoCrmAttachmentCategoryName>;
}

export type ZohoCrmUploadAttachmentForRecordResponse = Response;
export type ZohoCrmUploadAttachmentForRecordFunction = (input: ZohoCrmUploadAttachmentForRecordRequest) => Promise<ZohoCrmUploadAttachmentForRecordResponse>;

/**
 * Uploads an attachment to a record.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/upload-attachment.html
 *
 * @param context
 * @returns
 */
export function zohoCrmUploadAttachmentForRecord(context: ZohoCrmContext): ZohoCrmUploadAttachmentForRecordFunction {
  return (input: ZohoCrmUploadAttachmentForRecordRequest) => {
    const { attachmentCategoryId, attachmentCategoryName, formData } = input;

    const urlParams = {
      attachments_category_id: joinStringsWithCommas(attachmentCategoryId),
      attachments_category: joinStringsWithCommas(attachmentCategoryName),
      attachment_url: input.attachmentUrl
    };

    if (!urlParams.attachments_category_id?.length && !urlParams.attachments_category?.length) {
      throw new Error('attachmentCategoryId or attachmentCategoryName must be provided and not empty.');
    }

    if (formData != null) {
      delete urlParams.attachment_url;
    }

    const url = `https://crmsandbox.zoho.com/crm/v8/${input.module}/${input.id}/${ZOHO_CRM_ATTACHMENTS_MODULE}?${makeUrlSearchParams(urlParams).toString()}`;
    let response: Promise<Response>;

    if (urlParams.attachment_url) {
      response = context.fetch(url, { method: 'POST' });
    } else if (formData != null) {
      throw new Error('unsupported currently. Use the attachmentUrl parameter instead.');

      // There is something weird going on with sending requests this way and zoho's server is rejecting it.

      /*
      response = context.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
          'content-length': '210'
        },
        body: formData
      });
      */

      /*
      const fullUrl = (context.config.apiUrl as string) + url;
      const accessToken = await context.accessTokenStringFactory();

      response = fetch(fullUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: formData,
        method: 'POST'
      });

      console.log({ response });
      */
    } else {
      throw new Error('body or attachmentUrl must be provided.');
    }

    return response;
  };
}

export interface ZohoCrmDownloadAttachmentForRecordRequest extends ZohoCrmGetRecordByIdInput {
  readonly attachment_id: ZohoCrmAttachmentRecordId;
}

export type ZohoCrmDownloadAttachmentForRecordResponse = FetchFileResponse;
export type ZohoCrmDownloadAttachmentForRecordFunction = (input: ZohoCrmDownloadAttachmentForRecordRequest) => Promise<ZohoCrmDownloadAttachmentForRecordResponse>;

/**
 * Downloads an attachment from a record.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/download-attachments.html
 *
 * @param context
 * @returns
 */
export function zohoCrmDownloadAttachmentForRecord(context: ZohoCrmContext): ZohoCrmDownloadAttachmentForRecordFunction {
  return (input: ZohoCrmDownloadAttachmentForRecordRequest) => context.fetch(`/v8/${input.module}/${input.id}/${ZOHO_CRM_ATTACHMENTS_MODULE}/${input.attachment_id}`, { method: 'GET' }).then(parseFetchFileResponse);
}

export interface ZohoCrmDeleteAttachmentFromRecordRequest extends ZohoCrmGetRecordByIdInput {
  readonly attachment_id: ZohoCrmAttachmentRecordId;
}

export type ZohoCrmDeleteAttachmentFromRecordResponse = Response;
export type ZohoCrmDeleteAttachmentFromRecordFunction = (input: ZohoCrmDeleteAttachmentFromRecordRequest) => Promise<ZohoCrmDeleteAttachmentFromRecordResponse>;

/**
 * Deletes an attachment from a record.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/delete-attachments.html
 *
 * @param context
 * @returns
 */
export function zohoCrmDeleteAttachmentFromRecord(context: ZohoCrmContext): ZohoCrmDeleteAttachmentFromRecordFunction {
  return (input: ZohoCrmDeleteAttachmentFromRecordRequest) => context.fetch(`/v8/${input.module}/${input.id}/${ZOHO_CRM_ATTACHMENTS_MODULE}/${input.attachment_id}`, { method: 'DELETE' });
}

// MARK: Function
export type ZohoCrmExecuteRestApiFunctionRequest = ZohoCrmExecuteRestApiFunctionNormalRequest | ZohoCrmExecuteRestApiFunctionApiSpecificRequest;

export interface ZohoCrmExecuteRestApiFunctionNormalRequest {
  readonly functionName: ZohoCrmRestFunctionApiName;
  readonly params?: Maybe<ZohoCrmExecuteRestApiFunctionParams>;
}

export interface ZohoCrmExecuteRestApiFunctionApiSpecificRequest extends ZohoCrmExecuteRestApiFunctionNormalRequest {
  /**
   * If provided the function will use the API key provided instead of the internal oauth
   */
  readonly apiKey: Maybe<ZohoCrmRestFunctionApiKey>;
  /**
   * If provided, the function will target the given API and not the default. Only used when apiKey is provided.
   *
   * Careful when using this, as it might indicate that the target is not environment specific/aware.
   */
  readonly apiUrl?: ZohoCrmConfigApiUrlInput;
}

export type ZohoCrmRestFunctionApiKey = string;

export type ZohoCrmExecuteRestApiFunctionParams = Record<string, string | number | boolean | ZohoDateTimeString>;

export type ZohoCrmExecuteRestApiFunctionResponse = ZohoCrmExecuteRestApiFunctionSuccessResponse | ZohoCrmExecuteRestApiFunctionErrorResponse;

export interface ZohoCrmExecuteRestApiFunctionSuccessResponse {
  readonly code: 'success';
  readonly details: ZohoCrmExecuteRestApiFunctionSuccessDetails;
  readonly message: string;
}

export interface ZohoCrmExecuteRestApiFunctionSuccessDetails {
  readonly userMessage: string[];
  readonly output_type: string;
  readonly id: ZohoCrmUserId;
}

export interface ZohoCrmExecuteRestApiFunctionErrorResponse {
  readonly code: string;
  readonly details: unknown;
  readonly message: string;
}

export class ZohoCrmExecuteRestApiFunctionError extends BaseError {
  constructor(readonly error: ZohoCrmExecuteRestApiFunctionErrorResponse) {
    super(`An error occured during the execution of the function. Code: ${error.code}, Message: ${error.message}`);
  }
}

/**
 * Executes the Zoho Crm function based on the input.
 *
 * If the function fails execution a ZohoCrmExecuteRestApiFunctionError will be thrown. Other API errors may still be thrown.
 */
export type ZohoCrmExecuteRestApiFunctionFunction = (input: ZohoCrmExecuteRestApiFunctionRequest) => Promise<ZohoCrmExecuteRestApiFunctionSuccessDetails>;

/**
 * Creates a ZohoCrmExecuteRestApiFunctionFunction
 *
 * OAuth Details:
 * - https://www.zoho.com/crm/developer/docs/functions/serverless-fn-oauth.html#OAuth2
 * - There is no documentation for ZohoCrm specifically, but it seems to behave the same way
 * - You will need the following scopes: ZohoCrm.functions.execute.READ,ZohoCrm.functions.execute.CREATE
 *
 * @param context
 * @returns
 */
export function zohoCrmExecuteRestApiFunction(context: ZohoCrmContext): ZohoCrmExecuteRestApiFunctionFunction {
  return (input: ZohoCrmExecuteRestApiFunctionRequest): Promise<ZohoCrmExecuteRestApiFunctionSuccessDetails> => {
    const inputSearchParams = makeUrlSearchParams(input.params);
    const inputSearchParamsString = inputSearchParams.toString();

    const isSpecificRequest = Boolean((input as ZohoCrmExecuteRestApiFunctionApiSpecificRequest).apiKey);

    const urlParams = (isSpecificRequest ? `auth_type=apikey&zapikey=${(input as ZohoCrmExecuteRestApiFunctionApiSpecificRequest).apiKey}` : 'auth_type=oauth') + (inputSearchParamsString ? `&${inputSearchParamsString}` : '');
    const relativeUrl = `/v8/functions/${input.functionName}/actions/execute?${urlParams}`;
    const baseUrl = isSpecificRequest && (input as ZohoCrmExecuteRestApiFunctionApiSpecificRequest).apiUrl != null ? zohoCrmConfigApiUrl((input as ZohoCrmExecuteRestApiFunctionApiSpecificRequest).apiUrl as string) : '';
    const url = `${baseUrl}${relativeUrl}`;

    return context.fetchJson<ZohoCrmExecuteRestApiFunctionResponse>(url, zohoCrmApiFetchJsonInput('POST')).then((x) => {
      if (x.code === 'success') {
        return (x as ZohoCrmExecuteRestApiFunctionSuccessResponse).details;
      } else {
        throw new ZohoCrmExecuteRestApiFunctionError(x);
      }
    });
  };
}

// MARK: Util
export function zohoCrmUrlSearchParamsMinusModule(...input: Maybe<object | Record<string, string | number>>[]) {
  return makeUrlSearchParams(input, { omitKeys: 'module' });
}

export function zohoCrmUrlSearchParamsMinusIdAndModule(...input: Maybe<object | Record<string, string | number>>[]) {
  return makeUrlSearchParams(input, { omitKeys: ['id', 'module'] });
}

/**
 * @deprecated use makeUrlSearchParams instead.
 */
export const zohoCrmUrlSearchParams = makeUrlSearchParams;

export function zohoCrmApiFetchJsonInput(method: string, body?: Maybe<FetchJsonBody>): FetchJsonInput {
  const result = {
    method,
    body: body ?? undefined
  };

  return result;
}

// MARK: Results
/**
 * Catches ZohoServerFetchResponseDataArrayError and returns the error data array as the response data, as each data element will have the error details.
 *
 * Use to catch errors from functions that return ZohoCrmChangeObjectLikeResponse and pass the result to zohoCrmChangeObjectLikeResponseSuccessAndErrorPairs.
 */
export function zohoCrmCatchZohoCrmChangeObjectLikeResponseError<R extends ZohoCrmChangeObjectLikeResponse<any>>(e: unknown): R {
  let result: R;

  if (e instanceof ZohoServerFetchResponseDataArrayError) {
    result = {
      data: e.errorDataArray
    } as R;
  } else {
    throw e;
  }

  return result;
}

export type ZohoCrmChangeObjectLikeResponse<T extends ZohoCrmChangeObjectLikeResponseEntry = ZohoCrmChangeObjectLikeResponseEntry> = ZohoDataArrayResultRef<T>;
export type ZohoCrmChangeObjectLikeResponseEntry<E extends ZohoCrmChangeObjectLikeResponseSuccessEntryMeta = ZohoCrmChangeObjectLikeResponseSuccessEntryMeta> = E | ZohoCrmChangeObjectResponseErrorEntry;
export type ZohoCrmChangeObjectLikeResponseSuccessEntryType<T extends ZohoCrmChangeObjectLikeResponseEntry> = T extends ZohoCrmChangeObjectLikeResponseEntry<infer E> ? E : never;

export interface ZohoCrmChangeObjectLikeResponseSuccessEntryMeta {
  readonly code: ZohoServerSuccessCode;
  readonly status: ZohoServerSuccessStatus;
  readonly message: string;
}

export type ZohoCrmChangeObjectLikeResponseSuccessAndErrorPairs<T extends ZohoCrmChangeObjectLikeResponseEntry> = ZohoCrmChangeObjectLikeResponse<T> & {
  readonly successItems: ZohoCrmChangeObjectLikeResponseSuccessEntryType<T>[];
  readonly errorItems: ZohoCrmChangeObjectResponseErrorEntry[];
};

export function zohoCrmChangeObjectLikeResponseSuccessAndErrorPairs<T extends ZohoCrmChangeObjectLikeResponseEntry>(response: ZohoCrmChangeObjectLikeResponse<T>): ZohoCrmChangeObjectLikeResponseSuccessAndErrorPairs<T> {
  const { data } = response;
  const successItems: ZohoCrmChangeObjectLikeResponseSuccessEntryType<T>[] = [];
  const errorItems: ZohoCrmChangeObjectResponseErrorEntry[] = [];

  data.forEach((x) => {
    if (x.status === ZOHO_SUCCESS_STATUS) {
      successItems.push(x as unknown as ZohoCrmChangeObjectLikeResponseSuccessEntryType<T>);
    } else {
      errorItems.push(x);
    }
  });

  const result: ZohoCrmChangeObjectLikeResponseSuccessAndErrorPairs<T> = {
    ...response,
    successItems,
    errorItems
  };

  return result;
}

export type ZohoCrmChangeObjectResponse<T extends ZohoCrmChangeObjectResponseEntry = ZohoCrmChangeObjectResponseEntry> = ZohoCrmChangeObjectLikeResponse<T>;
export type ZohoCrmChangeObjectResponseEntry<E extends ZohoCrmChangeObjectResponseSuccessEntry = ZohoCrmChangeObjectResponseSuccessEntry> = ZohoCrmChangeObjectLikeResponseEntry<E>;

export interface ZohoCrmChangeObjectResponseSuccessEntry<D extends ZohoCrmChangeObjectDetails = ZohoCrmChangeObjectDetails> extends ZohoCrmChangeObjectLikeResponseSuccessEntryMeta {
  readonly details: D;
}

export interface ZohoCrmChangeObjectResponseErrorEntry extends ZohoServerErrorDataWithDetails {
  readonly status: ZohoServerErrorStatus;
}

// MARK: Multi-Record Results
export interface ZohoCrmMultiRecordResult<I, OS, OE> {
  readonly successItems: ZohoCrmMultiRecordResultEntry<I, OS>[];
  readonly errorItems: ZohoCrmMultiRecordResultEntry<I, OE>[];
}

export interface ZohoCrmMultiRecordResultItem {
  readonly status: ZohoServerSuccessStatus | ZohoServerErrorStatus;
}

export function zohoCrmMultiRecordResult<I, OS extends ZohoCrmMultiRecordResultItem, OE extends ZohoCrmMultiRecordResultItem>(input: I[], results: (OS | OE)[]): ZohoCrmMultiRecordResult<I, OS, OE> {
  const successItems: ZohoCrmMultiRecordResultEntry<I, OS>[] = [];
  const errorItems: ZohoCrmMultiRecordResultEntry<I, OE>[] = [];

  input.forEach((x, i) => {
    const result = results[i];

    if (result.status === ZOHO_SUCCESS_STATUS) {
      successItems.push({
        input: x,
        result: result as OS
      });
    } else {
      errorItems.push({
        input: x,
        result: result as OE
      });
    }
  });

  const result: ZohoCrmMultiRecordResult<I, OS, OE> = {
    successItems,
    errorItems
  };

  return result;
}

export interface ZohoCrmMultiRecordResultEntry<I, O> {
  /**
   * Input record/data.
   */
  readonly input: I;
  /**
   * The result of the insert.
   */
  readonly result: O;
}

// MARK: Compat
/**
 * @deprecated use ZohoCrmGetRelatedRecordsPageFilter instead.
 */
export type ZohoCrmGetNotesPageFilter = ZohoCrmGetRelatedRecordsPageFilter;
