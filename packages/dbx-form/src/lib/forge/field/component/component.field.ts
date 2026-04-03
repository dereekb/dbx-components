// TODO: Implement forge component field factory.
// Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms to support
// embedding arbitrary Angular components as form fields, mirroring formlyComponentField.

/**
 * Placeholder for forge component field configuration.
 *
 * Not yet implemented. Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms.
 */
export interface ForgeComponentFieldConfig {
  readonly key?: string;
  readonly label?: string;
}

/**
 * Creates a forge field definition that renders a custom Angular component.
 *
 * @throws Error - Not yet implemented. Requires a custom ValueFieldComponent.
 *
 * @example
 * ```typescript
 * // Future usage:
 * // const field = forgeComponentField({ componentClass: MyCustomFormComponent });
 * ```
 */
export function forgeComponentField(_config: ForgeComponentFieldConfig): never {
  throw new Error('forgeComponentField is not yet implemented. Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms.');
}
