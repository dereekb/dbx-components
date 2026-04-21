import { describe, it, expect } from 'vitest';
import { dbxForgeMapboxZoomField, FORGE_MAPBOX_ZOOM_FIELD_TYPE } from './zoom.forge.field';

describe('dbxForgeMapboxZoomField()', () => {
  it('should create a zoom field with correct type', () => {
    const field = dbxForgeMapboxZoomField();
    expect(field.type).toBe(FORGE_MAPBOX_ZOOM_FIELD_TYPE);
    expect(field.type).toBe('dbx-forge-mapbox-zoom');
  });

  it('should default key to zoom', () => {
    const field = dbxForgeMapboxZoomField();
    expect(field.key).toBe('zoom');
  });

  it('should default label to Zoom', () => {
    const field = dbxForgeMapboxZoomField();
    expect(field.label).toBe('Zoom');
  });

  it('should use custom key when specified', () => {
    const field = dbxForgeMapboxZoomField({ key: 'mapZoom' });
    expect(field.key).toBe('mapZoom');
  });

  it('should use custom label when specified', () => {
    const field = dbxForgeMapboxZoomField({ label: 'Map Zoom Level' });
    expect(field.label).toBe('Map Zoom Level');
  });

  it('should set required when specified', () => {
    const field = dbxForgeMapboxZoomField({ required: true });
    expect(field.required).toBe(true);
  });

  it('should not include required when not specified', () => {
    const field = dbxForgeMapboxZoomField();
    expect(field.required).toBeUndefined();
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeMapboxZoomField({ readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should not include readonly when not specified', () => {
    const field = dbxForgeMapboxZoomField();
    expect(field.readonly).toBeUndefined();
  });

  describe('props', () => {
    it('should pass showMap in props', () => {
      const field = dbxForgeMapboxZoomField({ showMap: true });
      expect(field.props?.showMap).toBe(true);
    });

    it('should pass center in props', () => {
      const center = { lat: 40.7128, lng: -74.006 };
      const field = dbxForgeMapboxZoomField({ center });
      expect(field.props?.center).toEqual(center);
    });

    it('should pass minZoom in props', () => {
      const field = dbxForgeMapboxZoomField({ minZoom: 2 });
      expect(field.props?.minZoom).toBe(2);
    });

    it('should pass maxZoom in props', () => {
      const field = dbxForgeMapboxZoomField({ maxZoom: 18 });
      expect(field.props?.maxZoom).toBe(18);
    });

    it('should pass zoomStep in props', () => {
      const field = dbxForgeMapboxZoomField({ zoomStep: 0.5 });
      expect(field.props?.zoomStep).toBe(0.5);
    });

    it('should pass description in props', () => {
      const field = dbxForgeMapboxZoomField({ description: 'Set the zoom level' });
      expect(field.props?.description).toBe('Set the zoom level');
    });

    it('should pass label in props', () => {
      const field = dbxForgeMapboxZoomField({ label: 'Custom Zoom' });
      expect(field.props?.label).toBe('Custom Zoom');
    });

    it('should include default label in props when no extra config is provided', () => {
      const field = dbxForgeMapboxZoomField();
      expect(field.props).toBeDefined();
      expect(field.props?.label).toBe('Zoom');
    });
  });
});
