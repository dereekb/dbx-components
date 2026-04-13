import type { BaseValueField, FormConfig, TextField } from '@ng-forge/dynamic-forms';
import type { MatInputField, MatInputProps, MatTextareaField, MatTextareaProps } from '@ng-forge/dynamic-forms-material';
import { transformStringFunction, mapMaybeFunction, type TransformStringFunctionConfig, type TransformStringFunctionConfigRef } from '@dereekb/util';
import type { FieldValueParser, FieldConfigParsersRef } from '../../../../field';
import type { FieldAutocompleteAttributeOptionRef } from '../../../../field/field.autocomplete';
import { dbxForgeFieldFunction, dbxForgeBuildFieldDef, dbxForgeFieldFunctionConfigPropsWithHintBuilder, type DbxForgeFieldFunctionDef, DbxForgeFieldHintValueRef, DbxForgeFieldFunction } from '../../field';
import { configureForgeAutocompleteFieldMeta } from '../../field.util.meta';
import { dbxForgeDefaultValidationMessages } from '../../../validation';

// MARK: Text Field
/**
 * Configuration for minimum and maximum text length constraints.
 */
export interface DbxForgeTextFieldLengthConfig {
  readonly minLength?: number;
  readonly maxLength?: number;
}

/**
 * Configuration for regex pattern validation on a text field.
 */
export interface DbxForgeTextFieldPatternConfig {
  readonly pattern?: string | RegExp;
}

/**
 * We use this for DbxForgeNumberFieldConfig since MatInputField is a union type for both string and number input.
 */
type DbxForgeTextFieldDef = BaseValueField<Omit<MatInputProps, 'type'> & { type?: DbxForgeTextFieldInputType }, string> & { type: 'input' };

/**
 * HTML input type for a text field.
 */
export type DbxForgeTextFieldInputType = 'text' | 'password' | 'email';

/**
 * Full configuration for a single-line text input field in forge.
 *
 * Combines labeling, validation (pattern, length), and string transformation
 * into one config object.
 */
export interface DbxForgeTextFieldConfig extends DbxForgeFieldFunctionDef<DbxForgeTextFieldDef>, FieldAutocompleteAttributeOptionRef, Partial<TransformStringFunctionConfigRef> {
  /**
   * HTML input type. Defaults to `'text'`.
   */
  readonly inputType?: DbxForgeTextFieldInputType;
  /**(alias) type MatInputField = NumberInputField<MatInputProps> | StringInputField<MatInputProps>

   * String transformation applied as a value parser (e.g., trim, uppercase).
   */
  readonly transform?: TransformStringFunctionConfig;
  readonly defaultValue?: string;
}

/**
 * Builds an array of value parsers for a text field, incorporating any configured
 * string transformation (e.g., trim, lowercase) as a parser prepended to existing parsers.
 *
 * @param config - Parser and transform configuration
 * @returns Array of value parsers, or undefined if none configured
 *
 * @example
 * ```typescript
 * const parsers = forgeTextFieldTransformParser({ transform: { trim: true, toLowercase: true } });
 * ```
 */
export function forgeTextFieldTransformParser(config: Partial<FieldConfigParsersRef> & Partial<TransformStringFunctionConfigRef>): FieldValueParser[] | undefined {
  const { parsers: inputParsers, transform } = config;
  let parsers: FieldValueParser[] | undefined;

  if (inputParsers) {
    parsers = inputParsers;
  }

  if (transform) {
    const transformParser: FieldValueParser = mapMaybeFunction(transformStringFunction(transform));
    const existing = parsers ?? [];
    parsers = [transformParser, ...existing];
  }

  return parsers;
}

/**
 * Creates a forge field definition for a single-line text input.
 *
 * @param config - Text field configuration including key, label, validation, and transform options
 * @returns A text input field with type `'input'`
 *
 * @example
 * ```typescript
 * const field = forgeTextField({
    key: 'email',
    label: 'Email',`
    required: true,
    email: true,
    props: {
      type: 'email',              // 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'
      placeholder: 'user@example.com',
    }
  });
 * ```
 */
export const forgeTextField = dbxForgeFieldFunction<DbxForgeTextFieldConfig>({
  type: 'input',
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder(),
  buildFieldDef: dbxForgeBuildFieldDef((x, config) => {
    const { inputType } = config;

    /*
    config.logic = [{
      type: 'derivation',
      functionName: ''
    }];

    const formLogic: FormConfig = {
      fields: [
        {
          key: 'tax',
          type: 'input',
          readonly: true,
          logic: [{
            type: 'derivation',
            functionName: 'calculateTax',
            dependsOn: ['subtotal', 'state'],
          }],
        },
      ],
      customFnConfig: {
        derivations: {
          calculateTax: (ctx: any) => ctx.formValue.subtotal * ctx.formValue.state
        },
      },
    } as const satisfies FormConfig;
    */

    x.addLogic([
      {
        type: 'derivation',
        fn: (x) => forgeTextFieldTransformParser(config), // TODO: ..
        dependsOnSelf: true // is attaxched to _formConfig otherwise
      },
      {
        type: 'derivation',
        source: 'asyncFunction',
        fn: async (ctx) => {
          return Promise.resolve(100);
        }
      }
      /*
      {
        type: 'derivation',
        source: 'asyncFunction',
        // asyncFunctionName: 'lookupCity',
        fn: async (ctx) => {
          return Promise.resolve(100);
        }
      },
      */
      /*
      {
        type: 'derivation',
        source: 'http',
        http: {
          url: '/api/exchange-rate',
          method: 'GET',
          queryParams: {
            from: 'formValue.sourceCurrency',
            to: 'formValue.targetCurrency',
          },
        },
        responseExpression: 'response.rate',
        dependsOn: ['sourceCurrency', 'targetCurrency'],
      }
        */
    ]);

    // configure autocomplete
    x.configure(configureForgeAutocompleteFieldMeta);

    // TODO: Based on the inputType, configure the props/etc.

    // convert RegExp pattern to string
    /*
    if (config.pattern instanceof RegExp) {
      (config as any).pattern = config.pattern.source;
    }
    */

    // add default validation messages
    x.addValidation({
      validationMessages: dbxForgeDefaultValidationMessages()
    });
  })
}) as DbxForgeFieldFunction<DbxForgeTextFieldConfig, MatInputField>;

// MARK: TextArea Field
/**
 * Configuration for a multi-line textarea input field in forge.
 */
export interface DbxForgeTextAreaFieldConfig extends DbxForgeFieldFunctionDef<MatTextareaField>, FieldAutocompleteAttributeOptionRef, Partial<TransformStringFunctionConfigRef> {
  /**
   * Number of visible text rows. Defaults to 3.
   */
  readonly rows?: number;
  readonly defaultValue?: string;
}

/**
 * Creates a forge field definition for a multi-line textarea input.
 *
 * @param config - Textarea field configuration including key, label, rows, and validation options
 * @returns A textarea field with type `'textarea'`
 *
 * @example
 * ```typescript
 * const field = forgeTextAreaField({ key: 'bio', label: 'Biography', rows: 5, maxLength: 500 });
 * ```
 */
export const forgeTextAreaField = dbxForgeFieldFunction<DbxForgeTextAreaFieldConfig>({
  type: 'textarea' as const,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder((input) => ({
    rows: input.rows ?? 3
  })),
  buildFieldDef: dbxForgeBuildFieldDef((x, config) => {
    // configure autocomplete
    x.configure(configureForgeAutocompleteFieldMeta);

    // set defaults
    if (config.label == null) {
      (config as any).label = '';
    }

    if (config.value == null) {
      (config as any).value = config['defaultValue'] ?? '';
    }

    // convert RegExp pattern to string
    if (config.pattern instanceof RegExp) {
      (config as any).pattern = config.pattern.source;
    }

    // add default validation messages
    x.addValidation({
      validationMessages: dbxForgeDefaultValidationMessages()
    });
  })
});
