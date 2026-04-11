import { describe, it, expect } from 'vitest';
import { forgeChecklistField } from './checklist.field';
import type { LogicConfig } from '@ng-forge/dynamic-forms';

describe('forgeChecklistField()', () => {
  const testOptions = [
    { label: 'Frontend', value: 'frontend' },
    { label: 'Backend', value: 'backend' },
    { label: 'DevOps', value: 'devops' }
  ];

  it('should create a multi-checkbox field with correct type', () => {
    const field = forgeChecklistField({ key: 'tags', label: 'Tags', options: testOptions });
    expect(field.type).toBe('multi-checkbox');
    expect(field.key).toBe('tags');
    expect(field.label).toBe('Tags');
  });

  it('should set options on the field', () => {
    const field = forgeChecklistField({ key: 'tags', options: testOptions });
    expect(field.options).toEqual(testOptions);
  });

  it('should set required when specified', () => {
    const field = forgeChecklistField({ key: 'tags', options: testOptions, required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = forgeChecklistField({ key: 'tags', options: testOptions, readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should default value to empty array', () => {
    const field = forgeChecklistField({ key: 'tags', options: testOptions });
    expect(field.value).toEqual([]);
  });

  it('should use defaultValue when provided', () => {
    const field = forgeChecklistField({ key: 'tags', options: testOptions, defaultValue: ['frontend', 'backend'] });
    expect(field.value).toEqual(['frontend', 'backend']);
  });

  it('should map description to hint in props', () => {
    const field = forgeChecklistField({ key: 'tags', options: testOptions, description: 'Select your skills' });
    expect(field.props?.hint).toBe('Select your skills');
  });

  it('should set labelPosition in props', () => {
    const field = forgeChecklistField({ key: 'tags', options: testOptions, labelPosition: 'before' });
    expect(field.props?.labelPosition).toBe('before');
  });

  it('should not include props when no description or labelPosition is set', () => {
    const field = forgeChecklistField({ key: 'tags', options: testOptions });
    expect(field.props).toBeUndefined();
  });

  it('should provide empty label when not specified', () => {
    const field = forgeChecklistField({ key: 'tags', options: testOptions });
    expect(field.label).toBe('');
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = forgeChecklistField({ key: 'tags', options: [{ label: 'A', value: 'a' }], logic });
    expect((field as any).logic).toEqual(logic);
  });

  it('should work with numeric option values', () => {
    const numOptions = [
      { label: 'Priority 1', value: 1 },
      { label: 'Priority 2', value: 2 }
    ];
    const field = forgeChecklistField({ key: 'priorities', options: numOptions, defaultValue: [1] });
    expect(field.value).toEqual([1]);
    expect(field.options).toEqual(numOptions);
  });
});
