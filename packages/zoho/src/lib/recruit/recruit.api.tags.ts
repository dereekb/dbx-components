import { type ZohoRecruitContext } from './recruit.config';
import { type ArrayOrValue, asArray, type Maybe, separateValues } from '@dereekb/util';
import { ZOHO_RECRUIT_CANDIDATES_MODULE, type ZohoRecruitModuleNameRef, type ZohoRecruitRecordId } from './recruit';
import { zohoRecruitApiFetchJsonInput, type ZohoRecruitChangeObjectLikeResponse, type ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta, type ZohoRecruitChangeObjectResponse, type ZohoRecruitChangeObjectResponseErrorEntry, type ZohoRecruitChangeObjectResponseSuccessEntry, type ZohoRecruitGetRecordsPageFilter, zohoRecruitMultiRecordResult, type ZohoRecruitMultiRecordResult, type ZohoRecruitMultiRecordResultEntry } from './recruit.api';
import { ZOHO_DUPLICATE_DATA_ERROR_CODE } from '../zoho.error.api';
import { type ZohoRecruitTagData, type ZohoRecruitTagName, type ZohoRecruitTagWithObjectDetails } from './recruit.tags';
import { type FetchPage, type FetchPageFactoryOptions, makeUrlSearchParams } from '@dereekb/util/fetch';
import { zohoFetchPageFactory, type ZohoPageResult } from '../zoho.api.page';

// MARK: Create Tag
/**
 * Data required to create a tag: a name and an optional color code.
 */
export type ZohoRecruitCreateTagData = Pick<ZohoRecruitTagData, 'name'> & Partial<Pick<ZohoRecruitTagData, 'color_code'>>;

/**
 * Request for creating one or more tags in a module.
 */
export interface ZohoRecruitCreateTagsRequest extends ZohoRecruitModuleNameRef {
  readonly tags: ArrayOrValue<ZohoRecruitCreateTagData>;
}

/**
 * Raw API response from the create tags endpoint. Uses `tags` instead of `data` unlike most other endpoints.
 */
export interface ZohoRecruitCreateTagsResponse {
  readonly tags: ZohoRecruitChangeObjectResponse['data'];
}

/**
 * Result of a tag creation operation, with duplicate tag errors separated out so callers can treat them as non-fatal.
 */
export type ZohoRecruitCreateTagsResult = ZohoRecruitMultiRecordResult<ZohoRecruitCreateTagData, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry> & {
  readonly duplicateErrorItems: ZohoRecruitMultiRecordResultEntry<ZohoRecruitCreateTagData, ZohoRecruitChangeObjectResponseErrorEntry>[];
  readonly allErrorItems: ZohoRecruitMultiRecordResultEntry<ZohoRecruitCreateTagData, ZohoRecruitChangeObjectResponseErrorEntry>[];
};

export type ZohoRecruitCreateTagsFunction = (input: ZohoRecruitCreateTagsRequest) => Promise<ZohoRecruitCreateTagsResult>;

/**
 * Creates a {@link ZohoRecruitCreateTagsFunction} bound to the given context.
 *
 * Creates one or more tags for a module. The result separates duplicate tag errors
 * (which are often non-fatal) from other errors, making it easy to handle the common
 * case where a tag already exists.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that creates tags in the specified module
 *
 * @example
 * ```typescript
 * const createTags = zohoRecruitCreateTagsForModule(context);
 *
 * const result = await createTags({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   tags: [{ name: 'Interviewed' }, { name: 'Priority', color_code: '#FF0000' }]
 * });
 *
 * // Duplicate tags are separated for convenience:
 * result.duplicateErrorItems; // tags that already existed
 * result.errorItems;          // other (real) errors
 * ```
 */
export function zohoRecruitCreateTagsForModule(context: ZohoRecruitContext) {
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
/**
 * Request for fetching tags in a module, with optional pagination and personal tag filtering.
 */
export interface ZohoRecruitGetTagsRequest extends ZohoRecruitModuleNameRef, ZohoRecruitGetRecordsPageFilter {
  readonly my_tags?: string;
}

/**
 * Raw API response from the get tags endpoint. Uses `tags` instead of `data`, which is normalized by the function into a standard page result.
 */
export interface ZohoRecruitGetTagsResponse extends Omit<ZohoPageResult<ZohoRecruitTagWithObjectDetails>, 'data'> {
  readonly tags: ZohoRecruitTagWithObjectDetails[];
}

export type ZohoRecruitGetTagsResult = ZohoPageResult<ZohoRecruitTagWithObjectDetails>;
export type ZohoRecruitGetTagsFunction = (input: ZohoRecruitGetTagsRequest) => Promise<ZohoRecruitGetTagsResult>;

/**
 * Creates a {@link ZohoRecruitGetTagsFunction} bound to the given context.
 *
 * Returns the list of tags within a module. Normalizes the non-standard API response
 * that returns data under a `tags` key instead of the standard `data` key.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that retrieves tags for a module
 *
 * @example
 * ```typescript
 * const getTags = zohoRecruitGetTagsForModule(context);
 *
 * const result = await getTags({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/get-tag-list.html
 */
export function zohoRecruitGetTagsForModule(context: ZohoRecruitContext): ZohoRecruitGetTagsFunction {
  return (input: ZohoRecruitGetTagsRequest) =>
    context.fetchJson<ZohoRecruitGetTagsResponse>(`/v2/settings/tags?${makeUrlSearchParams({ module: input.module, my_tags: input.my_tags })}`, zohoRecruitApiFetchJsonInput('GET')).then((x) => {
      // NOTE: This doesn't follow the api documentation, and instead is a normal page result except it has "tags" instead of "data".

      return {
        ...x,
        data: x.tags
      };
    });
}

/**
 * Factory function type that produces paginated iterators over tag results.
 */
export type ZohoRecruitGetTagsForModulePageFactory = (input: ZohoRecruitGetTagsRequest, options?: Maybe<FetchPageFactoryOptions<ZohoRecruitGetTagsRequest, ZohoRecruitGetTagsResult>>) => FetchPage<ZohoRecruitGetTagsRequest, ZohoRecruitGetTagsResult>;

/**
 * Creates a {@link ZohoRecruitGetTagsForModulePageFactory} bound to the given context.
 *
 * Returns a page factory for iterating over tags in a module across multiple pages.
 * Wraps {@link zohoRecruitGetTagsForModule} with automatic pagination handling.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Page factory for iterating over module tags
 */
export function zohoRecruitGetTagsForModulePageFactory(context: ZohoRecruitContext): ZohoRecruitGetTagsForModulePageFactory {
  return zohoFetchPageFactory(zohoRecruitGetTagsForModule(context));
}

// MARK: Add Tag To Record
/**
 * Maximum number of record ids allowed when adding tags, enforced by the Zoho Recruit API.
 */
export const ZOHO_RECRUIT_ADD_TAGS_TO_RECORDS_MAX_IDS_ALLOWED = 100;

/**
 * Request for adding tags to records in a module.
 */
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

/**
 * Details of a successful tag addition, including the record id and applied tag names.
 */
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

/**
 * Successful entry from an add-tags operation.
 */
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
 * Creates a {@link ZohoRecruitAddTagsToRecordsFunction} bound to the given context.
 *
 * Adds one or more tags to one or more records. Returns a paired success/error result
 * for each record. Maximum of {@link ZOHO_RECRUIT_ADD_TAGS_TO_RECORDS_MAX_IDS_ALLOWED} (100) record IDs per call.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that adds tags to records
 * @throws {Error} If more than 100 record IDs are provided
 *
 * @example
 * ```typescript
 * const addTags = zohoRecruitAddTagsToRecords(context);
 *
 * const result = await addTags({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   tag_names: ['Interviewed', 'Priority'],
 *   ids: [candidateId1, candidateId2]
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/add-tags.html
 */
export function zohoRecruitAddTagsToRecords(context: ZohoRecruitContext): ZohoRecruitAddTagsToRecordsFunction {
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
 * Maximum number of record ids allowed when removing tags, enforced by the Zoho Recruit API.
 */
export const ZOHO_RECRUIT_REMOVE_TAGS_FROM_RECORDS_MAX_IDS_ALLOWED = 100;

export type ZohoRecruitRemoveTagsFromRecordsRequest = ZohoRecruitAddTagsToRecordsRequest;
export type ZohoRecruitRemoveTagsFromRecordsResultDetails = ZohoRecruitAddTagsToRecordsResultDetails;

/**
 * Successful entry from a remove-tags operation.
 */
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
 * Creates a {@link ZohoRecruitRemoveTagsFromRecordsFunction} bound to the given context.
 *
 * Removes one or more tags from one or more records. Returns a paired success/error result
 * for each record. Maximum of {@link ZOHO_RECRUIT_REMOVE_TAGS_FROM_RECORDS_MAX_IDS_ALLOWED} (100) record IDs per call.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that removes tags from records
 * @throws {Error} If more than 100 record IDs are provided
 *
 * @example
 * ```typescript
 * const removeTags = zohoRecruitRemoveTagsFromRecords(context);
 *
 * const result = await removeTags({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   tag_names: 'Interviewed',
 *   ids: candidateId
 * });
 * ```
 *
 * @see https://www.zoho.com/recruit/developer-guide/apiv2/remove-tags.html
 */
export function zohoRecruitRemoveTagsFromRecords(context: ZohoRecruitContext): ZohoRecruitRemoveTagsFromRecordsFunction {
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

// MARK: Compat
/**
 * @deprecated Use zohoRecruitCreateTagsForModule instead.
 */
export const createTagsForModule = zohoRecruitCreateTagsForModule;

/**
 * @deprecated Use zohoRecruitGetTagsForModule instead.
 */
export const getTagsForModule = zohoRecruitGetTagsForModule;

/**
 * @deprecated Use zohoRecruitGetTagsForModulePageFactory instead.
 */
export const getTagsForModulePageFactory = zohoRecruitGetTagsForModulePageFactory;

/**
 * @deprecated Use zohoRecruitAddTagsToRecords instead.
 */
export const addTagsToRecords = zohoRecruitAddTagsToRecords;

/**
 * @deprecated Use zohoRecruitRemoveTagsFromRecords instead.
 */
export const removeTagsFromRecords = zohoRecruitRemoveTagsFromRecords;

/**
 * @deprecated Use ZohoRecruitGetTagsForModulePageFactory instead.
 */
export type GetTagsForModulePageFactory = ZohoRecruitGetTagsForModulePageFactory;
