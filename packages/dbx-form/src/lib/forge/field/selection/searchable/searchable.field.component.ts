import { ChangeDetectionStrategy, Component, computed, effect, input, type OnDestroy, type OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl, type ValidatorFn } from '@angular/forms';
import { MatAutocompleteModule, type MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipsModule, type MatChipInputEvent } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { type Maybe, type PrimativeKey, filterUniqueValues, lastValue, convertMaybeToArray, type ArrayOrValue, type Configurable } from '@dereekb/util';
import { type DbxInjectionComponentConfig, mergeDbxInjectionComponentConfigs, DbxInjectionComponent } from '@dereekb/dbx-core';
import { SubscriptionObject, type LoadingState, successResult, startWithBeginLoading, skipUntilTimeElapsedAfterLastEmission } from '@dereekb/rxjs';
import { DbxLoadingModule } from '@dereekb/dbx-web';
import { BehaviorSubject, debounceTime, distinctUntilChanged, first, map, mergeMap, of, shareReplay, startWith, switchMap, type Observable, Subject } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { type FieldTree } from '@angular/forms/signals';
import { type DynamicText, type FieldMeta, type ValidationMessages, type BaseValueField } from '@ng-forge/dynamic-forms';
import { type SearchableValueFieldStringSearchFn, type SearchableValueFieldDisplayFn, type SearchableValueFieldDisplayValue, type SearchableValueFieldValue, type SearchableValueFieldAnchorFn, type SearchableValueFieldHashFn, type ConfiguredSearchableValueFieldDisplayValue } from '../../../../formly/field/selection/searchable/searchable';
import { DbxDefaultSearchableFieldDisplayComponent, DbxSearchableFieldAutocompleteItemComponent } from '../../../../formly/field/selection/searchable/searchable.field.autocomplete.item.component';

// MARK: Forge Searchable Field Props
/**
 * Props interface for the forge searchable text field.
 *
 * Passed via the `props` property on the forge field definition.
 */
export interface ForgeSearchableTextFieldProps<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> {
  /**
   * Function that performs the search given input text.
   */
  readonly search: SearchableValueFieldStringSearchFn<T, M>;
  /**
   * Function that provides display values for selected field values.
   */
  readonly displayForValue: SearchableValueFieldDisplayFn<T, M>;
  /**
   * Hash function used for deduplication and display caching.
   */
  readonly hashForValue?: SearchableValueFieldHashFn<T, H>;
  /**
   * Whether to allow raw string values (not from search results).
   */
  readonly allowStringValues?: boolean;
  /**
   * Optional function to convert a raw string input into a typed value.
   * If provided, `allowStringValues` is considered true.
   */
  readonly convertStringValue?: (text: string) => T;
  /**
   * Whether to show the selected value in the input. Defaults to true when allowStringValues is false.
   */
  readonly showSelectedValue?: boolean;
  /**
   * Whether to allow searching on empty text. Defaults to false.
   */
  readonly searchOnEmptyText?: boolean;
  /**
   * Default display configuration for autocomplete items.
   */
  readonly display?: Partial<DbxInjectionComponentConfig>;
  /**
   * Whether to use anchor navigation on display values.
   */
  readonly useAnchor?: boolean;
  /**
   * Function to compute an anchor for values that lack one.
   */
  readonly anchorForValue?: SearchableValueFieldAnchorFn<T, M>;
  /**
   * Whether to show a "Clear" option in the autocomplete list.
   */
  readonly showClearValue?: boolean;
  /**
   * Label for the search input placeholder. Defaults to "Search".
   */
  readonly searchLabel?: string;
  /**
   * Observable that triggers clearing all cached display values.
   */
  readonly refreshDisplayValues$?: Observable<unknown>;
  /**
   * Hint text shown below the field.
   */
  readonly hint?: string;
  /**
   * Custom input validators applied to the text input control.
   * When set, the input is validated before a string value can be added as a chip.
   */
  readonly textInputValidator?: ValidatorFn | ValidatorFn[];
}

/**
 * Props interface for the forge searchable chip field.
 *
 * Passed via the `props` property on the forge field definition.
 */
export interface ForgeSearchableChipFieldProps<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends ForgeSearchableTextFieldProps<T, M, H> {
  /**
   * Whether to allow multiple chip selections. Defaults to true.
   */
  readonly multiSelect?: boolean;
  /**
   * Whether to get/set values as an array. If false, multiSelect is ignored.
   */
  readonly asArrayValue?: boolean;
}

/**
 * Forge field definition interface for the searchable text field.
 */
export interface ForgeSearchableTextFieldDef<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends BaseValueField<ForgeSearchableTextFieldProps<T, M, H>, T> {
  readonly type: 'dbx-searchable-text';
}

/**
 * Forge field definition interface for the searchable chip field.
 */
export interface ForgeSearchableChipFieldDef<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends BaseValueField<ForgeSearchableChipFieldProps<T, M, H>, T | T[]> {
  readonly type: 'dbx-searchable-chip';
}

const DEFAULT_SEARCH_INPUT_PLACEHOLDER = 'Type to Search';

const DEFAULT_SEARCHABLE_FIELD_DISPLAY: Partial<DbxInjectionComponentConfig> = {
  componentClass: DbxDefaultSearchableFieldDisplayComponent
};

// MARK: Searchable Text Field Component
/**
 * Forge ValueFieldComponent for searchable text selection (single value).
 *
 * Wraps the existing searchable text autocomplete pattern from formly as a standalone
 * ng-forge dynamic forms component. Receives field config via signal inputs from the mapper.
 */
@Component({
  selector: 'dbx-forge-searchable-text-field',
  template: `
    <div class="dbx-searchable-field dbx-searchable-text-field">
      @if (labelSignal()) {
        <span class="dbx-label">{{ labelSignal() }}</span>
      }
      <mat-form-field class="dbx-searchable-text-field-input">
        <input matInput #textInput [formControl]="inputCtrl" [matAutocomplete]="auto" [placeholder]="searchInputPlaceholder()" />
        <mat-autocomplete #auto="matAutocomplete" (optionSelected)="selected($event)">
          @if (showClearValueSignal() && hasValueSignal()) {
            <mat-option [value]="{ _clear: true }">Clear</mat-option>
          }
          @for (result of searchResultsSignal(); track $index) {
            <mat-option [value]="result">
              <dbx-searchable-field-autocomplete-item [displayValue]="result"></dbx-searchable-field-autocomplete-item>
            </mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
      @if (showSelectedDisplayValueSignal()) {
        @let sv = selectedDisplayValueSignal();
        @if (sv) {
          <div class="dbx-searchable-text-selected-value">
            <dbx-searchable-field-autocomplete-item [displayValue]="sv"></dbx-searchable-field-autocomplete-item>
          </div>
        }
      }
      @if (hintSignal()) {
        <div class="dbx-form-description">{{ hintSignal() }}</div>
      }
    </div>
  `,
  imports: [FormsModule, ReactiveFormsModule, MatFormFieldModule, MatInput, MatAutocompleteModule, MatOptionModule, MatIconModule, DbxLoadingModule, DbxSearchableFieldAutocompleteItemComponent, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeSearchableTextFieldComponent<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> implements OnInit, OnDestroy {
  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<T>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<ForgeSearchableTextFieldProps<T, M, H> | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  readonly inputCtrl = new FormControl<string>('');

  private readonly _clearDisplayHashMapSub = new SubscriptionObject();
  private readonly _displayHashMap = new BehaviorSubject<Map<H, ConfiguredSearchableValueFieldDisplayValue<T, M>>>(new Map());
  private readonly _singleValueSyncSub = new SubscriptionObject();

  readonly inputValue$: Observable<string> = this.inputCtrl.valueChanges.pipe(
    startWith(this.inputCtrl.value),
    map((x) => x || '')
  );

  readonly inputValueString$: Observable<string> = this.inputValue$.pipe(debounceTime(200), distinctUntilChanged());

  // Computed signals from props
  readonly labelSignal = computed(() => {
    const l = this.label();
    return typeof l === 'string' ? l : undefined;
  });

  readonly hintSignal = computed(() => this.props()?.hint);
  readonly showClearValueSignal = computed(() => this.props()?.showClearValue ?? true);

  readonly searchInputPlaceholder = computed(() => {
    const p = this.props();
    const searchOnEmpty = p?.searchOnEmptyText ?? false;
    const placeholder = typeof this.placeholder() === 'string' ? (this.placeholder() as string) : undefined;
    return placeholder || (searchOnEmpty ? '' : DEFAULT_SEARCH_INPUT_PLACEHOLDER);
  });

  // Search results
  readonly searchResultsState$: Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> = this.inputValueString$.pipe(
    switchMap((text) => {
      const p = this._currentProps();
      const searchOnEmptyText = p?.searchOnEmptyText ?? false;
      const searchFn = p?.search;

      if (!searchFn) {
        return of(successResult([] as ConfiguredSearchableValueFieldDisplayValue<T, M>[]));
      }

      return (text || searchOnEmptyText ? searchFn(text ?? '') : of([])).pipe(
        switchMap((x) => this._loadDisplayValuesForFieldValues(x)),
        startWithBeginLoading()
      );
    }),
    shareReplay(1)
  );

  readonly searchResults$: Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> = this.searchResultsState$.pipe(
    map((x) => x?.value ?? []),
    shareReplay(1)
  );

  readonly searchResultsSignal = toSignal(this.searchResults$, { initialValue: [] as ConfiguredSearchableValueFieldDisplayValue<T, M>[] });

  // Value from the FieldTree
  readonly fieldValueSignal = computed(() => {
    const fieldGetter = this.field();
    const fieldState = typeof fieldGetter === 'function' ? (fieldGetter as any)() : undefined;
    return fieldState?.value?.() as Maybe<T>;
  });

  readonly displayValuesState$: Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> = new BehaviorSubject<T[]>([]).pipe(
    switchMap((values: T[]) => this._loadDisplayValuesForValues(values)),
    shareReplay(1)
  );

  private readonly _valuesSubject = new BehaviorSubject<T[]>([]);

  readonly displayValues$: Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> = this._valuesSubject.pipe(
    switchMap((values: T[]) => this._loadDisplayValuesForValues(values)),
    map((x) => x?.value ?? []),
    shareReplay(1)
  );

  readonly selectedDisplayValue$ = this.displayValues$.pipe(
    map((x) => x[0]),
    shareReplay(1)
  );

  readonly selectedDisplayValueSignal = toSignal(this.selectedDisplayValue$);
  readonly hasValueSignal = computed(() => Boolean(this.selectedDisplayValueSignal()));
  readonly showSelectedDisplayValueSignal = computed(() => {
    const p = this.props();
    const showSelected = p?.showSelectedValue ?? !(p?.allowStringValues ?? false);
    return showSelected && this.hasValueSignal();
  });

  /**
   * Cached reference to the current props for use in Observable pipelines.
   *
   * @returns The current props signal value
   */
  private _currentProps(): Maybe<ForgeSearchableTextFieldProps<T, M, H>> {
    return this.props();
  }

  private readonly _syncFieldValueEffect = effect(() => {
    const fieldValue = this.fieldValueSignal();
    const values = fieldValue != null && fieldValue !== '' ? [fieldValue] : [];
    this._valuesSubject.next(values);
  });

  ngOnInit(): void {
    const p = this.props();

    if (p?.refreshDisplayValues$) {
      this._clearDisplayHashMapSub.subscription = p.refreshDisplayValues$.subscribe(() => this._displayHashMap.next(new Map()));
    }

    // Sync single value to input
    this._singleValueSyncSub.subscription = this.displayValues$.subscribe((x) => {
      if (x[0]) {
        this.inputCtrl.setValue(x[0].label, { emitEvent: false });
      }
    });
  }

  ngOnDestroy(): void {
    this._clearDisplayHashMapSub.destroy();
    this._displayHashMap.complete();
    this._singleValueSyncSub.destroy();
    this._valuesSubject.complete();
  }

  selected(event: MatAutocompleteSelectedEvent): void {
    const value = event.option.value as SearchableValueFieldDisplayValue<T> | { _ignore?: true } | { _clear?: true };

    if ((value as any)._clear) {
      this._setFieldValue(undefined);
    } else if (!(value as any)._ignore) {
      this._setFieldValue((value as SearchableValueFieldDisplayValue<T>).value);
    }
  }

  // MARK: Internal
  private _hashForValue(): SearchableValueFieldHashFn<T, H> {
    return this.props()?.hashForValue ?? ((x) => x as unknown as H);
  }

  private _displayForValue(): SearchableValueFieldDisplayFn<T, M> {
    return this.props()?.displayForValue ?? ((values) => of(values.map((v) => ({ ...v, label: String(v.value) }))));
  }

  private _setFieldValue(value: Maybe<T>): void {
    const fieldGetter = this.field();
    if (!fieldGetter || typeof fieldGetter !== 'function') return;

    const fieldState = (fieldGetter as any)();
    if (fieldState?.value?.set) {
      fieldState.value.set(value);
    }
  }

  private _loadDisplayValuesForValues(values: T[]): Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> {
    return this._loadDisplayValuesForFieldValues(values.map((value) => ({ value })));
  }

  private _loadDisplayValuesForFieldValues(values: SearchableValueFieldValue<T, M>[]): Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> {
    return this._getDisplayValuesForFieldValues(values).pipe(
      map((displayValues: ConfiguredSearchableValueFieldDisplayValue<T, M>[]) => successResult(displayValues)),
      startWithBeginLoading(),
      shareReplay(1)
    );
  }

  private _getDisplayValuesForFieldValues(values: SearchableValueFieldValue<T, M>[]): Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> {
    const hashForValue = this._hashForValue();
    const displayForValue = this._displayForValue();
    const p = this.props();
    const display = p?.display;
    const useAnchor = p?.useAnchor;
    const anchorForValue = useAnchor && p?.anchorForValue;
    const defaultDisplay = mergeDbxInjectionComponentConfigs([DEFAULT_SEARCHABLE_FIELD_DISPLAY, display]);

    return this._displayHashMap.pipe(
      mergeMap((displayMap) => {
        const mappingResult = values.map((x) => [x, hashForValue(x.value)] as [SearchableValueFieldValue<T, M>, H]).map(([x, hash], i) => [i, hash, x, displayMap.get(hash)] as [number, H, SearchableValueFieldValue<T, M>, ConfiguredSearchableValueFieldDisplayValue<T, M>]);

        const hasDisplay = mappingResult.filter((x) => Boolean(x[3]));
        const needsDisplay = mappingResult.filter((x) => !x[3]);

        let obs: Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>;

        if (needsDisplay.length > 0) {
          const displayValuesObs = displayForValue(needsDisplay.map((x) => x[2]));

          obs = displayValuesObs.pipe(
            first(),
            map((displayResults) => {
              (displayResults as Configurable<SearchableValueFieldDisplayValue<T, M>>[]).forEach((x) => {
                if (!x.display) {
                  x.display = defaultDisplay;
                } else {
                  x.display = mergeDbxInjectionComponentConfigs([defaultDisplay, x.display]);
                }

                if (!x.anchor && anchorForValue) {
                  x.anchor = (anchorForValue as SearchableValueFieldAnchorFn<T, M>)(x);
                }
              });

              const displayResultsMapping: [ConfiguredSearchableValueFieldDisplayValue<T, M>, H][] = (displayResults as ConfiguredSearchableValueFieldDisplayValue<T, M>[]).map((x) => [x, hashForValue(x.value)]);
              const valueIndexHashMap = new Map(displayResultsMapping.map(([x, hash]) => [hash, x]));

              displayResultsMapping.forEach(([x, hash]) => displayMap.set(hash, x));

              return mappingResult.map((x) => x[3] ?? valueIndexHashMap.get(x[1])) as ConfiguredSearchableValueFieldDisplayValue<T, M>[];
            })
          );
        } else {
          obs = of(hasDisplay.map((x) => x[3]));
        }

        return obs;
      })
    );
  }
}

// MARK: Searchable Chip Field Component
/**
 * Forge ValueFieldComponent for searchable chip selection (multi-value).
 *
 * Wraps the existing searchable chip pattern from formly as a standalone
 * ng-forge dynamic forms component. Supports adding/removing chips with autocomplete search.
 */
@Component({
  selector: 'dbx-forge-searchable-chip-field',
  template: `
    <div class="dbx-searchable-field dbx-searchable-chip-field">
      @if (labelSignal()) {
        <span class="dbx-label">{{ labelSignal() }}</span>
      }
      <mat-chip-grid #chipGrid>
        @for (dv of displayValuesSignal(); track $index) {
          <mat-chip-row (removed)="removeWithDisplayValue(dv)">
            <dbx-searchable-field-autocomplete-item [displayValue]="dv"></dbx-searchable-field-autocomplete-item>
            <button matChipRemove>
              <mat-icon>cancel</mat-icon>
            </button>
          </mat-chip-row>
        }
      </mat-chip-grid>
      <mat-form-field class="dbx-searchable-chip-field-input">
        <input matInput #textInput [formControl]="inputCtrl" [matAutocomplete]="auto" [matChipInputFor]="chipGrid" [matChipInputSeparatorKeyCodes]="separatorKeysCodes" (matChipInputTokenEnd)="addChip($event)" [placeholder]="searchInputPlaceholder()" (blur)="onBlur()" (keydown)="tabPressedOnInput($event)" />
        <mat-autocomplete #auto="matAutocomplete" (optionSelected)="selectedChip($event)">
          @for (result of searchResultsSignal(); track $index) {
            <mat-option [value]="result">
              <dbx-searchable-field-autocomplete-item [displayValue]="result"></dbx-searchable-field-autocomplete-item>
            </mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
      @if (inputCtrl.touched && inputErrorMessage) {
        <span class="dbx-chip-input-error">{{ inputErrorMessage }}</span>
      }
      @if (hintSignal()) {
        <div class="dbx-form-description">{{ hintSignal() }}</div>
      }
    </div>
  `,
  imports: [FormsModule, ReactiveFormsModule, MatFormFieldModule, MatInput, MatAutocompleteModule, MatChipsModule, MatOptionModule, MatIconModule, DbxLoadingModule, DbxSearchableFieldAutocompleteItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeSearchableChipFieldComponent<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> implements OnInit, OnDestroy {
  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<T | T[]>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<ForgeSearchableChipFieldProps<T, M, H> | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  readonly inputCtrl = new FormControl<string>('');
  readonly separatorKeysCodes: number[] = [ENTER, COMMA];

  private readonly _clearDisplayHashMapSub = new SubscriptionObject();
  private readonly _displayHashMap = new BehaviorSubject<Map<H, ConfiguredSearchableValueFieldDisplayValue<T, M>>>(new Map());
  private readonly _blur = new Subject<void>();
  private readonly _blurSub = new SubscriptionObject();

  readonly inputValue$: Observable<string> = this.inputCtrl.valueChanges.pipe(
    startWith(this.inputCtrl.value),
    map((x) => x || '')
  );

  readonly inputValueString$: Observable<string> = this.inputValue$.pipe(debounceTime(200), distinctUntilChanged());

  readonly labelSignal = computed(() => {
    const l = this.label();
    return typeof l === 'string' ? l : undefined;
  });

  readonly hintSignal = computed(() => this.props()?.hint);

  readonly searchInputPlaceholder = computed(() => {
    const p = this.props();
    const searchOnEmpty = p?.searchOnEmptyText ?? false;
    const placeholder = typeof this.placeholder() === 'string' ? (this.placeholder() as string) : undefined;
    return placeholder || (searchOnEmpty ? '' : DEFAULT_SEARCH_INPUT_PLACEHOLDER);
  });

  // Values from the FieldTree
  private readonly _valuesSubject = new BehaviorSubject<T[]>([]);

  readonly values$ = this._valuesSubject.asObservable().pipe(shareReplay(1));

  readonly displayValues$: Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> = this._valuesSubject.pipe(
    switchMap((values: T[]) => this._loadDisplayValuesForValues(values)),
    map((x) => x?.value ?? []),
    shareReplay(1)
  );

  readonly displayValuesSignal = toSignal(this.displayValues$, { initialValue: [] as ConfiguredSearchableValueFieldDisplayValue<T, M>[] });

  // Search results
  readonly searchResultsState$: Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> = this.inputValueString$.pipe(
    switchMap((text) => {
      const p = this._currentProps();
      const searchOnEmptyText = p?.searchOnEmptyText ?? false;
      const searchFn = p?.search;

      if (!searchFn) {
        return of(successResult([] as ConfiguredSearchableValueFieldDisplayValue<T, M>[]));
      }

      return (text || searchOnEmptyText ? searchFn(text ?? '') : of([])).pipe(
        switchMap((x) => this._loadDisplayValuesForFieldValues(x)),
        startWithBeginLoading()
      );
    }),
    shareReplay(1)
  );

  readonly searchResults$: Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> = this.searchResultsState$.pipe(
    map((x) => x?.value ?? []),
    shareReplay(1)
  );

  readonly searchResultsSignal = toSignal(this.searchResults$, { initialValue: [] as ConfiguredSearchableValueFieldDisplayValue<T, M>[] });

  private readonly _syncFieldValueEffect = effect(() => {
    const fieldGetter = this.field();
    const fieldState = typeof fieldGetter === 'function' ? (fieldGetter as any)() : undefined;
    const fieldValue = fieldState?.value?.() as Maybe<T | T[]>;
    const values = fieldValue != null ? convertMaybeToArray(fieldValue as ArrayOrValue<T>).filter((v) => v != null && v !== '') : [];
    this._valuesSubject.next(values);
  });

  /**
   * Returns the first validation error message from the input control, if any.
   */
  get inputErrorMessage(): string | undefined {
    const errors = this.inputCtrl.errors;

    if (errors) {
      for (const key of Object.keys(errors)) {
        const error = errors[key];

        if (typeof error === 'string') {
          return error;
        } else if (error?.message) {
          return error.message;
        }
      }

      return 'Invalid input';
    }

    return undefined;
  }

  private _currentProps(): Maybe<ForgeSearchableChipFieldProps<T, M, H>> {
    return this.props();
  }

  ngOnInit(): void {
    const p = this.props();

    if (p?.refreshDisplayValues$) {
      this._clearDisplayHashMapSub.subscription = p.refreshDisplayValues$.subscribe(() => this._displayHashMap.next(new Map()));
    }

    if (p?.textInputValidator) {
      this.inputCtrl.setValidators(p.textInputValidator);
    }

    // Handle blur: add text as value if allowed
    this._blurSub.subscription = this._blur.pipe(skipUntilTimeElapsedAfterLastEmission(this.values$, 100)).subscribe(() => {
      this._tryAddCurrentInputValue();
    });
  }

  ngOnDestroy(): void {
    this._clearDisplayHashMapSub.destroy();
    this._displayHashMap.complete();
    this._valuesSubject.complete();
    this._blur.complete();
    this._blurSub.destroy();
  }

  selectedChip(event: MatAutocompleteSelectedEvent): void {
    this._addValue((event.option.value as SearchableValueFieldDisplayValue<T>).value);
  }

  removeWithDisplayValue(displayValue: SearchableValueFieldDisplayValue<T>): void {
    this._removeValue(displayValue.value);
  }

  addChip(event: MatChipInputEvent): void {
    const text = event.value ?? this.inputCtrl.value;
    this._addWithTextValue(text ?? '');
  }

  tabPressedOnInput(event: KeyboardEvent): boolean {
    if (event?.key?.toLowerCase() === 'tab' && this._tryAddCurrentInputValue()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return false;
    }

    return true;
  }

  onBlur(): void {
    this._blur.next();
  }

  // MARK: Internal
  private get _multiSelect(): boolean {
    return this.props()?.multiSelect ?? true;
  }

  private get _asArrayValue(): boolean {
    return this.props()?.asArrayValue ?? true;
  }

  private get _pickOnlyOne(): boolean {
    return this._asArrayValue === false || this._multiSelect === false;
  }

  private get _allowStringValues(): boolean {
    return this.props()?.allowStringValues ?? Boolean(this.props()?.convertStringValue);
  }

  private _hashForValue(): SearchableValueFieldHashFn<T, H> {
    return this.props()?.hashForValue ?? ((x) => x as unknown as H);
  }

  private _displayForValue(): SearchableValueFieldDisplayFn<T, M> {
    return this.props()?.displayForValue ?? ((values) => of(values.map((v) => ({ ...v, label: String(v.value) }))));
  }

  private _tryAddCurrentInputValue(): boolean {
    if (this._allowStringValues) {
      const value = (this.inputCtrl.value || '').trim();

      if (value) {
        this._addWithTextValue(value);
        return true;
      }
    }

    return false;
  }

  private _addWithTextValue(text: string): void {
    if (!this._allowStringValues) {
      return;
    }

    text = (text || '').trim();

    if (text) {
      this.inputCtrl.setValue(text);
    }

    if (!this.inputCtrl.valid) {
      this.inputCtrl.markAsTouched();
      return;
    }

    if (text) {
      const convertFn = this.props()?.convertStringValue;
      const value = convertFn ? convertFn(text) : (text as unknown as T);
      this._addValue(value);
    }
  }

  private _addValue(value: T): void {
    this.inputCtrl.setValue(null);
    const currentValues = this._valuesSubject.getValue();
    this._setValues([...currentValues, value]);
  }

  private _removeValue(value: T): void {
    const hashForValue = this._hashForValue();
    const hashToFilter = hashForValue(value);
    const values = this._valuesSubject.getValue().filter((x) => hashForValue(x) !== hashToFilter);
    this._setValues(values);
  }

  private _setValues(values: T[]): void {
    const hashForValue = this._hashForValue();
    values = filterUniqueValues(values, hashForValue);

    if (this._pickOnlyOne) {
      values = [lastValue(values)].filter((x) => x != null);
    }

    this._valuesSubject.next(values);
    this._setFieldValue(values);
  }

  private _setFieldValue(values: T[]): void {
    const fieldGetter = this.field();
    if (!fieldGetter || typeof fieldGetter !== 'function') return;

    let newValue: T | T[] = values;

    if (!this._asArrayValue) {
      newValue = values[0] as T;
    }

    const fieldState = (fieldGetter as any)();
    if (fieldState?.value?.set) {
      fieldState.value.set(newValue);
    }
  }

  private _loadDisplayValuesForValues(values: T[]): Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> {
    return this._loadDisplayValuesForFieldValues(values.map((value) => ({ value })));
  }

  private _loadDisplayValuesForFieldValues(values: SearchableValueFieldValue<T, M>[]): Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> {
    return this._getDisplayValuesForFieldValues(values).pipe(
      map((displayValues: ConfiguredSearchableValueFieldDisplayValue<T, M>[]) => successResult(displayValues)),
      startWithBeginLoading(),
      shareReplay(1)
    );
  }

  private _getDisplayValuesForFieldValues(values: SearchableValueFieldValue<T, M>[]): Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> {
    const hashForValue = this._hashForValue();
    const displayForValue = this._displayForValue();
    const p = this.props();
    const display = p?.display;
    const useAnchor = p?.useAnchor;
    const anchorForValue = useAnchor && p?.anchorForValue;
    const defaultDisplay = mergeDbxInjectionComponentConfigs([DEFAULT_SEARCHABLE_FIELD_DISPLAY, display]);

    return this._displayHashMap.pipe(
      mergeMap((displayMap) => {
        const mappingResult = values.map((x) => [x, hashForValue(x.value)] as [SearchableValueFieldValue<T, M>, H]).map(([x, hash], i) => [i, hash, x, displayMap.get(hash)] as [number, H, SearchableValueFieldValue<T, M>, ConfiguredSearchableValueFieldDisplayValue<T, M>]);

        const hasDisplay = mappingResult.filter((x) => Boolean(x[3]));
        const needsDisplay = mappingResult.filter((x) => !x[3]);

        let obs: Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>;

        if (needsDisplay.length > 0) {
          const displayValuesObs = displayForValue(needsDisplay.map((x) => x[2]));

          obs = displayValuesObs.pipe(
            first(),
            map((displayResults) => {
              (displayResults as Configurable<SearchableValueFieldDisplayValue<T, M>>[]).forEach((x) => {
                if (!x.display) {
                  x.display = defaultDisplay;
                } else {
                  x.display = mergeDbxInjectionComponentConfigs([defaultDisplay, x.display]);
                }

                if (!x.anchor && anchorForValue) {
                  x.anchor = (anchorForValue as SearchableValueFieldAnchorFn<T, M>)(x);
                }
              });

              const displayResultsMapping: [ConfiguredSearchableValueFieldDisplayValue<T, M>, H][] = (displayResults as ConfiguredSearchableValueFieldDisplayValue<T, M>[]).map((x) => [x, hashForValue(x.value)]);
              const valueIndexHashMap = new Map(displayResultsMapping.map(([x, hash]) => [hash, x]));

              displayResultsMapping.forEach(([x, hash]) => displayMap.set(hash, x));

              return mappingResult.map((x) => x[3] ?? valueIndexHashMap.get(x[1])) as ConfiguredSearchableValueFieldDisplayValue<T, M>[];
            })
          );
        } else {
          obs = of(hasDisplay.map((x) => x[3]));
        }

        return obs;
      })
    );
  }
}
