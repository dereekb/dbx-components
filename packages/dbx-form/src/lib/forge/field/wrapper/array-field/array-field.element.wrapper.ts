import { DbxForgeArrayFieldWrapperProps } from './array-field.wrapper';

/**
 * Index pair passed to the {@link DbxForgeArrayFieldWrapperProps.labelForField} factory.
 */
export interface DbxForgeArrayItemPair {
  readonly index: number;
}

/**
 * Props for the dbx-forge-array-field-element wrapper.
 *
 * Passed via the wrapper config's `props` field.
 */
export interface DbxForgeArrayFieldElementWrapperProps<T = unknown> extends DbxForgeArrayFieldWrapperProps<T> {
  /**
   * Key of the parent array field. Used to dispatch array events.
   */
  readonly arrayKey: string;
  /**
   * Index of the element within the array.
   */
  readonly index: number;
}

export const DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME = 'dbx-forge-array-field-element-wrapper' as const;

export interface DbxForgeArrayFieldElementWrapperDef<T = unknown> {
  readonly type: typeof DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME;
  readonly props?: DbxForgeArrayFieldElementWrapperProps<T>;
}
