import { ArrayOrValue, Maybe, convertMaybeToArray, lastValue, PrimativeKey, separateValues, asArray, filterUniqueValues, Configurable } from '@dereekb/util';
import { DbxInjectionComponentConfig, mergeDbxInjectionComponentConfigs } from '@dereekb/dbx-core';
import { filterMaybe, SubscriptionObject, LoadingState, successResult, startWithBeginLoading, loadingStateContext, isLoadingStateInLoadingState } from '@dereekb/rxjs';
import { Directive, ElementRef, OnDestroy, OnInit, viewChild } from '@angular/core';
import { AbstractControl, FormControl, ValidatorFn } from '@angular/forms';
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { FieldType } from '@ngx-formly/material';
import { debounceTime, distinctUntilChanged, first, map, mergeMap, shareReplay, startWith, switchMap, BehaviorSubject, of, Observable } from 'rxjs';
import { SearchableValueFieldHashFn, SearchableValueFieldStringSearchFn, SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue, SearchableValueFieldValue, SearchableValueFieldAnchorFn, ConfiguredSearchableValueFieldDisplayValue } from './searchable';
import { DbxDefaultSearchableFieldDisplayComponent } from './searchable.field.autocomplete.item.component';
import { camelCase } from 'change-case-all';
import { toSignal } from '@angular/core/rxjs-interop';

export interface StringValueFieldsFieldProps extends FormlyFieldProps {
  /**
   * Custom input validators.
   */
  readonly textInputValidator?: ValidatorFn | ValidatorFn[];
}

export interface SearchableValueFieldsFieldProps<T, M = unknown, H extends PrimativeKey = PrimativeKey> extends FormlyFieldProps, StringValueFieldsFieldProps {
  /**
   * Whether or not to allow string values to be used directly, or if values can only be chosen from searching.
   */
  readonly allowStringValues?: boolean;
  /**
   * Whether or not to set/get values as an array or a single value. If set false, multiSelect is ignored.
   */
  readonly asArrayValue?: boolean;
  /**
   * Optional conversion function. If provided, allowStringValues is considered true.
   */
  readonly convertStringValue?: (text: string) => T;
  /**
   * Used for hashing display values and omitting repeat values.
   *
   * If hashForValue is not provided, the value's value will be used as is.
   */
  readonly hashForValue?: SearchableValueFieldHashFn<T, H>;
  /**
   * Performs a search.
   */
  readonly search: SearchableValueFieldStringSearchFn<T, M>;
  /**
   * Whether or not to allow searches on empty text. Is false by default.
   */
  readonly searchOnEmptyText?: boolean;
  /**
   * Default injected config to use for display values.
   */
  readonly display?: Partial<DbxInjectionComponentConfig>;
  /**
   * Used for building a display value given the input.
   */
  readonly displayForValue: SearchableValueFieldDisplayFn<T, M>;
  /**
   * Whether or not to use the anchor field on value elements.
   *
   * This has no default effect if a component class is provided.
   */
  readonly useAnchor?: boolean;
  /**
   * Used for retrieving an anchor value for values that have no anchor value set.
   *
   * Only used when useAnchor is true.
   */
  readonly anchorForValue?: SearchableValueFieldAnchorFn<T, M>;
  /**
   * Whether or not to show "Clear" in the autcomplete list.
   */
  readonly showClearValue?: boolean;
  /**
   * Label for the search input.
   *
   * Defaults to "Search"
   */
  readonly searchLabel?: string;
  /**
   * (Optional) observable that will trigger the clearing of all cached display values.
   */
  readonly refreshDisplayValues$?: Observable<unknown>;
}

const DEFAULT_SEARCH_INPUT_PLACEHOLDER = 'Type to Search';

const DEFAULT_SEARCHABLE_FIELD_DISPLAY: Partial<DbxInjectionComponentConfig> = {
  componentClass: DbxDefaultSearchableFieldDisplayComponent
};

/**
 * Abstract searchable field that provides a feature for searching for values, and for displaying values using Observables.
 *
 * Display values are cached for performance.
 */
@Directive()
export abstract class AbstractDbxSearchableValueFieldDirective<T, M = unknown, H extends PrimativeKey = PrimativeKey, C extends SearchableValueFieldsFieldProps<T, M, H> = SearchableValueFieldsFieldProps<T, M, H>> extends FieldType<FieldTypeConfig<C>> implements OnInit, OnDestroy {
  /**
   * Whether or not to set/get values as an array.
   */
  abstract get multiSelect(): boolean;

  /**
   * Optional override set by the parent class for whether or not to allow the current value to sync to the input.
   */
  allowSyncValueToInput = false;

  /**
   * Default placeholder text to use when searchOnEmptyText is false.
   */
  defaultSearchInputPlaceholder?: Maybe<string> = DEFAULT_SEARCH_INPUT_PLACEHOLDER;

  readonly textInput = viewChild<string, ElementRef<HTMLInputElement>>('textInput', { read: ElementRef<HTMLInputElement> });

  readonly inputCtrl = new FormControl<string>('');

  private readonly _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  private readonly _clearDisplayHashMapSub = new SubscriptionObject();
  private readonly _displayHashMap = new BehaviorSubject<Map<H, ConfiguredSearchableValueFieldDisplayValue<T, M>>>(new Map());

  readonly inputValue$: Observable<string> = this.inputCtrl.valueChanges.pipe(
    startWith(this.inputCtrl.value),
    map((x) => x || '')
  );

  readonly inputValueString$: Observable<string> = this.inputValue$.pipe(debounceTime(200), distinctUntilChanged());

  readonly searchResultsState$: Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> = this.inputValueString$.pipe(
    switchMap((text) =>
      (text || this.searchOnEmptyText ? this.search(text ?? '') : of([])).pipe(
        switchMap((x) => this.loadDisplayValuesForFieldValues(x)),
        // Return begin loading to setup the loading state.
        startWithBeginLoading()
      )
    ),
    shareReplay(1)
  );

  private readonly _singleValueSyncSubscription = new SubscriptionObject();

  readonly searchContext = loadingStateContext({ obs: this.searchResultsState$, showLoadingOnNoValue: false });
  readonly searchResults$: Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> = this.searchResultsState$.pipe(
    map((x) => x?.value ?? []),
    shareReplay(1)
  );
  readonly isLoadingSearchResults$: Observable<boolean> = this.searchResultsState$.pipe(map(isLoadingStateInLoadingState), distinctUntilChanged(), shareReplay(1));

  readonly _formControlValue$: Observable<T | T[]> = this.formControl$.pipe(switchMap((control) => control.valueChanges.pipe(startWith(control.value), shareReplay(1))));

  readonly values$: Observable<T[]> = this._formControlValue$.pipe(map(convertMaybeToArray), shareReplay(1));

  readonly displayValuesState$: Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> = this.values$.pipe(
    distinctUntilChanged(),
    switchMap((values: T[]) => this.loadDisplayValuesForValues(values)),
    shareReplay(1)
  );

  readonly displayValues$: Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> = this.displayValuesState$.pipe(map((x) => x?.value ?? []));

  readonly inputValueSignal = toSignal(this.inputValue$);
  readonly searchResultsSignal = toSignal(this.searchResults$);
  readonly displayValuesSignal = toSignal(this.displayValues$);

  readonly isLoadingSearchResultsSignal = toSignal(this.isLoadingSearchResults$);

  get name(): string {
    return this.field.name ?? camelCase(this.label ?? (this.key as string));
  }

  get label(): Maybe<string> {
    return this.props.label;
  }

  get readonly(): Maybe<boolean> {
    return this.props.readonly;
  }

  get isReadonlyOrDisabled() {
    return this.readonly || this.disabled;
  }

  get searchableField(): SearchableValueFieldsFieldProps<T, M, H> {
    return this.props;
  }

  get asArrayValue(): boolean {
    return this.searchableField.asArrayValue ?? true;
  }

  get pickOnlyOne(): boolean {
    return this.asArrayValue === false || this.multiSelect === false;
  }

  get searchOnEmptyText(): boolean {
    return this.searchableField.searchOnEmptyText ?? false;
  }

  get searchInputPlaceholder(): string | '' {
    const searchOnEmpty = this.searchOnEmptyText;
    const placeholder = this.searchableField.placeholder;
    const test = placeholder || (searchOnEmpty ? undefined : this.defaultSearchInputPlaceholder) || '';
    return test;
  }

  get autocomplete(): string {
    return (this.props.attributes?.['autocomplete'] ?? this.key) as string;
  }

  get hashForValue(): SearchableValueFieldHashFn<T, H> {
    return this.searchableField.hashForValue ?? ((x) => x as unknown as H);
  }

  get displayForValue(): SearchableValueFieldDisplayFn<T, M> {
    return this.searchableField.displayForValue;
  }

  get useAnchor(): Maybe<boolean> {
    return this.searchableField.useAnchor;
  }

  get anchorForValue(): Maybe<SearchableValueFieldAnchorFn<T, M>> {
    return this.searchableField.anchorForValue;
  }

  get display(): Maybe<Partial<DbxInjectionComponentConfig>> {
    return this.searchableField.display;
  }

  get search(): SearchableValueFieldStringSearchFn<T, M> {
    return this.searchableField.search;
  }

  get values(): T[] {
    return this._getValueOnFormControl(this.formControl.value) ?? [];
  }

  get allowStringValues(): boolean {
    return this.searchableField.allowStringValues ?? Boolean(this.convertStringValue);
  }

  get convertStringValue(): Maybe<(text: string) => T> {
    return this.searchableField.convertStringValue;
  }

  get showClearValue(): boolean {
    return this.searchableField.showClearValue ?? true;
  }

  get searchLabel() {
    return this.searchableField.searchLabel ?? 'Search';
  }

  get refreshDisplayValues$() {
    return this.searchableField.refreshDisplayValues$;
  }

  loadDisplayValuesForValues(values: T[]): Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> {
    return this.loadDisplayValuesForFieldValues(values.map((value) => ({ value })));
  }

  loadDisplayValuesForFieldValues(values: SearchableValueFieldValue<T, M>[]): Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> {
    return this.getDisplayValuesForFieldValues(values).pipe(
      map((displayValues: ConfiguredSearchableValueFieldDisplayValue<T, M>[]) => successResult(displayValues)),
      startWithBeginLoading(),
      shareReplay(1)
    );
  }

  getDisplayValuesForFieldValues(values: SearchableValueFieldValue<T, M>[]): Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> {
    return this._displayHashMap.pipe(
      mergeMap((displayMap) => {
        const mappingResult = values.map((x) => [x, this.hashForValue(x.value)] as [SearchableValueFieldValue<T, M>, H]).map(([x, hash], i) => [i, hash, x, displayMap.get(hash)] as [number, H, SearchableValueFieldValue<T, M>, ConfiguredSearchableValueFieldDisplayValue<T, M>]);

        const {
          //
          included: hasDisplay,
          excluded: needsDisplay
        } = separateValues(mappingResult, (x) => Boolean(x[3]));

        let obs: Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>;

        if (needsDisplay.length > 0) {
          // Go get the display value.
          const displayValuesObs = this.displayForValue(needsDisplay.map((x) => x[2]));
          const defaultDisplay = mergeDbxInjectionComponentConfigs([DEFAULT_SEARCHABLE_FIELD_DISPLAY, this.display]);

          const anchorForValue = this.useAnchor && this.anchorForValue;

          obs = displayValuesObs.pipe(
            first(),
            map((displayResults) => {
              // Assign the default component classes to complete configuration.
              (displayResults as Configurable<SearchableValueFieldDisplayValue<T, M>>[]).forEach((x) => {
                if (!x.display) {
                  x.display = defaultDisplay;
                } else {
                  x.display = mergeDbxInjectionComponentConfigs([defaultDisplay, x.display]);
                }

                if (!x.anchor && anchorForValue) {
                  x.anchor = anchorForValue(x);
                }
              });

              // Create a map to re-join values later.
              const displayResultsMapping: [ConfiguredSearchableValueFieldDisplayValue<T, M>, H][] = (displayResults as ConfiguredSearchableValueFieldDisplayValue<T, M>[]).map((x) => [x, this.hashForValue(x.value)]);
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
          obs = of(hasDisplay.map((x) => x[3]));
        }

        return obs;
      })
    );
  }

  ngOnInit(): void {
    this._formControlObs.next(this.formControl);

    if (this.refreshDisplayValues$ != null) {
      this._clearDisplayHashMapSub.subscription = this.refreshDisplayValues$.subscribe(() => this._displayHashMap.next(new Map()));
    }

    if (this.searchableField.textInputValidator) {
      this.inputCtrl.setValidators(this.searchableField.textInputValidator);
    }

    if (this.allowSyncValueToInput && this.multiSelect === false) {
      this._singleValueSyncSubscription.subscription = this.displayValues$.subscribe((x) => {
        if (x[0]) {
          this._syncSingleValue(x[0]);
        }
      });
    }
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._clearDisplayHashMapSub.destroy();
    this._displayHashMap.complete();
    this._singleValueSyncSubscription.destroy();
    this._formControlObs.complete();
    this.searchContext.destroy();
  }

  /**
   * Used to sync the input control with the selected value.
   *
   * Only used when multiSelect is false.
   */
  protected _syncSingleValue(value: SearchableValueFieldDisplayValue<T>): void {
    this.inputCtrl.setValue(value.label);
  }

  protected _addWithTextValue(text: string): void {
    if (!this.searchableField.allowStringValues) {
      return;
    }

    if (text) {
      text = (text || '').trim();
      this.inputCtrl.setValue(text.trim());
    }

    if (!this.inputCtrl.valid) {
      return;
    }

    if (text) {
      const value = this.convertStringValue ? this.convertStringValue(text) : (text as unknown as T);
      this.addValue(value);
    }
  }

  addWithDisplayValue(displayValue: SearchableValueFieldDisplayValue<T>): void {
    this.addValue(displayValue.value);
  }

  removeWithDisplayValue(displayValue: SearchableValueFieldDisplayValue<T>): void {
    this.removeValue(displayValue.value);
  }

  _tryAddCurrentInputValue(): boolean {
    let addedValue = false;

    if (this.allowStringValues) {
      const value = this.inputCtrl.value || '';

      if ((value || '').trim()) {
        this._addWithTextValue(value);
        addedValue = true;
      }
    }

    return addedValue;
  }

  addValue(value: T): void {
    const textInput = this.textInput();

    if (textInput) {
      textInput.nativeElement.value = '';
    }

    this.inputCtrl.setValue(null);
    this.setValues([...this.values, value]);
  }

  removeValue(value: T): void {
    let values;

    if (this.hashForValue) {
      const hashToFilter = this.hashForValue(value);
      values = this.values.filter((x) => this.hashForValue(x) !== hashToFilter);
    } else {
      values = this.values.filter((x) => x !== value);
    }

    this.setValues(values);
  }

  clearValues(): void {
    this.setValues([]);
  }

  setValues(values: T[]): void {
    // Use to filter non-unique values.
    if (this.hashForValue) {
      values = filterUniqueValues(values, this.hashForValue);
    }

    if (this.pickOnlyOne) {
      values = [lastValue(values)].filter((x) => x != null);
    }

    this._setValueOnFormControl(values);
  }

  // MARK: Internal
  protected _getValueOnFormControl(valueOnFormControl: ArrayOrValue<T>): T[] {
    const value: T[] = valueOnFormControl != null ? asArray(valueOnFormControl) : []; // Always return an array.
    return value;
  }

  protected _setValueOnFormControl(values: T[]): void {
    let newValue: T | T[] = values;

    if (!this.asArrayValue) {
      newValue = [values[0]].filter((x) => x != null)[0];
    }

    this.formControl.setValue(newValue);
    this.formControl.markAsDirty();
    this.formControl.markAsTouched();
  }
}
