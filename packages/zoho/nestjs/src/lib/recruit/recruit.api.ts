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
   */
  get recruitContext(): ZohoRecruitContext {
    return this.zohoRecruit.recruitContext;
  }

  /**
   * Rate limiter shared across all Recruit requests to respect Zoho API quotas.
   */
  get zohoRateLimiter() {
    return this.zohoRecruit.recruitContext.zohoRateLimiter;
  }

  /**
   * Initializes the Recruit client by combining the service config with the
   * accounts context for OAuth token management.
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
  /** Configured pass-through for {@link zohoRecruitInsertRecord}. */
  get insertRecord() {
    return zohoRecruitInsertRecord(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitUpsertRecord}. */
  get upsertRecord() {
    return zohoRecruitUpsertRecord(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitUpdateRecord}. */
  get updateRecord() {
    return zohoRecruitUpdateRecord(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitDeleteRecord}. */
  get deleteRecord() {
    return zohoRecruitDeleteRecord(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitGetRecordById}. */
  get getRecordById() {
    return zohoRecruitGetRecordById(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitGetRecords}. */
  get getRecords() {
    return zohoRecruitGetRecords(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitSearchRecords}. */
  get searchRecords() {
    return zohoRecruitSearchRecords(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitSearchRecordsPageFactory}. */
  get searchRecordsPageFactory() {
    return zohoRecruitSearchRecordsPageFactory(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitGetRelatedRecordsFunctionFactory}. */
  get getRelatedRecordsFunctionFactory() {
    return zohoRecruitGetRelatedRecordsFunctionFactory(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitGetEmailsForRecord}. */
  get getEmailsForRecord() {
    return zohoRecruitGetEmailsForRecord(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitGetEmailsForRecordPageFactory}. */
  get getEmailsForRecordPageFactory() {
    return zohoRecruitGetEmailsForRecordPageFactory(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitGetAttachmentsForRecord}. */
  get getAttachmentsForRecord() {
    return zohoRecruitGetAttachmentsForRecord(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitGetAttachmentsForRecordPageFactory}. */
  get getAttachmentsForRecordPageFactory() {
    return zohoRecruitGetAttachmentsForRecordPageFactory(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitUploadAttachmentForRecord}. */
  get uploadAttachmentForRecord() {
    return zohoRecruitUploadAttachmentForRecord(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitDownloadAttachmentForRecord}. */
  get downloadAttachmentForRecord() {
    return zohoRecruitDownloadAttachmentForRecord(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitDeleteAttachmentFromRecord}. */
  get deleteAttachmentFromRecord() {
    return zohoRecruitDeleteAttachmentFromRecord(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitCreateNotes}. */
  get createNotes() {
    return zohoRecruitCreateNotes(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitDeleteNotes}. */
  get deleteNotes() {
    return zohoRecruitDeleteNotes(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitCreateNotesForRecord}. */
  get createNotesForRecord() {
    return zohoRecruitCreateNotesForRecord(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitGetNotesForRecord}. */
  get getNotesForRecord() {
    return zohoRecruitGetNotesForRecord(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitGetNotesForRecordPageFactory}. */
  get getNotesForRecordPageFactory() {
    return zohoRecruitGetNotesForRecordPageFactory(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitExecuteRestApiFunction}. */
  get executeRestApiFunction() {
    return zohoRecruitExecuteRestApiFunction(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitAssociateCandidateRecordsWithJobOpenings}. */
  get associateCandidateRecordsWithJobOpenings() {
    return zohoRecruitAssociateCandidateRecordsWithJobOpenings(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitSearchCandidateAssociatedJobOpeningRecords}. */
  get searchCandidateAssociatedJobOpeningRecords() {
    return zohoRecruitSearchCandidateAssociatedJobOpeningRecords(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitSearchCandidateAssociatedJobOpeningRecordsPageFactory}. */
  get searchCandidateAssociatedJobOpeningRecordsPageFactory() {
    return zohoRecruitSearchCandidateAssociatedJobOpeningRecordsPageFactory(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitSearchJobOpeningAssociatedCandidateRecords}. */
  get searchJobOpeningAssociatedCandidateRecords() {
    return zohoRecruitSearchJobOpeningAssociatedCandidateRecords(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitSearchJobOpeningAssociatedCandidateRecordsPageFactory}. */
  get searchJobOpeningAssociatedCandidateRecordsPageFactory() {
    return zohoRecruitSearchJobOpeningAssociatedCandidateRecordsPageFactory(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitCreateTagsForModule}. */
  get createTagsForModule() {
    return zohoRecruitCreateTagsForModule(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitGetTagsForModule}. */
  get getTagsForModule() {
    return zohoRecruitGetTagsForModule(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitAddTagsToRecords}. */
  get addTagsToRecords() {
    return zohoRecruitAddTagsToRecords(this.recruitContext);
  }

  /** Configured pass-through for {@link zohoRecruitRemoveTagsFromRecords}. */
  get removeTagsFromRecords() {
    return zohoRecruitRemoveTagsFromRecords(this.recruitContext);
  }
}
