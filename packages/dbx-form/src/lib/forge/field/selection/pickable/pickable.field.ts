// TODO: Implement forge pickable field factories.
// Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms to support
// the pickable field patterns from formly.

/**
 * Placeholder for forge pickable field configuration.
 *
 * Not yet implemented. Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms.
 */
export interface ForgePickableFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge pickable field.
 *
 * @throws Error - Not yet implemented. Requires a custom ValueFieldComponent.
 */
export function forgePickableField(_config: ForgePickableFieldConfig): never {
  throw new Error('forgePickableField is not yet implemented. Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms.');
}
