import { computed, Directive, input, type OnDestroy, type OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { type PrimativeKey, type Configurable } from '@dereekb/util';
import { type DbxInjectionComponentConfig, mergeDbxInjectionComponentConfigs } from '@dereekb/dbx-core';
import { SubscriptionObject, type LoadingState, successResult, startWithBeginLoading } from '@dereekb/rxjs';
import { BehaviorSubject, debounceTime, distinctUntilChanged, first, map, mergeMap, of, shareReplay, startWith, switchMap, type Observable } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { type DynamicText, type FieldMeta, type ValidationMessages } from '@ng-forge/dynamic-forms';
import { type SearchableValueFieldDisplayFn, type SearchableValueFieldDisplayValue, type SearchableValueFieldValue, type SearchableValueFieldAnchorFn, type SearchableValueFieldHashFn, type ConfiguredSearchableValueFieldDisplayValue } from '../../../../formly/field/selection/searchable/searchable';
import { DbxDefaultSearchableFieldDisplayComponent } from '../../../../formly/field/selection/searchable/searchable.field.autocomplete.item.component';
import { type DbxForgeSearchableTextFieldProps } from './searchable.field';

export type { DbxForgeSearchableTextFieldProps, DbxForgeSearchableChipFieldProps } from './searchable.field';

const DEFAULT_SEARCH_INPUT_PLACEHOLDER = 'Type to Search';

const DEFAULT_SEARCHABLE_FIELD_DISPLAY: Partial<DbxInjectionComponentConfig> = {
  componentClass: DbxDefaultSearchableFieldDisplayComponent
};

// MARK: Abstract Directive
/**
 * Abstract base directive for forge searchable fields that manages display caching,
 * search result loading, and common signals.
 *
 * Subclasses provide the specific value model (single-value text or multi-value chip).
 */
@Directive()
export abstract class AbstractForgeSearchableFieldDirective<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey, P extends DbxForgeSearchableTextFieldProps<T, M, H> = DbxForgeSearchableTextFieldProps<T, M, H>> implements OnInit, OnDestroy {
  // MARK: ng-forge ValueFieldComponent Inputs
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<P | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  readonly inputCtrl = new FormControl<string>('');

  protected readonly _clearDisplayHashMapSub = new SubscriptionObject();
  protected readonly _displayHashMap = new BehaviorSubject<Map<H, ConfiguredSearchableValueFieldDisplayValue<T, M>>>(new Map());

  // MARK: Input Observables
  readonly inputValue$: Observable<string> = this.inputCtrl.valueChanges.pipe(
    startWith(this.inputCtrl.value),
    map((x) => (typeof x === 'string' ? x : ''))
  );

  readonly inputValueString$: Observable<string> = this.inputValue$.pipe(debounceTime(200), distinctUntilChanged());

  // MARK: Computed Signals
  readonly labelSignal = computed(() => {
    const l = this.label();
    return typeof l === 'string' ? l : undefined;
  });

  readonly hintSignal = computed(() => this.props()?.hint);

  // ARIA IDs
  protected readonly hintId = computed(() => `${this.key()}-hint`);
  protected readonly errorId = computed(() => `${this.key()}-error`);

  readonly searchInputPlaceholder = computed(() => {
    const p = this.props();
    const searchOnEmpty = p?.searchOnEmptyText ?? false;
    const placeholder = typeof this.placeholder() === 'string' ? (this.placeholder() as string) : undefined;
    return placeholder || (searchOnEmpty ? '' : DEFAULT_SEARCH_INPUT_PLACEHOLDER);
  });

  // MARK: Search Results
  readonly searchResultsState$: Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> = this.inputValueString$.pipe(
    switchMap((text) => {
      const p = this.props();
      const searchOnEmptyText = p?.searchOnEmptyText ?? false;
      const searchFn = p?.search;
      let result: Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>>;

      if (!searchFn) {
        result = of(successResult([] as ConfiguredSearchableValueFieldDisplayValue<T, M>[]));
      } else {
        result = (text || searchOnEmptyText ? searchFn(text ?? '') : of([])).pipe(
          switchMap((x) => this._loadDisplayValuesForFieldValues(x)),
          startWithBeginLoading()
        );
      }

      return result;
    }),
    shareReplay(1)
  );

  readonly searchResults$: Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> = this.searchResultsState$.pipe(
    map((x) => x?.value ?? []),
    shareReplay(1)
  );

  readonly searchResultsSignal = toSignal(this.searchResults$, { initialValue: [] as ConfiguredSearchableValueFieldDisplayValue<T, M>[] });

  // MARK: Lifecycle
  ngOnInit(): void {
    const p = this.props();
    if (p?.refreshDisplayValues$) {
      this._clearDisplayHashMapSub.subscription = p.refreshDisplayValues$.subscribe(() => this._displayHashMap.next(new Map()));
    }

    this._onInit();
  }

  ngOnDestroy(): void {
    this._clearDisplayHashMapSub.destroy();
    this._displayHashMap.complete();
    this._onDestroy();
  }

  /**
   * Subclass lifecycle hook called at the end of ngOnInit.
   */
  protected abstract _onInit(): void;
  /**
   * Subclass lifecycle hook called at the end of ngOnDestroy.
   */
  protected abstract _onDestroy(): void;

  // MARK: Protected Helpers
  protected _hashForValue(): SearchableValueFieldHashFn<T, H> {
    return this.props()?.hashForValue ?? ((x) => x as unknown as H);
  }

  protected _displayForValue(): SearchableValueFieldDisplayFn<T, M> {
    return this.props()?.displayForValue ?? ((values) => of(values.map((v) => ({ ...v, label: String(v.value) }))));
  }

  protected _loadDisplayValuesForValues(values: T[]): Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> {
    return this._loadDisplayValuesForFieldValues(values.map((value) => ({ value })));
  }

  protected _loadDisplayValuesForFieldValues(values: SearchableValueFieldValue<T, M>[]): Observable<LoadingState<ConfiguredSearchableValueFieldDisplayValue<T, M>[]>> {
    return this._getDisplayValuesForFieldValues(values).pipe(
      map((displayValues: ConfiguredSearchableValueFieldDisplayValue<T, M>[]) => successResult(displayValues)),
      startWithBeginLoading(),
      shareReplay(1)
    );
  }

  protected _getDisplayValuesForFieldValues(values: SearchableValueFieldValue<T, M>[]): Observable<ConfiguredSearchableValueFieldDisplayValue<T, M>[]> {
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
