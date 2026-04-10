import { describe, it, expect } from 'vitest';
import { forgeTimeDurationField, FORGE_TIMEDURATION_FIELD_TYPE } from './duration.field';

// MARK: forgeTimeDurationField
describe('forgeTimeDurationField()', () => {
  it('should create a field with the correct type', () => {
    const field = forgeTimeDurationField({ key: 'timeout' });
    expect(field.type).toBe(FORGE_TIMEDURATION_FIELD_TYPE);
  });

  it('should set the key from config', () => {
    const field = forgeTimeDurationField({ key: 'duration' });
    expect(field.key).toBe('duration');
  });

  it('should set label when provided', () => {
    const field = forgeTimeDurationField({ key: 'timeout', label: 'Timeout' });
    expect(field.label).toBe('Timeout');
  });

  it('should default label to empty string when not provided', () => {
    const field = forgeTimeDurationField({ key: 'timeout' });
    expect(field.label).toBe('');
  });

  it('should set required when specified', () => {
    const field = forgeTimeDurationField({ key: 'timeout', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = forgeTimeDurationField({ key: 'timeout', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map description to hint in props', () => {
    const field = forgeTimeDurationField({ key: 'timeout', description: 'Enter a duration' });
    expect(field.props?.hint).toBe('Enter a duration');
  });

  it('should pass outputUnit through props', () => {
    const field = forgeTimeDurationField({ key: 'timeout', outputUnit: 'min' });
    expect(field.props?.outputUnit).toBe('min');
  });

  it('should pass valueMode through props', () => {
    const field = forgeTimeDurationField({ key: 'timeout', valueMode: 'number' });
    expect(field.props?.valueMode).toBe('number');
  });

  it('should pass allowedUnits through props', () => {
    const units = ['h', 'min', 's'] as const;
    const field = forgeTimeDurationField({ key: 'timeout', allowedUnits: [...units] });
    expect(field.props?.allowedUnits).toEqual([...units]);
  });

  it('should pass min and max through props', () => {
    const field = forgeTimeDurationField({ key: 'timeout', min: 0, max: 480 });
    expect(field.props?.min).toBe(0);
    expect(field.props?.max).toBe(480);
  });

  it('should pass carryOver through props', () => {
    const field = forgeTimeDurationField({ key: 'timeout', carryOver: true });
    expect(field.props?.carryOver).toBe(true);
  });

  it('should not include props when no extra config is provided', () => {
    const field = forgeTimeDurationField({ key: 'timeout' });
    expect(field.props).toBeUndefined();
  });
});
