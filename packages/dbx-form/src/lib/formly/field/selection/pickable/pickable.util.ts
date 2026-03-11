import { caseInsensitiveFilterByIndexOfDecisionFactory, type LabeledValue, type Maybe, type SearchStringFilterFunction, searchStringFilterFunction, sortByStringFunction } from '@dereekb/util';
import { type Observable, of } from 'rxjs';
import { type PickableValueFieldDisplayValue, type PickableValueFieldValue } from './pickable';
import { type PickableItemFieldItem, type PickableValueFieldsFieldProps } from './pickable.field.directive';

/** Case-insensitive filter function that matches pickable display values by their label using indexOf. */
export const filterPickableItemFieldValuesByLabelFilterFunction: SearchStringFilterFunction<PickableValueFieldDisplayValue<any>> = searchStringFilterFunction({
  readStrings: (x) => [x.label],
  decisionFactory: caseInsensitiveFilterByIndexOfDecisionFactory
});

/**
 * Filters pickable display values by label text, returning their underlying values.
 *
 * Returns all values when filter text is empty.
 *
 * @param filterText - Text to filter by
 * @param values - Display values to filter
 * @returns Observable emitting the filtered value array
 */
export function filterPickableItemFieldValuesByLabel<T>(filterText: Maybe<string>, values: PickableValueFieldDisplayValue<T>[]): Observable<T[]> {
  let filteredValues: PickableValueFieldDisplayValue<T>[];

  if (filterText) {
    filteredValues = filterPickableItemFieldValuesByLabelFilterFunction(filterText, values);
  } else {
    filteredValues = values;
  }

  return of(filteredValues.map((x) => x.value));
}

/** String sort comparator that orders pickable items alphabetically by label. */
export const sortPickableItemsByLabelStringFunction = sortByStringFunction<PickableItemFieldItem<any>>((x) => x.itemValue.label);

/**
 * Sorts pickable items alphabetically by their label.
 *
 * @param chips - Items to sort
 * @returns The sorted array (mutated in place)
 */
export function sortPickableItemsByLabel<T>(chips: PickableItemFieldItem<T>[]): PickableItemFieldItem<T>[] {
  return chips.sort(sortPickableItemsByLabelStringFunction);
}

// MARK: PickableValueFieldValuesConfigForStaticLabeledValues
/** Subset of {@link PickableValueFieldsFieldProps} needed for static labeled value configuration. */
export type PickableValueFieldValuesConfigForStaticLabeledValues<T, M extends LabeledValue<T>> = Pick<PickableValueFieldsFieldProps<T, M>, 'loadValues' | 'displayForValue' | 'filterValues'>;

/** Configuration for creating a pickable field from a static set of labeled values. */
export interface PickableValueFieldValuesConfigForStaticLabeledValuesConfig<T, M extends LabeledValue<T>> {
  readonly allOptions: M[];
  readonly unknownOptionLabel?: string;
}

/**
 * Creates `loadValues`, `displayForValue`, and `filterValues` functions from a static array of labeled values.
 *
 * Simplifies pickable field setup when all options are known upfront.
 *
 * @param input - Array of labeled values or a config object with options and unknown label
 * @returns Props subset for configuring a pickable field
 *
 * @example
 * ```typescript
 * const config = pickableValueFieldValuesConfigForStaticLabeledValues([
 *   { value: 'a', label: 'Option A' },
 *   { value: 'b', label: 'Option B' }
 * ]);
 * ```
 */
export function pickableValueFieldValuesConfigForStaticLabeledValues<T, M extends LabeledValue<T>>(input: M[] | PickableValueFieldValuesConfigForStaticLabeledValuesConfig<T, M>): PickableValueFieldValuesConfigForStaticLabeledValues<T, M> {
  const config = Array.isArray(input) ? { allOptions: input } : input;
  const { allOptions, unknownOptionLabel = 'UNKNOWN' } = config;
  const values: PickableValueFieldValue<T, M>[] = allOptions.map((meta) => ({ value: meta.value, meta }));
  const optionsMap = new Map(allOptions.map((x) => [x.value, x]));

  return {
    loadValues: () => of(values),
    filterValues: filterPickableItemFieldValuesByLabel, // auto filter by label
    displayForValue: (values: PickableValueFieldValue<T, M>[]) =>
      of(
        values.map((x) => {
          const meta = x.meta ?? optionsMap.get(x.value);
          return { ...x, meta, label: meta?.label ?? unknownOptionLabel };
        })
      )
  };
}
