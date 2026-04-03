// TODO: Implement forge searchable field factories.
// Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms to support
// the searchable chip and searchable text field patterns from formly.
//
// The formly equivalents are:
// - formlySearchableChipField (searchablechipfield)
// - formlySearchableTextField (searchabletextfield)
// - formlySearchableStringChipField
//
// These will need a custom @ng-forge/dynamic-forms ValueFieldComponent that wraps
// the existing DbxSearchableChipFieldComponent and DbxSearchableTextFieldComponent.

/**
 * Placeholder for forge searchable field configuration.
 *
 * Not yet implemented. Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms.
 */
export interface ForgeSearchableFieldConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge searchable text field.
 *
 * @throws Error - Not yet implemented. Requires a custom ValueFieldComponent.
 */
export function forgeSearchableTextField(_config: ForgeSearchableFieldConfig): never {
  throw new Error('forgeSearchableTextField is not yet implemented. Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms.');
}

/**
 * Creates a forge searchable chip field.
 *
 * @throws Error - Not yet implemented. Requires a custom ValueFieldComponent.
 */
export function forgeSearchableChipField(_config: ForgeSearchableFieldConfig): never {
  throw new Error('forgeSearchableChipField is not yet implemented. Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms.');
}
