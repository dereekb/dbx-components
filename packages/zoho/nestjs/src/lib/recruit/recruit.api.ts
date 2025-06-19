import { Inject, Injectable } from '@nestjs/common';
import {
  ZohoRecruit,
  ZohoRecruitContext,
  associateCandidateRecordsWithJobOpenings,
  createNotes,
  createNotesForRecord,
  deleteNotes,
  deleteRecord,
  executeRestApiFunction,
  getNotesForRecord,
  getNotesForRecordPageFactory,
  getRecordById,
  getRecords,
  insertRecord,
  searchCandidateAssociatedJobOpeningRecords,
  searchCandidateAssociatedJobOpeningRecordsPageFactory,
  searchJobOpeningAssociatedCandidateRecords,
  searchJobOpeningAssociatedCandidateRecordsPageFactory,
  searchRecords,
  searchRecordsPageFactory,
  updateRecord,
  upsertRecord,
  zohoRecruitFactory
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
    return insertRecord(this.recruitContext);
  }

  get upsertRecord() {
    return upsertRecord(this.recruitContext);
  }

  get updateRecord() {
    return updateRecord(this.recruitContext);
  }

  get deleteRecord() {
    return deleteRecord(this.recruitContext);
  }

  get getRecordById() {
    return getRecordById(this.recruitContext);
  }

  get getRecords() {
    return getRecords(this.recruitContext);
  }

  get searchRecords() {
    return searchRecords(this.recruitContext);
  }

  get searchRecordsPageFactory() {
    return searchRecordsPageFactory(this.recruitContext);
  }

  get createNotes() {
    return createNotes(this.recruitContext);
  }

  get deleteNotes() {
    return deleteNotes(this.recruitContext);
  }

  get createNotesForRecord() {
    return createNotesForRecord(this.recruitContext);
  }

  get getNotesForRecord() {
    return getNotesForRecord(this.recruitContext);
  }

  get getNotesForRecordPageFactory() {
    return getNotesForRecordPageFactory(this.recruitContext);
  }

  get executeRestApiFunction() {
    return executeRestApiFunction(this.recruitContext);
  }

  get associateCandidateRecordsWithJobOpenings() {
    return associateCandidateRecordsWithJobOpenings(this.recruitContext);
  }

  get searchCandidateAssociatedJobOpeningRecords() {
    return searchCandidateAssociatedJobOpeningRecords(this.recruitContext);
  }

  get searchCandidateAssociatedJobOpeningRecordsPageFactory() {
    return searchCandidateAssociatedJobOpeningRecordsPageFactory(this.recruitContext);
  }

  get searchJobOpeningAssociatedCandidateRecords() {
    return searchJobOpeningAssociatedCandidateRecords(this.recruitContext);
  }

  get searchJobOpeningAssociatedCandidateRecordsPageFactory() {
    return searchJobOpeningAssociatedCandidateRecordsPageFactory(this.recruitContext);
  }
}
