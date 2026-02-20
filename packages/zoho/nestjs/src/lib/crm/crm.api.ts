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
  zohoCrmRemoveTagsFromRecords
} from '@dereekb/zoho';
import { ZohoCrmServiceConfig } from './crm.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';

@Injectable()
export class ZohoCrmApi {
  readonly zohoCrm: ZohoCrm;

  get crmContext(): ZohoCrmContext {
    return this.zohoCrm.crmContext;
  }

  get zohoRateLimiter() {
    return this.zohoCrm.crmContext.zohoRateLimiter;
  }

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
  get insertRecord() {
    return zohoCrmInsertRecord(this.crmContext);
  }

  get upsertRecord() {
    return zohoCrmUpsertRecord(this.crmContext);
  }

  get updateRecord() {
    return zohoCrmUpdateRecord(this.crmContext);
  }

  get deleteRecord() {
    return zohoCrmDeleteRecord(this.crmContext);
  }

  get getRecordById() {
    return zohoCrmGetRecordById(this.crmContext);
  }

  get getRecords() {
    return zohoCrmGetRecords(this.crmContext);
  }

  get searchRecords() {
    return zohoCrmSearchRecords(this.crmContext);
  }

  get searchRecordsPageFactory() {
    return zohoCrmSearchRecordsPageFactory(this.crmContext);
  }

  get getRelatedRecordsFunctionFactory() {
    return zohoCrmGetRelatedRecordsFunctionFactory(this.crmContext);
  }

  get getEmailsForRecord() {
    return zohoCrmGetEmailsForRecord(this.crmContext);
  }

  get getEmailsForRecordPageFactory() {
    return zohoCrmGetEmailsForRecordPageFactory(this.crmContext);
  }

  get getAttachmentsForRecord() {
    return zohoCrmGetAttachmentsForRecord(this.crmContext);
  }

  get getAttachmentsForRecordPageFactory() {
    return zohoCrmGetAttachmentsForRecordPageFactory(this.crmContext);
  }

  get uploadAttachmentForRecord() {
    return zohoCrmUploadAttachmentForRecord(this.crmContext);
  }

  get downloadAttachmentForRecord() {
    return zohoCrmDownloadAttachmentForRecord(this.crmContext);
  }

  get deleteAttachmentFromRecord() {
    return zohoCrmDeleteAttachmentFromRecord(this.crmContext);
  }

  get createNotes() {
    return zohoCrmCreateNotes(this.crmContext);
  }

  get deleteNotes() {
    return zohoCrmDeleteNotes(this.crmContext);
  }

  get createNotesForRecord() {
    return zohoCrmCreateNotesForRecord(this.crmContext);
  }

  get getNotesForRecord() {
    return zohoCrmGetNotesForRecord(this.crmContext);
  }

  get getNotesForRecordPageFactory() {
    return zohoCrmGetNotesForRecordPageFactory(this.crmContext);
  }

  get executeRestApiFunction() {
    return zohoCrmExecuteRestApiFunction(this.crmContext);
  }

  get createTagsForModule() {
    return zohoCrmCreateTagsForModule(this.crmContext);
  }

  get getTagsForModule() {
    return zohoCrmGetTagsForModule(this.crmContext);
  }

  get addTagsToRecords() {
    return zohoCrmAddTagsToRecords(this.crmContext);
  }

  get removeTagsFromRecords() {
    return zohoCrmRemoveTagsFromRecords(this.crmContext);
  }
}
