// TODO: Implement forge text editor field factory.
// Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms to support
// rich text editing, mirroring formlyTextEditorField.

import type { ForgeTextFieldLengthConfig } from '../value/text/text.field';

/**
 * Configuration for a forge rich text editor field.
 *
 * Not yet implemented. Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms.
 */
export interface ForgeTextEditorFieldConfig extends ForgeTextFieldLengthConfig {
  readonly key: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly description?: string;
}

/**
 * Creates a forge field definition for a rich text editor.
 *
 * @throws Error - Not yet implemented. Requires a custom ValueFieldComponent.
 *
 * @example
 * ```typescript
 * // Future usage:
 * // const field = forgeTextEditorField({ key: 'bio', label: 'Biography', maxLength: 2000 });
 * ```
 */
export function forgeTextEditorField(_config: ForgeTextEditorFieldConfig): never {
  throw new Error('forgeTextEditorField is not yet implemented. Requires a custom ValueFieldComponent for @ng-forge/dynamic-forms.');
}
