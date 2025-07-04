import { ZohoRecruitContext } from './recruit.config';
import { ArrayOrValue, asArray, Maybe, separateValues } from '@dereekb/util';
import { ZOHO_RECRUIT_CANDIDATES_MODULE, ZohoRecruitModuleNameRef, ZohoRecruitRecordId } from './recruit';
import { zohoRecruitApiFetchJsonInput, ZohoRecruitChangeObjectLikeResponse, ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta, ZohoRecruitChangeObjectResponse, ZohoRecruitChangeObjectResponseErrorEntry, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitGetRecordsPageFilter, zohoRecruitMultiRecordResult, ZohoRecruitMultiRecordResult, ZohoRecruitMultiRecordResultEntry } from './recruit.api';
import { ZOHO_DUPLICATE_DATA_ERROR_CODE } from '../zoho.error.api';
import { ZohoRecruitTagData, ZohoRecruitTagName, ZohoRecruitTagWithObjectDetails } from './recruit.tags';
import { FetchPage, FetchPageFactoryOptions, makeUrlSearchParams } from '@dereekb/util/fetch';
import { zohoFetchPageFactory, ZohoPageResult } from '../zoho.api.page';

// MARK: Create Tag
export type ZohoRecruitCreateTagData = Pick<ZohoRecruitTagData, 'name'> & Partial<Pick<ZohoRecruitTagData, 'color_code'>>;

export interface ZohoRecruitCreateTagsRequest extends ZohoRecruitModuleNameRef {
  readonly tags: ArrayOrValue<ZohoRecruitCreateTagData>;
}

export interface ZohoRecruitCreateTagsResponse {
  readonly tags: ZohoRecruitChangeObjectResponse['data'];
}

export type ZohoRecruitCreateTagsResult = ZohoRecruitMultiRecordResult<ZohoRecruitCreateTagData, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry> & {
  readonly duplicateErrorItems: ZohoRecruitMultiRecordResultEntry<ZohoRecruitCreateTagData, ZohoRecruitChangeObjectResponseErrorEntry>[];
  readonly allErrorItems: ZohoRecruitMultiRecordResultEntry<ZohoRecruitCreateTagData, ZohoRecruitChangeObjectResponseErrorEntry>[];
};

export type ZohoRecruitCreateTagsFunction = (input: ZohoRecruitCreateTagsRequest) => Promise<ZohoRecruitCreateTagsResult>;

export function createTagsForModule(context: ZohoRecruitContext) {
  return (input: ZohoRecruitCreateTagsRequest) =>
    context.fetchJson<ZohoRecruitCreateTagsResponse>(`/v2/settings/tags?${makeUrlSearchParams({ module: input.module })}`, zohoRecruitApiFetchJsonInput('POST', { tags: asArray(input.tags) })).then((x) => {
      const result = zohoRecruitMultiRecordResult<ZohoRecruitCreateTagData, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>(asArray(input.tags), x.tags);

      const { included: duplicateErrorItems, excluded: otherErrorItems } = separateValues(result.errorItems, (x) => {
        return x.result.code === ZOHO_DUPLICATE_DATA_ERROR_CODE;
      });

      return {
        ...result,
        errorItems: otherErrorItems,
        duplicateErrorItems,
        allErrorItems: result.errorItems
      };
    });
}

// MARK: Get Tags
export interface ZohoRecruitGetTagsRequest extends ZohoRecruitModuleNameRef, ZohoRecruitGetRecordsPageFilter {
  readonly my_tags?: string;
}

export interface ZohoRecruitGetTagsResponse extends Omit<ZohoPageResult<ZohoRecruitTagWithObjectDetails>, 'data'> {
  readonly tags: ZohoRecruitTagWithObjectDetails[];
}

export type ZohoRecruitGetTagsResult = ZohoPageResult<ZohoRecruitTagWithObjectDetails>;
export type ZohoRecruitGetTagsFunction = (input: ZohoRecruitGetTagsRequest) => Promise<ZohoRecruitGetTagsResult>;

/**
 * Returns the list of tags within a module.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/get-tag-list.html
 *
 * @param context
 * @returns
 */
export function getTagsForModule(context: ZohoRecruitContext): ZohoRecruitGetTagsFunction {
  return (input: ZohoRecruitGetTagsRequest) =>
    context.fetchJson<ZohoRecruitGetTagsResponse>(`/v2/settings/tags?${makeUrlSearchParams({ module: input.module, my_tags: input.my_tags })}`, zohoRecruitApiFetchJsonInput('GET')).then((x) => {
      // NOTE: This doesn't follow the api documentation, and instead is a normal page result except it has "tags" instead of "data".

      return {
        ...x,
        data: x.tags
      };
    });
}

export type GetTagsForModulePageFactory = (input: ZohoRecruitGetTagsRequest, options?: Maybe<FetchPageFactoryOptions<ZohoRecruitGetTagsRequest, ZohoRecruitGetTagsResult>>) => FetchPage<ZohoRecruitGetTagsRequest, ZohoRecruitGetTagsResult>;

export function getTagsForModulePageFactory(context: ZohoRecruitContext): GetTagsForModulePageFactory {
  return zohoFetchPageFactory(getTagsForModule(context));
}

// MARK: Add Tag To Record
export interface ZohoRecruitAddTagsToRecordsRequest extends ZohoRecruitModuleNameRef {
  /**
   * Tag names to add to the records.
   */
  readonly tag_names: ArrayOrValue<ZohoRecruitTagName>;
  /**
   * Ids corresponding to the records in the module to add the tags to.
   */
  readonly ids: ArrayOrValue<ZohoRecruitRecordId>;
}

export interface ZohoRecruitAddTagsToRecordsResultDetails {
  /**
   * Record id that was updated
   */
  readonly id: ZohoRecruitRecordId;
  /**
   * Tag names that were added to the record
   */
  readonly tags: ZohoRecruitTagName[];
}

export interface ZohoRecruitAddTagsToRecordsSuccessEntry extends ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta {
  readonly details: ZohoRecruitAddTagsToRecordsResultDetails;
}

export type ZohoRecruitAddTagsToRecordsResponse = ZohoRecruitChangeObjectLikeResponse<ZohoRecruitAddTagsToRecordsSuccessEntry>;

/**
 * Contains all the details of the error.
 */
export type ZohoRecruitAddTagsToRecordsErrorEntryDetails = ZohoRecruitAddTagsToRecordsResultDetails;

export type ZohoRecruitAddTagsToRecordsErrorEntry = ZohoRecruitChangeObjectResponseErrorEntry & {
  readonly details: ZohoRecruitAddTagsToRecordsErrorEntryDetails;
};

export type ZohoRecruitAddTagsToRecordsResult = ZohoRecruitMultiRecordResult<ZohoRecruitAddTagsToRecordsRequest, ZohoRecruitAddTagsToRecordsSuccessEntry, ZohoRecruitAddTagsToRecordsErrorEntry>;

export type ZohoRecruitAddTagsToRecordsFunction = (input: ZohoRecruitAddTagsToRecordsRequest) => Promise<ZohoRecruitAddTagsToRecordsResult>;

/**
 * Associates one or more candidates with one or more job openings.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/associate-candidate.html
 *
 * @param context
 * @returns
 */
export function addTagsToRecords(context: ZohoRecruitContext): ZohoRecruitAddTagsToRecordsFunction {
  return (input: ZohoRecruitAddTagsToRecordsRequest) =>
    context.fetchJson<ZohoRecruitAddTagsToRecordsResponse>(`/v2/${ZOHO_RECRUIT_CANDIDATES_MODULE}/actions/add_tags?${makeUrlSearchParams({ tag_names: input.tag_names, ids: input.ids })}`, zohoRecruitApiFetchJsonInput('POST')).then((x: ZohoRecruitAddTagsToRecordsResponse) => {
      const resultInputMap = x.data.map(() => input); // assign "input" to each value for now
      return zohoRecruitMultiRecordResult<ZohoRecruitAddTagsToRecordsRequest, ZohoRecruitAddTagsToRecordsSuccessEntry, ZohoRecruitAddTagsToRecordsErrorEntry>(resultInputMap, x.data);
    });
}
