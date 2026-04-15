import type { AsyncCustomValidator, WrapperField } from '@ng-forge/dynamic-forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { type Observable, of } from 'rxjs';
import { forgeTextField, type DbxForgeTextFieldConfig } from '../field/value/text/text.field';
import { forgeWorkingFieldWrapper } from '../field/wrapper/working/working.wrapper';

// MARK: Validator
/**
 * The default validator name used in the field's validators array and the customFnConfig registration.
 */
export const FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME = 'fieldValueIsAvailable';

/**
 * Function that checks whether a value is available.
 *
 * @returns An observable that emits `true` if the value is available, `false` otherwise.
 */
export type DbxForgeFieldValueIsAvailableCheckFn<T> = (value: T) => Observable<boolean>;

/**
 * Configuration for the forge field-value-is-available async validator.
 */
export interface DbxForgeFieldValueIsAvailableValidatorConfig<T> {
  /**
   * Function that checks whether the entered value is available.
   */
  readonly checkValueIsAvailable: DbxForgeFieldValueIsAvailableCheckFn<T>;
  /**
   * Custom error message displayed when the value is not available.
   *
   * Defaults to 'This value is not available.'.
   */
  readonly isNotAvailableErrorMessage?: string;
  /**
   * Optional custom validator name. Defaults to {@link FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME}.
   *
   * Useful when multiple availability fields exist in the same form to avoid name collisions.
   */
  readonly validatorName?: string;
  /**
   * Optional throttle delay in milliseconds between availability checks.
   */
  readonly throttle?: number;
}

/**
 * Internal params shape for the availability-check rxResource.
 */
interface DbxForgeAvailabilityCheckParams {
  readonly value: unknown;
}

/**
 * Result from {@link forgeFieldValueIsAvailableValidator}.
 *
 * Contains the async validator and its validation messages, ready to be spread
 * into a FormConfig's `customFnConfig.asyncValidators` and `defaultValidationMessages`.
 */
export interface DbxForgeFieldValueIsAvailableValidatorResult {
  /**
   * The validator name used to reference this validator in field configs.
   */
  readonly validatorName: string;
  /**
   * Async validators map to spread into `customFnConfig.asyncValidators`.
   */
  readonly asyncValidators: Record<string, AsyncCustomValidator>;
  /**
   * Validation messages map to spread into `defaultValidationMessages`.
   */
  readonly validationMessages: Record<string, string>;
}

/**
 * Creates a forge async validator that checks whether a field value is available.
 *
 * This is the forge equivalent of {@link fieldValueIsAvailableValidator}. It creates
 * an ng-forge `AsyncCustomValidator` that uses `rxResource` to bridge the Observable-based
 * check function to ng-forge's resource-based validation system.
 *
 * @param config - Configuration for the availability check.
 * @returns A {@link DbxForgeFieldValueIsAvailableValidatorResult} containing the validator and messages.
 *
 * @example
 * ```typescript
 * const validator = forgeFieldValueIsAvailableValidator({
 *   checkValueIsAvailable: (value) => userService.isAvailable(value),
 *   isNotAvailableErrorMessage: 'Username is already taken'
 * });
 *
 * const formConfig: FormConfig = {
 *   fields: [myField],
 *   customFnConfig: { asyncValidators: validator.asyncValidators },
 *   defaultValidationMessages: validator.validationMessages
 * };
 * ```
 */
export function forgeFieldValueIsAvailableValidator<T>(config: DbxForgeFieldValueIsAvailableValidatorConfig<T>): DbxForgeFieldValueIsAvailableValidatorResult {
  const { checkValueIsAvailable, isNotAvailableErrorMessage = 'This value is not available.', validatorName = FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME, throttle: _throttle } = config;

  const asyncValidator: AsyncCustomValidator = {
    params: (ctx): DbxForgeAvailabilityCheckParams => ({ value: ctx.value() }),
    factory: (paramsSignal) => {
      return rxResource<boolean, DbxForgeAvailabilityCheckParams>({
        params: () => paramsSignal() as DbxForgeAvailabilityCheckParams,
        stream: ({ params }) => {
          if (!params.value) {
            return of(true);
          }

          return checkValueIsAvailable(params.value as T);
        }
      });
    },
    onSuccess: (result) => {
      if (result === false) {
        return { kind: validatorName };
      }

      return null;
    },
    onError: () => null
  };

  return {
    validatorName,
    asyncValidators: { [validatorName]: asyncValidator },
    validationMessages: { [validatorName]: isNotAvailableErrorMessage }
  };
}

// MARK: Text Field
/**
 * Configuration for a forge text field that includes an async availability check.
 */
export interface DbxForgeTextAvailableFieldConfig extends DbxForgeTextFieldConfig, Omit<DbxForgeFieldValueIsAvailableValidatorConfig<string>, 'checkValueIsAvailable'> {
  /**
   * Function that checks whether the entered value is available.
   */
  readonly checkValueIsAvailable: DbxForgeFieldValueIsAvailableCheckFn<string>;
}

/**
 * Result from {@link forgeTextIsAvailableField}.
 *
 * Contains the wrapped field definition and the async validator config that must
 * be registered in the FormConfig.
 *
 * @example
 * ```typescript
 * const available = forgeTextIsAvailableField({
 *   key: 'username',
 *   label: 'Username',
 *   checkValueIsAvailable: (value) => myService.checkAvailable(value),
 *   isNotAvailableErrorMessage: 'Username is already taken'
 * });
 *
 * const formConfig: FormConfig = {
 *   fields: [available.field],
 *   customFnConfig: {
 *     asyncValidators: available.asyncValidators
 *   },
 *   defaultValidationMessages: available.validationMessages
 * };
 * ```
 */
export interface DbxForgeTextIsAvailableFieldResult {
  /**
   * The text field wrapped in a working wrapper, with the async validator reference attached.
   */
  readonly field: WrapperField;
  /**
   * Async validators map to spread into `customFnConfig.asyncValidators`.
   */
  readonly asyncValidators: Record<string, AsyncCustomValidator>;
  /**
   * Validation messages map to spread into `defaultValidationMessages`.
   */
  readonly validationMessages: Record<string, string>;
}

/**
 * Creates a forge text field with an async availability validator, wrapped in a working wrapper.
 *
 * This is the forge equivalent of {@link formlyTextIsAvailableField}. It:
 * 1. Creates a text field from the config
 * 2. Attaches an async availability validator via {@link forgeFieldValueIsAvailableValidator}
 * 3. Wraps the field with {@link forgeWorkingFieldWrapper} to show a loading indicator
 *
 * The result includes the wrapped field and the validator registration that must be
 * added to the FormConfig.
 *
 * @param config - Configuration for the text field and availability validation.
 * @returns A {@link DbxForgeTextIsAvailableFieldResult} containing the field and validator config.
 *
 * @example
 * ```typescript
 * const available = forgeTextIsAvailableField({
 *   key: 'username',
 *   label: 'Username',
 *   checkValueIsAvailable: (value) => userService.isAvailable(value),
 *   isNotAvailableErrorMessage: 'Username is already taken'
 * });
 *
 * const formConfig: FormConfig = {
 *   fields: [available.field, ...otherFields],
 *   customFnConfig: {
 *     asyncValidators: { ...available.asyncValidators }
 *   },
 *   defaultValidationMessages: { ...available.validationMessages }
 * };
 * ```
 */
export function forgeTextIsAvailableField(config: DbxForgeTextAvailableFieldConfig): DbxForgeTextIsAvailableFieldResult {
  const { checkValueIsAvailable, isNotAvailableErrorMessage, validatorName, throttle, ...textConfig } = config;

  const textField = forgeTextField(textConfig);
  const validator = forgeFieldValueIsAvailableValidator({ checkValueIsAvailable, isNotAvailableErrorMessage, validatorName, throttle });

  // Add the async validator reference to the field
  const existingValidators = (textField as any).validators ?? [];
  (textField as any).validators = [...existingValidators, { type: 'async' as const, functionName: validator.validatorName }];

  // Wrap with working wrapper to show loading indicator during async check
  const field = forgeWorkingFieldWrapper({ fields: [textField] });

  return {
    field,
    asyncValidators: validator.asyncValidators,
    validationMessages: validator.validationMessages
  };
}
