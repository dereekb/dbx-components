import { describe, it, expect } from 'vitest';
import { forgeValueSelectionField } from './selection.field';

describe('forgeValueSelectionField()', () => {
  const testOptions = [
    { label: 'Red', value: 'red' },
    { label: 'Blue', value: 'blue' },
    { label: 'Green', value: 'green' }
  ];

  it('should create a select field with correct type', () => {
    const field = forgeValueSelectionField({ key: 'color', label: 'Color', options: testOptions });
    expect(field.type).toBe('select');
    expect(field.key).toBe('color');
    expect(field.label).toBe('Color');
  });

  it('should set options on the field', () => {
    const field = forgeValueSelectionField({ key: 'color', options: testOptions });
    expect(field.options).toEqual(testOptions);
  });

  it('should set required when specified', () => {
    const field = forgeValueSelectionField({ key: 'color', options: testOptions, required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = forgeValueSelectionField({ key: 'color', options: testOptions, readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should set multiple flag in props', () => {
    const field = forgeValueSelectionField({ key: 'colors', options: testOptions, multiple: true });
    expect(field.props?.multiple).toBe(true);
  });

  it('should not include multiple in props when not specified', () => {
    const field = forgeValueSelectionField({ key: 'color', options: testOptions });
    expect(field.props?.multiple).toBeUndefined();
  });

  it('should map description to hint in props', () => {
    const field = forgeValueSelectionField({ key: 'color', options: testOptions, description: 'Choose a color' });
    expect(field.props?.hint).toBe('Choose a color');
  });

  it('should not include props when no description or multiple is set', () => {
    const field = forgeValueSelectionField({ key: 'color', options: testOptions });
    expect(field.props).toBeUndefined();
  });

  it('should use defaultValue when provided', () => {
    const field = forgeValueSelectionField({ key: 'color', options: testOptions, defaultValue: 'blue' });
    expect(field.value).toBe('blue');
  });

  it('should not include value when defaultValue is not provided', () => {
    const field = forgeValueSelectionField({ key: 'color', options: testOptions });
    expect(field.value).toBeUndefined();
  });

  it('should provide empty label when not specified', () => {
    const field = forgeValueSelectionField({ key: 'color', options: testOptions });
    expect(field.label).toBe('');
  });

  it('should work with numeric option values', () => {
    const numOptions = [
      { label: 'One', value: 1 },
      { label: 'Two', value: 2 }
    ];
    const field = forgeValueSelectionField({ key: 'num', options: numOptions, defaultValue: 1 });
    expect(field.value).toBe(1);
    expect(field.options).toEqual(numOptions);
  });
});
