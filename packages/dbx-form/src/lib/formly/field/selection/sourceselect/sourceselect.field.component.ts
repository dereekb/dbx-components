import { filterMaybe, LoadingState, isLoadingStateWithDefinedValue, isLoadingStateLoading, LoadingStateWithDefinedValue, startWithBeginLoading, SubscriptionObject, successResult, beginLoading, mapLoadingStateValueWithOperator, loadingStateContext, valueFromLoadingState, WorkUsingContext } from '@dereekb/rxjs';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { distinctUntilChanged, map, switchMap, shareReplay, startWith, mergeMap, scan, BehaviorSubject, tap, first, Observable, combineLatest, of } from 'rxjs';
import { addToSetCopy, asArray, convertMaybeToArray, filterMaybeValues, lastValue, makeValuesGroupMap, Maybe, mergeArrays, PrimativeKey, separateValues, setContainsAllValues, setsAreEquivalent, sortByStringFunction } from '@dereekb/util';
import { FieldType, FormlyFieldProps } from '@ngx-formly/material/form-field';
import { FieldTypeConfig } from '@ngx-formly/core';
import { SourceSelectValueMetaLoader, SourceSelectMetaValueReader, SourceSelectOpenFunction, SourceSelectLoadSourcesFunction, SourceSelectLoadSource, SourceSelectLoadSourceLoadingState, SourceSelectDisplayValue, SourceSelectValue, SourceSelectDisplayFunction, SourceSelectDisplayValueGroup, SourceSelectValueGroup, SourceSelectOptions, SourceSelectOpenSourceResult } from './sourceselect';
import { AbstractControl } from '@angular/forms';

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
}

interface SelectFieldOpenSourceMap<T extends PrimativeKey = PrimativeKey, M = unknown> {
  readonly values: SourceSelectValue<T, M>[];
  readonly valuesSet: Set<T>;
}

/**
 * Component that displays a select view (multi or not)
 */
@Component({
  templateUrl: 'sourceselect.field.component.html'
})
export class DbxFormSourceSelectFieldComponent<T extends PrimativeKey = PrimativeKey, M = unknown> extends FieldType<FieldTypeConfig<SourceSelectFieldProps<T, M>>> implements OnInit, OnDestroy {
  private _cacheMetaSub = new SubscriptionObject();
  private _clearDisplayHashMapSub = new SubscriptionObject();
  private _valueMetaHashMap = new BehaviorSubject<Map<T, SourceSelectValue<T, M>>>(new Map());
  private _displayHashMap = new BehaviorSubject<Map<T, SourceSelectDisplayValue<T, M>>>(new Map());

  private _formControlObs = new BehaviorSubject<Maybe<AbstractControl<T[]>>>(undefined);
  private _fromOpenSource = new BehaviorSubject<SelectFieldOpenSourceMap<T, M>>({ values: [], valuesSet: new Set() });
  private _loadSources = new BehaviorSubject<Maybe<Observable<SourceSelectLoadSource<M>[]>>>(undefined);

  @ViewChild('button', { read: ElementRef, static: false })
  buttonElement!: ElementRef;

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
    map((x) => Array.from(x)),
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
                const loading = x.findIndex(isLoadingStateLoading) !== -1;
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

        const obs = this.getDisplayValuesForSelectValues(allUniqueValues).pipe(
          map((displayValues) => {
            const displayValuesMap = new Map(displayValues.map((x) => [x.value, x]));

            const displayGroups: SourceSelectDisplayValueGroup<T, M>[] = simplifiedValuesGroups.map((valueGroup) => {
              const values = filterMaybeValues(valueGroup.values.map((x) => displayValuesMap.get(x.value)));

              return {
                label: valueGroup.label,
                values
              };
            });

            return displayGroups;
          })
        );

        return obs;
      })
    ),
    shareReplay(1)
  );

  readonly allOptionGroups$: Observable<SourceSelectDisplayValueGroup<T, M>[]> = this.allOptionGroupsState$.pipe(valueFromLoadingState(), shareReplay(1));

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
              const newDisplayValues = mappingResult.map((x) => x[2] ?? valueIndexHashMap.get(x[1]));

              // Return display values.
              return newDisplayValues;
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

  readonly context = loadingStateContext({ obs: this.allOptionGroupsState$ });

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
    this._valueMetaHashMap.complete();
    this._displayHashMap.complete();
    this._formControlObs.complete();
    this._fromOpenSource.complete();
    this._loadSources.complete();
    this.context.destroy();
  }

  readonly handleSelectOptions: WorkUsingContext<unknown> = (_, context) => {
    const { openSource } = this;

    if (openSource) {
      const origin = this.buttonElement.nativeElement;
      const sourceObs = openSource({ origin });
      context.startWorkingWithObservable(
        sourceObs.pipe(
          first(),
          tap((result: SourceSelectOpenSourceResult<M>) => {
            const valuesToAdd = mergeArrays([result.select, result.options]);

            if (valuesToAdd.length) {
              this.addToOpenSourceMap(valuesToAdd);
            }

            if (result.select) {
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

    const value = this.multiple ? values : lastValue(newValueArray); // pick last value, as the last value added is the newest value.
    this.formControl.setValue(value);
    this.formControl.markAsDirty();
    this.formControl.markAsTouched();
  }
}
