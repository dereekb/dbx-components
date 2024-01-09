import { DEFAULT_LAT_LNG_TEXT_FIELD_PATTERN_MESSAGE, DEFAULT_LAT_LNG_TEXT_FIELD_PLACEHOLDER, DescriptionFieldConfig, FieldConfig, formlyField, LabeledFieldConfig, propsAndConfigForFieldConfig, validatorsForFieldConfig } from '@dereekb/dbx-form';
import { LAT_LNG_PATTERN } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxFormMapboxLatLngComponentFieldProps } from './latlng.field.component';

export interface MapboxLatLngFieldConfig extends Omit<LabeledFieldConfig, 'key'>, DescriptionFieldConfig, Partial<FieldConfig>, Pick<DbxFormMapboxLatLngComponentFieldProps, 'showMap' | 'zoom' | 'latLngConfig' | 'recenterTime' | 'setCenterOnLocationSet' | 'showCenterButton' | 'selectLocationOnMapDrag' | 'selectLocationOnMapClick' | 'markerConfig'> {}

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
