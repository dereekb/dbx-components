import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZohoApiUrl, type ZohoApiUrlKey, type ZohoConfig, type ZohoApiServiceName } from '../zoho.config';
import { type ZohoAccessTokenStringFactory, type ZohoServiceAccessTokenKey } from '../accounts';
import { type ZohoRateLimiterRef } from '../zoho.limit';

export const ZOHO_SIGN_SERVICE_NAME: ZohoApiServiceName | ZohoServiceAccessTokenKey = 'sign';

export type ZohoSignApiUrl = ZohoApiUrl;
export type ZohoSignApiUrlKey = ZohoApiUrlKey;

export type ZohoSignConfigApiUrlInput = ZohoSignApiUrlKey | ZohoSignApiUrl;

/**
 * Full Zoho Sign sandbox API URL. The sandbox does NOT enforce an https `host` origin on embedded
 * signing requests.
 */
export const ZOHO_SIGN_SANDBOX_API_URL: ZohoSignApiUrl = 'https://signsandbox.zoho.com/api/v1';

/**
 * Full Zoho Sign production API URL. The production endpoint enforces an https `host` origin on
 * embedded signing requests, rejecting a non-https host with error 3006 ("Url has invalid scheme").
 */
export const ZOHO_SIGN_PRODUCTION_API_URL: ZohoSignApiUrl = 'https://sign.zoho.com/api/v1';

/**
 * Resolves an environment key or passthrough URL to the full Zoho Sign API URL.
 *
 * @param input - An environment key ('sandbox' or 'production') or a full API URL.
 * @returns The resolved Zoho Sign API URL.
 */
export function zohoSignConfigApiUrl(input: ZohoSignConfigApiUrlInput): ZohoApiUrl {
  let result: ZohoApiUrl;
  switch (input) {
    case 'sandbox':
      result = ZOHO_SIGN_SANDBOX_API_URL;
      break;
    case 'production':
      result = ZOHO_SIGN_PRODUCTION_API_URL;
      break;
    default:
      result = input;
      break;
  }
  return result;
}

/**
 * Returns whether the given Zoho Sign API URL (an environment key or full URL) targets an endpoint
 * that enforces an https `host` origin on embedded signing requests. Every production data center
 * enforces it (rejecting a non-https host with error 3006, "Url has invalid scheme"); only the
 * sandbox tolerates a non-https host.
 *
 * @param input - An environment key ('sandbox' or 'production') or a full API URL.
 * @returns True unless the resolved URL is the Zoho Sign sandbox.
 */
export function zohoSignApiUrlRequiresHttpsHost(input: ZohoSignConfigApiUrlInput): boolean {
  const resolved = zohoSignConfigApiUrl(input);
  let result: boolean;

  try {
    result = new URL(resolved).hostname !== new URL(ZOHO_SIGN_SANDBOX_API_URL).hostname;
  } catch {
    result = true; // fail safe: enforce https when the URL cannot be parsed
  }

  return result;
}

export type ZohoSignConfig = ZohoConfig;

export interface ZohoSignFetchFactoryParams {
  readonly apiUrl: ZohoSignApiUrl;
}

export type ZohoSignFetchFactory = FactoryWithRequiredInput<ConfiguredFetch, ZohoSignFetchFactoryParams>;

export interface ZohoSignContext extends ZohoRateLimiterRef {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly accessTokenStringFactory: ZohoAccessTokenStringFactory;
  readonly config: ZohoSignConfig;
}

export interface ZohoSignContextRef {
  readonly signContext: ZohoSignContext;
}
