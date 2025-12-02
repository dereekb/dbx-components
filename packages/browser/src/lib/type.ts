import { type Destroyable, type Maybe, type MaybeNot } from '@dereekb/util';

/**
 * A URL created by the browser.
 */
export type BrowserObjectURL = string;

/**
 * Interface that contains a reference to a browser object URL.
 *
 * Handles the creation and cleanup of the input browser urls.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/blob
 */
export interface BrowserObjectURLRef extends Destroyable {
  /**
   * Returns the current browser object URL, if one currently exists.
   */
  getBrowserUrl(): Maybe<BrowserObjectURL>;
  /**
   * Creates a new browser object URL from the input.
   */
  createBrowserUrl(input?: MaybeNot): MaybeNot;
  createBrowserUrl(input: Blob | MediaSource): BrowserObjectURL;
  createBrowserUrl(input?: Maybe<Blob | MediaSource>): Maybe<BrowserObjectURL>;
}

/**
 * Creatse a new BrowserObjectURLRef.
 */
export function browserObjectUrlRef(): BrowserObjectURLRef {
  let browserUrl: Maybe<BrowserObjectURL>;

  /**
   * Revokes the existing browser object URL, if one exists.
   */
  function destroy() {
    if (browserUrl) {
      URL.revokeObjectURL(browserUrl);
    }
  }

  function createBrowserUrl(input?: Maybe<Blob | MediaSource>): Maybe<BrowserObjectURL> {
    destroy();

    if (input) {
      browserUrl = URL.createObjectURL(input);
    }

    return browserUrl;
  }

  return {
    destroy,
    getBrowserUrl: () => browserUrl,
    createBrowserUrl: createBrowserUrl as BrowserObjectURLRef['createBrowserUrl']
  };
}
