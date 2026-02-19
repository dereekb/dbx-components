import { Inject, Injectable } from '@nestjs/common';
import {
  ZohoCrm,
  ZohoCrmContext,
  createNotes,
  createNotesForRecord,
  deleteNotes,
  deleteRecord,
  executeRestApiFunction,
  getNotesForRecord,
  getNotesForRecordPageFactory,
  getRecordById,
  getRecords,
  getRelatedRecordsFunctionFactory,
  insertRecord,
  searchRecords,
  searchRecordsPageFactory,
  updateRecord,
  upsertRecord,
  zohoCrmFactory,
  createTagsForModule,
  getTagsForModule,
  addTagsToRecords,
  getEmailsForRecord,
  getEmailsForRecordPageFactory,
  getAttachmentsForRecordPageFactory,
  getAttachmentsForRecord,
  downloadAttachmentForRecord,
  uploadAttachmentForRecord,
  deleteAttachmentFromRecord,
  removeTagsFromRecords
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
    return insertRecord(this.crmContext);
  }

  get upsertRecord() {
    return upsertRecord(this.crmContext);
  }

  get updateRecord() {
    return updateRecord(this.crmContext);
  }

  get deleteRecord() {
    return deleteRecord(this.crmContext);
  }

  get getRecordById() {
    return getRecordById(this.crmContext);
  }

  get getRecords() {
    return getRecords(this.crmContext);
  }

  get searchRecords() {
    return searchRecords(this.crmContext);
  }

  get searchRecordsPageFactory() {
    return searchRecordsPageFactory(this.crmContext);
  }

  get getRelatedRecordsFunctionFactory() {
    return getRelatedRecordsFunctionFactory(this.crmContext);
  }

  get getEmailsForRecord() {
    return getEmailsForRecord(this.crmContext);
  }

  get getEmailsForRecordPageFactory() {
    return getEmailsForRecordPageFactory(this.crmContext);
  }

  get getAttachmentsForRecord() {
    return getAttachmentsForRecord(this.crmContext);
  }

  get getAttachmentsForRecordPageFactory() {
    return getAttachmentsForRecordPageFactory(this.crmContext);
  }

  get uploadAttachmentForRecord() {
    return uploadAttachmentForRecord(this.crmContext);
  }

  get downloadAttachmentForRecord() {
    return downloadAttachmentForRecord(this.crmContext);
  }

  get deleteAttachmentFromRecord() {
    return deleteAttachmentFromRecord(this.crmContext);
  }

  get createNotes() {
    return createNotes(this.crmContext);
  }

  get deleteNotes() {
    return deleteNotes(this.crmContext);
  }

  get createNotesForRecord() {
    return createNotesForRecord(this.crmContext);
  }

  get getNotesForRecord() {
    return getNotesForRecord(this.crmContext);
  }

  get getNotesForRecordPageFactory() {
    return getNotesForRecordPageFactory(this.crmContext);
  }

  get executeRestApiFunction() {
    return executeRestApiFunction(this.crmContext);
  }

  get createTagsForModule() {
    return createTagsForModule(this.crmContext);
  }

  get getTagsForModule() {
    return getTagsForModule(this.crmContext);
  }

  get addTagsToRecords() {
    return addTagsToRecords(this.crmContext);
  }

  get removeTagsFromRecords() {
    return removeTagsFromRecords(this.crmContext);
  }
}
