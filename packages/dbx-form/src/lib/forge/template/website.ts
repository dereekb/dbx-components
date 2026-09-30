import type { DynamicText } from '@ng-forge/dynamic-forms';
import { filterFromPOJO, type WebsiteUrlRelativePathFunctionsConfig } from '@dereekb/util';
import type { FieldAutocompleteAttributeOptionRef } from '../../field/field.autocomplete';
import { dbxForgeBuildFieldDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef } from '../field/field';
import { dbxForgeWebsiteUrlValidator, dbxForgeWebsiteUrlWithBaseUrlValidator, type DbxForgeWebsiteUrlValidatorConfig } from '../field/field.util.validation';
import { configureForgeTextInputFieldDef, type DbxForgeTextFieldConfig } from '../field/value/text/text.field';
import { FORGE_WEBSITE_URL_FIELD_TYPE, type DbxForgeWebsiteUrlFieldDef, type DbxForgeWebsiteUrlFieldValueMode } from '../field/value/website/website.field';
import type { DbxForgeField } from '../form/forge.form';

/**
 * Configuration for a forge website URL field.
 */
export interface DbxForgeWebsiteUrlFieldConfig
  extends
    Omit<DbxForgeFieldFunctionDef<DbxForgeWebsiteUrlFieldDef>, 'key'>,
    Partial<Pick<DbxForgeFieldFunctionDef<DbxForgeWebsiteUrlFieldDef>, 'key'>>,
    FieldAutocompleteAttributeOptionRef,
    Pick<DbxForgeTextFieldConfig, 'idempotentTransform'>,
    DbxForgeWebsiteUrlValidatorConfig,
    Partial<WebsiteUrlRelativePathFunctionsConfig> {
  /**
   * The value saved when a base url is configured.
   *
   * - `'url'`: the full website url, e.g. `https://linkedin.com/in/dereekb`
   * - `'relative'`: only the relative path that follows the base url, e.g. `dereekb`
   *
   * Defaults to `'url'`.
   */
  readonly valueMode?: DbxForgeWebsiteUrlFieldValueMode;
  /**
   * Optional override for the "is not a website url with the expected base url" error message.
   *
   * Only used when a base url is configured.
   */
  readonly notWebsiteUrlWithExpectedBaseUrlMessage?: DynamicText;
}

type DbxForgeWebsiteUrlFieldFunctionConfig = DbxForgeWebsiteUrlFieldConfig & Pick<DbxForgeWebsiteUrlFieldDef, 'key'>;

const dbxForgeWebsiteUrlFieldFunction = dbxForgeFieldFunction<DbxForgeWebsiteUrlFieldFunctionConfig>({
  type: FORGE_WEBSITE_URL_FIELD_TYPE,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder((config) =>
    filterFromPOJO({
      baseUrl: config.baseUrl,
      allowHttp: config.allowHttp,
      valueMode: config.valueMode
    })
  ),
  buildFieldDef: dbxForgeBuildFieldDef<DbxForgeWebsiteUrlFieldFunctionConfig, string>((x, config) => {
    const { baseUrl, allowHttp, notWebsiteUrlWithExpectedBaseUrlMessage } = config;

    configureForgeTextInputFieldDef(x, config);

    if (baseUrl) {
      x.addValidation(dbxForgeWebsiteUrlWithBaseUrlValidator({ baseUrl, allowHttp, notWebsiteUrlWithExpectedBaseUrlMessage }));
    } else {
      x.addValidation(dbxForgeWebsiteUrlValidator(config));
    }

    // remove the config-only properties from the field definition
    delete config.baseUrl;
    delete config.allowHttp;
    delete config.valueMode;
    delete config.requirePrefix;
    delete config.allowPorts;
    delete config.validDomains;
    delete config.notWebsiteUrlMessage;
    delete config.notWebsiteUrlWithPrefixMessage;
    delete config.notWebsiteUrlWithExpectedDomainMessage;
    delete config.notWebsiteUrlWithExpectedBaseUrlMessage;
  })
});

/**
 * Website url input with website url validation.
 *
 * Defaults to the key `'website'` and label `'Website Url'` unless overridden in the config.
 *
 * When a `baseUrl` is configured (e.g. `'https://linkedin.com/in/'`), the base url is shown as a prefix and the user only types the relative path
 * that follows it (e.g. a username). Pasting a full url, or a url without the protocol, removes the base url from the input. The `valueMode`
 * determines whether the full url or only the relative path is saved. The `requirePrefix`, `allowPorts`, and `validDomains` validation options
 * only apply when no base url is configured.
 *
 * @param config - Optional configuration for the website url field.
 * @returns A {@link DbxForgeWebsiteUrlFieldDef} for website url input.
 *
 * @dbxFormField
 * @dbxFormSlug website-url
 * @dbxFormTier field-factory
 * @dbxFormProduces string
 * @dbxFormArrayOutput no
 * @dbxFormNgFormType websiteurl
 * @dbxFormWrapperPattern unwrapped
 * @dbxFormConfigInterface DbxForgeWebsiteUrlFieldConfig
 * @example
 * ```typescript
 * const field = dbxForgeWebsiteUrlField();
 * const linkedInField = dbxForgeWebsiteUrlField({ key: 'linkedIn', label: 'LinkedIn', baseUrl: 'https://linkedin.com/in/' });
 * const linkedInUsernameField = dbxForgeWebsiteUrlField({ key: 'linkedInUsername', label: 'LinkedIn', baseUrl: 'https://linkedin.com/in/', valueMode: 'relative' });
 * ```
 */
export function dbxForgeWebsiteUrlField(config?: DbxForgeWebsiteUrlFieldConfig): DbxForgeField<DbxForgeWebsiteUrlFieldDef> {
  return dbxForgeWebsiteUrlFieldFunction({
    key: 'website',
    ...config,
    label: config?.label ?? 'Website Url'
  });
}
