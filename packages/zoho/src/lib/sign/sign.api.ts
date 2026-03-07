import { type Maybe } from '@dereekb/util';
import { type FetchJsonBody, type FetchJsonInput, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoSignContext } from './sign.config';
import { type ZohoSignRequest, type ZohoSignRequestId, type ZohoSignRequestData, type ZohoSignFieldType, type ZohoSignDocumentFormData } from './sign';
import { type ZohoSignPageFilter, type ZohoSignPageResult, type ZohoSignSearchColumns, zohoSignFetchPageFactory } from './sign.api.page';

// MARK: Utility
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
 * Gets details of a particular document.
 *
 * https://www.zoho.com/sign/api/document-managment/get-details-of-a-particular-document.html
 *
 * @param context
 * @returns
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
 * Gets a list of documents with pagination.
 *
 * https://www.zoho.com/sign/api/document-managment/get-document-list.html
 *
 * @param context
 * @returns
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
 * Creates a page factory for iterating through documents.
 *
 * @param context
 * @returns
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
 * Gets the form field data for a completed document.
 *
 * https://www.zoho.com/sign/api/document-managment/get-document-form-data.html
 *
 * @param context
 * @returns
 */
export function zohoSignGetDocumentFormData(context: ZohoSignContext): ZohoSignGetDocumentFormDataFunction {
  return ({ requestId }: ZohoSignGetDocumentFormDataInput) => context.fetchJson<ZohoSignGetDocumentFormDataResponse>(`/requests/${requestId}/fielddata`, zohoSignApiFetchJsonInput('GET'));
}

// MARK: Retrieve Field Types
export type ZohoSignRetrieveFieldTypesFunction = () => Promise<ZohoSignRetrieveFieldTypesResponse>;

/**
 * Retrieves all available field types for documents.
 *
 * https://www.zoho.com/sign/api/document-managment/retrieve-field-type.html
 *
 * @param context
 * @returns
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
 * Downloads the signed PDF document(s).
 *
 * Returns a PDF (single document) or ZIP (multiple documents) response.
 *
 * https://www.zoho.com/sign/api/document-managment/download-pdf.html
 *
 * @param context
 * @returns
 */
export function zohoSignDownloadPdf(context: ZohoSignContext): ZohoSignDownloadPdfFunction {
  return ({ requestId, ...params }: ZohoSignDownloadPdfInput) => {
    const searchParams = makeUrlSearchParams(params);
    const queryString = searchParams.toString();
    const url = `/requests/${requestId}/pdf${queryString ? `?${queryString}` : ''}`;
    return context.fetch(url, { method: 'GET' });
  };
}

// MARK: Download Completion Certificate
export interface ZohoSignDownloadCompletionCertificateInput {
  readonly requestId: ZohoSignRequestId;
}

export type ZohoSignDownloadCompletionCertificateFunction = (input: ZohoSignDownloadCompletionCertificateInput) => Promise<Response>;

/**
 * Downloads the completion certificate PDF for a document.
 *
 * https://www.zoho.com/sign/api/document-managment/download-completion-certificate.html
 *
 * @param context
 * @returns
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
 * Creates a new document (draft).
 *
 * Uses multipart/form-data to send the request data and optional file.
 *
 * https://www.zoho.com/sign/api/document-managment/create-document.html
 *
 * @param context
 * @returns
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
 * Updates an existing document (draft).
 *
 * https://www.zoho.com/sign/api/document-managment/update-document.html
 *
 * @param context
 * @returns
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
 * Sends a document for signature.
 *
 * https://www.zoho.com/sign/api/document-managment/send-document-for-signature.html
 *
 * @param context
 * @returns
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
 * Extends the expiration date of a document.
 *
 * https://www.zoho.com/sign/api/document-managment/extend-document.html
 *
 * @param context
 * @returns
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
 * Deletes a document.
 *
 * https://www.zoho.com/sign/api/document-managment/delete-document.html
 *
 * @param context
 * @returns
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
