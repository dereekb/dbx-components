import { isUsStateCodeString, ModelKey, UnitedStatesAddress, WebsitePath } from '@dereekb/util';

export interface ZohoModel {}

/**
 * General Zoho API GET request response.
 */
export interface ZohoGetApiResult<T> {
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
