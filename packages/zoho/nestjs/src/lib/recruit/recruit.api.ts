import { Inject, Injectable } from '@nestjs/common';
import {
  ZohoRecruit,
  ZohoRecruitContext,
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
  /** Inserts a new record into a Recruit module. */
  get insertRecord() {
    return zohoRecruitInsertRecord(this.recruitContext);
  }

  /** Inserts or updates a record based on a duplicate-check field. */
  get upsertRecord() {
    return zohoRecruitUpsertRecord(this.recruitContext);
  }

  /** Updates an existing record in a Recruit module. */
  get updateRecord() {
    return zohoRecruitUpdateRecord(this.recruitContext);
  }

  /** Deletes a record from a Recruit module. */
  get deleteRecord() {
    return zohoRecruitDeleteRecord(this.recruitContext);
  }

  /** Retrieves a single record by its ID. */
  get getRecordById() {
    return zohoRecruitGetRecordById(this.recruitContext);
  }

  /** Retrieves a list of records from a Recruit module. */
  get getRecords() {
    return zohoRecruitGetRecords(this.recruitContext);
  }

  /** Searches records in a Recruit module using criteria. */
  get searchRecords() {
    return zohoRecruitSearchRecords(this.recruitContext);
  }

  /** Creates a paginated search factory for iterating over search results. */
  get searchRecordsPageFactory() {
    return zohoRecruitSearchRecordsPageFactory(this.recruitContext);
  }

  /** Creates a factory for fetching related records of a parent record. */
  get getRelatedRecordsFunctionFactory() {
    return zohoRecruitGetRelatedRecordsFunctionFactory(this.recruitContext);
  }

  /** Retrieves emails associated with a specific record. */
  get getEmailsForRecord() {
    return zohoRecruitGetEmailsForRecord(this.recruitContext);
  }

  /** Creates a paginated factory for iterating over emails of a record. */
  get getEmailsForRecordPageFactory() {
    return zohoRecruitGetEmailsForRecordPageFactory(this.recruitContext);
  }

  /** Retrieves attachments associated with a specific record. */
  get getAttachmentsForRecord() {
    return zohoRecruitGetAttachmentsForRecord(this.recruitContext);
  }

  /** Creates a paginated factory for iterating over attachments of a record. */
  get getAttachmentsForRecordPageFactory() {
    return zohoRecruitGetAttachmentsForRecordPageFactory(this.recruitContext);
  }

  /** Uploads an attachment to a specific record. */
  get uploadAttachmentForRecord() {
    return zohoRecruitUploadAttachmentForRecord(this.recruitContext);
  }

  /** Downloads an attachment from a specific record. */
  get downloadAttachmentForRecord() {
    return zohoRecruitDownloadAttachmentForRecord(this.recruitContext);
  }

  /** Deletes an attachment from a specific record. */
  get deleteAttachmentFromRecord() {
    return zohoRecruitDeleteAttachmentFromRecord(this.recruitContext);
  }

  /** Creates notes in Recruit. */
  get createNotes() {
    return zohoRecruitCreateNotes(this.recruitContext);
  }

  /** Deletes notes from Recruit. */
  get deleteNotes() {
    return zohoRecruitDeleteNotes(this.recruitContext);
  }

  /** Creates notes attached to a specific record. */
  get createNotesForRecord() {
    return zohoRecruitCreateNotesForRecord(this.recruitContext);
  }

  /** Retrieves notes attached to a specific record. */
  get getNotesForRecord() {
    return zohoRecruitGetNotesForRecord(this.recruitContext);
  }

  /** Creates a paginated factory for iterating over notes of a record. */
  get getNotesForRecordPageFactory() {
    return zohoRecruitGetNotesForRecordPageFactory(this.recruitContext);
  }

  /** Executes a custom REST API function in Recruit. */
  get executeRestApiFunction() {
    return zohoRecruitExecuteRestApiFunction(this.recruitContext);
  }

  /** Associates candidate records with one or more job openings. */
  get associateCandidateRecordsWithJobOpenings() {
    return zohoRecruitAssociateCandidateRecordsWithJobOpenings(this.recruitContext);
  }

  /** Searches job openings associated with a candidate. */
  get searchCandidateAssociatedJobOpeningRecords() {
    return zohoRecruitSearchCandidateAssociatedJobOpeningRecords(this.recruitContext);
  }

  /** Creates a paginated factory for iterating over job openings associated with a candidate. */
  get searchCandidateAssociatedJobOpeningRecordsPageFactory() {
    return zohoRecruitSearchCandidateAssociatedJobOpeningRecordsPageFactory(this.recruitContext);
  }

  /** Searches candidates associated with a job opening. */
  get searchJobOpeningAssociatedCandidateRecords() {
    return zohoRecruitSearchJobOpeningAssociatedCandidateRecords(this.recruitContext);
  }

  /** Creates a paginated factory for iterating over candidates associated with a job opening. */
  get searchJobOpeningAssociatedCandidateRecordsPageFactory() {
    return zohoRecruitSearchJobOpeningAssociatedCandidateRecordsPageFactory(this.recruitContext);
  }

  /** Creates tags within a Recruit module. */
  get createTagsForModule() {
    return zohoRecruitCreateTagsForModule(this.recruitContext);
  }

  /** Retrieves all tags defined for a Recruit module. */
  get getTagsForModule() {
    return zohoRecruitGetTagsForModule(this.recruitContext);
  }

  /** Adds tags to one or more records. */
  get addTagsToRecords() {
    return zohoRecruitAddTagsToRecords(this.recruitContext);
  }

  /** Removes tags from one or more records. */
  get removeTagsFromRecords() {
    return zohoRecruitRemoveTagsFromRecords(this.recruitContext);
  }
}
