import { filterMaybe, type LoadingState, isLoadingStateWithDefinedValue, isLoadingStateLoading, type LoadingStateWithDefinedValue, startWithBeginLoading, SubscriptionObject, successResult, beginLoading, mapLoadingStateValueWithOperator, loadingStateContext, type WorkUsingContext, valueFromFinishedLoadingState } from '@dereekb/rxjs';
import { ChangeDetectionStrategy, Component, ElementRef, type OnDestroy, type OnInit, viewChild } from '@angular/core';
import { distinctUntilChanged, map, switchMap, shareReplay, startWith, mergeMap, scan, BehaviorSubject, tap, first, type Observable, combineLatest, of } from 'rxjs';
import { addToSetCopy, asArray, convertMaybeToArray, filterMaybeArrayValues, lastValue, makeValuesGroupMap, type Maybe, mergeArrays, type PrimativeKey, separateValues, setContainsAllValues, setsAreEquivalent, sortByStringFunction } from '@dereekb/util';
import { FieldType, type FormlyFieldProps } from '@ngx-formly/material/form-field';
import { type FieldTypeConfig } from '@ngx-formly/core';
import { type SourceSelectValueMetaLoader, type SourceSelectMetaValueReader, type SourceSelectOpenFunction, type SourceSelectLoadSourcesFunction, type SourceSelectLoadSource, type SourceSelectLoadSourceLoadingState, type SourceSelectDisplayValue, type SourceSelectValue, type SourceSelectDisplayFunction, type SourceSelectDisplayValueGroup, type SourceSelectValueGroup, type SourceSelectOptions, type SourceSelectOpenSourceResult } from './sourceselect';
import { type AbstractControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatOptgroup, MatOption, MatSelect } from '@angular/material/select';
import { DbxActionModule, DbxButtonComponent, DbxButtonSpacerDirective, DbxLoadingComponent } from '@dereekb/dbx-web';

/**
 * Formly field properties for the source-select field.
 *
 * Configures how values are loaded from external sources, how metadata is resolved,
 * and how display values are rendered in the select dropdown.
 */
export interface SourceSelectFieldProps<T extends PrimativeKey = PrimativeKey, M = unknown> extends FormlyFieldProps {
  /**
   * Function to open the source and request values.
   */
  readonly openSource?: SourceSelectOpenFunction<M>;
  /**
   * Loads the sources to display entries from.
   */
  readonly loadSources?: SourceSelectLoadSourcesFunction<M>;
  /**
   * Reads the value from a meta value.
   */
  readonly valueReader: SourceSelectMetaValueReader<T, M>;
  /**
   * Loads metadata for the input values.
   */
  readonly metaLoader: SourceSelectValueMetaLoader<T, M>;
  /**
   * Used for building a display value given the input.
   */
  readonly displayForValue: SourceSelectDisplayFunction<T, M>;
  /**
   * Select button icon
   */
  readonly selectButtonIcon?: string;
  /**
   * Whether or not the selection is as an array.
   */
  readonly multiple?: boolean;
  /**
   * (Optional) observable that will trigger the clearing of all cached display values.
   */
  readonly refreshDisplayValues$?: Observable<unknown>;
  /**
   * Whether to show a type-to-filter text input inside the dropdown panel.
   *
   * When enabled, a sticky text input appears at the top of the dropdown that
   * filters visible options by label. Currently-selected values always remain visible.
   *
   * Defaults to true.
   */
  readonly filterable?: boolean;
  /**
   * Whether the filter also matches against group labels.
   *
   * When enabled, typing a group name (e.g. "Source B") will show all options
   * within matching groups, even if individual option labels don't match.
   *
   * Defaults to true.
   */
  readonly filterableGroups?: boolean;
}

interface SelectFieldOpenSourceMap<T extends PrimativeKey = PrimativeKey, M = unknown> {
  readonly values: SourceSelectValue<T, M>[];
  readonly valuesSet: Set<T>;
}

/**
 * Formly field component that renders a Material select dropdown populated from
 * multiple data sources (open source dialogs, loaded sources, and form control values).
 *
 * Merges values from all sources, deduplicates by value key, groups options by label,
 * and caches display values and metadata for performance.
 */
@Component({
  selector: 'dbx-form-sourceselectfield',
  templateUrl: 'sourceselect.field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSelect, MatOption, FormsModule, ReactiveFormsModule, DbxButtonComponent, MatOptgroup, DbxButtonSpacerDirective, DbxActionModule, DbxLoadingComponent],
  standalone: true
})
export class DbxFormSourceSelectFieldComponent<T extends PrimativeKey = PrimativeKey, M = unknown> extends FieldType<FieldTypeConfig<SourceSelectFieldProps<T, M>>> implements OnInit, OnDestroy {
  private readonly _cacheMetaSub = new SubscriptionObject();
  private readonly _clearDisplayHashMapSub = new SubscriptionObject();
  private readonly _valueMetaHashMap = new BehaviorSubject<Map<T, SourceSelectValue<T, M>>>(new Map());
  private readonly _displayHashMap = new BehaviorSubject<Map<T, SourceSelectDisplayValue<T, M>>>(new Map());

  private readonly _formControlObs = new BehaviorSubject<Maybe<AbstractControl<T[]>>>(undefined);
  private readonly _fromOpenSource = new BehaviorSubject<SelectFieldOpenSourceMap<T, M>>({ values: [], valuesSet: new Set() });
  private readonly _loadSources = new BehaviorSubject<Maybe<Observable<SourceSelectLoadSource<M>[]>>>(undefined);

  readonly buttonElement = viewChild<string, ElementRef<HTMLElement>>('button', { read: ElementRef<HTMLElement> });

  readonly formControl$ = this._formControlObs.pipe(filterMaybe());

  readonly currentFormControlValue$ = this.formControl$.pipe(
    switchMap((control) => control.valueChanges.pipe(startWith(control.value))),
    shareReplay(1)
  );

  readonly values$: Observable<T[]> = this.currentFormControlValue$.pipe(map(convertMaybeToArray), shareReplay(1));

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
    switchMap((values: T[]) => this.loadSourceSelectValueForValues(values)),
    shareReplay(1)
  );

  readonly loadSources$: Observable<LoadingState<SourceSelectValueGroup<T, M>[]>> = this._loadSources.pipe(
    filterMaybe(),
    switchMap((loadSource) => {
      const { valueReader } = this;

      return loadSource.pipe(
        switchMap((sources: SourceSelectLoadSource<M>[]) => {
          const sourceObs: Observable<SourceSelectLoadSourceLoadingState<M>>[] = sources.map((x) => x.meta.pipe(map((metaState) => ({ ...metaState, label: x.label }))));

          if (sourceObs.length === 0) {
            return of(successResult([]));
          } else {
            return combineLatest(sourceObs).pipe(
              map((x) => {
                const statesWithValues = x.filter((y) => isLoadingStateWithDefinedValue(y));
                const loading = x.some(isLoadingStateLoading);
                const value: SourceSelectValueGroup<T, M>[] = statesWithValues.map((y) => {
                  const group: SourceSelectValueGroup<T, M> = {
                    label: y.label,
                    values: (y.value as M[]).map((meta) => ({ meta, value: valueReader(meta) }))
                  };

                  return group;
                });

                return {
                  loading,
                  value
                };
              })
            );
          }
        })
      );
    })
  );

  readonly fromOpenSource$: Observable<SourceSelectValueGroup<T, M>> = this._fromOpenSource.pipe(
    distinctUntilChanged((a, b) => setsAreEquivalent(a.valuesSet, b.valuesSet)),
    map((x) => {
      const group: SourceSelectValueGroup<T, M> = {
        label: '',
        values: x.values
      };

      return group;
    }),
    shareReplay(1)
  );

  readonly valueGroupsFromSourcesState$: Observable<LoadingStateWithDefinedValue<SourceSelectValueGroup<T, M>[]>> = combineLatest([this.fromOpenSource$, this.loadSources$]).pipe(
    map(([fromOpenSourceGroup, loadSources]) => {
      const loadSourcesValue = loadSources.value ?? [];
      const value: SourceSelectValueGroup<T, M>[] = [fromOpenSourceGroup, ...loadSourcesValue];

      const result: LoadingStateWithDefinedValue<SourceSelectValueGroup<T, M>[]> = {
        loading: loadSources.loading,
        value
      };

      return result;
    }),
    shareReplay(1)
  );

  readonly allValueGroupsState$: Observable<LoadingState<SourceSelectValueGroup<T, M>[]>> = this.sourceSelectValuesFromValuesState$.pipe(
    switchMap((sourceSelectValuesFromValues: LoadingState<SourceSelectValue<T, M>[]>) => {
      if (isLoadingStateWithDefinedValue(sourceSelectValuesFromValues)) {
        const valuesFromValuesGroup: SourceSelectValueGroup<T, M> = {
          label: '',
          values: sourceSelectValuesFromValues.value
        };

        return this.valueGroupsFromSourcesState$.pipe(
          map((sourcesState) => {
            const allGroups: SourceSelectValueGroup<T, M>[] = [valuesFromValuesGroup, ...sourcesState.value];

            const result: LoadingState<SourceSelectValueGroup<T, M>[]> = {
              loading: sourceSelectValuesFromValues.loading || sourcesState.loading,
              value: allGroups
            };

            return result;
          })
        );
      } else {
        return of(beginLoading<SourceSelectValueGroup<T, M>[]>({}));
      }
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

        // sort to put the blank label first
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
              simplifiedValuesGroups.push({
                label,
                values
              });
            }
          });

        return this.getDisplayValuesForSelectValues(allUniqueValues).pipe(
          map((displayValues) => {
            const displayValuesMap = new Map(displayValues.map((x) => [x.value, x]));

            const displayGroups: SourceSelectDisplayValueGroup<T, M>[] = simplifiedValuesGroups.map((valueGroup) => {
              const values = filterMaybeArrayValues(valueGroup.values.map((x) => displayValuesMap.get(x.value)));

              return {
                label: valueGroup.label,
                values
              };
            });

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

      const result: SourceSelectOptions<T, M> = {
        nonGroupedValues: nonGroupedGroup[0]?.values ?? [],
        groupedValues
      };

      return result;
    }),
    shareReplay(1)
  );

  readonly nonGroupedValues$ = this.options$.pipe(map((x) => x.nonGroupedValues));
  readonly groupedOptions$ = this.options$.pipe(map((x) => x.groupedValues));

  readonly nonGroupedValuesSignal = toSignal(this.nonGroupedValues$);
  readonly groupedOptionsSignal = toSignal(this.groupedOptions$);

  // MARK: Filterable
  private readonly _filterText$ = new BehaviorSubject<string>('');

  readonly filterInputElement = viewChild<string, ElementRef<HTMLInputElement>>('filterInput', { read: ElementRef<HTMLInputElement> });

  readonly filteredOptions$: Observable<SourceSelectOptions<T, M>> = combineLatest([this.options$, this._filterText$, this.values$]).pipe(
    map(([options, filterText, currentValues]) => {
      let result: SourceSelectOptions<T, M>;

      if (!filterText) {
        result = options;
      } else {
        const lowerFilter = filterText.toLowerCase();
        const selectedSet = new Set(currentValues);
        const matches = (dv: SourceSelectDisplayValue<T, M>) => selectedSet.has(dv.value) || dv.label.toLowerCase().includes(lowerFilter);

        const filterGroups = this.filterableGroups;

        result = {
          nonGroupedValues: options.nonGroupedValues.filter(matches),
          groupedValues: options.groupedValues
            .map((g) => {
              const groupLabelMatches = filterGroups && g.label.toLowerCase().includes(lowerFilter);
              const filteredValues = groupLabelMatches ? g.values : g.values.filter(matches);
              return { label: g.label, values: filteredValues };
            })
            .filter((g: SourceSelectDisplayValueGroup<T, M>) => g.values.length > 0)
        };
      }

      return result;
    }),
    shareReplay(1)
  );

  readonly filteredNonGroupedValuesSignal = toSignal(this.filteredOptions$.pipe(map((x) => x.nonGroupedValues)));
  readonly filteredGroupedOptionsSignal = toSignal(this.filteredOptions$.pipe(map((x) => x.groupedValues)));

  get sourceSelectField(): SourceSelectFieldProps<T, M> {
    return this.props;
  }

  get openSource() {
    return this.props.openSource;
  }

  get showOpenSourceButton() {
    return Boolean(this.openSource);
  }

  get loadSources() {
    return this.props.loadSources;
  }

  get valueReader() {
    return this.props.valueReader;
  }

  get metaLoader() {
    return this.props.metaLoader;
  }

  get displayForValue(): SourceSelectDisplayFunction<T, M> {
    return this.props.displayForValue;
  }

  get selectButtonIcon() {
    return this.props.selectButtonIcon ?? 'add';
  }

  get multiple() {
    return this.props.multiple || false;
  }

  get filterable() {
    return this.props.filterable !== false;
  }

  get filterableGroups() {
    return this.props.filterableGroups !== false;
  }

  get selectPanelClass(): string | string[] {
    return this.filterable ? 'dbx-source-select-filterable-panel' : '';
  }

  get refreshDisplayValues$() {
    return this.props.refreshDisplayValues$;
  }

  loadSourceSelectValueForValues(values: T[]): Observable<LoadingState<SourceSelectValue<T, M>[]>> {
    return this.getSourceSelectValueForValues(values).pipe(
      map((sourceSelectValues: SourceSelectValue<T, M>[]) => successResult(sourceSelectValues)),
      startWithBeginLoading(),
      shareReplay(1)
    );
  }

  getSourceSelectValueForValues(values: T[]): Observable<SourceSelectValue<T, M>[]> {
    const { valueReader } = this;

    return this._valueMetaHashMap.pipe(
      mergeMap((metaMap) => {
        const mappingResult = values.map((hash, i) => [i, hash, metaMap.get(hash)] as [number, T, SourceSelectValue<T, M>]);

        const {
          //
          included: hasMeta,
          excluded: needsMeta
        } = separateValues(mappingResult, (x) => Boolean(x[2]));

        let obs: Observable<SourceSelectValue<T, M>[]>;

        if (needsMeta.length > 0) {
          // Go get the meta value.
          const metaValuesObs = this.metaLoader(needsMeta.map((x) => x[1]));

          obs = metaValuesObs.pipe(
            first(),
            map((metaResults) => {
              const metaResultsMapping: SourceSelectValue<T, M>[] = metaResults.map((meta) => ({ meta, value: valueReader(meta) }));
              const valueIndexHashMap = new Map(metaResultsMapping.map((x) => [x.value, x]));

              // Update metaMap. No need to push an update notification.
              metaResultsMapping.forEach((x) => metaMap.set(x.value, x));

              // Zip values back together.
              // Return display values.
              return mappingResult.map((x) => x[2] ?? valueIndexHashMap.get(x[1]));
            })
          );
        } else {
          // If all display values are hashed return them
          obs = of(hasMeta.map((x) => x[2]));
        }

        return obs;
      })
    );
  }

  loadDisplayValuesForSelectValues(values: SourceSelectValue<T, M>[]): Observable<LoadingState<SourceSelectDisplayValue<T, M>[]>> {
    return this.getDisplayValuesForSelectValues(values).pipe(
      map((displayValues: SourceSelectDisplayValue<T, M>[]) => successResult(displayValues)),
      startWithBeginLoading(),
      shareReplay(1)
    );
  }

  getDisplayValuesForSelectValues(values: SourceSelectValue<T, M>[]): Observable<SourceSelectDisplayValue<T, M>[]> {
    return this._displayHashMap.pipe(
      mergeMap((metaMap) => {
        const mappingResult = values.map((x) => [x, x.value] as [SourceSelectValue<T, M>, T]).map(([x, hash], i) => [i, hash, x, metaMap.get(hash)] as [number, T, SourceSelectValue<T, M>, SourceSelectDisplayValue<T, M>]);

        const hasDisplay = mappingResult.filter((x) => Boolean(x[3]));
        const needsDisplay = mappingResult.filter((x) => !x[3]);
        let obs: Observable<SourceSelectDisplayValue<T, M>[]>;

        if (needsDisplay.length > 0) {
          // Go get the display value.
          const displayValuesObs = this.displayForValue(needsDisplay.map((x) => x[2]));

          obs = displayValuesObs.pipe(
            first(),
            map((displayResults) => {
              const displayResultsMapping: [SourceSelectDisplayValue<T, M>, T][] = (displayResults as SourceSelectDisplayValue<T, M>[]).map((x) => [x, x.value]);
              const valueIndexHashMap = new Map(displayResultsMapping.map(([x, hash]) => [hash, x]));

              // Update metaMap. No need to push an update notification.
              displayResultsMapping.forEach(([x, hash]) => metaMap.set(hash, x));

              // Zip values back together.
              // Return display values.
              return mappingResult.map((x) => x[3] ?? valueIndexHashMap.get(x[1]));
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

  readonly context = loadingStateContext({ obs: this.allOptionGroupsState$ });

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

  ngOnInit(): void {
    const { loadSources } = this;

    this._loadSources.next(loadSources?.() || of([]));

    if (this.refreshDisplayValues$ != null) {
      this._clearDisplayHashMapSub.subscription = this.refreshDisplayValues$.subscribe(() => this._displayHashMap.next(new Map()));
    }

    this._formControlObs.next(this.formControl);

    // copy all values from the sources into the values hash map to prevent reloading
    this._cacheMetaSub.subscription = this.valueGroupsFromSourcesState$.subscribe((x) => {
      const hashMap = this._valueMetaHashMap.value;
      x.value.forEach((x) => x.values.forEach((y) => hashMap.set(y.value, y)));
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._cacheMetaSub.destroy();
    this._clearDisplayHashMapSub.destroy();
    this._valueMetaHashMap.complete();
    this._displayHashMap.complete();
    this._formControlObs.complete();
    this._fromOpenSource.complete();
    this._loadSources.complete();
    this._filterText$.complete();
    this.context.destroy();
  }

  readonly handleSelectOptions: WorkUsingContext<unknown> = (_, context) => {
    const { openSource } = this;
    const origin = this.buttonElement();

    if (openSource && origin) {
      const sourceObs = openSource({ origin });
      context.startWorkingWithObservable(
        sourceObs.pipe(
          first(),
          tap((result: SourceSelectOpenSourceResult<M>) => {
            const valuesToAdd = mergeArrays([result.select, result.options]);

            if (valuesToAdd.length) {
              this.addToOpenSourceMap(valuesToAdd);
            }

            if (result.set) {
              this.setCurrentValue(result.set.map((x) => this.valueReader(x)));
            } else if (result.select) {
              this.addToCurrentValue(result.select.map((x) => this.valueReader(x)));
            }
          })
        )
      );
    } else {
      context.reject();
    }
  };

  private addToOpenSourceMap(input: M[]) {
    const { valueReader } = this;
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
      this._fromOpenSource.next({
        values: [...meta, ...newMetaFromInput],
        valuesSet: valuesSet
      });
    }
  }

  private addToCurrentValue(values: T[]) {
    const currentValue = asArray(this.formControl.value);
    const newValueArray = [...currentValue, ...values];
    this.setCurrentValue(newValueArray);
  }

  private setCurrentValue(newValueArray: T[]) {
    const value = this.multiple ? newValueArray : lastValue(newValueArray); // pick last value, as the last value added is the newest value.
    this.formControl.setValue(value);
    this.formControl.markAsDirty();
    this.formControl.markAsTouched();
  }
}
