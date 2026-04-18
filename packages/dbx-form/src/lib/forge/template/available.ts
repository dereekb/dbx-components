import type { AsyncCustomValidator } from '@ng-forge/dynamic-forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { type Observable, of } from 'rxjs';
import { forgeTextField, type DbxForgeTextFieldConfig } from '../field/value/text/text.field';
import type { DbxForgeField } from '../form/forge.form';
import type { MatInputField } from '@ng-forge/dynamic-forms-material';
import { DBX_FORGE_WORKING_WRAPPER_TYPE_NAME } from '../field';

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
 *
 * Includes the `checkValueIsAvailable` function passed via `ValidatorConfig.params`
 * so that a single reusable validator can serve multiple fields.
 */
interface DbxForgeAvailabilityCheckParams {
  readonly value: unknown;
  readonly checkValueIsAvailable?: DbxForgeFieldValueIsAvailableCheckFn<unknown>;
}

/**
 * Creates the reusable async validator for availability checks.
 *
 * This validator reads the `checkValueIsAvailable` function from
 * the `ValidatorConfig.params` at runtime, allowing a single registered function
 * to serve multiple fields with different check functions.
 */
function _createReusableAvailabilityValidator(): AsyncCustomValidator {
  return {
    params: (ctx, config): DbxForgeAvailabilityCheckParams => ({
      value: ctx.value(),
      checkValueIsAvailable: config?.['checkValueIsAvailable'] as DbxForgeFieldValueIsAvailableCheckFn<unknown> | undefined
    }),
    factory: (paramsSignal) => {
      return rxResource<boolean, DbxForgeAvailabilityCheckParams>({
        params: () => paramsSignal() as DbxForgeAvailabilityCheckParams,
        stream: ({ params }) => {
          if (!params.value || !params.checkValueIsAvailable) {
            return of(true);
          }

          return params.checkValueIsAvailable(params.value);
        }
      });
    },
    onSuccess: (result) => {
      if (result === false) {
        return { kind: FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME };
      }

      return null;
    },
    onError: () => null
  };
}

/**
 * Singleton reusable availability validator.
 *
 * Registered once per form via `reusableDefinition: true` and referenced by `functionName`.
 * Each field passes its own `checkValueIsAvailable` via `ValidatorConfig.params`.
 */
const _REUSABLE_AVAILABILITY_VALIDATOR = _createReusableAvailabilityValidator();

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
 * Creates a forge text field with an async availability validator.
 *
 * The validator function and validation messages are auto-registered into the field's `_formConfig`,
 * so callers using {@link dbxForgeFinalizeFormConfig} get everything wired automatically.
 *
 * @param config - Configuration for the text field and availability validation.
 * @returns A {@link DbxForgeField} text field with the validator and messages registered in `_formConfig`.
 *
 * @example
 * ```typescript
 * const field = forgeTextIsAvailableField({
 *   key: 'username',
 *   label: 'Username',
 *   checkValueIsAvailable: (value) => userService.isAvailable(value),
 *   isNotAvailableErrorMessage: 'Username is already taken'
 * });
 *
 * const formConfig = dbxForgeFinalizeFormConfig({
 *   fields: [field, ...otherFields]
 * }).config;
 * ```
 */
export function forgeTextIsAvailableField(config: DbxForgeTextAvailableFieldConfig): DbxForgeField<MatInputField> {
  const { checkValueIsAvailable, isNotAvailableErrorMessage = 'This value is not available.', validatorName = FORGE_FIELD_VALUE_IS_AVAILABLE_VALIDATOR_NAME, throttle: _throttle, ...textConfig } = config;

  return forgeTextField(textConfig, (x) => {
    x.addWrappers({
      type: DBX_FORGE_WORKING_WRAPPER_TYPE_NAME
    });

    x.addValidation({
      validators: [
        {
          type: 'async' as const,
          fn: _REUSABLE_AVAILABILITY_VALIDATOR,
          functionName: validatorName,
          reusableDefinition: true,
          params: {
            checkValueIsAvailable
          }
        }
      ],
      formValidationMessages: { [validatorName]: isNotAvailableErrorMessage }
    });
  }) as DbxForgeField<MatInputField>;
}
