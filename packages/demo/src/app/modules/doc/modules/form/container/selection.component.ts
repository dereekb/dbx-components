import { BehaviorSubject, map, Observable, of, delay, switchMap } from 'rxjs';
import { Component } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { searchableChipField, SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue, SearchableValueFieldStringSearchFn, SearchableValueFieldValue } from '@dereekb/dbx-form';
import { randomDelay, randomDelayWithRandomFunction } from '@dereekb/rxjs';
import { makeRandomFunction } from '@dereekb/util';

export type TestStringSearchFunction = (text: string) => string[];

export function makeSearchForStringValue(obs: Observable<TestStringSearchFunction>): SearchableValueFieldStringSearchFn<string> {
  const makeRandomDelay = makeRandomFunction(1000);  // use to show the loading bar.

  return (search: string) => {
    return obs.pipe(
      randomDelayWithRandomFunction(makeRandomDelay),
      map((searchFn) => {
        const stringResults = searchFn(search);
        const result: SearchableValueFieldValue<string>[] = stringResults.map(value => ({ value }));
        return result;
      })
    );
  }
}

export const DISPLAY_FOR_STRING_VALUE: SearchableValueFieldDisplayFn<string> = (values: SearchableValueFieldValue<string>[]) => {
  const displayValues: SearchableValueFieldDisplayValue<string>[] = values.map(x => ({ ...x, label: x.value }));
  const obs: Observable<SearchableValueFieldDisplayValue<string>[]> = of(displayValues);
  return obs;
}

@Component({
  templateUrl: './selection.component.html'
})
export class DocFormSelectionComponent {

  private _searchStrings = new BehaviorSubject<TestStringSearchFunction>((search) => ['A', 'B', 'C', 'D'].map(x => `${search} ${x}`));
  readonly searchFn$ = this._searchStrings.asObservable();

  readonly searchableChipFields: FormlyFieldConfig[] = [
    searchableChipField({
      key: 'stringChips',
      label: 'Search And Pick Strings',
      allowStringValues: true,
      searchOnEmptyText: true,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    })
  ];

  readonly searchableTextFields: FormlyFieldConfig[] = [];

}
