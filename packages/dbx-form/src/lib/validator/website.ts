import { type AbstractControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';
import { type ArrayOrValue, type Maybe, type WebsiteDomain, type WebsiteUrlDetails, asArray, isWebsiteUrlWithPrefix, websiteUrlDetails } from '@dereekb/util';

export const IS_NOT_WEBSITE_URL_VALIDATION_KEY = 'isNotWebsiteUrl';
export const IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY = 'isNotWebsiteUrlWithPrefix';
export const IS_NOT_WEBSITE_URL_WITH_EXPECTED_DOMAIN_VALIDATION_KEY = 'isNotWebsiteUrlWithExpectedDomain';

export interface IsNotWebsiteUrlErrorData {
  readonly value: string;
  readonly isPrefixRequired: boolean;
  readonly message: string;
}

export interface IsWebsiteUrlValidatorConfig {
  /**
   * Whether or not to require an http/https prefix.
   *
   * Defaults to true.
   */
  readonly requirePrefix?: Maybe<boolean>;
  /**
   * Valid domains to accept.
   *
   * Defaults to undefined.
   */
  readonly validDomains?: Maybe<ArrayOrValue<WebsiteDomain>>;
}

/**
 * Angular Form ValidationFn for checking isDivisibleBy the input divisor.
 *
 * @param divisor
 * @returns
 */
export function isWebsiteUrlValidator(config?: IsWebsiteUrlValidatorConfig): ValidatorFn {
  const { requirePrefix, validDomains: inputValidDomains } = config ?? {};
  const isPrefixRequired = requirePrefix ?? true;
  const validDomains = asArray(inputValidDomains);
  const validDomainsSet = new Set(validDomains);
  const validateDomains = validDomainsSet.size > 0;

  const validateWebsiteValue: (details: WebsiteUrlDetails) => ValidationErrors | null = isPrefixRequired
    ? (details: WebsiteUrlDetails) => {
        return isWebsiteUrlWithPrefix(details.input)
          ? null
          : {
              [IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY]: {
                value: details.input,
                isPrefixRequired,
                message: `Value is not a website url with an http/https prefix.`
              }
            };
      }
    : (details: WebsiteUrlDetails) => {
        return details.isWebsiteUrl
          ? null
          : {
              [IS_NOT_WEBSITE_URL_VALIDATION_KEY]: {
                value: details.input,
                isPrefixRequired,
                message: `Value is not a valid website url.`
              }
            };
      };

  const validateWebsiteDomain: (details: WebsiteUrlDetails) => ValidationErrors | null = (details: WebsiteUrlDetails) => {
    let pass = validDomainsSet.size === 0 ? true : false;

    if (details.hasWebsiteDomain && validateDomains) {
      pass = validDomainsSet.has(details.domain);
    }

    return pass
      ? null
      : {
          [IS_NOT_WEBSITE_URL_WITH_EXPECTED_DOMAIN_VALIDATION_KEY]: {
            value: details.input,
            isPrefixRequired,
            validDomains,
            message: `Value is not a website url with one of the expected domains: ${validDomains.join(', ')}.`
          }
        };
  };

  return (control: AbstractControl): ValidationErrors | null => {
    const value: string | undefined = control.value;

    if (value != null) {
      const details = websiteUrlDetails(value);

      return {
        ...validateWebsiteValue(details),
        ...validateWebsiteDomain(details)
      };
    }

    return {};
  };
}
