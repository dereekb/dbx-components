// TODO: Implement forge source-select field factories.
// Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms to support
// the source-select field patterns from formly.

/**
 * Placeholder for forge source-select field configuration.
 *
 * Not yet implemented. Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms.
 */
export interface ForgeSourceSelectFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge source-select field.
 *
 * @throws Error - Not yet implemented. Requires a custom ValueFieldComponent.
 */
export function forgeSourceSelectField(_config: ForgeSourceSelectFieldConfig): never {
  throw new Error('forgeSourceSelectField is not yet implemented. Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms.');
}
