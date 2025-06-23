import { ZohoDataArrayResultRef, ZohoPageFilter, ZohoPageResult, emptyZohoPageResult, zohoFetchPageFactory } from './../zoho.api.page';
import { FetchJsonBody, FetchJsonInput, FetchPage, FetchPageFactory, FetchPageFactoryOptions, makeUrlSearchParams } from '@dereekb/util/fetch';
import { ZohoRecruitConfigApiUrlInput, ZohoRecruitContext, zohoRecruitConfigApiUrl } from './recruit.config';
import { ZohoRecruitCommaSeparateFieldNames, ZohoRecruitCustomViewId, ZohoRecruitDraftOrSaveState, ZohoRecruitFieldName, ZohoRecruitModuleNameRef, ZohoRecruitChangeObjectDetails, ZohoRecruitRecord, ZohoRecruitRecordId, ZohoRecruitTerritoryId, ZohoRecruitTrueFalseBoth, ZohoRecruitRestFunctionApiName, ZohoRecruitUserId, ZohoRecruitModuleName, ZOHO_RECRUIT_EMAILS_MODULE, ZohoRecruitRecordEmailMetadata } from './recruit';
import { zohoRecruitSearchRecordsCriteriaString, ZohoRecruitSearchRecordsCriteriaTreeElement } from './recruit.criteria';
import { ArrayOrValue, EmailAddress, Maybe, PhoneNumber, SortingOrder, UniqueModelWithId, asArray } from '@dereekb/util';
import { assertRecordDataArrayResultHasContent, zohoRecruitRecordCrudError } from './recruit.error.api';
import { ZOHO_SUCCESS_STATUS, ZohoServerErrorDataWithDetails, ZohoServerErrorStatus, ZohoServerSuccessCode, ZohoServerSuccessStatus } from '../zoho.error.api';
import { ZohoDateTimeString } from '../zoho.type';
import { BaseError } from 'make-error';

// MARK: Insert/Update/Upsert Response
export type ZohoRecruitUpdateRecordResult<T> = ZohoRecruitMultiRecordResult<T, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>;
export type ZohoRecruitUpdateRecordResponse = ZohoRecruitChangeObjectResponse;

export type ZohoRecruitCreateRecordData<T> = Omit<T, 'id'>;

export interface ZohoRecruitCreateSingleRecordInput<T> extends ZohoRecruitModuleNameRef {
  readonly data: ZohoRecruitCreateRecordData<T>;
}

export interface ZohoRecruitCreateMultiRecordInput<T> extends ZohoRecruitModuleNameRef {
  readonly data: ZohoRecruitCreateRecordData<T>[];
}

export type ZohoRecruitCreateRecordLikeFunction = ZohoRecruitCreateMultiRecordFunction & ZohoRecruitCreateSingleRecordFunction;
export type ZohoRecruitCreateSingleRecordFunction = <T>(input: ZohoRecruitCreateSingleRecordInput<T>) => Promise<ZohoRecruitChangeObjectDetails>;
export type ZohoRecruitCreateMultiRecordFunction = <T>(input: ZohoRecruitCreateMultiRecordInput<T>) => Promise<ZohoRecruitUpdateRecordResult<T>>;

export type ZohoRecruitUpdateRecordInput<T> = ZohoRecruitUpdateSingleRecordInput<T> | ZohoRecruitUpdateMultiRecordInput<T>;
export type ZohoRecruitUpdateRecordData<T> = UniqueModelWithId & Partial<T>;

export interface ZohoRecruitUpdateSingleRecordInput<T> extends ZohoRecruitModuleNameRef {
  readonly data: ZohoRecruitUpdateRecordData<T>;
}

export interface ZohoRecruitUpdateMultiRecordInput<T> extends ZohoRecruitModuleNameRef {
  readonly data: ZohoRecruitUpdateRecordData<T>[];
}

export type ZohoRecruitUpdateRecordLikeFunction = ZohoRecruitUpdateMultiRecordFunction & ZohoRecruitUpdateSingleRecordFunction;
export type ZohoRecruitUpdateMultiRecordFunction = <T>(input: ZohoRecruitUpdateMultiRecordInput<T>) => Promise<ZohoRecruitUpdateRecordResult<T>>;
export type ZohoRecruitUpdateSingleRecordFunction = <T>(input: ZohoRecruitUpdateSingleRecordInput<T>) => Promise<ZohoRecruitChangeObjectDetails>;

export type ZohoRecruitUpsertRecordData<T> = ZohoRecruitCreateRecordData<T> | ZohoRecruitUpdateRecordData<T>;

export interface ZohoRecruitUpsertSingleRecordInput<T> extends ZohoRecruitModuleNameRef {
  readonly data: ZohoRecruitUpsertRecordData<T>;
}

export interface ZohoRecruitUpsertMultiRecordInput<T> extends ZohoRecruitModuleNameRef {
  readonly data: ZohoRecruitUpsertRecordData<T>[];
}

export type ZohoRecruitUpsertRecordLikeFunction = ZohoRecruitUpsertMultiRecordFunction & ZohoRecruitUpsertSingleRecordFunction;
export type ZohoRecruitUpsertMultiRecordFunction = <T>(input: ZohoRecruitUpsertMultiRecordInput<T>) => Promise<ZohoRecruitUpdateRecordResult<T>>;
export type ZohoRecruitUpsertSingleRecordFunction = <T>(input: ZohoRecruitUpsertSingleRecordInput<T>) => Promise<ZohoRecruitChangeObjectDetails>;

/**
 * The APIs for Insert, Upsert, and Update have the same structure.
 *
 * @returns
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
 *
 * @param context
 * @returns
 */
export function insertRecord(context: ZohoRecruitContext): ZohoRecruitInsertRecordFunction {
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
 *
 * @param context
 * @returns
 */
export function upsertRecord(context: ZohoRecruitContext): ZohoRecruitUpsertRecordFunction {
  return updateRecordLikeFunction(context, '/upsert', 'POST') as ZohoRecruitUpsertRecordFunction;
}

// MARK: Update Record
export type ZohoRecruitUpdateRecordFunction = ZohoRecruitUpdateRecordLikeFunction;

/**
 * Updates one or more records in Recruit.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/update-records.html
 *
 * @param context
 * @returns
 */
export function updateRecord(context: ZohoRecruitContext): ZohoRecruitUpdateRecordFunction {
  return updateRecordLikeFunction(context, '', 'PUT') as ZohoRecruitUpdateRecordFunction;
}

// MARK: Delete Record
export type ZohoRecruitDeleteRecordFunction = (input: ZohoRecruitDeleteRecordInput) => Promise<ZohoRecruitDeleteRecordResponse>;

export interface ZohoRecruitDeleteRecordInput extends ZohoRecruitModuleNameRef {
  /**
   * Id or array of ids to delete.
   */
  readonly ids: ArrayOrValue<ZohoRecruitRecordId>;
  readonly wf_trigger?: boolean;
}

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
 *
 * @param context
 * @returns ZohoRecruitDeleteRecordFunction
 */
export function deleteRecord(context: ZohoRecruitContext): ZohoRecruitDeleteRecordFunction {
  return ({ ids, module, wf_trigger }: ZohoRecruitDeleteRecordInput) => {
    return context.fetchJson<ZohoRecruitDeleteRecordResponse>(`/v2/${module}?${makeUrlSearchParams({ ids, wf_trigger })}`, zohoRecruitApiFetchJsonInput('DELETE')).then(zohoRecruitChangeObjectLikeResponseSuccessAndErrorPairs);
  };
}

// MARK: Get Record By Id
export interface ZohoRecruitGetRecordByIdInput extends ZohoRecruitModuleNameRef {
  readonly id: ZohoRecruitRecordId;
}

export type ZohoRecruitGetRecordByIdResponse<T = ZohoRecruitRecord> = ZohoDataArrayResultRef<T>;

export type ZohoRecruitGetRecordByIdResult<T = ZohoRecruitRecord> = T;
export type ZohoRecruitGetRecordByIdFunction = <T = ZohoRecruitRecord>(input: ZohoRecruitGetRecordByIdInput) => Promise<ZohoRecruitGetRecordByIdResult<T>>;

/**
 * Retrieves a specific record from the given module.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/get-records.html
 *
 * @param context
 * @returns
 */
export function getRecordById(context: ZohoRecruitContext): ZohoRecruitGetRecordByIdFunction {
  return <T>(input: ZohoRecruitGetRecordByIdInput) =>
    context
      .fetchJson<ZohoRecruitGetRecordByIdResponse<T>>(`/v2/${input.module}/${input.id}`, zohoRecruitApiFetchJsonInput('GET'))
      .then(assertRecordDataArrayResultHasContent(input.module))
      .then((x) => x.data[0]);
}

// MARK: Get Records
export interface ZohoRecruitGetRecordsPageFilter extends ZohoPageFilter {
  readonly converted?: ZohoRecruitTrueFalseBoth;
  readonly approved?: ZohoRecruitTrueFalseBoth;
}

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
 *
 * @param context
 * @returns
 */
export function getRecords(context: ZohoRecruitContext): ZohoRecruitGetRecordsFunction {
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
 * Searches records from the given module.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/search-records.html
 *
 * @param context
 * @returns
 */
export function searchRecords(context: ZohoRecruitContext): ZohoRecruitSearchRecordsFunction {
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

export type SearchRecordsPageFactory = <T = ZohoRecruitRecord>(input: ZohoRecruitSearchRecordsInput<T>, options?: Maybe<FetchPageFactoryOptions<ZohoRecruitSearchRecordsInput<T>, ZohoRecruitSearchRecordsResponse<T>>>) => FetchPage<ZohoRecruitSearchRecordsInput<T>, ZohoRecruitSearchRecordsResponse<T>>;

export function searchRecordsPageFactory(context: ZohoRecruitContext): SearchRecordsPageFactory {
  return zohoFetchPageFactory(searchRecords(context));
}

// MARK: Related Records
export interface ZohoRecruitGetRelatedRecordsFunctionConfig {
  readonly targetModule: ZohoRecruitModuleName;
  /**
   * If true, will return an empty page result instead of null when no results are found.
   *
   * Defaults to true.
   */
  readonly returnEmptyRecordsInsteadOfNull?: boolean;
}

export type ZohoRecruitGetRelatedRecordsFunctionFactory = <T = ZohoRecruitRecord>(input: ZohoRecruitGetRelatedRecordsFunctionConfig) => ZohoRecruitGetRelatedRecordsFunction<T>;

export type ZohoRecruitGetRelatedRecordsPageFilter = ZohoPageFilter;
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
export function getRelatedRecordsFunctionFactory(context: ZohoRecruitContext): ZohoRecruitGetRelatedRecordsFunctionFactory {
  return <T = ZohoRecruitRecord>(config: ZohoRecruitGetRelatedRecordsFunctionConfig) => {
    const { targetModule, returnEmptyRecordsInsteadOfNull = true } = config;
    return (input: ZohoRecruitGetRelatedRecordsRequest) => context.fetchJson<ZohoRecruitGetRelatedRecordsResponse<T>>(`/v2/${input.module}/${input.id}/${targetModule}?${zohoRecruitUrlSearchParamsMinusIdAndModule(input, input.filter).toString()}`, zohoRecruitApiFetchJsonInput('GET')).then((x) => x ?? (returnEmptyRecordsInsteadOfNull !== false ? emptyZohoPageResult<T>() : x));
  };
}

// MARK: Emails
export type ZohoRecruitGetEmailsForRecordRequest = ZohoRecruitGetRelatedRecordsRequest;
export type ZohoRecruitGetEmailsForRecordResponse = ZohoPageResult<ZohoRecruitRecordEmailMetadata>;
export type ZohoRecruitGetEmailsForRecordFunction = (input: ZohoRecruitGetEmailsForRecordRequest) => Promise<ZohoRecruitGetEmailsForRecordResponse>;

export function getEmailsForRecord(context: ZohoRecruitContext): ZohoRecruitGetEmailsForRecordFunction {
  return getRelatedRecordsFunctionFactory(context)<ZohoRecruitRecordEmailMetadata>({ targetModule: ZOHO_RECRUIT_EMAILS_MODULE });
}

export type GetEmailsForRecordPageFactory = FetchPageFactory<ZohoRecruitGetEmailsForRecordRequest, ZohoRecruitGetEmailsForRecordResponse>;

export function getEmailsForRecordPageFactory(context: ZohoRecruitContext): GetEmailsForRecordPageFactory {
  return zohoFetchPageFactory(getEmailsForRecord(context));
}

// MARK: Function
export type ZohoRecruitExecuteRestApiFunctionRequest = ZohoRecruitExecuteRestApiFunctionNormalRequest | ZohoRecruitExecuteRestApiFunctionApiSpecificRequest;

export interface ZohoRecruitExecuteRestApiFunctionNormalRequest {
  readonly functionName: ZohoRecruitRestFunctionApiName;
  readonly params?: Maybe<ZohoRecruitExecuteRestApiFunctionParams>;
}

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
 * Creates a ZohoRecruitExecuteRestApiFunctionFunction
 *
 * OAuth Details:
 * - https://www.zoho.com/crm/developer/docs/functions/serverless-fn-oauth.html#OAuth2
 * - There is no documentation for ZohoRecruit specifically, but it seems to behave the same way
 * - You will need the following scopes: ZohoRecruit.functions.execute.READ,ZohoRecruit.functions.execute.CREATE
 *
 * @param context
 * @returns
 */
export function executeRestApiFunction(context: ZohoRecruitContext): ZohoRecruitExecuteRestApiFunctionFunction {
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
export function zohoRecruitUrlSearchParamsMinusModule(...input: Maybe<object | Record<string, string | number>>[]) {
  return makeUrlSearchParams(input, { omitKeys: 'module' });
}

export function zohoRecruitUrlSearchParamsMinusIdAndModule(...input: Maybe<object | Record<string, string | number>>[]) {
  return makeUrlSearchParams(input, { omitKeys: ['id', 'module'] });
}

/**
 * @deprecated use makeUrlSearchParams instead.
 */
export const zohoRecruitUrlSearchParams = makeUrlSearchParams;

export function zohoRecruitApiFetchJsonInput(method: string, body?: Maybe<FetchJsonBody>): FetchJsonInput {
  const result = {
    method,
    body: body ?? undefined
  };

  return result;
}

// MARK: Results
export type ZohoRecruitChangeObjectLikeResponse<T extends ZohoRecruitChangeObjectLikeResponseEntry = ZohoRecruitChangeObjectLikeResponseEntry> = ZohoDataArrayResultRef<T>;
export type ZohoRecruitChangeObjectLikeResponseEntry<E extends ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta = ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta> = E | ZohoRecruitChangeObjectResponseErrorEntry;
export type ZohoRecruitChangeObjectLikeResponseSuccessEntryType<T extends ZohoRecruitChangeObjectLikeResponseEntry> = T extends ZohoRecruitChangeObjectLikeResponseEntry<infer E> ? E : never;

export interface ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta {
  readonly code: ZohoServerSuccessCode;
  readonly status: ZohoServerSuccessStatus;
  readonly message: string;
}

export type ZohoRecruitChangeObjectLikeResponseSuccessAndErrorPairs<T extends ZohoRecruitChangeObjectLikeResponseEntry> = ZohoRecruitChangeObjectLikeResponse<T> & {
  readonly successItems: ZohoRecruitChangeObjectLikeResponseSuccessEntryType<T>[];
  readonly errorItems: ZohoRecruitChangeObjectResponseErrorEntry[];
};

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

export interface ZohoRecruitChangeObjectResponseSuccessEntry<D extends ZohoRecruitChangeObjectDetails = ZohoRecruitChangeObjectDetails> extends ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta {
  readonly details: D;
}

export interface ZohoRecruitChangeObjectResponseErrorEntry extends ZohoServerErrorDataWithDetails {
  readonly status: ZohoServerErrorStatus;
}

// MARK: Multi-Record Results
export interface ZohoRecruitMultiRecordResult<I, OS, OE> {
  readonly successItems: ZohoRecruitMultiRecordResultEntry<I, OS>[];
  readonly errorItems: ZohoRecruitMultiRecordResultEntry<I, OE>[];
}

export interface ZohoRecrutMultiRecordResultItem {
  readonly status: ZohoServerSuccessStatus | ZohoServerErrorStatus;
}

export function zohoRecruitMultiRecordResult<I, OS extends ZohoRecrutMultiRecordResultItem, OE extends ZohoRecrutMultiRecordResultItem>(input: I[], results: (OS | OE)[]): ZohoRecruitMultiRecordResult<I, OS, OE> {
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
