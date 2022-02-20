import { makeMetaFilterSearchableFieldValueDisplayFn, SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue, SearchableValueFieldStringSearchFn, SearchableValueFieldValue } from '@dereekb/dbx-form';
import { randomDelayWithRandomFunction } from '@dereekb/rxjs';
import { makeRandomArrayFn, makeRandomFunction, pickOneRandomly } from '@dereekb/util';
import { map, Observable, of } from 'rxjs';
import { DocFormExampleAccentSearchableFieldDisplayComponent, DocFormExamplePrimarySearchableFieldDisplayComponent, DocFormExampleWarnSearchableFieldDisplayComponent } from './selection.example.view';

export type DocFormExampleSelectionValueId = string;

export interface DocFormExampleSelectionValue {
  id: string;
  value: number;
}

export function MAKE_EXAMPLE_SELECTION_VALUE(id?: string) {
  let value = (id) ? Number(id) : Math.ceil(Math.random() * 1000000000);

  return {
    id: String(value),
    value
  };
}

export function EXAMPLE_SEARCH_FOR_SELECTION_VALUE(): SearchableValueFieldStringSearchFn<DocFormExampleSelectionValueId> {
  const makeRandomDelay = makeRandomFunction(200);  // use to show the loading bar.
  const makeRandomItems = makeRandomArrayFn({ random: { min: 12, max: 25 }, make: () => MAKE_EXAMPLE_SELECTION_VALUE() });

  return (search: string = '') => {
    if (search.length > 3) {
      const result: SearchableValueFieldValue<DocFormExampleSelectionValueId>[] = makeRandomItems().map(x => ({ meta: x, value: x.id }));
      return of(result).pipe(randomDelayWithRandomFunction(makeRandomDelay));
    } else {
      return of([]).pipe(randomDelayWithRandomFunction(makeRandomDelay));
    }
  }
}

export const EXAMPLE_DISPLAY_FOR_SELECTION_VALUE: SearchableValueFieldDisplayFn<DocFormExampleSelectionValueId> = makeMetaFilterSearchableFieldValueDisplayFn<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>({
  loadMetaForValues: (values) => {
    const valuesWithMeta = values.map(x => ({ ...x, meta: MAKE_EXAMPLE_SELECTION_VALUE(x.value) }));
    return of(valuesWithMeta);
  },
  makeDisplayForValues: (values) => {
    const displayValues: SearchableValueFieldDisplayValue<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>[] = values.map(x => ({ ...x, label: `Product: ${x.meta!.value}` }));
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
export const EXAMPLE_DISPLAY_FOR_SELECTION_VALUE_WITH_CUSTOM_DISPLAYS: SearchableValueFieldDisplayFn<DocFormExampleSelectionValueId> = (values) => {
  const possibleComponents = [DocFormExamplePrimarySearchableFieldDisplayComponent, DocFormExampleWarnSearchableFieldDisplayComponent, DocFormExampleAccentSearchableFieldDisplayComponent];

  return EXAMPLE_DISPLAY_FOR_SELECTION_VALUE(values).pipe(map(displayValues => {

    displayValues.forEach((x) => {
      x.display = {
        componentClass: pickOneRandomly(possibleComponents)
      }
    })

    return displayValues;
  }));
}