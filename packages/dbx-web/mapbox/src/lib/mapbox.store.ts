import { cleanup, filterMaybe, onTrueToFalse } from '@dereekb/rxjs';
import { Injectable, inject } from '@angular/core';
import {
  isSameLatLngBound,
  isSameLatLngPoint,
  type IsWithinLatLngBoundFunction,
  isWithinLatLngBoundFunction,
  type LatLngBound,
  latLngBoundFunction,
  type LatLngPointInput,
  type LatLngPoint,
  latLngPointFunction,
  type Maybe,
  type OverlapsLatLngBoundFunction,
  overlapsLatLngBoundFunction,
  diffLatLngBoundPoints,
  latLngBoundCenterPoint,
  addLatLngPoints,
  isDefaultLatLngPoint,
  swMostLatLngPoint,
  neMostLatLngPoint,
  latLngBoundWrapsMap,
  type Vector,
  filterUndefinedValues,
  latLngBoundFromInput,
  vectorMinimumSizeResizeFunction,
  isSameVector,
  type ZoomLevel
} from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { type MapService } from 'ngx-mapbox-gl';
import { defaultIfEmpty, distinctUntilChanged, filter, map, shareReplay, switchMap, tap, NEVER, type Observable, of, Subscription, startWith, interval, first, combineLatest, EMPTY, type OperatorFunction, throttleTime, fromEvent } from 'rxjs';
import { LngLatBounds, Point, type MapEventType, type MapEvents, type Map } from 'mapbox-gl';
import {
  type DbxMapboxClickEvent,
  type DbxMapboxRightClickEvent,
  type KnownMapboxStyle,
  type MapboxBearing,
  type MapboxEaseTo,
  type MapboxEventData,
  type MapboxFitBounds,
  type MapboxFitPositions,
  type MapboxFlyTo,
  type MapboxJumpTo,
  type MapboxResetNorth,
  type MapboxResetNorthPitch,
  type MapboxRotateTo,
  type MapboxSnapToNorth,
  type MapboxStyleConfig,
  type MapboxZoomLevel,
  type MapboxZoomLevelRange
} from './mapbox';
import { DbxMapboxService } from './mapbox.service';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { mapboxClientPointToMapPoint, mapboxViewportBoundFunction, type MapboxViewportBoundFunction } from './mapbox.util';
import { DBX_MAPBOX_LONG_PRESS_EVENT_TYPE, type DbxMapboxLongPressConfigInput, type DbxMapboxLongPressEvent, dbxMapboxLongPressTracker, isTouchSourcedMouseEvent, resolveDbxMapboxLongPressConfig, suppressNextClickEvent } from './mapbox.longpress';
import { type FilterMapboxBoundConfig, type FilterMapboxBoundReadItemValueFunction, filterByMapboxViewportBound } from './mapbox.rxjs';

export type MapboxMapLifecycleState = 'init' | 'load' | 'render' | 'idle';
export type MapboxMapMoveState = 'init' | 'idle' | 'moving';
export type MapboxMapZoomState = 'init' | 'idle' | 'zooming';
export type MapboxMapRotateState = 'init' | 'idle' | 'rotating';

export interface StringMapboxListenerPair {
  type: string;
  listener: (ev: MapboxEventData) => void;
}

export interface TypedMapboxListenerPair<T extends keyof MapEventType> {
  type: T;
  listener: (ev: MapEventType[T] & MapboxEventData) => void;
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
   * Latest right-click: a contextmenu event, or a long press.
   */
  readonly rightClickEvent?: Maybe<DbxMapboxRightClickEvent>;
  /**
   * Latest long press event.
   */
  readonly longPressEvent?: Maybe<DbxMapboxLongPressEvent>;
  /**
   * Long press config for this map, over the app-wide DbxMapboxConfig.longPress. False turns the long press off for this map.
   */
  readonly longPressConfig?: DbxMapboxLongPressConfigInput;
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
        let result: Observable<any> = NEVER;

        if (service) {
          result = service.mapLoaded$.pipe(
            defaultIfEmpty(undefined),
            map(() => {
              this._setLifecycleState('idle');
              this._setMoveState('idle');
              this._setZoomState('idle');
              this._setRotateState('idle');

              const map = service.mapInstance;

              const listenerPairs: StringMapboxListenerPair[] = [];

              function addListener<T extends keyof MapEvents>(type: T, listener: Parameters<typeof map.on<T>>[2]) {
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

              // MARK: Long Press
              const canvasContainer = map.getCanvasContainer();
              const getLongPressConfig = () => resolveDbxMapboxLongPressConfig({ override: this.get().longPressConfig, base: this.dbxMapboxService.longPressConfig ?? false });

              const longPressTracker = dbxMapboxLongPressTracker({
                getConfig: getLongPressConfig,
                onLongPress: (result) => {
                  const mapPoint = mapboxClientPointToMapPoint({ container: canvasContainer, point: result.position });
                  const point = new Point(mapPoint.x, mapPoint.y);

                  // stop the pan the held pointer started, so the map does not move under the menu that opens
                  map.stop();

                  this._setLongPressEvent({
                    type: DBX_MAPBOX_LONG_PRESS_EVENT_TYPE,
                    target: map,
                    source: result.source,
                    originalEvent: result.startEvent,
                    point,
                    lngLat: map.unproject(point),
                    duration: result.duration
                  });
                }
              });

              /**
               * With the long press on, a contextmenu made by a touch (Android fires one after about half a second) is left to the long press, so the configured duration applies on every device.
               *
               * @param event - The contextmenu event.
               * @returns True if the contextmenu should not open the right-click menu.
               */
              const isLongPressTouchContextMenu = (event: MouseEvent) => getLongPressConfig() != null && (longPressTracker.isTouchInteraction() || isTouchSourcedMouseEvent(event));
              const touchClientPosition = (event: TouchEvent) => ({ x: event.touches[0].clientX, y: event.touches[0].clientY });

              /**
               * Cancels the pending long press when the user starts zooming, rotating or pitching. Only user gestures carry an originalEvent.
               *
               * @param event - The map event.
               */
              const cancelLongPressOnUserGesture = (event: { readonly type: string; readonly originalEvent?: unknown }) => {
                if (event.originalEvent) {
                  longPressTracker.cancel();
                }
              };

              addListener('touchstart', (x) => {
                const { originalEvent } = x;

                if (originalEvent.touches.length === 1) {
                  longPressTracker.start({ source: 'touch', position: touchClientPosition(originalEvent), event: originalEvent });
                } else {
                  longPressTracker.cancel();
                }
              });

              addListener('touchmove', (x) => {
                const { originalEvent } = x;

                if (originalEvent.touches.length === 1) {
                  longPressTracker.move('touch', touchClientPosition(originalEvent));
                } else {
                  longPressTracker.cancel();
                }
              });

              addListener('touchend', (x) => {
                const { originalEvent } = x;

                // stops the lift of a press that fired from clicking the menu's backdrop, which would close the menu that just opened
                if (originalEvent.touches.length === 0 && longPressTracker.end('touch') && originalEvent.cancelable) {
                  originalEvent.preventDefault();
                }
              });

              addListener('touchcancel', () => longPressTracker.end('touch'));

              /**
               * Removes the window mousemove listener of a pending mouse press.
               */
              let stopTrackingMouseMoves: Maybe<() => void>;

              /**
               * Feeds mouse moves to the tracker while a mouse press is pending.
               *
               * Mapbox sends no mousemove while a held left button drags the map, so the moves come from the window. The listener only exists during a press, and is added from the map's mousedown handler, which runs outside of Angular's zone.
               */
              const trackMouseMoves = () => {
                stopTrackingMouseMoves?.();

                const onMouseMove = (event: MouseEvent) => {
                  if (longPressTracker.state === 'pending' && longPressTracker.source === 'mouse') {
                    longPressTracker.move('mouse', { x: event.clientX, y: event.clientY });
                  } else {
                    stopTrackingMouseMoves?.();
                  }
                };

                window.addEventListener('mousemove', onMouseMove, { passive: true });

                stopTrackingMouseMoves = () => {
                  window.removeEventListener('mousemove', onMouseMove);
                  stopTrackingMouseMoves = undefined;
                };
              };

              addListener('mousedown', (x) => {
                const { originalEvent } = x;
                // other buttons and modifier keys rotate, pitch, box zoom, or right-click on a Mac
                const isPlainLeftButton = originalEvent.button === 0 && !originalEvent.ctrlKey && !originalEvent.metaKey && !originalEvent.altKey && !originalEvent.shiftKey;

                if (!isPlainLeftButton) {
                  longPressTracker.cancel();
                } else if (longPressTracker.start({ source: 'mouse', position: { x: originalEvent.clientX, y: originalEvent.clientY }, event: originalEvent })) {
                  trackMouseMoves();
                }
              });

              addListener('pitchstart', cancelLongPressOnUserGesture);

              addListener('zoomstart', (x) => {
                this._setZoomState('zooming');
                cancelLongPressOnUserGesture(x);
              });
              addListener('zoomend', () => this._setZoomState('idle'));

              addListener('rotatestart', (x) => {
                this._setRotateState('rotating');
                cancelLongPressOnUserGesture(x);
              });
              addListener('rotateend', () => this._setRotateState('idle'));

              addListener('click', (x) => {
                // the click that ends a press that fired is not a click on the map
                if (!longPressTracker.shouldSuppressClick()) {
                  this._setClickEvent(x);
                }
              });
              addListener('dblclick', (x) => this._setDoubleClickEvent(x));
              addListener('contextmenu', (x) => {
                if (!isLongPressTouchContextMenu(x.originalEvent)) {
                  this._setRightClickEvent(x);
                }
              });

              const refreshForResize = () => {
                const { clientWidth: x, clientHeight: y } = map.getCanvas();
                this._setMapCanvasSize({ x, y });
              };

              addListener('resize', refreshForResize);
              refreshForResize();

              // stops iOS from showing its callout (the link/image menu) under a held finger
              const previousTouchCallout = canvasContainer.style.getPropertyValue('-webkit-touch-callout');
              canvasContainer.style.setProperty('-webkit-touch-callout', 'none');

              const subs: Subscription[] = [
                // the mouse may be released over the menu that opened, outside the map, where mapbox does not send mouseup
                fromEvent<MouseEvent>(window, 'mouseup', { capture: true }).subscribe(() => {
                  stopTrackingMouseMoves?.();

                  if (longPressTracker.end('mouse')) {
                    suppressNextClickEvent();
                  }
                }),
                fromEvent(window, 'blur').subscribe(() => longPressTracker.cancel()),
                // mapbox only blocks the browser's own menu in some configurations, so block a touch's contextmenu here too
                fromEvent<MouseEvent>(canvasContainer, 'contextmenu').subscribe((event) => {
                  if (isLongPressTouchContextMenu(event)) {
                    event.preventDefault();
                  } else {
                    longPressTracker.cancel();
                  }
                }),
                new Subscription(() => {
                  stopTrackingMouseMoves?.();
                  longPressTracker.destroy();
                  canvasContainer.style.setProperty('-webkit-touch-callout', previousTouchCallout);
                })
              ];

              return {
                service,
                listenerPairs,
                subs
              };
            })
          );
        }

        return result;
      }),
      cleanup((state: unknown) => {
        const { service, listenerPairs, subs } = state as { service: MapService; listenerPairs: StringMapboxListenerPair[]; subs: Subscription[] };
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
        let result: Observable<any> = EMPTY;

        if (boundFromInput) {
          const bound = this.latLngBound(boundFromInput);
          result = this.mapInstance$.pipe(tap((map) => map.fitBounds(new LngLatBounds(bound.sw, bound.ne), x.options, x.eventData)));
        }

        return result;
      })
    );
  });

  readonly fitBounds = this.effect((input: Observable<MapboxFitBounds>) => {
    return input.pipe(
      switchMap((x) => {
        const bound = this.latLngBound(x.bounds);
        return this.mapInstance$.pipe(tap((map) => map.fitBounds(new LngLatBounds(bound.sw, bound.ne), x.options, x.eventData)));
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
        return x === 'moving' ? interval(period) : of(0);
      }),
      shareReplay(1)
    );
  }

  lifecycleRenderTimer(period = this.timerRefreshPeriod) {
    return this.lifecycleState$.pipe(
      switchMap((x) => {
        return x === 'render' ? interval(period) : of(0);
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
            return {
              lat: offset.lat + center.lat,
              lng: offset.lng + center.lng
            };
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

  readonly currentMapInstance$: Observable<Maybe<Map>> = this.currentMapService$.pipe(
    switchMap((currentMapService: Maybe<MapService>) => {
      return currentMapService
        ? currentMapService.mapLoaded$.pipe(
            defaultIfEmpty(undefined),
            map(() => currentMapService.mapInstance)
          )
        : of(undefined);
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
      let result: Observable<boolean> = of(false);

      if (x) {
        result = combineLatest([this.moveState$.pipe(map((x) => x === 'idle')), this.lifecycleState$.pipe(map((x) => x === 'idle'))]).pipe(
          filter(([m, l]) => m && l),
          first(),
          map(() => true)
        );
      }

      return result;
    }),
    shareReplay(1)
  );

  readonly whenInitialized$ = this.isInitialized$.pipe(
    filter(() => true),
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
      return minimumVirtualViewportSize ? this.minimumMapCanvasSize(minimumVirtualViewportSize) : this.mapCanvasSize$;
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
      return minimumVirtualViewportSize ? this.viewportBoundFunctionWithMinimumSize(minimumVirtualViewportSize) : this.rawViewportBoundFunction$;
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
    distinctUntilChanged((a, b) => a != null && a.fullWidth === b?.fullWidth && a.leftMargin === b.leftMargin && a.rightMargin === b.rightMargin),
    shareReplay(1)
  );

  readonly reverseMargin$ = this.margin$.pipe(
    map((x) => {
      return x ? { leftMargin: -x.leftMargin, rightMargin: -x.rightMargin, fullWidth: x.fullWidth } : x;
    })
  );

  readonly centerGivenMargin$: Observable<LatLngPoint> = this.whenInitialized$.pipe(
    switchMap(() => {
      return this.reverseMargin$.pipe(
        switchMap((x) => {
          return x
            ? this.center$.pipe(switchMap((_) => this.calculateNextCenterOffsetWithScreenMarginChange(x)))
            : this.isMoving$.pipe(
                filter((x) => !x),
                switchMap(() => this.center$)
              );
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
              let result: Maybe<LatLngBound> = null;

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
                switchMap(() => this.rawBoundNow$.pipe(first()))
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
      return useVirtualBound ? this.virtualBound$ : this.rawBound$;
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
        switchMap((x) => this._renderingTimer.pipe(map(() => x.getZoom()))),
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

  /**
   * Latest right-click: a contextmenu event, or a long press. Use isDbxMapboxLongPressEvent() to tell them apart.
   */
  readonly rightClickEvent$: Observable<Maybe<DbxMapboxRightClickEvent>> = this.state$.pipe(
    map((x) => x.rightClickEvent),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly longPressEvent$: Observable<Maybe<DbxMapboxLongPressEvent>> = this.state$.pipe(
    map((x) => x.longPressEvent),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: State Changes
  readonly setMargin = this.updater((state, margin: Maybe<DbxMapboxMarginCalculationSizing>) => ({ ...state, margin: margin && (margin.rightMargin !== 0 || margin.leftMargin !== 0) ? margin : undefined }));
  readonly setMinimumVirtualViewportSize = this.updater((state, minimumVirtualViewportSize: Maybe<Partial<Vector>>) => ({ ...state, minimumVirtualViewportSize }));
  readonly setUseVirtualBound = this.updater((state, useVirtualBound: boolean) => ({ ...state, useVirtualBound }));
  /**
   * Sets the long press config for this map, over the app-wide DbxMapboxConfig.longPress. False turns the long press off for this map; undefined uses the app-wide config.
   *
   * Applies from the next press.
   */
  readonly setLongPressConfig = this.updater((state, longPressConfig: DbxMapboxLongPressConfigInput) => ({ ...state, longPressConfig }));
  readonly setBoundRefreshSettings = this.updater((state, boundRefreshSettings: Partial<DbxMapboxStoreBoundRefreshSettings>) => ({ ...state, boundRefreshSettings: { ...state.boundRefreshSettings, ...boundRefreshSettings } }));

  private readonly _setMapService = this.updater((state, mapService: Maybe<MapService>) => ({
    mapService,
    moveState: 'init',
    lifecycleState: 'init',
    zoomState: 'init',
    rotateState: 'init',
    retainContent: state.retainContent,
    drawerContent: state.retainContent ? state.drawerContent : undefined,
    useVirtualBound: state.useVirtualBound,
    boundRefreshSettings: state.boundRefreshSettings,
    longPressConfig: state.longPressConfig
  }));
  private readonly _setLifecycleState = this.updater((state, lifecycleState: MapboxMapLifecycleState) => ({ ...state, lifecycleState }));
  private readonly _setMoveState = this.updater((state, moveState: MapboxMapMoveState) => ({ ...state, moveState }));
  private readonly _setZoomState = this.updater((state, zoomState: MapboxMapZoomState) => ({ ...state, zoomState }));
  private readonly _setRotateState = this.updater((state, rotateState: MapboxMapRotateState) => ({ ...state, rotateState }));

  private readonly _setMapCanvasSize = this.updater((state, mapCanvasSize: Vector) => ({ ...state, mapCanvasSize }));
  private readonly _setClickEvent = this.updater((state, clickEvent: DbxMapboxClickEvent) => ({ ...state, clickEvent }));
  private readonly _setDoubleClickEvent = this.updater((state, doubleClickEvent: DbxMapboxClickEvent) => ({ ...state, doubleClickEvent }));
  private readonly _setRightClickEvent = this.updater((state, rightClickEvent: DbxMapboxClickEvent) => ({ ...state, rightClickEvent }));
  private readonly _setLongPressEvent = this.updater((state, longPressEvent: DbxMapboxLongPressEvent) => ({ ...state, longPressEvent, rightClickEvent: longPressEvent }));

  private readonly _setError = this.updater((state, error: Error) => ({ ...state, error }));

  readonly clearDrawerContent = this.updater((state) => setDrawerContent(state, undefined));
  readonly setDrawerContent = this.updater(setDrawerContent);
}

function setDrawerContent(state: DbxMapboxStoreState, drawerContent: Maybe<DbxInjectionComponentConfig<unknown>>) {
  return { ...state, drawerContent };
}
