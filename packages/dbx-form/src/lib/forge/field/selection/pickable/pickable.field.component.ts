import { ChangeDetectionStrategy, Component, computed, effect, input, type OnDestroy, type OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDivider } from '@angular/material/divider';
import { type Maybe, type PrimativeKey, filterUniqueValues, convertMaybeToArray, type ArrayOrValue, type Configurable, asArray } from '@dereekb/util';
import { type DbxInjectionComponentConfig, DbxInjectionComponent } from '@dereekb/dbx-core';
import { SubscriptionObject, type LoadingState, successResult, startWithBeginLoading, mapLoadingStateResults } from '@dereekb/rxjs';
import { DbxLoadingComponent } from '@dereekb/dbx-web';
import { BehaviorSubject, combineLatest, debounceTime, distinctUntilChanged, first, map, mergeMap, of, shareReplay, startWith, switchMap, type Observable } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { type FieldTree } from '@angular/forms/signals';
import { type DynamicText, type FieldMeta, type ValidationMessages, type BaseValueField } from '@ng-forge/dynamic-forms';
import { type PickableValueFieldDisplayFunction, type PickableValueFieldDisplayValue, type PickableValueFieldFilterFunction, type PickableValueFieldHashFunction, type PickableValueFieldLoadValuesFunction, type PickableValueFieldValue } from '../../../../formly/field/selection/pickable/pickable';
import { type PickableItemFieldItem, type PickableItemFieldItemSortFn } from '../../../../formly/field/selection/pickable/pickable.field.directive';

// MARK: Props
/**
 * Props interface for forge pickable fields (both chip and list variants).
 *
 * Passed via the `props` property on the forge field definition.
 */
export interface ForgePickableFieldProps<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> {
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
export interface ForgePickableChipFieldDef<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends BaseValueField<ForgePickableFieldProps<T, M, H>, T | T[]> {
  readonly type: 'dbx-pickable-chip';
}

/**
 * Forge field definition interface for the pickable list field.
 */
export interface ForgePickableListFieldDef<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends BaseValueField<ForgePickableFieldProps<T, M, H>, T | T[]> {
  readonly type: 'dbx-pickable-list';
}

/**
 * Display value augmented with its computed hash for deduplication.
 */
interface PickableDisplayValueWithHash<T, M = unknown, H extends PrimativeKey = PrimativeKey> extends PickableValueFieldDisplayValue<T, M> {
  _hash: H;
}

// MARK: Pickable Chip Field Component
/**
 * Forge ValueFieldComponent for pickable chip selection.
 *
 * Renders available values as Material chips with optional text filtering, select-all toggle,
 * and custom display/hash functions. Bridges the FieldTree signal form model with the
 * pickable value loading and caching pipeline.
 */
@Component({
  selector: 'dbx-forge-pickable-chip-field',
  template: `
    <div class="dbx-pickable-item-field">
      @if (labelSignal()) {
        <span class="dbx-label">{{ labelSignal() }}</span>
      }
      @if (showTextFilterSignal()) {
        <div class="dbx-pickable-item-field-filter">
          @if (filterLabelSignal()) {
            <div class="dbx-label">{{ filterLabelSignal() }}</div>
          }
          <mat-form-field>
            <input matInput [placeholder]="'Filter'" [formControl]="inputCtrl" />
          </mat-form-field>
          <mat-divider></mat-divider>
        </div>
      }
      <div class="dbx-pickable-item-field-chips">
        <mat-chip-listbox [multiple]="multiSelectSignal()" [selectable]="!readonlySignal()">
          @if (showSelectAllButtonSignal() && multiSelectSignal()) {
            <mat-chip-option (click)="toggleAll()" [selected]="allSelectedSignal()">
              <span class="dbx-chip-label">All</span>
            </mat-chip-option>
          }
          @for (item of itemsSignal(); track item.key) {
            <mat-chip-option (click)="itemClicked(item)" [selected]="item.selected" [disabled]="readonlySignal() || item.disabled">
              @if (item.itemValue.icon) {
                <mat-icon matChipAvatar>{{ item.itemValue.icon }}</mat-icon>
              }
              <span class="dbx-chip-label">{{ item.itemValue.label }}</span>
              @if (item.itemValue.sublabel) {
                <span class="dbx-chip-sublabel">{{ item.itemValue.sublabel }}</span>
              }
            </mat-chip-option>
          }
        </mat-chip-listbox>
        <dbx-injection [config]="footerConfigSignal()"></dbx-injection>
      </div>
      @if (noItemsAvailableSignal()) {
        <p class="dbx-label" role="status">No items match this filter.</p>
      }
      @if (hintSignal()) {
        <div class="dbx-form-description">{{ hintSignal() }}</div>
      }
    </div>
  `,
  imports: [FormsModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatChipsModule, MatIconModule, MatDivider, DbxLoadingComponent, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgePickableChipFieldComponent<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> implements OnInit, OnDestroy {
  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<T | T[]>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<ForgePickableFieldProps<T, M, H> | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  readonly inputCtrl = new FormControl<string>('');

  private readonly _clearDisplayHashMapSub = new SubscriptionObject();
  private readonly _displayHashMap = new BehaviorSubject<Map<H, PickableDisplayValueWithHash<T, M, H>>>(new Map());
  private readonly _valuesSubject = new BehaviorSubject<T[]>([]);

  // Computed signals from props
  readonly labelSignal = computed(() => {
    const l = this.label();
    return typeof l === 'string' ? l : undefined;
  });

  readonly hintSignal = computed(() => this.props()?.hint);
  readonly multiSelectSignal = computed(() => this.props()?.multiSelect ?? true);
  readonly readonlySignal = computed(() => false);
  readonly showSelectAllButtonSignal = computed(() => this.props()?.showSelectAllButton ?? false);
  readonly showTextFilterSignal = computed(() => this.props()?.showTextFilter ?? Boolean(this.props()?.filterValues));
  readonly filterLabelSignal = computed(() => this.props()?.filterLabel);
  readonly footerConfigSignal = computed(() => this.props()?.footerConfig);

  private get _pickOnlyOne(): boolean {
    const p = this.props();
    const asArrayValue = p?.asArrayValue ?? true;
    const multiSelect = p?.multiSelect ?? true;
    return asArrayValue === false || multiSelect === false;
  }

  private _hashForValue(): PickableValueFieldHashFunction<T, H> {
    return this.props()?.hashForValue ?? ((x) => x as unknown as H);
  }

  // Filter input
  readonly filterInputValueString$: Observable<Maybe<string>> = this.inputCtrl.valueChanges.pipe(startWith(undefined), debounceTime(200), distinctUntilChanged(), shareReplay(1));

  // Load all values and compute display values with hashes
  readonly loadResultsDisplayValues$: Observable<PickableDisplayValueWithHash<T, M, H>[]> = new BehaviorSubject<void>(undefined).pipe(
    switchMap(() => {
      const p = this.props();
      const loadFn = p?.loadValues;

      if (!loadFn) {
        return of([] as PickableDisplayValueWithHash<T, M, H>[]);
      }

      return loadFn().pipe(switchMap((values) => this._loadDisplayValuesForFieldValues(values)));
    }),
    shareReplay(1)
  );

  // Current values with their display values (includes unknown values)
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

  // Filtered search results
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

  // Items with selection state
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
    const f = this.field();
    const fieldValue = f ? ((f as any)?.value?.() as Maybe<T | T[]>) : undefined;
    const values = fieldValue != null ? convertMaybeToArray(fieldValue as ArrayOrValue<T>) : [];
    this._valuesSubject.next(values);
  });

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

  itemClicked(item: PickableItemFieldItem<T, M>): void {
    if (!item.disabled) {
      if (item.selected) {
        this._removeValue(item.itemValue.value);
      } else {
        this._addValue(item.itemValue.value);
      }
    }
  }

  toggleAll(): void {
    if (this.allSelectedSignal()) {
      this._setValues([]);
    } else {
      const items = this.itemsSignal();
      const allValues = items.filter((x) => !x.disabled).map((x) => x.itemValue.value);
      this._setValues(allValues);
    }
  }

  // MARK: Internal
  private _addValue(value: T): void {
    const currentValues = this._valuesSubject.getValue();

    if (this._pickOnlyOne) {
      this._setValues([value]);
    } else {
      this._setValues([...currentValues, value]);
    }
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
      values = [values[0]].filter((x) => x != null);
    }

    this._valuesSubject.next(values);
    this._setFieldValue(values);
  }

  private _setFieldValue(values: T[]): void {
    const f = this.field();
    if (!f) return;

    const p = this.props();
    const asArrayValue = p?.asArrayValue ?? true;
    let newValue: Maybe<T | T[]> = values;

    if (!asArrayValue) {
      newValue = values[0];
    }

    if (typeof (f as any).setValue === 'function') {
      (f as any).setValue(newValue);
    } else if (typeof (f as any).value === 'function') {
      const sig = (f as any).value;
      if (sig.set) {
        sig.set(newValue);
      }
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

// MARK: Pickable List Field Component
/**
 * Forge ValueFieldComponent for pickable list selection.
 *
 * Renders available values as a selectable list using the existing
 * {@link DbxPickableListFieldItemListComponent} for list rendering.
 */
@Component({
  selector: 'dbx-forge-pickable-list-field',
  template: `
    <div class="dbx-pickable-item-field">
      @if (labelSignal()) {
        <span class="dbx-label">{{ labelSignal() }}</span>
      }
      @if (showTextFilterSignal()) {
        <div class="dbx-pickable-item-field-filter">
          @if (filterLabelSignal()) {
            <div class="dbx-label">{{ filterLabelSignal() }}</div>
          }
          <mat-form-field>
            <input matInput [placeholder]="'Filter'" [formControl]="inputCtrl" />
          </mat-form-field>
          <mat-divider></mat-divider>
        </div>
      }
      <div class="dbx-pickable-item-field-list">
        <div class="dbx-pickable-item-field-list-content">
          <mat-chip-listbox [multiple]="multiSelectSignal()" [selectable]="true">
            @for (item of itemsSignal(); track item.key) {
              <mat-chip-option (click)="itemClicked(item)" [selected]="item.selected" [disabled]="readonlySignal() || item.disabled">
                @if (item.itemValue.icon) {
                  <mat-icon matChipAvatar>{{ item.itemValue.icon }}</mat-icon>
                }
                <span class="dbx-chip-label">{{ item.itemValue.label }}</span>
                @if (item.itemValue.sublabel) {
                  <span class="dbx-chip-sublabel">({{ item.itemValue.sublabel }})</span>
                }
              </mat-chip-option>
            }
          </mat-chip-listbox>
        </div>
        <dbx-injection [config]="footerConfigSignal()"></dbx-injection>
      </div>
      @if (noItemsAvailableSignal()) {
        <p class="dbx-label" role="status">No items match this filter.</p>
      }
      @if (hintSignal()) {
        <div class="dbx-form-description">{{ hintSignal() }}</div>
      }
    </div>
  `,
  imports: [FormsModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatChipsModule, MatIconModule, MatDivider, DbxLoadingComponent, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgePickableListFieldComponent<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> implements OnInit, OnDestroy {
  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<T | T[]>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<ForgePickableFieldProps<T, M, H> | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  readonly inputCtrl = new FormControl<string>('');

  private readonly _clearDisplayHashMapSub = new SubscriptionObject();
  private readonly _displayHashMap = new BehaviorSubject<Map<H, PickableDisplayValueWithHash<T, M, H>>>(new Map());
  private readonly _valuesSubject = new BehaviorSubject<T[]>([]);

  readonly labelSignal = computed(() => {
    const l = this.label();
    return typeof l === 'string' ? l : undefined;
  });

  readonly hintSignal = computed(() => this.props()?.hint);
  readonly multiSelectSignal = computed(() => this.props()?.multiSelect ?? true);
  readonly readonlySignal = computed(() => false);
  readonly showTextFilterSignal = computed(() => this.props()?.showTextFilter ?? Boolean(this.props()?.filterValues));
  readonly filterLabelSignal = computed(() => this.props()?.filterLabel);
  readonly footerConfigSignal = computed(() => this.props()?.footerConfig);

  private get _pickOnlyOne(): boolean {
    const p = this.props();
    const asArrayValue = p?.asArrayValue ?? true;
    const multiSelect = p?.multiSelect ?? true;
    return asArrayValue === false || multiSelect === false;
  }

  private _hashForValue(): PickableValueFieldHashFunction<T, H> {
    return this.props()?.hashForValue ?? ((x) => x as unknown as H);
  }

  readonly filterInputValueString$: Observable<Maybe<string>> = this.inputCtrl.valueChanges.pipe(startWith(undefined), debounceTime(200), distinctUntilChanged(), shareReplay(1));

  readonly loadResultsDisplayValues$: Observable<PickableDisplayValueWithHash<T, M, H>[]> = new BehaviorSubject<void>(undefined).pipe(
    switchMap(() => {
      const p = this.props();
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

  private readonly _syncFieldValueEffect = effect(() => {
    const f = this.field();
    const fieldValue = f ? ((f as any)?.value?.() as Maybe<T | T[]>) : undefined;
    const values = fieldValue != null ? convertMaybeToArray(fieldValue as ArrayOrValue<T>) : [];
    this._valuesSubject.next(values);
  });

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

  itemClicked(item: PickableItemFieldItem<T, M>): void {
    if (!item.disabled) {
      if (item.selected) {
        this._removeValue(item.itemValue.value);
      } else {
        this._addValue(item.itemValue.value);
      }
    }
  }

  // MARK: Internal
  private _addValue(value: T): void {
    const currentValues = this._valuesSubject.getValue();

    if (this._pickOnlyOne) {
      this._setValues([value]);
    } else {
      this._setValues([...currentValues, value]);
    }
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
      values = [values[0]].filter((x) => x != null);
    }

    this._valuesSubject.next(values);
    this._setFieldValue(values);
  }

  private _setFieldValue(values: T[]): void {
    const f = this.field();
    if (!f) return;

    const p = this.props();
    const asArrayValue = p?.asArrayValue ?? true;
    let newValue: Maybe<T | T[]> = values;

    if (!asArrayValue) {
      newValue = values[0];
    }

    if (typeof (f as any).setValue === 'function') {
      (f as any).setValue(newValue);
    } else if (typeof (f as any).value === 'function') {
      const sig = (f as any).value;
      if (sig.set) {
        sig.set(newValue);
      }
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
