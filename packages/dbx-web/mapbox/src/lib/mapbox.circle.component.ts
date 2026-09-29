import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { latLngPointFunction, type Maybe } from '@dereekb/util';
import { GeoJSONSourceComponent, LayerComponent } from 'ngx-mapbox-gl';
import { type DbxMapboxCircle, dbxMapboxCircleFeature, DEFAULT_DBX_MAPBOX_CIRCLE_COLOR, DEFAULT_DBX_MAPBOX_CIRCLE_FILL_OPACITY, DEFAULT_DBX_MAPBOX_CIRCLE_LABEL_OPACITY, DEFAULT_DBX_MAPBOX_CIRCLE_LINE_OPACITY } from './mapbox.circle';

let dbxMapboxCircleComponentCount = 0;

/**
 * Value of an mgl-layer's [paint] input.
 */
export type DbxMapboxLayerPaint = ReturnType<LayerComponent['paint']>;

/**
 * Value of an mgl-layer's [layout] input.
 */
export type DbxMapboxLayerLayout = ReturnType<LayerComponent['layout']>;

/**
 * Layout of the label repeated along a circle's edge.
 */
export const DBX_MAPBOX_CIRCLE_LABEL_LAYOUT: DbxMapboxLayerLayout = {
  'symbol-placement': 'line',
  'text-field': ['get', 'label'],
  'text-size': 12,
  'text-offset': [0, -0.8]
};

/**
 * Draws a {@link DbxMapboxCircle} on the parent mgl-map as a filled polygon with an outline and an optional label along its edge.
 *
 * The circle is sized in real-world units, so it grows and shrinks with the zoom. Draws nothing while the circle is unset.
 */
@Component({
  selector: 'dbx-mapbox-circle',
  template: `
    <mgl-geojson-source [id]="sourceId" [data]="featureSignal()"></mgl-geojson-source>
    <mgl-layer [id]="sourceId + '-fill'" type="fill" [source]="sourceId" [paint]="fillPaintSignal()"></mgl-layer>
    <mgl-layer [id]="sourceId + '-line'" type="line" [source]="sourceId" [paint]="linePaintSignal()"></mgl-layer>
    <mgl-layer [id]="sourceId + '-label'" type="symbol" [source]="sourceId" [layout]="labelLayout" [paint]="labelPaintSignal()"></mgl-layer>
  `,
  imports: [GeoJSONSourceComponent, LayerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxMapboxCircleComponent {
  private static readonly _latLngPoint = latLngPointFunction({ wrap: true });

  readonly circle = input<Maybe<DbxMapboxCircle>>();

  readonly sourceId = `dbx-mapbox-circle-${(dbxMapboxCircleComponentCount += 1)}`;
  readonly labelLayout = DBX_MAPBOX_CIRCLE_LABEL_LAYOUT;

  readonly featureSignal = computed<GeoJSON.GeoJSON>(() => {
    const circle = this.circle();
    return circle ? dbxMapboxCircleFeature(DbxMapboxCircleComponent._latLngPoint(circle.latLng), circle) : { type: 'FeatureCollection', features: [] };
  });

  readonly colorSignal = computed(() => this.circle()?.color ?? DEFAULT_DBX_MAPBOX_CIRCLE_COLOR);

  readonly fillPaintSignal = computed<DbxMapboxLayerPaint>(() => ({
    'fill-color': this.colorSignal(),
    'fill-opacity': this.circle()?.fillOpacity ?? DEFAULT_DBX_MAPBOX_CIRCLE_FILL_OPACITY
  }));

  readonly linePaintSignal = computed<DbxMapboxLayerPaint>(() => ({
    'line-color': this.colorSignal(),
    'line-opacity': this.circle()?.lineOpacity ?? DEFAULT_DBX_MAPBOX_CIRCLE_LINE_OPACITY,
    'line-width': 2
  }));

  readonly labelPaintSignal = computed<DbxMapboxLayerPaint>(() => ({
    'text-color': this.colorSignal(),
    'text-opacity': this.circle()?.labelOpacity ?? DEFAULT_DBX_MAPBOX_CIRCLE_LABEL_OPACITY,
    'text-halo-color': '#ffffff',
    'text-halo-width': 1.5
  }));
}
