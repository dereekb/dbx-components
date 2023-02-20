import { safeDetectChanges } from '@dereekb/dbx-core';
import { BehaviorSubject, map, Observable, of, delay, startWith, switchMap, Subject } from 'rxjs';
import { ChangeDetectorRef, Component, OnDestroy, Type, OnInit } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { dbxListField, filterPickableItemFieldValuesByLabel, pickableItemChipField, pickableItemListField, searchableChipField, searchableStringChipField, searchableTextField, SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue, SearchableValueFieldStringSearchFn, SearchableValueFieldValue, sourceSelectField, SourceSelectLoadSource, valueSelectionField, ValueSelectionOption, ValueSelectionOptionWithValue } from '@dereekb/dbx-form';
import { ListLoadingState, randomDelayWithRandomFunction, successResult, beginLoading } from '@dereekb/rxjs';
import { range, randomArrayFactory, randomNumberFactory, takeFront, readIndexNumber, IndexRef, ModelKey, searchStringFilterFunction } from '@dereekb/util';
import { DocFormExampleSelectionValue, DocFormExampleSelectionValueId, EXAMPLE_DISPLAY_FOR_SELECTION_VALUE, EXAMPLE_DISPLAY_FOR_SELECTION_VALUE_WITH_CUSTOM_DISPLAYS, EXAMPLE_SEARCH_FOR_SELECTION_VALUE, MAKE_EXAMPLE_SELECTION_VALUE } from '../component/selection.example';
import { DocFormExamplePrimarySearchableFieldDisplayComponent } from '../component/selection.example.view';
import { DocValue } from '../../layout/component/item.list';
import { DocSelectionItemListComponent } from '../../layout/component/item.list.selection.component';
import { AbstractDbxSelectionListWrapperDirective } from '@dereekb/dbx-web';

export type TestStringSearchFunction = (text: string) => string[];

export function makeSearchForStringValue(obs: Observable<TestStringSearchFunction>): SearchableValueFieldStringSearchFn<string> {
  const makeRandomDelay = randomNumberFactory(1000); // use to show the loading bar.

  return (search: string) => {
    return obs.pipe(
      randomDelayWithRandomFunction(makeRandomDelay),
      map((searchFn) => {
        const stringResults = searchFn(search);
        const result: SearchableValueFieldValue<string>[] = stringResults.map((value) => ({ value }));
        return result;
      })
    );
  };
}

export const DISPLAY_FOR_STRING_VALUE: SearchableValueFieldDisplayFn<string> = (values: SearchableValueFieldValue<string>[]) => {
  const displayValues: SearchableValueFieldDisplayValue<string>[] = values.map((x) => ({ ...x, label: x.value, sublabel: 'item' }));
  const obs: Observable<SearchableValueFieldDisplayValue<string>[]> = of(displayValues);
  return obs;
};

export const MAKE_RANDOM_STRING_VALUES = randomArrayFactory({ random: { min: 40, max: 40 }, make: () => ({ value: String(MAKE_EXAMPLE_SELECTION_VALUE().value) }) });

export const VALUE_SELECTION_VALUES: ValueSelectionOptionWithValue<number>[] = [
  {
    label: 'First Value',
    value: 100
  },
  {
    label: 'Second Value',
    value: 200
  },
  {
    label: 'Third Value',
    value: 300
  }
];

export const MORE_VALUE_SELECTION_VALUES: ValueSelectionOptionWithValue<number>[] = [
  {
    label: 'Fourth Value',
    value: 400
  },
  {
    label: 'Fifth Value',
    value: 500
  }
];

export const EVEN_MORE_VALUE_SELECTION_VALUES: ValueSelectionOptionWithValue<number>[] = [
  {
    label: 'Sixth Value',
    value: 500
  }
];

export interface ExampleSearchableMetadata {
  /**
   * Name
   */
  name: string;
  /**
   * School id
   */
  key: ModelKey;
}

const DISPLAY_FOR_EXAMPLE_METADATA_VALUE: SearchableValueFieldDisplayFn<string, ExampleSearchableMetadata> = (values: SearchableValueFieldValue<string, ExampleSearchableMetadata>[]) => {
  const displayValues: SearchableValueFieldDisplayValue<string, ExampleSearchableMetadata>[] = values.map((x) => ({ ...x, label: x.meta?.name || 'META NOT FOUND' }));
  const obs: Observable<SearchableValueFieldDisplayValue<string, ExampleSearchableMetadata>[]> = of(displayValues);
  return obs;
};

const EMBEDDED_SCHOOLS_FILTER_FUNCTION = searchStringFilterFunction<ExampleSearchableMetadata>((x) => x.name);

@Component({
  templateUrl: './selection.component.html'
})
export class DocFormSelectionComponent implements OnInit, OnDestroy {
  private _searchStrings = new BehaviorSubject<TestStringSearchFunction>((search) => ['A', 'B', 'C', 'D'].map((x) => `${search} ${x}`.trim()));
  readonly searchFn$ = this._searchStrings.asObservable();

  readonly sourceSelectFields: FormlyFieldConfig[] = [
    sourceSelectField<number, ValueSelectionOptionWithValue<number>>({
      key: 'selectOne',
      label: 'Select One',
      description: 'This is a source selection field for picking a single value from various sources.',
      valueReader: (x) => x.value,
      metaLoader: (values) => of(values.map((x) => VALUE_SELECTION_VALUES.find((y) => y.value === x) as ValueSelectionOptionWithValue<number>)),
      displayForValue: (input) => of(input.map((y) => ({ ...y, label: String(y.meta.label) }))),
      loadSources: () => {
        const sources: SourceSelectLoadSource<ValueSelectionOptionWithValue<number>>[] = [];
        sources.push({ label: 'Source A', meta: of(successResult(VALUE_SELECTION_VALUES)) });
        sources.push({ label: 'Source B', meta: of(successResult([...VALUE_SELECTION_VALUES, ...MORE_VALUE_SELECTION_VALUES])) }); // repeat values are ignored.
        return of(sources);
      }
    }),
    sourceSelectField({
      key: 'selectMany',
      label: 'Select Many',
      multiple: true,
      description: 'This is a source selection field for picking a multiple values from various sources.',
      valueReader: (x) => x.value,
      metaLoader: (values) => of(values.map((x) => VALUE_SELECTION_VALUES.find((y) => y.value === x) as ValueSelectionOptionWithValue<number>)),
      displayForValue: (input) => of(input.map((y) => ({ ...y, label: String(y.meta.label) }))),
      loadSources: () => {
        const sources: SourceSelectLoadSource<ValueSelectionOptionWithValue<number>>[] = [];
        sources.push({ label: 'Source A', meta: of(successResult(VALUE_SELECTION_VALUES)) });
        sources.push({ label: 'Source B', meta: of(successResult([...VALUE_SELECTION_VALUES, ...MORE_VALUE_SELECTION_VALUES])) }); // repeat values are ignored.
        return of(sources);
      }
    }),
    sourceSelectField({
      key: 'selectManyLoading',
      label: 'Select Many Loading',
      multiple: true,
      description: 'This source demonstrates the loading bar showing while a source is being loaded.',
      valueReader: (x) => x.value,
      metaLoader: (values) => of(values.map((x) => VALUE_SELECTION_VALUES.find((y) => y.value === x) as ValueSelectionOptionWithValue<number>)),
      displayForValue: (input) => of(input.map((y) => ({ ...y, label: String(y.meta.label) }))),
      loadSources: () => {
        const sources: SourceSelectLoadSource<ValueSelectionOptionWithValue<number>>[] = [];
        sources.push({ label: 'Source A', meta: of(successResult(VALUE_SELECTION_VALUES)) });
        sources.push({ label: 'Source B', meta: of(beginLoading<ValueSelectionOptionWithValue<number>[]>()) }); // demonstrates loading from another source
        return of(sources);
      }
    }),
    sourceSelectField({
      key: 'selectManyWithSourceButton',
      label: 'Select With Source Button',
      multiple: true,
      description: 'This source demonstrates the source selection button. The button can be configured to return both options to select immediately or options to add to the list.',
      selectButtonIcon: 'search',
      valueReader: (x) => x.value,
      metaLoader: (values) => of(values.map((x) => VALUE_SELECTION_VALUES.find((y) => y.value === x) as ValueSelectionOptionWithValue<number>)),
      displayForValue: (input) => of(input.map((y) => ({ ...y, label: String(y.meta.label) }))),
      loadSources: () => {
        const sources: SourceSelectLoadSource<ValueSelectionOptionWithValue<number>>[] = [];
        sources.push({ label: 'Source A', meta: of(successResult(VALUE_SELECTION_VALUES)) });
        return of(sources);
      },
      openSource: () => of({ select: EVEN_MORE_VALUE_SELECTION_VALUES, options: MORE_VALUE_SELECTION_VALUES }).pipe(delay(2000))
    })
  ];

  readonly sourceSelectFieldsValue = {
    selectManyLoading: [VALUE_SELECTION_VALUES[1].value] // will have a value already selected
  };

  readonly valueSelectionFields: FormlyFieldConfig[] = [
    valueSelectionField({
      key: 'selectOne',
      label: 'Select One',
      description: 'This is a simple selection field for picking a single value.',
      options: VALUE_SELECTION_VALUES
    }),
    valueSelectionField({
      key: 'materialCustomized',
      label: 'Select One Customized',
      description: 'This is a simple selection field with material form field customization.',
      options: VALUE_SELECTION_VALUES,
      materialFormField: {
        appearance: 'outline'
      }
    }),
    valueSelectionField({
      key: 'selectOneWithClear',
      label: 'Select One With Clear',
      description: 'This is a simple selection field with a custom clear value added via the addClearOption.',
      addClearOption: '>> Custom Clear Me <<',
      options: VALUE_SELECTION_VALUES
    }),
    valueSelectionField({
      key: 'selectMultiple',
      label: 'Select Multiple',
      description: 'This is a simple selection field for picking an array of values.',
      options: VALUE_SELECTION_VALUES,
      multiple: true,
      selectAllOption: true
    }),
    valueSelectionField({
      key: 'selectWithObservable',
      label: 'Select With Observable Data Source',
      description: 'This select source uses an observable for values.',
      options: of(VALUE_SELECTION_VALUES)
    }),
    valueSelectionField({
      key: 'selectOneNative',
      label: 'Select Native',
      description: 'This is a native selection field.',
      options: VALUE_SELECTION_VALUES,
      native: true
    })
  ];

  readonly numberToLoadPerUpdate = 10;

  private _values = new BehaviorSubject<(DocValue & IndexRef)[]>([]);

  readonly initialListSelectionValues$ = of({
    dbxlist: [1, 2, 4, 8, 16, 32, 64, 128, 256]
  });

  readonly state$: Observable<ListLoadingState<DocValue & IndexRef>> = this._values.pipe(
    switchMap((x) => {
      return of(successResult(x)).pipe(delay(Math.random() * 500 + 500), startWith<ListLoadingState<DocValue & IndexRef>>({ loading: true, value: takeFront(x, x.length - this.numberToLoadPerUpdate) }));
    })
  );

  makeValues() {
    const currentI = this._values.value.length;
    return range(currentI, currentI + this.numberToLoadPerUpdate).map((i) => ({ i, icon: 'house', name: `${i}-${Math.random() * i}` }));
  }

  loadMore() {
    this._values.next(this._values.value.concat(this.makeValues()));
  }

  readonly dbxListFields: FormlyFieldConfig[] = [
    dbxListField<DocValue & IndexRef, AbstractDbxSelectionListWrapperDirective<DocValue & IndexRef>>({
      key: 'dbxlist',
      label: 'DbxList Label',
      description: 'Uses a dbxList-related view/wrapper to display a list and select items. Selected items are keyed via a readKey function.',
      state$: this.state$,
      readKey: readIndexNumber,
      loadMore: () => this.loadMore(), // load more is not usual for these as reloading values requires loading more, but it is available for the rare cases.
      listComponentClass: of(DocSelectionItemListComponent as unknown as Type<AbstractDbxSelectionListWrapperDirective<DocValue & IndexRef>>)
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
      key: 'stringItemChipsWithSingleValueMax',
      label: 'String Item Chips With Single Value Selection',
      filterLabel: 'Filter',
      description: 'You can only select one value at a time.',
      filterValues: filterPickableItemFieldValuesByLabel,
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE,
      asArrayValue: false
    }),
    pickableItemChipField({
      key: 'stringItemChipsWithFilter',
      label: 'String Item Chips With Filter With Delay',
      filterLabel: 'Filter',
      description: 'You can filter these items by their label.',
      filterValues: (a, b) => filterPickableItemFieldValuesByLabel(a, b).pipe(delay(300)),
      loadValues: () => of(MAKE_RANDOM_STRING_VALUES()),
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
      key: 'stringItemListSingleValue',
      label: 'String Item List With Single Value Selection',
      description: 'You can only select one value at a time. The value is returned as an array anyways.',
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE,
      multiSelect: false,
      asArrayValue: true // return as array anyways
    }),
    pickableItemListField<DocFormExampleSelectionValueId>({
      key: 'stringItemListWithFilter',
      label: 'String Item List',
      filterLabel: 'Filter',
      description: 'You can filter these items by their label.',
      filterValues: filterPickableItemFieldValuesByLabel,
      loadValues: () => of(MAKE_RANDOM_STRING_VALUES()),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    })
  ];

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
    searchableTextField<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>({
      key: 'models',
      label: 'Search And Pick A Model',
      description: 'Search for models using a string and the default display presentation.',
      allowStringValues: false,
      searchOnEmptyText: true,
      search: EXAMPLE_SEARCH_FOR_SELECTION_VALUE(),
      displayForValue: EXAMPLE_DISPLAY_FOR_SELECTION_VALUE
    }),
    searchableTextField<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>({
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
    searchableTextField<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>({
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

  readonly exampleMetadataValues: ExampleSearchableMetadata[] = [
    {
      name: 'Test A',
      key: '1'
    },
    {
      name: 'Test B',
      key: '2'
    },
    {
      name: 'Test C',
      key: '3'
    }
  ];

  readonly anchorFieldValue = {
    anchor1: 'a',
    anchor3: '3'
  };

  readonly _refreshDisplayValues = new Subject();

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
            (this.valueClicked = `Default anchor click: ${fieldValue.value}`), safeDetectChanges(this.cdRef);
          }
        };
      }
    }),
    searchableTextField({
      key: 'anchor2',
      label: 'Anchor Segue',
      description: 'Anchors are set on each item. Result is configured to not show.',
      allowStringValues: false,
      searchOnEmptyText: true,
      showSelectedValue: false,
      search: (search: string) =>
        of(
          [{ value: 'a' }, { value: 'b' }, { value: 'c' }].map((x) => ({
            ...x,
            anchor: {
              onClick: () => {
                (this.valueClicked = `Per item value: ${x.value}`), safeDetectChanges(this.cdRef);
              }
            }
          }))
        ),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    searchableTextField({
      key: 'anchor3',
      label: 'Anchor Segue For Metadata Items',
      description: `Metadata items are passed in. Note that the simple displayForValue function we used doesn't search remotely and just fills in default data if meta is missing.`,
      allowStringValues: false,
      searchOnEmptyText: true,
      showSelectedValue: false,
      search: (search: string) =>
        of(this.exampleMetadataValues).pipe(
          map((s) => {
            const filteredSchools = EMBEDDED_SCHOOLS_FILTER_FUNCTION(search, s);
            const result: SearchableValueFieldValue<string, ExampleSearchableMetadata>[] = filteredSchools.map((meta) => ({ meta, value: meta.key }));
            return result;
          })
        ),
      displayForValue: DISPLAY_FOR_EXAMPLE_METADATA_VALUE,
      anchorForValue: (fieldValue) => {
        return {
          onClick: () => {
            this.valueClicked = `Meta item click: ${fieldValue.value}`;
            safeDetectChanges(this.cdRef);
          }
        };
      },
      refreshDisplayValues$: this._refreshDisplayValues
    })
  ];

  constructor(readonly cdRef: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadMore();
  }

  ngOnDestroy(): void {
    this._searchStrings.complete();
    this._refreshDisplayValues.complete;
  }

  refreshDisplayValues() {
    this._refreshDisplayValues.next(0);
  }
}
