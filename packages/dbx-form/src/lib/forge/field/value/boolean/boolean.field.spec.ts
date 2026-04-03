import { describe, it, expect } from 'vitest';
import { forgeToggleField, forgeCheckboxField } from './boolean.field';

describe('forgeToggleField()', () => {
  it('should create a toggle field with correct type', () => {
    const field = forgeToggleField({ key: 'active', label: 'Active' });
    expect(field.type).toBe('toggle');
    expect(field.key).toBe('active');
    expect(field.label).toBe('Active');
  });

  it('should default value to false', () => {
    const field = forgeToggleField({ key: 'active' });
    expect(field.value).toBe(false);
  });

  it('should use defaultValue when provided', () => {
    const field = forgeToggleField({ key: 'active', defaultValue: true });
    expect(field.value).toBe(true);
  });

  it('should set required when specified', () => {
    const field = forgeToggleField({ key: 'active', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = forgeToggleField({ key: 'active', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should provide empty label when not specified', () => {
    const field = forgeToggleField({ key: 'active' });
    expect(field.label).toBe('');
  });
});

describe('forgeCheckboxField()', () => {
  it('should create a checkbox field with correct type', () => {
    const field = forgeCheckboxField({ key: 'agree', label: 'I agree' });
    expect(field.type).toBe('checkbox');
    expect(field.key).toBe('agree');
    expect(field.label).toBe('I agree');
  });

  it('should default value to false', () => {
    const field = forgeCheckboxField({ key: 'agree' });
    expect(field.value).toBe(false);
  });

  it('should use defaultValue when provided', () => {
    const field = forgeCheckboxField({ key: 'agree', defaultValue: true });
    expect(field.value).toBe(true);
  });

  it('should set required when specified', () => {
    const field = forgeCheckboxField({ key: 'agree', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = forgeCheckboxField({ key: 'agree', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should provide empty label when not specified', () => {
    const field = forgeCheckboxField({ key: 'agree' });
    expect(field.label).toBe('');
  });
});
