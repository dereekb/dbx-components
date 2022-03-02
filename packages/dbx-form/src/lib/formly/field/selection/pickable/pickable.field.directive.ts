import { DbxInjectedComponentConfig } from "@dereekb/dbx-core";
import { beginLoading, LoadingState, successResult, mapLoadingStateResults, filterMaybe, ListLoadingStateContextInstance, isListLoadingStateEmpty } from "@dereekb/rxjs";
import { convertMaybeToArray, findUnique, makeValuesGroupMap, Maybe } from "@dereekb/util";
import { Directive, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormControl, AbstractControl } from "@angular/forms";
import { MatInput } from "@angular/material/input";
import { FieldTypeConfig, FormlyFieldConfig } from "@ngx-formly/core";
import { FieldType } from "@ngx-formly/material";
import { BehaviorSubject, combineLatest, Observable, of, filter, map, debounceTime, distinctUntilChanged, switchMap, startWith, shareReplay, mergeMap, first, delay } from "rxjs";
import { PickableValueFieldDisplayFn, PickableValueFieldDisplayValue, PickableValueFieldFilterFn, PickableValueFieldHashFn, PickableValueFieldLoadValuesFn, PickableValueFieldValue } from "./pickable";
import { DbxValueListItem } from "@dereekb/dbx-web";
import { camelCase } from "change-case";

/**
 * Wraps the selected state with the items.
 */
export interface PickableItemFieldItem<T> extends DbxValueListItem<PickableValueFieldDisplayValue<T>> { }

export type PickableItemFieldItemSortFn<T> = (items: PickableItemFieldItem<T>[]) => PickableItemFieldItem<T>[];

export interface PickableValueFieldsFieldConfig<T> {
  /**
   * Loads all pickable values.
   */
  loadValues: PickableValueFieldLoadValuesFn<T>;
  /**
   * Used for building a display value given the input.
   */
  displayForValue: PickableValueFieldDisplayFn<T>;
  /**
   * Used for hashing display values and omitting repeat values.
   *
   * If hashForValue is not provided, the value's value will be used as is.
   */
  hashForValue?: PickableValueFieldHashFn<T>;
  /**
   * Used for filtering values via the search text.
   */
  filterValues?: PickableValueFieldFilterFn<T>;
  /**
   * Used for sorting the items before they are displayed.
   * 
   * Should only be used to sort values.
   */
  sortItems?: PickableItemFieldItemSortFn<T>;
  /**
   * Whether or not to allow multiple items to be selected.
   */
  multiSelect?: boolean;
  /**
   * Whether or not to set/get values as an array or a single value. If set false, multiSelect is ignored.
   */
  asArrayValue?: boolean;
  /**
   * Whether or not to show the text filter. True by default if filterValues is provided.
   */
  showTextFilter?: boolean;
  /**
   * Whether or not to skip the filter function when the input is empty.
   * 
   * True by default.
   */
  skipFilterFnOnEmpty?: boolean;
  /**
   * Filter Label
   */
  filterLabel?: string;
  /**
   * The maximum number of values that can be picked
   */
  maxPicks?: number;
  /**
   * Optional description/hint to display.
   */
  description?: string;
  /**
   * Footer Display
   */
  footerConfig?: DbxInjectedComponentConfig;
}

export interface PickableValueFieldsFormlyFieldConfig<T> extends FormlyFieldConfig {
  pickableField: PickableValueFieldsFieldConfig<T>;
}

/**
 * Displayed value with the computed hash.
 */
export interface PickableValueFieldDisplayValueWithHash<T, M = any> extends PickableValueFieldDisplayValue<T, M> {
  _hash: any;
}

/**
 * Used for picking pre-set values using items as the presentation.
 */
@Directive()
export class AbstractDbxPickableItemFieldDirective<T> extends FieldType<PickableValueFieldsFormlyFieldConfig<T> & FieldTypeConfig> implements OnInit, OnDestroy {

  @ViewChild('filterMatInput', { static: true })
  filterMatInput!: MatInput;

  readonly inputCtrl = new FormControl('');

  private _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  private _displayHashMap = new BehaviorSubject<Map<any, PickableValueFieldDisplayValue<T>>>(new Map());

  readonly filterInputValue$: Observable<string> = this.inputCtrl.valueChanges.pipe(startWith(undefined as any));
  readonly filterInputValueString$: Observable<string> = this.filterInputValue$.pipe(
    debounceTime(200),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly loadResultsDisplayValuesState$: Observable<LoadingState<PickableValueFieldDisplayValueWithHash<T>[]>> = this.formControl$.pipe(
    first(),
    switchMap(() => this.loadValuesFn().pipe(
      switchMap((x) => this.loadDisplayValuesForFieldValues(x)),
      startWith(beginLoading<PickableValueFieldDisplayValueWithHash<T>[]>()),
    )),
    shareReplay(1)
  );

  readonly _formControlValue: Observable<T | T[]> = this.formControl$.pipe(
    switchMap(control => control.valueChanges.pipe(
      startWith(control.value),
      shareReplay(1)
    ))
  );

  readonly loadResultsDisplayValues$: Observable<PickableValueFieldDisplayValueWithHash<T>[]> = this.loadResultsDisplayValuesState$.pipe(
    map(x => x?.value ?? [])
  );

  /**
   * Current values in the form control.
   */
  readonly values$: Observable<T[]> = this._formControlValue.pipe(
    map(convertMaybeToArray),
    shareReplay(1)
  );

  /**
   * Current values with their display value.
   */
  readonly displayValuesState$: Observable<LoadingState<PickableValueFieldDisplayValueWithHash<T>[]>> =
    combineLatest([this.loadResultsDisplayValues$, this.values$]).pipe(
      switchMap(([displayValues, currentValues]) => {
        const displayValuesMap = makeValuesGroupMap(displayValues, (x) => this.hashForValue(x.value));
        const valuesNotInDisplayMap: T[] = [];

        currentValues.forEach((x) => {
          const key = this.hashForValue(x);
          let displayValue: Maybe<PickableValueFieldDisplayValueWithHash<T>> = displayValuesMap.get(key)?.[0];

          if (!displayValue) {
            valuesNotInDisplayMap.push(x);
          }
        });

        if (valuesNotInDisplayMap.length) {
          return this.loadDisplayValuesForValues(valuesNotInDisplayMap).pipe(
            map(x => mapLoadingStateResults(x, {
              mapValue: (loadedValues: PickableValueFieldDisplayValueWithHash<T>[]) => {
                loadedValues.forEach(x => x.isUnknown = x.isUnknown ?? true); // Assign unknown flag.
                return ([...displayValues, ...loadedValues]);
              }
            }))
          );
        } else {
          return of(successResult(displayValues));
        }
      })
    );

  /**
   * Results to be displayed if filtered.
   */
  readonly filteredSearchResultsState$: Observable<LoadingState<PickableValueFieldDisplayValueWithHash<T>[]>> = this.loadResultsDisplayValues$.pipe(
    switchMap((values) => this.filterInputValueString$.pipe(
      switchMap(text => combineLatest([this._filterValues(text, values), this.displayValuesState$]).pipe(
        map(([values, displayState]) => mapLoadingStateResults(displayState, {
          mapValue: (displayValues: PickableValueFieldDisplayValueWithHash<T>[]) => {
            const valueHashSet = new Set(values.map(x => this.hashForValue(x)));
            return displayValues.filter(x => !x.isUnknown && valueHashSet.has(x._hash));
          }
        })),
        startWith(beginLoading())
      ))
    )),
    shareReplay(1)
  );

  readonly filteredSearchResults$: Observable<PickableValueFieldDisplayValueWithHash<T>[]> = this.filteredSearchResultsState$.pipe(
    map(x => x?.value),
    filterMaybe(),
    shareReplay(1)
  );

  readonly items$: Observable<PickableItemFieldItem<T>[]> = combineLatest([this.filteredSearchResults$, this.values$]).pipe(
    map(([displayValues, values]) => {
      const selectedHashValuesSet = new Set(values.map(x => this.hashForValue(x)));
      let items: PickableItemFieldItem<T>[] = displayValues.map((x) => ({ value: x, selected: selectedHashValuesSet.has(x._hash) }));

      if (this.sortItems) {
        items = this.sortItems(items);
      }

      return items;
    }),
    shareReplay(1)
  );

  readonly itemsLoadingState$: Observable<LoadingState> = this.loadResultsDisplayValues$.pipe(
    switchMap(x => this.items$.pipe(
      first(),
      map(x => successResult(x)),
      startWith(beginLoading()),
      shareReplay(1)
    ))
  );

  /**
   * Context used for managing the loading of items, or when the current results change.
   */
  readonly context = new ListLoadingStateContextInstance({ obs: this.itemsLoadingState$, showLoadingOnNoValue: false });

  readonly filterItemsLoadingState$: Observable<LoadingState> = this.items$.pipe(
    map(x => successResult(x)),
    startWith(beginLoading()),
    shareReplay(1)
  );

  /**
   * Context used for searching/filtering.
   */
  readonly filterResultsContext = new ListLoadingStateContextInstance({ obs: this.filteredSearchResultsState$, showLoadingOnNoValue: true });

  readonly noItemsAvailable$ = this.filterItemsLoadingState$.pipe(isListLoadingStateEmpty(), distinctUntilChanged());

  get readonly(): Maybe<boolean> {
    return this.field.templateOptions?.readonly;
  }

  get isReadonlyOrDisabled() {
    return this.readonly || this.disabled;
  }

  get pickableField(): PickableValueFieldsFieldConfig<T> {
    return this.field.pickableField;
  }

  get multiSelect(): boolean {
    return this.pickableField.multiSelect ?? true;
  }

  get asArrayValue(): boolean {
    return this.pickableField.asArrayValue ?? true;
  }

  get filterLabel(): Maybe<string> {
    return this.pickableField.filterLabel;
  }

  get name(): string {
    return this.field.name ?? (camelCase(this.label ?? this.key as string));
  }

  get label(): Maybe<string> {
    return this.field.templateOptions?.label;
  }

  get autocomplete(): string {
    return (this.field.templateOptions?.attributes?.['autocomplete'] as any) ?? this.key as string;
  }

  get sortItems(): Maybe<PickableItemFieldItemSortFn<T>> {
    return this.pickableField.sortItems;
  }

  get hashForValue(): PickableValueFieldHashFn<T> {
    return this.pickableField.hashForValue ?? ((x) => x as any);
  }

  get displayForValue(): PickableValueFieldDisplayFn<T> {
    return this.pickableField.displayForValue;
  }

  get showFilterInput(): boolean {
    return Boolean(this.pickableField.filterValues);
  }

  get filterValuesFn(): PickableValueFieldFilterFn<T> {
    return this.pickableField.filterValues ?? ((_, x) => of(x.map(y => y.value)));
  }

  get skipFilterFnOnEmpty(): boolean {
    return this.pickableField.skipFilterFnOnEmpty ?? true;
  }

  get _filterValues(): PickableValueFieldFilterFn<T> {
    let fn: PickableValueFieldFilterFn<T>;

    if (this.skipFilterFnOnEmpty) {
      fn = (filterText: Maybe<string>, values: PickableValueFieldDisplayValue<T>[]): Observable<T[]> => {
        let result: Observable<T[]>;

        if (filterText) {
          result = this.filterValuesFn(filterText, values);
        } else {
          result = of(values.map(x => x.value));
        }

        return result;
      };
    } else {
      fn = this.filterValuesFn;
    }

    return fn;
  }

  get showTextFilter(): boolean {
    return this.pickableField.showTextFilter ?? Boolean(this.pickableField.filterValues);
  }

  get loadValuesFn(): PickableValueFieldLoadValuesFn<T> {
    return this.pickableField.loadValues;
  }

  get values(): T[] {
    return this._getValueOnFormControl(this.formControl.value) ?? [];
  }

  get footerConfig(): Maybe<DbxInjectedComponentConfig> {
    return this.pickableField.footerConfig;
  }

  loadDisplayValuesForValues(values: T[]): Observable<LoadingState<PickableValueFieldDisplayValueWithHash<T>[]>> {
    return this.loadDisplayValuesForFieldValues(values.map((value) => ({ value })));
  }

  loadDisplayValuesForFieldValues(values: PickableValueFieldValue<T>[]): Observable<LoadingState<PickableValueFieldDisplayValueWithHash<T>[]>> {
    return this.getDisplayValuesForFieldValues(values).pipe(
      map((displayValues: PickableValueFieldDisplayValueWithHash<T>[]) => successResult(displayValues)),
      startWith(beginLoading()),
      shareReplay(1)
    );
  }

  getDisplayValuesForFieldValues(values: PickableValueFieldValue<T>[]): Observable<PickableValueFieldDisplayValueWithHash<T>[]> {
    return this._displayHashMap.pipe(
      mergeMap((displayMap) => {
        const mappingResult = values
          .map(x => [x, this.hashForValue(x.value)])
          .map(([x, hash], i) => [i, hash, x, displayMap.get(hash)] as [number, any, PickableValueFieldValue<T>, PickableValueFieldDisplayValueWithHash<T>]);

        const hasDisplay = mappingResult.filter(x => Boolean(x[3]));
        const needsDisplay = mappingResult.filter(x => !x[3]);

        if (needsDisplay.length > 0) {

          // Go get the display value.
          const displayValuesObs = this.displayForValue(needsDisplay.map(x => x[2]));

          return displayValuesObs.pipe(
            first(),
            map((displayResults) => {

              const displayResultsWithHash: PickableValueFieldDisplayValueWithHash<T>[] = displayResults.map((x) => {
                (x as PickableValueFieldDisplayValueWithHash<T>)._hash = this.hashForValue(x.value);
                return (x as PickableValueFieldDisplayValueWithHash<T>);
              });

              // Create a map to re-join values later.
              const displayResultsMapping: [PickableValueFieldDisplayValueWithHash<T>, any][] = displayResultsWithHash.map(x => [x, x._hash]);
              const valueIndexHashMap = new Map(displayResultsMapping.map(([x, hash]) => [hash, x]));

              // Update displayMap. No need to push an update notification.
              displayResultsMapping.forEach(([x, hash]) => displayMap.set(hash, x));

              // Zip values back together.
              const newDisplayValues = mappingResult.map(x => x[3] ?? valueIndexHashMap.get(x[1]));

              // Return display values.
              return newDisplayValues;
            })
          );
        } else {

          // If all display values are hashed return that.
          return of(hasDisplay.map(x => x[3])) as Observable<PickableValueFieldDisplayValueWithHash<T>[]>;
        }
      })
    );
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this._formControlObs.next(this.formControl);

    // Focus after finished loading for the first time.
    this.context.loading$.pipe(
      delay(10),
      filter(x => x),
      first(),
    ).subscribe(() => {
      this.filterMatInput?.focus();
    })
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._displayHashMap.complete();
    this._formControlObs.complete();
    this.filterResultsContext.destroy();
  }

  protected _getValueOnFormControl(valueOnFormControl: any): T[] {
    const value = (valueOnFormControl != null) ? [].concat(valueOnFormControl) : [];  // Always return an array.
    return value as T[];
  }

  addValue(value: T): void {
    this.setValues([...this.values, value]);
  }

  removeValue(value: T): void {
    const hashToFilter = this.hashForValue(value);
    const values = this.values.filter(x => this.hashForValue(x) !== hashToFilter);
    this.setValues(values);
  }

  setValues(values: T[]): void {

    // Use to filter non-unique values.
    if (this.hashForValue) {
      values = findUnique(values, this.hashForValue);
    }

    if (!this.multiSelect) {
      values = [values[0]].filter(x => x != null);
    }

    this._setValueOnFormControl(values);
  }

  // MARK: Internal
  protected _setValueOnFormControl(values: T[]): void {
    let newValue: T | T[] = values;

    if (!this.asArrayValue) {
      newValue = [values[0]].filter(x => x != null)[0];
    }

    this.formControl.setValue(newValue);
    this.formControl.markAsTouched();
    this.formControl.markAsDirty();
  }

}
