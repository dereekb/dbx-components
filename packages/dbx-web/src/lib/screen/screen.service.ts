import { Destroyable } from '@dereekb/util';
import { MediaMatcher } from '@angular/cdk/layout';
import { ObservableOrValue, asObservable, initialize } from '@dereekb/rxjs';
import { Subject, map, shareReplay, distinctUntilChanged, throttleTime, Observable, combineLatest } from 'rxjs';
import { ScreenMediaWidthType, ScreenMediaHeightType, screenMediaWidthTypeIsActive } from './screen';
import { Injectable } from '@angular/core';

/**
 * ScreenMediaService configuration.
 */
export abstract class DbxScreenMediaServiceConfig {
  /**
   * The maximum size of a micro screen. Any size bigger than this is considered a small screen or larger.
   */
  abstract microScreenWidthMax: number;
  /**
   * The maximum size of a small screen. Any size bigger than this is considered a tablet screen or larger.
   */
  abstract smallScreenWidthMax: number;
  /**
   * The maximum size of a tablet screen. Any size bigger than this is considered a large screen or larger.
   */
  abstract tabletScreenWidthMax: number;
  /**
   * The maximum size of a large screen. Any size bigger than this is considered full.
   */
  abstract largeScreenWidthMax: number;
  /**
   * The maximum size of a tiny screen. Any size bigger than this is considered normal.
   */
  abstract tinyScreenHeightMax: number;
}

export const DEFAULT_SCREEN_MEDIA_SERVICE_CONFIG: DbxScreenMediaServiceConfig = {
  microScreenWidthMax: 360,
  smallScreenWidthMax: 520,
  tabletScreenWidthMax: 786,
  largeScreenWidthMax: 1280,
  tinyScreenHeightMax: 280
};

/**
 * Service that emits the current view type based on the configuration.
 */
@Injectable()
export class DbxScreenMediaService implements Destroyable {
  private _microQuery: MediaQueryList;
  private _smallQuery: MediaQueryList;
  private _tabletQuery: MediaQueryList;
  private _largeQuery: MediaQueryList;

  private _tinyHeightQuery: MediaQueryList;

  private _updateWidth = new Subject<void>();
  private _updateHeight = new Subject<void>();

  readonly widthType$: Observable<ScreenMediaWidthType> = this._updateWidth.pipe(
    initialize(() => this._updateWidth.next()),
    throttleTime(100, undefined, { leading: true, trailing: true }),
    map(() => this._readWidthType()),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly heightType$: Observable<ScreenMediaHeightType> = this._updateWidth.pipe(
    initialize(() => this._updateHeight.next()),
    throttleTime(100, undefined, { leading: true, trailing: true }),
    map(() => this._readHeightType()),
    distinctUntilChanged(),
    shareReplay(1)
  );

  constructor(private readonly _media: MediaMatcher, config: DbxScreenMediaServiceConfig) {
    const { microScreenWidthMax, smallScreenWidthMax, tabletScreenWidthMax, largeScreenWidthMax } = config;

    this._microQuery = this._media.matchMedia(`screen and (max-width:${microScreenWidthMax}px)`);
    this._smallQuery = this._media.matchMedia(`screen and (max-width:${smallScreenWidthMax}px)`);
    this._tabletQuery = this._media.matchMedia(`screen and (max-width:${tabletScreenWidthMax}px)`);
    this._largeQuery = this._media.matchMedia(`screen and (max-width:${largeScreenWidthMax}px)`);

    this._tinyHeightQuery = this._media.matchMedia(`screen and (max-width:${largeScreenWidthMax}px)`);

    const widthHandler: (ev: MediaQueryListEvent) => void = () => this._updateWidth.next();
    const heightHandler: (ev: MediaQueryListEvent) => void = () => this._updateHeight.next();

    this._microQuery.onchange = widthHandler;
    this._smallQuery.onchange = widthHandler;
    this._tabletQuery.onchange = widthHandler;
    this._largeQuery.onchange = widthHandler;
    this._tinyHeightQuery.onchange = heightHandler;
  }

  destroy(): void {
    this._microQuery.onchange = null;
    this._smallQuery.onchange = null;
    this._tabletQuery.onchange = null;
    this._largeQuery.onchange = null;
    this._updateWidth.complete();
    this._updateHeight.complete();
  }

  /**
   * Returns an observable that detects whether or no the current width is greater or equal to the given breakpoint.
   *
   * @param inputBreakpoint
   * @returns
   */
  isBreakpointActive(inputBreakpoint: ObservableOrValue<ScreenMediaWidthType>): Observable<boolean> {
    return combineLatest([this.widthType$, asObservable(inputBreakpoint)]).pipe(
      map(([current, breakpoint]) => screenMediaWidthTypeIsActive(current, breakpoint)),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  private _readWidthType(): ScreenMediaWidthType {
    let width: ScreenMediaWidthType;

    if (this._microQuery.matches) {
      width = 'micro';
    } else if (this._smallQuery.matches) {
      width = 'small';
    } else if (this._tabletQuery.matches) {
      width = 'tablet';
    } else if (this._largeQuery.matches) {
      width = 'large';
    } else {
      width = 'full';
    }

    return width;
  }

  private _readHeightType(): ScreenMediaHeightType {
    if (this._tinyHeightQuery) {
      return 'tiny';
    } else {
      return 'normal';
    }
  }
}
