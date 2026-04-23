import { DEFAULT_LAT_LNG_TEXT_FIELD_PATTERN_MESSAGE, DEFAULT_LAT_LNG_TEXT_FIELD_PLACEHOLDER, type DescriptionFieldConfig, type FieldConfig, formlyField, type LabeledBaseFieldConfig, propsAndConfigForFieldConfig, validatorsForFieldConfig } from '@dereekb/dbx-form';
import { LAT_LNG_PATTERN } from '@dereekb/util';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type DbxFormMapboxLatLngComponentFieldProps } from './latlng.field.component';

/**
 * @deprecated Use DbxForgeMapboxLatLngFieldConfig instead.
 */
export interface MapboxLatLngFieldConfig extends Omit<LabeledBaseFieldConfig, 'key'>, DescriptionFieldConfig, Partial<FieldConfig>, Pick<DbxFormMapboxLatLngComponentFieldProps, 'showMap' | 'zoom' | 'latLngConfig' | 'recenterTime' | 'setCenterOnLocationSet' | 'showCenterButton' | 'selectLocationOnMapDrag' | 'selectLocationOnMapClick' | 'markerConfig'> {}

/**
 * Creates a Formly field configuration for a Mapbox-powered latitude/longitude picker with optional map display.
 *
 * @deprecated Use dbxForgeMapboxLatLngField() from the forge API instead.
 * @param config - Optional field configuration overrides
 * @returns A validated Formly field configuration for the Mapbox lat/lng picker
 */
export function mapboxLatLngField(config: MapboxLatLngFieldConfig = {}): FormlyFieldConfig {
  const { key = 'latLng', latLngConfig, showMap, zoom, recenterTime, showCenterButton, setCenterOnLocationSet, selectLocationOnMapDrag, selectLocationOnMapClick, markerConfig } = config;

  const classGetter = 'dbx-mat-form-field-disable-underline';
  const fieldConfig: FormlyFieldConfig = {
    ...formlyField({
      key,
      type: 'mapbox-latlng-picker',
      ...propsAndConfigForFieldConfig(config, {
        classGetter,
        label: config.label ?? 'Location',
        placeholder: DEFAULT_LAT_LNG_TEXT_FIELD_PLACEHOLDER,
        pattern: LAT_LNG_PATTERN,
        autocomplete: false,
        showMap,
        zoom,
        latLngConfig,
        recenterTime,
        selectLocationOnMapDrag,
        selectLocationOnMapClick,
        showCenterButton,
        setCenterOnLocationSet,
        markerConfig
      })
    }),
    ...validatorsForFieldConfig({
      messages: {
        pattern: DEFAULT_LAT_LNG_TEXT_FIELD_PATTERN_MESSAGE
      }
    })
  };

  return fieldConfig;
}
