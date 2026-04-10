import { describe, it, expect } from 'vitest';
import { forgeMapboxZoomField, FORGE_MAPBOX_ZOOM_FIELD_TYPE } from './zoom.forge.field';

describe('forgeMapboxZoomField()', () => {
  it('should create a zoom field with correct type', () => {
    const field = forgeMapboxZoomField();
    expect(field.type).toBe(FORGE_MAPBOX_ZOOM_FIELD_TYPE);
    expect(field.type).toBe('dbx-forge-mapbox-zoom');
  });

  it('should default key to zoom', () => {
    const field = forgeMapboxZoomField();
    expect(field.key).toBe('zoom');
  });

  it('should default label to Zoom', () => {
    const field = forgeMapboxZoomField();
    expect(field.label).toBe('Zoom');
  });

  it('should use custom key when specified', () => {
    const field = forgeMapboxZoomField({ key: 'mapZoom' });
    expect(field.key).toBe('mapZoom');
  });

  it('should use custom label when specified', () => {
    const field = forgeMapboxZoomField({ label: 'Map Zoom Level' });
    expect(field.label).toBe('Map Zoom Level');
  });

  it('should set required when specified', () => {
    const field = forgeMapboxZoomField({ required: true });
    expect(field.required).toBe(true);
  });

  it('should not include required when not specified', () => {
    const field = forgeMapboxZoomField();
    expect(field.required).toBeUndefined();
  });

  it('should set readonly when specified', () => {
    const field = forgeMapboxZoomField({ readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should not include readonly when not specified', () => {
    const field = forgeMapboxZoomField();
    expect(field.readonly).toBeUndefined();
  });

  describe('props', () => {
    it('should pass showMap in props', () => {
      const field = forgeMapboxZoomField({ showMap: true });
      expect(field.props?.showMap).toBe(true);
    });

    it('should pass center in props', () => {
      const center = { lat: 40.7128, lng: -74.006 };
      const field = forgeMapboxZoomField({ center });
      expect(field.props?.center).toEqual(center);
    });

    it('should pass minZoom in props', () => {
      const field = forgeMapboxZoomField({ minZoom: 2 });
      expect(field.props?.minZoom).toBe(2);
    });

    it('should pass maxZoom in props', () => {
      const field = forgeMapboxZoomField({ maxZoom: 18 });
      expect(field.props?.maxZoom).toBe(18);
    });

    it('should pass zoomStep in props', () => {
      const field = forgeMapboxZoomField({ zoomStep: 0.5 });
      expect(field.props?.zoomStep).toBe(0.5);
    });

    it('should pass description in props', () => {
      const field = forgeMapboxZoomField({ description: 'Set the zoom level' });
      expect(field.props?.description).toBe('Set the zoom level');
    });

    it('should pass label in props', () => {
      const field = forgeMapboxZoomField({ label: 'Custom Zoom' });
      expect(field.props?.label).toBe('Custom Zoom');
    });

    it('should include default label in props when no extra config is provided', () => {
      const field = forgeMapboxZoomField();
      expect(field.props).toBeDefined();
      expect(field.props?.label).toBe('Zoom');
    });
  });
});
