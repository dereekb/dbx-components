import type { BaseValueField } from '@ng-forge/dynamic-forms';
import { filterFromPOJO, type LatLngPoint } from '@dereekb/util';
import type { DbxForgeMapboxZoomFieldComponentProps } from './zoom.forge.field.component';
import type { MapboxZoomLevel } from '@dereekb/dbx-web/mapbox';

/**
 * The custom forge field type name for the mapbox zoom field.
 */
export const FORGE_MAPBOX_ZOOM_FIELD_TYPE = 'dbx-forge-mapbox-zoom' as const;

/**
 * Field definition type for a forge mapbox zoom picker field.
 */
export type DbxForgeMapboxZoomFieldDef = BaseValueField<DbxForgeMapboxZoomFieldComponentProps, unknown> & {
  readonly type: typeof FORGE_MAPBOX_ZOOM_FIELD_TYPE;
};

/**
 * Configuration for a forge mapbox zoom picker field.
 */
export interface DbxForgeMapboxZoomFieldConfig {
  readonly key?: string;
  readonly label?: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly showMap?: boolean;
  readonly center?: LatLngPoint;
  readonly minZoom?: MapboxZoomLevel;
  readonly maxZoom?: MapboxZoomLevel;
  readonly zoomStep?: number;
}

/**
 * Creates a forge field definition for a Mapbox-powered zoom level picker.
 *
 * This is the forge equivalent of {@link mapboxZoomField}.
 *
 * @param config - Optional field configuration overrides
 * @returns A validated forge field definition for the Mapbox zoom picker
 */
export function dbxForgeMapboxZoomField(config: DbxForgeMapboxZoomFieldConfig = {}): DbxForgeMapboxZoomFieldDef {
  const { key = 'zoom', label, description, required, readonly: isReadonly, showMap, center, minZoom, maxZoom, zoomStep } = config;

  const props: DbxForgeMapboxZoomFieldComponentProps = filterFromPOJO({
    label: label ?? 'Zoom',
    description,
    showMap,
    center,
    minZoom,
    maxZoom,
    zoomStep
  });

  return filterFromPOJO({
    key,
    type: FORGE_MAPBOX_ZOOM_FIELD_TYPE,
    label: label ?? 'Zoom',
    value: undefined as unknown,
    required,
    readonly: isReadonly,
    props: Object.keys(props).length > 0 ? props : undefined
  }) as DbxForgeMapboxZoomFieldDef;
}
