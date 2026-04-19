import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import type { LogicConfig } from '@ng-forge/dynamic-forms';
import type { DbxForgeToggleFieldConfig, DbxForgeCheckboxFieldConfig } from './boolean.field';
import { dbxForgeToggleField, dbxForgeCheckboxField, FORGE_STYLED_BOX_CLASS } from './boolean.field';

// ============================================================================
// DbxForgeToggleFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeToggleFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<MatToggleField>
    | 'key'
    | 'label'
    | 'placeholder'
    | 'value'
    | 'required'
    | 'readonly'
    | 'disabled'
    | 'hidden'
    | 'className'
    | 'meta'
    | 'logic'
    | 'props'
    | 'hint'
    | 'description'
    | 'pattern'
    | 'minLength'
    | 'maxLength'
    | 'min'
    | 'max'
    | 'email'
    | 'validators'
    | 'validationMessages'
    | 'derivation'
    | 'schemas'
    | 'col'
    | 'tabIndex'
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    | '__fieldDef'
    // Field-specific config
    | 'styledBox';

  type ActualKeys = keyof DbxForgeToggleFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });
});

// ============================================================================
// DbxForgeCheckboxFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeCheckboxFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<MatCheckboxField>
    | 'key'
    | 'label'
    | 'placeholder'
    | 'value'
    | 'required'
    | 'readonly'
    | 'disabled'
    | 'hidden'
    | 'className'
    | 'meta'
    | 'logic'
    | 'props'
    | 'hint'
    | 'description'
    | 'pattern'
    | 'minLength'
    | 'maxLength'
    | 'min'
    | 'max'
    | 'email'
    | 'validators'
    | 'validationMessages'
    | 'derivation'
    | 'schemas'
    | 'col'
    | 'tabIndex'
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    | '__fieldDef'
    // Field-specific config
    | 'styledBox';

  type ActualKeys = keyof DbxForgeCheckboxFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeToggleField()
// ============================================================================

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
