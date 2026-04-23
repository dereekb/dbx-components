import type { CustomValidator, DynamicText, ValidationError, ValidationMessages } from '@ng-forge/dynamic-forms';
import { type Maybe, type WebsiteDomain, asArray, isWebsiteUrlWithPrefix, websiteUrlDetails } from '@dereekb/util';
import { type DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceAddValidationInput } from './field';
import { IS_NOT_WEBSITE_URL_VALIDATION_KEY, IS_NOT_WEBSITE_URL_WITH_EXPECTED_DOMAIN_VALIDATION_KEY, IS_NOT_WEBSITE_URL_WITH_PREFIX_VALIDATION_KEY, type IsWebsiteUrlValidatorConfig } from '../../validator/website';

// MARK: Pattern
/**
 * Configuration for {@link dbxForgePatternValidator}.
 */
export interface DbxForgePatternValidatorConfig {
  pattern: string | RegExp;
  message?: ValidationMessages['pattern'];
}

/**
 * Builds a forge validator input that applies a regex pattern constraint to a field.
 *
 * @param config - the pattern to match and an optional override for the `pattern` validation message
 * @returns a validator input with a `pattern` validator and the associated validation message
 *
 * @example
 * ```ts
 * instance.addValidation(dbxForgePatternValidator({ pattern: /^[a-z0-9-]+$/i, message: 'Only alphanumerics and dashes are allowed.' }));
 * ```
 */
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
/**
 * Configuration for {@link dbxForgeEmailValidator}.
 */
export interface DbxForgeEmailValidatorConfig {
  message?: ValidationMessages['email'];
}

/**
 * Default message applied by {@link dbxForgeEmailValidator} when no override is supplied.
 */
export const DBX_FORGE_DEFAULT_EMAIL_VALIDATION_MESSAGE = 'Please enter a valid email address.';

/**
 * Builds a forge validator input that applies the built-in `email` validator with a default
 * user-friendly message.
 *
 * @param config - optional override for the `email` validation message
 * @returns a validator input with an `email` validator and the associated validation message
 *
 * @example
 * ```ts
 * instance.addValidation(dbxForgeEmailValidator());
 * instance.addValidation(dbxForgeEmailValidator({ message: 'Enter your work email.' }));
 * ```
 */
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
/**
 * Configuration for {@link dbxForgeWebsiteUrlValidator}. Extends
 * {@link IsWebsiteUrlValidatorConfig} with per-error message overrides.
 */
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

/**
 * Builds a forge validator input that checks a value is a valid website URL, optionally
 * requiring an http/https prefix and/or restricting to an allow-list of domains.
 *
 * When `validDomains` is provided and non-empty, an additional domain-match error is emitted
 * independently of the URL-shape error so both problems can surface at once.
 *
 * @param config - tuning knobs for prefix, port, allowed domains, and custom messages
 * @returns a validator input with a custom validator and the associated website validation messages
 *
 * @example
 * ```ts
 * instance.addValidation(dbxForgeWebsiteUrlValidator());
 * instance.addValidation(dbxForgeWebsiteUrlValidator({ requirePrefix: false, allowPorts: true }));
 * instance.addValidation(dbxForgeWebsiteUrlValidator({ validDomains: ['example.com', 'example.org'] }));
 * ```
 */
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
    let result: ValidationError[] | null = null;

    if (value != null && value !== '') {
      const details = websiteUrlDetails(value);
      const errors: ValidationError[] = [];

      const isValidUrl = (() => {
        let valid = false;

        if (isPrefixRequired ? isWebsiteUrlWithPrefix(details.input) : details.isWebsiteUrl) {
          valid = true;
        } else if (isAllowPorts && details.hasPortNumber) {
          valid = isPrefixRequired ? details.hasHttpPrefix : true;
        }

        return valid;
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

      result = errors.length > 0 ? errors : null;
    }

    return result;
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
