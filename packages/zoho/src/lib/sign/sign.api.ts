import { type Maybe } from '@dereekb/util';
import { type FetchJsonBody, type FetchJsonInput, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoSignContext } from './sign.config';
import { type ZohoSignRequest, type ZohoSignRequestId, type ZohoSignRequestData, type ZohoSignFieldType, type ZohoSignDocumentFormData } from './sign';
import { type ZohoSignPageFilter, type ZohoSignPageResult, type ZohoSignSearchColumns, zohoSignFetchPageFactory } from './sign.api.page';

// MARK: Utility
/**
 * Builds a {@link FetchJsonInput} for Zoho Sign API calls.
 *
 * @param method - HTTP method for the request
 * @param body - Optional JSON body to include in the request
 * @returns Configured fetch JSON input
 */
function zohoSignApiFetchJsonInput(method: string, body?: Maybe<FetchJsonBody>): FetchJsonInput {
  return {
    method,
    body: body ?? undefined
  };
}

// MARK: Response Types
/**
 * Base response shape for Zoho Sign API calls.
 */
export interface ZohoSignApiResponse {
  readonly code: number;
  readonly message: string;
  readonly status: string;
}

/**
 * Response containing a single document's details.
 */
export interface ZohoSignGetDocumentResponse extends ZohoSignApiResponse {
  readonly requests: ZohoSignRequest;
}

/**
 * Response containing a list of documents with pagination.
 */
export interface ZohoSignGetDocumentsResponse extends ZohoSignApiResponse, ZohoSignPageResult<ZohoSignRequest> {}

/**
 * Response containing field types.
 */
export interface ZohoSignRetrieveFieldTypesResponse extends ZohoSignApiResponse {
  readonly field_types: ZohoSignFieldType[];
}

/**
 * Response containing document form data.
 */
export interface ZohoSignGetDocumentFormDataResponse extends ZohoSignApiResponse {
  readonly document_form_data: ZohoSignDocumentFormData;
}

/**
 * Response for create/update/submit operations.
 */
export interface ZohoSignDocumentOperationResponse extends ZohoSignApiResponse {
  readonly requests: ZohoSignRequest;
}

// MARK: Get Document
export interface ZohoSignGetDocumentInput {
  readonly requestId: ZohoSignRequestId;
}

export type ZohoSignGetDocumentFunction = (input: ZohoSignGetDocumentInput) => Promise<ZohoSignGetDocumentResponse>;

/**
 * Creates a {@link ZohoSignGetDocumentFunction} bound to the given context.
 *
 * Fetches the full details of a single Zoho Sign request (envelope) by its ID,
 * including actions, documents, and field data.
 *
 * @param context - Authenticated Zoho Sign context providing fetch and rate limiting
 * @returns Function that retrieves a document by request ID
 *
 * @example
 * ```typescript
 * const getDocument = zohoSignGetDocument(context);
 * const response = await getDocument({ requestId: '12345' });
 * ```
 *
 * @see https://www.zoho.com/sign/api/document-managment/get-details-of-a-particular-document.html
 */
export function zohoSignGetDocument(context: ZohoSignContext): ZohoSignGetDocumentFunction {
  return ({ requestId }: ZohoSignGetDocumentInput) => context.fetchJson<ZohoSignGetDocumentResponse>(`/requests/${requestId}`, zohoSignApiFetchJsonInput('GET'));
}

// MARK: Get Documents List
export interface ZohoSignGetDocumentsInput extends ZohoSignPageFilter {
  readonly search_columns?: ZohoSignSearchColumns;
}

export type ZohoSignGetDocumentsFunction = (input: ZohoSignGetDocumentsInput) => Promise<ZohoSignGetDocumentsResponse>;

/**
 * Creates a {@link ZohoSignGetDocumentsFunction} bound to the given context.
 *
 * Fetches a paginated list of Zoho Sign requests. Supports sorting via
 * {@link ZohoSignPageFilter} and filtering via {@link ZohoSignSearchColumns}.
 * Pagination parameters (`start_index`, `row_count`) are serialized as a
 * JSON `data` query parameter per the Zoho Sign API convention.
 *
 * @param context - Authenticated Zoho Sign context providing fetch and rate limiting
 * @returns Function that retrieves a paginated list of documents
 *
 * @example
 * ```typescript
 * const getDocuments = zohoSignGetDocuments(context);
 * const response = await getDocuments({ start_index: 1, row_count: 10 });
 * ```
 *
 * @see https://www.zoho.com/sign/api/document-managment/get-document-list.html
 */
export function zohoSignGetDocuments(context: ZohoSignContext): ZohoSignGetDocumentsFunction {
  return (input: ZohoSignGetDocumentsInput) => {
    const { search_columns, ...pageFilter } = input;
    const data = {
      page_context: {
        ...pageFilter,
        ...(search_columns ? { search_columns } : {})
      }
    };

    return context.fetchJson<ZohoSignGetDocumentsResponse>(
      {
        url: `/requests`,
        queryParams: { data: JSON.stringify(data) }
      },
      zohoSignApiFetchJsonInput('GET')
    );
  };
}

/**
 * Creates a {@link zohoSignFetchPageFactory} bound to the given context.
 *
 * Returns a page factory that automatically handles Zoho Sign's
 * `start_index`/`row_count` pagination, making it easy to iterate
 * through all documents across multiple pages.
 *
 * @param context - Authenticated Zoho Sign context providing fetch and rate limiting
 * @returns Page factory for iterating through documents
 *
 * @example
 * ```typescript
 * const pageFactory = zohoSignGetDocumentsPageFactory(context);
 * const fetchPage = pageFactory({ row_count: 5 });
 *
 * const firstPage = await fetchPage.fetchNext();
 * const secondPage = await firstPage.fetchNext();
 * ```
 */
export function zohoSignGetDocumentsPageFactory(context: ZohoSignContext) {
  const getDocuments = zohoSignGetDocuments(context);
  return zohoSignFetchPageFactory(getDocuments);
}

// MARK: Get Document Form Data
export interface ZohoSignGetDocumentFormDataInput {
  readonly requestId: ZohoSignRequestId;
}

export type ZohoSignGetDocumentFormDataFunction = (input: ZohoSignGetDocumentFormDataInput) => Promise<ZohoSignGetDocumentFormDataResponse>;

/**
 * Creates a {@link ZohoSignGetDocumentFormDataFunction} bound to the given context.
 *
 * Retrieves the filled form field values for a completed document. Only
 * returns data after all recipients have signed. The response includes
 * field labels and values grouped by recipient action.
 *
 * @param context - Authenticated Zoho Sign context providing fetch and rate limiting
 * @returns Function that retrieves form data for a completed document
 *
 * @example
 * ```typescript
 * const getFormData = zohoSignGetDocumentFormData(context);
 * const response = await getFormData({ requestId: '12345' });
 * ```
 *
 * @see https://www.zoho.com/sign/api/document-managment/get-document-form-data.html
 */
export function zohoSignGetDocumentFormData(context: ZohoSignContext): ZohoSignGetDocumentFormDataFunction {
  return ({ requestId }: ZohoSignGetDocumentFormDataInput) => context.fetchJson<ZohoSignGetDocumentFormDataResponse>(`/requests/${requestId}/fielddata`, zohoSignApiFetchJsonInput('GET'));
}

// MARK: Retrieve Field Types
export type ZohoSignRetrieveFieldTypesFunction = () => Promise<ZohoSignRetrieveFieldTypesResponse>;

/**
 * Creates a {@link ZohoSignRetrieveFieldTypesFunction} bound to the given context.
 *
 * Retrieves all available field types (e.g. Signature, Textfield, Checkbox)
 * that can be placed on documents. Useful for dynamically building document
 * templates or validating field configurations.
 *
 * @param context - Authenticated Zoho Sign context providing fetch and rate limiting
 * @returns Function that retrieves all available field types
 *
 * @example
 * ```typescript
 * const retrieveFieldTypes = zohoSignRetrieveFieldTypes(context);
 * const response = await retrieveFieldTypes();
 * ```
 *
 * @see https://www.zoho.com/sign/api/document-managment/retrieve-field-type.html
 */
export function zohoSignRetrieveFieldTypes(context: ZohoSignContext): ZohoSignRetrieveFieldTypesFunction {
  return () => context.fetchJson<ZohoSignRetrieveFieldTypesResponse>(`/fieldtypes`, zohoSignApiFetchJsonInput('GET'));
}

// MARK: Download PDF
export interface ZohoSignDownloadPdfInput {
  readonly requestId: ZohoSignRequestId;
  /**
   * Download completion certificate along with document.
   */
  readonly with_coc?: boolean;
  /**
   * All signed documents will be merged along with the completion certificate.
   */
  readonly merge?: boolean;
  /**
   * Password for protected documents.
   */
  readonly password?: string;
}

export type ZohoSignDownloadPdfFunction = (input: ZohoSignDownloadPdfInput) => Promise<Response>;

/**
 * Creates a {@link ZohoSignDownloadPdfFunction} bound to the given context.
 *
 * Downloads the signed PDF document(s) for a completed request. Returns a
 * raw {@link Response} containing either a PDF (single document) or a ZIP
 * archive (multiple documents). Supports optional parameters to include the
 * completion certificate, merge all documents, or provide a password for
 * protected files.
 *
 * @param context - Authenticated Zoho Sign context providing fetch and rate limiting
 * @returns Function that downloads signed PDFs by request ID
 *
 * @example
 * ```typescript
 * const downloadPdf = zohoSignDownloadPdf(context);
 *
 * // Download signed PDF with completion certificate merged in:
 * const response = await downloadPdf({
 *   requestId: '12345',
 *   with_coc: true,
 *   merge: true
 * });
 *
 * const blob = await response.blob();
 * ```
 *
 * @see https://www.zoho.com/sign/api/document-managment/download-pdf.html
 */
export function zohoSignDownloadPdf(context: ZohoSignContext): ZohoSignDownloadPdfFunction {
  return ({ requestId, ...params }: ZohoSignDownloadPdfInput) => {
    const searchParams = makeUrlSearchParams(params);
    const queryString = searchParams.toString();
    const suffix = queryString ? `?${queryString}` : '';
    const url = `/requests/${requestId}/pdf${suffix}`;
    return context.fetch(url, { method: 'GET' });
  };
}

// MARK: Download Completion Certificate
export interface ZohoSignDownloadCompletionCertificateInput {
  readonly requestId: ZohoSignRequestId;
}

export type ZohoSignDownloadCompletionCertificateFunction = (input: ZohoSignDownloadCompletionCertificateInput) => Promise<Response>;

/**
 * Creates a {@link ZohoSignDownloadCompletionCertificateFunction} bound to the given context.
 *
 * Downloads the completion certificate PDF for a finished request. The
 * certificate contains an audit trail of the signing process including
 * timestamps and recipient details. Returns a raw {@link Response}.
 *
 * @param context - Authenticated Zoho Sign context providing fetch and rate limiting
 * @returns Function that downloads the completion certificate by request ID
 *
 * @example
 * ```typescript
 * const downloadCert = zohoSignDownloadCompletionCertificate(context);
 * const response = await downloadCert({ requestId: '12345' });
 * const blob = await response.blob();
 * ```
 *
 * @see https://www.zoho.com/sign/api/document-managment/download-completion-certificate.html
 */
export function zohoSignDownloadCompletionCertificate(context: ZohoSignContext): ZohoSignDownloadCompletionCertificateFunction {
  return ({ requestId }: ZohoSignDownloadCompletionCertificateInput) => context.fetch(`/requests/${requestId}/completioncertificate`, { method: 'GET' });
}

// MARK: Create Document
export interface ZohoSignCreateDocumentInput {
  readonly requestData: ZohoSignRequestData;
  /**
   * File to attach to the document.
   */
  readonly file: File;
}

export type ZohoSignCreateDocumentFunction = (input: ZohoSignCreateDocumentInput) => Promise<ZohoSignDocumentOperationResponse>;

/**
 * Creates a {@link ZohoSignCreateDocumentFunction} bound to the given context.
 *
 * Creates a new document draft in Zoho Sign. The request data and file are
 * sent as multipart/form-data. The `Content-Type` header is intentionally
 * cleared so that `fetch` auto-detects the correct multipart boundary from
 * the {@link FormData} body.
 *
 * The created document starts in draft status and must be submitted
 * separately via {@link zohoSignSendDocumentForSignature}.
 *
 * @param context - Authenticated Zoho Sign context providing fetch and rate limiting
 * @returns Function that creates a new document draft
 *
 * @example
 * ```typescript
 * const createDocument = zohoSignCreateDocument(context);
 *
 * const response = await createDocument({
 *   requestData: {
 *     request_name: 'NDA Agreement',
 *     is_sequential: true,
 *     actions: [
 *       {
 *         action_type: 'SIGN',
 *         recipient_name: 'Jane Doe',
 *         recipient_email: 'jane@example.com'
 *       }
 *     ]
 *   },
 *   file: new File([pdfBuffer], 'nda.pdf', { type: 'application/pdf' })
 * });
 *
 * const draftId = response.requests.request_id;
 * ```
 *
 * @see https://www.zoho.com/sign/api/document-managment/create-document.html
 */
export function zohoSignCreateDocument(context: ZohoSignContext): ZohoSignCreateDocumentFunction {
  return ({ requestData, file }: ZohoSignCreateDocumentInput) => {
    const body = new FormData();
    body.append('data', JSON.stringify({ requests: requestData }));
    body.append('file', file);

    // Clear the base Content-Type header (empty string removes it via mergeRequestHeaders) so fetch auto-detects multipart/form-data with the correct boundary from the FormData body.
    return context.fetch(`/requests`, { method: 'POST', headers: { 'Content-Type': '' }, body }).then((response) => response.json() as Promise<ZohoSignDocumentOperationResponse>);
  };
}

// MARK: Update Document
export interface ZohoSignUpdateDocumentInput {
  readonly requestId: ZohoSignRequestId;
  readonly data: Partial<ZohoSignRequestData>;
}

export type ZohoSignUpdateDocumentFunction = (input: ZohoSignUpdateDocumentInput) => Promise<ZohoSignDocumentOperationResponse>;

/**
 * Creates a {@link ZohoSignUpdateDocumentFunction} bound to the given context.
 *
 * Updates an existing document that is still in draft status. Accepts partial
 * {@link ZohoSignRequestData} to modify fields such as actions, notes, or
 * expiration settings. Cannot be used on documents that have already been
 * submitted for signature.
 *
 * @param context - Authenticated Zoho Sign context providing fetch and rate limiting
 * @returns Function that updates a draft document by request ID
 *
 * @example
 * ```typescript
 * const updateDocument = zohoSignUpdateDocument(context);
 *
 * await updateDocument({
 *   requestId: '12345',
 *   data: { notes: 'Updated notes for this document' }
 * });
 * ```
 *
 * @see https://www.zoho.com/sign/api/document-managment/update-document.html
 */
export function zohoSignUpdateDocument(context: ZohoSignContext): ZohoSignUpdateDocumentFunction {
  return ({ requestId, data }: ZohoSignUpdateDocumentInput) => context.fetchJson<ZohoSignDocumentOperationResponse>(`/requests/${requestId}`, zohoSignApiFetchJsonInput('PUT', { requests: data }));
}

// MARK: Send Document for Signature
export interface ZohoSignSendDocumentForSignatureInput {
  readonly requestId: ZohoSignRequestId;
  readonly data?: Partial<ZohoSignRequestData>;
}

export type ZohoSignSendDocumentForSignatureFunction = (input: ZohoSignSendDocumentForSignatureInput) => Promise<ZohoSignDocumentOperationResponse>;

/**
 * Creates a {@link ZohoSignSendDocumentForSignatureFunction} bound to the given context.
 *
 * Submits a draft document to its recipients for signing. Optionally accepts
 * partial {@link ZohoSignRequestData} to apply last-minute updates before
 * submission. Once submitted, the document transitions from draft to
 * "inprogress" status and recipients receive signing notifications.
 *
 * @param context - Authenticated Zoho Sign context providing fetch and rate limiting
 * @returns Function that sends a document for signature by request ID
 *
 * @example
 * ```typescript
 * const sendForSignature = zohoSignSendDocumentForSignature(context);
 *
 * // Submit a draft for signing:
 * await sendForSignature({ requestId: '12345' });
 *
 * // Submit with last-minute updates:
 * await sendForSignature({
 *   requestId: '12345',
 *   data: { expiration_days: 30 }
 * });
 * ```
 *
 * @see https://www.zoho.com/sign/api/document-managment/send-document-for-signature.html
 */
export function zohoSignSendDocumentForSignature(context: ZohoSignContext): ZohoSignSendDocumentForSignatureFunction {
  return ({ requestId, data }: ZohoSignSendDocumentForSignatureInput) => {
    const body = data ? { requests: data } : undefined;
    return context.fetchJson<ZohoSignDocumentOperationResponse>(`/requests/${requestId}/submit`, zohoSignApiFetchJsonInput('POST', body));
  };
}

// MARK: Extend Document
export interface ZohoSignExtendDocumentInput {
  readonly requestId: ZohoSignRequestId;
  /**
   * New expiration date string.
   *
   * Example: "30 November 2024"
   */
  readonly expire_by: string;
}

export type ZohoSignExtendDocumentFunction = (input: ZohoSignExtendDocumentInput) => Promise<ZohoSignApiResponse>;

/**
 * Creates a {@link ZohoSignExtendDocumentFunction} bound to the given context.
 *
 * Extends the expiration date of an in-progress document. The new date is
 * provided as a human-readable string (e.g. "30 November 2024"). Useful for
 * giving recipients additional time to complete signing.
 *
 * @param context - Authenticated Zoho Sign context providing fetch and rate limiting
 * @returns Function that extends a document's expiration by request ID
 *
 * @example
 * ```typescript
 * const extendDocument = zohoSignExtendDocument(context);
 * await extendDocument({ requestId: '12345', expire_by: '30 November 2024' });
 * ```
 *
 * @see https://www.zoho.com/sign/api/document-managment/extend-document.html
 */
export function zohoSignExtendDocument(context: ZohoSignContext): ZohoSignExtendDocumentFunction {
  return ({ requestId, expire_by }: ZohoSignExtendDocumentInput) => context.fetchJson<ZohoSignApiResponse>(`/requests/${requestId}/extend`, zohoSignApiFetchJsonInput('PUT', { expire_by }));
}

// MARK: Delete Document
export interface ZohoSignDeleteDocumentInput {
  readonly requestId: ZohoSignRequestId;
  /**
   * Set to true when the document is in progress to recall it before deleting.
   */
  readonly recall_inprogress?: boolean;
  /**
   * Reason for recalling/deleting the document.
   */
  readonly reason?: string;
}

export type ZohoSignDeleteDocumentFunction = (input: ZohoSignDeleteDocumentInput) => Promise<ZohoSignApiResponse>;

/**
 * Creates a {@link ZohoSignDeleteDocumentFunction} bound to the given context.
 *
 * Deletes a document from Zoho Sign. For documents that are currently
 * in-progress, set `recall_inprogress` to `true` to recall the document
 * from recipients before deletion. An optional `reason` can be provided
 * to explain the recall. Sends the parameters as URL-encoded form data.
 *
 * @param context - Authenticated Zoho Sign context providing fetch and rate limiting
 * @returns Function that deletes a document by request ID
 *
 * @example
 * ```typescript
 * const deleteDocument = zohoSignDeleteDocument(context);
 *
 * // Delete a draft:
 * await deleteDocument({ requestId: '12345' });
 *
 * // Recall an in-progress document before deleting:
 * await deleteDocument({
 *   requestId: '12345',
 *   recall_inprogress: true,
 *   reason: 'Contract terms changed'
 * });
 * ```
 *
 * @see https://www.zoho.com/sign/api/document-managment/delete-document.html
 */
export function zohoSignDeleteDocument(context: ZohoSignContext): ZohoSignDeleteDocumentFunction {
  return ({ requestId, recall_inprogress, reason }: ZohoSignDeleteDocumentInput) => {
    const params: Record<string, string> = {};

    if (recall_inprogress != null) {
      params['recall_inprogress'] = String(recall_inprogress);
    }

    if (reason != null) {
      params['reason'] = reason;
    }

    const form = makeUrlSearchParams(params);
    const hasForm = form.toString().length > 0;

    return context.fetchJson<ZohoSignApiResponse>(`/requests/${requestId}/delete`, {
      method: 'PUT',
      ...(hasForm ? { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() } : {})
    });
  };
}
