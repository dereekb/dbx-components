import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, type OnDestroy, type OnInit, viewChild } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import { MatError, MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatOptgroup, MatOption, MatSelect } from '@angular/material/select';
import { MatHint } from '@angular/material/input';
import { DynamicTextPipe, type DynamicText, type FieldMeta, type ValidationMessages } from '@ng-forge/dynamic-forms';
import { createResolvedErrorsSignal, setupMetaTracking, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { MATERIAL_CONFIG } from '@ng-forge/dynamic-forms-material';
import { AsyncPipe } from '@angular/common';
import { type Maybe, type PrimativeKey, addToSetCopy, asArray, convertMaybeToArray, filterEmptyArrayValues, filterMaybeArrayValues, lastValue, makeValuesGroupMap, mergeArrays, separateValues, setContainsAllValues, setsAreEquivalent, sortByStringFunction } from '@dereekb/util';
import { filterMaybe, type LoadingState, isLoadingStateWithDefinedValue, isLoadingStateLoading, type LoadingStateWithDefinedValue, startWithBeginLoading, successResult, beginLoading, mapLoadingStateValueWithOperator, loadingStateContext, type WorkUsingContext, valueFromFinishedLoadingState } from '@dereekb/rxjs';
import { DbxActionModule, DbxButtonComponent, DbxLoadingComponent } from '@dereekb/dbx-web';
import { BehaviorSubject, combineLatest, distinctUntilChanged, first, map, mergeMap, of, scan, shareReplay, switchMap, tap, type Observable } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { type SourceSelectDisplayValue, type SourceSelectDisplayValueGroup, type SourceSelectLoadSource, type SourceSelectLoadSourceLoadingState, type SourceSelectOpenSourceResult, type SourceSelectOptions, type SourceSelectValue, type SourceSelectValueGroup } from '../../../../formly/field/selection/sourceselect/sourceselect';
import { dbxForgeFieldDisabled } from '../../field.util';
import type { DbxForgeSourceSelectFieldProps } from './sourceselect.field';
import { cleanSubscription, completeOnDestroy } from '@dereekb/dbx-core';

interface SelectFieldOpenSourceMap<T extends PrimativeKey = PrimativeKey, M = unknown> {
  readonly values: SourceSelectValue<T, M>[];
  readonly valuesSet: Set<T>;
}

// MARK: Source Select Field Component
/**
 * Forge ValueFieldComponent for source-select fields.
 *
 * Renders a Material select dropdown inside `<mat-form-field>` populated from multiple data sources
 * (open source dialogs, loaded sources, and form control values).
 * Merges values, deduplicates by key, groups options by label,
 * and caches display values and metadata for performance.
 *
 * Uses `[formField]` for native ng-forge value binding, `<mat-form-field>` for proper
 * Material rendering, and `[attr.hidden]` for built-in logic (hidden/disabled) support.
 */
@Component({
  selector: 'dbx-forge-source-select-field',
  templateUrl: './sourceselect.field.component.html',
  imports: [MatFormField, MatLabel, MatSelect, MatOption, MatOptgroup, MatHint, MatError, MatSuffix, FormField, DynamicTextPipe, AsyncPipe, DbxButtonComponent, DbxActionModule, DbxLoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[id]': '`${key()}`',
    '[attr.data-testid]': 'key()',
    '[class]': 'className()',
    '[attr.hidden]': 'field()().hidden() || null'
  }
})
export class DbxForgeSourceSelectFieldComponent<T extends PrimativeKey = PrimativeKey, M = unknown> implements OnInit, OnDestroy {
  private readonly materialConfig = inject(MATERIAL_CONFIG, { optional: true });
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<T | T[]>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<DbxForgeSourceSelectFieldProps<T, M> | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  // Disabled state
  readonly isDisabled = dbxForgeFieldDisabled();

  private readonly _cacheMetaSub = cleanSubscription();
  private readonly _clearDisplayHashMapSub = cleanSubscription();
  private readonly _valueMetaHashMap = completeOnDestroy(new BehaviorSubject<Map<T, SourceSelectValue<T, M>>>(new Map()));
  private readonly _displayHashMap = completeOnDestroy(new BehaviorSubject<Map<T, SourceSelectDisplayValue<T, M>>>(new Map()));
  private readonly _fromOpenSource = completeOnDestroy(new BehaviorSubject<SelectFieldOpenSourceMap<T, M>>({ values: [], valuesSet: new Set() }));
  private readonly _loadSources = completeOnDestroy(new BehaviorSubject<Maybe<Observable<SourceSelectLoadSource<M>[]>>>(undefined));
  private readonly _valuesSubject = completeOnDestroy(new BehaviorSubject<T[]>([]));
  private readonly _filterText$ = completeOnDestroy(new BehaviorSubject<string>(''));

  readonly buttonElement = viewChild<string, ElementRef<HTMLElement>>('button', { read: ElementRef<HTMLElement> });
  readonly filterInputElement = viewChild<string, ElementRef<HTMLInputElement>>('filterInput', { read: ElementRef<HTMLInputElement> });

  // Computed signals from props
  readonly hintSignal = computed(() => this.props()?.hint);

  // Material config
  readonly effectiveAppearance = computed(() => this.materialConfig?.appearance ?? 'outline');
  readonly effectiveSubscriptSizing = computed(() => this.materialConfig?.subscriptSizing ?? 'dynamic');

  // Error handling
  readonly resolvedErrors = createResolvedErrorsSignal(this.field as any, this.validationMessages, this.defaultValidationMessages);
  readonly showErrors = shouldShowErrors(this.field as any);
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

  readonly multipleSignal = computed(() => this.props()?.multiple ?? false);
  readonly showOpenSourceButtonSignal = computed(() => Boolean(this.props()?.openSource));
  readonly selectButtonIconSignal = computed(() => this.props()?.selectButtonIcon ?? 'add');
  readonly filterableSignal = computed(() => this.props()?.filterable !== false);
  readonly filterableGroupsSignal = computed(() => this.props()?.filterableGroups !== false);
  readonly selectPanelClassSignal = computed(() => (this.filterableSignal() ? 'dbx-source-select-filterable-panel' : ''));

  readonly values$: Observable<T[]> = this._valuesSubject.asObservable().pipe(shareReplay(1));

  readonly allValuesEverSelected$: Observable<T[]> = this.values$.pipe(
    scan((acc, values) => {
      let result: Set<T> = acc;
      if (!setContainsAllValues(acc, values)) {
        result = addToSetCopy(acc, values);
      }
      return result;
    }, new Set<T>()),
    distinctUntilChanged(),
    map((x) => [...x]),
    shareReplay(1)
  );

  readonly sourceSelectValuesFromValuesState$: Observable<LoadingState<SourceSelectValue<T, M>[]>> = this.allValuesEverSelected$.pipe(
    distinctUntilChanged(),
    switchMap((values: T[]) => this._loadSourceSelectValueForValues(values)),
    shareReplay(1)
  );

  readonly loadSources$: Observable<LoadingState<SourceSelectValueGroup<T, M>[]>> = this._loadSources.pipe(
    filterMaybe(),
    switchMap((loadSource) => {
      const p = this.props();
      const valueReader = p?.valueReader;

      if (!valueReader) {
        return of(successResult([] as SourceSelectValueGroup<T, M>[]));
      }

      return loadSource.pipe(
        switchMap((sources: SourceSelectLoadSource<M>[]) => {
          const sourceObs: Observable<SourceSelectLoadSourceLoadingState<M>>[] = sources.map((x) => x.meta.pipe(map((metaState) => ({ ...metaState, label: x.label }))));

          if (sourceObs.length === 0) {
            return of(successResult([] as SourceSelectValueGroup<T, M>[]));
          }

          return combineLatest(sourceObs).pipe(
            map((x) => {
              const statesWithValues = x.filter((y) => isLoadingStateWithDefinedValue(y));
              const loading = x.some(isLoadingStateLoading);
              const value: SourceSelectValueGroup<T, M>[] = statesWithValues.map((y) => ({
                label: y.label,
                values: (y.value as M[]).map((meta) => ({ meta, value: valueReader(meta) }))
              }));

              return { loading, value };
            })
          );
        })
      );
    })
  );

  readonly fromOpenSource$: Observable<SourceSelectValueGroup<T, M>> = this._fromOpenSource.pipe(
    distinctUntilChanged((a, b) => setsAreEquivalent(a.valuesSet, b.valuesSet)),
    map((x) => ({ label: '', values: x.values })),
    shareReplay(1)
  );

  readonly valueGroupsFromSourcesState$: Observable<LoadingStateWithDefinedValue<SourceSelectValueGroup<T, M>[]>> = combineLatest([this.fromOpenSource$, this.loadSources$]).pipe(
    map(([fromOpenSourceGroup, loadSources]) => {
      const loadSourcesValue = loadSources.value ?? [];
      const value: SourceSelectValueGroup<T, M>[] = [fromOpenSourceGroup, ...loadSourcesValue];
      return { loading: loadSources.loading, value } as LoadingStateWithDefinedValue<SourceSelectValueGroup<T, M>[]>;
    }),
    shareReplay(1)
  );

  readonly allValueGroupsState$: Observable<LoadingState<SourceSelectValueGroup<T, M>[]>> = this.sourceSelectValuesFromValuesState$.pipe(
    switchMap((sourceSelectValuesFromValues: LoadingState<SourceSelectValue<T, M>[]>) => {
      if (isLoadingStateWithDefinedValue(sourceSelectValuesFromValues)) {
        const valuesFromValuesGroup: SourceSelectValueGroup<T, M> = { label: '', values: sourceSelectValuesFromValues.value };

        return this.valueGroupsFromSourcesState$.pipe(
          map((sourcesState) => ({
            loading: sourceSelectValuesFromValues.loading || sourcesState.loading,
            value: [valuesFromValuesGroup, ...sourcesState.value]
          }))
        );
      }

      return of(beginLoading<SourceSelectValueGroup<T, M>[]>({}));
    }),
    shareReplay(1)
  );

  readonly allOptionGroupsState$: Observable<LoadingState<SourceSelectDisplayValueGroup<T, M>[]>> = this.allValueGroupsState$.pipe(
    mapLoadingStateValueWithOperator(
      switchMap((groups: SourceSelectValueGroup<T, M>[]) => {
        const allGroupsReducedByLabel = makeValuesGroupMap(groups, (x) => x.label) as Map<string, SourceSelectValueGroup<T, M>[]>;
        const valuesEncountered = new Set<T>();
        const allUniqueValues: SourceSelectValue<T, M>[] = [];
        const simplifiedValuesGroups: SourceSelectValueGroup<T, M>[] = [];

        Array.from(allGroupsReducedByLabel.entries())
          .sort(sortByStringFunction((x) => x[0]))
          .forEach(([label, groups]) => {
            const values: SourceSelectValue<T, M>[] = [];

            groups.forEach((group) => {
              group.values.forEach((selectValue) => {
                if (!valuesEncountered.has(selectValue.value)) {
                  values.push(selectValue);
                  allUniqueValues.push(selectValue);
                  valuesEncountered.add(selectValue.value);
                }
              });
            });

            if (values.length > 0) {
              simplifiedValuesGroups.push({ label, values });
            }
          });

        return this._getDisplayValuesForSelectValues(allUniqueValues).pipe(
          map((displayValues) => {
            const displayValuesMap = new Map(displayValues.map((x) => [x.value, x]));

            const displayGroups: SourceSelectDisplayValueGroup<T, M>[] = simplifiedValuesGroups.map((valueGroup) => ({
              label: valueGroup.label,
              values: filterMaybeArrayValues(valueGroup.values.map((x) => displayValuesMap.get(x.value)))
            }));

            return displayGroups;
          })
        );
      })
    ),
    shareReplay(1)
  );

  readonly allOptionGroups$: Observable<SourceSelectDisplayValueGroup<T, M>[]> = this.allOptionGroupsState$.pipe(
    valueFromFinishedLoadingState(),
    map((x) => x ?? []),
    shareReplay(1)
  );

  readonly options$: Observable<SourceSelectOptions<T, M>> = this.allOptionGroups$.pipe(
    map((x) => {
      const { included: groupedValues, excluded: nonGroupedGroup } = separateValues(x, (y) => Boolean(y.label));
      return { nonGroupedValues: nonGroupedGroup[0]?.values ?? [], groupedValues };
    }),
    shareReplay(1)
  );

  readonly filteredOptions$: Observable<SourceSelectOptions<T, M>> = combineLatest([this.options$, this._filterText$, this.values$]).pipe(
    map(([options, filterText, currentValues]) => {
      if (!filterText) return options;

      const lowerFilter = filterText.toLowerCase();
      const selectedSet = new Set(currentValues);
      const matches = (dv: SourceSelectDisplayValue<T, M>) => selectedSet.has(dv.value) || dv.label.toLowerCase().includes(lowerFilter);
      const filterGroups = this.filterableGroupsSignal();

      return {
        nonGroupedValues: options.nonGroupedValues.filter(matches),
        groupedValues: options.groupedValues
          .map((g) => {
            const groupLabelMatches = filterGroups && g.label.toLowerCase().includes(lowerFilter);
            const filteredValues = groupLabelMatches ? g.values : g.values.filter(matches);
            return { label: g.label, values: filteredValues };
          })
          .filter((g: SourceSelectDisplayValueGroup<T, M>) => g.values.length > 0)
      };
    }),
    shareReplay(1)
  );

  readonly filteredNonGroupedValuesSignal = toSignal(this.filteredOptions$.pipe(map((x) => x.nonGroupedValues)));
  readonly filteredGroupedOptionsSignal = toSignal(this.filteredOptions$.pipe(map((x) => x.groupedValues)));

  readonly context = loadingStateContext({ obs: this.allOptionGroupsState$ });

  // Sync field value to _valuesSubject
  private readonly _syncFieldValueEffect = effect(() => {
    const fieldGetter = this.field();
    if (!fieldGetter) return;

    // FieldTree is a signal — call it to get the field state, then read .value()
    const fieldState = typeof fieldGetter === 'function' ? (fieldGetter as any)() : undefined;
    const fieldValue = fieldState?.value?.() as Maybe<T | T[]>;
    // ng-forge can seed the field with the empty-string primitive default; treat nullish/empty as unset.
    const values = filterEmptyArrayValues(fieldValue != null ? convertMaybeToArray(fieldValue) : []);
    this._valuesSubject.next(values);
  });

  constructor() {
    setupMetaTracking(this.elementRef, this.meta as any, { selector: 'mat-select' });
  }

  ngOnInit(): void {
    const p = this.props();

    this._loadSources.next(p?.loadSources?.() || of([]));

    if (p?.refreshDisplayValues$) {
      this._clearDisplayHashMapSub.subscription = p.refreshDisplayValues$.subscribe(() => this._displayHashMap.next(new Map()));
    }

    // Cache meta values from sources
    this._cacheMetaSub.subscription = this.valueGroupsFromSourcesState$.subscribe((x) => {
      const hashMap = this._valueMetaHashMap.value;
      x.value.forEach((group) => group.values.forEach((v) => hashMap.set(v.value, v)));
    });
  }

  ngOnDestroy(): void {
    this.context.destroy();
  }

  onSelectOpenedChange(opened: boolean): void {
    if (opened) {
      setTimeout(() => {
        const inputEl = this.filterInputElement();
        if (inputEl) {
          inputEl.nativeElement.focus();
        }
      });
    } else {
      this._filterText$.next('');
    }
  }

  onFilterInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this._filterText$.next(input.value);
  }

  onFilterKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' && event.key !== 'Tab') {
      event.stopPropagation();
    }
  }

  readonly handleSelectOptions: WorkUsingContext<unknown> = (_, context) => {
    const p = this.props();
    const openSource = p?.openSource;
    const origin = this.buttonElement();

    if (openSource && origin) {
      const sourceObs = openSource({ origin });
      context.startWorkingWithObservable(
        sourceObs.pipe(
          first(),
          tap((result: SourceSelectOpenSourceResult<M>) => {
            const valueReader = p?.valueReader;
            if (!valueReader) return;

            const valuesToAdd = mergeArrays([result.select, result.options]);
            if (valuesToAdd.length) {
              this._addToOpenSourceMap(valuesToAdd);
            }

            if (result.set) {
              this._setCurrentValue(result.set.map((x) => valueReader(x)));
            } else if (result.select) {
              this._addToCurrentValue(result.select.map((x) => valueReader(x)));
            }
          })
        )
      );
    } else {
      context.reject();
    }
  };

  // MARK: Internal
  private _addToOpenSourceMap(input: M[]): void {
    const p = this.props();
    const valueReader = p?.valueReader;
    if (!valueReader) return;

    const { values: meta, valuesSet: initialValues } = this._fromOpenSource.value;
    const newMetaFromInput: SourceSelectValue<T, M>[] = [];
    const valuesSet = new Set(initialValues);

    input.forEach((x) => {
      const value = valueReader(x);
      if (!valuesSet.has(value)) {
        newMetaFromInput.push({ meta: x, value });
        valuesSet.add(value);
      }
    });

    if (newMetaFromInput.length > 0) {
      this._fromOpenSource.next({ values: [...meta, ...newMetaFromInput], valuesSet });
    }
  }

  private _addToCurrentValue(values: T[]): void {
    const currentValue = asArray(this._valuesSubject.getValue());
    this._setCurrentValue([...currentValue, ...values]);
  }

  private _setCurrentValue(newValueArray: T[]): void {
    const p = this.props();
    const multiple = p?.multiple ?? false;
    const sanitized = filterEmptyArrayValues(newValueArray);
    const value = multiple ? sanitized : lastValue(sanitized);
    const valuesArray = convertMaybeToArray(value);
    this._valuesSubject.next(valuesArray);
    this._setFieldValue(value);
  }

  private _setFieldValue(value: Maybe<T | T[]>): void {
    const fieldGetter = this.field();
    if (!fieldGetter || typeof fieldGetter !== 'function') return;

    const fieldState = (fieldGetter as any)();
    if (fieldState?.value?.set) {
      fieldState.value.set(value);
    }
  }

  private _loadSourceSelectValueForValues(values: T[]): Observable<LoadingState<SourceSelectValue<T, M>[]>> {
    return this._getSourceSelectValueForValues(values).pipe(
      map((sourceSelectValues: SourceSelectValue<T, M>[]) => successResult(sourceSelectValues)),
      startWithBeginLoading(),
      shareReplay(1)
    );
  }

  private _getSourceSelectValueForValues(values: T[]): Observable<SourceSelectValue<T, M>[]> {
    const p = this.props();
    const valueReader = p?.valueReader;
    const metaLoader = p?.metaLoader;

    if (!valueReader || !metaLoader) {
      return of([]);
    }

    return this._valueMetaHashMap.pipe(
      mergeMap((metaMap) => {
        const mappingResult = values.map((hash, i) => [i, hash, metaMap.get(hash)] as [number, T, SourceSelectValue<T, M>]);
        const { included: hasMeta, excluded: needsMeta } = separateValues(mappingResult, (x) => Boolean(x[2]));

        if (needsMeta.length > 0) {
          return metaLoader(needsMeta.map((x) => x[1])).pipe(
            first(),
            map((metaResults) => {
              const metaResultsMapping: SourceSelectValue<T, M>[] = metaResults.filter((meta) => meta != null).map((meta) => ({ meta, value: valueReader(meta) }));
              const valueIndexHashMap = new Map(metaResultsMapping.map((x) => [x.value, x]));
              metaResultsMapping.forEach((x) => metaMap.set(x.value, x));
              return mappingResult.map((x) => x[2] ?? valueIndexHashMap.get(x[1])).filter((x) => x != null);
            })
          );
        }

        return of(hasMeta.map((x) => x[2]));
      })
    );
  }

  private _getDisplayValuesForSelectValues(values: SourceSelectValue<T, M>[]): Observable<SourceSelectDisplayValue<T, M>[]> {
    const p = this.props();
    const displayForValue = p?.displayForValue;

    if (!displayForValue) {
      return of(values.map((v) => ({ ...v, label: String(v.value) })));
    }

    return this._displayHashMap.pipe(
      mergeMap((displayMap) => {
        const mappingResult = values.map((x) => [x, x.value] as [SourceSelectValue<T, M>, T]).map(([x, hash], i) => [i, hash, x, displayMap.get(hash)] as [number, T, SourceSelectValue<T, M>, SourceSelectDisplayValue<T, M>]);
        const hasDisplay = mappingResult.filter((x) => Boolean(x[3]));
        const needsDisplay = mappingResult.filter((x) => !x[3]);

        if (needsDisplay.length > 0) {
          return displayForValue(needsDisplay.map((x) => x[2])).pipe(
            first(),
            map((displayResults: SourceSelectDisplayValue<T, M>[]) => {
              const displayResultsMapping: [SourceSelectDisplayValue<T, M>, T][] = displayResults.map((x) => [x, x.value]);
              const valueIndexHashMap = new Map(displayResultsMapping.map(([x, hash]) => [hash, x]));
              displayResultsMapping.forEach(([x, hash]) => displayMap.set(hash, x));
              return mappingResult.map((x) => x[3] ?? valueIndexHashMap.get(x[1])) as SourceSelectDisplayValue<T, M>[];
            })
          );
        }

        return of(hasDisplay.map((x) => x[3]));
      })
    );
  }
}
