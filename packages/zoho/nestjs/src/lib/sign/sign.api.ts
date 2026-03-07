import { Inject, Injectable } from '@nestjs/common';
import { ZohoSign, ZohoSignContext, zohoSignGetDocument, zohoSignGetDocuments, zohoSignGetDocumentsPageFactory, zohoSignGetDocumentFormData, zohoSignRetrieveFieldTypes, zohoSignDownloadPdf, zohoSignDownloadCompletionCertificate, zohoSignCreateDocument, zohoSignUpdateDocument, zohoSignSendDocumentForSignature, zohoSignExtendDocument, zohoSignDeleteDocument, zohoSignFactory } from '@dereekb/zoho';
import { ZohoSignServiceConfig } from './sign.config';
import { ZohoAccountsApi } from '../accounts/accounts.api';

/**
 * NestJS injectable service that wraps the Zoho Sign API.
 *
 * Provides convenient accessor getters for all Sign operations, each bound
 * to the authenticated Sign context created during construction.
 */
@Injectable()
export class ZohoSignApi {
  /**
   * Underlying Zoho Sign client instance, initialized from the injected config and accounts context.
   */
  readonly zohoSign: ZohoSign;

  /**
   * The authenticated Sign context used by all operation accessors.
   */
  get signContext(): ZohoSignContext {
    return this.zohoSign.signContext;
  }

  /**
   * Rate limiter shared across all Sign requests to respect Zoho API quotas.
   */
  get zohoRateLimiter() {
    return this.zohoSign.signContext.zohoRateLimiter;
  }

  /**
   * Initializes the Sign client by combining the service config with the
   * accounts context for OAuth token management.
   */
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
  /** Configured pass-through for {@link zohoSignGetDocument}. */
  get getDocument() {
    return zohoSignGetDocument(this.signContext);
  }

  /** Configured pass-through for {@link zohoSignGetDocuments}. */
  get getDocuments() {
    return zohoSignGetDocuments(this.signContext);
  }

  /** Configured pass-through for {@link zohoSignGetDocumentsPageFactory}. */
  get getDocumentsPageFactory() {
    return zohoSignGetDocumentsPageFactory(this.signContext);
  }

  /** Configured pass-through for {@link zohoSignGetDocumentFormData}. */
  get getDocumentFormData() {
    return zohoSignGetDocumentFormData(this.signContext);
  }

  /** Configured pass-through for {@link zohoSignRetrieveFieldTypes}. */
  get retrieveFieldTypes() {
    return zohoSignRetrieveFieldTypes(this.signContext);
  }

  /** Configured pass-through for {@link zohoSignDownloadPdf}. */
  get downloadPdf() {
    return zohoSignDownloadPdf(this.signContext);
  }

  /** Configured pass-through for {@link zohoSignDownloadCompletionCertificate}. */
  get downloadCompletionCertificate() {
    return zohoSignDownloadCompletionCertificate(this.signContext);
  }

  /** Configured pass-through for {@link zohoSignCreateDocument}. */
  get createDocument() {
    return zohoSignCreateDocument(this.signContext);
  }

  /** Configured pass-through for {@link zohoSignUpdateDocument}. */
  get updateDocument() {
    return zohoSignUpdateDocument(this.signContext);
  }

  /** Configured pass-through for {@link zohoSignSendDocumentForSignature}. */
  get sendDocumentForSignature() {
    return zohoSignSendDocumentForSignature(this.signContext);
  }

  /** Configured pass-through for {@link zohoSignExtendDocument}. */
  get extendDocument() {
    return zohoSignExtendDocument(this.signContext);
  }

  /** Configured pass-through for {@link zohoSignDeleteDocument}. */
  get deleteDocument() {
    return zohoSignDeleteDocument(this.signContext);
  }
}
