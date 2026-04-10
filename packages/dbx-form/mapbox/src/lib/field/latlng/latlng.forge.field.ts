import type { BaseValueField } from '@ng-forge/dynamic-forms';
import { filterFromPOJO } from '@dereekb/util';
import { DEFAULT_LAT_LNG_TEXT_FIELD_PATTERN_MESSAGE, DEFAULT_LAT_LNG_TEXT_FIELD_PLACEHOLDER } from '@dereekb/dbx-form';
import { LAT_LNG_PATTERN } from '@dereekb/util';
import type { DbxForgeMapboxLatLngFieldComponentProps } from './latlng.forge.field.component';

/**
 * The custom forge field type name for the mapbox lat/lng field.
 */
export const FORGE_MAPBOX_LATLNG_FIELD_TYPE = 'dbx-forge-mapbox-latlng' as const;

/**
 * Field definition type for a forge mapbox lat/lng picker field.
 */
export type DbxForgeMapboxLatLngFieldDef = BaseValueField<DbxForgeMapboxLatLngFieldComponentProps, unknown> & {
  readonly type: typeof FORGE_MAPBOX_LATLNG_FIELD_TYPE;
};

/**
 * Configuration for a forge mapbox lat/lng picker field.
 */
export interface DbxForgeMapboxLatLngFieldConfig {
  readonly key?: string;
  readonly label?: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly showMap?: boolean;
  readonly showCenterButton?: boolean;
  readonly setCenterOnLocationSet?: boolean;
  readonly selectLocationOnMapDrag?: boolean;
  readonly selectLocationOnMapClick?: boolean;
  readonly zoom?: number;
  readonly recenterTime?: number;
  readonly latLngConfig?: import('@dereekb/util').LatLngPointFunctionConfig;
  readonly markerConfig?: DbxForgeMapboxLatLngFieldComponentProps['markerConfig'];
}

/**
 * Creates a forge field definition for a Mapbox-powered latitude/longitude picker.
 *
 * This is the forge equivalent of {@link mapboxLatLngField}.
 *
 * @param config - Optional field configuration overrides
 * @returns A validated forge field definition for the Mapbox lat/lng picker
 */
export function forgeMapboxLatLngField(config: DbxForgeMapboxLatLngFieldConfig = {}): DbxForgeMapboxLatLngFieldDef {
  const { key = 'latLng', label, description, required, readonly: isReadonly, showMap, zoom, latLngConfig, recenterTime, showCenterButton, setCenterOnLocationSet, selectLocationOnMapDrag, selectLocationOnMapClick, markerConfig } = config;

  const props: DbxForgeMapboxLatLngFieldComponentProps = filterFromPOJO({
    label: label ?? 'Location',
    description,
    placeholder: DEFAULT_LAT_LNG_TEXT_FIELD_PLACEHOLDER,
    pattern: LAT_LNG_PATTERN,
    patternMessage: DEFAULT_LAT_LNG_TEXT_FIELD_PATTERN_MESSAGE,
    showMap,
    zoom,
    latLngConfig,
    recenterTime,
    selectLocationOnMapDrag,
    selectLocationOnMapClick,
    showCenterButton,
    setCenterOnLocationSet,
    markerConfig
  });

  return filterFromPOJO({
    key,
    type: FORGE_MAPBOX_LATLNG_FIELD_TYPE,
    label: label ?? 'Location',
    value: undefined as unknown,
    required,
    readonly: isReadonly,
    props: Object.keys(props).length > 0 ? props : undefined
  }) as DbxForgeMapboxLatLngFieldDef;
}
