import { resource, type ResourceRef, type Signal } from '@angular/core';
import type { AsyncCustomValidator } from '@ng-forge/dynamic-forms';
import type { MatInputField } from '@ng-forge/dynamic-forms-material';
import { type Observable, firstValueFrom } from 'rxjs';
import { forgeTextField, type ForgeTextFieldConfig } from '../field/value/text/text.field';

/**
 * The default validator name used in the field's validators array and the customFnConfig registration.
 */
export const FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME = 'fieldValueIsAvailable';

/**
 * Function that checks whether a value is available.
 *
 * @returns An observable that emits `true` if the value is available, `false` otherwise.
 */
export type ForgeFieldValueIsAvailableCheckFn<T> = (value: T) => Observable<boolean>;

/**
 * Configuration for a forge text field that includes an async availability check.
 */
export interface ForgeTextAvailableFieldConfig extends ForgeTextFieldConfig {
  /**
   * Custom error message displayed when the value is not available.
   */
  readonly isNotAvailableErrorMessage?: string;
  /**
   * Function that checks whether the entered value is available.
   */
  readonly checkValueIsAvailable: ForgeFieldValueIsAvailableCheckFn<string>;
  /**
   * Optional throttle delay in milliseconds between availability checks.
   *
   * Note: ng-forge's resource API handles request cancellation automatically.
   */
  readonly throttle?: number;
  /**
   * Optional custom validator name. Defaults to {@link FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME}.
   *
   * Useful when multiple availability fields exist in the same form to avoid name collisions.
   */
  readonly validatorName?: string;
}

/**
 * Result from {@link forgeTextIsAvailableField}.
 *
 * Contains the field definition and the async validator that must be registered
 * in the FormConfig's `customFnConfig.asyncValidators`.
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
export interface ForgeTextIsAvailableFieldResult {
  /**
   * The text field definition with the async validator reference.
   */
  readonly field: MatInputField;
  /**
   * Async validators map to spread into `customFnConfig.asyncValidators`.
   */
  readonly asyncValidators: Record<string, AsyncCustomValidator<string, { value: string }, boolean>>;
  /**
   * Validation messages map to spread into `defaultValidationMessages`.
   */
  readonly validationMessages: Record<string, string>;
}

/**
 * Creates a forge text field with an async validator that checks whether the entered
 * value is available (e.g., for username availability checks).
 *
 * Unlike the formly equivalent, ng-forge uses a resource-based async validation pattern.
 * The result includes both the field definition and the async validator registration
 * that must be added to the FormConfig.
 *
 * @param config - Configuration for the text field and availability validation.
 * @returns A {@link ForgeTextIsAvailableFieldResult} containing the field and validator config.
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
export function forgeTextIsAvailableField(config: ForgeTextAvailableFieldConfig): ForgeTextIsAvailableFieldResult {
  const { checkValueIsAvailable, isNotAvailableErrorMessage = 'This value is not available.', validatorName = FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME, throttle: _throttle, ...textConfig } = config;

  const field = forgeTextField(textConfig);

  // Add the async validator reference to the field
  const existingValidators = (field as any).validators ?? [];
  (field as any).validators = [...existingValidators, { type: 'async' as const, functionName: validatorName }];

  // Create the ng-forge async validator using Angular's resource API
  const asyncValidator: AsyncCustomValidator<string, { value: string }, boolean> = {
    params: (ctx) => ({ value: ctx.value() }),
    factory: (paramsSignal: Signal<{ value: string } | undefined>): ResourceRef<boolean | undefined> => {
      return resource({
        params: () => paramsSignal(),
        loader: async ({ params }) => {
          if (!params?.value) {
            return true;
          }

          return firstValueFrom(checkValueIsAvailable(params.value));
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
    field,
    asyncValidators: { [validatorName]: asyncValidator },
    validationMessages: { [validatorName]: isNotAvailableErrorMessage }
  };
}
