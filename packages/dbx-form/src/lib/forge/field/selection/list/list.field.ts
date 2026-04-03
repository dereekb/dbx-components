// TODO: Implement forge list selection field factories.
// Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms to support
// the list selection field patterns from formly.

/**
 * Placeholder for forge list selection field configuration.
 *
 * Not yet implemented. Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms.
 */
export interface ForgeListSelectionFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge list selection field.
 *
 * @throws Error - Not yet implemented. Requires a custom ValueFieldComponent.
 */
export function forgeListSelectionField(_config: ForgeListSelectionFieldConfig): never {
  throw new Error('forgeListSelectionField is not yet implemented. Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms.');
}
