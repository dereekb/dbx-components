import { type ArrayOrValue, asArray, type ContentTypeMimeType, type Maybe, type MimeTypeWithoutParameters, urlWithoutParameters } from '@dereekb/util';
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
 * @param input - configuration containing the file content, name, optional MIME type, and last modified timestamp
 * @returns a File object constructed from the provided input
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

// MARK: Fetch File From URL
/**
 * Input for fetchFileFromUrl().
 */
export interface FetchFileFromUrlInput {
  /**
   * URL to download the file from.
   */
  readonly url: string;
  /**
   * File name to use for the resulting File object.
   *
   * If not provided, attempts to derive the name from the URL path or falls back to 'file'.
   */
  readonly fileName?: Maybe<string>;
  /**
   * MIME type override. If not provided, uses the Content-Type from the response.
   */
  readonly mimeType?: Maybe<ContentTypeMimeType>;
  /**
   * Fetch function to use. Defaults to the global fetch.
   */
  readonly fetch?: Maybe<typeof fetch>;
}

/**
 * Downloads a file from the given URL and returns it as a File object.
 *
 * When safe is true, returns undefined instead of throwing on fetch failure.
 *
 * @param input - configuration containing the URL, optional file name, MIME type override, and fetch function
 * @returns the downloaded content as a File object, or undefined in safe mode on failure
 */
export async function fetchFileFromUrl(input: FetchFileFromUrlInput): Promise<File>;
export async function fetchFileFromUrl(input: FetchFileFromUrlInput, safe: true): Promise<Maybe<File>>;
export async function fetchFileFromUrl(input: FetchFileFromUrlInput, safe?: Maybe<boolean>): Promise<Maybe<File>> {
  const { url, mimeType, fetch: inputFetch } = input;
  const useFetch = inputFetch ?? fetch;
  const response = await useFetch(url, { method: 'GET' });
  let result: Maybe<File>;

  if (!response.ok) {
    if (!safe) {
      throw new Error(`Failed to fetch file from ${url}: ${response.status} ${response.statusText}`);
    }
  } else {
    const buffer = await response.arrayBuffer();
    const responseMimeType = mimeType ?? response.headers.get('content-type') ?? undefined;
    const fileName = input.fileName ?? urlWithoutParameters(url).split('/').pop() ?? 'file';
    const options: FilePropertyBag = responseMimeType ? { type: responseMimeType } : {};
    result = new File([buffer], fileName, options);
  }

  return result;
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
  const contentType: Maybe<FetchFileResponseContentType> = parseContentTypeResult.type === '' ? undefined : parseContentTypeResult;

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
  // eslint-disable-next-line @typescript-eslint/no-deprecated
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
 *
 * @param input - configuration containing the upload URL, fetch function, HTTP method, and file body
 * @returns a promise resolving to the fetch Response
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated
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
