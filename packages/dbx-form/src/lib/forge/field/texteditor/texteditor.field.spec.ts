import { describe, it, expect, expectTypeOf } from 'vitest';
import { dbxForgeTextEditorField } from './texteditor.field';
import type { DbxForgeTextEditorFieldConfig } from './texteditor.field';
import type { LogicConfig } from '@ng-forge/dynamic-forms';

// ============================================================================
// DbxForgeTextEditorFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeTextEditorFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgeTextEditorFieldDef>
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
    | 'wrappers'
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
    | 'nullable'
    // Phantom brand
    | '__fieldDef';

  type ActualKeys = keyof DbxForgeTextEditorFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });
});

// MARK: dbxForgeTextEditorField
describe('dbxForgeTextEditorField()', () => {
  it('should create a field with the correct type', () => {
    const field = dbxForgeTextEditorField({ key: 'bio' });
    expect(field.type).toBe('dbx-texteditor');
  });

  it('should set the key from config', () => {
    const field = dbxForgeTextEditorField({ key: 'content' });
    expect(field.key).toBe('content');
  });

  it('should set label when provided', () => {
    const field = dbxForgeTextEditorField({ key: 'bio', label: 'Biography' });
    expect(field.label).toBe('Biography');
  });

  it('should set required when specified', () => {
    const field = dbxForgeTextEditorField({ key: 'bio', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeTextEditorField({ key: 'bio', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map description to hint in props', () => {
    const field = dbxForgeTextEditorField({ key: 'bio', description: 'Write your bio' });
    expect(field.props?.hint).toBe('Write your bio');
  });

  it('should pass minLength through props', () => {
    const field = dbxForgeTextEditorField({ key: 'bio', minLength: 10 });
    expect(field.props?.minLength).toBe(10);
  });

  it('should pass maxLength through props', () => {
    const field = dbxForgeTextEditorField({ key: 'bio', maxLength: 2000 });
    expect(field.props?.maxLength).toBe(2000);
  });

  it('should set minLength on the field', () => {
    const field = dbxForgeTextEditorField({ key: 'bio', minLength: 10 });
    expect(field.minLength).toBe(10);
  });

  it('should set maxLength on the field', () => {
    const field = dbxForgeTextEditorField({ key: 'bio', maxLength: 2000 });
    expect(field.maxLength).toBe(2000);
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeTextEditorField({ key: 'bio', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
