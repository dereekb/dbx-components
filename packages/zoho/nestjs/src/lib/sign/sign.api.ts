import { Inject, Injectable } from '@nestjs/common';
import { ZohoSign, ZohoSignContext, zohoSignGetDocument, zohoSignGetDocuments, zohoSignGetDocumentsPageFactory, zohoSignGetDocumentFormData, zohoSignRetrieveFieldTypes, zohoSignDownloadPdf, zohoSignDownloadCompletionCertificate, zohoSignCreateDocument, zohoSignUpdateDocument, zohoSignSendDocumentForSignature, zohoSignExtendDocument, zohoSignFactory } from '@dereekb/zoho';
import { ZohoSignServiceConfig } from './sign.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';

@Injectable()
export class ZohoSignApi {
  readonly zohoSign: ZohoSign;

  get signContext(): ZohoSignContext {
    return this.zohoSign.signContext;
  }

  get zohoRateLimiter() {
    return this.zohoSign.signContext.zohoRateLimiter;
  }

  constructor(
    @Inject(ZohoSignServiceConfig) readonly config: ZohoSignServiceConfig,
    @Inject(ZohoAccountsApi) readonly zohoAccountsApi: ZohoAccountsApi
  ) {
    this.zohoSign = zohoSignFactory({
      ...config.factoryConfig,
      accountsContext: zohoAccountsApi.accountsContext
    })(config.zohoSign);
  }

  // MARK: Accessors
  get getDocument() {
    return zohoSignGetDocument(this.signContext);
  }

  get getDocuments() {
    return zohoSignGetDocuments(this.signContext);
  }

  get getDocumentsPageFactory() {
    return zohoSignGetDocumentsPageFactory(this.signContext);
  }

  get getDocumentFormData() {
    return zohoSignGetDocumentFormData(this.signContext);
  }

  get retrieveFieldTypes() {
    return zohoSignRetrieveFieldTypes(this.signContext);
  }

  get downloadPdf() {
    return zohoSignDownloadPdf(this.signContext);
  }

  get downloadCompletionCertificate() {
    return zohoSignDownloadCompletionCertificate(this.signContext);
  }

  get createDocument() {
    return zohoSignCreateDocument(this.signContext);
  }

  get updateDocument() {
    return zohoSignUpdateDocument(this.signContext);
  }

  get sendDocumentForSignature() {
    return zohoSignSendDocumentForSignature(this.signContext);
  }

  get extendDocument() {
    return zohoSignExtendDocument(this.signContext);
  }
}
