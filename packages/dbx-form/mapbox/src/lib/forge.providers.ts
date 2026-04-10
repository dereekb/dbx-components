import { type FieldTypeDefinition, provideDynamicForm } from '@ng-forge/dynamic-forms';
import { FORGE_MAPBOX_LATLNG_FIELD_TYPE } from './field/latlng/latlng.forge.field';
import { mapboxLatLngFieldMapper } from './field/latlng/latlng.forge.field.component';
import { FORGE_MAPBOX_ZOOM_FIELD_TYPE } from './field/zoom/zoom.forge.field';
import { mapboxZoomFieldMapper } from './field/zoom/zoom.forge.field.component';

/**
 * Forge mapbox lat/lng field type definition.
 */
const DbxForgeMapboxLatLngFieldType: FieldTypeDefinition = {
  name: FORGE_MAPBOX_LATLNG_FIELD_TYPE,
  loadComponent: () => import('./field/latlng/latlng.forge.field.component').then((m) => m.DbxForgeMapboxLatLngFieldComponent),
  mapper: mapboxLatLngFieldMapper
};

/**
 * Forge mapbox zoom field type definition.
 */
const DbxForgeMapboxZoomFieldType: FieldTypeDefinition = {
  name: FORGE_MAPBOX_ZOOM_FIELD_TYPE,
  loadComponent: () => import('./field/zoom/zoom.forge.field.component').then((m) => m.DbxForgeMapboxZoomFieldComponent),
  mapper: mapboxZoomFieldMapper
};

/**
 * All custom dbx-form/mapbox forge field type definitions.
 */
export const DBX_FORGE_MAPBOX_FIELD_TYPES: FieldTypeDefinition[] = [DbxForgeMapboxLatLngFieldType, DbxForgeMapboxZoomFieldType];

/**
 * Registers ng-forge dynamic form field declarations for the mapbox package.
 *
 * Add this to your app's providers alongside provideDbxForgeFormFieldDeclarations().
 */
export function provideDbxForgeMapboxFieldDeclarations() {
  return provideDynamicForm(...DBX_FORGE_MAPBOX_FIELD_TYPES);
}
