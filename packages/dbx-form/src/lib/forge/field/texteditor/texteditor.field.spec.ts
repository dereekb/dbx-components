import { describe, it, expect } from 'vitest';
import { forgeTextEditorField } from './texteditor.field';
import type { LogicConfig } from '@ng-forge/dynamic-forms';

// MARK: forgeTextEditorField
describe('forgeTextEditorField()', () => {
  it('should create a field with the correct type', () => {
    const field = forgeTextEditorField({ key: 'bio' });
    expect(field.type).toBe('dbx-texteditor');
  });

  it('should set the key from config', () => {
    const field = forgeTextEditorField({ key: 'content' });
    expect(field.key).toBe('content');
  });

  it('should set label when provided', () => {
    const field = forgeTextEditorField({ key: 'bio', label: 'Biography' });
    expect(field.label).toBe('Biography');
  });

  it('should default label to empty string when not provided', () => {
    const field = forgeTextEditorField({ key: 'bio' });
    expect(field.label).toBe('');
  });

  it('should default value to empty string', () => {
    const field = forgeTextEditorField({ key: 'bio' });
    expect(field.value).toBe('');
  });

  it('should set required when specified', () => {
    const field = forgeTextEditorField({ key: 'bio', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = forgeTextEditorField({ key: 'bio', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map description to hint in props', () => {
    const field = forgeTextEditorField({ key: 'bio', description: 'Write your bio' });
    expect(field.props?.hint).toBe('Write your bio');
  });

  it('should pass minLength through props', () => {
    const field = forgeTextEditorField({ key: 'bio', minLength: 10 });
    expect(field.props?.minLength).toBe(10);
  });

  it('should pass maxLength through props', () => {
    const field = forgeTextEditorField({ key: 'bio', maxLength: 2000 });
    expect(field.props?.maxLength).toBe(2000);
  });

  it('should set minLength on the field', () => {
    const field = forgeTextEditorField({ key: 'bio', minLength: 10 });
    expect(field.minLength).toBe(10);
  });

  it('should set maxLength on the field', () => {
    const field = forgeTextEditorField({ key: 'bio', maxLength: 2000 });
    expect(field.maxLength).toBe(2000);
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = forgeTextEditorField({ key: 'bio', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
