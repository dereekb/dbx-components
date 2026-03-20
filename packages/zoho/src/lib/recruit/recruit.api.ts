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

/**
 * Union of single or multi-record update input types.
 */
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
 *
 * @param context - Zoho Recruit API context providing fetch and authentication
 * @param fetchUrlPrefix - URL path suffix for the endpoint (empty for insert/update, '/upsert' for upsert)
 * @param fetchMethod - HTTP method to use for the request
 * @returns Factory function that inserts, updates, or upserts records
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

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- array may be empty at runtime
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
 * Creates a {@link ZohoRecruitInsertRecordFunction} bound to the given context.
 *
 * Inserts one or more records into a Recruit module. When a single record is
 * provided, returns the {@link ZohoRecruitChangeObjectDetails} directly or
 * throws on error. When multiple records are provided, returns a
 * {@link ZohoRecruitUpdateRecordResult} with paired success/error arrays.
 *
 * Maximum of {@link ZOHO_RECRUIT_CRUD_FUNCTION_MAX_RECORDS_LIMIT} records per call.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that inserts records into the specified module
 *
 * @example
 * ```typescript
 * const insertRecord = zohoRecruitInsertRecord(context);
 *
 * // Single record — returns details directly or throws on error:
 * const details = await insertRecord({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   data: { First_Name: 'Jane', Last_Name: 'Doe', Email: 'jane@example.com' }
 * });
 *
 * // Multiple records — returns paired success/error arrays:
 * const result = await insertRecord({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   data: [
 *     { First_Name: 'Jane', Last_Name: 'Doe', Email: 'jane@example.com' },
 *     { First_Name: 'John', Last_Name: 'Doe', Email: 'john@example.com' }
 *   ]
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/insert-records.html
 */
export function zohoRecruitInsertRecord(context: ZohoRecruitContext): ZohoRecruitInsertRecordFunction {
  return updateRecordLikeFunction(context, '', 'POST') as ZohoRecruitInsertRecordFunction;
}

// MARK: Upsert Record
/**
 * Upsert function that can do either an insert or an update based on the input.
 */
export type ZohoRecruitUpsertRecordFunction = ZohoRecruitUpsertRecordLikeFunction;

/**
 * Creates a {@link ZohoRecruitUpsertRecordFunction} bound to the given context.
 *
 * Inserts or updates one or more records in a Recruit module based on whether
 * each record includes an `id`. Uses the `/upsert` endpoint. Single-record
 * calls return details directly or throw; multi-record calls return paired
 * success/error arrays.
 *
 * Maximum of {@link ZOHO_RECRUIT_CRUD_FUNCTION_MAX_RECORDS_LIMIT} records per call.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that upserts records in the specified module
 *
 * @example
 * ```typescript
 * const upsertRecord = zohoRecruitUpsertRecord(context);
 *
 * // Create (no id) — returns details directly:
 * const created = await upsertRecord({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   data: { Email: 'new@example.com', Last_Name: 'New' }
 * });
 *
 * // Update (with id) — returns details directly:
 * const updated = await upsertRecord({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   data: { id: existingId, First_Name: 'Updated' }
 * });
 *
 * // Mixed create and update — returns paired arrays:
 * const result = await upsertRecord({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   data: [
 *     { Email: 'create@example.com', Last_Name: 'Create' },
 *     { id: existingId, First_Name: 'Update' }
 *   ]
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/upsert-records.html
 */
export function zohoRecruitUpsertRecord(context: ZohoRecruitContext): ZohoRecruitUpsertRecordFunction {
  return updateRecordLikeFunction(context, '/upsert', 'POST') as ZohoRecruitUpsertRecordFunction;
}

// MARK: Update Record
export type ZohoRecruitUpdateRecordFunction = ZohoRecruitUpdateRecordLikeFunction;

/**
 * Creates a {@link ZohoRecruitUpdateRecordFunction} bound to the given context.
 *
 * Updates one or more existing records in a Recruit module. Each record must
 * include an `id` field. Single-record calls return details directly or throw;
 * multi-record calls return paired success/error arrays.
 *
 * Maximum of {@link ZOHO_RECRUIT_CRUD_FUNCTION_MAX_RECORDS_LIMIT} records per call.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that updates records in the specified module
 *
 * @example
 * ```typescript
 * const updateRecord = zohoRecruitUpdateRecord(context);
 *
 * // Single record — returns details directly:
 * const details = await updateRecord({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   data: { id: recordId, First_Name: 'Updated Name' }
 * });
 *
 * // Multiple records — returns paired arrays:
 * const result = await updateRecord({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   data: [
 *     { id: recordId1, First_Name: 'Updated 1' },
 *     { id: recordId2, First_Name: 'Updated 2' }
 *   ]
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/update-records.html
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
  /**
   * Whether to trigger workflow rules on deletion.
   */
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

/**
 * Response from a delete operation, with entries pre-separated into `successItems` and `errorItems`.
 */
export type ZohoRecruitDeleteRecordResponse = ZohoRecruitChangeObjectLikeResponseSuccessAndErrorPairs<ZohoRecruitDeleteRecordResponseSuccessEntry>;

/**
 * Array of successful deletion entries extracted from a delete response.
 */
export type ZohoRecruitDeleteRecordResult = ZohoRecruitChangeObjectResponseSuccessEntry[];

/**
 * Creates a {@link ZohoRecruitDeleteRecordFunction} bound to the given context.
 *
 * Deletes one or more records from a Recruit module by their IDs. Supports
 * an optional `wf_trigger` flag to execute workflow rules on deletion. Returns
 * a response with separated success and error entries.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that deletes records from the specified module
 *
 * @example
 * ```typescript
 * const deleteRecord = zohoRecruitDeleteRecord(context);
 *
 * const result = await deleteRecord({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   ids: candidateId
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/delete-records.html
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

/**
 * Raw API response wrapping a single record in a data array.
 */
export type ZohoRecruitGetRecordByIdResponse<T = ZohoRecruitRecord> = ZohoDataArrayResultRef<T>;

/**
 * Unwrapped record returned by {@link ZohoRecruitGetRecordByIdFunction}.
 */
export type ZohoRecruitGetRecordByIdResult<T = ZohoRecruitRecord> = T;

/**
 * Retrieves a single record from a Recruit module by its ID.
 * Throws {@link ZohoRecruitRecordNoContentError} if the record is not found.
 */
export type ZohoRecruitGetRecordByIdFunction = <T = ZohoRecruitRecord>(input: ZohoRecruitGetRecordByIdInput) => Promise<ZohoRecruitGetRecordByIdResult<T>>;

/**
 * Creates a {@link ZohoRecruitGetRecordByIdFunction} bound to the given context.
 *
 * Retrieves a single record from a Recruit module by its ID. The response is
 * unwrapped from the standard data array, returning the record directly.
 * Throws if the record is not found.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that retrieves a record by module name and ID
 *
 * @example
 * ```typescript
 * const getRecordById = zohoRecruitGetRecordById(context);
 *
 * const record = await getRecordById({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   id: candidateId
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/get-records.html
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

/**
 * Paginated response containing records and page metadata.
 */
export type ZohoRecruitGetRecordsResponse<T = ZohoRecruitRecord> = ZohoPageResult<T>;

/**
 * Retrieves a paginated list of records from a Recruit module.
 */
export type ZohoRecruitGetRecordsFunction = <T = ZohoRecruitRecord>(input: ZohoRecruitGetRecordsInput) => Promise<ZohoRecruitGetRecordsResponse<T>>;

/**
 * Creates a {@link ZohoRecruitGetRecordsFunction} bound to the given context.
 *
 * Retrieves a paginated list of records from a Recruit module. Supports field
 * selection, sorting, custom view filtering, territory filtering, and
 * conversion/approval status filters via {@link ZohoRecruitGetRecordsInput}.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that retrieves paginated records from a module
 *
 * @example
 * ```typescript
 * const getRecords = zohoRecruitGetRecords(context);
 *
 * const page = await getRecords({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   per_page: 10
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/get-records.html
 */
export function zohoRecruitGetRecords(context: ZohoRecruitContext): ZohoRecruitGetRecordsFunction {
  return ((input: ZohoRecruitGetRecordsInput) => context.fetchJson<ZohoRecruitGetRecordsResponse>(`/v2/${input.module}?${zohoRecruitUrlSearchParamsMinusModule(input).toString()}`, zohoRecruitApiFetchJsonInput('GET'))) as ZohoRecruitGetRecordsFunction;
}

// MARK: Search Records
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

/**
 * Paginated response from a search operation, identical in shape to {@link ZohoRecruitGetRecordsResponse}.
 */
export type ZohoRecruitSearchRecordsResponse<T = ZohoRecruitRecord> = ZohoRecruitGetRecordsResponse<T>;

/**
 * Searches records in a Recruit module using criteria, email, phone, or keyword.
 * Returns a paginated result defaulting to an empty data array when no matches are found.
 */
export type ZohoRecruitSearchRecordsFunction = <T = ZohoRecruitRecord>(input: ZohoRecruitSearchRecordsInput<T>) => Promise<ZohoRecruitSearchRecordsResponse<T>>;

/**
 * Creates a {@link ZohoRecruitSearchRecordsFunction} bound to the given context.
 *
 * Searches records in a Recruit module using one of: criteria tree (compiled
 * via {@link zohoRecruitSearchRecordsCriteriaString}), email, phone, or keyword.
 * At least one search parameter must be provided. Returns a paginated result,
 * defaulting to an empty data array when no matches are found.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that searches records in the specified module
 * @throws {Error} If none of `criteria`, `email`, `phone`, or `word` are provided
 *
 * @example
 * ```typescript
 * const searchRecords = zohoRecruitSearchRecords(context);
 *
 * // Search by criteria:
 * const result = await searchRecords({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   criteria: [{ field: 'Last_Name', filter: 'starts_with', value: 'Smith' }],
 *   per_page: 10
 * });
 *
 * // Search by keyword:
 * const wordResult = await searchRecords({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   word: 'engineer'
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/search-records.html
 */
export function zohoRecruitSearchRecords(context: ZohoRecruitContext): ZohoRecruitSearchRecordsFunction {
  function searchRecordsUrlSearchParams<T = ZohoRecruitRecord>(input: ZohoRecruitSearchRecordsInput<T>) {
    const baseInput = { ...input };
    delete baseInput.criteria;

    if (input.criteria != null) {
      const criteriaString = zohoRecruitSearchRecordsCriteriaString<T>(input.criteria);
      baseInput.criteria = criteriaString;
    }

    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Zoho API migration pending
    if (!baseInput.word && !input.criteria && !input.email && !input.phone) {
      throw new Error('At least one of word, criteria, email, or phone must be provided');
    }

    return zohoRecruitUrlSearchParamsMinusModule(baseInput);
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- fetchJson may return null for empty results
  return (<T = ZohoRecruitRecord>(input: ZohoRecruitSearchRecordsInput<T>) => context.fetchJson<ZohoRecruitSearchRecordsResponse<T>>(`/v2/${input.module}/search?${searchRecordsUrlSearchParams(input).toString()}`, zohoRecruitApiFetchJsonInput('GET')).then((x) => x ?? { data: [], info: { more_records: false } })) as ZohoRecruitSearchRecordsFunction;
}

/**
 * Factory function type that produces paginated iterators over search results.
 */
export type ZohoRecruitSearchRecordsPageFactory = <T = ZohoRecruitRecord>(input: ZohoRecruitSearchRecordsInput<T>, options?: Maybe<FetchPageFactoryOptions<ZohoRecruitSearchRecordsInput<T>, ZohoRecruitSearchRecordsResponse<T>>>) => FetchPage<ZohoRecruitSearchRecordsInput<T>, ZohoRecruitSearchRecordsResponse<T>>;

/**
 * Creates a {@link ZohoRecruitSearchRecordsPageFactory} bound to the given context.
 *
 * Returns a page factory that automatically handles Zoho Recruit's pagination,
 * making it easy to iterate through all search results across multiple pages.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Page factory for iterating over search results
 *
 * @example
 * ```typescript
 * const pageFactory = zohoRecruitSearchRecordsPageFactory(context);
 *
 * const fetchPage = pageFactory({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   criteria: [{ field: 'Last_Name', filter: 'starts_with', value: 'Smith' }],
 *   per_page: 5
 * });
 *
 * const firstPage = await fetchPage.fetchNext();
 * const secondPage = await firstPage.fetchNext();
 * ```
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

/**
 * Pagination filter for related records requests, equivalent to {@link ZohoPageFilter}.
 */
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

/**
 * Paginated response containing related records and page metadata.
 */
export type ZohoRecruitGetRelatedRecordsResponse<T = ZohoRecruitRecord> = ZohoPageResult<T>;

/**
 * Typed function for fetching related records of a specific target module from a parent record.
 */
export type ZohoRecruitGetRelatedRecordsFunction<T = ZohoRecruitRecord> = (input: ZohoRecruitGetRelatedRecordsRequest) => Promise<ZohoRecruitGetRelatedRecordsResponse<T>>;

/**
 * Creates a {@link ZohoRecruitGetRelatedRecordsFunctionFactory} bound to the given context.
 *
 * Returns a factory that produces typed functions for fetching related records
 * (e.g. Notes, Emails, Attachments) of a specific target module. The factory
 * accepts a {@link ZohoRecruitGetRelatedRecordsFunctionConfig} to specify the
 * target module and empty-result behavior. By default, returns an empty page
 * result instead of null when no records are found.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Factory that creates typed related-records retrieval functions
 *
 * @example
 * ```typescript
 * const factory = zohoRecruitGetRelatedRecordsFunctionFactory(context);
 *
 * // Create a typed function for fetching related Notes:
 * const getNotesForRecord = factory<ZohoRecruitRecordNote>({
 *   targetModule: ZOHO_RECRUIT_NOTES_MODULE
 * });
 *
 * const notes = await getNotesForRecord({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   id: candidateId
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/get-related-records.html
 */
export function zohoRecruitGetRelatedRecordsFunctionFactory(context: ZohoRecruitContext): ZohoRecruitGetRelatedRecordsFunctionFactory {
  return <T = ZohoRecruitRecord>(config: ZohoRecruitGetRelatedRecordsFunctionConfig) => {
    const { targetModule, returnEmptyRecordsInsteadOfNull = true } = config;
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Zoho API migration pending
    return (input: ZohoRecruitGetRelatedRecordsRequest) => context.fetchJson<ZohoRecruitGetRelatedRecordsResponse<T>>(`/v2/${input.module}/${input.id}/${targetModule}?${zohoRecruitUrlSearchParamsMinusIdAndModule(input, input.filter).toString()}`, zohoRecruitApiFetchJsonInput('GET')).then((x) => x ?? (returnEmptyRecordsInsteadOfNull !== false ? emptyZohoPageResult<T>() : x)); // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- fetchJson may return null for empty results
  };
}

// MARK: Emails
/**
 * Request input for fetching emails related to a record.
 */
export type ZohoRecruitGetEmailsForRecordRequest = ZohoRecruitGetRelatedRecordsRequest;

/**
 * Paginated response containing email metadata entries for a record.
 */
export type ZohoRecruitGetEmailsForRecordResponse = ZohoPageResult<ZohoRecruitRecordEmailMetadata>;

/**
 * Retrieves paginated email metadata for a specific record in a module.
 */
export type ZohoRecruitGetEmailsForRecordFunction = (input: ZohoRecruitGetEmailsForRecordRequest) => Promise<ZohoRecruitGetEmailsForRecordResponse>;

/**
 * Creates a {@link ZohoRecruitGetEmailsForRecordFunction} bound to the given context.
 *
 * Retrieves email metadata related to a specific record by targeting the
 * Emails module via the related records API. Returns a paginated result of
 * {@link ZohoRecruitRecordEmailMetadata} entries. When no emails exist for the
 * record, the result contains an empty data array rather than null.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that retrieves emails for a record
 *
 * @example
 * ```typescript
 * const getEmailsForRecord = zohoRecruitGetEmailsForRecord(context);
 *
 * const result = await getEmailsForRecord({
 *   id: candidateId,
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/get-related-records.html
 */
export function zohoRecruitGetEmailsForRecord(context: ZohoRecruitContext): ZohoRecruitGetEmailsForRecordFunction {
  return zohoRecruitGetRelatedRecordsFunctionFactory(context)<ZohoRecruitRecordEmailMetadata>({ targetModule: ZOHO_RECRUIT_EMAILS_MODULE });
}

/**
 * Page factory type for paginated email retrieval.
 */
export type ZohoRecruitGetEmailsForRecordPageFactory = FetchPageFactory<ZohoRecruitGetEmailsForRecordRequest, ZohoRecruitGetEmailsForRecordResponse>;

/**
 * Creates a {@link ZohoRecruitGetEmailsForRecordPageFactory} bound to the given context.
 *
 * Returns a page factory for iterating over emails related to a record across
 * multiple pages. Wraps {@link zohoRecruitGetEmailsForRecord} with automatic
 * pagination handling via {@link zohoFetchPageFactory}.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Page factory for iterating over record emails
 *
 * @example
 * ```typescript
 * const pageFactory = zohoRecruitGetEmailsForRecordPageFactory(context);
 *
 * const fetchPage = pageFactory({
 *   id: candidateId,
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   per_page: 5
 * });
 *
 * const firstPage = await fetchPage.fetchNext();
 *
 * if (firstPage.result.info.more_records) {
 *   const secondPage = await firstPage.fetchNext();
 * }
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/get-related-records.html
 */
export function zohoRecruitGetEmailsForRecordPageFactory(context: ZohoRecruitContext): ZohoRecruitGetEmailsForRecordPageFactory {
  return zohoFetchPageFactory(zohoRecruitGetEmailsForRecord(context));
}

// MARK: Attachments
/**
 * Request input for fetching attachments related to a record.
 */
export type ZohoRecruitGetAttachmentsForRecordRequest = ZohoRecruitGetRelatedRecordsRequest;

/**
 * Paginated response containing attachment metadata entries for a record.
 */
export type ZohoRecruitGetAttachmentsForRecordResponse = ZohoPageResult<ZohoRecruitRecordAttachmentMetadata>;

/**
 * Retrieves paginated attachment metadata for a specific record in a module.
 */
export type ZohoRecruitGetAttachmentsForRecordFunction = (input: ZohoRecruitGetAttachmentsForRecordRequest) => Promise<ZohoRecruitGetAttachmentsForRecordResponse>;

/**
 * Creates a {@link ZohoRecruitGetAttachmentsForRecordFunction} bound to the given context.
 *
 * Retrieves attachment metadata related to a specific record by targeting the
 * Attachments module via the related records API. Returns a paginated result of
 * {@link ZohoRecruitRecordAttachmentMetadata} entries including file names, sizes,
 * and category information. When no attachments exist for the record, the result
 * contains an empty data array rather than null.
 *
 * Each attachment entry includes a `$type` field that distinguishes between
 * directly uploaded attachments (`'Attachment'`) and linked attachments.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that retrieves attachments for a record
 *
 * @example
 * ```typescript
 * const getAttachmentsForRecord = zohoRecruitGetAttachmentsForRecord(context);
 *
 * const result = await getAttachmentsForRecord({
 *   id: candidateId,
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE
 * });
 *
 * // Filter to only directly uploaded attachments (downloadable):
 * const downloadable = result.data.filter((x) => x.$type === 'Attachment');
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/get-related-records.html
 */
export function zohoRecruitGetAttachmentsForRecord(context: ZohoRecruitContext): ZohoRecruitGetAttachmentsForRecordFunction {
  return zohoRecruitGetRelatedRecordsFunctionFactory(context)<ZohoRecruitRecordAttachmentMetadata>({ targetModule: ZOHO_RECRUIT_ATTACHMENTS_MODULE });
}

/**
 * Page factory type for paginated attachment retrieval.
 */
export type ZohoRecruitGetAttachmentsForRecordPageFactory = FetchPageFactory<ZohoRecruitGetAttachmentsForRecordRequest, ZohoRecruitGetAttachmentsForRecordResponse>;

/**
 * Creates a {@link ZohoRecruitGetAttachmentsForRecordPageFactory} bound to the given context.
 *
 * Returns a page factory for iterating over attachments related to a record
 * across multiple pages. Wraps {@link zohoRecruitGetAttachmentsForRecord} with
 * automatic pagination handling via {@link zohoFetchPageFactory}.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Page factory for iterating over record attachments
 *
 * @example
 * ```typescript
 * const pageFactory = zohoRecruitGetAttachmentsForRecordPageFactory(context);
 *
 * const fetchPage = pageFactory({
 *   id: candidateId,
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   per_page: 10
 * });
 *
 * const firstPage = await fetchPage.fetchNext();
 *
 * if (firstPage.result.info.more_records) {
 *   const secondPage = await firstPage.fetchNext();
 * }
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/get-related-records.html
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

/**
 * Raw fetch {@link Response} from the upload attachment endpoint.
 */
export type ZohoRecruitUploadAttachmentForRecordResponse = Response;

/**
 * Uploads a file or URL-based attachment to a specific record in a module.
 */
export type ZohoRecruitUploadAttachmentForRecordFunction = (input: ZohoRecruitUploadAttachmentForRecordRequest) => Promise<ZohoRecruitUploadAttachmentForRecordResponse>;

/**
 * Creates a {@link ZohoRecruitUploadAttachmentForRecordFunction} bound to the given context.
 *
 * Uploads an attachment to a specific record. Supports either a direct
 * {@link File} upload (sent as multipart/form-data) or a URL from which Zoho
 * will fetch the file. An attachment category must be specified by ID or name.
 * Maximum file size is {@link ZOHO_RECRUIT_ATTACHMENT_MAX_SIZE} (20MB).
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that uploads an attachment to a record
 * @throws {Error} If neither `file` nor `attachmentUrl` is provided
 * @throws {Error} If neither `attachmentCategoryId` nor `attachmentCategoryName` is provided
 *
 * @example
 * ```typescript
 * const uploadAttachment = zohoRecruitUploadAttachmentForRecord(context);
 *
 * // Upload a file directly:
 * await uploadAttachment({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   id: candidateId,
 *   file: new File(['content'], 'resume.pdf', { type: 'application/pdf' }),
 *   attachmentCategoryName: 'Resume'
 * });
 *
 * // Upload from a URL:
 * await uploadAttachment({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   id: candidateId,
 *   attachmentUrl: 'https://example.com/document.pdf',
 *   attachmentCategoryName: 'Others'
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/upload-attachment.html
 */
export function zohoRecruitUploadAttachmentForRecord(context: ZohoRecruitContext): ZohoRecruitUploadAttachmentForRecordFunction {
  return (input: ZohoRecruitUploadAttachmentForRecordRequest) => {
    const { attachmentCategoryId, attachmentCategoryName, file, attachmentUrl } = input;

    const urlParams = {
      attachments_category_id: joinStringsWithCommas(attachmentCategoryId),
      attachments_category: joinStringsWithCommas(attachmentCategoryName)
    };

    if (!urlParams.attachments_category_id.length && !urlParams.attachments_category.length) {
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

/**
 * Parsed file response containing the downloaded attachment data and metadata (file name, content type, etc.).
 */
export type ZohoRecruitDownloadAttachmentForRecordResponse = FetchFileResponse;

/**
 * Downloads a specific attachment from a record, returning a parsed {@link FetchFileResponse}.
 */
export type ZohoRecruitDownloadAttachmentForRecordFunction = (input: ZohoRecruitDownloadAttachmentForRecordRequest) => Promise<ZohoRecruitDownloadAttachmentForRecordResponse>;

/**
 * Creates a {@link ZohoRecruitDownloadAttachmentForRecordFunction} bound to the given context.
 *
 * Downloads a specific attachment from a record. Returns a parsed
 * {@link FetchFileResponse} containing the file data and metadata extracted
 * from the response headers.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that downloads an attachment by record and attachment ID
 *
 * @example
 * ```typescript
 * const downloadAttachment = zohoRecruitDownloadAttachmentForRecord(context);
 *
 * const fileResponse = await downloadAttachment({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   id: candidateId,
 *   attachment_id: attachmentId
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/download-attachments.html
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

/**
 * Raw fetch {@link Response} from the delete attachment endpoint.
 */
export type ZohoRecruitDeleteAttachmentFromRecordResponse = Response;

/**
 * Deletes a specific attachment from a record by its attachment ID.
 */
export type ZohoRecruitDeleteAttachmentFromRecordFunction = (input: ZohoRecruitDeleteAttachmentFromRecordRequest) => Promise<ZohoRecruitDeleteAttachmentFromRecordResponse>;

/**
 * Creates a {@link ZohoRecruitDeleteAttachmentFromRecordFunction} bound to the given context.
 *
 * Deletes a specific attachment from a record by its attachment ID.
 * Returns the raw {@link Response}.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that deletes an attachment by record and attachment ID
 *
 * @example
 * ```typescript
 * const deleteAttachment = zohoRecruitDeleteAttachmentFromRecord(context);
 *
 * const response = await deleteAttachment({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   id: candidateId,
 *   attachment_id: attachmentId
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/delete-attachments.html
 */
export function zohoRecruitDeleteAttachmentFromRecord(context: ZohoRecruitContext): ZohoRecruitDeleteAttachmentFromRecordFunction {
  return (input: ZohoRecruitDeleteAttachmentFromRecordRequest) => context.fetch(`/v2/${input.module}/${input.id}/${ZOHO_RECRUIT_ATTACHMENTS_MODULE}/${input.attachment_id}`, { method: 'DELETE' });
}

// MARK: Function
/**
 * Union of request types for executing a Zoho Recruit serverless function.
 * Either uses the context's OAuth credentials or an explicit API key.
 */
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

/**
 * API key string used for authenticating serverless function calls outside of OAuth.
 */
export type ZohoRecruitRestFunctionApiKey = string;

/**
 * Key-value parameters passed to a serverless function as query string arguments.
 */
export type ZohoRecruitExecuteRestApiFunctionParams = Record<string, string | number | boolean | ZohoDateTimeString>;

/**
 * Union of success or error responses from a serverless function execution.
 */
export type ZohoRecruitExecuteRestApiFunctionResponse = ZohoRecruitExecuteRestApiFunctionSuccessResponse | ZohoRecruitExecuteRestApiFunctionErrorResponse;

/**
 * Successful response from a serverless function execution, containing the function's output details.
 */
export interface ZohoRecruitExecuteRestApiFunctionSuccessResponse {
  readonly code: 'success';
  readonly details: ZohoRecruitExecuteRestApiFunctionSuccessDetails;
  readonly message: string;
}

/**
 * Details payload from a successful serverless function execution, including any user messages and the invoking user's ID.
 */
export interface ZohoRecruitExecuteRestApiFunctionSuccessDetails {
  readonly userMessage: string[];
  readonly output_type: string;
  readonly id: ZohoRecruitUserId;
}

/**
 * Error response from a serverless function execution, containing the error code and message.
 */
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
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that executes serverless functions via the REST API
 * @throws {ZohoRecruitExecuteRestApiFunctionError} If the function execution fails
 *
 * @example
 * ```typescript
 * const executeFunction = zohoRecruitExecuteRestApiFunction(context);
 *
 * // Execute using OAuth credentials:
 * const result = await executeFunction({ functionName: 'my_function' });
 *
 * // Execute with parameters:
 * const paramResult = await executeFunction({
 *   functionName: 'process_candidate',
 *   params: { candidate_id: '12345', action: 'approve' }
 * });
 *
 * // Execute using an API key (cross-environment):
 * const apiResult = await executeFunction({
 *   functionName: 'my_function',
 *   apiKey: 'your-api-key',
 *   apiUrl: 'production'
 * });
 * ```
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
 *
 * @param input - One or more objects whose key-value pairs become query parameters
 * @returns URLSearchParams with the `module` key excluded
 */
export function zohoRecruitUrlSearchParamsMinusModule(...input: Maybe<object | Record<string, string | number>>[]) {
  return makeUrlSearchParams(input, { omitKeys: 'module' });
}

/**
 * Builds URL search params from input objects, omitting both `id` and `module` keys since they are used in the URL path.
 *
 * @param input - One or more objects whose key-value pairs become query parameters
 * @returns URLSearchParams with `id` and `module` keys excluded
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
 *
 * @param method - HTTP method for the request
 * @param body - Optional JSON body to include in the request
 * @returns Configured fetch JSON input
 */
export function zohoRecruitApiFetchJsonInput(method: string, body?: Maybe<FetchJsonBody>): FetchJsonInput {
  return {
    method,
    body: body ?? undefined
  };
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
 *
 * Iterates over the `data` array from a Zoho Recruit change operation response and
 * partitions entries into `successItems` and `errorItems` based on their `status` field.
 * The original response is spread into the result, so all original fields remain accessible.
 *
 * Used internally by {@link zohoRecruitDeleteRecord} and similar functions to provide
 * convenient access to separated success/error results.
 *
 * @param response - Raw change operation response containing mixed success/error entries
 * @returns The response augmented with pre-separated `successItems` and `errorItems` arrays
 *
 * @example
 * ```typescript
 * const rawResponse = await context.fetchJson<ZohoRecruitChangeObjectLikeResponse>(...);
 * const result = zohoRecruitChangeObjectLikeResponseSuccessAndErrorPairs(rawResponse);
 *
 * result.successItems; // entries with status === 'success'
 * result.errorItems;   // entries with non-success status
 * ```
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

/**
 * Concrete change response type for insert/update/upsert operations, wrapping an array of per-record entries.
 */
export type ZohoRecruitChangeObjectResponse<T extends ZohoRecruitChangeObjectResponseEntry = ZohoRecruitChangeObjectResponseEntry> = ZohoRecruitChangeObjectLikeResponse<T>;

/**
 * Union of success or error entry types in an insert/update/upsert response.
 */
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
 *
 * Iterates over the `input` and `results` arrays in parallel, matching each input record
 * to its positional result. Entries are classified as success or error based on
 * the result's `status` field matching {@link ZOHO_SUCCESS_STATUS}.
 *
 * Used internally by {@link updateRecordLikeFunction} to pair input data with API outcomes
 * for insert, update, and upsert operations.
 *
 * @param input - Array of input records that were submitted to the API
 * @param results - Array of per-record results returned by the API, positionally aligned with `input`
 * @returns Object with `successItems` and `errorItems`, each containing paired `{ input, result }` entries
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
   * The API result for this record (success or error entry).
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
