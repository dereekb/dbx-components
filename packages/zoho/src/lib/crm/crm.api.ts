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
import { type ArrayOrValue, type EmailAddress, type Maybe, type PhoneNumber, type SortingOrder, type UniqueModelWithId, asArray, joinStringsWithCommas } from '@dereekb/util';
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

/**
 * Paired success/error results from a multi-record update, upsert, or insert operation.
 */
export type ZohoCrmUpdateRecordResult<T> = ZohoCrmMultiRecordResult<T, ZohoCrmChangeObjectResponseSuccessEntry, ZohoCrmChangeObjectResponseErrorEntry>;
/**
 * Raw API response from a record change operation containing the data array.
 */
export type ZohoCrmUpdateRecordResponse = ZohoCrmChangeObjectResponse;

/**
 * Record data for creation, excluding the `id` field since it is assigned by Zoho.
 */
export type ZohoCrmCreateRecordData<T> = Omit<T, 'id'>;

/**
 * Input for creating a single record in a CRM module.
 */
export interface ZohoCrmCreateSingleRecordInput<T> extends ZohoCrmModuleNameRef {
  readonly data: ZohoCrmCreateRecordData<T>;
}

/**
 * Input for creating multiple records in a CRM module in a single API call.
 */
export interface ZohoCrmCreateMultiRecordInput<T> extends ZohoCrmModuleNameRef {
  readonly data: ZohoCrmCreateRecordData<T>[];
}

/**
 * Overloaded function type that handles both single and multi-record creation.
 */
export type ZohoCrmCreateRecordLikeFunction = ZohoCrmCreateMultiRecordFunction & ZohoCrmCreateSingleRecordFunction;
/**
 * Creates a single record and resolves with the created record's details.
 */
export type ZohoCrmCreateSingleRecordFunction = <T>(input: ZohoCrmCreateSingleRecordInput<T>) => Promise<ZohoCrmChangeObjectDetails>;
/**
 * Creates multiple records and resolves with paired success/error results.
 */
export type ZohoCrmCreateMultiRecordFunction = <T>(input: ZohoCrmCreateMultiRecordInput<T>) => Promise<ZohoCrmUpdateRecordResult<T>>;

/**
 * Discriminated input for updating one or more records.
 */
export type ZohoCrmUpdateRecordInput<T> = ZohoCrmUpdateSingleRecordInput<T> | ZohoCrmUpdateMultiRecordInput<T>;
/**
 * Partial record data for updates, requiring the `id` to identify the target record.
 */
export type ZohoCrmUpdateRecordData<T> = UniqueModelWithId & Partial<T>;

/**
 * Input for updating a single record in a CRM module.
 */
export interface ZohoCrmUpdateSingleRecordInput<T> extends ZohoCrmModuleNameRef {
  readonly data: ZohoCrmUpdateRecordData<T>;
}

/**
 * Input for updating multiple records in a CRM module in a single API call.
 */
export interface ZohoCrmUpdateMultiRecordInput<T> extends ZohoCrmModuleNameRef {
  readonly data: ZohoCrmUpdateRecordData<T>[];
}

/**
 * Overloaded function type that handles both single and multi-record updates.
 */
export type ZohoCrmUpdateRecordLikeFunction = ZohoCrmUpdateMultiRecordFunction & ZohoCrmUpdateSingleRecordFunction;
/**
 * Updates multiple records and resolves with paired success/error results.
 */
export type ZohoCrmUpdateMultiRecordFunction = <T>(input: ZohoCrmUpdateMultiRecordInput<T>) => Promise<ZohoCrmUpdateRecordResult<T>>;
/**
 * Updates a single record and resolves with the updated record's details.
 */
export type ZohoCrmUpdateSingleRecordFunction = <T>(input: ZohoCrmUpdateSingleRecordInput<T>) => Promise<ZohoCrmChangeObjectDetails>;

/**
 * Record data for upsert, accepting either create data (without `id`) or update data (with `id`).
 */
export type ZohoCrmUpsertRecordData<T> = ZohoCrmCreateRecordData<T> | ZohoCrmUpdateRecordData<T>;

/**
 * Input for upserting a single record in a CRM module.
 */
export interface ZohoCrmUpsertSingleRecordInput<T> extends ZohoCrmModuleNameRef {
  readonly data: ZohoCrmUpsertRecordData<T>;
}

/**
 * Input for upserting multiple records in a CRM module in a single API call.
 */
export interface ZohoCrmUpsertMultiRecordInput<T> extends ZohoCrmModuleNameRef {
  readonly data: ZohoCrmUpsertRecordData<T>[];
}

/**
 * Overloaded function type that handles both single and multi-record upserts.
 */
export type ZohoCrmUpsertRecordLikeFunction = ZohoCrmUpsertMultiRecordFunction & ZohoCrmUpsertSingleRecordFunction;
/**
 * Upserts multiple records and resolves with paired success/error results.
 */
export type ZohoCrmUpsertMultiRecordFunction = <T>(input: ZohoCrmUpsertMultiRecordInput<T>) => Promise<ZohoCrmUpdateRecordResult<T>>;
/**
 * Upserts a single record and resolves with the record's details.
 */
export type ZohoCrmUpsertSingleRecordFunction = <T>(input: ZohoCrmUpsertSingleRecordInput<T>) => Promise<ZohoCrmChangeObjectDetails>;

/**
 * Shared implementation for the Insert, Upsert, and Update endpoints, which all share the same request/response structure.
 *
 * When a single record is provided, the function returns the change details directly or throws on error.
 * When multiple records are provided, it returns a paired success/error result.
 *
 * @param context - Authenticated Zoho CRM context for making API calls
 * @param fetchUrlPrefix - URL path segment appended after the module name (empty string for insert/update, '/upsert' for upsert)
 * @param fetchMethod - HTTP method to use for the request (POST for insert/upsert, PUT for update)
 * @returns Overloaded function handling both single and multi-record operations
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
/**
 * Alias for the insert record function, supporting both single and multi-record creation.
 */
export type ZohoCrmInsertRecordFunction = ZohoCrmCreateRecordLikeFunction;

/**
 * Creates a {@link ZohoCrmInsertRecordFunction} bound to the given context.
 *
 * Inserts one or more records into a CRM module. When a single record is
 * provided, returns the {@link ZohoCrmChangeObjectDetails} directly or
 * throws on error. When multiple records are provided, returns a
 * {@link ZohoCrmUpdateRecordResult} with paired success/error arrays.
 *
 * Maximum of {@link ZOHO_CRM_CRUD_FUNCTION_MAX_RECORDS_LIMIT} records per call.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Function that inserts records into the specified module
 *
 * @example
 * ```typescript
 * const insertRecord = zohoCrmInsertRecord(context);
 *
 * // Single record — returns details directly or throws on error:
 * const details = await insertRecord({
 *   module: 'Contacts',
 *   data: { First_Name: 'Jane', Last_Name: 'Doe', Email: 'jane@example.com' }
 * });
 *
 * // Multiple records — returns paired success/error arrays:
 * const result = await insertRecord({
 *   module: 'Contacts',
 *   data: [
 *     { First_Name: 'Jane', Last_Name: 'Doe', Email: 'jane@example.com' },
 *     { First_Name: 'John', Last_Name: 'Doe', Email: 'john@example.com' }
 *   ]
 * });
 * ```
 *
 * @see https://www.zoho.com/crm/developer-guide/apiv2/insert-records.html
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
 * Creates a {@link ZohoCrmUpsertRecordFunction} bound to the given context.
 *
 * Inserts or updates one or more records in a CRM module based on whether
 * each record includes an `id`. Uses the `/upsert` endpoint. Single-record
 * calls return details directly or throw; multi-record calls return paired
 * success/error arrays.
 *
 * Maximum of {@link ZOHO_CRM_CRUD_FUNCTION_MAX_RECORDS_LIMIT} records per call.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Function that upserts records in the specified module
 *
 * @example
 * ```typescript
 * const upsertRecord = zohoCrmUpsertRecord(context);
 *
 * // Create (no id) — returns details directly:
 * const created = await upsertRecord({
 *   module: 'Contacts',
 *   data: { Email: 'new@example.com', Last_Name: 'New' }
 * });
 *
 * // Update (with id) — returns details directly:
 * const updated = await upsertRecord({
 *   module: 'Contacts',
 *   data: { id: existingId, First_Name: 'Updated' }
 * });
 *
 * // Mixed create and update — returns paired arrays:
 * const result = await upsertRecord({
 *   module: 'Contacts',
 *   data: [
 *     { Email: 'create@example.com', Last_Name: 'Create' },
 *     { id: existingId, First_Name: 'Update' }
 *   ]
 * });
 * ```
 *
 * @see https://www.zoho.com/crm/developer-guide/apiv2/upsert-records.html
 */
export function zohoCrmUpsertRecord(context: ZohoCrmContext): ZohoCrmUpsertRecordFunction {
  return updateRecordLikeFunction(context, '/upsert', 'POST') as ZohoCrmUpsertRecordFunction;
}

// MARK: Update Record
/**
 * Alias for the update record function, supporting both single and multi-record updates.
 */
export type ZohoCrmUpdateRecordFunction = ZohoCrmUpdateRecordLikeFunction;

/**
 * Creates a {@link ZohoCrmUpdateRecordFunction} bound to the given context.
 *
 * Updates one or more existing records in a CRM module. Each record must
 * include an `id` field. Single-record calls return details directly or throw;
 * multi-record calls return paired success/error arrays.
 *
 * Maximum of {@link ZOHO_CRM_CRUD_FUNCTION_MAX_RECORDS_LIMIT} records per call.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Function that updates records in the specified module
 *
 * @example
 * ```typescript
 * const updateRecord = zohoCrmUpdateRecord(context);
 *
 * // Single record — returns details directly:
 * const details = await updateRecord({
 *   module: 'Contacts',
 *   data: { id: recordId, First_Name: 'Updated Name' }
 * });
 *
 * // Multiple records — returns paired arrays:
 * const result = await updateRecord({
 *   module: 'Contacts',
 *   data: [
 *     { id: recordId1, First_Name: 'Updated 1' },
 *     { id: recordId2, First_Name: 'Updated 2' }
 *   ]
 * });
 * ```
 *
 * @see https://www.zoho.com/crm/developer-guide/apiv2/update-records.html
 */
export function zohoCrmUpdateRecord(context: ZohoCrmContext): ZohoCrmUpdateRecordFunction {
  return updateRecordLikeFunction(context, '', 'PUT') as ZohoCrmUpdateRecordFunction;
}

// MARK: Delete Record
/**
 * Function that deletes one or more records from a module.
 */
export type ZohoCrmDeleteRecordFunction = (input: ZohoCrmDeleteRecordInput) => Promise<ZohoCrmDeleteRecordResponse>;

/**
 * Input for deleting records from a module.
 */
export interface ZohoCrmDeleteRecordInput extends ZohoCrmModuleNameRef {
  /**
   * Id or array of ids to delete.
   */
  readonly ids: ArrayOrValue<ZohoCrmRecordId>;
  /**
   * Whether to trigger workflow rules on deletion.
   */
  readonly wf_trigger?: boolean;
}

/**
 * Successful entry in a delete response, containing the deleted record's id.
 */
export interface ZohoCrmDeleteRecordResponseSuccessEntry extends ZohoCrmChangeObjectLikeResponseSuccessEntryMeta {
  readonly details: {
    readonly id: ZohoCrmRecordId;
  };
}

/**
 * Response from a delete operation, split into success and error pairs.
 */
export type ZohoCrmDeleteRecordResponse = ZohoCrmChangeObjectLikeResponseSuccessAndErrorPairs<ZohoCrmDeleteRecordResponseSuccessEntry>;

/**
 * Array of successful delete entries.
 */
export type ZohoCrmDeleteRecordResult = ZohoCrmChangeObjectResponseSuccessEntry[];

/**
 * Creates a {@link ZohoCrmDeleteRecordFunction} bound to the given context.
 *
 * Deletes one or more records from a CRM module by their IDs. Supports
 * an optional `wf_trigger` flag to execute workflow rules on deletion. Returns
 * a response with separated success and error entries.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Function that deletes records from the specified module
 *
 * @example
 * ```typescript
 * const deleteRecord = zohoCrmDeleteRecord(context);
 *
 * const result = await deleteRecord({
 *   module: 'Contacts',
 *   ids: contactId
 * });
 * ```
 *
 * @see https://www.zoho.com/crm/developer-guide/apiv2/delete-records.html
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
/**
 * Input identifying a specific record by module and id.
 */
export interface ZohoCrmGetRecordByIdInput extends ZohoCrmModuleNameRef {
  readonly id: ZohoCrmRecordId;
}

/**
 * Raw API response wrapping the record in a data array.
 */
export type ZohoCrmGetRecordByIdResponse<T = ZohoCrmRecord> = ZohoDataArrayResultRef<T>;

/**
 * The unwrapped record returned from a get-by-id call.
 */
export type ZohoCrmGetRecordByIdResult<T = ZohoCrmRecord> = T;
/**
 * Retrieves a single record by id and resolves with the unwrapped record.
 */
export type ZohoCrmGetRecordByIdFunction = <T = ZohoCrmRecord>(input: ZohoCrmGetRecordByIdInput) => Promise<ZohoCrmGetRecordByIdResult<T>>;

/**
 * Creates a {@link ZohoCrmGetRecordByIdFunction} bound to the given context.
 *
 * Retrieves a single record from a CRM module by its ID. The response is
 * unwrapped from the standard data array, returning the record directly.
 * Throws if the record is not found.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Function that retrieves a record by module name and ID
 *
 * @example
 * ```typescript
 * const getRecordById = zohoCrmGetRecordById(context);
 *
 * const record = await getRecordById({
 *   module: 'Contacts',
 *   id: contactId
 * });
 * ```
 *
 * @see https://www.zoho.com/crm/developer-guide/apiv2/get-records.html
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
 * Creates a {@link ZohoCrmGetRecordsFunction} bound to the given context.
 *
 * Retrieves a paginated list of records from a CRM module. Supports field
 * selection, sorting, custom view filtering, territory filtering, and
 * conversion/approval status filters via {@link ZohoCrmGetRecordsInput}.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Function that retrieves paginated records from a module
 *
 * @example
 * ```typescript
 * const getRecords = zohoCrmGetRecords(context);
 *
 * const page = await getRecords({
 *   module: 'Contacts',
 *   fields: 'First_Name,Last_Name,Email',
 *   per_page: 10
 * });
 * ```
 *
 * @see https://www.zoho.com/crm/developer-guide/apiv2/get-records.html
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
 * Creates a {@link ZohoCrmSearchRecordsFunction} bound to the given context.
 *
 * Searches records in a CRM module using one of: criteria tree (compiled
 * via {@link zohoCrmSearchRecordsCriteriaString}), email, phone, cvid, or keyword.
 * At least one search parameter must be provided. Returns a paginated result,
 * defaulting to an empty data array when no matches are found.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Function that searches records in the specified module
 * @throws {Error} If none of `criteria`, `email`, `phone`, `cvid`, or `word` are provided
 *
 * @example
 * ```typescript
 * const searchRecords = zohoCrmSearchRecords(context);
 *
 * // Search by criteria:
 * const result = await searchRecords({
 *   module: 'Contacts',
 *   criteria: [{ field: 'Last_Name', filter: 'starts_with', value: 'Smith' }],
 *   per_page: 10
 * });
 *
 * // Search by keyword:
 * const wordResult = await searchRecords({
 *   module: 'Contacts',
 *   word: 'engineer'
 * });
 * ```
 *
 * @see https://www.zoho.com/crm/developer-guide/apiv2/search-records.html
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

    return zohoCrmUrlSearchParamsMinusModule(baseInput);
  }

  return (<T = ZohoCrmRecord>(input: ZohoCrmSearchRecordsInput<T>) => context.fetchJson<ZohoCrmSearchRecordsResponse<T>>(`/v8/${input.module}/search?${searchRecordsUrlSearchParams(input).toString()}`, zohoCrmApiFetchJsonInput('GET')).then((x) => x ?? { data: [], info: { more_records: false } })) as ZohoCrmSearchRecordsFunction;
}

/**
 * Factory that creates paginated search iterators for search record queries.
 */
export type ZohoCrmSearchRecordsPageFactory = <T = ZohoCrmRecord>(input: ZohoCrmSearchRecordsInput<T>, options?: Maybe<FetchPageFactoryOptions<ZohoCrmSearchRecordsInput<T>, ZohoCrmSearchRecordsResponse<T>>>) => FetchPage<ZohoCrmSearchRecordsInput<T>, ZohoCrmSearchRecordsResponse<T>>;

/**
 * Creates a {@link ZohoCrmSearchRecordsPageFactory} bound to the given context.
 *
 * Returns a page factory that automatically handles Zoho CRM's pagination,
 * making it easy to iterate through all search results across multiple pages.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Page factory for iterating over search results
 *
 * @example
 * ```typescript
 * const pageFactory = zohoCrmSearchRecordsPageFactory(context);
 *
 * const fetchPage = pageFactory({
 *   module: 'Contacts',
 *   criteria: [{ field: 'Last_Name', filter: 'starts_with', value: 'Smith' }],
 *   per_page: 5
 * });
 *
 * const firstPage = await fetchPage.fetchNext();
 * const secondPage = await firstPage.fetchNext();
 * ```
 */
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
 * Creates a {@link ZohoCrmGetRelatedRecordsFunctionFactory} bound to the given context.
 *
 * Returns a factory that produces typed functions for fetching related records
 * (e.g. Notes, Emails, Attachments) of a specific target module. The factory
 * accepts a {@link ZohoCrmGetRelatedRecordsFunctionConfig} to specify the
 * target module and empty-result behavior. By default, returns an empty page
 * result instead of null when no records are found.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Factory that creates typed related-records retrieval functions
 *
 * @example
 * ```typescript
 * const factory = zohoCrmGetRelatedRecordsFunctionFactory(context);
 *
 * // Create a typed function for fetching related Notes:
 * const getNotesForRecord = factory<ZohoCrmRecordNote>({
 *   targetModule: ZOHO_CRM_NOTES_MODULE
 * });
 *
 * const notes = await getNotesForRecord({
 *   module: 'Contacts',
 *   id: contactId
 * });
 * ```
 *
 * @see https://www.zoho.com/crm/developer-guide/apiv2/get-related-records.html
 */
export function zohoCrmGetRelatedRecordsFunctionFactory(context: ZohoCrmContext): ZohoCrmGetRelatedRecordsFunctionFactory {
  return <T = ZohoCrmRecord>(config: ZohoCrmGetRelatedRecordsFunctionConfig) => {
    const { targetModule, returnEmptyRecordsInsteadOfNull = true } = config;
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Zoho API migration pending
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

/**
 * Creates a {@link ZohoCrmGetEmailsForRecordFunction} bound to the given context.
 *
 * Retrieves email metadata related to a specific record by targeting the
 * Emails module via the related records API. Normalizes the Zoho API response
 * which returns email data under an `Emails` key instead of the standard `data` key.
 * Returns a paginated result of {@link ZohoCrmRecordEmailMetadata} entries.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Function that retrieves emails for a record
 *
 * @example
 * ```typescript
 * const getEmailsForRecord = zohoCrmGetEmailsForRecord(context);
 *
 * const result = await getEmailsForRecord({
 *   id: contactId,
 *   module: 'Contacts'
 * });
 * ```
 *
 * @see https://www.zoho.com/crm/developer/docs/api/v8/get-email-rel-list.html
 */
export function zohoCrmGetEmailsForRecord(context: ZohoCrmContext): ZohoCrmGetEmailsForRecordFunction {
  const getEmailsFactory = zohoCrmGetRelatedRecordsFunctionFactory(context)<ZohoCrmRecordEmailMetadata>({ targetModule: ZOHO_CRM_EMAILS_MODULE });
  return (input: ZohoCrmGetEmailsForRecordRequest) =>
    getEmailsFactory(input).then((x) => {
      const data = x.data ?? (x as unknown as ZohoCrmGetEmailsForRecordRawApiResponse).Emails;
      return { ...x, data };
    });
}

/**
 * Factory that creates paginated iterators for fetching emails related to a record.
 */
export type ZohoCrmGetEmailsForRecordPageFactory = FetchPageFactory<ZohoCrmGetEmailsForRecordRequest, ZohoCrmGetEmailsForRecordResponse>;

/**
 * Creates a {@link ZohoCrmGetEmailsForRecordPageFactory} bound to the given context.
 *
 * Returns a page factory for iterating over emails related to a record across
 * multiple pages. Wraps {@link zohoCrmGetEmailsForRecord} with automatic
 * pagination handling via {@link zohoFetchPageFactory}.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Page factory for iterating over record emails
 *
 * @example
 * ```typescript
 * const pageFactory = zohoCrmGetEmailsForRecordPageFactory(context);
 *
 * const fetchPage = pageFactory({
 *   id: contactId,
 *   module: 'Contacts',
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
 * @see https://www.zoho.com/crm/developer/docs/api/v8/get-email-rel-list.html
 */
export function zohoCrmGetEmailsForRecordPageFactory(context: ZohoCrmContext): ZohoCrmGetEmailsForRecordPageFactory {
  return zohoFetchPageFactory(zohoCrmGetEmailsForRecord(context));
}

// MARK: Attachments
/**
 * Request for fetching attachments, requiring fields to select from the attachment metadata.
 */
export type ZohoCrmGetAttachmentsForRecordRequest = ZohoCrmGetRelatedRecordsRequest & ZohoCrmGetRecordsFieldsRef;
/**
 * Paginated response containing attachment metadata records.
 */
export type ZohoCrmGetAttachmentsForRecordResponse = ZohoPageResult<ZohoCrmRecordAttachmentMetadata>;
/**
 * Fetches attachment metadata for a given record.
 */
export type ZohoCrmGetAttachmentsForRecordFunction = (input: ZohoCrmGetAttachmentsForRecordRequest) => Promise<ZohoCrmGetAttachmentsForRecordResponse>;

/**
 * Creates a {@link ZohoCrmGetAttachmentsForRecordFunction} bound to the given context.
 *
 * Retrieves attachment metadata related to a specific record by targeting the
 * Attachments module via the related records API. Returns a paginated result of
 * {@link ZohoCrmRecordAttachmentMetadata} entries including file names, sizes,
 * and category information. When no attachments exist for the record, the result
 * contains an empty data array rather than null.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Function that retrieves attachments for a record
 *
 * @example
 * ```typescript
 * const getAttachmentsForRecord = zohoCrmGetAttachmentsForRecord(context);
 *
 * const result = await getAttachmentsForRecord({
 *   id: contactId,
 *   module: 'Contacts',
 *   fields: 'File_Name,Size,Created_Time'
 * });
 * ```
 *
 * @see https://www.zoho.com/crm/developer-guide/apiv2/get-related-records.html
 */
export function zohoCrmGetAttachmentsForRecord(context: ZohoCrmContext): ZohoCrmGetAttachmentsForRecordFunction {
  return zohoCrmGetRelatedRecordsFunctionFactory(context)<ZohoCrmRecordAttachmentMetadata>({ targetModule: ZOHO_CRM_ATTACHMENTS_MODULE });
}

/**
 * Factory that creates paginated iterators for fetching attachments related to a record.
 */
export type ZohoCrmGetAttachmentsForRecordPageFactory = FetchPageFactory<ZohoCrmGetAttachmentsForRecordRequest, ZohoCrmGetAttachmentsForRecordResponse>;

/**
 * Creates a {@link ZohoCrmGetAttachmentsForRecordPageFactory} bound to the given context.
 *
 * Returns a page factory for iterating over attachments related to a record
 * across multiple pages. Wraps {@link zohoCrmGetAttachmentsForRecord} with
 * automatic pagination handling via {@link zohoFetchPageFactory}.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Page factory for iterating over record attachments
 *
 * @example
 * ```typescript
 * const pageFactory = zohoCrmGetAttachmentsForRecordPageFactory(context);
 *
 * const fetchPage = pageFactory({
 *   id: contactId,
 *   module: 'Contacts',
 *   fields: 'File_Name,Size',
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
 * @see https://www.zoho.com/crm/developer-guide/apiv2/get-related-records.html
 */
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
   * File to upload as an attachment. Max 20MB.
   */
  readonly file: File;
  /**
   * The category id(s) of the attachment.
   *
   * Either this or attachmentCategoryName must be provided.
   */
  readonly attachmentCategoryId?: ArrayOrValue<ZohoCrmAttachmentCategoryId>;
  /**
   * The category name(s) of the attachment.
   *
   * Either this or attachmentCategoryId must be provided.
   *
   * Example: "Resume"
   */
  readonly attachmentCategoryName?: ArrayOrValue<KnownZohoCrmAttachmentCategoryName>;
}

export type ZohoCrmUploadAttachmentForRecordResponse = Response;
export type ZohoCrmUploadAttachmentForRecordFunction = (input: ZohoCrmUploadAttachmentForRecordRequest) => Promise<ZohoCrmUploadAttachmentForRecordResponse>;

/**
 * Creates a {@link ZohoCrmUploadAttachmentForRecordFunction} bound to the given context.
 *
 * Uploads a file attachment to a specific record. The file is sent as
 * multipart/form-data. An attachment category must be specified by ID or name.
 * Maximum file size is {@link ZOHO_CRM_ATTACHMENT_MAX_SIZE} (20MB).
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Function that uploads an attachment to a record
 * @throws {Error} If neither `attachmentCategoryId` nor `attachmentCategoryName` is provided
 *
 * @example
 * ```typescript
 * const uploadAttachment = zohoCrmUploadAttachmentForRecord(context);
 *
 * await uploadAttachment({
 *   module: 'Contacts',
 *   id: contactId,
 *   file: new File(['content'], 'resume.pdf', { type: 'application/pdf' }),
 *   attachmentCategoryName: 'Resume'
 * });
 * ```
 *
 * @see https://www.zoho.com/crm/developer/docs/api/v2.1/upload-attachment.html
 */
export function zohoCrmUploadAttachmentForRecord(context: ZohoCrmContext): ZohoCrmUploadAttachmentForRecordFunction {
  return (input: ZohoCrmUploadAttachmentForRecordRequest) => {
    const { attachmentCategoryId, attachmentCategoryName, file } = input;

    const urlParams = {
      attachments_category_id: joinStringsWithCommas(attachmentCategoryId),
      attachments_category: joinStringsWithCommas(attachmentCategoryName)
    };

    if (!urlParams.attachments_category_id?.length && !urlParams.attachments_category?.length) {
      throw new Error('attachmentCategoryId or attachmentCategoryName must be provided and not empty.');
    }

    const url = `/v8/${input.module}/${input.id}/${ZOHO_CRM_ATTACHMENTS_MODULE}?${makeUrlSearchParams(urlParams).toString()}`;
    const body = new FormData();
    body.append('file', file);

    // Clear the base Content-Type header (empty string removes it via mergeRequestHeaders) so fetch auto-detects multipart/form-data with the correct boundary from the FormData body.
    return context.fetch(url, { method: 'POST', headers: { 'Content-Type': '' }, body });
  };
}

export interface ZohoCrmDownloadAttachmentForRecordRequest extends ZohoCrmGetRecordByIdInput {
  readonly attachment_id: ZohoCrmAttachmentRecordId;
}

export type ZohoCrmDownloadAttachmentForRecordResponse = FetchFileResponse;
export type ZohoCrmDownloadAttachmentForRecordFunction = (input: ZohoCrmDownloadAttachmentForRecordRequest) => Promise<ZohoCrmDownloadAttachmentForRecordResponse>;

/**
 * Creates a {@link ZohoCrmDownloadAttachmentForRecordFunction} bound to the given context.
 *
 * Downloads a specific attachment from a record. Returns a parsed
 * {@link FetchFileResponse} containing the file data and metadata extracted
 * from the response headers.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Function that downloads an attachment by record and attachment ID
 *
 * @example
 * ```typescript
 * const downloadAttachment = zohoCrmDownloadAttachmentForRecord(context);
 *
 * const fileResponse = await downloadAttachment({
 *   module: 'Contacts',
 *   id: contactId,
 *   attachment_id: attachmentId
 * });
 * ```
 *
 * @see https://www.zoho.com/crm/developer-guide/apiv2/download-attachments.html
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
 * Creates a {@link ZohoCrmDeleteAttachmentFromRecordFunction} bound to the given context.
 *
 * Deletes a specific attachment from a record by its attachment ID.
 * Returns the raw {@link Response}.
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Function that deletes an attachment by record and attachment ID
 *
 * @example
 * ```typescript
 * const deleteAttachment = zohoCrmDeleteAttachmentFromRecord(context);
 *
 * const response = await deleteAttachment({
 *   module: 'Contacts',
 *   id: contactId,
 *   attachment_id: attachmentId
 * });
 * ```
 *
 * @see https://www.zoho.com/crm/developer-guide/apiv2/delete-attachments.html
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

/**
 * Thrown when a Zoho CRM serverless function returns a non-success response code.
 */
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
 * Creates a {@link ZohoCrmExecuteRestApiFunctionFunction} bound to the given context.
 *
 * Executes Zoho CRM serverless functions via the REST API. Supports both
 * OAuth-based and API-key-based authentication. When using an API key, a custom
 * target URL can be specified for cross-environment calls.
 *
 * OAuth Details:
 * - https://www.zoho.com/crm/developer/docs/functions/serverless-fn-oauth.html#OAuth2
 * - There is no documentation for ZohoCrm specifically, but it seems to behave the same way
 * - You will need the following scopes: ZohoCrm.functions.execute.READ,ZohoCrm.functions.execute.CREATE
 *
 * @param context - Authenticated Zoho CRM context providing fetch and rate limiting
 * @returns Function that executes serverless functions via the REST API
 * @throws {ZohoCrmExecuteRestApiFunctionError} If the function execution fails
 *
 * @example
 * ```typescript
 * const executeFunction = zohoCrmExecuteRestApiFunction(context);
 *
 * // Execute using OAuth credentials:
 * const result = await executeFunction({ functionName: 'my_function' });
 *
 * // Execute with parameters:
 * const paramResult = await executeFunction({
 *   functionName: 'process_contact',
 *   params: { contact_id: '12345', action: 'approve' }
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
/**
 * Builds URL search params from the input objects, omitting the `module` key since it is used in the URL path rather than as a query parameter.
 *
 * @param input - One or more objects to convert into URL search parameters
 * @returns URL search params string with the `module` key excluded
 */
export function zohoCrmUrlSearchParamsMinusModule(...input: Maybe<object | Record<string, string | number>>[]) {
  return makeUrlSearchParams(input, { omitKeys: 'module' });
}

/**
 * Builds URL search params from the input objects, omitting both `id` and `module` keys since they are used in the URL path.
 *
 * @param input - One or more objects to convert into URL search parameters
 * @returns URL search params string with `id` and `module` keys excluded
 */
export function zohoCrmUrlSearchParamsMinusIdAndModule(...input: Maybe<object | Record<string, string | number>>[]) {
  return makeUrlSearchParams(input, { omitKeys: ['id', 'module'] });
}

/**
 * @deprecated use makeUrlSearchParams instead.
 */
export const zohoCrmUrlSearchParams = makeUrlSearchParams;

/**
 * Constructs the standard FetchJsonInput used by CRM API calls, pairing the HTTP method with an optional body.
 *
 * @param method - HTTP method to use for the request
 * @param body - Optional request body to include
 * @returns Configured fetch input for the Zoho CRM API call
 */
export function zohoCrmApiFetchJsonInput(method: string, body?: Maybe<FetchJsonBody>): FetchJsonInput {
  return {
    method,
    body: body ?? undefined
  };
}

// MARK: Results
/**
 * Catches ZohoServerFetchResponseDataArrayError and returns the error data array as the response data, as each data element will have the error details.
 *
 * Use to catch errors from functions that return ZohoCrmChangeObjectLikeResponse and pass the result to zohoCrmChangeObjectLikeResponseSuccessAndErrorPairs.
 *
 * @param e - The error to catch and potentially convert
 * @returns The error data array wrapped as a change object response
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

/**
 * Separates a change response's entries into success and error arrays based on their status.
 *
 * Iterates over the `data` array from a Zoho CRM change operation response and
 * partitions entries into `successItems` and `errorItems` based on their `status` field.
 * The original response is spread into the result, so all original fields remain accessible.
 *
 * Used internally by {@link zohoCrmDeleteRecord} and similar functions to provide
 * convenient access to separated success/error results.
 *
 * @param response - Raw change operation response containing mixed success/error entries
 * @returns The response augmented with pre-separated `successItems` and `errorItems` arrays
 *
 * @example
 * ```typescript
 * const rawResponse = await context.fetchJson<ZohoCrmChangeObjectLikeResponse>(...);
 * const result = zohoCrmChangeObjectLikeResponseSuccessAndErrorPairs(rawResponse);
 *
 * result.successItems; // entries with status === 'success'
 * result.errorItems;   // entries with non-success status
 * ```
 */
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
/**
 * Result of a multi-record operation, grouping inputs by whether their API call succeeded or failed.
 */
export interface ZohoCrmMultiRecordResult<I, OS, OE> {
  readonly successItems: ZohoCrmMultiRecordResultEntry<I, OS>[];
  readonly errorItems: ZohoCrmMultiRecordResultEntry<I, OE>[];
}

/**
 * Minimal shape required to determine whether an API result entry is a success or error.
 */
export interface ZohoCrmMultiRecordResultItem {
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
