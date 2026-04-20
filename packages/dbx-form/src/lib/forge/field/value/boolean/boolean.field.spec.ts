import { describe, it, expect } from 'vitest';
import type { LogicConfig } from '@ng-forge/dynamic-forms';
import { dbxForgeToggleField, dbxForgeCheckboxField, FORGE_STYLED_BOX_CLASS } from './boolean.field';

describe('dbxForgeToggleField()', () => {
  it('should create a toggle field with correct type', () => {
    const field = dbxForgeToggleField({ key: 'active', label: 'Active' });
    expect(field.type).toBe('toggle');
    expect(field.key).toBe('active');
    expect(field.label).toBe('Active');
  });

  it('should set required when specified', () => {
    const field = dbxForgeToggleField({ key: 'active', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeToggleField({ key: 'active', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should set description as hint in props', () => {
    const field = dbxForgeToggleField({ key: 'active', description: 'A hint' });
    expect(field.props?.hint).toBe('A hint');
  });

  it('should apply styled box className by default', () => {
    const field = dbxForgeToggleField({ key: 'active' });
    expect(field.className).toBe(FORGE_STYLED_BOX_CLASS);
  });

  it('should not apply styled box className when styledBox is false', () => {
    const field = dbxForgeToggleField({ key: 'active', styledBox: false });
    expect(field.className).toBeUndefined();
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeToggleField({ key: 'active', logic });
    expect((field as any).logic).toEqual(logic);
  });
});

describe('dbxForgeCheckboxField()', () => {
  it('should create a checkbox field with correct type', () => {
    const field = dbxForgeCheckboxField({ key: 'agree', label: 'I agree' });
    expect(field.type).toBe('checkbox');
    expect(field.key).toBe('agree');
    expect(field.label).toBe('I agree');
  });

  it('should set required when specified', () => {
    const field = dbxForgeCheckboxField({ key: 'agree', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeCheckboxField({ key: 'agree', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should set description as hint in props', () => {
    const field = dbxForgeCheckboxField({ key: 'agree', description: 'A hint' });
    expect(field.props?.hint).toBe('A hint');
  });

  it('should apply styled box className by default', () => {
    const field = dbxForgeCheckboxField({ key: 'agree' });
    expect(field.className).toBe(FORGE_STYLED_BOX_CLASS);
  });

  it('should not apply styled box className when styledBox is false', () => {
    const field = dbxForgeCheckboxField({ key: 'agree', styledBox: false });
    expect(field.className).toBeUndefined();
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeCheckboxField({ key: 'agree', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
