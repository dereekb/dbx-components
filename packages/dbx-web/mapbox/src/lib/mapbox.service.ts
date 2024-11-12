import { Injectable, inject } from '@angular/core';
import { LatLngPointInput, Milliseconds } from '@dereekb/util';
import { MapboxOptions } from 'mapbox-gl';
import { KnownMapboxStyle, MapboxZoomLevel } from './mapbox';

export class DbxMapboxConfig {
  readonly defaultStyle?: MapboxOptions['style'];
  readonly defaultZoom?: MapboxZoomLevel;
  readonly defaultCenter?: LatLngPointInput;
  readonly defaultStoreRefreshPeriod?: number;
}

export const DEFAULT_MAPBOX_STYLE: KnownMapboxStyle = 'mapbox://styles/mapbox/streets-v12';
export const DEFAULT_MAPBOX_CENTER: LatLngPointInput = [30.2690138665, -97.7408297965];
export const DEFAULT_MAPBOX_ZOOM: MapboxZoomLevel = 8;
export const DEFAULT_MAPBOX_MAP_STORE_TIMER_REFRESH_PERIOD: Milliseconds = 200;

@Injectable({
  providedIn: 'root'
})
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

  get mapboxMapStoreTimerRefreshPeriod(): number {
    return this._config.defaultStoreRefreshPeriod ?? DEFAULT_MAPBOX_MAP_STORE_TIMER_REFRESH_PERIOD;
  }
}
