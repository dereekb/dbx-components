import { makeMetaFilterSearchableFieldValueDisplayFn, SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue, SearchableValueFieldStringSearchFn, SearchableValueFieldValue } from '@dereekb/dbx-form';
import { randomDelayWithRandomFunction } from '@dereekb/rxjs';
import { randomArrayFactory, randomNumberFactory, pickOneRandomly, Configurable } from '@dereekb/util';
import { map, Observable, of } from 'rxjs';
import { DocFormExampleAccentSearchableFieldDisplayComponent, DocFormExamplePrimarySearchableFieldDisplayComponent, DocFormExampleWarnSearchableFieldDisplayComponent } from './selection.example.view';

export type DocFormExampleSelectionValueId = string;

export interface DocFormExampleSelectionValue {
  id: string;
  value: number;
}

export function MAKE_EXAMPLE_SELECTION_VALUE(id?: string) {
  const value = id ? Number(id) : Math.ceil(Math.random() * 1000000000);

  return {
    id: String(value),
    value
  };
}

export const MAKE_RANDOM_SELECTION_VALUES = randomArrayFactory({ random: { min: 12, max: 25 }, make: () => MAKE_EXAMPLE_SELECTION_VALUE() });

export function EXAMPLE_SEARCH_FOR_SELECTION_VALUE(minimumCharacters: number = 3): SearchableValueFieldStringSearchFn<DocFormExampleSelectionValueId, any> {
  const makeRandomDelay = randomNumberFactory(200); // use to show the loading bar.

  return (search: string = '') => {
    if (search.length >= minimumCharacters) {
      const result: SearchableValueFieldValue<DocFormExampleSelectionValueId>[] = MAKE_RANDOM_SELECTION_VALUES().map((x) => ({ meta: x, value: x.id }));
      return of(result).pipe(randomDelayWithRandomFunction(makeRandomDelay));
    } else {
      return of([]).pipe(randomDelayWithRandomFunction(makeRandomDelay));
    }
  };
}

export const EXAMPLE_DISPLAY_FOR_SELECTION_VALUE: SearchableValueFieldDisplayFn<DocFormExampleSelectionValueId, DocFormExampleSelectionValue> = makeMetaFilterSearchableFieldValueDisplayFn<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>({
  loadMetaForValues: (values) => {
    const valuesWithMeta = values.map((x) => ({ ...x, meta: MAKE_EXAMPLE_SELECTION_VALUE(x.value) }));
    return of(valuesWithMeta);
  },
  makeDisplayForValues: (values) => {
    const displayValues: SearchableValueFieldDisplayValue<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>[] = values.map((x) => ({ ...x, label: `Product: ${x.meta!.value}` }));
    const obs: Observable<SearchableValueFieldDisplayValue<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>[]> = of(displayValues);
    return obs;
  }
});

/**
 * Extends EXAMPLE_DISPLAY_FOR_SELECTION_VALUE by setting a custom display to each.
 *
 * @param values
 * @returns
 */
export const EXAMPLE_DISPLAY_FOR_SELECTION_VALUE_WITH_CUSTOM_DISPLAYS: SearchableValueFieldDisplayFn<DocFormExampleSelectionValueId, DocFormExampleSelectionValue> = (values) => {
  const possibleComponents = [DocFormExamplePrimarySearchableFieldDisplayComponent, DocFormExampleWarnSearchableFieldDisplayComponent, DocFormExampleAccentSearchableFieldDisplayComponent];

  return EXAMPLE_DISPLAY_FOR_SELECTION_VALUE(values).pipe(
    map((displayValues) => {
      displayValues.forEach((x) => {
        (x as Configurable<SearchableValueFieldDisplayValue<string, DocFormExampleSelectionValue>>).display = {
          componentClass: pickOneRandomly(possibleComponents)
        };
      });

      return displayValues;
    })
  );
};
