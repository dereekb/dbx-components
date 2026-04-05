import { describe, it, expect } from 'vitest';
import { forgeTimezoneStringField } from './timezone';

describe('forgeTimezoneStringField()', () => {
  it('should create a searchable text field with type dbx-searchable-text', () => {
    const field = forgeTimezoneStringField();
    expect(field.type).toBe('dbx-searchable-text');
  });

  it('should default to key "timezone"', () => {
    const field = forgeTimezoneStringField();
    expect(field.key).toBe('timezone');
  });

  it('should default to label "Timezone"', () => {
    const field = forgeTimezoneStringField();
    expect(field.label).toBe('Timezone');
  });

  it('should allow overriding key', () => {
    const field = forgeTimezoneStringField({ key: 'tz' });
    expect(field.key).toBe('tz');
  });

  it('should allow overriding label', () => {
    const field = forgeTimezoneStringField({ label: 'Select Timezone' });
    expect(field.label).toBe('Select Timezone');
  });

  it('should set required when specified', () => {
    const field = forgeTimezoneStringField({ required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = forgeTimezoneStringField({ readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should configure search and display props', () => {
    const field = forgeTimezoneStringField();
    expect(field.props).toBeDefined();
    expect(field.props?.search).toBeDefined();
    expect(field.props?.displayForValue).toBeDefined();
    expect(field.props?.searchOnEmptyText).toBe(true);
    expect(field.props?.allowStringValues).toBe(false);
    expect(field.props?.showClearValue).toBe(true);
  });

  it('should work with no arguments', () => {
    expect(() => forgeTimezoneStringField()).not.toThrow();
  });

  it('should work with empty config', () => {
    expect(() => forgeTimezoneStringField({})).not.toThrow();
  });
});
