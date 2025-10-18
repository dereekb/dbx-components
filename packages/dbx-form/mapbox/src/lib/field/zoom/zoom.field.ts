import { type DescriptionFieldConfig, type FieldConfig, formlyField, type LabeledFieldConfig, propsAndConfigForFieldConfig } from '@dereekb/dbx-form';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type DbxFormMapboxZoomComponentFieldProps } from './zoom.field.component';

export interface MapboxZoomFieldConfig extends Omit<LabeledFieldConfig, 'key'>, DescriptionFieldConfig, Partial<FieldConfig>, Pick<DbxFormMapboxZoomComponentFieldProps, 'showMap' | 'center' | 'minZoom' | 'maxZoom' | 'zoomStep'> {}

export function mapboxZoomField(config: MapboxZoomFieldConfig = {}): FormlyFieldConfig {
  const { key = 'zoom', showMap, center, minZoom, maxZoom, zoomStep } = config;

  const classGetter = 'dbx-mat-form-field-disable-underline';
  const fieldConfig: FormlyFieldConfig = {
    ...formlyField({
      key,
      type: 'mapbox-zoom-picker',
      ...propsAndConfigForFieldConfig(config, {
        classGetter,
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

  return fieldConfig;
}
