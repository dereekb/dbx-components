import { cleanup, filterMaybe, onTrueToFalse } from '@dereekb/rxjs';
import { Injectable, OnDestroy } from '@angular/core';
import { isSameLatLngBound, isSameLatLngPoint, IsWithinLatLngBoundFunction, isWithinLatLngBoundFunction, LatLngBound, latLngBoundFunction, LatLngInput, LatLngPoint, latLngPointFunction, Maybe, OverlapsLatLngBoundFunction, overlapsLatLngBoundFunction } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { MapService } from 'ngx-mapbox-gl';
import { defaultIfEmpty, distinctUntilChanged, filter, map, shareReplay, switchMap, tap, NEVER, Observable, of, Subscription, startWith, interval, first, combineLatest } from 'rxjs';
import * as MapboxGl from 'mapbox-gl';
import { MapboxStyleConfig, MapboxZoomLevel } from './mapbox';

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
   * Latest error
   */
  error?: Maybe<Error>;
}

/**
 * Store used for retrieving information.
 */
@Injectable()
export class DbxMapboxMapStore extends ComponentStore<DbxMapboxStoreState> implements OnDestroy {
  private latLngPoint = latLngPointFunction();
  private latLngBound = latLngBoundFunction();

  constructor() {
    super({
      lifecycleState: 'init',
      moveState: 'init',
      zoomState: 'init',
      rotateState: 'init'
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

  readonly setStyle = this.effect((input: Observable<MapboxStyleConfig | string>) => {
    return input.pipe(
      distinctUntilChanged(),
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

  readonly setCenter = this.effect((input: Observable<LatLngInput>) => {
    return input.pipe(
      distinctUntilChanged(),
      switchMap((center: LatLngInput) => {
        const centerPoint = this.latLngPoint(center);
        return this.mapInstance$.pipe(tap((map) => map.setCenter(centerPoint)));
      })
    );
  });

  readonly setZoom = this.effect((input: Observable<MapboxZoomLevel>) => {
    return input.pipe(
      distinctUntilChanged(),
      switchMap((zoom: MapboxZoomLevel) => {
        return this.mapInstance$.pipe(tap((map) => map.setZoom(zoom)));
      })
    );
  });

  readonly setMinZoom = this.effect((input: Observable<MapboxZoomLevel>) => {
    return input.pipe(
      distinctUntilChanged(),
      switchMap((zoom: MapboxZoomLevel) => {
        return this.mapInstance$.pipe(tap((map) => map.setMinZoom(zoom)));
      })
    );
  });

  readonly setMaxZoom = this.effect((input: Observable<MapboxZoomLevel>) => {
    return input.pipe(
      distinctUntilChanged(),
      switchMap((zoom: MapboxZoomLevel) => {
        return this.mapInstance$.pipe(tap((map) => map.setMaxZoom(zoom)));
      })
    );
  });

  readonly setPitch = this.effect((input: Observable<number>) => {
    return input.pipe(
      distinctUntilChanged(),
      switchMap((pitch) => {
        return this.mapInstance$.pipe(tap((map) => map.setPitch(pitch)));
      })
    );
  });

  readonly setMinPitch = this.effect((input: Observable<number>) => {
    return input.pipe(
      distinctUntilChanged(),
      switchMap((pitch: number) => {
        return this.mapInstance$.pipe(tap((map) => map.setMinPitch(pitch)));
      })
    );
  });

  readonly setMaxPitch = this.effect((input: Observable<number>) => {
    return input.pipe(
      distinctUntilChanged(),
      switchMap((pitch: number) => {
        return this.mapInstance$.pipe(tap((map) => map.setMaxPitch(pitch)));
      })
    );
  });

  readonly setBearing = this.effect((input: Observable<number>) => {
    return input.pipe(
      distinctUntilChanged(),
      switchMap((bearing) => {
        return this.mapInstance$.pipe(tap((map) => map.setBearing(bearing)));
      })
    );
  });

  readonly resetPitchAndBearing = this.effect((input: Observable<void>) => {
    return input.pipe(
      distinctUntilChanged(),
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
  movingTimer(period = 200) {
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

  lifecycleRenderTimer(period = 200) {
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
    )
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
    })
  );

  readonly boundNow$: Observable<LatLngBound> = this.whenInitialized$.pipe(
    switchMap(() =>
      this.mapInstance$.pipe(
        switchMap((x) =>
          this._renderingTimer.pipe(
            map(() => {
              const bound = x.getBounds();
              return this.latLngBound([bound.getSouthWest(), bound.getNorthEast()]);
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

  // MARK: State Changes
  private readonly _setMapService = this.updater((state, mapService: Maybe<MapService>) => ({ mapService, moveState: 'init', lifecycleState: 'init', zoomState: 'init', rotateState: 'init' }));
  private readonly _setLifecycleState = this.updater((state, lifecycleState: MapboxMapLifecycleState) => ({ ...state, lifecycleState }));
  private readonly _setMoveState = this.updater((state, moveState: MapboxMapMoveState) => ({ ...state, moveState }));
  private readonly _setZoomState = this.updater((state, zoomState: MapboxMapZoomState) => ({ ...state, zoomState }));
  private readonly _setRotateState = this.updater((state, rotateState: MapboxMapRotateState) => ({ ...state, rotateState }));

  private readonly _setError = this.updater((state, error: Error) => ({ ...state, error }));
}
