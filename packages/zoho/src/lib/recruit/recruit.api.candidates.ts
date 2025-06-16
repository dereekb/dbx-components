import { ZohoRecruitContext } from './recruit.config';
import { ArrayOrValue, asArray, separateValues } from '@dereekb/util';
import { ZohoRecruitJobOpeningId, ZohoRecruitCandidateId } from './recruit';
import { zohoRecruitApiFetchJsonInput, ZohoRecruitChangeObjectLikeResponse, ZohoRecruitChangeObjectLikeResponseSuccessEntryMeta, ZohoRecruitChangeObjectResponseErrorEntry, zohoRecruitMultiRecordResult, ZohoRecruitMultiRecordResult, ZohoRecruitMultiRecordResultEntry } from './recruit.api';
import { ZOHO_FAILURE_ERROR_CODE, ZohoServerErrorDataWithDetails } from '../zoho.error.api';
import { ZOHO_RECRUIT_ALREADY_ASSOCIATED_ERROR_CODE } from './recruit.error.api';

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
export function associateCandidateRecordsWithJobOpenings(context: ZohoRecruitContext): ZohoRecruitAssociateCandidateRecordsWithJobOpeningsFunction {
  return (input: ZohoRecruitAssociateCandidateRecordsWithJobOpeningsInput) =>
    context.fetchJson<ZohoRecruitAssociateCandidateRecordsWithJobOpeningsResponse>(`/v2/Candidates/actions/associate`, zohoRecruitApiFetchJsonInput('PUT', { data: asArray(input) })).then((x: ZohoRecruitAssociateCandidateRecordsWithJobOpeningsResponse) => {
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
