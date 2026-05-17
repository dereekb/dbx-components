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
   * @returns The Sign context from the underlying client.
   */
  get signContext(): ZohoSignContext {
    return this.zohoSign.signContext;
  }

  /**
   * Rate limiter shared across all Sign requests to respect Zoho API quotas.
   *
   * @returns The shared rate limiter instance.
   */
  get zohoRateLimiter() {
    return this.zohoSign.signContext.zohoRateLimiter;
  }

  /**
   * Initializes the Sign client by combining the service config with the
   * accounts context for OAuth token management.
   *
   * @param config - Zoho Sign service configuration.
   * @param zohoAccountsApi - Accounts API used for OAuth token management.
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
   * @returns Bound get document function.
   */
  get getDocument() {
    return zohoSignGetDocument(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignGetDocuments}.
   *
   * @returns Bound get documents function.
   */
  get getDocuments() {
    return zohoSignGetDocuments(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignGetDocumentsPageFactory}.
   *
   * @returns Bound get documents page factory function.
   */
  get getDocumentsPageFactory() {
    return zohoSignGetDocumentsPageFactory(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignGetDocumentFormData}.
   *
   * @returns Bound get document form data function.
   */
  get getDocumentFormData() {
    return zohoSignGetDocumentFormData(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignRetrieveFieldTypes}.
   *
   * @returns Bound retrieve field types function.
   */
  get retrieveFieldTypes() {
    return zohoSignRetrieveFieldTypes(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignDownloadPdf}.
   *
   * @returns Bound download PDF function.
   */
  get downloadPdf() {
    return zohoSignDownloadPdf(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignDownloadCompletionCertificate}.
   *
   * @returns Bound download completion certificate function.
   */
  get downloadCompletionCertificate() {
    return zohoSignDownloadCompletionCertificate(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignCreateDocument}.
   *
   * @returns Bound create document function.
   */
  get createDocument() {
    return zohoSignCreateDocument(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignUpdateDocument}.
   *
   * @returns Bound update document function.
   */
  get updateDocument() {
    return zohoSignUpdateDocument(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignSendDocumentForSignature}.
   *
   * @returns Bound send document for signature function.
   */
  get sendDocumentForSignature() {
    return zohoSignSendDocumentForSignature(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignExtendDocument}.
   *
   * @returns Bound extend document function.
   */
  get extendDocument() {
    return zohoSignExtendDocument(this.signContext);
  }

  /**
   * Configured pass-through for {@link zohoSignDeleteDocument}.
   *
   * @returns Bound delete document function.
   */
  get deleteDocument() {
    return zohoSignDeleteDocument(this.signContext);
  }
}
