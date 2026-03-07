import { type ZohoDataArrayResultRef, type ZohoPageFilter, type ZohoPageResult, emptyZohoPageResult, zohoFetchPageFactory } from './../zoho.api.page';
import { type FetchFileResponse, type FetchJsonBody, type FetchJsonInput, type FetchPage, type FetchPageFactory, type FetchPageFactoryOptions, makeUrlSearchParams, parseFetchFileResponse } from '@dereekb/util/fetch';
import { type ZohoRecruitConfigApiUrlInput, type ZohoRecruitContext, zohoRecruitConfigApiUrl } from './recruit.config';
import {
  type ZohoRecruitCommaSeparateFieldNames,
  type ZohoRecruitCustomViewId,
  type ZohoRecruitDraftOrSaveState,
  type ZohoRecruitFieldName,
  type ZohoRecruitModuleNameRef,
  type ZohoRecruitChangeObjectDetails,
  type ZohoRecruitRecord,
  type ZohoRecruitRecordId,
  type ZohoRecruitTerritoryId,
  type ZohoRecruitTrueFalseBoth,
  type ZohoRecruitRestFunctionApiName,
  type ZohoRecruitUserId,
  type ZohoRecruitModuleName,
  ZOHO_RECRUIT_EMAILS_MODULE,
  type ZohoRecruitRecordEmailMetadata,
  ZOHO_RECRUIT_ATTACHMENTS_MODULE,
  type ZohoRecruitRecordAttachmentMetadata,
  type ZohoRecruitAttachmentRecordId,
  type ZohoRecruitAttachmentCategoryId,
  type KnownZohoRecruitAttachmentCategoryName
} from './recruit';
import { zohoRecruitSearchRecordsCriteriaString, type ZohoRecruitSearchRecordsCriteriaTreeElement } from './recruit.criteria';
import { type ArrayOrValue, type EmailAddress, type Maybe, type PhoneNumber, type SortingOrder, type UniqueModelWithId, type WebsiteUrlWithPrefix, asArray, joinStringsWithCommas } from '@dereekb/util';
import { assertZohoRecruitRecordDataArrayResultHasContent, zohoRecruitRecordCrudError } from './recruit.error.api';
import { ZOHO_SUCCESS_STATUS, type ZohoServerErrorDataWithDetails, type ZohoServerErrorStatus, type ZohoServerSuccessCode, type ZohoServerSuccessStatus } from '../zoho.error.api';
import { type ZohoDateTimeString } from '../zoho.type';
import { BaseError } from 'make-error';

// MARK: Insert/Update/Upsert Response
/**
 * The maximum number of records allowed for most CRUD functions.
 *
 * This is a limit enforced by the Zoho Recruit API
 */
export const ZOHO_RECRUIT_CRUD_FUNCTION_MAX_RECORDS_LIMIT = 100;

/**
 * Paired success/error result from a bulk record update, upsert, or insert operation.
 */
export type ZohoRecruitUpdateRecordResult<T> = ZohoRecruitMultiRecordResult<T, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>;
/**
 * Raw API response from record change operations (insert/update/upsert).
 */
export type ZohoRecruitUpdateRecordResponse = ZohoRecruitChangeObjectResponse;

/**
 * Record data with the `id` field omitted, used for creating new records.
 */
export type ZohoRecruitCreateRecordData<T> = Omit<T, 'id'>;

/**
 * Input for inserting a single record into a module.
 */
export interface ZohoRecruitCreateSingleRecordInput<T> extends ZohoRecruitModuleNameRef {
  readonly data: ZohoRecruitCreateRecordData<T>;
}

/**
 * Input for inserting multiple records into a module in a single API call.
 */
export interface ZohoRecruitCreateMultiRecordInput<T> extends ZohoRecruitModuleNameRef {
  readonly data: ZohoRecruitCreateRecordData<T>[];
}

/**
 * Overloaded function signature supporting both single and multi-record creation.
 */
export type ZohoRecruitCreateRecordLikeFunction = ZohoRecruitCreateMultiRecordFunction & ZohoRecruitCreateSingleRecordFunction;
export type ZohoRecruitCreateSingleRecordFunction = <T>(input: ZohoRecruitCreateSingleRecordInput<T>) => Promise<ZohoRecruitChangeObjectDetails>;
export type ZohoRecruitCreateMultiRecordFunction = <T>(input: ZohoRecruitCreateMultiRecordInput<T>) => Promise<ZohoRecruitUpdateRecordResult<T>>;

export type ZohoRecruitUpdateRecordInput<T> = ZohoRecruitUpdateSingleRecordInput<T> | ZohoRecruitUpdateMultiRecordInput<T>;
/**
 * Record data that requires an `id` field for identifying which record to update.
 */
export type ZohoRecruitUpdateRecordData<T> = UniqueModelWithId & Partial<T>;

/**
 * Input for updating a single record in a module.
 */
export interface ZohoRecruitUpdateSingleRecordInput<T> extends ZohoRecruitModuleNameRef {
  readonly data: ZohoRecruitUpdateRecordData<T>;
}

/**
 * Input for updating multiple records in a module in a single API call.
 */
export interface ZohoRecruitUpdateMultiRecordInput<T> extends ZohoRecruitModuleNameRef {
  readonly data: ZohoRecruitUpdateRecordData<T>[];
}

/**
 * Overloaded function signature supporting both single and multi-record updates.
 */
export type ZohoRecruitUpdateRecordLikeFunction = ZohoRecruitUpdateMultiRecordFunction & ZohoRecruitUpdateSingleRecordFunction;
export type ZohoRecruitUpdateMultiRecordFunction = <T>(input: ZohoRecruitUpdateMultiRecordInput<T>) => Promise<ZohoRecruitUpdateRecordResult<T>>;
export type ZohoRecruitUpdateSingleRecordFunction = <T>(input: ZohoRecruitUpdateSingleRecordInput<T>) => Promise<ZohoRecruitChangeObjectDetails>;

/**
 * Record data that may or may not include an `id`, allowing either insert or update semantics.
 */
export type ZohoRecruitUpsertRecordData<T> = ZohoRecruitCreateRecordData<T> | ZohoRecruitUpdateRecordData<T>;

/**
 * Input for upserting a single record in a module.
 */
export interface ZohoRecruitUpsertSingleRecordInput<T> extends ZohoRecruitModuleNameRef {
  readonly data: ZohoRecruitUpsertRecordData<T>;
}

/**
 * Input for upserting multiple records in a module in a single API call.
 */
export interface ZohoRecruitUpsertMultiRecordInput<T> extends ZohoRecruitModuleNameRef {
  readonly data: ZohoRecruitUpsertRecordData<T>[];
}

/**
 * Overloaded function signature supporting both single and multi-record upserts.
 */
export type ZohoRecruitUpsertRecordLikeFunction = ZohoRecruitUpsertMultiRecordFunction & ZohoRecruitUpsertSingleRecordFunction;
export type ZohoRecruitUpsertMultiRecordFunction = <T>(input: ZohoRecruitUpsertMultiRecordInput<T>) => Promise<ZohoRecruitUpdateRecordResult<T>>;
export type ZohoRecruitUpsertSingleRecordFunction = <T>(input: ZohoRecruitUpsertSingleRecordInput<T>) => Promise<ZohoRecruitChangeObjectDetails>;

/**
 * Shared implementation for the Insert, Upsert, and Update endpoints, which all share the same request/response structure.
 *
 * When a single record is provided, the function returns the change details directly or throws on error.
 * When multiple records are provided, it returns a paired success/error result.
 */
function updateRecordLikeFunction(context: ZohoRecruitContext, fetchUrlPrefix: '' | '/upsert', fetchMethod: 'POST' | 'PUT'): ZohoRecruitUpdateRecordLikeFunction {
  return (<T>({ data, module }: ZohoRecruitUpdateRecordInput<T>) =>
    context.fetchJson<ZohoRecruitUpdateRecordResponse>(`/v2/${module}${fetchUrlPrefix}`, zohoRecruitApiFetchJsonInput(fetchMethod, { data: asArray(data) })).then((x: ZohoRecruitUpdateRecordResponse) => {
      const isInputMultipleItems = Array.isArray(data);
      const result = zohoRecruitMultiRecordResult<Partial<T>, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>(asArray(data), x.data);

      if (isInputMultipleItems) {
        return result;
      } else {
        const { successItems, errorItems } = result;

        if (errorItems[0] != null) {
          throw zohoRecruitRecordCrudError(errorItems[0].result);
        } else {
          return successItems[0].result.details;
        }
      }
    })) as ZohoRecruitUpdateRecordLikeFunction;
}

// MARK: Insert Record
export type ZohoRecruitInsertRecordFunction = ZohoRecruitCreateRecordLikeFunction;

/**
 * Inserts one or more records into Recruit.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/insert-records.html
 */
export function zohoRecruitInsertRecord(context: ZohoRecruitContext): ZohoRecruitInsertRecordFunction {
  return updateRecordLikeFunction(context, '', 'POST') as ZohoRecruitInsertRecordFunction;
}

// MARK: Upsert Record
/**
 * Upsert function that can do either an insert or and update ased on the input.
 */
export type ZohoRecruitUpsertRecordFunction = ZohoRecruitUpsertRecordLikeFunction;

/**
 * Updates or inserts one or more records in Recruit.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/upsert-records.html
 */
export function zohoRecruitUpsertRecord(context: ZohoRecruitContext): ZohoRecruitUpsertRecordFunction {
  return updateRecordLikeFunction(context, '/upsert', 'POST') as ZohoRecruitUpsertRecordFunction;
}

// MARK: Update Record
export type ZohoRecruitUpdateRecordFunction = ZohoRecruitUpdateRecordLikeFunction;

/**
 * Updates one or more records in Recruit.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/update-records.html
 */
export function zohoRecruitUpdateRecord(context: ZohoRecruitContext): ZohoRecruitUpdateRecordFunction {
  return updateRecordLikeFunction(context, '', 'PUT') as ZohoRecruitUpdateRecordFunction;
}

// MARK: Delete Record
/**
 * Function that deletes one or more records from a module.
 */
export type ZohoRecruitDeleteRecordFunction = (input: ZohoRecruitDeleteRecordInput) => Promise<ZohoRecruitDeleteRecordResponse>;

/**
 * Input for deleting records from a module.
 */
export interface ZohoRecruitDeleteRecordInput extends ZohoRecruitModuleNameRef {
  /**
   * Id or array of ids to delete.
   */
  readonly ids: ArrayOrValue<ZohoRecruitRecordId>;
  readonly wf_trigger?: boolean;
}

/**
 * Successful deletion entry containing the deleted record's id.
 */
export interface ZohoRecruitDeleteRecordResponseSuccessEntry extends ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta {
  readonly details: {
    readonly id: ZohoRecruitRecordId;
  };
}

export type ZohoRecruitDeleteRecordResponse = ZohoRecruitChangeObjectLikeResponseSuccessAndErrorPairs<ZohoRecruitDeleteRecordResponseSuccessEntry>;

export type ZohoRecruitDeleteRecordResult = ZohoRecruitChangeObjectResponseSuccessEntry[];

/**
 * Deletes one or more records from the given module.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/delete-records.html
 */
export function zohoRecruitDeleteRecord(context: ZohoRecruitContext): ZohoRecruitDeleteRecordFunction {
  return ({ ids, module, wf_trigger }: ZohoRecruitDeleteRecordInput) => {
    return context.fetchJson<ZohoRecruitDeleteRecordResponse>(`/v2/${module}?${makeUrlSearchParams({ ids, wf_trigger })}`, zohoRecruitApiFetchJsonInput('DELETE')).then(zohoRecruitChangeObjectLikeResponseSuccessAndErrorPairs);
  };
}

// MARK: Get Record By Id
/**
 * Input identifying a specific record within a module.
 */
export interface ZohoRecruitGetRecordByIdInput extends ZohoRecruitModuleNameRef {
  readonly id: ZohoRecruitRecordId;
}

export type ZohoRecruitGetRecordByIdResponse<T = ZohoRecruitRecord> = ZohoDataArrayResultRef<T>;

export type ZohoRecruitGetRecordByIdResult<T = ZohoRecruitRecord> = T;
export type ZohoRecruitGetRecordByIdFunction = <T = ZohoRecruitRecord>(input: ZohoRecruitGetRecordByIdInput) => Promise<ZohoRecruitGetRecordByIdResult<T>>;

/**
 * Retrieves a specific record from the given module by its id.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/get-records.html
 */
export function zohoRecruitGetRecordById(context: ZohoRecruitContext): ZohoRecruitGetRecordByIdFunction {
  return <T>(input: ZohoRecruitGetRecordByIdInput) =>
    context
      .fetchJson<ZohoRecruitGetRecordByIdResponse<T>>(`/v2/${input.module}/${input.id}`, zohoRecruitApiFetchJsonInput('GET'))
      .then(assertZohoRecruitRecordDataArrayResultHasContent(input.module))
      .then((x) => x.data[0]);
}

// MARK: Get Records
/**
 * Filter options for listing records, extending pagination with conversion and approval status filters.
 */
export interface ZohoRecruitGetRecordsPageFilter extends ZohoPageFilter {
  readonly converted?: ZohoRecruitTrueFalseBoth;
  readonly approved?: ZohoRecruitTrueFalseBoth;
}

/**
 * Input for fetching records from a module, supporting field selection, sorting, pagination, and view filters.
 */
export interface ZohoRecruitGetRecordsInput extends ZohoRecruitModuleNameRef, ZohoRecruitGetRecordsPageFilter {
  readonly fields?: ZohoRecruitCommaSeparateFieldNames;
  readonly sort_order?: SortingOrder;
  readonly sort_by?: ZohoRecruitFieldName;
  readonly cvid?: ZohoRecruitCustomViewId;
  readonly territory_id?: ZohoRecruitTerritoryId;
  readonly include_child?: boolean;
  readonly $state?: ZohoRecruitDraftOrSaveState;
}

export type ZohoRecruitGetRecordsResponse<T = ZohoRecruitRecord> = ZohoPageResult<T>;
export type ZohoRecruitGetRecordsFunction = <T = ZohoRecruitRecord>(input: ZohoRecruitGetRecordsInput) => Promise<ZohoRecruitGetRecordsResponse<T>>;

/**
 * Retrieves records from the given module. Used for paginating across all records.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/get-records.html
 */
export function zohoRecruitGetRecords(context: ZohoRecruitContext): ZohoRecruitGetRecordsFunction {
  return ((input: ZohoRecruitGetRecordsInput) => context.fetchJson<ZohoRecruitGetRecordsResponse>(`/v2/${input.module}?${zohoRecruitUrlSearchParamsMinusModule(input).toString()}`, zohoRecruitApiFetchJsonInput('GET'))) as ZohoRecruitGetRecordsFunction;
}

// MARK: Search Reecords
/**
 * Configuration for searching records.
 *
 * Only criteria, email, phone, or word will be used at a single time.
 */
export interface ZohoRecruitSearchRecordsInput<T = ZohoRecruitRecord> extends ZohoRecruitModuleNameRef, ZohoRecruitGetRecordsPageFilter {
  readonly criteria?: Maybe<ZohoRecruitSearchRecordsCriteriaTreeElement<T>>;
  /**
   * @deprecated may be deprecated. Waiting on Zoho Recruit to get back to me.
   */
  readonly email?: Maybe<EmailAddress>;
  readonly phone?: Maybe<PhoneNumber>;
  readonly word?: Maybe<string>;
}

export type ZohoRecruitSearchRecordsResponse<T = ZohoRecruitRecord> = ZohoRecruitGetRecordsResponse<T>;
export type ZohoRecruitSearchRecordsFunction = <T = ZohoRecruitRecord>(input: ZohoRecruitSearchRecordsInput<T>) => Promise<ZohoRecruitSearchRecordsResponse<T>>;

/**
 * Searches records from the given module using criteria, email, phone, or keyword filters.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/search-records.html
 */
export function zohoRecruitSearchRecords(context: ZohoRecruitContext): ZohoRecruitSearchRecordsFunction {
  function searchRecordsUrlSearchParams<T = ZohoRecruitRecord>(input: ZohoRecruitSearchRecordsInput<T>) {
    const baseInput = { ...input };
    delete baseInput.criteria;

    if (input.criteria != null) {
      const criteriaString = zohoRecruitSearchRecordsCriteriaString<T>(input.criteria);
      baseInput.criteria = criteriaString;
    }

    if (!baseInput.word && !input.criteria && !input.email && !input.phone) {
      throw new Error('At least one of word, criteria, email, or phone must be provided');
    }

    const urlParams = zohoRecruitUrlSearchParamsMinusModule(baseInput);
    return urlParams;
  }

  return (<T = ZohoRecruitRecord>(input: ZohoRecruitSearchRecordsInput<T>) => context.fetchJson<ZohoRecruitSearchRecordsResponse<T>>(`/v2/${input.module}/search?${searchRecordsUrlSearchParams(input).toString()}`, zohoRecruitApiFetchJsonInput('GET')).then((x) => x ?? { data: [], info: { more_records: false } })) as ZohoRecruitSearchRecordsFunction;
}

/**
 * Factory function type that produces paginated iterators over search results.
 */
export type ZohoRecruitSearchRecordsPageFactory = <T = ZohoRecruitRecord>(input: ZohoRecruitSearchRecordsInput<T>, options?: Maybe<FetchPageFactoryOptions<ZohoRecruitSearchRecordsInput<T>, ZohoRecruitSearchRecordsResponse<T>>>) => FetchPage<ZohoRecruitSearchRecordsInput<T>, ZohoRecruitSearchRecordsResponse<T>>;

/**
 * Creates a page factory for iterating over search results across multiple pages.
 */
export function zohoRecruitSearchRecordsPageFactory(context: ZohoRecruitContext): ZohoRecruitSearchRecordsPageFactory {
  return zohoFetchPageFactory(zohoRecruitSearchRecords(context));
}

// MARK: Related Records
/**
 * Configuration for creating a related records retrieval function.
 */
export interface ZohoRecruitGetRelatedRecordsFunctionConfig {
  readonly targetModule: ZohoRecruitModuleName;
  /**
   * If true, will return an empty page result instead of null when no results are found.
   *
   * Defaults to true.
   */
  readonly returnEmptyRecordsInsteadOfNull?: boolean;
}

/**
 * Factory that produces typed functions for fetching related records of a specific target module.
 */
export type ZohoRecruitGetRelatedRecordsFunctionFactory = <T = ZohoRecruitRecord>(input: ZohoRecruitGetRelatedRecordsFunctionConfig) => ZohoRecruitGetRelatedRecordsFunction<T>;

export type ZohoRecruitGetRelatedRecordsPageFilter = ZohoPageFilter;
/**
 * Request for fetching related records of a specific record in a module.
 */
export interface ZohoRecruitGetRelatedRecordsRequest extends ZohoRecruitGetRecordByIdInput, ZohoRecruitGetRelatedRecordsPageFilter {
  /**
   * Optional, Use to filter the related records of the primary/target record with said ids.
   *
   * For example, providing this value will return the Notes with these ids when searching on related Notes for the primary/target record.
   */
  readonly ids?: Maybe<ArrayOrValue<ZohoRecruitRecordId>>;
  /**
   * @deprecated set variables on request object directly instead of using this filter.
   */
  readonly filter?: Maybe<ZohoRecruitGetRelatedRecordsPageFilter>;
}

export type ZohoRecruitGetRelatedRecordsResponse<T = ZohoRecruitRecord> = ZohoPageResult<T>;
export type ZohoRecruitGetRelatedRecordsFunction<T = ZohoRecruitRecord> = (input: ZohoRecruitGetRelatedRecordsRequest) => Promise<ZohoRecruitGetRelatedRecordsResponse<T>>;

/**
 * Creates a ZohoRecruitGetRelatedRecordsFunctionFactory, which can be used to create ZohoRecruitGetRelatedRecordsFunction<T> that targets retrieving related records of a given type.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/get-related-records.html
 *
 * @param context the ZohoRecruitContext to use
 * @returns a ZohoRecruitGetRelatedRecordsFunctionFactory
 */
export function zohoRecruitGetRelatedRecordsFunctionFactory(context: ZohoRecruitContext): ZohoRecruitGetRelatedRecordsFunctionFactory {
  return <T = ZohoRecruitRecord>(config: ZohoRecruitGetRelatedRecordsFunctionConfig) => {
    const { targetModule, returnEmptyRecordsInsteadOfNull = true } = config;
    return (input: ZohoRecruitGetRelatedRecordsRequest) => context.fetchJson<ZohoRecruitGetRelatedRecordsResponse<T>>(`/v2/${input.module}/${input.id}/${targetModule}?${zohoRecruitUrlSearchParamsMinusIdAndModule(input, input.filter).toString()}`, zohoRecruitApiFetchJsonInput('GET')).then((x) => x ?? (returnEmptyRecordsInsteadOfNull !== false ? emptyZohoPageResult<T>() : x));
  };
}

// MARK: Emails
export type ZohoRecruitGetEmailsForRecordRequest = ZohoRecruitGetRelatedRecordsRequest;
export type ZohoRecruitGetEmailsForRecordResponse = ZohoPageResult<ZohoRecruitRecordEmailMetadata>;
export type ZohoRecruitGetEmailsForRecordFunction = (input: ZohoRecruitGetEmailsForRecordRequest) => Promise<ZohoRecruitGetEmailsForRecordResponse>;

/**
 * Retrieves email metadata related to a specific record, using the related records API targeting the Emails module.
 */
export function zohoRecruitGetEmailsForRecord(context: ZohoRecruitContext): ZohoRecruitGetEmailsForRecordFunction {
  return zohoRecruitGetRelatedRecordsFunctionFactory(context)<ZohoRecruitRecordEmailMetadata>({ targetModule: ZOHO_RECRUIT_EMAILS_MODULE });
}

/**
 * Page factory type for paginated email retrieval.
 */
export type ZohoRecruitGetEmailsForRecordPageFactory = FetchPageFactory<ZohoRecruitGetEmailsForRecordRequest, ZohoRecruitGetEmailsForRecordResponse>;

/**
 * Creates a page factory for iterating over emails related to a record across multiple pages.
 */
export function zohoRecruitGetEmailsForRecordPageFactory(context: ZohoRecruitContext): ZohoRecruitGetEmailsForRecordPageFactory {
  return zohoFetchPageFactory(zohoRecruitGetEmailsForRecord(context));
}

// MARK: Attachments
export type ZohoRecruitGetAttachmentsForRecordRequest = ZohoRecruitGetRelatedRecordsRequest;
export type ZohoRecruitGetAttachmentsForRecordResponse = ZohoPageResult<ZohoRecruitRecordAttachmentMetadata>;
export type ZohoRecruitGetAttachmentsForRecordFunction = (input: ZohoRecruitGetAttachmentsForRecordRequest) => Promise<ZohoRecruitGetAttachmentsForRecordResponse>;

/**
 * Retrieves attachment metadata related to a specific record, using the related records API targeting the Attachments module.
 */
export function zohoRecruitGetAttachmentsForRecord(context: ZohoRecruitContext): ZohoRecruitGetAttachmentsForRecordFunction {
  return zohoRecruitGetRelatedRecordsFunctionFactory(context)<ZohoRecruitRecordAttachmentMetadata>({ targetModule: ZOHO_RECRUIT_ATTACHMENTS_MODULE });
}

/**
 * Page factory type for paginated attachment retrieval.
 */
export type ZohoRecruitGetAttachmentsForRecordPageFactory = FetchPageFactory<ZohoRecruitGetAttachmentsForRecordRequest, ZohoRecruitGetAttachmentsForRecordResponse>;

/**
 * Creates a page factory for iterating over attachments related to a record across multiple pages.
 */
export function zohoRecruitGetAttachmentsForRecordPageFactory(context: ZohoRecruitContext): ZohoRecruitGetAttachmentsForRecordPageFactory {
  return zohoFetchPageFactory(zohoRecruitGetAttachmentsForRecord(context));
}

/**
 * Maximum attachment size allowed by Zoho Recruit.
 *
 * 20MB
 */
export const ZOHO_RECRUIT_ATTACHMENT_MAX_SIZE = 20 * 1024 * 1024;

/**
 * Input for uploading an attachment to a record, specifying the file source and category.
 */
export interface ZohoRecruitUploadAttachmentForRecordRequest extends ZohoRecruitGetRecordByIdInput {
  /**
   * File to upload as an attachment. Max 20MB.
   *
   * Either this or attachmentUrl must be provided.
   */
  readonly file?: Maybe<File>;
  /**
   * File url to pull the file from.
   *
   * Either this or file must be provided.
   */
  readonly attachmentUrl?: WebsiteUrlWithPrefix;
  /**
   * The category id(s) of the attachment.
   *
   * Either this or attachmentCategoryName must be provided.
   */
  readonly attachmentCategoryId?: ArrayOrValue<ZohoRecruitAttachmentCategoryId>;
  /**
   * The category name(s) of the attachment.
   *
   * Either this or attachmentCategoryId must be provided.
   *
   * Example: "Resume"
   */
  readonly attachmentCategoryName?: ArrayOrValue<KnownZohoRecruitAttachmentCategoryName>;
}

export type ZohoRecruitUploadAttachmentForRecordResponse = Response;
export type ZohoRecruitUploadAttachmentForRecordFunction = (input: ZohoRecruitUploadAttachmentForRecordRequest) => Promise<ZohoRecruitUploadAttachmentForRecordResponse>;

/**
 * Uploads an attachment to a record.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/upload-attachment.html
 */
export function zohoRecruitUploadAttachmentForRecord(context: ZohoRecruitContext): ZohoRecruitUploadAttachmentForRecordFunction {
  return (input: ZohoRecruitUploadAttachmentForRecordRequest) => {
    const { attachmentCategoryId, attachmentCategoryName, file, attachmentUrl } = input;

    const urlParams = {
      attachments_category_id: joinStringsWithCommas(attachmentCategoryId),
      attachments_category: joinStringsWithCommas(attachmentCategoryName)
    };

    if (!urlParams.attachments_category_id?.length && !urlParams.attachments_category?.length) {
      throw new Error('attachmentCategoryId or attachmentCategoryName must be provided and not empty.');
    }

    const url = `/v2/${input.module}/${input.id}/${ZOHO_RECRUIT_ATTACHMENTS_MODULE}?${makeUrlSearchParams(urlParams).toString()}`;

    if (file != null) {
      const body = new FormData();
      body.append('file', file);

      // Clear the base Content-Type header (empty string removes it via mergeRequestHeaders) so fetch auto-detects multipart/form-data with the correct boundary from the FormData body.
      return context.fetch(url, { method: 'POST', headers: { 'Content-Type': '' }, body });
    } else if (attachmentUrl) {
      const urlWithAttachment = `${url}&${makeUrlSearchParams({ attachment_url: attachmentUrl }).toString()}`;
      return context.fetch(urlWithAttachment, { method: 'POST' });
    } else {
      throw new Error('file or attachmentUrl must be provided.');
    }
  };
}

/**
 * Input for downloading a specific attachment from a record.
 */
export interface ZohoRecruitDownloadAttachmentForRecordRequest extends ZohoRecruitGetRecordByIdInput {
  readonly attachment_id: ZohoRecruitAttachmentRecordId;
}

export type ZohoRecruitDownloadAttachmentForRecordResponse = FetchFileResponse;
export type ZohoRecruitDownloadAttachmentForRecordFunction = (input: ZohoRecruitDownloadAttachmentForRecordRequest) => Promise<ZohoRecruitDownloadAttachmentForRecordResponse>;

/**
 * Downloads an attachment from a record.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/download-attachments.html
 */
export function zohoRecruitDownloadAttachmentForRecord(context: ZohoRecruitContext): ZohoRecruitDownloadAttachmentForRecordFunction {
  return (input: ZohoRecruitDownloadAttachmentForRecordRequest) => context.fetch(`/v2/${input.module}/${input.id}/${ZOHO_RECRUIT_ATTACHMENTS_MODULE}/${input.attachment_id}`, { method: 'GET' }).then(parseFetchFileResponse);
}

/**
 * Input for deleting a specific attachment from a record.
 */
export interface ZohoRecruitDeleteAttachmentFromRecordRequest extends ZohoRecruitGetRecordByIdInput {
  readonly attachment_id: ZohoRecruitAttachmentRecordId;
}

export type ZohoRecruitDeleteAttachmentFromRecordResponse = Response;
export type ZohoRecruitDeleteAttachmentFromRecordFunction = (input: ZohoRecruitDeleteAttachmentFromRecordRequest) => Promise<ZohoRecruitDeleteAttachmentFromRecordResponse>;

/**
 * Deletes an attachment from a record.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/delete-attachments.html
 */
export function zohoRecruitDeleteAttachmentFromRecord(context: ZohoRecruitContext): ZohoRecruitDeleteAttachmentFromRecordFunction {
  return (input: ZohoRecruitDeleteAttachmentFromRecordRequest) => context.fetch(`/v2/${input.module}/${input.id}/${ZOHO_RECRUIT_ATTACHMENTS_MODULE}/${input.attachment_id}`, { method: 'DELETE' });
}

// MARK: Function
export type ZohoRecruitExecuteRestApiFunctionRequest = ZohoRecruitExecuteRestApiFunctionNormalRequest | ZohoRecruitExecuteRestApiFunctionApiSpecificRequest;

/**
 * Standard request for executing a serverless function using the context's OAuth credentials.
 */
export interface ZohoRecruitExecuteRestApiFunctionNormalRequest {
  readonly functionName: ZohoRecruitRestFunctionApiName;
  readonly params?: Maybe<ZohoRecruitExecuteRestApiFunctionParams>;
}

/**
 * Request that targets a specific API endpoint using an API key instead of OAuth, allowing cross-environment calls.
 */
export interface ZohoRecruitExecuteRestApiFunctionApiSpecificRequest extends ZohoRecruitExecuteRestApiFunctionNormalRequest {
  /**
   * If provided the function will use the API key provided instead of the internal oauth
   */
  readonly apiKey: Maybe<ZohoRecruitRestFunctionApiKey>;
  /**
   * If provided, the function will target the given API and not the default. Only used when apiKey is provided.
   *
   * Careful when using this, as it might indicate that the target is not environment specific/aware.
   */
  readonly apiUrl?: ZohoRecruitConfigApiUrlInput;
}

export type ZohoRecruitRestFunctionApiKey = string;

export type ZohoRecruitExecuteRestApiFunctionParams = Record<string, string | number | boolean | ZohoDateTimeString>;

export type ZohoRecruitExecuteRestApiFunctionResponse = ZohoRecruitExecuteRestApiFunctionSuccessResponse | ZohoRecruitExecuteRestApiFunctionErrorResponse;

export interface ZohoRecruitExecuteRestApiFunctionSuccessResponse {
  readonly code: 'success';
  readonly details: ZohoRecruitExecuteRestApiFunctionSuccessDetails;
  readonly message: string;
}

export interface ZohoRecruitExecuteRestApiFunctionSuccessDetails {
  readonly userMessage: string[];
  readonly output_type: string;
  readonly id: ZohoRecruitUserId;
}

export interface ZohoRecruitExecuteRestApiFunctionErrorResponse {
  readonly code: string;
  readonly details: unknown;
  readonly message: string;
}

/**
 * Thrown when a Zoho Recruit serverless function execution fails, wrapping the error response with the API error code and message.
 */
export class ZohoRecruitExecuteRestApiFunctionError extends BaseError {
  constructor(readonly error: ZohoRecruitExecuteRestApiFunctionErrorResponse) {
    super(`An error occured during the execution of the function. Code: ${error.code}, Message: ${error.message}`);
  }
}

/**
 * Executes the Zoho Recruit function based on the input.
 *
 * If the function fails execution a ZohoRecruitExecuteRestApiFunctionError will be thrown. Other API errors may still be thrown.
 */
export type ZohoRecruitExecuteRestApiFunctionFunction = (input: ZohoRecruitExecuteRestApiFunctionRequest) => Promise<ZohoRecruitExecuteRestApiFunctionSuccessDetails>;

/**
 * Creates a function that executes Zoho Recruit serverless functions via the REST API.
 *
 * Supports both OAuth-based and API-key-based authentication. When using an API key, a custom target URL can be specified for cross-environment calls.
 *
 * OAuth Details:
 * - https://www.zoho.com/crm/developer/docs/functions/serverless-fn-oauth.html#OAuth2
 * - There is no documentation for ZohoRecruit specifically, but it seems to behave the same way
 * - You will need the following scopes: ZohoRecruit.functions.execute.READ,ZohoRecruit.functions.execute.CREATE
 */
export function zohoRecruitExecuteRestApiFunction(context: ZohoRecruitContext): ZohoRecruitExecuteRestApiFunctionFunction {
  return (input: ZohoRecruitExecuteRestApiFunctionRequest): Promise<ZohoRecruitExecuteRestApiFunctionSuccessDetails> => {
    const inputSearchParams = makeUrlSearchParams(input.params);
    const inputSearchParamsString = inputSearchParams.toString();

    const isSpecificRequest = Boolean((input as ZohoRecruitExecuteRestApiFunctionApiSpecificRequest).apiKey);

    const urlParams = (isSpecificRequest ? `auth_type=apikey&zapikey=${(input as ZohoRecruitExecuteRestApiFunctionApiSpecificRequest).apiKey}` : 'auth_type=oauth') + (inputSearchParamsString ? `&${inputSearchParamsString}` : '');
    const relativeUrl = `/v2/functions/${input.functionName}/actions/execute?${urlParams}`;
    const baseUrl = isSpecificRequest && (input as ZohoRecruitExecuteRestApiFunctionApiSpecificRequest).apiUrl != null ? zohoRecruitConfigApiUrl((input as ZohoRecruitExecuteRestApiFunctionApiSpecificRequest).apiUrl as string) : '';
    const url = `${baseUrl}${relativeUrl}`;

    return context.fetchJson<ZohoRecruitExecuteRestApiFunctionResponse>(url, zohoRecruitApiFetchJsonInput('POST')).then((x) => {
      if (x.code === 'success') {
        return (x as ZohoRecruitExecuteRestApiFunctionSuccessResponse).details;
      } else {
        throw new ZohoRecruitExecuteRestApiFunctionError(x);
      }
    });
  };
}

// MARK: Util
/**
 * Builds URL search params from input objects, omitting the `module` key since it is used in the URL path rather than query string.
 */
export function zohoRecruitUrlSearchParamsMinusModule(...input: Maybe<object | Record<string, string | number>>[]) {
  return makeUrlSearchParams(input, { omitKeys: 'module' });
}

/**
 * Builds URL search params from input objects, omitting both `id` and `module` keys since they are used in the URL path.
 */
export function zohoRecruitUrlSearchParamsMinusIdAndModule(...input: Maybe<object | Record<string, string | number>>[]) {
  return makeUrlSearchParams(input, { omitKeys: ['id', 'module'] });
}

/**
 * @deprecated use makeUrlSearchParams instead.
 */
export const zohoRecruitUrlSearchParams = makeUrlSearchParams;

/**
 * Constructs a standard {@link FetchJsonInput} for Zoho Recruit API calls with the given HTTP method and optional body.
 */
export function zohoRecruitApiFetchJsonInput(method: string, body?: Maybe<FetchJsonBody>): FetchJsonInput {
  const result = {
    method,
    body: body ?? undefined
  };

  return result;
}

// MARK: Results
/**
 * Generic response wrapper for change operations that return an array of per-record results.
 */
export type ZohoRecruitChangeObjectLikeResponse<T extends ZohoRecruitChangeObjectLikeResponseEntry = ZohoRecruitChangeObjectLikeResponseEntry> = ZohoDataArrayResultRef<T>;
/**
 * Union of success or error entry types in a change response.
 */
export type ZohoRecruitChangeObjectLikeResponseEntry<E extends ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta = ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta> = E | ZohoRecruitChangeObjectResponseErrorEntry;
/**
 * Extracts the success entry type from a change response entry union.
 */
export type ZohoRecruitChangeObjectLikeResponseSuccessEntryType<T extends ZohoRecruitChangeObjectLikeResponseEntry> = T extends ZohoRecruitChangeObjectLikeResponseEntry<infer E> ? E : never;

/**
 * Common metadata present on all successful change operation entries.
 */
export interface ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta {
  readonly code: ZohoServerSuccessCode;
  readonly status: ZohoServerSuccessStatus;
  readonly message: string;
}

/**
 * Change response augmented with pre-separated success and error entry arrays for convenient access.
 */
export type ZohoRecruitChangeObjectLikeResponseSuccessAndErrorPairs<T extends ZohoRecruitChangeObjectLikeResponseEntry> = ZohoRecruitChangeObjectLikeResponse<T> & {
  readonly successItems: ZohoRecruitChangeObjectLikeResponseSuccessEntryType<T>[];
  readonly errorItems: ZohoRecruitChangeObjectResponseErrorEntry[];
};

/**
 * Separates a change response's entries into success and error arrays based on their status.
 */
export function zohoRecruitChangeObjectLikeResponseSuccessAndErrorPairs<T extends ZohoRecruitChangeObjectLikeResponseEntry>(response: ZohoRecruitChangeObjectLikeResponse<T>): ZohoRecruitChangeObjectLikeResponseSuccessAndErrorPairs<T> {
  const { data } = response;
  const successItems: ZohoRecruitChangeObjectLikeResponseSuccessEntryType<T>[] = [];
  const errorItems: ZohoRecruitChangeObjectResponseErrorEntry[] = [];

  data.forEach((x) => {
    if (x.status === ZOHO_SUCCESS_STATUS) {
      successItems.push(x as unknown as ZohoRecruitChangeObjectLikeResponseSuccessEntryType<T>);
    } else {
      errorItems.push(x);
    }
  });

  const result: ZohoRecruitChangeObjectLikeResponseSuccessAndErrorPairs<T> = {
    ...response,
    successItems,
    errorItems
  };

  return result;
}

export type ZohoRecruitChangeObjectResponse<T extends ZohoRecruitChangeObjectResponseEntry = ZohoRecruitChangeObjectResponseEntry> = ZohoRecruitChangeObjectLikeResponse<T>;
export type ZohoRecruitChangeObjectResponseEntry<E extends ZohoRecruitChangeObjectResponseSuccessEntry = ZohoRecruitChangeObjectResponseSuccessEntry> = ZohoRecruitChangeObjectLikeResponseEntry<E>;

/**
 * Successful change entry that includes the full object details (e.g., created/updated record fields).
 */
export interface ZohoRecruitChangeObjectResponseSuccessEntry<D extends ZohoRecruitChangeObjectDetails = ZohoRecruitChangeObjectDetails> extends ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta {
  readonly details: D;
}

/**
 * Error entry from a change operation, containing the Zoho error status and details.
 */
export interface ZohoRecruitChangeObjectResponseErrorEntry extends ZohoServerErrorDataWithDetails {
  readonly status: ZohoServerErrorStatus;
}

// MARK: Multi-Record Results
/**
 * Paired result from a bulk operation, correlating each input record with its success or error outcome.
 */
export interface ZohoRecruitMultiRecordResult<I, OS, OE> {
  readonly successItems: ZohoRecruitMultiRecordResultEntry<I, OS>[];
  readonly errorItems: ZohoRecruitMultiRecordResultEntry<I, OE>[];
}

/**
 * Constraint interface requiring a status field to distinguish success from error results.
 */
export interface ZohoRecruitMultiRecordResultItem {
  readonly status: ZohoServerSuccessStatus | ZohoServerErrorStatus;
}

/**
 * Pairs each input record with its corresponding API result and separates them into success and error arrays by status.
 */
export function zohoRecruitMultiRecordResult<I, OS extends ZohoRecruitMultiRecordResultItem, OE extends ZohoRecruitMultiRecordResultItem>(input: I[], results: (OS | OE)[]): ZohoRecruitMultiRecordResult<I, OS, OE> {
  const successItems: ZohoRecruitMultiRecordResultEntry<I, OS>[] = [];
  const errorItems: ZohoRecruitMultiRecordResultEntry<I, OE>[] = [];

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

  const result: ZohoRecruitMultiRecordResult<I, OS, OE> = {
    successItems,
    errorItems
  };

  return result;
}

export interface ZohoRecruitMultiRecordResultEntry<I, O> {
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
 * @deprecated use ZohoRecruitGetRelatedRecordsPageFilter instead.
 */
export type ZohoRecruitGetNotesPageFilter = ZohoRecruitGetRelatedRecordsPageFilter;

/**
 * @deprecated Use zohoRecruitInsertRecord instead.
 */
export const insertRecord = zohoRecruitInsertRecord;

/**
 * @deprecated Use zohoRecruitUpdateRecord instead.
 */
export const updateRecord = zohoRecruitUpdateRecord;

/**
 * @deprecated Use zohoRecruitUpsertRecord instead.
 */
export const upsertRecord = zohoRecruitUpsertRecord;

/**
 * @deprecated Use zohoRecruitDeleteRecord instead.
 */
export const deleteRecord = zohoRecruitDeleteRecord;

/**
 * @deprecated Use zohoRecruitGetRecordById instead.
 */
export const getRecordById = zohoRecruitGetRecordById;

/**
 * @deprecated Use zohoRecruitGetRecords instead.
 */
export const getRecords = zohoRecruitGetRecords;

/**
 * @deprecated Use zohoRecruitSearchRecords instead.
 */
export const searchRecords = zohoRecruitSearchRecords;

/**
 * @deprecated Use zohoRecruitSearchRecordsPageFactory instead.
 */
export const searchRecordsPageFactory = zohoRecruitSearchRecordsPageFactory;

/**
 * @deprecated Use zohoRecruitGetRelatedRecordsFunctionFactory instead.
 */
export const getRelatedRecordsFunctionFactory = zohoRecruitGetRelatedRecordsFunctionFactory;

/**
 * @deprecated Use zohoRecruitGetEmailsForRecord instead.
 */
export const getEmailsForRecord = zohoRecruitGetEmailsForRecord;

/**
 * @deprecated Use zohoRecruitGetEmailsForRecordPageFactory instead.
 */
export const getEmailsForRecordPageFactory = zohoRecruitGetEmailsForRecordPageFactory;

/**
 * @deprecated Use zohoRecruitGetAttachmentsForRecord instead.
 */
export const getAttachmentsForRecord = zohoRecruitGetAttachmentsForRecord;

/**
 * @deprecated Use zohoRecruitGetAttachmentsForRecordPageFactory instead.
 */
export const getAttachmentsForRecordPageFactory = zohoRecruitGetAttachmentsForRecordPageFactory;

/**
 * @deprecated Use zohoRecruitUploadAttachmentForRecord instead.
 */
export const uploadAttachmentForRecord = zohoRecruitUploadAttachmentForRecord;

/**
 * @deprecated Use zohoRecruitDownloadAttachmentForRecord instead.
 */
export const downloadAttachmentForRecord = zohoRecruitDownloadAttachmentForRecord;

/**
 * @deprecated Use zohoRecruitDeleteAttachmentFromRecord instead.
 */
export const deleteAttachmentFromRecord = zohoRecruitDeleteAttachmentFromRecord;

/**
 * @deprecated Use zohoRecruitExecuteRestApiFunction instead.
 */
export const executeRestApiFunction = zohoRecruitExecuteRestApiFunction;

/**
 * @deprecated Use ZohoRecruitSearchRecordsPageFactory instead.
 */
export type SearchRecordsPageFactory = ZohoRecruitSearchRecordsPageFactory;

/**
 * @deprecated Use ZohoRecruitGetEmailsForRecordPageFactory instead.
 */
export type GetEmailsForRecordPageFactory = ZohoRecruitGetEmailsForRecordPageFactory;

/**
 * @deprecated Use ZohoRecruitGetAttachmentsForRecordPageFactory instead.
 */
export type GetAttachmentsForRecordPageFactory = ZohoRecruitGetAttachmentsForRecordPageFactory;
