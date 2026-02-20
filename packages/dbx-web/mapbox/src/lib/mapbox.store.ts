import { cleanup, filterMaybe, onTrueToFalse } from '@dereekb/rxjs';
import { Injectable, OnDestroy, inject } from '@angular/core';
import {
  isSameLatLngBound,
  isSameLatLngPoint,
  IsWithinLatLngBoundFunction,
  isWithinLatLngBoundFunction,
  LatLngBound,
  latLngBoundFunction,
  LatLngPointInput,
  LatLngPoint,
  latLngPointFunction,
  Maybe,
  OverlapsLatLngBoundFunction,
  overlapsLatLngBoundFunction,
  diffLatLngBoundPoints,
  latLngBoundCenterPoint,
  addLatLngPoints,
  isDefaultLatLngPoint,
  swMostLatLngPoint,
  neMostLatLngPoint,
  latLngBoundWrapsMap,
  Vector,
  filterUndefinedValues,
  latLngBoundFromInput,
  vectorMinimumSizeResizeFunction,
  isSameVector,
  ZoomLevel
} from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { MapService } from 'ngx-mapbox-gl';
import { defaultIfEmpty, distinctUntilChanged, filter, map, shareReplay, switchMap, tap, NEVER, Observable, of, Subscription, startWith, interval, first, combineLatest, EMPTY, OperatorFunction, throttleTime } from 'rxjs';
import * as MapboxGl from 'mapbox-gl';
import { DbxMapboxClickEvent, KnownMapboxStyle, MapboxBearing, MapboxEaseTo, MapboxEventData, MapboxFitBounds, MapboxFitPositions, MapboxFlyTo, MapboxJumpTo, MapboxResetNorth, MapboxResetNorthPitch, MapboxRotateTo, MapboxSnapToNorth, MapboxStyleConfig, MapboxZoomLevel, MapboxZoomLevelRange } from './mapbox';
import { DbxMapboxService } from './mapbox.service';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { mapboxViewportBoundFunction, MapboxViewportBoundFunction } from './mapbox.util';
import { FilterMapboxBoundConfig, FilterMapboxBoundReadItemValueFunction, filterByMapboxViewportBound } from './mapbox.rxjs';

export type MapboxMapLifecycleState = 'init' | 'load' | 'render' | 'idle';
export type MapboxMapMoveState = 'init' | 'idle' | 'moving';
export type MapboxMapZoomState = 'init' | 'idle' | 'zooming';
export type MapboxMapRotateState = 'init' | 'idle' | 'rotating';

export interface StringMapboxListenerPair {
  type: string;
  listener: (ev: MapboxEventData) => void;
}

export interface TypedMapboxListenerPair<T extends keyof MapboxGl.MapEventType> {
  type: T;
  listener: (ev: MapboxGl.MapEventType[T] & MapboxEventData) => void;
}

export interface DbxMapboxMarginCalculationSizing {
  leftMargin: number;
  rightMargin: number;
  fullWidth: number;
}

export type DbxMapboxStoreBoundRefreshType = 'always' | 'when_not_rendering' | 'only_after_render_finishes';

export interface DbxMapboxStoreBoundRefreshSettings {
  /**
   * Max bound refresh interval.
   */
  throttle: number;
  /**
   * Whether or not to wait to update the bound until after it has finished rendering.
   */
  refreshType: DbxMapboxStoreBoundRefreshType;
}

export interface DbxMapboxStoreState {
  /**
   * Current MapService being utilized.
   */
  readonly mapService?: Maybe<MapService>;
  readonly lifecycleState: MapboxMapLifecycleState;
  readonly moveState: MapboxMapMoveState;
  readonly zoomState: MapboxMapZoomState;
  readonly rotateState: MapboxMapRotateState;
  /**
   * Visual container size of the map.
   */
  readonly mapCanvasSize?: Maybe<Vector>;
  /**
   * Latest click event
   */
  readonly clickEvent?: Maybe<DbxMapboxClickEvent>;
  /**
   * Latest double-click event
   */
  readonly doubleClickEvent?: Maybe<DbxMapboxClickEvent>;
  /**
   * Latest contextmenu event.
   */
  readonly rightClickEvent?: Maybe<DbxMapboxClickEvent>;
  /**
   * Whether or not to retain content between resets.
   *
   * True by default.
   */
  readonly retainContent: boolean;
  /**
   * Custom drawer content configuration.
   */
  readonly drawerContent?: Maybe<DbxInjectionComponentConfig<unknown>>;
  /**
   * Latest error
   */
  readonly error?: Maybe<Error>;
  /**
   * Map margin/offset
   */
  readonly margin?: Maybe<DbxMapboxMarginCalculationSizing>;
  /**
   * Minimum vector size to use for the viewportBoundFunction$. If not defined there is no minimum.
   */
  readonly minimumVirtualViewportSize?: Maybe<Partial<Vector>>;
  /**
   * Bound refresh settings
   */
  readonly boundRefreshSettings: DbxMapboxStoreBoundRefreshSettings;
  /**
   * Whether or not to use the virtual bound (vs raw bound) for all bound-related observables.
   *
   * Defaults to true.
   */
  readonly useVirtualBound: boolean;
}

/**
 * Store used for retrieving information.
 */
@Injectable()
export class DbxMapboxMapStore extends ComponentStore<DbxMapboxStoreState> {
  private readonly dbxMapboxService = inject(DbxMapboxService);

  private safeLatLngPoint = latLngPointFunction({ wrap: true });
  private latLngPoint = latLngPointFunction({ wrap: false, validate: false });
  private latLngBound = latLngBoundFunction({ pointFunction: this.latLngPoint });

  constructor() {
    super({
      lifecycleState: 'init',
      moveState: 'init',
      zoomState: 'init',
      rotateState: 'init',
      retainContent: true,
      useVirtualBound: true,
      boundRefreshSettings: {
        throttle: 300,
        refreshType: 'always'
      }
    });
  }

  // MARK: Effects
  readonly setMapService = this.effect((input: Observable<Maybe<MapService>>) => {
    return input.pipe(
      switchMap((service: Maybe<MapService>) => {
        this._setMapService(service);

        if (!service) {
          return NEVER;
        } else {
          return service.mapLoaded$.pipe(
            defaultIfEmpty(undefined),
            map(() => {
              this._setLifecycleState('idle');
              this._setMoveState('idle');
              this._setZoomState('idle');
              this._setRotateState('idle');

              const map = service.mapInstance;

              const listenerPairs: StringMapboxListenerPair[] = [];

              function addListener<T extends keyof MapboxGl.MapEvents>(type: T, listener: Parameters<typeof map.on<T>>[2]) {
                map.on<T>(type, listener);
                listenerPairs.push({ type, listener } as StringMapboxListenerPair);
              }

              addListener('idle', () => this._setLifecycleState('idle'));
              addListener('render', () => this._setLifecycleState('render'));
              addListener('error', (x) => {
                this._setError(x.error);
              });

              addListener('movestart', () => this._setMoveState('moving'));
              addListener('moveend', () => this._setMoveState('idle'));

              addListener('zoomstart', () => this._setZoomState('zooming'));
              addListener('zoomend', () => this._setZoomState('idle'));

              addListener('rotatestart', () => this._setRotateState('rotating'));
              addListener('rotateend', () => this._setRotateState('idle'));

              addListener('click', (x) => this._setClickEvent(x));
              addListener('dblclick', (x) => this._setDoubleClickEvent(x));
              addListener('contextmenu', (x) => this._setRightClickEvent(x));

              const refreshForResize = () => {
                const { clientWidth: x, clientHeight: y } = map.getCanvas();
                this._setMapCanvasSize({ x, y });
              };

              addListener('resize', refreshForResize);
              refreshForResize();

              const subs: Subscription[] = [];

              return {
                service,
                listenerPairs,
                subs
              };
            })
          );
        }
      }),
      cleanup(({ service, listenerPairs, subs }) => {
        const map = service.mapInstance;

        if (map) {
          listenerPairs.forEach((x) => {
            map.off(x.type, x.listener);
          });
        }

        subs.forEach((sub) => sub.unsubscribe());
      })
    );
  });

  readonly setStyle = this.effect((input: Observable<MapboxStyleConfig | KnownMapboxStyle | string>) => {
    return input.pipe(
      switchMap((style) => {
        return this.mapInstance$.pipe(
          tap((map) => {
            if (typeof style === 'string') {
              map.setStyle(style);
            } else {
              map.setStyle(style.style, style.options);
            }
          })
        );
      })
    );
  });

  readonly setCenter = this.effect((input: Observable<LatLngPointInput>) => {
    return input.pipe(
      switchMap((center: LatLngPointInput) => {
        const centerPoint = this.safeLatLngPoint(center);
        return this.mapInstance$.pipe(tap((map) => map.setCenter(centerPoint)));
      })
    );
  });

  readonly setZoom = this.effect((input: Observable<MapboxZoomLevel>) => {
    return input.pipe(
      switchMap((zoom: MapboxZoomLevel) => {
        return this.mapInstance$.pipe(tap((map) => map.setZoom(zoom)));
      })
    );
  });

  readonly setZoomRange = this.effect((input: Observable<Partial<MapboxZoomLevelRange>>) => {
    return input.pipe(
      switchMap((zoomRange: Partial<MapboxZoomLevelRange>) => {
        return this.mapInstance$.pipe(
          tap((map) => {
            map.setMinZoom(zoomRange.min || null);
            map.setMaxZoom(zoomRange.max || null);
          })
        );
      })
    );
  });

  readonly setMinZoom = this.effect((input: Observable<MapboxZoomLevel>) => {
    return input.pipe(
      switchMap((zoom: MapboxZoomLevel) => {
        return this.mapInstance$.pipe(tap((map) => map.setMinZoom(zoom)));
      })
    );
  });

  readonly setMaxZoom = this.effect((input: Observable<MapboxZoomLevel>) => {
    return input.pipe(
      switchMap((zoom: MapboxZoomLevel) => {
        return this.mapInstance$.pipe(tap((map) => map.setMaxZoom(zoom)));
      })
    );
  });

  readonly setKeyboardDisabled = this.effect((input: Observable<Maybe<boolean> | void>) => {
    return input.pipe(
      switchMap((disabled: Maybe<boolean> | void) => {
        return this.mapInstance$.pipe(
          tap((map) => {
            if (disabled === false) {
              map.keyboard.enable();
            } else {
              map.keyboard.disable();
            }
          })
        );
      })
    );
  });

  readonly setDragRotateDisabled = this.effect((input: Observable<Maybe<boolean> | void>) => {
    return input.pipe(
      switchMap((disabled: Maybe<boolean> | void) => {
        return this.mapInstance$.pipe(
          tap((map) => {
            if (disabled === false) {
              map.dragRotate.enable();
            } else {
              map.dragRotate.disable();
            }
          })
        );
      })
    );
  });

  readonly setDragPanDisabled = this.effect((input: Observable<Maybe<boolean> | void>) => {
    return input.pipe(
      switchMap((disabled: Maybe<boolean> | void) => {
        return this.mapInstance$.pipe(
          tap((map) => {
            if (disabled === false) {
              map.dragPan.enable();
            } else {
              map.dragPan.disable();
            }
          })
        );
      })
    );
  });

  readonly setZoomDisabled = this.effect((input: Observable<Maybe<boolean> | void>) => {
    return input.pipe(
      switchMap((disabled: Maybe<boolean> | void) => {
        return this.mapInstance$.pipe(
          tap((map) => {
            if (disabled === false) {
              map.scrollZoom.enable();
              map.doubleClickZoom.enable();
            } else {
              map.scrollZoom.disable();
              map.doubleClickZoom.disable();
            }
          })
        );
      })
    );
  });

  readonly setPitch = this.effect((input: Observable<number>) => {
    return input.pipe(
      switchMap((pitch) => {
        return this.mapInstance$.pipe(tap((map) => map.setPitch(pitch)));
      })
    );
  });

  readonly setMinPitch = this.effect((input: Observable<number>) => {
    return input.pipe(
      switchMap((pitch: number) => {
        return this.mapInstance$.pipe(tap((map) => map.setMinPitch(pitch)));
      })
    );
  });

  readonly setMaxPitch = this.effect((input: Observable<number>) => {
    return input.pipe(
      switchMap((pitch: number) => {
        return this.mapInstance$.pipe(tap((map) => map.setMaxPitch(pitch)));
      })
    );
  });

  readonly setBearing = this.effect((input: Observable<number>) => {
    return input.pipe(
      switchMap((bearing) => {
        return this.mapInstance$.pipe(tap((map) => map.setBearing(bearing)));
      })
    );
  });

  readonly rotateTo = this.effect((input: Observable<MapboxBearing | MapboxRotateTo>) => {
    return input.pipe(
      switchMap((rotateInput: MapboxBearing | MapboxRotateTo) => {
        const rotate: MapboxRotateTo = typeof rotateInput === 'number' ? { bearing: rotateInput } : rotateInput;
        return this.mapInstance$.pipe(tap((map) => map.rotateTo(rotate.bearing, rotate.options, rotate?.eventData)));
      })
    );
  });

  readonly resetNorth = this.effect((input: Observable<Maybe<MapboxResetNorth> | void>) => {
    return input.pipe(
      switchMap((reset: Maybe<MapboxResetNorth> | void) => {
        return this.mapInstance$.pipe(tap((map) => map.resetNorth(reset?.options, reset?.eventData)));
      })
    );
  });

  readonly resetNorthPitch = this.effect((input: Observable<Maybe<MapboxResetNorthPitch> | void>) => {
    return input.pipe(
      switchMap((reset: Maybe<MapboxResetNorthPitch> | void) => {
        return this.mapInstance$.pipe(tap((map) => map.resetNorthPitch(reset?.options, reset?.eventData)));
      })
    );
  });

  readonly snapToNorth = this.effect((input: Observable<Maybe<MapboxSnapToNorth> | void>) => {
    return input.pipe(
      switchMap((snap: Maybe<MapboxSnapToNorth> | void) => {
        return this.mapInstance$.pipe(tap((map) => map.snapToNorth(snap?.options, snap?.eventData)));
      })
    );
  });

  readonly fitPositions = this.effect((input: Observable<MapboxFitPositions>) => {
    return input.pipe(
      switchMap((x) => {
        const boundFromInput = latLngBoundFromInput(x.positions);

        if (boundFromInput) {
          const bound = this.latLngBound(boundFromInput);
          return this.mapInstance$.pipe(tap((map) => map.fitBounds(new MapboxGl.LngLatBounds(bound.sw, bound.ne), x.options, x.eventData)));
        } else {
          return EMPTY;
        }
      })
    );
  });

  readonly fitBounds = this.effect((input: Observable<MapboxFitBounds>) => {
    return input.pipe(
      switchMap((x) => {
        const bound = this.latLngBound(x.bounds);
        return this.mapInstance$.pipe(tap((map) => map.fitBounds(new MapboxGl.LngLatBounds(bound.sw, bound.ne), x.options, x.eventData)));
      })
    );
  });

  readonly jumpTo = this.effect((input: Observable<MapboxJumpTo>) => {
    return input.pipe(
      switchMap((x) => {
        const inputCenter = x.center ?? x.to?.center;
        const center = inputCenter ? this.safeLatLngPoint(inputCenter) : undefined;
        return this.mapInstance$.pipe(tap((map) => map.jumpTo(filterUndefinedValues({ ...x.to, center }), x.eventData)));
      })
    );
  });

  readonly easeTo = this.effect((input: Observable<MapboxEaseTo>) => {
    return input.pipe(
      switchMap((x) => {
        const inputCenter = x.center ?? x.to?.center;
        const center = inputCenter ? this.safeLatLngPoint(inputCenter) : undefined;
        return this.mapInstance$.pipe(tap((map) => map.easeTo(filterUndefinedValues({ ...x.to, center }), x.eventData)));
      })
    );
  });

  readonly flyTo = this.effect((input: Observable<MapboxFlyTo>) => {
    return input.pipe(
      switchMap((x) => {
        const inputCenter = x.center ?? x.to?.center;
        const center = inputCenter ? this.safeLatLngPoint(inputCenter) : undefined;
        return this.mapInstance$.pipe(tap((map) => map.flyTo(filterUndefinedValues({ ...x.to, center }), x.eventData)));
      })
    );
  });

  readonly resetPitchAndBearing = this.effect((input: Observable<void>) => {
    return input.pipe(
      switchMap(() => {
        return this.mapInstance$.pipe(
          tap((map) => {
            map.setPitch(0);
            map.setBearing(0);
          })
        );
      })
    );
  });

  // MARK: Accessors
  get timerRefreshPeriod() {
    return this.dbxMapboxService.mapboxMapStoreTimerRefreshPeriod;
  }

  movingTimer(period = this.timerRefreshPeriod) {
    return this.moveState$.pipe(
      switchMap((x) => {
        if (x === 'moving') {
          return interval(period);
        } else {
          return of(0);
        }
      }),
      shareReplay(1)
    );
  }

  lifecycleRenderTimer(period = this.timerRefreshPeriod) {
    return this.lifecycleState$.pipe(
      switchMap((x) => {
        if (x === 'render') {
          return interval(period);
        } else {
          return of(0);
        }
      }),
      shareReplay(1)
    );
  }

  atNextIdle(): Observable<boolean> {
    return this.moveState$.pipe(
      map((x) => x === 'idle'),
      first()
    );
  }

  calculateNextCenterWithOffset(inputOffset: LatLngPointInput): Observable<LatLngPoint> {
    const offset = this.latLngPoint(inputOffset);

    return this.atNextIdle().pipe(
      switchMap(() =>
        this.center$.pipe(
          first(),
          map((center) => {
            const newCenter = {
              lat: offset.lat + center.lat,
              lng: offset.lng + center.lng
            };
            return newCenter;
          })
        )
      )
    );
  }

  calculateNextCenterOffsetWithScreenMarginChange(sizing: DbxMapboxMarginCalculationSizing): Observable<LatLngPoint> {
    // TODO: Consider calculating this using the viewport() function from @placemarkio/geo-viewport
    return this.atNextIdle().pipe(
      switchMap(() =>
        this.bound$.pipe(
          first(),
          map((bounds) => {
            const diff = diffLatLngBoundPoints(bounds, true);
            const center = latLngBoundCenterPoint(bounds);

            const offsetWidth = sizing.leftMargin + sizing.rightMargin; // 300 + 0
            const newWidth = sizing.fullWidth - offsetWidth; // 1000 - 300 - 0
            const newWidthRatio = newWidth / sizing.fullWidth; // 700 / 1000
            const newCenterLongitudeWidth = diff.lng * newWidthRatio; // 70% offset

            const effectiveOffset: LatLngPoint = {
              lat: 0,
              lng: newCenterLongitudeWidth / 2
            };

            const newCenter = addLatLngPoints(bounds.sw, effectiveOffset);
            newCenter.lat = center.lat; // retain center position

            // console.log({ sizing, bounds, effectiveOffset, newWidth, offsetWidth, diff, center, newCenter });

            return newCenter;
          })
        )
      )
    );
  }

  filterByViewportBound<T>(input: FilterMapboxBoundReadItemValueFunction<T> | Omit<FilterMapboxBoundConfig<T>, 'boundFunctionObs' | 'boundDecisionObs'>): OperatorFunction<T[], T[]> {
    const config = typeof input === 'function' ? { readValue: input } : input;

    return filterByMapboxViewportBound({
      ...config,
      boundFunctionObs: this.viewportBoundFunction$,
      boundDecisionObs: this.overlapsBoundFunction$
    });
  }

  readonly currentMapService$ = this.state$.pipe(
    map((x) => x.mapService),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly mapService$ = this.currentMapService$.pipe(filterMaybe());

  readonly currentMapInstance$: Observable<Maybe<MapboxGl.Map>> = this.currentMapService$.pipe(
    switchMap((currentMapService: Maybe<MapService>) => {
      if (currentMapService) {
        return currentMapService.mapLoaded$.pipe(
          defaultIfEmpty(undefined),
          map(() => currentMapService.mapInstance)
        );
      } else {
        return of(undefined);
      }
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly mapInstance$ = this.currentMapInstance$.pipe(filterMaybe());

  readonly boundRefreshSettings$ = this.state$.pipe(
    map((x) => x.boundRefreshSettings),
    shareReplay(1)
  );

  readonly moveState$ = this.state$.pipe(
    map((x) => x.moveState),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly lifecycleState$ = this.state$.pipe(
    map((x) => x.lifecycleState),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly zoomState$ = this.state$.pipe(
    map((x) => x.zoomState),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly rotateState$ = this.state$.pipe(
    map((x) => x.rotateState),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isInitialized$ = this.currentMapInstance$.pipe(
    switchMap((x) => {
      if (!x) {
        return of(false);
      } else {
        return combineLatest([this.moveState$.pipe(map((x) => x === 'idle')), this.lifecycleState$.pipe(map((x) => x === 'idle'))]).pipe(
          filter(([m, l]) => m && l),
          first(),
          map(() => true)
        );
      }
    }),
    shareReplay(1)
  );

  readonly whenInitialized$ = this.isInitialized$.pipe(
    filter((x) => true),
    shareReplay(1)
  );

  readonly isRendering$ = this.whenInitialized$.pipe(
    switchMap(() =>
      this.lifecycleState$.pipe(
        map((x) => x === 'render'),
        distinctUntilChanged(),
        shareReplay(1)
      )
    )
  );

  readonly isMoving$ = this.whenInitialized$.pipe(
    switchMap(() =>
      this.moveState$.pipe(
        map((x) => x === 'moving'),
        distinctUntilChanged(),
        shareReplay(1)
      )
    )
  );

  readonly isZooming$ = this.whenInitialized$.pipe(
    switchMap(() =>
      this.zoomState$.pipe(
        map((x) => x === 'zooming'),
        distinctUntilChanged(),
        shareReplay(1)
      )
    )
  );

  readonly isRotating$ = this.whenInitialized$.pipe(
    switchMap(() =>
      this.rotateState$.pipe(
        map((x) => x === 'rotating'),
        distinctUntilChanged(),
        shareReplay(1)
      )
    )
  );

  private readonly _movingTimer = this.movingTimer();
  private readonly _renderingTimer = this.lifecycleRenderTimer();

  readonly centerNow$: Observable<LatLngPoint> = this.whenInitialized$.pipe(
    switchMap(() =>
      this.mapInstance$.pipe(
        switchMap((x) => this._movingTimer.pipe(map(() => this.latLngPoint(x.getCenter())))),
        shareReplay(1)
      )
    ),
    shareReplay(1)
  );

  readonly center$: Observable<LatLngPoint> = this.whenInitialized$.pipe(
    switchMap(() => {
      return this.isMoving$.pipe(
        onTrueToFalse(),
        startWith(undefined),
        switchMap(() => this.centerNow$.pipe(first())),
        distinctUntilChanged<LatLngPoint>(isSameLatLngPoint),
        shareReplay(1)
      );
    }),
    shareReplay(1)
  );

  readonly minimumVirtualViewportSize$ = this.state$.pipe(
    map((x) => x.minimumVirtualViewportSize),
    distinctUntilChanged(isSameVector),
    shareReplay(1)
  );

  readonly currentMapCanvasSize$ = this.state$.pipe(
    map((x) => x.mapCanvasSize),
    distinctUntilChanged<Maybe<Vector>>(isSameVector),
    shareReplay(1)
  );

  /**
   * The map canvas size with consideration to the virtual viewport size.
   */
  readonly mapCanvasSize$ = this.currentMapCanvasSize$.pipe(filterMaybe());

  minimumMapCanvasSize(minVector: Partial<Vector>): Observable<Vector> {
    const resizeFn = vectorMinimumSizeResizeFunction(minVector);
    return this.mapCanvasSize$.pipe(
      map((x) => resizeFn(x)),
      distinctUntilChanged<Vector>(isSameVector),
      shareReplay(1)
    );
  }

  /**
   * The map canvas size with consideration to the virtual viewport size.
   */
  readonly virtualMapCanvasSize$ = this.minimumVirtualViewportSize$.pipe(
    switchMap((minimumVirtualViewportSize) => {
      if (minimumVirtualViewportSize) {
        return this.minimumMapCanvasSize(minimumVirtualViewportSize);
      } else {
        return this.mapCanvasSize$;
      }
    }),
    distinctUntilChanged<Vector>(isSameVector),
    shareReplay(1)
  );

  readonly rawViewportBoundFunction$: Observable<MapboxViewportBoundFunction> = this.mapCanvasSize$.pipe(
    map((mapCanvasSize) => mapboxViewportBoundFunction({ mapCanvasSize })),
    shareReplay(1)
  );

  /**
   * Creates a MapboxViewportBoundFunction observable that returns the minimum viewport size.
   *
   * @param minVector
   * @returns
   */
  viewportBoundFunctionWithMinimumSize(minVector: Partial<Vector>): Observable<MapboxViewportBoundFunction> {
    const resizeFn = vectorMinimumSizeResizeFunction(minVector);
    return this.mapCanvasSize$.pipe(
      map((x) => resizeFn(x)),
      distinctUntilChanged<Vector>(isSameVector),
      map((mapCanvasSize) => mapboxViewportBoundFunction({ mapCanvasSize })),
      shareReplay(1)
    );
  }

  readonly viewportBoundFunction$: Observable<MapboxViewportBoundFunction> = this.minimumVirtualViewportSize$.pipe(
    switchMap((minimumVirtualViewportSize) => {
      if (minimumVirtualViewportSize) {
        return this.viewportBoundFunctionWithMinimumSize(minimumVirtualViewportSize);
      } else {
        return this.rawViewportBoundFunction$;
      }
    }),
    shareReplay(1)
  );

  readonly virtualBound$: Observable<LatLngBound> = this.viewportBoundFunction$.pipe(
    switchMap((fn) => {
      return this.boundRefreshSettings$.pipe(
        switchMap((settings) => {
          const { throttle: throttleMs, refreshType } = settings;

          let obs: Observable<[LatLngPoint, ZoomLevel]>;

          switch (refreshType) {
            case 'always':
              obs = combineLatest([this.centerNow$, this.zoomNow$]);
              break;
            case 'when_not_rendering':
            case 'only_after_render_finishes':
              obs = this.bound$.pipe(switchMap(() => combineLatest([this.centerNow$, this.zoomNow$]))); // refresh whenever the bound refreshes
              break;
          }

          return obs.pipe(
            throttleTime(throttleMs, undefined, { leading: true, trailing: true }),
            map(([center, zoom]) =>
              fn({
                center,
                zoom
              })
            )
          );
        })
      );
    }),
    distinctUntilChanged(isSameLatLngBound),
    shareReplay(1)
  );

  readonly margin$ = this.state$.pipe(
    map((x) => x.margin),
    distinctUntilChanged((a, b) => a != null && b != null && a.fullWidth === b.fullWidth && a.leftMargin === b.leftMargin && a.rightMargin === b.rightMargin),
    shareReplay(1)
  );

  readonly reverseMargin$ = this.margin$.pipe(
    map((x) => {
      if (x) {
        return { leftMargin: -x.leftMargin, rightMargin: -x.rightMargin, fullWidth: x.fullWidth };
      } else {
        return x;
      }
    })
  );

  readonly centerGivenMargin$: Observable<LatLngPoint> = this.whenInitialized$.pipe(
    switchMap(() => {
      return this.reverseMargin$.pipe(
        switchMap((x) => {
          if (x) {
            return this.center$.pipe(switchMap((_) => this.calculateNextCenterOffsetWithScreenMarginChange(x)));
          } else {
            return this.isMoving$.pipe(
              filter((x) => !x),
              switchMap(() => this.center$)
            );
          }
        })
      );
    }),
    shareReplay(1)
  );

  readonly rawBoundNow$: Observable<LatLngBound> = this.whenInitialized$.pipe(
    switchMap(() =>
      this.mapInstance$.pipe(
        switchMap((x) =>
          this._renderingTimer.pipe(
            map(() => {
              const bound = x.getBounds();
              let result: LatLngBound | null = null;

              if (bound != null) {
                const boundSw = bound.getSouthWest();
                const boundNe = bound.getNorthEast();

                const sw = isDefaultLatLngPoint(boundSw) ? swMostLatLngPoint() : { lat: boundSw.lat, lng: boundSw.lng };
                const ne = isDefaultLatLngPoint(boundNe) ? neMostLatLngPoint() : { lat: boundNe.lat, lng: boundNe.lng };

                result = this.latLngBound(sw, ne);
              }

              return result;
            }),
            filterMaybe()
          )
        )
      )
    ),
    distinctUntilChanged(isSameLatLngBound),
    shareReplay(1)
  );

  readonly rawBound$: Observable<LatLngBound> = this.whenInitialized$.pipe(
    switchMap(() => {
      return this.boundRefreshSettings$.pipe(
        switchMap((settings) => {
          const { throttle: throttleMs, refreshType } = settings;

          let obs: Observable<LatLngBound>;

          switch (refreshType) {
            case 'always':
              obs = this.rawBoundNow$;
              break;
            case 'when_not_rendering':
              obs = this.isRendering$.pipe(switchMap((x) => (x ? EMPTY : this.rawBoundNow$)));
              break;
            case 'only_after_render_finishes':
              obs = this.isRendering$.pipe(
                onTrueToFalse(),
                switchMap((x) => this.rawBoundNow$.pipe(first()))
              );
              break;
          }

          return obs.pipe(throttleTime(throttleMs, undefined, { leading: true, trailing: true }));
        })
      );
    }),
    distinctUntilChanged(isSameLatLngBound),
    shareReplay(1)
  );

  readonly useVirtualBound$: Observable<boolean> = this.state$.pipe(
    map((x) => x.useVirtualBound),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly bound$: Observable<LatLngBound> = this.useVirtualBound$.pipe(
    switchMap((useVirtualBound) => {
      if (useVirtualBound) {
        return this.virtualBound$;
      } else {
        return this.rawBound$;
      }
    }),
    shareReplay(1)
  );

  readonly boundSizing$: Observable<LatLngPoint> = this.bound$.pipe(
    map((x) => diffLatLngBoundPoints(x)),
    shareReplay(1)
  );

  readonly boundWrapsAroundWorld$: Observable<boolean> = this.bound$.pipe(
    map((x) => latLngBoundWrapsMap(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isWithinBoundFunction$: Observable<IsWithinLatLngBoundFunction> = this.bound$.pipe(
    map((x) => isWithinLatLngBoundFunction(x)),
    shareReplay(1)
  );

  readonly overlapsBoundFunction$: Observable<OverlapsLatLngBoundFunction> = this.virtualBound$.pipe(
    map((x) => overlapsLatLngBoundFunction(x)),
    shareReplay(1)
  );

  readonly zoomNow$: Observable<MapboxZoomLevel> = this.whenInitialized$.pipe(
    switchMap(() =>
      this.mapInstance$.pipe(
        switchMap((x) => this._renderingTimer.pipe(map(() => x.getZoom() as MapboxZoomLevel))),
        shareReplay(1)
      )
    )
  );

  readonly zoom$: Observable<MapboxZoomLevel> = this.whenInitialized$.pipe(
    switchMap(() => {
      return this.isZooming$.pipe(
        onTrueToFalse(),
        startWith(undefined),
        switchMap(() => this.zoomNow$.pipe(first())),
        distinctUntilChanged(),
        shareReplay(1)
      );
    })
  );

  readonly pitchNow$ = this.whenInitialized$.pipe(
    switchMap(() =>
      this.mapInstance$.pipe(
        switchMap((x) => this._movingTimer.pipe(map(() => x.getPitch()))),
        shareReplay(1)
      )
    )
  );

  readonly pitch$ = this.whenInitialized$.pipe(
    switchMap(() => {
      return this.isRotating$.pipe(
        onTrueToFalse(),
        startWith(undefined),
        switchMap(() => this.pitchNow$.pipe(first())),
        distinctUntilChanged(),
        shareReplay(1)
      );
    })
  );

  readonly bearingNow$ = this.whenInitialized$.pipe(
    switchMap(() =>
      this.mapInstance$.pipe(
        switchMap((x) => this._movingTimer.pipe(map(() => x.getBearing()))),
        shareReplay(1)
      )
    )
  );

  readonly bearing$ = this.whenInitialized$.pipe(
    switchMap(() => {
      return this.isRotating$.pipe(
        onTrueToFalse(),
        startWith(undefined),
        switchMap(() => this.bearingNow$.pipe(first())),
        distinctUntilChanged(),
        shareReplay(1)
      );
    })
  );

  readonly drawerContent$ = this.state$.pipe(
    map((x) => x.drawerContent),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly hasDrawerContent$ = this.drawerContent$.pipe(
    map((x) => x != null),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly clickEvent$ = this.state$.pipe(
    map((x) => x.clickEvent),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly doubleClickEvent$ = this.state$.pipe(
    map((x) => x.doubleClickEvent),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly rightClickEvent$ = this.state$.pipe(
    map((x) => x.rightClickEvent),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: State Changes
  readonly setMargin = this.updater((state, margin: Maybe<DbxMapboxMarginCalculationSizing>) => ({ ...state, margin: margin && (margin.rightMargin !== 0 || margin.leftMargin !== 0) ? margin : undefined }));
  readonly setMinimumVirtualViewportSize = this.updater((state, minimumVirtualViewportSize: Maybe<Partial<Vector>>) => ({ ...state, minimumVirtualViewportSize }));
  readonly setUseVirtualBound = this.updater((state, useVirtualBound: boolean) => ({ ...state, useVirtualBound }));
  readonly setBoundRefreshSettings = this.updater((state, boundRefreshSettings: Partial<DbxMapboxStoreBoundRefreshSettings>) => ({ ...state, boundRefreshSettings: { ...state.boundRefreshSettings, ...boundRefreshSettings } }));

  private readonly _setMapService = this.updater((state, mapService: Maybe<MapService>) => ({ mapService, moveState: 'init', lifecycleState: 'init', zoomState: 'init', rotateState: 'init', retainContent: state.retainContent, drawerContent: state.retainContent ? state.drawerContent : undefined, useVirtualBound: state.useVirtualBound, boundRefreshSettings: state.boundRefreshSettings }));
  private readonly _setLifecycleState = this.updater((state, lifecycleState: MapboxMapLifecycleState) => ({ ...state, lifecycleState }));
  private readonly _setMoveState = this.updater((state, moveState: MapboxMapMoveState) => ({ ...state, moveState }));
  private readonly _setZoomState = this.updater((state, zoomState: MapboxMapZoomState) => ({ ...state, zoomState }));
  private readonly _setRotateState = this.updater((state, rotateState: MapboxMapRotateState) => ({ ...state, rotateState }));

  private readonly _setMapCanvasSize = this.updater((state, mapCanvasSize: Vector) => ({ ...state, mapCanvasSize }));
  private readonly _setClickEvent = this.updater((state, clickEvent: DbxMapboxClickEvent) => ({ ...state, clickEvent }));
  private readonly _setDoubleClickEvent = this.updater((state, doubleClickEvent: DbxMapboxClickEvent) => ({ ...state, doubleClickEvent }));
  private readonly _setRightClickEvent = this.updater((state, rightClickEvent: DbxMapboxClickEvent) => ({ ...state, rightClickEvent }));

  private readonly _setError = this.updater((state, error: Error) => ({ ...state, error }));

  readonly clearDrawerContent = this.updater((state) => setDrawerContent(state, undefined));
  readonly setDrawerContent = this.updater(setDrawerContent);

  // MARK: Compat
  /**
   * @deprecated use drawerContent$ instead.
   */
  readonly content$ = this.drawerContent$;

  /**
   * @deprecated use hasDrawerContent$ instead.
   */
  readonly hasContent$ = this.hasDrawerContent$;

  /**
   * @deprecated use clearDrawerContent instead.
   */
  readonly clearContent = this.updater((state) => setDrawerContent(state, undefined));

  /**
   * @deprecated use setDrawerContent instead.
   */
  readonly setContent = this.updater(setDrawerContent);
}

function setDrawerContent(state: DbxMapboxStoreState, drawerContent: Maybe<DbxInjectionComponentConfig<unknown>>) {
  return { ...state, drawerContent };
}
