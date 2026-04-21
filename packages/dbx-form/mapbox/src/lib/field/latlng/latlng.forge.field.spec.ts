import { describe, it, expect } from 'vitest';
import { dbxForgeMapboxLatLngField, FORGE_MAPBOX_LATLNG_FIELD_TYPE } from './latlng.forge.field';

describe('dbxForgeMapboxLatLngField()', () => {
  it('should create a lat/lng field with correct type', () => {
    const field = dbxForgeMapboxLatLngField();
    expect(field.type).toBe(FORGE_MAPBOX_LATLNG_FIELD_TYPE);
    expect(field.type).toBe('dbx-forge-mapbox-latlng');
  });

  it('should default key to latLng', () => {
    const field = dbxForgeMapboxLatLngField();
    expect(field.key).toBe('latLng');
  });

  it('should default label to Location', () => {
    const field = dbxForgeMapboxLatLngField();
    expect(field.label).toBe('Location');
  });

  it('should use custom key when specified', () => {
    const field = dbxForgeMapboxLatLngField({ key: 'position' });
    expect(field.key).toBe('position');
  });

  it('should use custom label when specified', () => {
    const field = dbxForgeMapboxLatLngField({ label: 'Address Location' });
    expect(field.label).toBe('Address Location');
  });

  it('should set required when specified', () => {
    const field = dbxForgeMapboxLatLngField({ required: true });
    expect(field.required).toBe(true);
  });

  it('should not include required when not specified', () => {
    const field = dbxForgeMapboxLatLngField();
    expect(field.required).toBeUndefined();
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeMapboxLatLngField({ readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should not include readonly when not specified', () => {
    const field = dbxForgeMapboxLatLngField();
    expect(field.readonly).toBeUndefined();
  });

  describe('props', () => {
    it('should pass showMap in props', () => {
      const field = dbxForgeMapboxLatLngField({ showMap: true });
      expect(field.props?.showMap).toBe(true);
    });

    it('should pass zoom in props', () => {
      const field = dbxForgeMapboxLatLngField({ zoom: 12 });
      expect(field.props?.zoom).toBe(12);
    });

    it('should pass recenterTime in props', () => {
      const field = dbxForgeMapboxLatLngField({ recenterTime: 500 });
      expect(field.props?.recenterTime).toBe(500);
    });

    it('should pass description in props', () => {
      const field = dbxForgeMapboxLatLngField({ description: 'Pick a location' });
      expect(field.props?.description).toBe('Pick a location');
    });

    it('should pass label in props', () => {
      const field = dbxForgeMapboxLatLngField({ label: 'Custom Location' });
      expect(field.props?.label).toBe('Custom Location');
    });

    it('should include default props when no extra config is provided', () => {
      const field = dbxForgeMapboxLatLngField();
      expect(field.props).toBeDefined();
      expect(field.props?.label).toBe('Location');
      expect(field.props?.placeholder).toBeDefined();
      expect(field.props?.pattern).toBeDefined();
      expect(field.props?.patternMessage).toBeDefined();
    });
  });
});
