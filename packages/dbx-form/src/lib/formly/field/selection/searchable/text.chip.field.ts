import { of } from 'rxjs';
import { type LabeledFieldConfig } from '../../field';
import { type SearchableValueFieldValue } from './searchable';
import { searchableChipField } from './searchable.field';
import { type StringValueFieldsFieldProps } from './searchable.field.directive';

/**
 * Configuration for a plain text chip field that allows freeform string entry.
 */
export interface ChipTextFieldConfig extends LabeledFieldConfig, StringValueFieldsFieldProps {
  /**
   * Whether text values are case-sensitive. Defaults to false (lowercased).
   */
  caseSensitive?: boolean;
}

/**
 * Creates a searchable chip field for freeform text entry where each entered string
 * becomes a chip. Values are lowercased by default unless `caseSensitive` is true.
 *
 * @param config - Text chip field configuration
 * @returns A {@link FormlyFieldConfig} for text chip input
 *
 * @example
 * ```typescript
 * const field = chipTextField({ key: 'tags', label: 'Tags' });
 * ```
 */
export function chipTextField(config: ChipTextFieldConfig) {
  const convertStringValue = config.caseSensitive ? (x: string) => x : (x: string) => x?.toLowerCase();

  return searchableChipField({
    search: () => of([]), // no search by default
    ...config,
    allowStringValues: true,
    convertStringValue,
    displayForValue: (values: SearchableValueFieldValue<string>[]) => {
      return of(values.map((x) => ({ ...x, label: x.value })));
    }
  });
}
