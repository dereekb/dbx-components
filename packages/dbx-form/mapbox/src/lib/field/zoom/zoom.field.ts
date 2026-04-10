import { type DescriptionFieldConfig, type FieldConfig, formlyField, type LabeledFieldConfig, propsAndConfigForFieldConfig } from '@dereekb/dbx-form';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type DbxFormMapboxZoomComponentFieldProps } from './zoom.field.component';

/**
 * @deprecated Use DbxForgeMapboxZoomFieldConfig instead.
 */
export interface MapboxZoomFieldConfig extends Omit<LabeledFieldConfig, 'key'>, DescriptionFieldConfig, Partial<FieldConfig>, Pick<DbxFormMapboxZoomComponentFieldProps, 'showMap' | 'center' | 'minZoom' | 'maxZoom' | 'zoomStep'> {}

/**
 * Creates a Formly field configuration for a Mapbox-powered zoom level picker with optional map preview.
 *
 * @deprecated Use forgeMapboxZoomField() from the forge API instead.
 * @param config - Optional field configuration overrides
 * @returns A validated Formly field configuration for the Mapbox zoom picker
 */
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
