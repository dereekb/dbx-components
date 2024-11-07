import { WebsitePath } from '@dereekb/util';

export interface ZohoModel {}

// MARK: V1
/**
 * General Zoho API GET request response sent by the v1 API.
 *
 * @deprecated
 */
export interface ZohoGetApiV1Result<T> {
  readonly response: {
    /**
     * Result value
     */
    readonly result: T;
    /**
     * Path to the resource.
     */
    readonly url: WebsitePath;
  };
}
