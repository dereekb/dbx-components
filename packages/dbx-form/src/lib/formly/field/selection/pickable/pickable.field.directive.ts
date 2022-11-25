import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { LoadingState, successResult, mapLoadingStateResults, filterMaybe, ListLoadingStateContextInstance, isListLoadingStateEmpty, startWithBeginLoading } from '@dereekb/rxjs';
import { PrimativeKey, convertMaybeToArray, findUnique, makeValuesGroupMap, Maybe, ArrayOrValue } from '@dereekb/util';
import { Directive, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, AbstractControl } from '@angular/forms';
import { MatInput } from '@angular/material/input';
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { FieldType } from '@ngx-formly/material';
import { BehaviorSubject, combineLatest, Observable, of, filter, map, debounceTime, distinctUntilChanged, switchMap, startWith, shareReplay, mergeMap, first, delay } from 'rxjs';
import { PickableValueFieldDisplayFn, PickableValueFieldDisplayValue, PickableValueFieldFilterFn, PickableValueFieldHashFn, PickableValueFieldLoadValuesFn, PickableValueFieldValue } from './pickable';
import { DbxValueListItem } from '@dereekb/dbx-web';
import { camelCase } from 'change-case';

/**
 * Wraps the selected state with the items.
 */
export type PickableItemFieldItem<T, M = unknown> = DbxValueListItem<PickableValueFieldDisplayValue<T, M>>;

export type PickableItemFieldItemSortFn<T, M = unknown> = (items: PickableItemFieldItem<T, M>[]) => PickableItemFieldItem<T, M>[];

export interface PickableValueFieldsFieldProps<T, M = unknown, H extends PrimativeKey = PrimativeKey> extends FormlyFieldProps {
  /**
   * Loads all pickable values.
   */
  loadValues: PickableValueFieldLoadValuesFn<T, M>;
  /**
   * Used for building a display value given the input.
   */
  displayForValue: PickableValueFieldDisplayFn<T, M>;
  /**
   * Used for hashing display values and omitting repeat values.
   *
   * If hashForValue is not provided, the value's value will be used as is.
   */
  hashForValue?: PickableValueFieldHashFn<T, H>;
  /**
   * Used for filtering values via the search text.
   */
  filterValues?: PickableValueFieldFilterFn<T, M>;
  /**
   * Used for sorting the items before they are displayed.
   *
   * Should only be used to sort values.
   */
  sortItems?: PickableItemFieldItemSortFn<T, M>;
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
  footerConfig?: DbxInjectionComponentConfig;
  /**
   * Changes the selection mode of the list to "view" mode on disabled, hiding the selection boxes.
   */
  changeSelectionModeToViewOnDisabled?: boolean;
}

/**
 * Displayed value with the computed hash.
 */
export interface PickableValueFieldDisplayValueWithHash<T, M = unknown, H extends PrimativeKey = PrimativeKey> extends PickableValueFieldDisplayValue<T, M> {
  _hash: H;
}

/**
 * Used for picking pre-set values using items as the presentation.
 */
@Directive()
export class AbstractDbxPickableItemFieldDirective<T, M = unknown, H extends PrimativeKey = PrimativeKey> extends FieldType<FieldTypeConfig<PickableValueFieldsFieldProps<T, M, H>>> implements OnInit, OnDestroy {
  @ViewChild('filterMatInput', { static: true })
  filterMatInput!: MatInput;

  readonly inputCtrl = new FormControl('');

  private _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  private _displayHashMap = new BehaviorSubject<Map<H, PickableValueFieldDisplayValue<T, M>>>(new Map());

  readonly filterInputValue$: Observable<Maybe<string>> = this.inputCtrl.valueChanges.pipe(startWith(undefined));
  readonly filterInputValueString$: Observable<Maybe<string>> = this.filterInputValue$.pipe(debounceTime(200), distinctUntilChanged(), shareReplay(1));

  readonly loadResultsDisplayValuesState$: Observable<LoadingState<PickableValueFieldDisplayValueWithHash<T, M, H>[]>> = this.formControl$.pipe(
    first(),
    switchMap(() =>
      this.loadValuesFn().pipe(
        switchMap((x) => this.loadDisplayValuesForFieldValues(x)),
        startWithBeginLoading()
      )
    ),
    shareReplay(1)
  );

  readonly _formControlValue$: Observable<T | T[]> = this.formControl$.pipe(switchMap((control) => control.valueChanges.pipe(startWith(control.value), shareReplay(1))));

  readonly loadResultsDisplayValues$: Observable<PickableValueFieldDisplayValueWithHash<T, M, H>[]> = this.loadResultsDisplayValuesState$.pipe(map((x) => x?.value ?? []));

  /**
   * Current values in the form control.
   */
  readonly values$: Observable<T[]> = this._formControlValue$.pipe(map(convertMaybeToArray), shareReplay(1));

  /**
   * Current values with their display value.
   */
  readonly displayValuesState$: Observable<LoadingState<PickableValueFieldDisplayValueWithHash<T, M, H>[]>> = combineLatest([this.loadResultsDisplayValues$, this.values$]).pipe(
    switchMap(([displayValues, currentValues]) => {
      const displayValuesMap = makeValuesGroupMap(displayValues, (x) => this.hashForValue(x.value));
      const valuesNotInDisplayMap: T[] = [];

      currentValues.forEach((x) => {
        const key = this.hashForValue(x);
        const displayValue: Maybe<PickableValueFieldDisplayValueWithHash<T, M, H>> = displayValuesMap.get(key)?.[0];

        if (!displayValue) {
          valuesNotInDisplayMap.push(x);
        }
      });

      if (valuesNotInDisplayMap.length) {
        return this.loadDisplayValuesForValues(valuesNotInDisplayMap).pipe(
          map((x) =>
            mapLoadingStateResults(x, {
              mapValue: (loadedValues: PickableValueFieldDisplayValueWithHash<T, M, H>[]) => {
                loadedValues.forEach((x) => (x.isUnknown = x.isUnknown ?? true)); // Assign unknown flag.
                return [...displayValues, ...loadedValues];
              }
            })
          )
        );
      } else {
        return of(successResult(displayValues));
      }
    })
  );

  /**
   * Results to be displayed if filtered.
   */
  readonly filteredSearchResultsState$: Observable<LoadingState<PickableValueFieldDisplayValueWithHash<T, M, H>[]>> = this.loadResultsDisplayValues$.pipe(
    switchMap((values) =>
      this.filterInputValueString$.pipe(
        switchMap((text) =>
          combineLatest([this._filterValues(text, values), this.displayValuesState$]).pipe(
            map(([values, displayState]) =>
              mapLoadingStateResults(displayState, {
                mapValue: (displayValues: PickableValueFieldDisplayValueWithHash<T, M, H>[]) => {
                  const valueHashSet = new Set(values.map((x) => this.hashForValue(x)));
                  return displayValues.filter((x) => !x.isUnknown && valueHashSet.has(x._hash));
                }
              })
            ),
            startWithBeginLoading()
          )
        )
      )
    ),
    shareReplay(1)
  );

  readonly filteredSearchResults$: Observable<PickableValueFieldDisplayValueWithHash<T, M, H>[]> = this.filteredSearchResultsState$.pipe(
    map((x) => x?.value),
    filterMaybe(),
    shareReplay(1)
  );

  readonly items$: Observable<PickableItemFieldItem<T, M>[]> = combineLatest([this.filteredSearchResults$, this.values$]).pipe(
    map(([displayValues, values]) => {
      const selectedHashValuesSet = new Set(values.map((x) => this.hashForValue(x)));
      let items: PickableItemFieldItem<T, M>[] = displayValues.map((x) => ({ itemValue: x, selected: selectedHashValuesSet.has(x._hash) }));

      if (this.sortItems) {
        items = this.sortItems(items);
      }

      return items;
    }),
    shareReplay(1)
  );

  readonly itemsLoadingState$: Observable<LoadingState<PickableItemFieldItem<T>[]>> = this.loadResultsDisplayValues$.pipe(
    switchMap(() =>
      this.items$.pipe(
        first(),
        map((x) => successResult(x)),
        startWithBeginLoading(),
        shareReplay(1)
      )
    )
  );

  /**
   * Context used for managing the loading of items, or when the current results change.
   */
  readonly context = new ListLoadingStateContextInstance({ obs: this.itemsLoadingState$, showLoadingOnNoValue: false });

  readonly filterItemsLoadingState$: Observable<LoadingState<PickableItemFieldItem<T>[]>> = this.items$.pipe(
    map((x) => successResult(x)),
    startWithBeginLoading(),
    shareReplay(1)
  );

  /**
   * Context used for searching/filtering.
   */
  readonly filterResultsContext = new ListLoadingStateContextInstance({ obs: this.filteredSearchResultsState$, showLoadingOnNoValue: true });

  readonly noItemsAvailable$ = this.filterItemsLoadingState$.pipe(isListLoadingStateEmpty(), distinctUntilChanged());

  get readonly(): Maybe<boolean> {
    return this.props.readonly;
  }

  get isReadonlyOrDisabled() {
    return this.readonly || this.disabled;
  }

  get pickableField(): PickableValueFieldsFieldProps<T, M, H> {
    return this.props;
  }

  get multiSelect(): boolean {
    return this.pickableField.multiSelect ?? true;
  }

  get asArrayValue(): boolean {
    return this.pickableField.asArrayValue ?? true;
  }

  get pickOnlyOne(): boolean {
    return this.asArrayValue === false || this.multiSelect === false;
  }

  get filterLabel(): Maybe<string> {
    return this.pickableField.filterLabel;
  }

  get name(): string {
    return this.field.name ?? camelCase(this.label ?? (this.key as string));
  }

  get label(): Maybe<string> {
    return this.props.label;
  }

  get autocomplete(): string {
    return (this.props.attributes?.['autocomplete'] ?? this.key) as string;
  }

  get changeSelectionModeToViewOnDisabled(): boolean {
    return this.pickableField.changeSelectionModeToViewOnDisabled ?? false;
  }

  get sortItems(): Maybe<PickableItemFieldItemSortFn<T, M>> {
    return this.pickableField.sortItems;
  }

  get hashForValue(): PickableValueFieldHashFn<T, H> {
    return this.pickableField.hashForValue ?? ((x) => x as unknown as H);
  }

  get displayForValue(): PickableValueFieldDisplayFn<T, M> {
    return this.pickableField.displayForValue;
  }

  get showFilterInput(): boolean {
    return Boolean(this.pickableField.filterValues);
  }

  get filterValuesFn(): PickableValueFieldFilterFn<T, M> {
    return this.pickableField.filterValues ?? ((_, x) => of(x.map((y) => y.value)));
  }

  get skipFilterFnOnEmpty(): boolean {
    return this.pickableField.skipFilterFnOnEmpty ?? true;
  }

  get _filterValues(): PickableValueFieldFilterFn<T, M> {
    let fn: PickableValueFieldFilterFn<T, M>;

    if (this.skipFilterFnOnEmpty) {
      fn = (filterText: Maybe<string>, values: PickableValueFieldDisplayValue<T, M>[]): Observable<T[]> => {
        let result: Observable<T[]>;

        if (filterText) {
          result = this.filterValuesFn(filterText, values);
        } else {
          result = of(values.map((x) => x.value));
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

  get loadValuesFn(): PickableValueFieldLoadValuesFn<T, M> {
    return this.pickableField.loadValues;
  }

  get values(): T[] {
    return this._getValueOnFormControl(this.formControl.value) ?? [];
  }

  get footerConfig(): Maybe<DbxInjectionComponentConfig> {
    return this.pickableField.footerConfig;
  }

  loadDisplayValuesForValues(values: T[]): Observable<LoadingState<PickableValueFieldDisplayValueWithHash<T, M, H>[]>> {
    return this.loadDisplayValuesForFieldValues(values.map((value) => ({ value })));
  }

  loadDisplayValuesForFieldValues(values: PickableValueFieldValue<T, M>[]): Observable<LoadingState<PickableValueFieldDisplayValueWithHash<T, M, H>[]>> {
    return this.getDisplayValuesForFieldValues(values).pipe(
      map((displayValues: PickableValueFieldDisplayValueWithHash<T, M, H>[]) => successResult(displayValues)),
      startWithBeginLoading(),
      shareReplay(1)
    );
  }

  getDisplayValuesForFieldValues(values: PickableValueFieldValue<T, M>[]): Observable<PickableValueFieldDisplayValueWithHash<T, M, H>[]> {
    return this._displayHashMap.pipe(
      mergeMap((displayMap) => {
        const mappingResult = values.map((x) => [x, this.hashForValue(x.value)] as [PickableValueFieldValue<T, M>, H]).map(([x, hash], i) => [i, hash, x, displayMap.get(hash)] as [number, H, PickableValueFieldValue<T, M>, PickableValueFieldDisplayValueWithHash<T, M, H>]);

        const hasDisplay = mappingResult.filter((x) => Boolean(x[3]));
        const needsDisplay = mappingResult.filter((x) => !x[3]);

        if (needsDisplay.length > 0) {
          // Go get the display value.
          const displayValuesObs = this.displayForValue(needsDisplay.map((x) => x[2]));

          return displayValuesObs.pipe(
            first(),
            map((displayResults) => {
              const displayResultsWithHash: PickableValueFieldDisplayValueWithHash<T, M, H>[] = displayResults.map((x) => {
                (x as PickableValueFieldDisplayValueWithHash<T, M, H>)._hash = this.hashForValue(x.value);
                return x as PickableValueFieldDisplayValueWithHash<T, M, H>;
              });

              // Create a map to re-join values later.
              const displayResultsMapping: [PickableValueFieldDisplayValueWithHash<T, M, H>, H][] = displayResultsWithHash.map((x) => [x, x._hash]);
              const valueIndexHashMap = new Map(displayResultsMapping.map(([x, hash]) => [hash, x]));

              // Update displayMap. No need to push an update notification.
              displayResultsMapping.forEach(([x, hash]) => displayMap.set(hash, x));

              // Zip values back together.
              const newDisplayValues = mappingResult.map((x) => x[3] ?? valueIndexHashMap.get(x[1]));

              // Return display values.
              return newDisplayValues;
            })
          );
        } else {
          // If all display values are hashed return that.
          return of(hasDisplay.map((x) => x[3])) as Observable<PickableValueFieldDisplayValueWithHash<T, M, H>[]>;
        }
      })
    );
  }

  ngOnInit(): void {
    this._formControlObs.next(this.formControl);

    // Focus after finished loading for the first time.
    this.context.loading$
      .pipe(
        delay(10),
        filter((x) => x),
        first()
      )
      .subscribe(() => {
        this.filterMatInput?.focus();
      });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._displayHashMap.complete();
    this._formControlObs.complete();
    this.filterResultsContext.destroy();
  }

  protected _getValueOnFormControl(valueOnFormControl: ArrayOrValue<T>): T[] {
    const value: T[] = valueOnFormControl != null ? ([] as T[]).concat(valueOnFormControl) : []; // Always return an array.
    return value;
  }

  addValue(value: T): void {
    let newValues: T[];

    if (this.pickOnlyOne) {
      newValues = [value];
    } else {
      newValues = [...this.values, value];
    }

    this.setValues(newValues);
  }

  removeValue(value: T): void {
    const hashToFilter = this.hashForValue(value);
    const values = this.values.filter((x) => this.hashForValue(x) !== hashToFilter);
    this.setValues(values);
  }

  setValues(values: T[]): void {
    // Use to filter non-unique values.
    if (this.hashForValue) {
      values = findUnique(values, this.hashForValue);
    }

    if (this.pickOnlyOne) {
      values = [values[0]].filter((x) => x != null);
    }

    this._setValueOnFormControl(values);
  }

  // MARK: Internal
  protected _setValueOnFormControl(values: T[]): void {
    let newValue: T | T[] = values;

    if (!this.asArrayValue) {
      newValue = [values[0]].filter((x) => x != null)[0];
    }

    this.formControl.setValue(newValue);
    this.formControl.markAsTouched();
    this.formControl.markAsDirty();
  }
}
