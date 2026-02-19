import { type ZohoCrmContext } from './crm.config';
import { type ArrayOrValue, asArray, type Maybe, separateValues } from '@dereekb/util';
import { type ZohoCrmModuleNameRef, type ZohoCrmRecordId } from './crm';
import { zohoCrmApiFetchJsonInput, type ZohoCrmChangeObjectLikeResponse, type ZohoCrmChangeObjectLikeResponseSuccessEntryMeta, type ZohoCrmChangeObjectResponse, type ZohoCrmChangeObjectResponseErrorEntry, type ZohoCrmChangeObjectResponseSuccessEntry, type ZohoCrmGetRecordsPageFilter, zohoCrmMultiRecordResult, type ZohoCrmMultiRecordResult, type ZohoCrmMultiRecordResultEntry } from './crm.api';
import { ZOHO_DUPLICATE_DATA_ERROR_CODE, ZohoServerFetchResponseError } from '../zoho.error.api';
import { type ZohoCrmTagId, type ZohoCrmTagData, type ZohoCrmTagName, type ZohoCrmTagWithObjectDetails } from './crm.tags';
import { type FetchPage, type FetchPageFactoryOptions, makeUrlSearchParams } from '@dereekb/util/fetch';
import { zohoFetchPageFactory, type ZohoPageResult } from '../zoho.api.page';

// MARK: Create Tag
export type ZohoCrmCreateTagData = Pick<ZohoCrmTagData, 'name'> & Partial<Pick<ZohoCrmTagData, 'color_code'>>;

export interface ZohoCrmCreateTagsRequest extends ZohoCrmModuleNameRef {
  readonly tags: ArrayOrValue<ZohoCrmCreateTagData>;
}

export interface ZohoCrmCreateTagsResponse {
  readonly tags: ZohoCrmChangeObjectResponse['data'];
}

export type ZohoCrmCreateTagsResult = ZohoCrmMultiRecordResult<ZohoCrmCreateTagData, ZohoCrmChangeObjectResponseSuccessEntry, ZohoCrmChangeObjectResponseErrorEntry> & {
  readonly duplicateErrorItems: ZohoCrmMultiRecordResultEntry<ZohoCrmCreateTagData, ZohoCrmChangeObjectResponseErrorEntry>[];
  readonly allErrorItems: ZohoCrmMultiRecordResultEntry<ZohoCrmCreateTagData, ZohoCrmChangeObjectResponseErrorEntry>[];
};

export type ZohoCrmCreateTagsFunction = (input: ZohoCrmCreateTagsRequest) => Promise<ZohoCrmCreateTagsResult>;

export function zohoCrmCreateTagsForModule(context: ZohoCrmContext) {
  return (input: ZohoCrmCreateTagsRequest) =>
    context
      .fetchJson<ZohoCrmCreateTagsResponse>(`/v8/settings/tags?${makeUrlSearchParams({ module: input.module })}`, zohoCrmApiFetchJsonInput('POST', { tags: asArray(input.tags) }))
      .catch((e) => {
        let result: Maybe<ZohoCrmCreateTagsResponse>;

        if (e instanceof ZohoServerFetchResponseError) {
          const tags = e.data?.tags;

          if (Array.isArray(tags)) {
            result = {
              tags
            };
          }
        }

        if (!result) {
          throw e;
        }

        return result;
      })
      .then((x) => {
        const result = zohoCrmMultiRecordResult<ZohoCrmCreateTagData, ZohoCrmChangeObjectResponseSuccessEntry, ZohoCrmChangeObjectResponseErrorEntry>(asArray(input.tags), x.tags);

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
export interface ZohoCrmGetTagsRequest extends ZohoCrmModuleNameRef, ZohoCrmGetRecordsPageFilter {
  readonly my_tags?: string;
}

export interface ZohoCrmGetTagsResponse extends Omit<ZohoPageResult<ZohoCrmTagWithObjectDetails>, 'data'> {
  readonly tags: ZohoCrmTagWithObjectDetails[];
}

export type ZohoCrmGetTagsResult = ZohoPageResult<ZohoCrmTagWithObjectDetails>;
export type ZohoCrmGetTagsFunction = (input: ZohoCrmGetTagsRequest) => Promise<ZohoCrmGetTagsResult>;

/**
 * Returns the list of tags within a module.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/get-tag-list.html
 *
 * @param context
 * @returns
 */
export function zohoCrmGetTagsForModule(context: ZohoCrmContext): ZohoCrmGetTagsFunction {
  return (input: ZohoCrmGetTagsRequest) =>
    context.fetchJson<ZohoCrmGetTagsResponse>(`/v8/settings/tags?${makeUrlSearchParams({ module: input.module, my_tags: input.my_tags })}`, zohoCrmApiFetchJsonInput('GET')).then((x) => {
      // NOTE: This doesn't follow the api documentation, and instead is a normal page result except it has "tags" instead of "data".

      return {
        ...x,
        data: x.tags
      };
    });
}

export type ZohoCrmGetTagsForModulePageFactory = (input: ZohoCrmGetTagsRequest, options?: Maybe<FetchPageFactoryOptions<ZohoCrmGetTagsRequest, ZohoCrmGetTagsResult>>) => FetchPage<ZohoCrmGetTagsRequest, ZohoCrmGetTagsResult>;

export function zohoCrmGetTagsForModulePageFactory(context: ZohoCrmContext): ZohoCrmGetTagsForModulePageFactory {
  return zohoFetchPageFactory(zohoCrmGetTagsForModule(context));
}

// MARK: Add Tag To Record
/**
 * Limit enforced by Zoho Crm
 */
export const ZOHO_CRM_ADD_TAGS_TO_RECORDS_MAX_IDS_ALLOWED = 100;

export interface ZohoCrmAddTagsToRecordsRequest extends ZohoCrmModuleNameRef {
  /**
   * Tag names to add to the records.
   */
  readonly tag_names?: Maybe<ArrayOrValue<ZohoCrmTagName>>;
  /**
   * Specific tags to add to the records.
   */
  readonly tags?: Maybe<ArrayOrValue<ZohoCrmTagData & { id?: Maybe<ZohoCrmTagId> }>>;
  /**
   * Specify if the existing tags are to be overwritten.
   */
  readonly over_write?: Maybe<boolean>;
  /**
   * Ids corresponding to the records in the module to add the tags to.
   *
   * Max of 100 ids.
   */
  readonly ids: ArrayOrValue<ZohoCrmRecordId>;
}

export interface ZohoCrmAddTagsToRecordsResultDetails {
  /**
   * Record id that was updated
   */
  readonly id: ZohoCrmRecordId;
  /**
   * Tag names that were added to the record
   */
  readonly tags: ZohoCrmTagName[];
}

export interface ZohoCrmAddTagsToRecordsSuccessEntry extends ZohoCrmChangeObjectLikeResponseSuccessEntryMeta {
  readonly details: ZohoCrmAddTagsToRecordsResultDetails;
}

export type ZohoCrmAddTagsToRecordsResponse = ZohoCrmChangeObjectLikeResponse<ZohoCrmAddTagsToRecordsSuccessEntry>;

/**
 * Contains all the details of the error.
 */
export type ZohoCrmAddTagsToRecordsErrorEntryDetails = ZohoCrmAddTagsToRecordsResultDetails;

export type ZohoCrmAddTagsToRecordsErrorEntry = ZohoCrmChangeObjectResponseErrorEntry & {
  readonly details: ZohoCrmAddTagsToRecordsErrorEntryDetails;
};

export type ZohoCrmAddTagsToRecordsResult = ZohoCrmMultiRecordResult<ZohoCrmAddTagsToRecordsRequest, ZohoCrmAddTagsToRecordsSuccessEntry, ZohoCrmAddTagsToRecordsErrorEntry>;

export type ZohoCrmAddTagsToRecordsFunction = (input: ZohoCrmAddTagsToRecordsRequest) => Promise<ZohoCrmAddTagsToRecordsResult>;

/**
 * Adds one or more tags to one or more records.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/add-tags.html
 *
 * @param context
 * @returns
 */
export function zohoCrmAddTagsToRecords(context: ZohoCrmContext): ZohoCrmAddTagsToRecordsFunction {
  return (input: ZohoCrmAddTagsToRecordsRequest) => {
    return context.fetchJson<ZohoCrmAddTagsToRecordsResponse>(`/v8/${input.module}/actions/add_tags`, zohoCrmApiFetchJsonInput('POST', zohoCrmAddTagsToRecordsRequestBody(input))).then((x: ZohoCrmAddTagsToRecordsResponse) => {
      const resultInputMap = x.data.map(() => input); // assign "input" to each value for now
      return zohoCrmMultiRecordResult<ZohoCrmAddTagsToRecordsRequest, ZohoCrmAddTagsToRecordsSuccessEntry, ZohoCrmAddTagsToRecordsErrorEntry>(resultInputMap, x.data);
    });
  };
}

export function zohoCrmAddTagsToRecordsRequestBody(input: ZohoCrmAddTagsToRecordsRequest) {
  if (Array.isArray(input.ids) && input.ids.length > ZOHO_CRM_ADD_TAGS_TO_RECORDS_MAX_IDS_ALLOWED) {
    throw new Error(`Cannot add/remove tags from more than ${ZOHO_CRM_ADD_TAGS_TO_RECORDS_MAX_IDS_ALLOWED} records at once.`);
  }

  const tags: ZohoCrmAddTagsToRecordsRequest['tags'] = [...asArray(input.tags)];
  const tagNames = new Set(tags.map((x) => x.name));

  if (input.tag_names) {
    asArray(input.tag_names).forEach((x) => {
      if (!tagNames.has(x)) {
        tags.push({ name: x });
        tagNames.add(x);
      }
    });
  }

  return {
    tags,
    ids: asArray(input.ids)
  };
}

// MARK: Remove Tag From Record
/**
 * Limit enforced by Zoho Crm
 */
export const ZOHO_CRM_REMOVE_TAGS_FROM_RECORDS_MAX_IDS_ALLOWED = 100;

export type ZohoCrmRemoveTagsFromRecordsRequest = ZohoCrmAddTagsToRecordsRequest;
export type ZohoCrmRemoveTagsFromRecordsResultDetails = ZohoCrmAddTagsToRecordsResultDetails;

export interface ZohoCrmRemoveTagsFromRecordsSuccessEntry extends ZohoCrmChangeObjectLikeResponseSuccessEntryMeta {
  readonly details: ZohoCrmRemoveTagsFromRecordsResultDetails;
}

export type ZohoCrmRemoveTagsFromRecordsResponse = ZohoCrmChangeObjectLikeResponse<ZohoCrmRemoveTagsFromRecordsSuccessEntry>;

/**
 * Contains all the details of the error.
 */
export type ZohoCrmRemoveTagsFromRecordsErrorEntryDetails = ZohoCrmRemoveTagsFromRecordsResultDetails;

export type ZohoCrmRemoveTagsFromRecordsErrorEntry = ZohoCrmChangeObjectResponseErrorEntry & {
  readonly details: ZohoCrmRemoveTagsFromRecordsErrorEntryDetails;
};

export type ZohoCrmRemoveTagsFromRecordsResult = ZohoCrmMultiRecordResult<ZohoCrmRemoveTagsFromRecordsRequest, ZohoCrmRemoveTagsFromRecordsSuccessEntry, ZohoCrmRemoveTagsFromRecordsErrorEntry>;

export type ZohoCrmRemoveTagsFromRecordsFunction = (input: ZohoCrmRemoveTagsFromRecordsRequest) => Promise<ZohoCrmRemoveTagsFromRecordsResult>;

/**
 * Removes one or more tags from one or more records.
 *
 * https://www.zoho.com/crm/developer-guide/apiv2/remove-tags.html
 *
 * @param context
 * @returns
 */
export function zohoCrmRemoveTagsFromRecords(context: ZohoCrmContext): ZohoCrmRemoveTagsFromRecordsFunction {
  return (input: ZohoCrmRemoveTagsFromRecordsRequest) => {
    return context.fetchJson<ZohoCrmRemoveTagsFromRecordsResponse>(`/v8/${input.module}/actions/remove_tags`, zohoCrmApiFetchJsonInput('POST', zohoCrmAddTagsToRecordsRequestBody(input))).then((x: ZohoCrmRemoveTagsFromRecordsResponse) => {
      const resultInputMap = x.data.map(() => input); // assign "input" to each value for now
      return zohoCrmMultiRecordResult<ZohoCrmRemoveTagsFromRecordsRequest, ZohoCrmRemoveTagsFromRecordsSuccessEntry, ZohoCrmRemoveTagsFromRecordsErrorEntry>(resultInputMap, x.data);
    });
  };
}
