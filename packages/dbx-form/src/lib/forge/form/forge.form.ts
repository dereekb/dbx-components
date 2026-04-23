import { type FieldDef, type FormConfig, type RegisteredFieldTypes } from '@ng-forge/dynamic-forms';
import { filterMaybeArrayValues, filterUndefinedValues, filterUniqueValues, type Maybe } from '@dereekb/util';

// MARK: DbxForgeField
/**
 * A FieldDef that has been augmented with @dereekb/dbx-form specific properties that are passed to a dbx-forge form.
 */
export type DbxForgeField<F extends FieldDef<any>> = F & {
  /**
   * Form-level configuration that was generated at a field level.
   *
   * This is read by dbx-forge when importing configuration and is merged into the input FormConfig.
   */
  readonly _formConfig?: Maybe<DbxForgeFieldFormConfig>;
};

/**
 * Contains a reference to hidden sister fields.
 */
export interface DbxForgeFieldHiddenFieldsRef {
  readonly _hiddenFields?: (FieldDef<any> & { hidden: true })[];
}

/**
 * Form-level configuration that was generated at a field level.
 */
export interface DbxForgeFieldFormConfig extends Partial<Pick<FormConfig, 'schemas' | 'externalData' | 'customFnConfig' | 'defaultValidationMessages'>>, DbxForgeFieldHiddenFieldsRef {}

/**
 * Merges multiple field-level form configs into a single config, layering later inputs on top
 * of earlier ones for `externalData`, `customFnConfig`, and `defaultValidationMessages`, while
 * concatenating `schemas`.
 *
 * Keys whose merged value is empty are dropped from the result (no empty `{}` or `[]` fields).
 *
 * @param input - field form configs to merge, from lowest to highest priority
 * @returns a merged config with only populated fields retained
 */
export function mergeDbxForgeFieldFormConfig(...input: DbxForgeFieldFormConfig[]): DbxForgeFieldFormConfig {
  const schemas: NonNullable<FormConfig['schemas']> = [];
  const externalData: NonNullable<FormConfig['externalData']> = {};
  const customFnConfig: NonNullable<FormConfig['customFnConfig']> = {};
  const defaultValidationMessages: NonNullable<FormConfig['defaultValidationMessages']> = {};

  input.forEach((fieldFormConfig) => {
    if (fieldFormConfig.schemas) {
      schemas.push(...fieldFormConfig.schemas);
    }

    if (fieldFormConfig.externalData) {
      Object.assign(externalData, fieldFormConfig.externalData);
    }

    if (fieldFormConfig.customFnConfig) {
      mergeCustomFnConfigInto(customFnConfig, fieldFormConfig.customFnConfig);
    }

    if (fieldFormConfig.defaultValidationMessages) {
      Object.assign(defaultValidationMessages, fieldFormConfig.defaultValidationMessages);
    }
  });

  const result: DbxForgeFieldFormConfig = filterUndefinedValues({
    schemas: schemas.length > 0 ? schemas : undefined,
    externalData: Object.keys(externalData).length > 0 ? externalData : undefined,
    customFnConfig: Object.keys(customFnConfig).length > 0 ? customFnConfig : undefined,
    defaultValidationMessages: Object.keys(defaultValidationMessages).length > 0 ? defaultValidationMessages : undefined
  });

  return result;
}

// MARK: CustomFnConfig
const CUSTOM_FN_CONFIG_KEYS: (keyof NonNullable<FormConfig['customFnConfig']>)[] = ['customFunctions', 'derivations', 'asyncDerivations', 'asyncConditions', 'validators', 'asyncValidators', 'httpValidators'];

/**
 * Produces a shallow copy of a `FormConfig.customFnConfig` that clones each inner bucket
 * (validators, derivations, etc.) so downstream merges can mutate the result without
 * leaking writes back to the original form config.
 *
 * @param input - the customFnConfig to copy, or undefined
 * @returns a new customFnConfig containing only the known buckets, each one a fresh object
 */
export function copyFormConfigCustomFnConfig(input: FormConfig['customFnConfig']): FormConfig['customFnConfig'] {
  const customFnConfig: FormConfig['customFnConfig'] = {};

  for (const key of CUSTOM_FN_CONFIG_KEYS) {
    const value = input?.[key];

    if (value) {
      (customFnConfig as any)[key] = { ...value };
    }
  }

  return customFnConfig;
}

function mergeCustomFnConfigInto(target: FormConfig['customFnConfig'], source: FormConfig['customFnConfig']): void {
  for (const key of CUSTOM_FN_CONFIG_KEYS) {
    const sourceValue = source?.[key];

    if (sourceValue) {
      (target as any)[key] = { ...(target as any)?.[key], ...sourceValue };
    }
  }
}

// MARK: Form Config
export interface DbxForgeGlobalFormConfigDefaults extends Pick<FormConfig, 'defaultValidationMessages'> {}

export interface DbxForgeFinalizeFormConfigResult {
  /**
   * The input config that was used to generate the field configs.
   */
  readonly input: FormConfig;
  /**
   * The field configs that were extracted from the input's fields.
   */
  readonly extractedFieldFormConfigs: DbxForgeFieldFormConfig[];
  /**
   * The final output config.
   */
  readonly config: FormConfig;
}

/**
 * Finalizes a `FormConfig` for consumption by dbx-forge by pulling field-level `_formConfig`
 * values up to the form level and appending any `_hiddenFields` so they participate in
 * validation and value wiring without being rendered.
 *
 * Layering order (lowest to highest priority): `globalDefaults`, the input form's own config,
 * then each field's `_formConfig` in field order — so a later field can override an earlier
 * field's default validation message.
 *
 * @param input - the FormConfig authored by the caller
 * @param globalDefaults - seed values for workspace-wide defaults (e.g. validation messages)
 * @returns the original input, the extracted field form configs, and the finalized config
 */
export function dbxForgeFinalizeFormConfig(input: FormConfig, globalDefaults?: DbxForgeGlobalFormConfigDefaults): DbxForgeFinalizeFormConfigResult {
  const { fields } = input;

  /**
   * Extract all the values from the fields that are of type DbxForgeFieldFormConfig.
   */
  const extractedFieldFormConfigs: DbxForgeFieldFormConfig[] = filterMaybeArrayValues(fields.map((x: DbxForgeField<FieldDef<any>>) => x._formConfig));

  const globalDefaultsLayer: DbxForgeFieldFormConfig = globalDefaults ? { defaultValidationMessages: globalDefaults.defaultValidationMessages } : {};
  const merged = mergeDbxForgeFieldFormConfig(globalDefaultsLayer, { schemas: input.schemas, externalData: input.externalData, customFnConfig: copyFormConfigCustomFnConfig(input.customFnConfig ?? {}), defaultValidationMessages: input.defaultValidationMessages }, ...extractedFieldFormConfigs);

  // Extract hidden fields from field-level _hiddenFields and _formConfig._hiddenFields
  const hiddenFields: RegisteredFieldTypes[] = [];

  for (const field of fields as DbxForgeField<FieldDef<any>>[]) {
    if (field._formConfig?._hiddenFields) {
      field._formConfig._hiddenFields.forEach((x) => {
        hiddenFields.push(x as RegisteredFieldTypes);
      });
    }
  }

  const config = {
    ...input,
    fields: hiddenFields.length > 0 ? [...fields, ...hiddenFields] : fields,
    schemas: merged.schemas ? filterUniqueValues(merged.schemas, (x) => x.name) : input.schemas,
    externalData: merged.externalData ?? input.externalData,
    customFnConfig: merged.customFnConfig ?? input.customFnConfig,
    defaultValidationMessages: merged.defaultValidationMessages ?? input.defaultValidationMessages
  };

  return {
    input,
    extractedFieldFormConfigs: extractedFieldFormConfigs,
    config
  };
}
