import { Inject, Injectable } from '@nestjs/common';
import { type ZohoSign, type ZohoSignContext, zohoSignGetDocument, zohoSignGetDocuments, zohoSignGetDocumentsPageFactory, zohoSignGetDocumentFormData, zohoSignRetrieveFieldTypes, zohoSignDownloadPdf, zohoSignDownloadCompletionCertificate, zohoSignCreateDocument, zohoSignUpdateDocument, zohoSignSendDocumentForSignature, zohoSignExtendDocument, zohoSignDeleteDocument, zohoSignFactory } from '@dereekb/zoho';
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
   *
   * @returns the Sign context from the underlying client
   */
  get signContext(): ZohoSignContext {
    return this.zohoSign.signContext;
  }

  /**
   * Rate limiter shared across all Sign requests to respect Zoho API quotas.
   *
   * @returns the shared rate limiter instance
   */
  get zohoRateLimiter() {
    return this.zohoSign.signContext.zohoRateLimiter;
  }

  /**
   * Initializes the Sign client by combining the service config with the
   * accounts context for OAuth token management.
   *
   * @param config - Zoho Sign service configuration
   * @param zohoAccountsApi - accounts API used for OAuth token management
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
  /**
   * Configured pass-through for {@link zohoSignGetDocument}.
   *
   * @returns bound get document function
   */
  get getDocument() {
    return zohoSignGetDocument(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignGetDocuments}.
   *
   * @returns bound get documents function
   */
  get getDocuments() {
    return zohoSignGetDocuments(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignGetDocumentsPageFactory}.
   *
   * @returns bound get documents page factory function
   */
  get getDocumentsPageFactory() {
    return zohoSignGetDocumentsPageFactory(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignGetDocumentFormData}.
   *
   * @returns bound get document form data function
   */
  get getDocumentFormData() {
    return zohoSignGetDocumentFormData(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignRetrieveFieldTypes}.
   *
   * @returns bound retrieve field types function
   */
  get retrieveFieldTypes() {
    return zohoSignRetrieveFieldTypes(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignDownloadPdf}.
   *
   * @returns bound download PDF function
   */
  get downloadPdf() {
    return zohoSignDownloadPdf(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignDownloadCompletionCertificate}.
   *
   * @returns bound download completion certificate function
   */
  get downloadCompletionCertificate() {
    return zohoSignDownloadCompletionCertificate(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignCreateDocument}.
   *
   * @returns bound create document function
   */
  get createDocument() {
    return zohoSignCreateDocument(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignUpdateDocument}.
   *
   * @returns bound update document function
   */
  get updateDocument() {
    return zohoSignUpdateDocument(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignSendDocumentForSignature}.
   *
   * @returns bound send document for signature function
   */
  get sendDocumentForSignature() {
    return zohoSignSendDocumentForSignature(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignExtendDocument}.
   *
   * @returns bound extend document function
   */
  get extendDocument() {
    return zohoSignExtendDocument(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignDeleteDocument}.
   *
   * @returns bound delete document function
   */
  get deleteDocument() {
    return zohoSignDeleteDocument(this.signContext);
  }
}
