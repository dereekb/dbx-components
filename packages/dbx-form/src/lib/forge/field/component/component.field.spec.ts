import { describe, it, expect, expectTypeOf } from 'vitest';
import { dbxForgeComponentField, type DbxForgeComponentFieldConfig } from './component.field';
import type { LogicConfig } from '@ng-forge/dynamic-forms';

// ============================================================================
// DbxForgeComponentFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeComponentFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgeComponentFieldDef> (no hint/description — props lacks hint)
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
    | 'componentField'
    | 'allowDisabledEffects';

  type ActualKeys = keyof DbxForgeComponentFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeComponentField()
// ============================================================================

class MockComponentA {}
class MockComponentB {}

describe('dbxForgeComponentField()', () => {
  it('should create a field with type dbx-component', () => {
    const field = dbxForgeComponentField({
      componentField: { componentClass: MockComponentA }
    });
    expect(field.type).toBe('dbx-component');
  });

  it('should generate a unique key when not specified', () => {
    const fieldA = dbxForgeComponentField({
      componentField: { componentClass: MockComponentA }
    });
    const fieldB = dbxForgeComponentField({
      componentField: { componentClass: MockComponentA }
    });
    expect(fieldA.key).toMatch(/^_component_\d+$/);
    expect(fieldA.key).not.toBe(fieldB.key);
  });

  it('should use provided key', () => {
    const field = dbxForgeComponentField({
      key: 'custom',
      componentField: { componentClass: MockComponentA }
    });
    expect(field.key).toBe('custom');
  });

  it('should set label when specified', () => {
    const field = dbxForgeComponentField({
      label: 'My Component',
      componentField: { componentClass: MockComponentA }
    });
    expect(field.label).toBe('My Component');
  });

  it('should pass componentField through in props', () => {
    const componentField = { componentClass: MockComponentA };
    const field = dbxForgeComponentField({ componentField });
    expect(field.props?.componentField).toBe(componentField);
  });

  it('should pass providers through in componentField props', () => {
    const providers = [{ provide: 'TOKEN', useValue: 'test' }];
    const field = dbxForgeComponentField({
      componentField: { componentClass: MockComponentA, providers }
    });
    expect(field.props?.componentField.providers).toBe(providers);
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeComponentField({ key: 'custom', componentField: { componentClass: class {} as any }, logic });
    expect((field as any).logic).toEqual(logic);
  });

  it('should pass different component classes', () => {
    const fieldA = dbxForgeComponentField({
      componentField: { componentClass: MockComponentA }
    });
    const fieldB = dbxForgeComponentField({
      componentField: { componentClass: MockComponentB }
    });
    expect(fieldA.props?.componentField.componentClass).toBe(MockComponentA);
    expect(fieldB.props?.componentField.componentClass).toBe(MockComponentB);
  });
});
