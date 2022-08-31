import { DEFAULT_LAT_LNG_TEXT_FIELD_PATTERN_MESSAGE, DEFAULT_LAT_LNG_TEXT_FIELD_PLACEHOLDER, DescriptionFieldConfig, FieldConfig, formlyField, LabeledFieldConfig, propsForFieldConfig, styleWrapper, validatorsForFieldConfig } from '@dereekb/dbx-form';
import { MAPBOX_MAX_ZOOM_LEVEL } from '@dereekb/dbx-web/mapbox';
import { LAT_LNG_PATTERN } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxFormMapboxZoomComponentFieldProps } from './zoom.field.component';

export interface MapboxZoomFieldConfig extends Omit<LabeledFieldConfig, 'key'>, DescriptionFieldConfig, Partial<FieldConfig>, Pick<DbxFormMapboxZoomComponentFieldProps, 'showMap' | 'center' | 'minZoom' | 'maxZoom' | 'zoomStep'> {}

export function mapboxZoomField(config: MapboxZoomFieldConfig = {}): FormlyFieldConfig {
  const { key = 'zoom', showMap, center, minZoom, maxZoom, zoomStep } = config;
  const fieldConfig: FormlyFieldConfig = {
    ...formlyField({
      key,
      type: 'mapbox-zoom-picker',
      ...propsForFieldConfig(config, {
        label: config.label ?? 'Zoom',
        autocomplete: false,
        showMap,
        center,
        minZoom,
        maxZoom,
        zoomStep
      })
    })
  };

  return styleWrapper(fieldConfig, {
    classGetter: 'dbx-mat-form-field-disable-underline'
  });
}
