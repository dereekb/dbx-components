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
   *
   * @returns the CRM context from the underlying client
   */
  get crmContext(): ZohoCrmContext {
    return this.zohoCrm.crmContext;
  }

  /**
   * Rate limiter shared across all CRM requests to respect Zoho API quotas.
   *
   * @returns the shared rate limiter instance
   */
  get zohoRateLimiter() {
    return this.zohoCrm.crmContext.zohoRateLimiter;
  }

  /**
   * Initializes the CRM client by combining the service config with the
   * accounts context for OAuth token management.
   *
   * @param config - Zoho CRM service configuration
   * @param zohoAccountsApi - accounts API used for OAuth token management
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
  /**
   * Configured pass-through for {@link zohoCrmInsertRecord}.
   *
   * @returns bound insert record function
   */
  get insertRecord() {
    return zohoCrmInsertRecord(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmUpsertRecord}.
   *
   * @returns bound upsert record function
   */
  get upsertRecord() {
    return zohoCrmUpsertRecord(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmUpdateRecord}.
   *
   * @returns bound update record function
   */
  get updateRecord() {
    return zohoCrmUpdateRecord(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmDeleteRecord}.
   *
   * @returns bound delete record function
   */
  get deleteRecord() {
    return zohoCrmDeleteRecord(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmGetRecordById}.
   *
   * @returns bound get record by ID function
   */
  get getRecordById() {
    return zohoCrmGetRecordById(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmGetRecords}.
   *
   * @returns bound get records function
   */
  get getRecords() {
    return zohoCrmGetRecords(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmSearchRecords}.
   *
   * @returns bound search records function
   */
  get searchRecords() {
    return zohoCrmSearchRecords(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmSearchRecordsPageFactory}.
   *
   * @returns bound search records page factory function
   */
  get searchRecordsPageFactory() {
    return zohoCrmSearchRecordsPageFactory(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmGetRelatedRecordsFunctionFactory}.
   *
   * @returns bound get related records factory function
   */
  get getRelatedRecordsFunctionFactory() {
    return zohoCrmGetRelatedRecordsFunctionFactory(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmGetEmailsForRecord}.
   *
   * @returns bound get emails for record function
   */
  get getEmailsForRecord() {
    return zohoCrmGetEmailsForRecord(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmGetEmailsForRecordPageFactory}.
   *
   * @returns bound get emails page factory function
   */
  get getEmailsForRecordPageFactory() {
    return zohoCrmGetEmailsForRecordPageFactory(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmGetAttachmentsForRecord}.
   *
   * @returns bound get attachments for record function
   */
  get getAttachmentsForRecord() {
    return zohoCrmGetAttachmentsForRecord(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmGetAttachmentsForRecordPageFactory}.
   *
   * @returns bound get attachments page factory function
   */
  get getAttachmentsForRecordPageFactory() {
    return zohoCrmGetAttachmentsForRecordPageFactory(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmUploadAttachmentForRecord}.
   *
   * @returns bound upload attachment function
   */
  get uploadAttachmentForRecord() {
    return zohoCrmUploadAttachmentForRecord(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmDownloadAttachmentForRecord}.
   *
   * @returns bound download attachment function
   */
  get downloadAttachmentForRecord() {
    return zohoCrmDownloadAttachmentForRecord(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmDeleteAttachmentFromRecord}.
   *
   * @returns bound delete attachment function
   */
  get deleteAttachmentFromRecord() {
    return zohoCrmDeleteAttachmentFromRecord(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmCreateNotes}.
   *
   * @returns bound create notes function
   */
  get createNotes() {
    return zohoCrmCreateNotes(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmDeleteNotes}.
   *
   * @returns bound delete notes function
   */
  get deleteNotes() {
    return zohoCrmDeleteNotes(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmCreateNotesForRecord}.
   *
   * @returns bound create notes for record function
   */
  get createNotesForRecord() {
    return zohoCrmCreateNotesForRecord(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmGetNotesForRecord}.
   *
   * @returns bound get notes for record function
   */
  get getNotesForRecord() {
    return zohoCrmGetNotesForRecord(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmGetNotesForRecordPageFactory}.
   *
   * @returns bound get notes page factory function
   */
  get getNotesForRecordPageFactory() {
    return zohoCrmGetNotesForRecordPageFactory(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmExecuteRestApiFunction}.
   *
   * @returns bound execute REST API function
   */
  get executeRestApiFunction() {
    return zohoCrmExecuteRestApiFunction(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmCreateTagsForModule}.
   *
   * @returns bound create tags for module function
   */
  get createTagsForModule() {
    return zohoCrmCreateTagsForModule(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmDeleteTag}.
   *
   * @returns bound delete tag function
   */
  get deleteTag() {
    return zohoCrmDeleteTag(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmGetTagsForModule}.
   *
   * @returns bound get tags for module function
   */
  get getTagsForModule() {
    return zohoCrmGetTagsForModule(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmAddTagsToRecords}.
   *
   * @returns bound add tags to records function
   */
  get addTagsToRecords() {
    return zohoCrmAddTagsToRecords(this.crmContext);
  }

  /**
   * Configured pass-through for {@link zohoCrmRemoveTagsFromRecords}.
   *
   * @returns bound remove tags from records function
   */
  get removeTagsFromRecords() {
    return zohoCrmRemoveTagsFromRecords(this.crmContext);
  }
}
