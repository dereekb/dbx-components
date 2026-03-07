import { type ZohoPageResult, zohoFetchPageFactory } from '../zoho.api.page';
import { type FetchPageFactory, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoRecruitContext } from './recruit.config';
import { ZOHO_RECRUIT_NOTES_MODULE, type ZohoRecruitModuleNameRef, type ZohoRecruitRecordId } from './recruit';
import { type ArrayOrValue, asArray } from '@dereekb/util';
import { type ZohoRecruitMultiRecordResult, type ZohoRecruitChangeObjectResponseSuccessEntry, type ZohoRecruitChangeObjectResponseErrorEntry, type ZohoRecruitChangeObjectResponse, zohoRecruitApiFetchJsonInput, zohoRecruitMultiRecordResult, type ZohoRecruitGetRelatedRecordsRequest, zohoRecruitGetRelatedRecordsFunctionFactory } from './recruit.api';
import { type NewZohoRecruitNoteData, type ZohoRecruitNoteId, type ZohoRecruitRecordNote } from './recruit.notes';

// MARK: Notes
/**
 * Request for creating one or more notes in the Notes module.
 */
export interface ZohoRecruitCreateNotesRequest {
  readonly data: ZohoRecruitCreateNotesRequestEntry[];
}

/**
 * Paired success/error result from a bulk note creation operation.
 */
export type ZohoRecruitCreateNotesResult = ZohoRecruitMultiRecordResult<ZohoRecruitCreateNotesRequestEntry, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>;

/**
 * Input data for a single note entry, equivalent to {@link NewZohoRecruitNoteData}.
 */
export type ZohoRecruitCreateNotesRequestEntry = NewZohoRecruitNoteData;

/**
 * Raw API response from the create notes endpoint.
 */
export type ZohoRecruitCreateNotesResponse = ZohoRecruitChangeObjectResponse;

/**
 * Creates one or more notes in the Notes module, returning paired success/error results.
 */
export type ZohoRecruitCreateNotesFunction = (input: ZohoRecruitCreateNotesRequest) => Promise<ZohoRecruitCreateNotesResult>;

/**
 * Creates a {@link ZohoRecruitCreateNotesFunction} bound to the given context.
 *
 * Creates one or more notes directly in the Notes module. Each note entry must include
 * `se_module` and `Parent_Id` to link the note to a record.
 *
 * Prefer {@link zohoRecruitCreateNotesForRecord} when creating notes linked to a specific
 * record, as it handles the module/parent linking automatically.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that creates notes in the Notes module
 *
 * @example
 * ```typescript
 * const createNotes = zohoRecruitCreateNotes(context);
 *
 * const result = await createNotes({
 *   data: [{
 *     Note_Title: 'Interview Notes',
 *     Note_Content: 'Strong candidate',
 *     se_module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *     Parent_Id: candidateId
 *   }]
 * });
 * ```
 */
export function zohoRecruitCreateNotes(context: ZohoRecruitContext) {
  return (input: ZohoRecruitCreateNotesRequest) =>
    context.fetchJson<ZohoRecruitCreateNotesResponse>(`/v2/${ZOHO_RECRUIT_NOTES_MODULE}`, zohoRecruitApiFetchJsonInput('POST', { data: input.data })).then((x) => {
      return zohoRecruitMultiRecordResult<ZohoRecruitCreateNotesRequestEntry, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>(asArray(input.data), x.data);
    });
}

/**
 * Request for deleting one or more notes by their ids.
 */
export interface ZohoRecruitDeleteNotesRequest {
  readonly ids: ArrayOrValue<ZohoRecruitNoteId>;
}

/**
 * Paired success/error result from a bulk note deletion operation.
 */
export type ZohoRecruitDeleteNotesResult = ZohoRecruitMultiRecordResult<ZohoRecruitNoteId, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>;

/**
 * Raw API response from the delete notes endpoint.
 */
export type ZohoRecruitDeleteNotesResponse = ZohoRecruitChangeObjectResponse;

/**
 * Deletes one or more notes by their IDs, returning paired success/error results.
 */
export type ZohoRecruitDeleteNotesFunction = (input: ZohoRecruitDeleteNotesRequest) => Promise<ZohoRecruitDeleteNotesResult>;

/**
 * Creates a {@link ZohoRecruitDeleteNotesFunction} bound to the given context.
 *
 * Deletes one or more notes by their IDs from the Notes module. Returns a paired
 * success/error result for each note ID.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that deletes notes by ID
 *
 * @example
 * ```typescript
 * const deleteNotes = zohoRecruitDeleteNotes(context);
 *
 * const result = await deleteNotes({ ids: [noteId1, noteId2] });
 * ```
 */
export function zohoRecruitDeleteNotes(context: ZohoRecruitContext) {
  return (input: ZohoRecruitDeleteNotesRequest) =>
    context.fetchJson<ZohoRecruitDeleteNotesResponse>(`/v2/${ZOHO_RECRUIT_NOTES_MODULE}?${makeUrlSearchParams({ ids: input.ids })}`, zohoRecruitApiFetchJsonInput('DELETE')).then((x) => {
      return zohoRecruitMultiRecordResult<ZohoRecruitNoteId, ZohoRecruitChangeObjectResponseSuccessEntry, ZohoRecruitChangeObjectResponseErrorEntry>(asArray(input.ids), x.data);
    });
}

/**
 * Request for fetching notes related to a record, using the related records API input shape.
 */
export type ZohoRecruitGetNotesForRecordRequest = ZohoRecruitGetRelatedRecordsRequest;

/**
 * Paginated response containing note records for a parent record.
 */
export type ZohoRecruitGetNotesForRecordResponse = ZohoPageResult<ZohoRecruitRecordNote>;

/**
 * Retrieves paginated notes for a specific record in a module.
 */
export type ZohoRecruitGetNotesForRecordFunction = (input: ZohoRecruitGetNotesForRecordRequest) => Promise<ZohoRecruitGetNotesForRecordResponse>;

/**
 * Creates a {@link ZohoRecruitGetNotesForRecordFunction} bound to the given context.
 *
 * Retrieves notes related to a specific record by targeting the Notes module
 * via the related records API. Returns an empty page result when no notes exist.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that retrieves notes for a record
 *
 * @example
 * ```typescript
 * const getNotesForRecord = zohoRecruitGetNotesForRecord(context);
 *
 * const result = await getNotesForRecord({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   id: candidateId
 * });
 * ```
 */
export function zohoRecruitGetNotesForRecord(context: ZohoRecruitContext): ZohoRecruitGetNotesForRecordFunction {
  return zohoRecruitGetRelatedRecordsFunctionFactory(context)<ZohoRecruitRecordNote>({ targetModule: ZOHO_RECRUIT_NOTES_MODULE });
}

/**
 * Page factory type for paginated note retrieval.
 */
export type ZohoRecruitGetNotesForRecordPageFactory = FetchPageFactory<ZohoRecruitGetNotesForRecordRequest, ZohoRecruitGetNotesForRecordResponse>;

/**
 * Creates a {@link ZohoRecruitGetNotesForRecordPageFactory} bound to the given context.
 *
 * Returns a page factory for iterating over notes related to a record across
 * multiple pages. Wraps {@link zohoRecruitGetNotesForRecord} with automatic
 * pagination handling via {@link zohoFetchPageFactory}.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Page factory for iterating over record notes
 */
export function zohoRecruitGetNotesForRecordPageFactory(context: ZohoRecruitContext): ZohoRecruitGetNotesForRecordPageFactory {
  return zohoFetchPageFactory(zohoRecruitGetNotesForRecord(context));
}

/**
 * Input for creating notes linked to a specific record. The `se_module` and `Parent_Id` fields are set automatically from the module and id.
 */
export interface ZohoRecruitCreateNotesForRecordRequest extends ZohoRecruitModuleNameRef {
  readonly id: ZohoRecruitRecordId;
  readonly notes: ArrayOrValue<Omit<NewZohoRecruitNoteData, 'se_module' | 'Parent_Id'>>;
}

/**
 * Creates one or more notes linked to a specific record, returning paired success/error results.
 */
export type ZohoRecruitCreateNotesForRecordFunction = (input: ZohoRecruitCreateNotesForRecordRequest) => Promise<ZohoRecruitCreateNotesResult>;

/**
 * Creates a {@link ZohoRecruitCreateNotesForRecordFunction} bound to the given context.
 *
 * Creates one or more notes linked to a specific record. Automatically sets
 * `se_module` and `Parent_Id` on each note entry from the request's `module` and `id`,
 * then delegates to {@link zohoRecruitCreateNotes}.
 *
 * @param context - Authenticated Zoho Recruit context providing fetch and rate limiting
 * @returns Function that creates notes linked to a specific record
 *
 * @example
 * ```typescript
 * const createNotesForRecord = zohoRecruitCreateNotesForRecord(context);
 *
 * const result = await createNotesForRecord({
 *   module: ZOHO_RECRUIT_CANDIDATES_MODULE,
 *   id: candidateId,
 *   notes: {
 *     Note_Title: 'Interview Notes',
 *     Note_Content: 'Strong candidate for the role.'
 *   }
 * });
 * ```
 */
export function zohoRecruitCreateNotesForRecord(context: ZohoRecruitContext): ZohoRecruitCreateNotesForRecordFunction {
  const createNotesInstance = zohoRecruitCreateNotes(context);
  return (input: ZohoRecruitCreateNotesForRecordRequest) => {
    const { module: se_module, id: Parent_Id, notes } = input;
    const createNotesRequest: ZohoRecruitCreateNotesRequest = {
      data: asArray(notes).map((x) => ({
        ...x,
        se_module,
        Parent_Id
      }))
    };

    return createNotesInstance(createNotesRequest);
  };
}

// MARK: Compat
/**
 * @deprecated Use zohoRecruitCreateNotes instead.
 */
export const createNotes = zohoRecruitCreateNotes;

/**
 * @deprecated Use zohoRecruitDeleteNotes instead.
 */
export const deleteNotes = zohoRecruitDeleteNotes;

/**
 * @deprecated Use zohoRecruitGetNotesForRecord instead.
 */
export const getNotesForRecord = zohoRecruitGetNotesForRecord;

/**
 * @deprecated Use zohoRecruitGetNotesForRecordPageFactory instead.
 */
export const getNotesForRecordPageFactory = zohoRecruitGetNotesForRecordPageFactory;

/**
 * @deprecated Use zohoRecruitCreateNotesForRecord instead.
 */
export const createNotesForRecord = zohoRecruitCreateNotesForRecord;

/**
 * @deprecated Use ZohoRecruitGetNotesForRecordPageFactory instead.
 */
export type GetNotesForRecordPageFactory = ZohoRecruitGetNotesForRecordPageFactory;
