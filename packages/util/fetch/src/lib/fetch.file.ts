import { ContentTypeMimeType, Maybe, MimeTypeWithoutParameters } from '@dereekb/util';
import { safeParse as parseContentType } from 'fast-content-type-parse';
import { FetchMethod } from './fetch.type';

// MARK: Post
/**
 * Input for fetchUploadFile().
 */
export interface FetchUploadFile {
  /**
   * URL to upload the file to.
   */
  readonly url: string;
  /**
   * Fetch function to use.
   *
   * Defaults to the global fetch function.
   */
  readonly fetch?: typeof fetch;
  /**
   * Method to use. Defaults to 'POST'.
   */
  readonly method?: FetchMethod;
  /**
   * Body data to upload.
   */
  readonly body: FetchUploadFileBody;
}

/**
 * A mime type and body pair to upload.
 */
export interface FetchUploadFileBody {
  /**
   * The mime type of the body content to upload.
   */
  readonly mimeType: ContentTypeMimeType;
  /**
   * The body, passed to fetch.
   *
   * Can be a Uint8Array, Buffer, FormData, string, etc.
   */
  readonly body: BodyInit;
}

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
