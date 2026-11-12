import { type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, FetchResponseError } from '@dereekb/util/fetch';
import { BaseError } from 'make-error';

/**
 * The `error` object of a Graph error body (`{ error: { code, message } }`).
 */
export interface MicrosoftGraphErrorData {
  readonly code: string;
  readonly message?: Maybe<string>;
  readonly innerError?: Maybe<Record<string, unknown>>;
}

/**
 * An error returned by the Microsoft Graph API.
 */
export class MicrosoftGraphError extends BaseError {
  get code(): string {
    return this.data.code;
  }

  /**
   * The HTTP status of the response.
   *
   * @returns The response's HTTP status code.
   */
  get status(): number {
    return this.responseError.response.status;
  }

  constructor(
    readonly data: MicrosoftGraphErrorData,
    readonly responseError: FetchResponseError
  ) {
    super(data.message ? `${data.code}: ${data.message}` : data.code);
  }
}

/**
 * Parses a {@link FetchResponseError} from a Graph call into a {@link MicrosoftGraphError}.
 *
 * @param responseError - The fetch response error to parse.
 * @returns The parsed error, or undefined when the body carried no Graph error.
 */
export async function parseMicrosoftGraphError(responseError: FetchResponseError): Promise<Maybe<MicrosoftGraphError>> {
  const body: Maybe<{ readonly error?: Maybe<MicrosoftGraphErrorData> }> = await responseError.response
    .clone()
    .json()
    .catch(() => undefined);

  const data = body?.error;
  return typeof data?.code === 'string' ? new MicrosoftGraphError(data, responseError) : undefined;
}

/**
 * Wraps a {@link ConfiguredFetch} so that Graph error responses surface as {@link MicrosoftGraphError}s.
 *
 * @param fetch - The fetch to wrap.
 * @returns The wrapped fetch.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function handleMicrosoftGraphErrorFetch(fetch: ConfiguredFetch): ConfiguredFetch {
  return async (x, y) => {
    try {
      return await fetch(x, y); // await to catch thrown errors
    } catch (e) {
      if (e instanceof FetchResponseError) {
        const error = await parseMicrosoftGraphError(e);

        if (error) {
          throw error;
        }
      }

      throw e;
    }
  };
}

// MARK: Error classification
/**
 * Graph error codes meaning the addressed item does not exist (or the user cannot see it): OneDrive's
 * `itemNotFound`, Outlook's `ErrorItemNotFound`, and the generic `ResourceNotFound`.
 */
export const MICROSOFT_GRAPH_NOT_FOUND_ERROR_CODES: readonly string[] = ['itemNotFound', 'ErrorItemNotFound', 'ResourceNotFound'];

/**
 * The Graph error code Exchange returns while the service is degraded. During the 2026-11-12 Microsoft
 * 365 outage every mail and calendar call answered it.
 */
export const MICROSOFT_GRAPH_UNKNOWN_ERROR_CODE = 'UnknownError';

/**
 * Returns whether a Graph error means the item was not found: a 404, or a not-found code under another
 * status.
 *
 * @param error - The Graph error.
 * @returns True when the item does not exist or is not visible to the user.
 */
export function isMicrosoftGraphNotFoundError(error: MicrosoftGraphError): boolean {
  return error.status === 404 || MICROSOFT_GRAPH_NOT_FOUND_ERROR_CODES.includes(error.code);
}

/**
 * Returns whether a Graph error means the service, not the request, failed: a 5xx, or Exchange's
 * `UnknownError` under any status.
 *
 * @param error - The Graph error.
 * @returns True for a server-side failure worth retrying later.
 */
export function isMicrosoftGraphServiceError(error: MicrosoftGraphError): boolean {
  return error.status >= 500 || error.code === MICROSOFT_GRAPH_UNKNOWN_ERROR_CODE;
}

/**
 * Reads the scopes a 403 says the call needs. Teams and some other workloads answer
 * `Missing scope permissions on the request. API requires one of 'ChannelMessage.Read.All, Group.Read.All'. Scopes on the request '…'`.
 *
 * @param message - The Graph error message.
 * @returns The required scopes, in the order Graph lists them; empty when the message names none.
 */
export function readMicrosoftGraphRequiredScopesFromErrorMessage(message: Maybe<string>): string[] {
  const match = /requires one of '([^']*)'/i.exec(message ?? '');
  return match
    ? match[1]
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
}
