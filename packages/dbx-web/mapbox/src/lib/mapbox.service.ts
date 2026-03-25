import { Injectable, inject } from '@angular/core';
import { latLngPoint, type LatLngPointInput, type Milliseconds } from '@dereekb/util';
import { type MapOptions } from 'mapbox-gl';
import { type KnownMapboxStyle, type MapboxZoomLevel } from './mapbox';

export class DbxMapboxConfig {
  readonly defaultStyle?: MapOptions['style'];
  readonly defaultZoom?: MapboxZoomLevel;
  readonly defaultCenter?: LatLngPointInput;
  readonly defaultStoreRefreshPeriod?: number;
  /**
   * Width to use for the mapbox layout drawer (mat-sidenav).
   *
   * Overrides the `--mat-sidenav-container-width` CSS token on the layout component.
   * Defaults to 'auto' so the drawer width is determined by its content rather than
   * the M3 default of 360px.
   */
  readonly drawerWidth?: string;
}

export const DEFAULT_MAPBOX_STYLE: KnownMapboxStyle = 'mapbox://styles/mapbox/streets-v12';
export const DEFAULT_MAPBOX_CENTER: LatLngPointInput = [30.2690138665, -97.7408297965];
export const DEFAULT_MAPBOX_ZOOM: MapboxZoomLevel = 8;
export const DEFAULT_MAPBOX_LAYOUT_DRAWER_WIDTH = 'auto';
export const DEFAULT_MAPBOX_MAP_STORE_TIMER_REFRESH_PERIOD: Milliseconds = 200;

@Injectable()
export class DbxMapboxService {
  private readonly _config = inject(DbxMapboxConfig, { optional: true }) ?? {};

  get defaultStyle() {
    return this._config.defaultStyle ?? DEFAULT_MAPBOX_STYLE;
  }

  get defaultZoom(): MapboxZoomLevel {
    return this._config.defaultZoom ?? DEFAULT_MAPBOX_ZOOM;
  }

  get defaultCenter(): LatLngPointInput {
    return this._config.defaultCenter ?? DEFAULT_MAPBOX_CENTER;
  }

  get drawerWidth(): string {
    return this._config.drawerWidth ?? DEFAULT_MAPBOX_LAYOUT_DRAWER_WIDTH;
  }

  get mapboxMapStoreTimerRefreshPeriod(): number {
    return this._config.defaultStoreRefreshPeriod ?? DEFAULT_MAPBOX_MAP_STORE_TIMER_REFRESH_PERIOD;
  }

  initializationOptions(): Partial<MapOptions> {
    return {
      style: this.defaultStyle,
      zoom: this.defaultZoom,
      center: latLngPoint(this.defaultCenter)
    };
  }
}
