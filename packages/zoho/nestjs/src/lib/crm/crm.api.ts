import { Inject, Injectable } from '@nestjs/common';
import {
  type ZohoCrm,
  type ZohoCrmContext,
  zohoCrmCreateNotes,
  zohoCrmCreateNotesForRecord,
  zohoCrmDeleteNotes,
  zohoCrmDeleteRecord,
  zohoCrmExecuteRestApiFunction,
  zohoCrmGetNotesForRecord,
  zohoCrmGetNotesForRecordPageFactory,
  zohoCrmGetRecordById,
  zohoCrmGetRecords,
  zohoCrmGetRelatedRecordsFunctionFactory,
  zohoCrmInsertRecord,
  zohoCrmSearchRecords,
  zohoCrmSearchRecordsPageFactory,
  zohoCrmUpdateRecord,
  zohoCrmUpsertRecord,
  zohoCrmFactory,
  zohoCrmCreateTagsForModule,
  zohoCrmGetTagsForModule,
  zohoCrmAddTagsToRecords,
  zohoCrmGetEmailsForRecord,
  zohoCrmGetEmailsForRecordPageFactory,
  zohoCrmGetAttachmentsForRecordPageFactory,
  zohoCrmGetAttachmentsForRecord,
  zohoCrmDownloadAttachmentForRecord,
  zohoCrmUploadAttachmentForRecord,
  zohoCrmDeleteAttachmentFromRecord,
  zohoCrmRemoveTagsFromRecords,
  zohoCrmDeleteTag
} from '@dereekb/zoho';
import { ZohoCrmServiceConfig } from './crm.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';

/**
 * NestJS injectable service that wraps the Zoho CRM API.
 *
 * Provides convenient accessor getters for all CRM operations, each bound
 * to the authenticated CRM context created during construction.
 */
@Injectable()
export class ZohoCrmApi {
  /**
   * Underlying Zoho CRM client instance, initialized from the injected config and accounts context.
   */
  readonly zohoCrm: ZohoCrm;

  /**
   * The authenticated CRM context used by all operation accessors.
   */
  get crmContext(): ZohoCrmContext {
    return this.zohoCrm.crmContext;
  }

  /**
   * Rate limiter shared across all CRM requests to respect Zoho API quotas.
   */
  get zohoRateLimiter() {
    return this.zohoCrm.crmContext.zohoRateLimiter;
  }

  /**
   * Initializes the CRM client by combining the service config with the
   * accounts context for OAuth token management.
   */
  constructor(
    @Inject(ZohoCrmServiceConfig) readonly config: ZohoCrmServiceConfig,
    @Inject(ZohoAccountsApi) readonly zohoAccountsApi: ZohoAccountsApi
  ) {
    this.zohoCrm = zohoCrmFactory({
      ...config.factoryConfig,
      accountsContext: zohoAccountsApi.accountsContext
    })(config.zohoCrm);
  }

  // MARK: Accessors
  /** Configured pass-through for {@link zohoCrmInsertRecord}. */
  get insertRecord() {
    return zohoCrmInsertRecord(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmUpsertRecord}. */
  get upsertRecord() {
    return zohoCrmUpsertRecord(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmUpdateRecord}. */
  get updateRecord() {
    return zohoCrmUpdateRecord(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmDeleteRecord}. */
  get deleteRecord() {
    return zohoCrmDeleteRecord(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmGetRecordById}. */
  get getRecordById() {
    return zohoCrmGetRecordById(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmGetRecords}. */
  get getRecords() {
    return zohoCrmGetRecords(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmSearchRecords}. */
  get searchRecords() {
    return zohoCrmSearchRecords(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmSearchRecordsPageFactory}. */
  get searchRecordsPageFactory() {
    return zohoCrmSearchRecordsPageFactory(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmGetRelatedRecordsFunctionFactory}. */
  get getRelatedRecordsFunctionFactory() {
    return zohoCrmGetRelatedRecordsFunctionFactory(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmGetEmailsForRecord}. */
  get getEmailsForRecord() {
    return zohoCrmGetEmailsForRecord(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmGetEmailsForRecordPageFactory}. */
  get getEmailsForRecordPageFactory() {
    return zohoCrmGetEmailsForRecordPageFactory(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmGetAttachmentsForRecord}. */
  get getAttachmentsForRecord() {
    return zohoCrmGetAttachmentsForRecord(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmGetAttachmentsForRecordPageFactory}. */
  get getAttachmentsForRecordPageFactory() {
    return zohoCrmGetAttachmentsForRecordPageFactory(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmUploadAttachmentForRecord}. */
  get uploadAttachmentForRecord() {
    return zohoCrmUploadAttachmentForRecord(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmDownloadAttachmentForRecord}. */
  get downloadAttachmentForRecord() {
    return zohoCrmDownloadAttachmentForRecord(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmDeleteAttachmentFromRecord}. */
  get deleteAttachmentFromRecord() {
    return zohoCrmDeleteAttachmentFromRecord(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmCreateNotes}. */
  get createNotes() {
    return zohoCrmCreateNotes(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmDeleteNotes}. */
  get deleteNotes() {
    return zohoCrmDeleteNotes(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmCreateNotesForRecord}. */
  get createNotesForRecord() {
    return zohoCrmCreateNotesForRecord(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmGetNotesForRecord}. */
  get getNotesForRecord() {
    return zohoCrmGetNotesForRecord(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmGetNotesForRecordPageFactory}. */
  get getNotesForRecordPageFactory() {
    return zohoCrmGetNotesForRecordPageFactory(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmExecuteRestApiFunction}. */
  get executeRestApiFunction() {
    return zohoCrmExecuteRestApiFunction(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmCreateTagsForModule}. */
  get createTagsForModule() {
    return zohoCrmCreateTagsForModule(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmDeleteTag}. */
  get deleteTag() {
    return zohoCrmDeleteTag(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmGetTagsForModule}. */
  get getTagsForModule() {
    return zohoCrmGetTagsForModule(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmAddTagsToRecords}. */
  get addTagsToRecords() {
    return zohoCrmAddTagsToRecords(this.crmContext);
  }

  /** Configured pass-through for {@link zohoCrmRemoveTagsFromRecords}. */
  get removeTagsFromRecords() {
    return zohoCrmRemoveTagsFromRecords(this.crmContext);
  }
}
