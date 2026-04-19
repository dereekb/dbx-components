import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import type { LogicConfig } from '@ng-forge/dynamic-forms';
import type { DbxForgeTimeDurationFieldConfig } from './duration.field';
import { dbxForgeTimeDurationField, FORGE_TIMEDURATION_FIELD_TYPE } from './duration.field';

// ============================================================================
// DbxForgeTimeDurationFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeTimeDurationFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgeTimeDurationFieldDef>
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
    | 'outputUnit'
    | 'valueMode'
    | 'allowedUnits'
    | 'pickerUnits'
    | 'carryOver';

  type ActualKeys = keyof DbxForgeTimeDurationFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });
});

// MARK: dbxForgeTimeDurationField
describe('dbxForgeTimeDurationField()', () => {
  it('should create a field with the correct type', () => {
    const field = dbxForgeTimeDurationField({ key: 'timeout' });
    expect(field.type).toBe(FORGE_TIMEDURATION_FIELD_TYPE);
  });

  it('should set the key from config', () => {
    const field = dbxForgeTimeDurationField({ key: 'duration' });
    expect(field.key).toBe('duration');
  });

  it('should set label when provided', () => {
    const field = dbxForgeTimeDurationField({ key: 'timeout', label: 'Timeout' });
    expect(field.label).toBe('Timeout');
  });

  it('should set required when specified', () => {
    const field = dbxForgeTimeDurationField({ key: 'timeout', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeTimeDurationField({ key: 'timeout', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map description to hint in props', () => {
    const field = dbxForgeTimeDurationField({ key: 'timeout', description: 'Enter a duration' });
    expect(field.props?.hint).toBe('Enter a duration');
  });

  it('should pass outputUnit through props', () => {
    const field = dbxForgeTimeDurationField({ key: 'timeout', outputUnit: 'min' });
    expect(field.props?.outputUnit).toBe('min');
  });

  it('should pass valueMode through props', () => {
    const field = dbxForgeTimeDurationField({ key: 'timeout', valueMode: 'number' });
    expect(field.props?.valueMode).toBe('number');
  });

  it('should pass allowedUnits through props', () => {
    const units = ['h', 'min', 's'] as const;
    const field = dbxForgeTimeDurationField({ key: 'timeout', allowedUnits: [...units] });
    expect(field.props?.allowedUnits).toEqual([...units]);
  });

  it('should pass min and max through props', () => {
    const field = dbxForgeTimeDurationField({ key: 'timeout', min: 0, max: 480 });
    expect(field.props?.min).toBe(0);
    expect(field.props?.max).toBe(480);
  });

  it('should pass carryOver through props', () => {
    const field = dbxForgeTimeDurationField({ key: 'timeout', carryOver: true });
    expect(field.props?.carryOver).toBe(true);
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeTimeDurationField({ key: 'timeout', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
