import { DbxInjectedComponentConfig, mergeDbxInjectedComponentConfigs } from '@dereekb/dbx-core';
import { filterMaybe, SubscriptionObject, beginLoading, LoadingState, LoadingStateContextInstance, successResult } from '@dereekb/rxjs';
import { ChangeDetectorRef, Directive, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, FormControl, ValidatorFn } from '@angular/forms';
import { FieldTypeConfig, FormlyFieldConfig } from '@ngx-formly/core';
import { FieldType } from '@ngx-formly/material';
import { debounceTime, distinctUntilChanged, first, map, mergeMap, shareReplay, startWith, switchMap, BehaviorSubject, of, Observable } from 'rxjs';
import {
  SearchableValueFieldHashFn, SearchableValueFieldStringSearchFn,
  SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue, SearchableValueFieldValue, SearchableValueFieldAnchorFn, ConfiguredSearchableValueFieldDisplayValue
} from './searchable';
import { DbxDefaultSearchableFieldDisplayComponent } from './searchable.field.autocomplete.item.component';
import { Maybe, convertMaybeToArray, findUnique, lastValue } from '@dereekb/util';
import { camelCase } from 'change-case';

export interface StringValueFieldsFieldConfig {
  /**
   * Custom input validators.
   */
  textInputValidator?: ValidatorFn | ValidatorFn[];
}

export interface StringValueFieldsFormlyFieldConfig extends StringValueFieldsFieldConfig, FormlyFieldConfig { }

export interface SearchableValueFieldsFieldConfig<T> extends StringValueFieldsFieldConfig {
  /**
   * Whether or not to allow string values to be used directly, or if values can only be chosen from searching.
   */
  allowStringValues?: boolean;
  /**
   * Optional conversion function. If provided, allowStringValues is considered true.
   */
  convertStringValue?: (text: string) => T;
  /**
   * Used for hashing display values and omitting repeat values.
   *
   * If hashForValue is not provided, the value's value will be used as is.
   */
  hashForValue?: SearchableValueFieldHashFn<T>;
  /**
   * Performs a search.
   */
  search: SearchableValueFieldStringSearchFn<T>;
  /**
   * Whether or not to allow searches on empty text. Is false by default.
   */
  searchOnEmptyText?: boolean;
  /**
   * Default injected config to use for display values.
   */
  display?: Partial<DbxInjectedComponentConfig>;
  /**
   * Used for building a display value given the input.
   */
  displayForValue: SearchableValueFieldDisplayFn<T>;
  /**
   * Whether or not to use the anchor field on value elements.
   *
   * This has no default effect if a component class is provided.
   */
  useAnchor?: boolean;
  /**
   * Used for retrieving an anchor value for values that have no anchor value set.
   *
   * Only used when useAnchor is true.
   */
  anchorForValue?: SearchableValueFieldAnchorFn<T>;
  /**
   * Whether or not to show "Clear" in the autcomplete list.
   */
  showClearValue?: boolean;
}

export interface SearchableValueFieldsFormlyFieldConfig<T> extends FormlyFieldConfig {
  searchableField: SearchableValueFieldsFieldConfig<T>;
}

/**
 * Abstract searchable field that provides a feature for searching for values, and for displaying values using Observables.
 *
 * Display values are cached for performance.
 */
@Directive()
export abstract class AbstractDbxSearchableValueFieldDirective<T, C extends SearchableValueFieldsFormlyFieldConfig<T>>
  extends FieldType<C & FieldTypeConfig> implements OnInit, OnDestroy {

  /**
   * Whether or not to set/get values as an array.
   */
  multiSelect = true;

  /**
   * Optional override set by the parent class for picking a default display for this directive.
   */
  defaultDisplay?: DbxInjectedComponentConfig;

  @ViewChild('textInput')
  textInput!: ElementRef<HTMLInputElement>;

  readonly inputCtrl = new FormControl('');

  private _formControlObs = new BehaviorSubject<Maybe<AbstractControl>>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  private _displayHashMap = new BehaviorSubject<Map<any, ConfiguredSearchableValueFieldDisplayValue<T>>>(new Map());

  readonly inputValue$: Observable<string> = this.inputCtrl.valueChanges.pipe(startWith(this.inputCtrl.value));
  readonly inputValueString$: Observable<string> = this.inputValue$.pipe(
    debounceTime(200),
    distinctUntilChanged()
  );

  readonly searchResultsState$ = this.inputValueString$.pipe(
    switchMap((text) => ((text || this.searchOnEmptyText) ? this.search(text ?? '') : of([])).pipe(
      switchMap((x) => this.loadDisplayValuesForFieldValues(x)),
      // Return begin loading to setup the loading state.
      startWith(beginLoading())
    )),
    shareReplay(1)
  );

  readonly singleValueSyncSubscription = new SubscriptionObject();

  readonly searchContext = new LoadingStateContextInstance({ obs: this.searchResultsState$, showLoadingOnNoValue: false });

  readonly searchResults$: Observable<ConfiguredSearchableValueFieldDisplayValue<T>[]> = this.searchResultsState$.pipe(
    map(x => x?.value ?? []),
  );

  readonly _formControlValue: Observable<T | T[]> = this.formControl$.pipe(
    switchMap(control => control.valueChanges.pipe(
      startWith(control.value),
      shareReplay(1)
    ))
  );

  readonly values$: Observable<T[]> = this._formControlValue.pipe(
    map(convertMaybeToArray),
    shareReplay(1)
  );

  readonly displayValuesState$: Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T>[]>> = this.values$.pipe(
    distinctUntilChanged(),
    switchMap((values: T[]) => this.loadDisplayValuesForValues(values)),
    shareReplay(1)
  );

  readonly displayValues$: Observable<ConfiguredSearchableValueFieldDisplayValue<T>[]> = this.displayValuesState$.pipe(
    map(x => x?.value ?? [])
  );

  get name(): string {
    return this.field.name ?? (camelCase(this.label ?? this.key as string));
  }

  get label(): Maybe<string> {
    return this.field.templateOptions?.label;
  }

  get readonly(): Maybe<boolean> {
    return this.field.templateOptions?.readonly;
  }

  get searchableField(): SearchableValueFieldsFieldConfig<T> {
    return this.field.searchableField;
  }

  get searchOnEmptyText(): boolean {
    return this.searchableField.searchOnEmptyText ?? false;
  }

  get autocomplete(): string {
    return (this.field.templateOptions?.attributes?.['autocomplete'] as any) ?? this.key as string;
  }

  get hashForValue(): SearchableValueFieldHashFn<T> {
    return this.searchableField.hashForValue ?? ((x) => x as any);
  }

  get displayForValue(): SearchableValueFieldDisplayFn<T> {
    return this.searchableField.displayForValue;
  }

  get useAnchor(): Maybe<boolean> {
    return this.searchableField.useAnchor;
  }

  get anchorForValue(): Maybe<SearchableValueFieldAnchorFn<T>> {
    return this.searchableField.anchorForValue;
  }

  get display(): Maybe<Partial<DbxInjectedComponentConfig>> {
    return this.searchableField.display;
  }

  get search(): SearchableValueFieldStringSearchFn<T> {
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

  loadDisplayValuesForValues(values: T[]): Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T>[]>> {
    return this.loadDisplayValuesForFieldValues(values.map((value) => ({ value })));
  }

  loadDisplayValuesForFieldValues(values: SearchableValueFieldValue<T>[]): Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T>[]>> {
    return this.getDisplayValuesForFieldValues(values).pipe(
      map((displayValues: ConfiguredSearchableValueFieldDisplayValue<T>[]) => successResult(displayValues)),
      startWith(beginLoading()),
      shareReplay(1)
    );
  }

  getDisplayValuesForFieldValues(values: SearchableValueFieldValue<T>[]): Observable<ConfiguredSearchableValueFieldDisplayValue<T>[]> {
    return this._displayHashMap.pipe(
      mergeMap((displayMap) => {
        const mappingResult = values
          .map(x => [x, this.hashForValue(x.value)])
          .map(([x, hash], i) => [i, hash, x, displayMap.get(hash)] as [number, any, SearchableValueFieldValue<T>, ConfiguredSearchableValueFieldDisplayValue<T>]);

        const hasDisplay = mappingResult.filter(x => Boolean(x[3]));
        const needsDisplay = mappingResult.filter(x => !x[3]);
        let obs: Observable<ConfiguredSearchableValueFieldDisplayValue<T>[]>;

        if (needsDisplay.length > 0) {

          // Go get the display value.
          const displayValuesObs = this.displayForValue(needsDisplay.map(x => x[2]));
          const defaultDisplay = mergeDbxInjectedComponentConfigs([this.defaultDisplay, this.display]);
          const anchorForValue = this.useAnchor && this.anchorForValue;

          obs = displayValuesObs.pipe(
            first(),
            map((displayResults) => {

              // Assign the default component classes to complete configuration.
              displayResults.forEach(x => {
                if (!x.display) {
                  x.display = defaultDisplay;
                } else {
                  x.display = mergeDbxInjectedComponentConfigs([defaultDisplay, x.display]);
                }

                if (!x.anchor && anchorForValue) {
                  x.anchor = anchorForValue(x);
                }
              });

              // Create a map to re-join values later.
              const displayResultsMapping: [ConfiguredSearchableValueFieldDisplayValue<T>, any][] = (displayResults as ConfiguredSearchableValueFieldDisplayValue<T>[]).map(x => [x, this.hashForValue(x.value)]);
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
          obs = of(hasDisplay.map(x => x[3]));
        }

        return obs;
      })
    );
  }

  constructor(readonly cdRef: ChangeDetectorRef) {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this._formControlObs.next(this.formControl);

    if (this.searchableField.textInputValidator) {
      this.inputCtrl.setValidators(this.searchableField.textInputValidator);
    }

    if (!this.defaultDisplay?.componentClass) {
      this.defaultDisplay = {
        ...this.defaultDisplay,
        componentClass: DbxDefaultSearchableFieldDisplayComponent
      };
    }

    if (this.multiSelect === false) {
      this.singleValueSyncSubscription.subscription = this.displayValues$.subscribe((x) => {
        if (x[0]) {
          this._syncSingleValue(x[0]);
        }
      });
    }
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._displayHashMap.complete();
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

    // console.log('Add: ', text, this.inputCtrl.valid);

    if (!this.inputCtrl.valid) {
      return;
    }

    if (text) {
      const value = (this.convertStringValue) ? this.convertStringValue(text) : text as any as T;
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
      const value = this.inputCtrl.value;

      if ((value || '').trim()) {
        this._addWithTextValue(value);
        addedValue = true;
      }
    }

    return addedValue;
  }

  addValue(value: T): void {
    this.textInput.nativeElement.value = '';
    this.inputCtrl.setValue(null);
    this.setValues([...this.values, value]);
  }

  removeValue(value: T): void {
    let values;

    if (this.hashForValue) {
      const hashToFilter = this.hashForValue(value);
      values = this.values.filter(x => this.hashForValue(x) !== hashToFilter);
    } else {
      values = this.values.filter(x => x !== value);
    }

    this.setValues(values);
  }

  clearValues(): void {
    this.setValues([]);
  }

  setValues(values: T[]): void {
    // Use to filter non-unique values.
    if (this.hashForValue) {
      values = findUnique(values, this.hashForValue);
    }

    this._setValueOnFormControl(values);
  }

  // MARK: Internal
  protected _getValueOnFormControl(valueOnFormControl: any): T[] {
    const value = (valueOnFormControl != null) ? [].concat(valueOnFormControl) : [];  // Always return an array.
    return value as T[];
  }

  protected _setValueOnFormControl(values: T[]): void {
    const value = (this.multiSelect) ? values : lastValue(values);  // pick last value, as the last value added is the newest value.
    this.formControl.setValue(value);
    this.formControl.markAsDirty();
    this.formControl.markAsTouched();
  }

}
