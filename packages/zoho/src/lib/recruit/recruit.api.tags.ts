import { type ZohoRecruitContext } from './recruit.config';
import { type ArrayOrValue, asArray, type Maybe, separateValues } from '@dereekb/util';
import { ZOHO_RECRUIT_CANDIDATES_MODULE, type ZohoRecruitModuleNameRef, type ZohoRecruitRecordId } from './recruit';
import { zohoRecruitApiFetchJsonInput, type ZohoRecruitChangeObjectLikeResponse, type ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta, type ZohoRecruitChangeObjectResponse, type ZohoRecruitChangeObjectResponseErrorEntry, type ZohoRecruitChangeObjectResponseSuccessEntry, type ZohoRecruitGetRecordsPageFilter, zohoRecruitMultiRecordResult, type ZohoRecruitMultiRecordResult, type ZohoRecruitMultiRecordResultEntry } from './recruit.api';
import { ZOHO_DUPLICATE_DATA_ERROR_CODE } from '../zoho.error.api';
import { type ZohoRecruitTagData, type ZohoRecruitTagName, type ZohoRecruitTagWithObjectDetails } from './recruit.tags';
import { type FetchPage, type FetchPageFactoryOptions, makeUrlSearchParams } from '@dereekb/util/fetch';
import { zohoFetchPageFactory, type ZohoPageResult } from '../zoho.api.page';

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
/**
 * Limit enforced by Zoho Recruit
 */
export const ZOHO_RECRUIT_ADD_TAGS_TO_RECORDS_MAX_IDS_ALLOWED = 100;

export interface ZohoRecruitAddTagsToRecordsRequest extends ZohoRecruitModuleNameRef {
  /**
   * Tag names to add to the records.
   */
  readonly tag_names: ArrayOrValue<ZohoRecruitTagName>;
  /**
   * Ids corresponding to the records in the module to add the tags to.
   *
   * Max of 100 ids.
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
 * Adds one or more tags to one or more records.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/add-tags.html
 *
 * @param context
 * @returns
 */
export function addTagsToRecords(context: ZohoRecruitContext): ZohoRecruitAddTagsToRecordsFunction {
  return (input: ZohoRecruitAddTagsToRecordsRequest) => {
    if (Array.isArray(input.ids) && input.ids.length > ZOHO_RECRUIT_ADD_TAGS_TO_RECORDS_MAX_IDS_ALLOWED) {
      throw new Error(`Cannot add tags to more than ${ZOHO_RECRUIT_ADD_TAGS_TO_RECORDS_MAX_IDS_ALLOWED} records at once.`);
    }

    return context.fetchJson<ZohoRecruitAddTagsToRecordsResponse>(`/v2/${ZOHO_RECRUIT_CANDIDATES_MODULE}/actions/add_tags?${makeUrlSearchParams({ tag_names: input.tag_names, ids: input.ids })}`, zohoRecruitApiFetchJsonInput('POST')).then((x: ZohoRecruitAddTagsToRecordsResponse) => {
      const resultInputMap = x.data.map(() => input); // assign "input" to each value for now
      return zohoRecruitMultiRecordResult<ZohoRecruitAddTagsToRecordsRequest, ZohoRecruitAddTagsToRecordsSuccessEntry, ZohoRecruitAddTagsToRecordsErrorEntry>(resultInputMap, x.data);
    });
  };
}

// MARK: Remove Tag From Record
/**
 * Limit enforced by Zoho Recruit
 */
export const ZOHO_RECRUIT_REMOVE_TAGS_FROM_RECORDS_MAX_IDS_ALLOWED = 100;

export type ZohoRecruitRemoveTagsFromRecordsRequest = ZohoRecruitAddTagsToRecordsRequest;
export type ZohoRecruitRemoveTagsFromRecordsResultDetails = ZohoRecruitAddTagsToRecordsResultDetails;

export interface ZohoRecruitRemoveTagsFromRecordsSuccessEntry extends ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta {
  readonly details: ZohoRecruitRemoveTagsFromRecordsResultDetails;
}

export type ZohoRecruitRemoveTagsFromRecordsResponse = ZohoRecruitChangeObjectLikeResponse<ZohoRecruitRemoveTagsFromRecordsSuccessEntry>;

/**
 * Contains all the details of the error.
 */
export type ZohoRecruitRemoveTagsFromRecordsErrorEntryDetails = ZohoRecruitRemoveTagsFromRecordsResultDetails;

export type ZohoRecruitRemoveTagsFromRecordsErrorEntry = ZohoRecruitChangeObjectResponseErrorEntry & {
  readonly details: ZohoRecruitRemoveTagsFromRecordsErrorEntryDetails;
};

export type ZohoRecruitRemoveTagsFromRecordsResult = ZohoRecruitMultiRecordResult<ZohoRecruitRemoveTagsFromRecordsRequest, ZohoRecruitRemoveTagsFromRecordsSuccessEntry, ZohoRecruitRemoveTagsFromRecordsErrorEntry>;

export type ZohoRecruitRemoveTagsFromRecordsFunction = (input: ZohoRecruitRemoveTagsFromRecordsRequest) => Promise<ZohoRecruitRemoveTagsFromRecordsResult>;

/**
 * Removes one or more tags from one or more records.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/remove-tags.html
 *
 * @param context
 * @returns
 */
export function removeTagsFromRecords(context: ZohoRecruitContext): ZohoRecruitRemoveTagsFromRecordsFunction {
  return (input: ZohoRecruitRemoveTagsFromRecordsRequest) => {
    if (Array.isArray(input.ids) && input.ids.length > ZOHO_RECRUIT_REMOVE_TAGS_FROM_RECORDS_MAX_IDS_ALLOWED) {
      throw new Error(`Cannot remove tags from more than ${ZOHO_RECRUIT_REMOVE_TAGS_FROM_RECORDS_MAX_IDS_ALLOWED} records at once.`);
    }

    return context.fetchJson<ZohoRecruitRemoveTagsFromRecordsResponse>(`/v2/${ZOHO_RECRUIT_CANDIDATES_MODULE}/actions/remove_tags?${makeUrlSearchParams({ tag_names: input.tag_names, ids: input.ids })}`, zohoRecruitApiFetchJsonInput('POST')).then((x: ZohoRecruitRemoveTagsFromRecordsResponse) => {
      const resultInputMap = x.data.map(() => input); // assign "input" to each value for now
      return zohoRecruitMultiRecordResult<ZohoRecruitRemoveTagsFromRecordsRequest, ZohoRecruitRemoveTagsFromRecordsSuccessEntry, ZohoRecruitRemoveTagsFromRecordsErrorEntry>(resultInputMap, x.data);
    });
  };
}
