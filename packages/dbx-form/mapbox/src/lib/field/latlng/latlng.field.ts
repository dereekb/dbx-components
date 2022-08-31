import { DEFAULT_LAT_LNG_TEXT_FIELD_PATTERN_MESSAGE, DEFAULT_LAT_LNG_TEXT_FIELD_PLACEHOLDER, DescriptionFieldConfig, FieldConfig, formlyField, LabeledFieldConfig, propsForFieldConfig, styleWrapper, validatorsForFieldConfig } from '@dereekb/dbx-form';
import { LAT_LNG_PATTERN } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxFormMapboxLatLngComponentFieldProps } from './latlng.field.component';

export interface MapboxLatLngFieldConfig extends Omit<LabeledFieldConfig, 'key'>, DescriptionFieldConfig, Partial<FieldConfig>, Pick<DbxFormMapboxLatLngComponentFieldProps, 'showMap' | 'zoom' | 'latLngConfig' | 'recenterTime'> {}

export function mapboxLatLngField(config: MapboxLatLngFieldConfig = {}): FormlyFieldConfig {
  const { key = 'latLng', latLngConfig, showMap, zoom, recenterTime } = config;
  const fieldConfig: FormlyFieldConfig = {
    ...formlyField({
      key,
      type: 'mapbox-latlng-picker',
      ...propsForFieldConfig(config, {
        label: config.label ?? 'Location',
        placeholder: DEFAULT_LAT_LNG_TEXT_FIELD_PLACEHOLDER,
        pattern: LAT_LNG_PATTERN,
        autocomplete: false,
        showMap,
        zoom,
        latLngConfig,
        recenterTime
      })
    }),
    ...validatorsForFieldConfig({
      messages: {
        pattern: DEFAULT_LAT_LNG_TEXT_FIELD_PATTERN_MESSAGE
      }
    })
  };

  return styleWrapper(fieldConfig, {
    classGetter: 'dbx-mat-form-field-disable-underline'
  });
}
