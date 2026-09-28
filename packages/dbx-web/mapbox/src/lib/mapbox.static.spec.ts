import { describe, expect, it } from 'vitest';
import { mapboxStaticImageUrl } from './mapbox.static';

describe('mapboxStaticImageUrl()', () => {
  it('should create a retina satellite image url without the logo or attribution by default', () => {
    const url = mapboxStaticImageUrl({ latLng: { lat: 30.2747, lng: -97.7404 }, zoom: 16.5, width: 640, height: 300, accessToken: 'pk.test' });
    expect(url).toBe('https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/-97.7404,30.2747,16.5,0,0/640x300@2x?attribution=false&logo=false&access_token=pk.test');
  });

  it('should accept a style url', () => {
    const url = mapboxStaticImageUrl({ latLng: [30.2747, -97.7404], zoom: 12, width: 300, height: 200, accessToken: 'pk.test', style: 'mapbox://styles/mapbox/streets-v12', retina: false });
    expect(url.startsWith('https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/-97.7404,30.2747,12,0,0/300x200?')).toBe(true);
  });

  it('should accept a username/style_id style', () => {
    const url = mapboxStaticImageUrl({ latLng: [30.2747, -97.7404], zoom: 12, width: 300, height: 200, accessToken: 'pk.test', style: 'someuser/somestyle' });
    expect(url.startsWith('https://api.mapbox.com/styles/v1/someuser/somestyle/static/')).toBe(true);
  });

  it('should include the bearing and pitch', () => {
    const url = mapboxStaticImageUrl({ latLng: [30.2747, -97.7404], zoom: 12, width: 300, height: 200, accessToken: 'pk.test', bearing: 45, pitch: 30 });
    expect(url).toContain('/-97.7404,30.2747,12,45,30/');
  });
});
