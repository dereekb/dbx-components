import type { CustomValidator, DynamicText, ValidationError, ValidationMessages } from '@ng-forge/dynamic-forms';
import { type Maybe, type WebsiteDomain, asArray, isWebsiteUrlWithPrefix, websiteUrlDetails } from '@dereekb/util';
import { DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceAddValidationInput } from './field';
import { IS_NOT_WEBSITE_URL_VALIDATION_KEY, IS_NOT_WEBSITE_URL_WITH_EXPECTED_DOMAIN_VALIDATION_KEY, IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY, type IsWebsiteUrlValidatorConfig } from '../../validator/website';

// MARK: Pattern
export interface DbxForgePatternValidatorConfig {
  pattern: string | RegExp;
  message?: ValidationMessages['pattern'];
}

export function dbxForgePatternValidator(config: DbxForgePatternValidatorConfig): DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceAddValidationInput {
  const { pattern, message } = config;

  return {
    validators: [
      {
        type: 'pattern',
        value: pattern
      }
    ],
    validationMessages: {
      pattern: message
    }
  };
}

// MARK: Email
export interface DbxForgeEmailValidatorConfig {
  message?: ValidationMessages['email'];
}

export const DBX_FORGE_DEFAULT_EMAIL_VALIDATION_MESSAGE = 'Please enter a valid email address.';

export function dbxForgeEmailValidator(config?: DbxForgeEmailValidatorConfig): DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceAddValidationInput {
  const message = config?.message ?? DBX_FORGE_DEFAULT_EMAIL_VALIDATION_MESSAGE;

  return {
    validators: [
      {
        type: 'email'
      }
    ],
    validationMessages: {
      email: message
    }
  };
}

// MARK: Website
export interface DbxForgeWebsiteUrlValidatorConfig extends IsWebsiteUrlValidatorConfig {
  /**
   * Optional override for the "is not a valid website url" error message.
   */
  readonly notWebsiteUrlMessage?: DynamicText;
  /**
   * Optional override for the "is not a valid website url with an http/https prefix" error message.
   */
  readonly notWebsiteUrlWithPrefixMessage?: DynamicText;
  /**
   * Optional override for the "is not a valid website url with an expected domain" error message.
   */
  readonly notWebsiteUrlWithExpectedDomainMessage?: DynamicText;
}

function buildPortNumbersMessagePart(allowPorts: boolean): string {
  return allowPorts ? '' : ' Urls with port numbers (e.g. localhost:8080) are not allowed.';
}

export function dbxForgeWebsiteUrlValidator(config?: DbxForgeWebsiteUrlValidatorConfig): DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceAddValidationInput {
  const { requirePrefix, allowPorts, validDomains: inputValidDomains, notWebsiteUrlMessage, notWebsiteUrlWithPrefixMessage, notWebsiteUrlWithExpectedDomainMessage } = config ?? {};
  const isPrefixRequired = requirePrefix ?? true;
  const isAllowPorts = allowPorts ?? false;
  const validDomains: WebsiteDomain[] = asArray<Maybe<WebsiteDomain>>(inputValidDomains).filter((x): x is WebsiteDomain => x != null);
  const validDomainsSet = new Set(validDomains);
  const validateDomains = validDomainsSet.size > 0;
  const portNumbersMessagePart = buildPortNumbersMessagePart(isAllowPorts);

  const websiteUrlErrorKind = isPrefixRequired ? IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY : IS_NOT_WEBSITE_URL_VALIDATION_KEY;
  const defaultWebsiteUrlMessage = isPrefixRequired ? `Value is not a website url with an http/https prefix.${portNumbersMessagePart}` : `Value is not a valid website url.${portNumbersMessagePart}`;
  const defaultExpectedDomainMessage = `Value is not a website url with one of the expected domains: ${validDomains.join(', ')}.`;

  const resolvedWebsiteUrlMessage = (isPrefixRequired ? notWebsiteUrlWithPrefixMessage : notWebsiteUrlMessage) ?? defaultWebsiteUrlMessage;
  const resolvedExpectedDomainMessage = notWebsiteUrlWithExpectedDomainMessage ?? defaultExpectedDomainMessage;

  const fn: CustomValidator = (ctx) => {
    const value = ctx.value() as Maybe<string>;

    if (value == null || value === '') {
      return null;
    }

    const details = websiteUrlDetails(value);
    const errors: ValidationError[] = [];

    const isValidUrl = (() => {
      if (isPrefixRequired) {
        if (isWebsiteUrlWithPrefix(details.input)) {
          return true;
        }
      } else if (details.isWebsiteUrl) {
        return true;
      }

      if (isAllowPorts && details.hasPortNumber) {
        return isPrefixRequired ? details.hasHttpPrefix : true;
      }

      return false;
    })();

    if (!isValidUrl) {
      errors.push({ kind: websiteUrlErrorKind });
    }

    if (validateDomains) {
      const hasValidDomain = details.hasWebsiteDomain && validDomainsSet.has(details.domain);

      if (!hasValidDomain) {
        errors.push({ kind: IS_NOT_WEBSITE_URL_WITH_EXPECTED_DOMAIN_VALIDATION_KEY });
      }
    }

    return errors.length > 0 ? errors : null;
  };

  return {
    validators: [
      {
        type: 'custom',
        fn
      }
    ],
    validationMessages: {
      [websiteUrlErrorKind]: resolvedWebsiteUrlMessage,
      [IS_NOT_WEBSITE_URL_WITH_EXPECTED_DOMAIN_VALIDATION_KEY]: resolvedExpectedDomainMessage
    }
  };
}
