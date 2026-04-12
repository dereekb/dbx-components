import { describe, it, expect } from 'vitest';
import type { LogicConfig } from '@ng-forge/dynamic-forms';
import { forgeToggleField, forgeCheckboxField } from './boolean.field';
import { FORGE_STYLED_BOX_CLASS } from '../../field.util.meta';

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

  it('should set description as hint in props', () => {
    const field = forgeToggleField({ key: 'active', description: 'A hint' });
    expect(field.props?.hint).toBe('A hint');
  });

  it('should apply styled box className by default', () => {
    const field = forgeToggleField({ key: 'active' });
    expect(field.className).toBe(FORGE_STYLED_BOX_CLASS);
  });

  it('should not apply styled box className when styledBox is false', () => {
    const field = forgeToggleField({ key: 'active', styledBox: false });
    expect(field.className).toBeUndefined();
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = forgeToggleField({ key: 'active', logic });
    expect((field as any).logic).toEqual(logic);
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

  it('should set description as hint in props', () => {
    const field = forgeCheckboxField({ key: 'agree', description: 'A hint' });
    expect(field.props?.hint).toBe('A hint');
  });

  it('should apply styled box className by default', () => {
    const field = forgeCheckboxField({ key: 'agree' });
    expect(field.className).toBe(FORGE_STYLED_BOX_CLASS);
  });

  it('should not apply styled box className when styledBox is false', () => {
    const field = forgeCheckboxField({ key: 'agree', styledBox: false });
    expect(field.className).toBeUndefined();
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = forgeCheckboxField({ key: 'agree', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
