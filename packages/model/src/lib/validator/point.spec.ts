import { type } from 'arktype';
import { latLngPointType, latLngStringType } from './point';

describe('latLngPointType', () => {
  it('should pass for a valid point', () => {
    const result = latLngPointType({ lat: 30.5, lng: -96.3 });
    expect(result instanceof type.errors).toBe(false);
  });

  it('should pass for the origin (0, 0)', () => {
    const result = latLngPointType({ lat: 0, lng: 0 });
    expect(result instanceof type.errors).toBe(false);
  });

  it('should pass for boundary values', () => {
    expect(latLngPointType({ lat: 90, lng: 180 }) instanceof type.errors).toBe(false);
    expect(latLngPointType({ lat: -90, lng: -180 }) instanceof type.errors).toBe(false);
  });

  it('should fail for lat out of range', () => {
    expect(latLngPointType({ lat: 91, lng: 0 }) instanceof type.errors).toBe(true);
    expect(latLngPointType({ lat: -91, lng: 0 }) instanceof type.errors).toBe(true);
  });

  it('should fail for lng out of range', () => {
    expect(latLngPointType({ lat: 0, lng: 181 }) instanceof type.errors).toBe(true);
    expect(latLngPointType({ lat: 0, lng: -181 }) instanceof type.errors).toBe(true);
  });

  it('should fail for missing fields', () => {
    expect(latLngPointType({ lat: 30 }) instanceof type.errors).toBe(true);
    expect(latLngPointType({ lng: -96 }) instanceof type.errors).toBe(true);
  });
});

describe('latLngStringType', () => {
  it('should pass for a valid lat,lng string', () => {
    const result = latLngStringType('30.5,-96.3');
    expect(result instanceof type.errors).toBe(false);
  });

  it('should pass for origin string', () => {
    const result = latLngStringType('0,0');
    expect(result instanceof type.errors).toBe(false);
  });

  it('should pass for boundary values', () => {
    expect(latLngStringType('90,180') instanceof type.errors).toBe(false);
    expect(latLngStringType('-90,-180') instanceof type.errors).toBe(false);
  });

  it('should fail for an empty string', () => {
    expect(latLngStringType('') instanceof type.errors).toBe(true);
  });

  it('should fail for invalid format', () => {
    expect(latLngStringType('not-a-point') instanceof type.errors).toBe(true);
  });

  it('should fail for out-of-range values', () => {
    expect(latLngStringType('91,0') instanceof type.errors).toBe(true);
    expect(latLngStringType('0,181') instanceof type.errors).toBe(true);
  });
});
