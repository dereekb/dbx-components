import { computed, Directive, effect, input, type InputSignal, type OnDestroy, type OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { type Maybe, type PrimativeKey, filterUniqueValues, convertMaybeToArray, type ArrayOrValue, type Configurable } from '@dereekb/util';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { SubscriptionObject, type LoadingState, successResult, startWithBeginLoading, mapLoadingStateResults } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, first, map, mergeMap, of, shareReplay, startWith, switchMap, type Observable } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { type FieldTree } from '@angular/forms/signals';
import { type DynamicText, type FieldMeta, type ValidationMessages, type BaseValueField } from '@ng-forge/dynamic-forms';
import { createResolvedErrorsSignal, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { type PickableValueFieldDisplayFunction, type PickableValueFieldDisplayValue, type PickableValueFieldFilterFunction, type PickableValueFieldHashFunction, type PickableValueFieldLoadValuesFunction, type PickableValueFieldValue } from '../../../../formly/field/selection/pickable/pickable';
import { type PickableItemFieldItem, type PickableItemFieldItemSortFn } from '../../../../formly/field/selection/pickable/pickable.field.directive';
import { forgeFieldDisabled } from '../../field.disabled';

// MARK: Field Type Names
/**
 * The custom forge field type name for the pickable chip field.
 */
export const FORGE_PICKABLE_CHIP_FIELD_TYPE = 'dbx-pickable-chip' as const;

/**
 * The custom forge field type name for the pickable list field.
 */
export const FORGE_PICKABLE_LIST_FIELD_TYPE = 'dbx-pickable-list' as const;

// MARK: Props
/**
 * Props interface for forge pickable fields (both chip and list variants).
 *
 * Passed via the `props` property on the forge field definition.
 */
export interface DbxForgePickableFieldProps<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> {
  readonly loadValues: PickableValueFieldLoadValuesFunction<T, M>;
  readonly displayForValue: PickableValueFieldDisplayFunction<T, M>;
  readonly hashForValue?: PickableValueFieldHashFunction<T, H>;
  readonly filterValues?: PickableValueFieldFilterFunction<T, M>;
  readonly sortItems?: PickableItemFieldItemSortFn<T, M>;
  readonly multiSelect?: boolean;
  readonly asArrayValue?: boolean;
  readonly showTextFilter?: boolean;
  readonly skipFilterFnOnEmpty?: boolean;
  readonly filterLabel?: string;
  readonly maxPicks?: number;
  readonly showSelectAllButton?: boolean;
  readonly changeSelectionModeToViewOnDisabled?: boolean;
  readonly footerConfig?: DbxInjectionComponentConfig;
  readonly refreshDisplayValues$?: Observable<unknown>;
  readonly hint?: string;
}

/**
 * Forge field definition interface for the pickable chip field.
 */
export interface DbxForgePickableChipFieldDef<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends BaseValueField<DbxForgePickableFieldProps<T, M, H>, T | T[]> {
  readonly type: typeof FORGE_PICKABLE_CHIP_FIELD_TYPE;
}

/**
 * Forge field definition interface for the pickable list field.
 */
export interface DbxForgePickableListFieldDef<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends BaseValueField<DbxForgePickableFieldProps<T, M, H>, T | T[]> {
  readonly type: typeof FORGE_PICKABLE_LIST_FIELD_TYPE;
}

/**
 * Display value augmented with its computed hash for deduplication.
 */
interface PickableDisplayValueWithHash<T, M = unknown, H extends PrimativeKey = PrimativeKey> extends PickableValueFieldDisplayValue<T, M> {
  _hash: H;
}

// MARK: Abstract Directive
/**
 * Abstract base directive for forge pickable item fields that manages value loading,
 * display caching, text filtering, and selection state.
 *
 * Subclasses provide the specific UI presentation (chips, lists, etc.).
 * This mirrors the formly {@link AbstractDbxPickableItemFieldDirective} pattern.
 */
@Directive()
export abstract class AbstractForgePickableItemFieldDirective<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> implements OnInit, OnDestroy {
  // MARK: ng-forge ValueFieldComponent Inputs
  readonly field = input.required<FieldTree<T | T[]>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<DbxForgePickableFieldProps<T, M, H> | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  readonly inputCtrl = new FormControl<string>('');

  private readonly _clearDisplayHashMapSub = new SubscriptionObject();
  private readonly _displayHashMap = new BehaviorSubject<Map<H, PickableDisplayValueWithHash<T, M, H>>>(new Map());
  private readonly _valuesSubject = new BehaviorSubject<T[]>([]);

  // MARK: Computed Signals
  readonly labelSignal = computed(() => {
    const l = this.label();
    return typeof l === 'string' ? l : undefined;
  });

  readonly hintSignal = computed(() => this.props()?.hint);
  readonly multiSelectSignal = computed(() => this.props()?.multiSelect ?? true);
  readonly isDisabled = forgeFieldDisabled();
  readonly readonlySignal = computed(() => {
    const fieldGetter = this.field();
    const fieldState = typeof fieldGetter === 'function' ? (fieldGetter as any)() : undefined;
    return fieldState?.readonly?.() ?? false;
  });
  readonly isDisabledOrReadonly = computed(() => this.isDisabled() || this.readonlySignal());
  readonly showSelectAllButtonSignal = computed(() => this.props()?.showSelectAllButton ?? false);
  readonly showTextFilterSignal = computed(() => this.props()?.showTextFilter ?? Boolean(this.props()?.filterValues));
  readonly filterLabelSignal = computed(() => this.props()?.filterLabel);
  readonly footerConfigSignal = computed(() => this.props()?.footerConfig);

  // Error handling
  readonly resolvedErrors = createResolvedErrorsSignal(this.field as InputSignal<any>, this.validationMessages, this.defaultValidationMessages);
  readonly showErrors = shouldShowErrors(this.field as InputSignal<any>);
  readonly errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []));

  // ARIA
  protected readonly hintId = computed(() => `${this.key()}-hint`);
  protected readonly errorId = computed(() => `${this.key()}-error`);
  protected readonly ariaInvalid = computed(() => (this.showErrors() ? 'true' : null));
  protected readonly ariaRequired = computed(() => (this.field()().required() ? 'true' : null));
  protected readonly ariaDescribedBy = computed(() => {
    if (this.errorsToDisplay().length > 0) return this.errorId();
    if (this.props()?.hint) return this.hintId();
    return null;
  });

  private get _pickOnlyOne(): boolean {
    const p = this.props();
    const asArrayValue = p?.asArrayValue ?? true;
    const multiSelect = p?.multiSelect ?? true;
    return asArrayValue === false || multiSelect === false;
  }

  private _hashForValue(): PickableValueFieldHashFunction<T, H> {
    return this.props()?.hashForValue ?? ((x) => x as unknown as H);
  }

  // MARK: Observables
  readonly filterInputValueString$: Observable<Maybe<string>> = this.inputCtrl.valueChanges.pipe(startWith(undefined), debounceTime(200), distinctUntilChanged(), shareReplay(1));

  readonly loadResultsDisplayValues$: Observable<PickableDisplayValueWithHash<T, M, H>[]> = toObservable(this.props).pipe(
    switchMap((p) => {
      const loadFn = p?.loadValues;

      if (!loadFn) {
        return of([] as PickableDisplayValueWithHash<T, M, H>[]);
      }

      return loadFn().pipe(switchMap((values) => this._loadDisplayValuesForFieldValues(values)));
    }),
    shareReplay(1)
  );

  readonly displayValuesState$: Observable<LoadingState<PickableDisplayValueWithHash<T, M, H>[]>> = combineLatest([this.loadResultsDisplayValues$, this._valuesSubject]).pipe(
    switchMap(([displayValues, currentValues]) => {
      const hashForValue = this._hashForValue();
      const displayValuesMap = new Map(displayValues.map((x) => [x._hash, x]));
      const valuesNotInDisplayMap: T[] = [];

      currentValues.forEach((x) => {
        const key = hashForValue(x);
        if (!displayValuesMap.has(key)) {
          valuesNotInDisplayMap.push(x);
        }
      });

      if (valuesNotInDisplayMap.length) {
        return this._loadDisplayValuesForFieldValuesState(valuesNotInDisplayMap.map((value) => ({ value }))).pipe(
          map((x) =>
            mapLoadingStateResults(x, {
              mapValue: (loadedValues: Configurable<PickableDisplayValueWithHash<T, M, H>>[]) => {
                loadedValues.forEach((v) => ((v as Configurable<PickableValueFieldDisplayValue<T, M>>).isUnknown = (v as PickableValueFieldDisplayValue<T, M>).isUnknown ?? true));
                return [...displayValues, ...(loadedValues as PickableDisplayValueWithHash<T, M, H>[])];
              }
            })
          )
        );
      }

      return of(successResult(displayValues));
    }),
    shareReplay(1)
  );

  readonly filteredSearchResults$: Observable<PickableDisplayValueWithHash<T, M, H>[]> = this.loadResultsDisplayValues$.pipe(
    switchMap((values) =>
      this.filterInputValueString$.pipe(
        switchMap((text) =>
          combineLatest([this._filterValues(text, values), this.displayValuesState$]).pipe(
            map(([filteredValueKeys, displayState]) => {
              const hashForValue = this._hashForValue();
              const displayValues = displayState?.value ?? [];
              const valueHashSet = new Set(filteredValueKeys.map((x) => hashForValue(x)));
              return displayValues.filter((x) => !(x as PickableValueFieldDisplayValue<T, M>).isUnknown && valueHashSet.has(x._hash));
            })
          )
        )
      )
    ),
    shareReplay(1)
  );

  readonly items$: Observable<PickableItemFieldItem<T, M>[]> = combineLatest([this.filteredSearchResults$, this._valuesSubject]).pipe(
    map(([displayValues, values]) => {
      const hashForValue = this._hashForValue();
      const selectedHashSet = new Set(values.map((x) => hashForValue(x)));
      let items: PickableItemFieldItem<T, M>[] = displayValues.map((x) => ({ itemValue: x, key: String(x._hash), selected: selectedHashSet.has(x._hash) }));

      const sortItems = this.props()?.sortItems;
      if (sortItems) {
        items = sortItems(items);
      }

      return items;
    }),
    shareReplay(1)
  );

  readonly itemsSignal = toSignal(this.items$, { initialValue: [] as PickableItemFieldItem<T, M>[] });

  readonly noItemsAvailable$ = this.items$.pipe(
    map((x) => x.length === 0),
    distinctUntilChanged()
  );

  readonly noItemsAvailableSignal = toSignal(this.noItemsAvailable$, { initialValue: false });

  readonly allSelectedSignal = computed(() => {
    const items = this.itemsSignal();
    return items.length > 0 && items.every((x) => x.selected);
  });

  // Sync field value to _valuesSubject
  private readonly _syncFieldValueEffect = effect(() => {
    const fieldGetter = this.field();
    const fieldState = typeof fieldGetter === 'function' ? (fieldGetter as any)() : undefined;
    const fieldValue = fieldState?.value?.() as Maybe<T | T[]>;
    const values = fieldValue != null ? convertMaybeToArray(fieldValue as ArrayOrValue<T>) : [];
    this._valuesSubject.next(values);
  });

  // MARK: Lifecycle
  ngOnInit(): void {
    const p = this.props();
    if (p?.refreshDisplayValues$) {
      this._clearDisplayHashMapSub.subscription = p.refreshDisplayValues$.subscribe(() => this._displayHashMap.next(new Map()));
    }
  }

  ngOnDestroy(): void {
    this._clearDisplayHashMapSub.destroy();
    this._displayHashMap.complete();
    this._valuesSubject.complete();
  }

  // MARK: Template Actions
  itemClicked(item: PickableItemFieldItem<T, M>): void {
    if (!item.disabled) {
      if (item.selected) {
        this._removeValue(item.itemValue.value);
      } else {
        this._addValue(item.itemValue.value);
      }
    }
  }

  // MARK: Protected
  protected _addValue(value: T): void {
    const currentValues = this._valuesSubject.getValue();

    if (this._pickOnlyOne) {
      this._setValues([value]);
    } else {
      this._setValues([...currentValues, value]);
    }
  }

  protected _removeValue(value: T): void {
    const hashForValue = this._hashForValue();
    const hashToFilter = hashForValue(value);
    const values = this._valuesSubject.getValue().filter((x) => hashForValue(x) !== hashToFilter);
    this._setValues(values);
  }

  protected _setValues(values: T[]): void {
    const hashForValue = this._hashForValue();
    values = filterUniqueValues(values, hashForValue);

    if (this._pickOnlyOne) {
      values = [values[0]].filter((x) => x != null);
    }

    this._valuesSubject.next(values);
    this._setFieldValue(values);
  }

  // MARK: Private
  private _setFieldValue(values: T[]): void {
    const fieldGetter = this.field();
    if (!fieldGetter || typeof fieldGetter !== 'function') return;

    const p = this.props();
    const asArrayValue = p?.asArrayValue ?? true;
    let newValue: Maybe<T | T[]> = values;

    if (!asArrayValue) {
      newValue = values[0];
    }

    const fieldState = (fieldGetter as any)();
    if (fieldState?.value?.set) {
      fieldState.value.set(newValue);
    }
  }

  private _filterValues(text: Maybe<string>, values: PickableDisplayValueWithHash<T, M, H>[]): Observable<T[]> {
    const p = this.props();
    const filterFn = p?.filterValues;
    const skipOnEmpty = p?.skipFilterFnOnEmpty ?? true;

    if (!filterFn || (skipOnEmpty && !text)) {
      return of(values.map((x) => x.value));
    }

    return filterFn(text, values);
  }

  private _loadDisplayValuesForFieldValues(values: PickableValueFieldValue<T, M>[]): Observable<PickableDisplayValueWithHash<T, M, H>[]> {
    return this._getDisplayValuesForFieldValues(values);
  }

  private _loadDisplayValuesForFieldValuesState(values: PickableValueFieldValue<T, M>[]): Observable<LoadingState<PickableDisplayValueWithHash<T, M, H>[]>> {
    return this._getDisplayValuesForFieldValues(values).pipe(
      map((displayValues) => successResult(displayValues)),
      startWithBeginLoading(),
      shareReplay(1)
    );
  }

  private _getDisplayValuesForFieldValues(values: PickableValueFieldValue<T, M>[]): Observable<PickableDisplayValueWithHash<T, M, H>[]> {
    const hashForValue = this._hashForValue();
    const displayForValue: PickableValueFieldDisplayFunction<T, M> = this.props()?.displayForValue ?? ((vals) => of(vals.map((v) => ({ ...v, label: String(v.value) }))));

    return this._displayHashMap.pipe(
      mergeMap((displayMap) => {
        const mappingResult = values.map((x) => [x, hashForValue(x.value)] as [PickableValueFieldValue<T, M>, H]).map(([x, hash], i) => [i, hash, x, displayMap.get(hash)] as [number, H, PickableValueFieldValue<T, M>, PickableDisplayValueWithHash<T, M, H>]);

        const hasDisplay = mappingResult.filter((x) => Boolean(x[3]));
        const needsDisplay = mappingResult.filter((x) => !x[3]);

        if (needsDisplay.length > 0) {
          const displayValuesObs = displayForValue(needsDisplay.map((x) => x[2]));

          return displayValuesObs.pipe(
            first(),
            map((displayResults: PickableValueFieldDisplayValue<T, M>[]) => {
              const displayResultsWithHash: PickableDisplayValueWithHash<T, M, H>[] = displayResults.map((x) => {
                (x as PickableDisplayValueWithHash<T, M, H>)._hash = hashForValue(x.value);
                return x as PickableDisplayValueWithHash<T, M, H>;
              });

              const valueIndexHashMap = new Map(displayResultsWithHash.map((x) => [x._hash, x]));
              displayResultsWithHash.forEach((x) => displayMap.set(x._hash, x));

              return mappingResult.map((x) => x[3] ?? valueIndexHashMap.get(x[1])) as PickableDisplayValueWithHash<T, M, H>[];
            })
          );
        }

        return of(hasDisplay.map((x) => x[3]));
      })
    );
  }
}
