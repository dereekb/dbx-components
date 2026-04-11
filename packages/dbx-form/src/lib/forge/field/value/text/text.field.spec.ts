import { describe, it, expect } from 'vitest';
import type { LogicConfig } from '@ng-forge/dynamic-forms';
import { forgeTextField, forgeTextAreaField } from './text.field';

describe('forgeTextField()', () => {
  it('should create an input field with correct type', () => {
    const field = forgeTextField({ key: 'name', label: 'Name' });
    expect(field.type).toBe('input');
    expect(field.key).toBe('name');
    expect(field.label).toBe('Name');
  });

  it('should set required when specified', () => {
    const field = forgeTextField({ key: 'name', required: true });
    expect(field.required).toBe(true);
  });

  it('should not include required when not specified', () => {
    const field = forgeTextField({ key: 'name' });
    expect(field.required).toBeUndefined();
  });

  it('should set readonly when specified', () => {
    const field = forgeTextField({ key: 'name', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should set minLength and maxLength', () => {
    const field = forgeTextField({ key: 'name', minLength: 2, maxLength: 50 });
    expect(field.minLength).toBe(2);
    expect(field.maxLength).toBe(50);
  });

  it('should set pattern from string', () => {
    const field = forgeTextField({ key: 'code', pattern: '^[A-Z]+$' });
    expect(field.pattern).toBe('^[A-Z]+$');
  });

  it('should set pattern from RegExp', () => {
    const field = forgeTextField({ key: 'code', pattern: /^[A-Z]+$/ });
    expect(field.pattern).toBe('^[A-Z]+$');
  });

  it('should not include pattern when not specified', () => {
    const field = forgeTextField({ key: 'name' });
    expect(field.pattern).toBeUndefined();
  });

  it('should set inputType in props', () => {
    const field = forgeTextField({ key: 'pass', inputType: 'password' });
    expect(field.props?.type).toBe('password');
  });

  it('should default inputType to text', () => {
    const field = forgeTextField({ key: 'name' });
    expect(field.props?.type).toBe('text');
  });

  it('should map description to hint in props', () => {
    const field = forgeTextField({ key: 'name', description: 'Enter your name' });
    expect(field.props?.hint).toBe('Enter your name');
  });

  it('should set placeholder on field', () => {
    const field = forgeTextField({ key: 'name', placeholder: 'Type here' });
    expect((field as any).placeholder).toBe('Type here');
  });

  it('should provide empty string as default value', () => {
    const field = forgeTextField({ key: 'name' });
    expect(field.value).toBe('');
  });

  it('should use defaultValue when provided', () => {
    const field = forgeTextField({ key: 'name', defaultValue: 'hello' });
    expect(field.value).toBe('hello');
  });

  it('should provide empty label when not specified', () => {
    const field = forgeTextField({ key: 'name' });
    expect(field.label).toBe('');
  });

  describe('validationMessages', () => {
    it('should include validationMessages on the field definition', () => {
      const field = forgeTextField({ key: 'name', label: 'Name' });
      expect(field.validationMessages).toBeDefined();
    });

    it('should include a required validation message', () => {
      const field = forgeTextField({ key: 'name', required: true });
      expect(field.validationMessages?.required).toBeDefined();
    });

    it('should include a minLength validation message', () => {
      const field = forgeTextField({ key: 'name', minLength: 4 });
      expect(field.validationMessages?.minLength).toBeDefined();
    });

    it('should include a maxLength validation message', () => {
      const field = forgeTextField({ key: 'name', maxLength: 15 });
      expect(field.validationMessages?.maxLength).toBeDefined();
    });

    it('should include a pattern validation message', () => {
      const field = forgeTextField({ key: 'name', pattern: '^[A-Z]+$' });
      expect(field.validationMessages?.pattern).toBeDefined();
    });
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = forgeTextField({ key: 'name', logic });
    expect((field as any).logic).toEqual(logic);
  });
});

describe('forgeTextAreaField()', () => {
  it('should create a textarea field with correct type', () => {
    const field = forgeTextAreaField({ key: 'bio', label: 'Biography' });
    expect(field.type).toBe('textarea');
    expect(field.key).toBe('bio');
    expect(field.label).toBe('Biography');
  });

  it('should set required when specified', () => {
    const field = forgeTextAreaField({ key: 'bio', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = forgeTextAreaField({ key: 'bio', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should default rows to 3 in props', () => {
    const field = forgeTextAreaField({ key: 'bio' });
    expect(field.props?.rows).toBe(3);
  });

  it('should set custom rows in props', () => {
    const field = forgeTextAreaField({ key: 'bio', rows: 5 });
    expect(field.props?.rows).toBe(5);
  });

  it('should set minLength and maxLength', () => {
    const field = forgeTextAreaField({ key: 'bio', minLength: 10, maxLength: 500 });
    expect(field.minLength).toBe(10);
    expect(field.maxLength).toBe(500);
  });

  it('should set pattern from string', () => {
    const field = forgeTextAreaField({ key: 'bio', pattern: '^[a-z]+$' });
    expect(field.pattern).toBe('^[a-z]+$');
  });

  it('should set pattern from RegExp', () => {
    const field = forgeTextAreaField({ key: 'bio', pattern: /^[a-z]+$/ });
    expect(field.pattern).toBe('^[a-z]+$');
  });

  it('should map description to hint in props', () => {
    const field = forgeTextAreaField({ key: 'bio', description: 'Tell us about yourself' });
    expect(field.props?.hint).toBe('Tell us about yourself');
  });

  it('should set placeholder on field', () => {
    const field = forgeTextAreaField({ key: 'bio', placeholder: 'Type here' });
    expect((field as any).placeholder).toBe('Type here');
  });

  it('should provide empty string as default value', () => {
    const field = forgeTextAreaField({ key: 'bio' });
    expect(field.value).toBe('');
  });

  it('should use defaultValue when provided', () => {
    const field = forgeTextAreaField({ key: 'bio', defaultValue: 'default text' });
    expect(field.value).toBe('default text');
  });

  it('should provide empty label when not specified', () => {
    const field = forgeTextAreaField({ key: 'bio' });
    expect(field.label).toBe('');
  });

  describe('validationMessages', () => {
    it('should include validationMessages on the field definition', () => {
      const field = forgeTextAreaField({ key: 'bio', label: 'Bio' });
      expect(field.validationMessages).toBeDefined();
    });

    it('should include a minLength validation message', () => {
      const field = forgeTextAreaField({ key: 'bio', minLength: 10 });
      expect(field.validationMessages?.minLength).toBeDefined();
    });

    it('should include a maxLength validation message', () => {
      const field = forgeTextAreaField({ key: 'bio', maxLength: 500 });
      expect(field.validationMessages?.maxLength).toBeDefined();
    });
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = forgeTextAreaField({ key: 'bio', logic });
    expect((field as any).logic).toEqual(logic);
  });
});
