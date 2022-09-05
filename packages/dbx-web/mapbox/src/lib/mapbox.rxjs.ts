import { ObservableOrValue, asObservable } from '@dereekb/rxjs';
import { LAT_LONG_10M_PRECISION, LatLngPointInput, LatLngBound, LatLngBoundCheckFunction, latLngPointFunction, roundNumberToStepFunction, RoundNumberToStepFunctionInput, LatLngPrecision, LAT_LONG_1M_PRECISION, Maybe } from '@dereekb/util';
import { combineLatestWith, map, Observable, OperatorFunction, switchMap, shareReplay, distinctUntilChanged } from 'rxjs';
import { MapboxZoomLevel } from './mapbox';
import { MapboxViewportBoundFunction } from './mapbox.util';

export interface FilterMapboxBoundConfig<T> {
  boundFunctionObs: ObservableOrValue<MapboxViewportBoundFunction>;
  boundDecisionObs: ObservableOrValue<LatLngBoundCheckFunction>;
  /**
   * Reads the value from the input item.
   */
  readValue: (value: T) => MapboxViewportBoundFunctionItemValue;
  /**
   * Minimum precision to retain. Defaults to LAT_LONG_10M_PRECISION
   */
  precision?: LatLngPrecision;
  /**
   * Amount of zoom rounding to use. By default rounds to 0.5 steps using "floor" in order to "round up" since zoom values are inversely proportional to bounds area.
   */
  zoomRounding?: RoundNumberToStepFunctionInput;
  /**
   * Default zoom level for item values that do not have an explicit zoom, or a zoom of 0.
   *
   * Defaults to 17, which can produce a viewport/bounds about the size of a park.
   */
  defaultZoom?: MapboxZoomLevel;
}

export interface MapboxViewportBoundFunctionItemValue {
  readonly center: LatLngPointInput;
  readonly zoom?: Maybe<MapboxZoomLevel>;
}

export interface MapboxViewportBoundFunctionItem<T> {
  readonly value: T;
  readonly bound: LatLngBound;
}

/**
 * Filters the input objects based on their center and zoom values.
 *
 * This function caches the bounds computations for each of the input values.
 *
 * @param config
 * @returns
 */
export function filterByMapboxViewportBound<T>(config: FilterMapboxBoundConfig<T>): OperatorFunction<T[], T[]> {
  const { boundDecisionObs: inputBoundDecisionObs, boundFunctionObs: inputBoundFunctionObs, defaultZoom: inputDefaultZoom = 17, readValue, zoomRounding, precision = LAT_LONG_10M_PRECISION } = config;
  const _latLngPoint = latLngPointFunction({ wrap: false, validate: false, precision });
  const _roundZoom = roundNumberToStepFunction(zoomRounding || { step: 0.5, round: 'floor' });

  const boundDecisionObs = asObservable(inputBoundDecisionObs);
  const boundFunctionObs = asObservable(inputBoundFunctionObs);

  return (input: Observable<T[]>) => {
    return boundFunctionObs.pipe(
      distinctUntilChanged(),
      switchMap((viewportBoundFunction) => {
        const cache = new Map<string, LatLngBound>();

        return input.pipe(
          map((values: T[]) => {
            return values.map((value: T) => {
              const item: MapboxViewportBoundFunctionItemValue = readValue(value);
              const centerLatLng = _latLngPoint(item.center);
              const zoomStep = _roundZoom(item.zoom || inputDefaultZoom);
              const cacheKey = `${zoomStep}_${centerLatLng.lat}_${centerLatLng.lng}`;

              const cachedValue = cache.get(cacheKey);
              let bound: LatLngBound;

              if (!cachedValue) {
                bound = viewportBoundFunction({ center: centerLatLng, zoom: zoomStep });
                cache.set(cacheKey, bound);
              } else {
                bound = cachedValue;
              }

              return {
                value,
                bound
              } as MapboxViewportBoundFunctionItem<T>;
            });
          }),
          combineLatestWith(boundDecisionObs),
          map(([items, boundFunction]) => {
            let valuesInBounds: T[] = [];

            items.forEach((item) => {
              if (boundFunction(item.bound)) {
                valuesInBounds.push(item.value);
              }
            });

            return valuesInBounds;
          })
        );
      }),
      shareReplay(1)
    );
  };
}
