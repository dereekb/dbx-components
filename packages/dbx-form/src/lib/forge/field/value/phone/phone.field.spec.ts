import { describe, it, expect } from 'vitest';
import type { LogicConfig } from '@ng-forge/dynamic-forms';
import { forgePhoneField } from './phone.field';

// ============================================================================
// Runtime Factory Tests - forgePhoneField()
// ============================================================================

describe('forgePhoneField()', () => {
  it('should create a field with type phone', () => {
    const field = forgePhoneField({ key: 'phone' });
    expect(field.type).toBe('phone');
  });

  it('should set the key from config', () => {
    const field = forgePhoneField({ key: 'myPhone' });
    expect(field.key).toBe('myPhone');
  });

  it('should use a custom label when provided', () => {
    const field = forgePhoneField({ key: 'phone', label: 'Work Phone' });
    expect(field.label).toBe('Work Phone');
  });

  it('should set required when provided', () => {
    const field = forgePhoneField({ key: 'phone', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when provided', () => {
    const field = forgePhoneField({ key: 'phone', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should set preferredCountries in props', () => {
    const field = forgePhoneField({ key: 'phone', preferredCountries: ['us', 'ca'] });
    expect(field.props?.preferredCountries).toEqual(['us', 'ca']);
  });

  it('should set onlyCountries in props', () => {
    const field = forgePhoneField({ key: 'phone', onlyCountries: ['us'] });
    expect(field.props?.onlyCountries).toEqual(['us']);
  });

  it('should set enableSearch in props', () => {
    const field = forgePhoneField({ key: 'phone', enableSearch: false });
    expect(field.props?.enableSearch).toBe(false);
  });

  it('should set allowExtension in props', () => {
    const field = forgePhoneField({ key: 'phone', allowExtension: true });
    expect(field.props?.allowExtension).toBe(true);
  });

  it('should set description as hint in props', () => {
    const field = forgePhoneField({ key: 'phone', description: 'Enter your phone' });
    expect(field.props?.hint).toBe('Enter your phone');
  });

  it('should combine multiple props', () => {
    const field = forgePhoneField({
      key: 'phone',
      preferredCountries: ['us'],
      enableSearch: true,
      allowExtension: true,
      description: 'Phone number'
    });
    expect(field.props?.preferredCountries).toEqual(['us']);
    expect(field.props?.enableSearch).toBe(true);
    expect(field.props?.allowExtension).toBe(true);
    expect(field.props?.hint).toBe('Phone number');
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = forgePhoneField({ key: 'phone', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
