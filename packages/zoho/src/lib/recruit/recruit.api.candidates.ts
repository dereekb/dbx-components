import { type ZohoRecruitContext } from './recruit.config';
import { type ArrayOrValue, asArray, separateValues } from '@dereekb/util';
import { type ZohoRecruitJobOpeningId, type ZohoRecruitCandidateId, ZOHO_RECRUIT_CANDIDATES_MODULE, type ZohoRecruitCandidateStatus, type ZohoRecruitJobOpeningPostingTitle, type ZohoRecruitModuleNameRef, type ZohoRecruitRecord, ZOHO_RECRUIT_JOB_OPENINGS_MODULE } from './recruit';
import { zohoRecruitApiFetchJsonInput, type ZohoRecruitChangeObjectLikeResponse, type ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta, type ZohoRecruitChangeObjectResponseErrorEntry, type ZohoRecruitGetRecordsPageFilter, zohoRecruitMultiRecordResult, type ZohoRecruitMultiRecordResult, type ZohoRecruitMultiRecordResultEntry, type ZohoRecruitSearchRecordsResponse, zohoRecruitUrlSearchParamsMinusIdAndModule } from './recruit.api';
import { ZOHO_FAILURE_ERROR_CODE, type ZohoServerErrorDataWithDetails } from '../zoho.error.api';
import { ZOHO_RECRUIT_ALREADY_ASSOCIATED_ERROR_CODE } from './recruit.error.api';
import { emptyZohoPageResult, zohoFetchPageFactory } from '../zoho.api.page';

// MARK: Associate Candidates Record
export type ZohoRecruitAssociateCandidateRecordsWithJobOpeningsInput = ArrayOrValue<ZohoRecruitAssociateCandidateRecordsWithJobOpeningsInputData>;

export interface ZohoRecruitAssociateCandidateRecordsWithJobOpeningsInputData {
  readonly jobids: ZohoRecruitJobOpeningId[];
  readonly ids: ZohoRecruitCandidateId[];
}

export interface ZohoRecruitAssociateCandidateRecordsWithJobOpeningsResultDetails {
  /**
   * Job Opening id that was updated
   */
  readonly jobid: ZohoRecruitJobOpeningId;
  /**
   * Candidate ids that were associated with the job opening
   */
  readonly ids: ZohoRecruitCandidateId[];
}

export interface ZohoRecruitAssociateCandidateRecordsWithJobOpeningsSuccessEntry extends ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta {
  readonly details: ZohoRecruitAssociateCandidateRecordsWithJobOpeningsResultDetails;
}

export type ZohoRecruitAssociateCandidateRecordsWithJobOpeningsResponse = ZohoRecruitChangeObjectLikeResponse<ZohoRecruitAssociateCandidateRecordsWithJobOpeningsSuccessEntry>;

export interface ZohoRecruitAssociateCandidateRecordsWithJobOpeningsErrorEntryDetails extends ZohoRecruitAssociateCandidateRecordsWithJobOpeningsResultDetails {
  readonly error: ZohoServerErrorDataWithDetails[];
}

export type ZohoRecruitAssociateCandidateRecordsWithJobOpeningsErrorEntry = ZohoRecruitChangeObjectResponseErrorEntry & {
  readonly details: ZohoRecruitAssociateCandidateRecordsWithJobOpeningsErrorEntryDetails;
};

export type ZohoRecruitAssociateCandidateRecordsWithJobOpeningsResult = ZohoRecruitMultiRecordResult<ZohoRecruitAssociateCandidateRecordsWithJobOpeningsInput, ZohoRecruitAssociateCandidateRecordsWithJobOpeningsSuccessEntry, ZohoRecruitAssociateCandidateRecordsWithJobOpeningsErrorEntry> & {
  /**
   * List of items that are already associated with the job opening
   */
  readonly alreadyAssociatedErrorItems: ZohoRecruitMultiRecordResultEntry<ZohoRecruitAssociateCandidateRecordsWithJobOpeningsInput, ZohoRecruitAssociateCandidateRecordsWithJobOpeningsErrorEntry>[];
  readonly allErrorItems: ZohoRecruitMultiRecordResultEntry<ZohoRecruitAssociateCandidateRecordsWithJobOpeningsInput, ZohoRecruitAssociateCandidateRecordsWithJobOpeningsErrorEntry>[];
};

export type ZohoRecruitAssociateCandidateRecordsWithJobOpeningsFunction = (input: ZohoRecruitAssociateCandidateRecordsWithJobOpeningsInput) => Promise<ZohoRecruitAssociateCandidateRecordsWithJobOpeningsResult>;

/**
 * Associates one or more candidates with one or more job openings.
 *
 * https://www.zoho.com/recruit/developer-guide/apiv2/associate-candidate.html
 *
 * @param context
 * @returns
 */
export function zohoRecruitAssociateCandidateRecordsWithJobOpenings(context: ZohoRecruitContext): ZohoRecruitAssociateCandidateRecordsWithJobOpeningsFunction {
  return (input: ZohoRecruitAssociateCandidateRecordsWithJobOpeningsInput) =>
    context.fetchJson<ZohoRecruitAssociateCandidateRecordsWithJobOpeningsResponse>(`/v2/${ZOHO_RECRUIT_CANDIDATES_MODULE}/actions/associate`, zohoRecruitApiFetchJsonInput('PUT', { data: asArray(input) })).then((x: ZohoRecruitAssociateCandidateRecordsWithJobOpeningsResponse) => {
      const resultInputMap = x.data.map(() => input); // assign "input" to each value for now
      const result = zohoRecruitMultiRecordResult<ZohoRecruitAssociateCandidateRecordsWithJobOpeningsInput, ZohoRecruitAssociateCandidateRecordsWithJobOpeningsSuccessEntry, ZohoRecruitAssociateCandidateRecordsWithJobOpeningsErrorEntry>(resultInputMap, x.data);

      const { included: alreadyAssociatedErrorItems, excluded: otherErrorItems } = separateValues(result.errorItems, (x) => {
        return x.result.code === ZOHO_FAILURE_ERROR_CODE && x.result.details.error[0].code === ZOHO_RECRUIT_ALREADY_ASSOCIATED_ERROR_CODE;
      });

      return {
        ...result,
        errorItems: otherErrorItems,
        alreadyAssociatedErrorItems,
        allErrorItems: result.errorItems
      };
    });
}

// MARK: Search Associated Records
export interface ZohoRecruitSearchAssociatedRecordsInput extends ZohoRecruitModuleNameRef, ZohoRecruitGetRecordsPageFilter {
  readonly id: ZohoRecruitCandidateId | ZohoRecruitJobOpeningId;
  /**
   * Posting title to filter associated Job Openings by
   */
  readonly posting_title?: ZohoRecruitJobOpeningPostingTitle;
  /**
   * Candidate statuses to filter associated Candidates by
   */
  readonly candidate_statuses?: ZohoRecruitCandidateStatus;
}

export type ZohoRecruitSearchAssociatedRecordsResponse<T = ZohoRecruitRecord> = ZohoRecruitSearchRecordsResponse<T>;
export type ZohoRecruitSearchAssociatedRecordsFunction<R extends ZohoRecruitSearchAssociatedRecordsResponse> = (input: ZohoRecruitSearchAssociatedRecordsInput) => Promise<R>;
export function zohoRecruitSearchAssociatedRecords<R extends ZohoRecruitSearchAssociatedRecordsResponse>(context: ZohoRecruitContext): ZohoRecruitSearchAssociatedRecordsFunction<R> {
  return (input: ZohoRecruitSearchAssociatedRecordsInput) => {
    return context.fetchJson<R | null>(`/v2/${input.module}/${input.id}/associate?${zohoRecruitUrlSearchParamsMinusIdAndModule(input).toString()}`, zohoRecruitApiFetchJsonInput('GET')).then((x) => {
      const result: R = x ?? (emptyZohoPageResult<R['data']['0']>() as R);
      return result;
    });
  };
}

export type ZohoRecruitSearchCandidateAssociatedJobOpeningRecordsInput = Omit<ZohoRecruitSearchAssociatedRecordsInput, 'module' | 'candidate_statuses'>;
export type ZohoRecruitSearchCandidateAssociatedJobOpeningRecordsFunction<T extends ZohoRecruitRecord> = (input: ZohoRecruitSearchCandidateAssociatedJobOpeningRecordsInput) => Promise<ZohoRecruitSearchAssociatedRecordsResponse<T>>;

export function zohoRecruitSearchCandidateAssociatedJobOpeningRecords<T extends ZohoRecruitRecord>(context: ZohoRecruitContext): ZohoRecruitSearchCandidateAssociatedJobOpeningRecordsFunction<T> {
  const searchAssociatedRecordsFactory = zohoRecruitSearchAssociatedRecords<ZohoRecruitSearchAssociatedRecordsResponse<T>>(context);
  return (input: ZohoRecruitSearchCandidateAssociatedJobOpeningRecordsInput) => {
    return searchAssociatedRecordsFactory({
      ...input,
      module: ZOHO_RECRUIT_CANDIDATES_MODULE
    });
  };
}

export function zohoRecruitSearchCandidateAssociatedJobOpeningRecordsPageFactory<T extends ZohoRecruitRecord>(context: ZohoRecruitContext) {
  return zohoFetchPageFactory(zohoRecruitSearchCandidateAssociatedJobOpeningRecords<T>(context));
}

export type ZohoRecruitSearchJobOpeningAssociatedCandidateRecordsInput = Omit<ZohoRecruitSearchAssociatedRecordsInput, 'module' | 'posting_title'>;
export type ZohoRecruitSearchJobOpeningAssociatedCandidateRecordsFunction<T extends ZohoRecruitRecord> = (input: ZohoRecruitSearchJobOpeningAssociatedCandidateRecordsInput) => Promise<ZohoRecruitSearchAssociatedRecordsResponse<T>>;

export function zohoRecruitSearchJobOpeningAssociatedCandidateRecords<T extends ZohoRecruitRecord>(context: ZohoRecruitContext, jobOpeningModuleName = ZOHO_RECRUIT_JOB_OPENINGS_MODULE): ZohoRecruitSearchJobOpeningAssociatedCandidateRecordsFunction<T> {
  const searchAssociatedRecordsFactory = zohoRecruitSearchAssociatedRecords<ZohoRecruitSearchAssociatedRecordsResponse<T>>(context);
  return (input: ZohoRecruitSearchJobOpeningAssociatedCandidateRecordsInput) => {
    return searchAssociatedRecordsFactory({
      ...input,
      module: jobOpeningModuleName
    });
  };
}

export function zohoRecruitSearchJobOpeningAssociatedCandidateRecordsPageFactory<T extends ZohoRecruitRecord>(context: ZohoRecruitContext) {
  return zohoFetchPageFactory(zohoRecruitSearchJobOpeningAssociatedCandidateRecords<T>(context));
}

// MARK: Compat
/**
 * @deprecated Use zohoRecruitAssociateCandidateRecordsWithJobOpenings instead.
 */
export const associateCandidateRecordsWithJobOpenings = zohoRecruitAssociateCandidateRecordsWithJobOpenings;

/**
 * @deprecated Use zohoRecruitSearchAssociatedRecords instead.
 */
export const searchAssociatedRecords = zohoRecruitSearchAssociatedRecords;

/**
 * @deprecated Use zohoRecruitSearchCandidateAssociatedJobOpeningRecords instead.
 */
export const searchCandidateAssociatedJobOpeningRecords = zohoRecruitSearchCandidateAssociatedJobOpeningRecords;

/**
 * @deprecated Use zohoRecruitSearchCandidateAssociatedJobOpeningRecordsPageFactory instead.
 */
export const searchCandidateAssociatedJobOpeningRecordsPageFactory = zohoRecruitSearchCandidateAssociatedJobOpeningRecordsPageFactory;

/**
 * @deprecated Use zohoRecruitSearchJobOpeningAssociatedCandidateRecords instead.
 */
export const searchJobOpeningAssociatedCandidateRecords = zohoRecruitSearchJobOpeningAssociatedCandidateRecords;

/**
 * @deprecated Use zohoRecruitSearchJobOpeningAssociatedCandidateRecordsPageFactory instead.
 */
export const searchJobOpeningAssociatedCandidateRecordsPageFactory = zohoRecruitSearchJobOpeningAssociatedCandidateRecordsPageFactory;
