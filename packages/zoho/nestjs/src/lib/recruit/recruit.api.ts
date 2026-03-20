import { Inject, Injectable } from '@nestjs/common';
import {
  type ZohoRecruit,
  type ZohoRecruitContext,
  zohoRecruitAssociateCandidateRecordsWithJobOpenings,
  zohoRecruitCreateNotes,
  zohoRecruitCreateNotesForRecord,
  zohoRecruitDeleteNotes,
  zohoRecruitDeleteRecord,
  zohoRecruitExecuteRestApiFunction,
  zohoRecruitGetNotesForRecord,
  zohoRecruitGetNotesForRecordPageFactory,
  zohoRecruitGetRecordById,
  zohoRecruitGetRecords,
  zohoRecruitGetRelatedRecordsFunctionFactory,
  zohoRecruitInsertRecord,
  zohoRecruitSearchCandidateAssociatedJobOpeningRecords,
  zohoRecruitSearchCandidateAssociatedJobOpeningRecordsPageFactory,
  zohoRecruitSearchJobOpeningAssociatedCandidateRecords,
  zohoRecruitSearchJobOpeningAssociatedCandidateRecordsPageFactory,
  zohoRecruitSearchRecords,
  zohoRecruitSearchRecordsPageFactory,
  zohoRecruitUpdateRecord,
  zohoRecruitUpsertRecord,
  zohoRecruitFactory,
  zohoRecruitCreateTagsForModule,
  zohoRecruitGetTagsForModule,
  zohoRecruitAddTagsToRecords,
  zohoRecruitGetEmailsForRecord,
  zohoRecruitGetEmailsForRecordPageFactory,
  zohoRecruitGetAttachmentsForRecordPageFactory,
  zohoRecruitGetAttachmentsForRecord,
  zohoRecruitDownloadAttachmentForRecord,
  zohoRecruitUploadAttachmentForRecord,
  zohoRecruitDeleteAttachmentFromRecord,
  zohoRecruitRemoveTagsFromRecords
} from '@dereekb/zoho';
import { ZohoRecruitServiceConfig } from './recruit.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';

/**
 * NestJS injectable service that wraps the Zoho Recruit API.
 *
 * Provides convenient accessor getters for all Recruit operations, each bound
 * to the authenticated Recruit context created during construction.
 */
@Injectable()
export class ZohoRecruitApi {
  /**
   * Underlying Zoho Recruit client instance, initialized from the injected config and accounts context.
   */
  readonly zohoRecruit: ZohoRecruit;

  /**
   * The authenticated Recruit context used by all operation accessors.
   *
   * @returns the Recruit context from the underlying client
   */
  get recruitContext(): ZohoRecruitContext {
    return this.zohoRecruit.recruitContext;
  }

  /**
   * Rate limiter shared across all Recruit requests to respect Zoho API quotas.
   *
   * @returns the shared rate limiter instance
   */
  get zohoRateLimiter() {
    return this.zohoRecruit.recruitContext.zohoRateLimiter;
  }

  /**
   * Initializes the Recruit client by combining the service config with the
   * accounts context for OAuth token management.
   *
   * @param config - Zoho Recruit service configuration
   * @param zohoAccountsApi - accounts API used for OAuth token management
   */
  constructor(
    @Inject(ZohoRecruitServiceConfig) readonly config: ZohoRecruitServiceConfig,
    @Inject(ZohoAccountsApi) readonly zohoAccountsApi: ZohoAccountsApi
  ) {
    this.zohoRecruit = zohoRecruitFactory({
      ...config.factoryConfig,
      accountsContext: zohoAccountsApi.accountsContext
    })(config.zohoRecruit);
  }

  // MARK: Accessors
  /**
   * Configured pass-through for {@link zohoRecruitInsertRecord}.
   *
   * @returns bound insert record function
   */
  get insertRecord() {
    return zohoRecruitInsertRecord(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitUpsertRecord}.
   *
   * @returns bound upsert record function
   */
  get upsertRecord() {
    return zohoRecruitUpsertRecord(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitUpdateRecord}.
   *
   * @returns bound update record function
   */
  get updateRecord() {
    return zohoRecruitUpdateRecord(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitDeleteRecord}.
   *
   * @returns bound delete record function
   */
  get deleteRecord() {
    return zohoRecruitDeleteRecord(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitGetRecordById}.
   *
   * @returns bound get record by ID function
   */
  get getRecordById() {
    return zohoRecruitGetRecordById(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitGetRecords}.
   *
   * @returns bound get records function
   */
  get getRecords() {
    return zohoRecruitGetRecords(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitSearchRecords}.
   *
   * @returns bound search records function
   */
  get searchRecords() {
    return zohoRecruitSearchRecords(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitSearchRecordsPageFactory}.
   *
   * @returns bound search records page factory function
   */
  get searchRecordsPageFactory() {
    return zohoRecruitSearchRecordsPageFactory(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitGetRelatedRecordsFunctionFactory}.
   *
   * @returns bound get related records factory function
   */
  get getRelatedRecordsFunctionFactory() {
    return zohoRecruitGetRelatedRecordsFunctionFactory(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitGetEmailsForRecord}.
   *
   * @returns bound get emails for record function
   */
  get getEmailsForRecord() {
    return zohoRecruitGetEmailsForRecord(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitGetEmailsForRecordPageFactory}.
   *
   * @returns bound get emails page factory function
   */
  get getEmailsForRecordPageFactory() {
    return zohoRecruitGetEmailsForRecordPageFactory(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitGetAttachmentsForRecord}.
   *
   * @returns bound get attachments for record function
   */
  get getAttachmentsForRecord() {
    return zohoRecruitGetAttachmentsForRecord(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitGetAttachmentsForRecordPageFactory}.
   *
   * @returns bound get attachments page factory function
   */
  get getAttachmentsForRecordPageFactory() {
    return zohoRecruitGetAttachmentsForRecordPageFactory(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitUploadAttachmentForRecord}.
   *
   * @returns bound upload attachment function
   */
  get uploadAttachmentForRecord() {
    return zohoRecruitUploadAttachmentForRecord(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitDownloadAttachmentForRecord}.
   *
   * @returns bound download attachment function
   */
  get downloadAttachmentForRecord() {
    return zohoRecruitDownloadAttachmentForRecord(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitDeleteAttachmentFromRecord}.
   *
   * @returns bound delete attachment function
   */
  get deleteAttachmentFromRecord() {
    return zohoRecruitDeleteAttachmentFromRecord(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitCreateNotes}.
   *
   * @returns bound create notes function
   */
  get createNotes() {
    return zohoRecruitCreateNotes(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitDeleteNotes}.
   *
   * @returns bound delete notes function
   */
  get deleteNotes() {
    return zohoRecruitDeleteNotes(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitCreateNotesForRecord}.
   *
   * @returns bound create notes for record function
   */
  get createNotesForRecord() {
    return zohoRecruitCreateNotesForRecord(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitGetNotesForRecord}.
   *
   * @returns bound get notes for record function
   */
  get getNotesForRecord() {
    return zohoRecruitGetNotesForRecord(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitGetNotesForRecordPageFactory}.
   *
   * @returns bound get notes page factory function
   */
  get getNotesForRecordPageFactory() {
    return zohoRecruitGetNotesForRecordPageFactory(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitExecuteRestApiFunction}.
   *
   * @returns bound execute REST API function
   */
  get executeRestApiFunction() {
    return zohoRecruitExecuteRestApiFunction(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitAssociateCandidateRecordsWithJobOpenings}.
   *
   * @returns bound associate candidates with job openings function
   */
  get associateCandidateRecordsWithJobOpenings() {
    return zohoRecruitAssociateCandidateRecordsWithJobOpenings(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitSearchCandidateAssociatedJobOpeningRecords}.
   *
   * @returns bound search candidate associated job openings function
   */
  get searchCandidateAssociatedJobOpeningRecords() {
    return zohoRecruitSearchCandidateAssociatedJobOpeningRecords(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitSearchCandidateAssociatedJobOpeningRecordsPageFactory}.
   *
   * @returns bound search candidate job openings page factory function
   */
  get searchCandidateAssociatedJobOpeningRecordsPageFactory() {
    return zohoRecruitSearchCandidateAssociatedJobOpeningRecordsPageFactory(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitSearchJobOpeningAssociatedCandidateRecords}.
   *
   * @returns bound search job opening associated candidates function
   */
  get searchJobOpeningAssociatedCandidateRecords() {
    return zohoRecruitSearchJobOpeningAssociatedCandidateRecords(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitSearchJobOpeningAssociatedCandidateRecordsPageFactory}.
   *
   * @returns bound search job opening candidates page factory function
   */
  get searchJobOpeningAssociatedCandidateRecordsPageFactory() {
    return zohoRecruitSearchJobOpeningAssociatedCandidateRecordsPageFactory(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitCreateTagsForModule}.
   *
   * @returns bound create tags for module function
   */
  get createTagsForModule() {
    return zohoRecruitCreateTagsForModule(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitGetTagsForModule}.
   *
   * @returns bound get tags for module function
   */
  get getTagsForModule() {
    return zohoRecruitGetTagsForModule(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitAddTagsToRecords}.
   *
   * @returns bound add tags to records function
   */
  get addTagsToRecords() {
    return zohoRecruitAddTagsToRecords(this.recruitContext);
  }

  /**
   * Configured pass-through for {@link zohoRecruitRemoveTagsFromRecords}.
   *
   * @returns bound remove tags from records function
   */
  get removeTagsFromRecords() {
    return zohoRecruitRemoveTagsFromRecords(this.recruitContext);
  }
}
