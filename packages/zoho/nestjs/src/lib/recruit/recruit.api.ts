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

@Injectable()
export class ZohoRecruitApi {
  readonly zohoRecruit: ZohoRecruit;

  get recruitContext(): ZohoRecruitContext {
    return this.zohoRecruit.recruitContext;
  }

  get zohoRateLimiter() {
    return this.zohoRecruit.recruitContext.zohoRateLimiter;
  }

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
  get insertRecord() {
    return zohoRecruitInsertRecord(this.recruitContext);
  }

  get upsertRecord() {
    return zohoRecruitUpsertRecord(this.recruitContext);
  }

  get updateRecord() {
    return zohoRecruitUpdateRecord(this.recruitContext);
  }

  get deleteRecord() {
    return zohoRecruitDeleteRecord(this.recruitContext);
  }

  get getRecordById() {
    return zohoRecruitGetRecordById(this.recruitContext);
  }

  get getRecords() {
    return zohoRecruitGetRecords(this.recruitContext);
  }

  get searchRecords() {
    return zohoRecruitSearchRecords(this.recruitContext);
  }

  get searchRecordsPageFactory() {
    return zohoRecruitSearchRecordsPageFactory(this.recruitContext);
  }

  get getRelatedRecordsFunctionFactory() {
    return zohoRecruitGetRelatedRecordsFunctionFactory(this.recruitContext);
  }

  get getEmailsForRecord() {
    return zohoRecruitGetEmailsForRecord(this.recruitContext);
  }

  get getEmailsForRecordPageFactory() {
    return zohoRecruitGetEmailsForRecordPageFactory(this.recruitContext);
  }

  get getAttachmentsForRecord() {
    return zohoRecruitGetAttachmentsForRecord(this.recruitContext);
  }

  get getAttachmentsForRecordPageFactory() {
    return zohoRecruitGetAttachmentsForRecordPageFactory(this.recruitContext);
  }

  get uploadAttachmentForRecord() {
    return zohoRecruitUploadAttachmentForRecord(this.recruitContext);
  }

  get downloadAttachmentForRecord() {
    return zohoRecruitDownloadAttachmentForRecord(this.recruitContext);
  }

  get deleteAttachmentFromRecord() {
    return zohoRecruitDeleteAttachmentFromRecord(this.recruitContext);
  }

  get createNotes() {
    return zohoRecruitCreateNotes(this.recruitContext);
  }

  get deleteNotes() {
    return zohoRecruitDeleteNotes(this.recruitContext);
  }

  get createNotesForRecord() {
    return zohoRecruitCreateNotesForRecord(this.recruitContext);
  }

  get getNotesForRecord() {
    return zohoRecruitGetNotesForRecord(this.recruitContext);
  }

  get getNotesForRecordPageFactory() {
    return zohoRecruitGetNotesForRecordPageFactory(this.recruitContext);
  }

  get executeRestApiFunction() {
    return zohoRecruitExecuteRestApiFunction(this.recruitContext);
  }

  get associateCandidateRecordsWithJobOpenings() {
    return zohoRecruitAssociateCandidateRecordsWithJobOpenings(this.recruitContext);
  }

  get searchCandidateAssociatedJobOpeningRecords() {
    return zohoRecruitSearchCandidateAssociatedJobOpeningRecords(this.recruitContext);
  }

  get searchCandidateAssociatedJobOpeningRecordsPageFactory() {
    return zohoRecruitSearchCandidateAssociatedJobOpeningRecordsPageFactory(this.recruitContext);
  }

  get searchJobOpeningAssociatedCandidateRecords() {
    return zohoRecruitSearchJobOpeningAssociatedCandidateRecords(this.recruitContext);
  }

  get searchJobOpeningAssociatedCandidateRecordsPageFactory() {
    return zohoRecruitSearchJobOpeningAssociatedCandidateRecordsPageFactory(this.recruitContext);
  }

  get createTagsForModule() {
    return zohoRecruitCreateTagsForModule(this.recruitContext);
  }

  get getTagsForModule() {
    return zohoRecruitGetTagsForModule(this.recruitContext);
  }

  get addTagsToRecords() {
    return zohoRecruitAddTagsToRecords(this.recruitContext);
  }

  get removeTagsFromRecords() {
    return zohoRecruitRemoveTagsFromRecords(this.recruitContext);
  }
}
