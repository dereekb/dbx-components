import { DescriptionFieldConfig, FieldConfig, formlyField, LabeledFieldConfig, propsForFieldConfig, styleWrapper } from '@dereekb/dbx-form';
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
