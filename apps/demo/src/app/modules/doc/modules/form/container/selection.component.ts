import { BehaviorSubject, map, type Observable, of, delay, startWith, switchMap, Subject } from 'rxjs';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, type OnDestroy, type Type, type OnInit, inject } from '@angular/core';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import {
  DbxFormFormlyDbxListFieldModule,
  DbxFormFormlyPickableFieldModule,
  DbxFormFormlySearchableFieldModule,
  DbxFormFormlySourceSelectModule,
  formlyDbxListField,
  filterPickableItemFieldValuesByLabel,
  formlyPickableItemChipField,
  formlyPickableItemListField,
  pickableValueFieldValuesConfigForStaticLabeledValues,
  formlySearchableChipField,
  formlySearchableStringChipField,
  formlySearchableTextField,
  type SearchableValueFieldDisplayFn,
  type SearchableValueFieldDisplayValue,
  type SearchableValueFieldStringSearchFn,
  type SearchableValueFieldValue,
  formlySourceSelectField,
  type SourceSelectLoadSource,
  formlyValueSelectionField,
  type ValueSelectionOptionWithValue,
  forgeValueSelectionField,
  forgeSourceSelectField,
  forgeListSelectionField,
  forgePickableChipField,
  forgePickableListField,
  forgeSearchableChipField,
  forgeSearchableStringChipField,
  forgeSearchableTextField,
  DbxFormlyFieldsContextDirective,
  DbxFormSourceDirective,
  isWebsiteUrlValidator
} from '@dereekb/dbx-form';
import { type ListLoadingState, randomDelayWithRandomFunction, successResult, beginLoading } from '@dereekb/rxjs';
import { range, randomArrayFactory, randomNumberFactory, takeFront, readIndexNumber, type IndexRef, type ModelKey, searchStringFilterFunction, randomPickFactory } from '@dereekb/util';
import { type DocFormExampleSelectionValue, type DocFormExampleSelectionValueId, EXAMPLE_DISPLAY_FOR_SELECTION_VALUE, EXAMPLE_DISPLAY_FOR_SELECTION_VALUE_WITH_CUSTOM_DISPLAYS, EXAMPLE_SEARCH_FOR_SELECTION_VALUE, MAKE_EXAMPLE_SELECTION_VALUE } from '../component/selection.example';
import { DocFormExamplePrimarySearchableFieldDisplayComponent } from '../component/selection.example.view';
import { type DocValue } from '../../layout/component/item.list';
import { DocSelectionItemListComponent } from '../../layout/component/item.list.selection.component';
import { type AbstractDbxSelectionListWrapperDirective, DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DocFormForgeExampleComponent } from '../component/forge.example.form.component';

export type TestStringSearchFunction = (text: string) => string[];

/**
 * Creates a searchable value field search function with a random delay for demo loading state.
 *
 * @param obs - Observable of the string search function to use
 * @returns A search function that delegates to the provided observable
 */
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

const RANDOM_ICON_FACTORY = randomPickFactory(['circle', 'favorite', 'pentagon', 'star', 'square']);

export const DISPLAY_FOR_STRING_VALUE: SearchableValueFieldDisplayFn<string> = (values: SearchableValueFieldValue<string>[]) => {
  const displayValues: SearchableValueFieldDisplayValue<string>[] = values.map((x) => ({ ...x, icon: RANDOM_ICON_FACTORY(), label: x.value, sublabel: 'item' }));
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
  templateUrl: './selection.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormExampleComponent, DocFormForgeExampleComponent, DbxFormlyFieldsContextDirective, DbxFormSourceDirective, DbxFormFormlyDbxListFieldModule, DbxFormFormlyPickableFieldModule, DbxFormFormlySearchableFieldModule, DbxFormFormlySourceSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormSelectionComponent implements OnInit, OnDestroy {
  readonly cdRef = inject(ChangeDetectorRef);

  private _searchStrings = new BehaviorSubject<TestStringSearchFunction>((search) => ['A', 'B', 'C', 'D'].map((x) => `${search} ${x}`.trim()));
  readonly searchFn$ = this._searchStrings.asObservable();

  readonly sourceSelectFields: FormlyFieldConfig[] = [
    formlySourceSelectField<number, ValueSelectionOptionWithValue<number>>({
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
    formlySourceSelectField({
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
    formlySourceSelectField({
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
    formlySourceSelectField({
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
      openSource: ({ origin }) => {
        console.log('origin: ', origin); // usable by popovers/etc.
        return of({ select: EVEN_MORE_VALUE_SELECTION_VALUES, options: MORE_VALUE_SELECTION_VALUES }).pipe(delay(2000));
      }
    }),
    formlySourceSelectField({
      key: 'selectManyFilterable',
      label: 'Select Many (Filterable)',
      multiple: true,
      description: 'This source demonstrates the type-to-filter feature (enabled by default). Open the dropdown and start typing to filter options by label.',
      valueReader: (x) => x.value,
      metaLoader: (values) => of(values.map((x) => VALUE_SELECTION_VALUES.find((y) => y.value === x) as ValueSelectionOptionWithValue<number>)),
      displayForValue: (input) => of(input.map((y) => ({ ...y, label: String(y.meta.label) }))),
      loadSources: () => {
        const sources: SourceSelectLoadSource<ValueSelectionOptionWithValue<number>>[] = [];
        sources.push({ label: 'Source A', meta: of(successResult(VALUE_SELECTION_VALUES)) });
        sources.push({ label: 'Source B', meta: of(successResult([...VALUE_SELECTION_VALUES, ...MORE_VALUE_SELECTION_VALUES])) });
        return of(sources);
      }
    })
  ];

  readonly sourceSelectFieldsValue = {
    selectManyLoading: [VALUE_SELECTION_VALUES[1].value] // will have a value already selected
  };

  readonly valueSelectionFields: FormlyFieldConfig[] = [
    formlyValueSelectionField({
      key: 'selectOne',
      label: 'Select One',
      description: 'This is a simple selection field for picking a single value.',
      options: VALUE_SELECTION_VALUES
    }),
    formlyValueSelectionField({
      key: 'materialCustomized',
      label: 'Select One Customized',
      description: 'This is a simple selection field with material form field customization.',
      options: VALUE_SELECTION_VALUES,
      materialFormField: {
        appearance: 'outline'
      }
    }),
    formlyValueSelectionField({
      key: 'selectOneWithClear',
      label: 'Select One With Clear',
      description: 'This is a simple selection field with a custom clear value added via the addClearOption.',
      addClearOption: '>> Custom Clear Me <<',
      options: VALUE_SELECTION_VALUES
    }),
    formlyValueSelectionField({
      key: 'selectMultiple',
      label: 'Select Multiple',
      description: 'This is a simple selection field for picking an array of values.',
      options: VALUE_SELECTION_VALUES,
      multiple: true,
      selectAllOption: true
    }),
    formlyValueSelectionField({
      key: 'selectWithObservable',
      label: 'Select With Observable Data Source',
      description: 'This select source uses an observable for values.',
      options: of(VALUE_SELECTION_VALUES)
    }),
    formlyValueSelectionField({
      key: 'selectOneNative',
      label: 'Select Native',
      description: 'This is a native selection field.',
      options: VALUE_SELECTION_VALUES,
      native: true
    })
  ];

  readonly forgeSelectionFieldConfig: FormConfig = {
    fields: [
      forgeValueSelectionField({
        key: 'selectOne',
        label: 'Select One',
        description: 'This is a simple selection field for picking a single value.',
        options: VALUE_SELECTION_VALUES
      }),
      forgeValueSelectionField({
        key: 'materialCustomized',
        label: 'Select One Customized',
        description: 'This is a simple selection field with material form field customization.',
        options: VALUE_SELECTION_VALUES
      }),
      forgeValueSelectionField({
        key: 'selectOneWithClear',
        label: 'Select One With Clear',
        description: 'This is a simple selection field with a custom clear value added via the addClearOption.',
        addClearOption: '>> Custom Clear Me <<',
        options: VALUE_SELECTION_VALUES
      }),
      forgeValueSelectionField({
        key: 'selectMultiple',
        label: 'Select Multiple',
        description: 'This is a simple selection field for picking an array of values.',
        options: VALUE_SELECTION_VALUES,
        multiple: true
      }),
      forgeValueSelectionField({
        key: 'selectWithObservable',
        label: 'Select With Observable Data Source',
        description: 'This select source uses static values. Note: ng-forge SelectField does not support Observable options.',
        options: VALUE_SELECTION_VALUES
      })
    ]
  };

  // MARK: Forge Source Select
  readonly forgeSourceSelectFieldConfig: FormConfig = {
    fields: [
      forgeSourceSelectField<number, ValueSelectionOptionWithValue<number>>({
        key: 'selectOne',
        label: 'Select One',
        description: 'This is a source selection field for picking a single value from various sources.',
        valueReader: (x) => x.value,
        metaLoader: (values) => of(values.map((x) => VALUE_SELECTION_VALUES.find((y) => y.value === x) as ValueSelectionOptionWithValue<number>)),
        displayForValue: (input) => of(input.map((y) => ({ ...y, label: String(y.meta.label) }))),
        loadSources: () => {
          const sources: SourceSelectLoadSource<ValueSelectionOptionWithValue<number>>[] = [];
          sources.push({ label: 'Source A', meta: of(successResult(VALUE_SELECTION_VALUES)) });
          sources.push({ label: 'Source B', meta: of(successResult([...VALUE_SELECTION_VALUES, ...MORE_VALUE_SELECTION_VALUES])) });
          return of(sources);
        }
      }) as any,
      forgeSourceSelectField({
        key: 'selectMany',
        label: 'Select Many',
        multiple: true,
        description: 'This is a source selection field for picking a multiple values from various sources.',
        valueReader: (x: any) => x.value,
        metaLoader: (values) => of(values.map((x) => VALUE_SELECTION_VALUES.find((y) => y.value === x) as ValueSelectionOptionWithValue<number>)),
        displayForValue: (input) => of(input.map((y: any) => ({ ...y, label: String(y.meta.label) }))),
        loadSources: () => {
          const sources: SourceSelectLoadSource<ValueSelectionOptionWithValue<number>>[] = [];
          sources.push({ label: 'Source A', meta: of(successResult(VALUE_SELECTION_VALUES)) });
          sources.push({ label: 'Source B', meta: of(successResult([...VALUE_SELECTION_VALUES, ...MORE_VALUE_SELECTION_VALUES])) });
          return of(sources);
        }
      }) as any,
      forgeSourceSelectField({
        key: 'selectManyLoading',
        label: 'Select Many Loading',
        multiple: true,
        description: 'This source demonstrates the loading bar showing while a source is being loaded.',
        valueReader: (x: any) => x.value,
        metaLoader: (values) => of(values.map((x) => VALUE_SELECTION_VALUES.find((y) => y.value === x) as ValueSelectionOptionWithValue<number>)),
        displayForValue: (input) => of(input.map((y: any) => ({ ...y, label: String(y.meta.label) }))),
        loadSources: () => {
          const sources: SourceSelectLoadSource<ValueSelectionOptionWithValue<number>>[] = [];
          sources.push({ label: 'Source A', meta: of(successResult(VALUE_SELECTION_VALUES)) });
          sources.push({ label: 'Source B', meta: of(beginLoading<ValueSelectionOptionWithValue<number>[]>()) });
          return of(sources);
        }
      }) as any,
      forgeSourceSelectField({
        key: 'selectManyWithSourceButton',
        label: 'Select With Source Button',
        multiple: true,
        description: 'This source demonstrates the source selection button. The button can be configured to return both options to select immediately or options to add to the list.',
        selectButtonIcon: 'search',
        valueReader: (x: any) => x.value,
        metaLoader: (values) => of(values.map((x) => VALUE_SELECTION_VALUES.find((y) => y.value === x) as ValueSelectionOptionWithValue<number>)),
        displayForValue: (input) => of(input.map((y: any) => ({ ...y, label: String(y.meta.label) }))),
        loadSources: () => {
          const sources: SourceSelectLoadSource<ValueSelectionOptionWithValue<number>>[] = [];
          sources.push({ label: 'Source A', meta: of(successResult(VALUE_SELECTION_VALUES)) });
          return of(sources);
        },
        openSource: ({ origin }) => {
          console.log('origin: ', origin);
          return of({ select: EVEN_MORE_VALUE_SELECTION_VALUES, options: MORE_VALUE_SELECTION_VALUES }).pipe(delay(2000));
        }
      }) as any,
      forgeSourceSelectField({
        key: 'selectManyFilterable',
        label: 'Select Many (Filterable)',
        multiple: true,
        description: 'This source demonstrates the type-to-filter feature (enabled by default). Open the dropdown and start typing to filter options by label.',
        valueReader: (x: any) => x.value,
        metaLoader: (values) => of(values.map((x) => VALUE_SELECTION_VALUES.find((y) => y.value === x) as ValueSelectionOptionWithValue<number>)),
        displayForValue: (input) => of(input.map((y: any) => ({ ...y, label: String(y.meta.label) }))),
        loadSources: () => {
          const sources: SourceSelectLoadSource<ValueSelectionOptionWithValue<number>>[] = [];
          sources.push({ label: 'Source A', meta: of(successResult(VALUE_SELECTION_VALUES)) });
          sources.push({ label: 'Source B', meta: of(successResult([...VALUE_SELECTION_VALUES, ...MORE_VALUE_SELECTION_VALUES])) });
          return of(sources);
        }
      }) as any
    ]
  };

  // MARK: Forge Pickable Chip
  readonly forgePickableItemChipFieldConfig: FormConfig = {
    fields: [
      forgePickableChipField({
        key: 'stringItemChips',
        label: 'String Item Chips',
        description: 'This is a simple string item chip picker.',
        loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgePickableChipField({
        key: 'stringItemChipsReadonly',
        label: 'Read Only String Item Chips',
        description: 'This is read only.',
        readonly: true,
        loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgePickableChipField({
        key: 'singleStringItemChips',
        label: 'Single Selection',
        description: 'This field only allows selecting one item at a time and returns the value by itself',
        multiSelect: false,
        asArrayValue: false,
        loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgePickableChipField({
        key: 'stringItemChipsWithFilter',
        label: 'String Item Chips With Filter',
        filterLabel: 'Filter',
        description: 'You can filter these items by their label.',
        filterValues: filterPickableItemFieldValuesByLabel,
        loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgePickableChipField({
        key: 'staticLabeledValuesExample',
        label: 'pickableValueFieldValuesConfigForStaticLabeledValues() Example Usage',
        filterLabel: 'Filter',
        ...pickableValueFieldValuesConfigForStaticLabeledValues(
          range(50)
            .map((x) => String(x))
            .map((value) => ({ label: value.toUpperCase(), value }))
        )
      }) as any,
      forgePickableChipField({
        key: 'stringItemChipsWithFilterDelay',
        label: 'String Item Chips With Filter With Delay',
        filterLabel: 'Filter',
        description: 'You can filter these items by their label.',
        filterValues: (a, b) => filterPickableItemFieldValuesByLabel(a, b).pipe(delay(300)),
        loadValues: () => of(MAKE_RANDOM_STRING_VALUES()),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgePickableChipField({
        key: 'stringItemChipsWithSelectAll',
        label: 'Chips With Select All Button',
        description: 'This chip field has a "Select All" toggle button to select or deselect all items at once.',
        showSelectAllButton: true,
        loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }, { value: 'd' }]),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any
    ]
  };

  // MARK: Forge Pickable List
  readonly forgePickableItemListFieldConfig: FormConfig = {
    fields: [
      forgePickableListField({
        key: 'stringItemList',
        label: 'String Item List',
        description: 'This is a simple string item list picker.',
        loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgePickableListField({
        key: 'stringItemListReadonly',
        label: 'Read Only String Item List',
        readonly: true,
        description: 'This is read only.',
        loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgePickableListField({
        key: 'stringItemListSingleValue',
        label: 'String Item List With Single Value Selection',
        description: 'You can only select one value at a time. The value is returned as an array anyways.',
        loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
        displayForValue: DISPLAY_FOR_STRING_VALUE,
        multiSelect: false,
        asArrayValue: true
      }) as any,
      forgePickableListField({
        key: 'stringItemListWithFilter',
        label: 'String Item List',
        filterLabel: 'Filter',
        description: 'You can filter these items by their label.',
        filterValues: filterPickableItemFieldValuesByLabel,
        loadValues: () => of(MAKE_RANDOM_STRING_VALUES()),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any
    ]
  };

  // MARK: Forge Searchable Chip
  readonly forgeSearchableChipFieldConfig: FormConfig = {
    fields: [
      forgeSearchableStringChipField({
        key: 'typeAndPickChips',
        label: 'Search And Pick Strings',
        description: 'This input can search for string, but also have an arbitrary value input.',
        searchOnEmptyText: true,
        search: makeSearchForStringValue(this.searchFn$),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgeSearchableStringChipField({
        key: 'typeAndPickChipsReadonly',
        label: 'Read Only Text Field',
        description: 'This input is read-only.',
        readonly: true,
        searchOnEmptyText: true,
        search: makeSearchForStringValue(this.searchFn$),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgeSearchableChipField({
        key: 'pickOnly',
        label: 'Only Pick Strings',
        description: 'This input does not allow arbitrary strings to be input.',
        allowStringValues: false,
        searchOnEmptyText: true,
        search: makeSearchForStringValue(this.searchFn$),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgeSearchableChipField({
        key: 'pickOne',
        label: 'Pick a Single Value',
        description: 'Can only pick one value at a time. Saved as a single value.',
        allowStringValues: false,
        searchOnEmptyText: true,
        multiSelect: false,
        asArrayValue: false,
        search: makeSearchForStringValue(this.searchFn$),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgeSearchableChipField({
        key: 'nonEmptySearch',
        label: 'Search Non-Empty Strings',
        description: 'This input does not search empty string value.',
        allowStringValues: false,
        searchOnEmptyText: false,
        search: makeSearchForStringValue(this.searchFn$),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgeSearchableChipField({
        key: 'customView',
        label: 'Search Non-Empty Strings',
        description: 'This input has custom display configuration.',
        allowStringValues: false,
        searchOnEmptyText: true,
        search: EXAMPLE_SEARCH_FOR_SELECTION_VALUE(),
        displayForValue: EXAMPLE_DISPLAY_FOR_SELECTION_VALUE_WITH_CUSTOM_DISPLAYS
      }) as any,
      forgeSearchableStringChipField({
        key: 'validatedUrls',
        label: 'URL Chips With Validation',
        description: 'Type a URL (e.g. https://example.com) and press enter. Invalid URLs are rejected with an inline error. Port numbers like http://localhost:8080 are allowed.',
        searchOnEmptyText: false,
        textInputValidator: isWebsiteUrlValidator({ requirePrefix: true, allowPorts: true }),
        search: () => of([]),
        displayForValue: (values) => of(values.map((v) => ({ ...v, label: v.value })))
      }) as any
    ]
  };

  // MARK: Forge Searchable Text
  readonly forgeSearchableTextFieldConfig: FormConfig = {
    fields: [
      forgeSearchableTextField({
        key: 'strings',
        label: 'Type, Search And Pick A String Value',
        description: 'Type in a string and select it, or search for string values.',
        allowStringValues: true,
        searchOnEmptyText: true,
        search: makeSearchForStringValue(this.searchFn$),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgeSearchableTextField({
        key: 'stringsReadonly',
        label: 'Read-only Text Field',
        description: 'View is read only.',
        readonly: true,
        allowStringValues: true,
        searchOnEmptyText: true,
        search: makeSearchForStringValue(this.searchFn$),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgeSearchableTextField({
        key: 'pickStrings',
        label: 'Search And Pick A String Value only.',
        description: 'Search for values only.',
        allowStringValues: false,
        searchOnEmptyText: false,
        search: makeSearchForStringValue(this.searchFn$),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgeSearchableTextField<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>({
        key: 'models',
        label: 'Search And Pick A Model',
        description: 'Search for models using a string and the default display presentation.',
        allowStringValues: false,
        searchOnEmptyText: true,
        search: EXAMPLE_SEARCH_FOR_SELECTION_VALUE(0),
        displayForValue: EXAMPLE_DISPLAY_FOR_SELECTION_VALUE
      }) as any,
      forgeSearchableTextField<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>({
        key: 'customDisplay',
        label: 'Search And Pick A Model (Custom Display)',
        description: 'Search for models using a string and custom display presentation set on the field.',
        placeholder: 'Type to search (3 characters minimum)',
        allowStringValues: false,
        searchOnEmptyText: true,
        search: EXAMPLE_SEARCH_FOR_SELECTION_VALUE(),
        displayForValue: EXAMPLE_DISPLAY_FOR_SELECTION_VALUE,
        display: {
          componentClass: DocFormExamplePrimarySearchableFieldDisplayComponent
        }
      }) as any,
      forgeSearchableTextField<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>({
        key: 'customDisplayItems',
        label: 'Search And Pick A Model (Custom Display)',
        description: 'Search for models using a string and custom display presentation set per item.',
        placeholder: 'Type to search (3 characters minimum)',
        allowStringValues: false,
        searchOnEmptyText: true,
        search: EXAMPLE_SEARCH_FOR_SELECTION_VALUE(),
        displayForValue: EXAMPLE_DISPLAY_FOR_SELECTION_VALUE_WITH_CUSTOM_DISPLAYS
      }) as any
    ]
  };

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
    formlyDbxListField<DocValue & IndexRef, AbstractDbxSelectionListWrapperDirective<DocValue & IndexRef>>({
      key: 'dbxlist',
      label: 'DbxList Label',
      description: 'Uses a dbxList-related view/wrapper to display a list and select items. Selected items are keyed via a readKey function.',
      state$: this.state$,
      readKey: readIndexNumber,
      loadMore: () => this.loadMore(), // load more is not usual for these as reloading values requires loading more, but it is available for the rare cases.
      listComponentClass: of(DocSelectionItemListComponent as unknown as Type<AbstractDbxSelectionListWrapperDirective<DocValue & IndexRef>>)
    })
  ];

  readonly forgeDbxListFieldConfig: FormConfig = {
    fields: [
      forgeListSelectionField<DocValue & IndexRef, AbstractDbxSelectionListWrapperDirective<DocValue & IndexRef>>({
        key: 'dbxlist',
        label: 'DbxList Label',
        description: 'Uses a dbxList-related view/wrapper to display a list and select items. Selected items are keyed via a readKey function.',
        state$: this.state$,
        readKey: readIndexNumber,
        loadMore: () => this.loadMore(),
        listComponentClass: of(DocSelectionItemListComponent as unknown as Type<AbstractDbxSelectionListWrapperDirective<DocValue & IndexRef>>)
      }) as any
    ]
  };

  readonly initialItemChipFieldsValues$ = of({
    staticLabeledValuesExample: [0, 2, 19].map(String)
  });

  readonly pickableItemChipFields: FormlyFieldConfig[] = [
    formlyPickableItemChipField({
      key: 'stringItemChips',
      label: 'String Item Chips',
      description: 'This is a simple string item chip picker.',
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlyPickableItemChipField({
      key: 'stringItemChipsReadonly',
      label: 'Read Only String Item Chips',
      description: 'This is read only.',
      readonly: true,
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlyPickableItemChipField({
      key: 'singleStringItemChips',
      label: 'Single Selection',
      description: 'This field only allows selecting one item at a time and returns the value by itself',
      multiSelect: false,
      asArrayValue: false,
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlyPickableItemChipField({
      key: 'stringItemChipsWithFilter',
      label: 'String Item Chips With Filter',
      filterLabel: 'Filter',
      description: 'You can filter these items by their label.',
      filterValues: filterPickableItemFieldValuesByLabel,
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlyPickableItemChipField({
      key: 'staticLabeledValuesExample',
      label: 'pickableValueFieldValuesConfigForStaticLabeledValues() Example Usage',
      filterLabel: 'Filter',
      ...pickableValueFieldValuesConfigForStaticLabeledValues(
        range(50)
          .map((x) => String(x))
          .map((value) => ({ label: value.toUpperCase(), value }))
      )
    }),
    formlyPickableItemChipField({
      key: 'stringItemChipsWithFilterDelay',
      label: 'String Item Chips With Filter With Delay',
      filterLabel: 'Filter',
      description: 'You can filter these items by their label.',
      filterValues: (a, b) => filterPickableItemFieldValuesByLabel(a, b).pipe(delay(300)),
      loadValues: () => of(MAKE_RANDOM_STRING_VALUES()),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlyPickableItemChipField({
      key: 'stringItemChipsWithSelectAll',
      label: 'Chips With Select All Button',
      description: 'This chip field has a "Select All" toggle button to select or deselect all items at once.',
      showSelectAllButton: true,
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }, { value: 'd' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    })
  ];

  readonly pickableItemListFields: FormlyFieldConfig[] = [
    formlyPickableItemListField<DocFormExampleSelectionValueId>({
      key: 'stringItemList',
      label: 'String Item List',
      description: 'This is a simple string item list picker.',
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlyPickableItemListField<DocFormExampleSelectionValueId>({
      key: 'stringItemListReadonly',
      label: 'Read Only String Item List',
      readonly: true,
      description: 'This is read only.',
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlyPickableItemListField<DocFormExampleSelectionValueId>({
      key: 'stringItemListSingleValue',
      label: 'String Item List With Single Value Selection',
      description: 'You can only select one value at a time. The value is returned as an array anyways.',
      loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE,
      multiSelect: false,
      asArrayValue: true // return as array anyways
    }),
    formlyPickableItemListField<DocFormExampleSelectionValueId>({
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
    formlySearchableStringChipField({
      key: 'typeAndPickChips',
      label: 'Search And Pick Strings',
      description: 'This input can search for string, but also have an arbitrary value input.',
      searchOnEmptyText: true,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlySearchableStringChipField({
      key: 'typeAndPickChipsReadonly',
      label: 'Read Only Text Field',
      description: 'This input is read-only.',
      readonly: true,
      searchOnEmptyText: true,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlySearchableChipField({
      key: 'pickOnly',
      label: 'Only Pick Strings',
      description: 'This input does not allow arbitrary strings to be input.',
      allowStringValues: false,
      searchOnEmptyText: true,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlySearchableChipField({
      key: 'pickOne',
      label: 'Pick a Single Value',
      description: 'Can only pick one value at a time. Saved as a single value.',
      allowStringValues: false,
      searchOnEmptyText: true,
      multiSelect: false,
      asArrayValue: false,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlySearchableChipField({
      key: 'nonEmptySearch',
      label: 'Search Non-Empty Strings',
      description: 'This input does not search empty string value.',
      allowStringValues: false,
      searchOnEmptyText: false,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlySearchableChipField({
      key: 'customView',
      label: 'Search Non-Empty Strings',
      description: 'This input has custom display configuration.',
      allowStringValues: false,
      searchOnEmptyText: true,
      search: EXAMPLE_SEARCH_FOR_SELECTION_VALUE(),
      displayForValue: EXAMPLE_DISPLAY_FOR_SELECTION_VALUE_WITH_CUSTOM_DISPLAYS
    }),
    formlySearchableStringChipField({
      key: 'validatedUrls',
      label: 'URL Chips With Validation',
      description: 'Type a URL (e.g. https://example.com) and press enter. Invalid URLs are rejected with an inline error. Port numbers like http://localhost:8080 are allowed.',
      searchOnEmptyText: false,
      textInputValidator: isWebsiteUrlValidator({ requirePrefix: true, allowPorts: true }),
      search: () => of([]),
      displayForValue: (values) => of(values.map((v) => ({ ...v, label: v.value })))
    })
  ];

  readonly searchableTextFields: FormlyFieldConfig[] = [
    formlySearchableTextField({
      key: 'strings',
      label: 'Type, Search And Pick A String Value',
      description: 'Type in a string and select it, or search for string values.',
      allowStringValues: true,
      searchOnEmptyText: true,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlySearchableTextField({
      key: 'stringsReadonly',
      label: 'Read-only Text Field',
      description: 'View is read only.',
      readonly: true,
      allowStringValues: true,
      searchOnEmptyText: true,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlySearchableTextField({
      key: 'pickStrings',
      label: 'Search And Pick A String Value only.',
      description: 'Search for values only.',
      allowStringValues: false,
      searchOnEmptyText: false,
      search: makeSearchForStringValue(this.searchFn$),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlySearchableTextField<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>({
      key: 'models',
      label: 'Search And Pick A Model',
      description: 'Search for models using a string and the default display presentation.',
      allowStringValues: false,
      searchOnEmptyText: true,
      search: EXAMPLE_SEARCH_FOR_SELECTION_VALUE(0),
      displayForValue: EXAMPLE_DISPLAY_FOR_SELECTION_VALUE
    }),
    formlySearchableTextField<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>({
      key: 'customDisplay',
      label: 'Search And Pick A Model (Custom Display)',
      description: 'Search for models using a string and custom display presentation set on the field.',
      placeholder: 'Type to search (3 characters minimum)',
      allowStringValues: false,
      searchOnEmptyText: true,
      search: EXAMPLE_SEARCH_FOR_SELECTION_VALUE(),
      displayForValue: EXAMPLE_DISPLAY_FOR_SELECTION_VALUE,
      display: {
        componentClass: DocFormExamplePrimarySearchableFieldDisplayComponent
      }
    }),
    formlySearchableTextField<DocFormExampleSelectionValueId, DocFormExampleSelectionValue>({
      key: 'customDisplayItems',
      label: 'Search And Pick A Model (Custom Display)',
      description: 'Search for models using a string and custom display presentation set per item.',
      placeholder: 'Type to search (3 characters minimum)',
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

  // MARK: Forge Searchable Text with Anchors
  readonly forgeSearchableTextFieldWithAnchorsConfig: FormConfig = {
    fields: [
      forgeSearchableTextField({
        key: 'anchor1',
        label: 'Anchor Segue',
        description: 'Anchors are enabled and set on the field. Result is configured to not show.',
        allowStringValues: false,
        searchOnEmptyText: true,
        search: (_search: string) => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
        displayForValue: DISPLAY_FOR_STRING_VALUE,
        showSelectedValue: false,
        useAnchor: true,
        anchorForValue: (fieldValue) => {
          return {
            onClick: () => {
              this.valueClicked = `Default anchor click: ${fieldValue.value}`;
              safeDetectChanges(this.cdRef);
            }
          };
        }
      }) as any,
      forgeSearchableTextField({
        key: 'anchor2',
        label: 'Anchor Segue',
        description: 'Anchors are set on each item. Result is configured to not show.',
        allowStringValues: false,
        searchOnEmptyText: true,
        showSelectedValue: false,
        search: (_search: string) =>
          of(
            [{ value: 'a' }, { value: 'b' }, { value: 'c' }].map((x) => ({
              ...x,
              anchor: {
                onClick: () => {
                  this.valueClicked = `Per item value: ${x.value}`;
                  safeDetectChanges(this.cdRef);
                }
              }
            }))
          ),
        displayForValue: DISPLAY_FOR_STRING_VALUE
      }) as any,
      forgeSearchableTextField({
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
      }) as any
    ]
  };

  readonly searchableTextFieldsWithAnchors: FormlyFieldConfig[] = [
    formlySearchableTextField({
      key: 'anchor1',
      label: 'Anchor Segue',
      description: 'Anchors are enabled and set on the field. Result is configured to not show.',
      allowStringValues: false,
      searchOnEmptyText: true,
      search: (_search: string) => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
      displayForValue: DISPLAY_FOR_STRING_VALUE,
      showSelectedValue: false,
      useAnchor: true,
      anchorForValue: (fieldValue) => {
        return {
          onClick: () => {
            this.valueClicked = `Default anchor click: ${fieldValue.value}`;
            this.cdRef.detectChanges();
          }
        };
      }
    }),
    formlySearchableTextField({
      key: 'anchor2',
      label: 'Anchor Segue',
      description: 'Anchors are set on each item. Result is configured to not show.',
      allowStringValues: false,
      searchOnEmptyText: true,
      showSelectedValue: false,
      search: (_search: string) =>
        of(
          [{ value: 'a' }, { value: 'b' }, { value: 'c' }].map((x) => ({
            ...x,
            anchor: {
              onClick: () => {
                this.valueClicked = `Per item value: ${x.value}`;
                this.cdRef.detectChanges();
              }
            }
          }))
        ),
      displayForValue: DISPLAY_FOR_STRING_VALUE
    }),
    formlySearchableTextField({
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
            this.cdRef.detectChanges();
          }
        };
      },
      refreshDisplayValues$: this._refreshDisplayValues
    })
  ];

  ngOnInit(): void {
    this.loadMore();
  }

  ngOnDestroy(): void {
    this._searchStrings.complete();
    this._refreshDisplayValues.complete();
  }

  refreshDisplayValues() {
    this._refreshDisplayValues.next(0);
  }
}
