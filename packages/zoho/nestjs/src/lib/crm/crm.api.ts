import { Inject, Injectable } from '@nestjs/common';
import {
  ZohoCrm,
  ZohoCrmContext,
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
  /** Inserts a new record into a CRM module. */
  get insertRecord() {
    return zohoCrmInsertRecord(this.crmContext);
  }

  /** Inserts or updates a record based on a duplicate-check field. */
  get upsertRecord() {
    return zohoCrmUpsertRecord(this.crmContext);
  }

  /** Updates an existing record in a CRM module. */
  get updateRecord() {
    return zohoCrmUpdateRecord(this.crmContext);
  }

  /** Deletes a record from a CRM module. */
  get deleteRecord() {
    return zohoCrmDeleteRecord(this.crmContext);
  }

  /** Retrieves a single record by its ID. */
  get getRecordById() {
    return zohoCrmGetRecordById(this.crmContext);
  }

  /** Retrieves a list of records from a CRM module. */
  get getRecords() {
    return zohoCrmGetRecords(this.crmContext);
  }

  /** Searches records in a CRM module using criteria. */
  get searchRecords() {
    return zohoCrmSearchRecords(this.crmContext);
  }

  /** Creates a paginated search factory for iterating over search results. */
  get searchRecordsPageFactory() {
    return zohoCrmSearchRecordsPageFactory(this.crmContext);
  }

  /** Creates a factory for fetching related records of a parent record. */
  get getRelatedRecordsFunctionFactory() {
    return zohoCrmGetRelatedRecordsFunctionFactory(this.crmContext);
  }

  /** Retrieves emails associated with a specific record. */
  get getEmailsForRecord() {
    return zohoCrmGetEmailsForRecord(this.crmContext);
  }

  /** Creates a paginated factory for iterating over emails of a record. */
  get getEmailsForRecordPageFactory() {
    return zohoCrmGetEmailsForRecordPageFactory(this.crmContext);
  }

  /** Retrieves attachments associated with a specific record. */
  get getAttachmentsForRecord() {
    return zohoCrmGetAttachmentsForRecord(this.crmContext);
  }

  /** Creates a paginated factory for iterating over attachments of a record. */
  get getAttachmentsForRecordPageFactory() {
    return zohoCrmGetAttachmentsForRecordPageFactory(this.crmContext);
  }

  /** Uploads an attachment to a specific record. */
  get uploadAttachmentForRecord() {
    return zohoCrmUploadAttachmentForRecord(this.crmContext);
  }

  /** Downloads an attachment from a specific record. */
  get downloadAttachmentForRecord() {
    return zohoCrmDownloadAttachmentForRecord(this.crmContext);
  }

  /** Deletes an attachment from a specific record. */
  get deleteAttachmentFromRecord() {
    return zohoCrmDeleteAttachmentFromRecord(this.crmContext);
  }

  /** Creates notes in the CRM. */
  get createNotes() {
    return zohoCrmCreateNotes(this.crmContext);
  }

  /** Deletes notes from the CRM. */
  get deleteNotes() {
    return zohoCrmDeleteNotes(this.crmContext);
  }

  /** Creates notes attached to a specific record. */
  get createNotesForRecord() {
    return zohoCrmCreateNotesForRecord(this.crmContext);
  }

  /** Retrieves notes attached to a specific record. */
  get getNotesForRecord() {
    return zohoCrmGetNotesForRecord(this.crmContext);
  }

  /** Creates a paginated factory for iterating over notes of a record. */
  get getNotesForRecordPageFactory() {
    return zohoCrmGetNotesForRecordPageFactory(this.crmContext);
  }

  /** Executes a custom REST API function in the CRM. */
  get executeRestApiFunction() {
    return zohoCrmExecuteRestApiFunction(this.crmContext);
  }

  /** Creates tags within a CRM module. */
  get createTagsForModule() {
    return zohoCrmCreateTagsForModule(this.crmContext);
  }

  /** Deletes a tag from the CRM. */
  get deleteTag() {
    return zohoCrmDeleteTag(this.crmContext);
  }

  /** Retrieves all tags defined for a CRM module. */
  get getTagsForModule() {
    return zohoCrmGetTagsForModule(this.crmContext);
  }

  /** Adds tags to one or more records. */
  get addTagsToRecords() {
    return zohoCrmAddTagsToRecords(this.crmContext);
  }

  /** Removes tags from one or more records. */
  get removeTagsFromRecords() {
    return zohoCrmRemoveTagsFromRecords(this.crmContext);
  }
}
