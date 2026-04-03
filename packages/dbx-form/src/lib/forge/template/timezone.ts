// TODO: Implement forge timezone string field.
// Requires the forge searchable text field, which itself requires a custom
// ValueFieldComponent for @ng-forge/dynamic-forms.
//
// The formly equivalent uses searchableTextField with timezoneStringSearchFunction
// and FORMLY_DISPLAY_FOR_TIMEZONE_STRING_VALUE display function.

/**
 * Configuration for a forge timezone string field.
 *
 * Not yet implemented. Requires the forge searchable text field.
 */
export interface ForgeTimezoneStringFieldConfig {
  readonly key?: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge searchable field for selecting a timezone.
 *
 * @throws Error - Not yet implemented. Requires a forge searchable text field.
 *
 * @example
 * ```typescript
 * // Future usage:
 * // const field = forgeTimezoneStringField();
 * ```
 */
export function forgeTimezoneStringField(_config: ForgeTimezoneStringFieldConfig = {}): never {
  throw new Error('forgeTimezoneStringField is not yet implemented. Requires a forge searchable text field which needs a custom ValueFieldComponent for @ng-forge/dynamic-forms.');
}
