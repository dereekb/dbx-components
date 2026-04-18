import type { MatSliderField, MatSliderProps } from '@ng-forge/dynamic-forms-material';
import { configureDbxForgeFormFieldWrapper, type DbxForgeFormFieldWrapperDef } from '../../wrapper/formfield/formfield.wrapper';
import { DbxForgeFieldFunction, DbxForgeFieldFunctionDef, dbxForgeBuildFieldDef, dbxForgeFieldFunction, dbxForgeFieldFunctionConfigPropsWithHintBuilder } from '../../field';

// MARK: Number Slider Field
/**
 * Configuration for a forge Material slider field.
 */
export interface DbxForgeNumberSliderFieldConfig extends DbxForgeFieldFunctionDef<MatSliderField> {
  /**
   * Whether or not to show the thumb label while sliding.
   *
   * Defaults to true.
   */
  readonly thumbLabel?: boolean;
  /**
   * Tick interval. If not provided defaults to the step value, if provided.
   * If false, the ticks are disabled.
   */
  readonly tickInterval?: false | number;
}

/**
 * Creates a forge field definition for a Material slider wrapped in a form-field wrapper.
 *
 * The wrapper provides the Material outlined form-field appearance (notched outline with
 * floating label, hint/error subscript). The inner slider uses the ng-forge built-in
 * `slider` type. The wrapper key uses `_` prefix so `stripForgeInternalKeys` flattens
 * the child slider's value into the parent form.
 *
 * @param config - Slider field configuration including max (required), thumb label, and tick interval
 * @returns A {@link DbxForgeFormFieldWrapperDef} wrapping a slider field
 *
 * @example
 * ```typescript
 * const field = forgeNumberSliderField({ key: 'rating', label: 'Rating', min: 0, max: 10, step: 1 });
 * ```
 */
export const forgeNumberSliderField = dbxForgeFieldFunction<DbxForgeNumberSliderFieldConfig>({
  type: 'slider' as const,
  buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder((config) => {
    const { step, thumbLabel: inputThumbLabel, tickInterval: inputTickInterval } = config;
    let tickIntervalFromSteps: number | undefined;

    if (step) {
      tickIntervalFromSteps = 1;
    }

    const tickInterval: number | undefined = inputTickInterval === false ? undefined : (inputTickInterval ?? tickIntervalFromSteps ?? undefined);

    // Create the inner slider using ng-forge built-in 'slider' type.
    // Label and hint are omitted here — the wrapper provides those.
    const sliderProps: Partial<MatSliderProps> = {
      step,
      thumbLabel: inputThumbLabel ?? true,
      tickInterval
    };

    return sliderProps;
  }),
  buildFieldDef: dbxForgeBuildFieldDef((x, config) => {
    // configure form field wrapper
    x.configure(configureDbxForgeFormFieldWrapper);
  })
}) as DbxForgeFieldFunction<DbxForgeNumberSliderFieldConfig, MatSliderField>;
