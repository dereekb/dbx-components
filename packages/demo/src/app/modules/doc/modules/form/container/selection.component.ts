import { safeDetectChanges } from '@dereekb/dbx-core';
import { BehaviorSubject, map, Observable, of, delay } from 'rxjs';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { filterPickableItemFieldValuesByLabel, pickableItemChipField, pickableItemListField, searchableChipField, searchableStringChipField, searchableTextField, SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue, SearchableValueFieldStringSearchFn, SearchableValueFieldValue } from '@dereekb/dbx-form';
import { randomDelayWithRandomFunction } from '@dereekb/rxjs';
import { makeRandomFunction } from '@dereekb/util';
import { DocFormExampleSelectionValueId, EXAMPLE_DISPLAY_FOR_SELECTION_VALUE, EXAMPLE_DISPLAY_FOR_SELECTION_VALUE_WITH_CUSTOM_DISPLAYS, EXAMPLE_SEARCH_FOR_SELECTION_VALUE, MAKE_RANDOM_SELECTION_VALUES } from '../component/selection.example';
import { DocFormExamplePrimarySearchableFieldDisplayComponent } from '../component/selection.example.view';

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
  const displayValues: SearchableValueFieldDisplayValue<string>[] = values.map(x => ({ ...x, label: x.value, sublabel: 'item' }));
  const obs: Observable<SearchableValueFieldDisplayValue<string>[]> = of(displayValues);
  return obs;
}

@Component({
  templateUrl: './selection.component.html'
})
export class DocFormSelectionComponent {

  private _searchStrings = new BehaviorSubject<TestStringSearchFunction>((search) => ['A', 'B', 'C', 'D'].map(x => `${search} ${x}`.trim()));
  readonly searchFn$ = this._searchStrings.asObservable();

  readonly searchableChipFields: FormlyFieldConfig[] = [
    searchableStringChipField({
      key: 'typeAndPickChips',
      label: 'Search And Pick Strings',
      description: 'This input can search for string, but also have an arbitrary value input.',
      searchOnEmptyText: true,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    searchableStringChipField({
      key: 'typeAndPickChips',
      label: 'Read Only Text Field',
      description: 'This input is read-only.',
      readonly: true,
      searchOnEmptyText: true,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    searchableChipField({
      key: 'pickOnly',
      label: 'Only Pick Strings',
      description: 'This input does not allow arbitrary strings to be input.',
      allowStringValues: false,
      searchOnEmptyText: true,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    searchableChipField({
      key: 'nonEmptySearch',
      label: 'Search Non-Empty Strings',
      description: 'This input does not search empty string value.',
      allowStringValues: false,
      searchOnEmptyText: false,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    searchableChipField({
      key: 'customView',
      label: 'Search Non-Empty Strings',
      description: 'This input has custom display configuration.',
      allowStringValues: false,
      searchOnEmptyText: true,
      search: EXAMPLE_SEARCH_FOR_SELECTION_VALUE(),
      displayForValue: EXAMPLE_DISPLAY_FOR_SELECTION_VALUE_WITH_CUSTOM_DISPLAYS
    })
  ];

  readonly searchableTextFields: FormlyFieldConfig[] = [
    searchableTextField({
      key: 'strings',
      label: 'Type, Search And Pick A String Value',
      description: 'Type in a string and select it, or search for string values.',
      allowStringValues: true,
      searchOnEmptyText: true,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    searchableTextField({
      key: 'strings',
      label: 'Read-only Text Field',
      description: 'View is read only.',
      readonly: true,
      allowStringValues: true,
      searchOnEmptyText: true,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    searchableTextField({
      key: 'pickStrings',
      label: 'Search And Pick A String Value only.',
      description: 'Search for values only.',
      allowStringValues: false,
      searchOnEmptyText: false,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    searchableTextField<DocFormExampleSelectionValueId>({
      key: 'models',
      label: 'Search And Pick A Model',
      description: 'Search for models using a string and the default display presentation.',
      allowStringValues: false,
      searchOnEmptyText: true,
      search: EXAMPLE_SEARCH_FOR_SELECTION_VALUE(),
      displayForValue: EXAMPLE_DISPLAY_FOR_SELECTION_VALUE
    }),
    searchableTextField<DocFormExampleSelectionValueId>({
      key: 'customDisplay',
      label: 'Search And Pick A Model (Custom Display)',
      description: 'Search for models using a string and custom display presentation set on the field.',
      allowStringValues: false,
      searchOnEmptyText: true,
      search: EXAMPLE_SEARCH_FOR_SELECTION_VALUE(),
      displayForValue: EXAMPLE_DISPLAY_FOR_SELECTION_VALUE,
      display: {
        componentClass: DocFormExamplePrimarySearchableFieldDisplayComponent
      }
    }),
    searchableTextField<DocFormExampleSelectionValueId>({
      key: 'customDisplayItems',
      label: 'Search And Pick A Model (Custom Display)',
      description: 'Search for models using a string and custom display presentation set per item.',
      allowStringValues: false,
      searchOnEmptyText: true,
      search: EXAMPLE_SEARCH_FOR_SELECTION_VALUE(),
      displayForValue: EXAMPLE_DISPLAY_FOR_SELECTION_VALUE_WITH_CUSTOM_DISPLAYS
    })
  ];

  valueClicked: any;

  readonly searchableTextFieldsWithAnchors: FormlyFieldConfig[] = [
    searchableTextField({
      key: 'anchor1',
      label: 'Anchor Segue',
      description: 'Anchors are enabled and set on the field. Result is configured to not show.',
      allowStringValues: false,
      searchOnEmptyText: true,
      search: (search: string) => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE,
      showSelectedValue: false,
      useAnchor: true,
      anchorForValue: (fieldValue) => {
        return {
          onClick: () => {
            this.valueClicked = `Default anchor click: ${fieldValue.value}`,
              safeDetectChanges(this.cdRef);
          }
        }
      },
    }),
    searchableTextField({
      key: 'anchor2',
      label: 'Anchor Segue',
      description: 'Anchors are set on each item. Result is configured to not show.',
      allowStringValues: false,
      searchOnEmptyText: true,
      showSelectedValue: false,
      search: (search: string) => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }].map(x => ({
        ...x,
        anchor: {
          onClick: () => {
            this.valueClicked = `Per item value: ${x.value}`,
              safeDetectChanges(this.cdRef);
          }
        }
      }))),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    })
  ];

  readonly pickableItemChipFields: FormlyFieldConfig[] = [
    pickableItemChipField({
      key: 'stringItemChips',
      label: 'String Item Chips',
      description: 'This is a simple string item chip picker.',
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    pickableItemChipField({
      key: 'stringItemChips',
      label: 'Read Only String Item Chips',
      description: 'This is read only.',
      readonly: true,
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    pickableItemChipField({
      key: 'stringItemChipsWithFilter',
      label: 'String Item Chips With Filter',
      filterLabel: 'Filter',
      description: 'You can filter these items by their label.',
      filterValues: filterPickableItemFieldValuesByLabel,
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    pickableItemChipField({
      key: 'stringItemChipsWithFilter',
      label: 'String Item Chips With Filter With Delay',
      filterLabel: 'Filter',
      description: 'You can filter these items by their label.',
      filterValues: (a, b) => filterPickableItemFieldValuesByLabel(a, b).pipe(delay(300)),
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    })
  ];

  readonly pickableItemListFields: FormlyFieldConfig[] = [
    pickableItemListField<DocFormExampleSelectionValueId>({
      key: 'stringItemList',
      label: 'String Item List',
      description: 'This is a simple string item list picker.',
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    pickableItemListField<DocFormExampleSelectionValueId>({
      key: 'stringItemList',
      label: 'Read Only String Item List',
      readonly: true,
      description: 'This is read only.',
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    pickableItemListField<DocFormExampleSelectionValueId>({
      key: 'stringItemListWithFilter',
      label: 'String Item List',
      filterLabel: 'Filter',
      description: 'You can filter these items by their label.',
      filterValues: filterPickableItemFieldValuesByLabel,
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    })
  ];

  constructor(readonly cdRef: ChangeDetectorRef) { }

}
