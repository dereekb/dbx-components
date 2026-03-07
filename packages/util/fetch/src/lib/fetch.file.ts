import { type ArrayOrValue, asArray, type ContentTypeMimeType, type Maybe, type MimeTypeWithoutParameters } from '@dereekb/util';
import { safeParse as parseContentType } from 'fast-content-type-parse';
import { type FetchMethod } from './fetch.type';

// MARK: Make File
/**
 * Input for makeFileForFetch().
 */
export interface MakeFileForFetchInput {
  /**
   * File content. Can be a string, ArrayBuffer, Blob, or array of BlobParts.
   */
  readonly content: ArrayOrValue<BlobPart>;
  /**
   * File name including extension.
   *
   * @example 'document.pdf'
   */
  readonly fileName: string;
  /**
   * MIME type of the file.
   *
   * @example 'application/pdf'
   */
  readonly mimeType?: ContentTypeMimeType;
  /**
   * Last modified timestamp in milliseconds.
   */
  readonly lastModified?: number;
}

/**
 * Creates a File object from the given input.
 *
 * @example
 * makeFileForFetch({ content: pdfBuffer, fileName: 'doc.pdf', mimeType: 'application/pdf' })
 */
export function makeFileForFetch(input: MakeFileForFetchInput): File {
  const options: FilePropertyBag = {};

  if (input.mimeType) {
    options.type = input.mimeType;
  }

  if (input.lastModified != null) {
    options.lastModified = input.lastModified;
  }

  return new File(asArray(input.content), input.fileName, options);
}

// MARK: Parse Response
export type FetchFileResponseContentType = ReturnType<typeof parseContentType>;

export interface FetchFileResponse {
  /**
   * The raw response from the fetch request.
   */
  readonly response: Response;
  /**
   * Raw content type from the response's content-type header.
   */
  readonly rawContentType: Maybe<ContentTypeMimeType>;
  /**
   * Parsed content type. Unavailable if the content type could not be parsed.
   */
  readonly contentType: Maybe<FetchFileResponseContentType>;
  /**
   * Parsed mime type. Unavailable if the content type could not be parsed.
   */
  readonly mimeType: Maybe<MimeTypeWithoutParameters>;
}

/**
 * Parses the file response and returns the response wrapped in a FetchFileResponse object.
 *
 * @param response
 * @returns
 */
export function parseFetchFileResponse(response: Response): FetchFileResponse {
  const rawContentType: Maybe<ContentTypeMimeType> = response.headers.get('content-type');
  const parseContentTypeResult = parseContentType(rawContentType ?? '');
  const contentType: Maybe<FetchFileResponseContentType> = parseContentTypeResult.type !== '' ? parseContentTypeResult : undefined;

  return {
    response,
    rawContentType,
    contentType,
    mimeType: contentType?.type
  };
}

// MARK: Compat
/**
 * @deprecated Use makeFileForFetch() with FormData instead.
 */
export interface FetchUploadFile {
  readonly url: string;
  readonly fetch?: typeof fetch;
  readonly method?: FetchMethod;
  readonly body: FetchUploadFileBody;
}

/**
 * @deprecated Use makeFileForFetch() with FormData instead.
 */
export interface FetchUploadFileBody {
  readonly mimeType: ContentTypeMimeType;
  readonly body: BodyInit;
}

/**
 * @deprecated Use makeFileForFetch() with FormData and context.fetch() instead.
 */
export function fetchUploadFile(input: FetchUploadFile) {
  const { fetch: inputFetch, url, body: inputBody } = input;
  const useFetch = inputFetch ?? fetch;

  return useFetch(url, {
    method: input.method ?? 'POST',
    body: inputBody.body,
    headers: {
      'Content-Type': inputBody.mimeType
    }
  });
}
