import { SubscriptionObject } from '@gae-web/appengine-utility';
import { beginLoading, LoadingState, loadingStateFromObs, LoadingStateLoadingContext } from '@/app/common/loading';
import { ModelUtility } from '@/app/common/model';
import {
  Component, Directive, ElementRef, OnDestroy, OnInit, Type, ViewChild, ViewContainerRef
} from '@angular/core';
import { AbstractControl, FormControl, ValidatorFn } from '@angular/forms';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';
import { camelCase } from 'change-case';
import { BehaviorSubject, combineLatest, of } from 'rxjs';
import { Observable } from 'rxjs';
import { debounce, debounceTime, delay, distinctUntilChanged, exhaust, exhaustMap, filter, first, map, mergeMap, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
import {
  SearchableValueFieldHashFn, SearchableValueFieldStringSearchFn,
  SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue, SearchableValueFieldValue, SearchableFieldDisplayComponent, SearchableValueFieldAnchorFn
} from './searchable';
import { DbNgxDefaultSearchableAnchorFieldDisplayComponent, DbNgxDefaultSearchableFieldDisplayComponent } from './searchable.field.autocomplete.item.component';

export interface StringValueFieldsFieldConfig {
  /**
   * Custom input validators.
   */
  textInputValidator?: ValidatorFn | ValidatorFn[];
  /**
   * Optional description/hint to display.
   */
  description?: string;
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
  search?: SearchableValueFieldStringSearchFn<T>;
  /**
   * Whether or not to allow searches on empty text. Is false by default.
   */
  searchOnEmptyText?: boolean;
  /**
   * Custom component class to use by default.
   */
  componentClass?: Type<SearchableFieldDisplayComponent<T>>;
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
}

export interface SearchableValueFieldsFormlyFieldConfig<T> extends SearchableValueFieldsFieldConfig<T>, FormlyFieldConfig { }

/**
 * Abstract searchable field that provides a feature for searching for values, and for displaying values using Observables.
 *
 * Display values are cached for performance.
 */
@Directive()
export abstract class AbstractDbNgxSearchableValueFieldDirective<T, C extends SearchableValueFieldsFormlyFieldConfig<T>>
  extends FieldType<C> implements OnInit, OnDestroy {

  /**
   * Whether or not to set/get values as an array.
   */
  multiSelect = true;

  defaultComponentClass?: Type<SearchableFieldDisplayComponent<T>>;

  @ViewChild('textInput')
  textInput: ElementRef<HTMLInputElement>;

  readonly inputCtrl = new FormControl('');

  private _formControlObs = new BehaviorSubject<AbstractControl>(undefined);
  readonly formControl$ = this._formControlObs.pipe(filter(x => Boolean(x)));

  private _displayHashMap = new BehaviorSubject<Map<any, SearchableValueFieldDisplayValue<T>>>(new Map());

  readonly inputValue$: Observable<string> = this.inputCtrl.valueChanges.pipe();
  readonly inputValueString$: Observable<string> = this.inputValue$.pipe(
    debounceTime(200),
    distinctUntilChanged()
  );

  readonly searchResultsState$ = this.inputValueString$.pipe(
    filter((text) => (text || this.searchOnEmptyText) && Boolean(this.search)),
    // TODO: Consider caching search text/results.
    switchMap((text) => this.search(text).pipe(
      switchMap((x) => this.loadDisplayValuesForFieldValues(x)),
      // Return begin loading to setup the loading state.
      startWith(beginLoading())
    )),
    shareReplay(1)
  );

  readonly singleValueSyncSubscription = new SubscriptionObject();

  readonly searchContext = new LoadingStateLoadingContext({ obs: this.searchResultsState$, strict: true });

  readonly searchResults$: Observable<SearchableValueFieldDisplayValue<T>[]> = this.searchResultsState$.pipe(
    map(x => x?.model ?? [])
  );

  readonly _formControlValue: Observable<T | T[]> = this.formControl$.pipe(
    switchMap(control => control.valueChanges.pipe(
      startWith(control.value),
      shareReplay(1)
    ))
  );

  readonly values$: Observable<T[]> = this._formControlValue.pipe(
    startWith([]),
    map((x: T[]) => {
      if (this.multiSelect) {
        return x ?? [];
      } else if (x) {
        if (Array.isArray(x)) {
          return x;
        } else {
          return [].concat(x);
        }
      } else {
        return [];
      }
    }),
    shareReplay(1)
  );

  readonly displayValuesState$: Observable<LoadingState<SearchableValueFieldDisplayValue<T>[]>> = this.values$.pipe(
    distinctUntilChanged(),
    switchMap((values: T[]) => this.loadDisplayValuesForValues(values)),
    shareReplay(1)
  );

  readonly displayValues$: Observable<SearchableValueFieldDisplayValue<T>[]> = this.displayValuesState$.pipe(
    map(x => x?.model ?? [])
  );

  get name(): string {
    return this.field.name ?? (camelCase(this.label ?? this.key as string));
  }

  get label(): string {
    return this.field.templateOptions?.label;
  }

  get readonly(): boolean {
    return this.field.templateOptions.readonly;
  }

  get searchOnEmptyText(): boolean {
    return this.field.searchOnEmptyText ?? false;
  }

  get required(): boolean {
    return this.field.templateOptions.required;
  }

  get autocomplete(): string {
    return (this.field.templateOptions?.attributes?.autocomplete as any) ?? this.key as string;
  }

  get placeholder(): string {
    return this.field.templateOptions.placeholder;
  }

  get description(): string {
    return this.field.description ?? this.field.templateOptions.description;
  }

  get hashForValue(): SearchableValueFieldHashFn<T> {
    return this.field.hashForValue ?? ((x) => x as any);
  }

  get displayForValue(): SearchableValueFieldDisplayFn<T> {
    return this.field.displayForValue;
  }

  get useAnchor(): boolean {
    return this.field.useAnchor;
  }

  get anchorForValue(): SearchableValueFieldAnchorFn<T> {
    return this.field.anchorForValue;
  }

  get componentClass(): Type<SearchableFieldDisplayComponent<T>> {
    return this.field.componentClass;
  }

  get search(): SearchableValueFieldStringSearchFn<T> {
    return this.field.search;
  }

  get values(): T[] {
    return this._getValueOnFormControl(this.formControl.value) ?? [];
  }

  get allowStringValues(): boolean {
    return this.allowStringValues ?? Boolean(this.convertStringValue);
  }

  get convertStringValue(): (text: string) => T {
    return this.field.convertStringValue;
  }

  loadDisplayValuesForValues(values: T[]): Observable<LoadingState<SearchableValueFieldDisplayValue<T>[]>> {
    return this.loadDisplayValuesForFieldValues(values.map((value) => ({ value })));
  }

  loadDisplayValuesForFieldValues(values: SearchableValueFieldValue<T>[]): Observable<LoadingState<SearchableValueFieldDisplayValue<T>[]>> {
    return this.getDisplayValuesForFieldValues(values).pipe(
      map((displayValues: SearchableValueFieldDisplayValue<T>[]) => ({ loading: false, model: displayValues })),
      startWith({ loading: true }),
      shareReplay(1)
    );
  }

  getDisplayValuesForFieldValues(values: SearchableValueFieldValue<T>[]): Observable<SearchableValueFieldDisplayValue<T>[]> {
    return this._displayHashMap.pipe(
      mergeMap((displayMap) => {
        const mappingResult = values
          .map(x => [x, this.hashForValue(x.value)])
          .map(([x, hash], i) => [i, hash, x, displayMap.get(hash)] as [number, any, SearchableValueFieldValue<T>, SearchableValueFieldDisplayValue<T>]);

        const hasDisplay = mappingResult.filter(x => Boolean(x[3]));
        const needsDisplay = mappingResult.filter(x => !x[3]);

        if (needsDisplay.length > 0) {

          // Go get the display value.
          const displayValuesObs = this.displayForValue(needsDisplay.map(x => x[2]));
          const componentClass = this.componentClass ?? this.defaultComponentClass;
          const anchorForValue = this.useAnchor && this.anchorForValue;

          return displayValuesObs.pipe(
            first(),
            map((displayResults) => {

              // Assign the default component classes.
              displayResults.forEach(x => {
                if (!x.componentClass) {
                  x.componentClass = componentClass;
                }

                if (!x.anchor && anchorForValue) {
                  x.anchor = anchorForValue(x);
                }
              });

              // Create a map to re-join values later.
              const displayResultsMapping: [SearchableValueFieldDisplayValue<T>, any][] = displayResults.map(x => [x, this.hashForValue(x.value)]);
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
          return of(hasDisplay.map(x => x[3])) as Observable<SearchableValueFieldDisplayValue<T>[]>;
        }
      })
    );
  }

  ngOnInit(): void {
    this._formControlObs.next(this.formControl);

    if (this.field.textInputValidator) {
      this.inputCtrl.setValidators(this.field.textInputValidator);
    }

    if (!this.defaultComponentClass) {
      if (this.useAnchor) {
        this.defaultComponentClass = DbNgxDefaultSearchableAnchorFieldDisplayComponent;
      } else {
        this.defaultComponentClass = DbNgxDefaultSearchableFieldDisplayComponent;
      }
    }

    if (this.multiSelect === false) {
      this.singleValueSyncSubscription.subscription = this.displayValues$.subscribe((x) => {
        if (x[0]) {
          this._syncSingleValue(x[0]);
        }
      });
    }
  }

  ngOnDestroy(): void {
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
    if (!this.field.allowStringValues) {
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

  setValues(values: T[]): void {
    // Use to filter non-unique values.
    if (this.hashForValue) {
      values = ModelUtility.removeDuplicates(values, this.hashForValue);
    }

    this._setValueOnFormControl(values);
  }

  // MARK: Internal
  protected _getValueOnFormControl(valueOnFormControl: any): T[] {
    const value = (valueOnFormControl != null) ? [].concat(valueOnFormControl) : [];  // Always return an array.
    return value as T[];
  }

  protected _setValueOnFormControl(values: T[]): void {
    const value = (this.multiSelect) ? values : values?.[0];
    this.formControl.setValue(value);
    this.formControl.markAsDirty();
    this.formControl.markAsTouched();
  }

}
