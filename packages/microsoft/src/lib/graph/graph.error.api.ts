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
