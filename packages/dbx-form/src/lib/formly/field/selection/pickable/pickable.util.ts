import { caseInsensitiveFilterByIndexOfDecisionFactory, LabeledValue, Maybe, SearchStringFilterFunction, searchStringFilterFunction, sortByStringFunction } from '@dereekb/util';
import { Observable, of } from 'rxjs';
import { PickableValueFieldDisplayValue, PickableValueFieldValue } from './pickable';
import { PickableItemFieldItem, PickableValueFieldsFieldProps } from './pickable.field.directive';

export const filterPickableItemFieldValuesByLabelFilterFunction: SearchStringFilterFunction<PickableValueFieldDisplayValue<any>> = searchStringFilterFunction({
  readStrings: (x) => [x.label],
  decisionFactory: caseInsensitiveFilterByIndexOfDecisionFactory
});

export function filterPickableItemFieldValuesByLabel<T>(filterText: Maybe<string>, values: PickableValueFieldDisplayValue<T>[]): Observable<T[]> {
  let filteredValues: PickableValueFieldDisplayValue<T>[];

  if (filterText) {
    filteredValues = filterPickableItemFieldValuesByLabelFilterFunction(filterText, values);
  } else {
    filteredValues = values;
  }

  return of(filteredValues.map((x) => x.value));
}

export const sortPickableItemsByLabelStringFunction = sortByStringFunction<PickableItemFieldItem<any>>((x) => x.itemValue.label);

export function sortPickableItemsByLabel<T>(chips: PickableItemFieldItem<T>[]): PickableItemFieldItem<T>[] {
  return chips.sort(sortPickableItemsByLabelStringFunction);
}

// MARK: PickableValueFieldValuesConfigForStaticLabeledValues
export type PickableValueFieldValuesConfigForStaticLabeledValues<T, M extends LabeledValue<T>> = Pick<PickableValueFieldsFieldProps<T, M>, 'loadValues' | 'displayForValue' | 'filterValues'>;

export interface PickableValueFieldValuesConfigForStaticLabeledValuesConfig<T, M extends LabeledValue<T>> {
  readonly allOptions: M[];
  readonly unknownOptionLabel?: string;
}

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
