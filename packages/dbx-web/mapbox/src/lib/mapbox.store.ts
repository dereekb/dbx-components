import { cleanup, filterMaybe, onTrueToFalse } from '@dereekb/rxjs';
import { Inject, Injectable, OnDestroy } from '@angular/core';
import { isSameLatLngBound, isSameLatLngPoint, IsWithinLatLngBoundFunction, isWithinLatLngBoundFunction, LatLngBound, latLngBoundFunction, LatLngPointInput, LatLngPoint, latLngPointFunction, Maybe, OverlapsLatLngBoundFunction, overlapsLatLngBoundFunction, diffLatLngBoundPoints, latLngBoundCenterPoint, addLatLngPoints, isDefaultLatLngPoint, swMostLatLngPoint, neMostLatLngPoint, latLngBoundWrapsMap } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { MapService } from 'ngx-mapbox-gl';
import { defaultIfEmpty, distinctUntilChanged, filter, map, shareReplay, switchMap, tap, NEVER, Observable, of, Subscription, startWith, interval, first, combineLatest } from 'rxjs';
import * as MapboxGl from 'mapbox-gl';
import { DbxMapboxClickEvent, KnownMapboxStyle, MapboxBearing, MapboxEaseTo, MapboxFitBounds, MapboxFlyTo, MapboxJumpTo, MapboxResetNorth, MapboxResetNorthPitch, MapboxRotateTo, MapboxSnapToNorth, MapboxStyleConfig, MapboxZoomLevel } from './mapbox';
import { DbxMapboxService } from './mapbox.service';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';

export type MapboxMapLifecycleState = 'init' | 'load' | 'render' | 'idle';
export type MapboxMapMoveState = 'init' | 'idle' | 'moving';
export type MapboxMapZoomState = 'init' | 'idle' | 'zooming';
export type MapboxMapRotateState = 'init' | 'idle' | 'rotating';

export interface StringMapboxListenerPair {
  type: string;
  listener: (ev: MapboxGl.EventData) => void;
}

export interface TypedMapboxListenerPair<T extends keyof MapboxGl.MapEventType> {
  type: T;
  listener: (ev: MapboxGl.MapEventType[T] & MapboxGl.EventData) => void;
}

export interface DbxMapboxMarginCalculationSizing {
  leftMargin: number;
  rightMargin: number;
  fullWidth: number;
}

export interface DbxMapboxStoreState {
  /**
   * Current MapService being utilized.
   */
  mapService?: Maybe<MapService>;
  lifecycleState: MapboxMapLifecycleState;
  moveState: MapboxMapMoveState;
  zoomState: MapboxMapZoomState;
  rotateState: MapboxMapRotateState;
  /**
   * Latest click event
   */
  clickEvent?: Maybe<DbxMapboxClickEvent>;
  /**
   * Latest double-click event
   */
  doubleClickEvent?: Maybe<DbxMapboxClickEvent>;
  /**
   * Latest contextmenu event.
   */
  rightClickEvent?: Maybe<DbxMapboxClickEvent>;
  /**
   * Whether or not to retain content between resets.
   *
   * True by default.
   */
  retainContent: boolean;
  /**
   * Custom content configuration.
   */
  content?: Maybe<DbxInjectionComponentConfig<unknown>>;
  /**
   * Latest error
   */
  error?: Maybe<Error>;
  /**
   * Map margin/offset
   */
  margin?: Maybe<DbxMapboxMarginCalculationSizing>;
}

/**
 * Store used for retrieving information.
 */
@Injectable()
export class DbxMapboxMapStore extends ComponentStore<DbxMapboxStoreState> implements OnDestroy {
  private latLngPoint = latLngPointFunction();
  private latLngBound = latLngBoundFunction({ pointFunction: latLngPointFunction({ wrap: false, validate: false }) });

  constructor(@Inject(DbxMapboxService) private readonly dbxMapboxService: DbxMapboxService) {
    super({
      lifecycleState: 'init',
      moveState: 'init',
      zoomState: 'init',
      rotateState: 'init',
      retainContent: true
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

              function addListener<T extends keyof MapboxGl.MapEventType>(type: T, listener: (ev: MapboxGl.MapEventType[T] & MapboxGl.EventData) => void) {
                map.on(type, listener);
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
        const centerPoint = this.latLngPoint(center);
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
        const center = inputCenter ? this.latLngPoint(inputCenter) : undefined;
        return this.mapInstance$.pipe(tap((map) => map.jumpTo({ ...x.to, center }, x.eventData)));
      })
    );
  });

  readonly easeTo = this.effect((input: Observable<MapboxEaseTo>) => {
    return input.pipe(
      switchMap((x) => {
        const inputCenter = x.center ?? x.to?.center;
        const center = inputCenter ? this.latLngPoint(inputCenter) : undefined;
        return this.mapInstance$.pipe(tap((map) => map.easeTo({ ...x.to, center }, x.eventData)));
      })
    );
  });

  readonly flyTo = this.effect((input: Observable<MapboxFlyTo>) => {
    return input.pipe(
      switchMap((x) => {
        const inputCenter = x.center ?? x.to?.center;
        const center = inputCenter ? this.latLngPoint(inputCenter) : undefined;
        return this.mapInstance$.pipe(tap((map) => map.flyTo({ ...x.to, center }, x.eventData)));
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
      shareReplay()
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
      shareReplay()
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
    return this.atNextIdle().pipe(
      switchMap(() =>
        this.bound$.pipe(
          first(),
          map((bounds) => {
            const diff = diffLatLngBoundPoints(bounds);
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
        shareReplay()
      )
    )
  );

  readonly isMoving$ = this.whenInitialized$.pipe(
    switchMap(() =>
      this.moveState$.pipe(
        map((x) => x === 'moving'),
        distinctUntilChanged(),
        shareReplay()
      )
    )
  );

  readonly isZooming$ = this.whenInitialized$.pipe(
    switchMap(() =>
      this.zoomState$.pipe(
        map((x) => x === 'zooming'),
        distinctUntilChanged(),
        shareReplay()
      )
    )
  );

  readonly isRotating$ = this.whenInitialized$.pipe(
    switchMap(() =>
      this.rotateState$.pipe(
        map((x) => x === 'rotating'),
        distinctUntilChanged(),
        shareReplay()
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
        distinctUntilChanged(isSameLatLngPoint),
        shareReplay(1)
      );
    }),
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

  readonly boundNow$: Observable<LatLngBound> = this.whenInitialized$.pipe(
    switchMap(() =>
      this.mapInstance$.pipe(
        switchMap((x) =>
          this._renderingTimer.pipe(
            map(() => {
              const bound = x.getBounds();
              const boundSw = bound.getSouthWest();
              const boundNe = bound.getNorthEast();

              const sw = isDefaultLatLngPoint(boundSw) ? swMostLatLngPoint() : boundSw;
              const ne = isDefaultLatLngPoint(boundNe) ? neMostLatLngPoint() : boundNe;

              return this.latLngBound(sw, ne);
            })
          )
        ),
        shareReplay(1)
      )
    )
  );

  readonly bound$: Observable<LatLngBound> = this.whenInitialized$.pipe(
    switchMap(() => {
      return this.isRendering$.pipe(
        onTrueToFalse(),
        startWith(undefined),
        switchMap((x) => this.boundNow$.pipe(first())),
        distinctUntilChanged(isSameLatLngBound),
        shareReplay(1)
      );
    })
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

  readonly overlapsBoundFunction$: Observable<OverlapsLatLngBoundFunction> = this.bound$.pipe(
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
        switchMap((x) => this.zoomNow$.pipe(first())),
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
        switchMap((x) => this.pitchNow$.pipe(first())),
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
        switchMap((x) => this.bearingNow$.pipe(first())),
        distinctUntilChanged(),
        shareReplay(1)
      );
    })
  );

  readonly content$ = this.state$.pipe(
    map((x) => x.content),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly hasContent$ = this.content$.pipe(map(Boolean));

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
  readonly setMargin = this.updater((state, margin: Maybe<DbxMapboxMarginCalculationSizing>) => ({ ...state, margin }));

  private readonly _setMapService = this.updater((state, mapService: Maybe<MapService>) => ({ mapService, moveState: 'init', lifecycleState: 'init', zoomState: 'init', rotateState: 'init', retainContent: state.retainContent, content: state.retainContent ? state.content : undefined }));
  private readonly _setLifecycleState = this.updater((state, lifecycleState: MapboxMapLifecycleState) => ({ ...state, lifecycleState }));
  private readonly _setMoveState = this.updater((state, moveState: MapboxMapMoveState) => ({ ...state, moveState }));
  private readonly _setZoomState = this.updater((state, zoomState: MapboxMapZoomState) => ({ ...state, zoomState }));
  private readonly _setRotateState = this.updater((state, rotateState: MapboxMapRotateState) => ({ ...state, rotateState }));

  private readonly _setClickEvent = this.updater((state, clickEvent: DbxMapboxClickEvent) => ({ ...state, clickEvent }));
  private readonly _setDoubleClickEvent = this.updater((state, doubleClickEvent: DbxMapboxClickEvent) => ({ ...state, doubleClickEvent }));
  private readonly _setRightClickEvent = this.updater((state, rightClickEvent: DbxMapboxClickEvent) => ({ ...state, rightClickEvent }));

  private readonly _setError = this.updater((state, error: Error) => ({ ...state, error }));

  readonly clearContent = this.updater((state) => ({ ...state, content: undefined }));
  readonly setContent = this.updater((state, content: Maybe<DbxInjectionComponentConfig<unknown>>) => ({ ...state, content }));
}
