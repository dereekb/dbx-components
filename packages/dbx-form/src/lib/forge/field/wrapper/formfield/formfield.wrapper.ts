import { type DynamicText } from '@ng-forge/dynamic-forms';
import { type DbxForgeFieldFunctionDef, type DbxForgeFieldFunctionFieldDefBuilderFunctionInstance } from '../../field';

// MARK: Field Type
/**
 * Registered wrapper type name for the Material-style form-field wrapper.
 *
 * Used in {@link WrapperConfig.type} to identify this wrapper when building
 * wrapper chains via {@link dbxForgeMaterialFormFieldWrappedFieldFunction}.
 */
export const DBX_FORGE_FORM_FIELD_WRAPPER_NAME = 'dbx-forge-form-field-wrapper' as const;

// MARK: Props
/**
 * Where the form-field wrapper should render the field's primary label.
 *
 * - `'wrapper'` — render the label in the notched outline only (default).
 * - `'content'` — suppress the notch label so the inner field can render its own
 *   label (used by checkbox/toggle, whose Material elements render their label inline).
 * - `'both'` — render the label in the notch AND let the inner field render its own.
 * - `'none'` — render no label in the notch and rely solely on `contentLabel`.
 */
export type DbxForgeFormFieldWrapperShowLabelAt = 'wrapper' | 'content' | 'both' | 'none';

/**
 * Props for the form-field wrapper. Passed via `addWrappers({ type, props })`
 * and exposed to the wrapper component as a single `props` input.
 */
export interface DbxForgeFormFieldWrapperProps {
  /**
   * Optional label override for the notch.
   *
   * When set, this replaces the field's primary label inside the notched outline.
   * Has no effect when {@link showLabelAt} is `'content'` or `'none'`.
   */
  readonly label?: DynamicText;
}

/**
 * Marker interface for a wrapper config that targets the form-field wrapper.
 */
export interface DbxForgeFormFieldWrapperDef {
  readonly type: typeof DBX_FORGE_FORM_FIELD_WRAPPER_NAME;
  readonly props?: DbxForgeFormFieldWrapperProps;
}

// MARK: Configuration
/**
 * Adds the Material-style form-field wrapper ({@link DBX_FORGE_FORM_FIELD_WRAPPER_NAME}) to
 * the builder instance's wrapper chain so the rendered field is surrounded by the shared
 * label / hint / error chrome.
 *
 * @param instance - the field builder instance to mutate
 */
export function configureDbxForgeFormFieldWrapper<C extends DbxForgeFieldFunctionDef<any>>(instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C>): void {
  instance.addWrappers({
    type: DBX_FORGE_FORM_FIELD_WRAPPER_NAME
  });
}

/**
 * Returns a configurator that adds the form-field wrapper with the given props.
 *
 * Use this from a field factory's `buildFieldDef` step to attach the wrapper and
 * pass props (such as `showLabelAt` / `contentLabel`) through to the wrapper component.
 *
 * @param props - wrapper props applied to the inserted wrapper config
 * @returns a configurator that mutates the builder instance to add the wrapper
 */
export function configureDbxForgeFormFieldWrapperWith(props: DbxForgeFormFieldWrapperProps): <C extends DbxForgeFieldFunctionDef<any>>(instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C>) => void {
  return (instance) => {
    instance.addWrappers({
      type: DBX_FORGE_FORM_FIELD_WRAPPER_NAME,
      props
    });
  };
}
