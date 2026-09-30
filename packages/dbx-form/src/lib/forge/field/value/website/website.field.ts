import type { BaseValueField, DynamicText } from '@ng-forge/dynamic-forms';
import type { MatInputProps } from '@ng-forge/dynamic-forms-material';
import type { WebsiteUrlRelativePathFunctionsConfig } from '@dereekb/util';
import type { DbxForgeFieldHintValueRef } from '../../field';
import type { DbxForgeTextFieldInputType } from '../text/text.field';

/**
 * The custom forge field type name for the website url field.
 */
export const FORGE_WEBSITE_URL_FIELD_TYPE = 'websiteurl' as const;

/**
 * The value saved by a website url field that has a base url.
 *
 * - `'url'`: the full website url, e.g. `https://linkedin.com/in/dereekb`
 * - `'relative'`: only the relative path that follows the base url, e.g. `dereekb`
 */
export type DbxForgeWebsiteUrlFieldValueMode = 'url' | 'relative';

/**
 * Custom props for the forge website url field.
 *
 * Includes the same Material input props as the forge text field.
 */
export interface DbxForgeWebsiteUrlFieldProps extends Omit<MatInputProps, 'type'>, Partial<WebsiteUrlRelativePathFunctionsConfig> {
  /**
   * HTML input type. Defaults to `'text'`.
   */
  readonly type?: DbxForgeTextFieldInputType;
  /**
   * The value saved when a base url is configured.
   *
   * Defaults to `'url'`.
   */
  readonly valueMode?: DbxForgeWebsiteUrlFieldValueMode;
}

/**
 * Field definition type for a forge website url field.
 */
export type DbxForgeWebsiteUrlFieldDef = BaseValueField<DbxForgeWebsiteUrlFieldProps, string> & {
  readonly type: typeof FORGE_WEBSITE_URL_FIELD_TYPE;
} & DbxForgeFieldHintValueRef<DynamicText>;
