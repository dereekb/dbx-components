import { describe, it, expect } from 'vitest';
import { dbxForgeChecklistField } from './checklist.field';
import type { LogicConfig } from '@ng-forge/dynamic-forms';

describe('dbxForgeChecklistField()', () => {
  const testOptions = [
    { label: 'Frontend', value: 'frontend' },
    { label: 'Backend', value: 'backend' },
    { label: 'DevOps', value: 'devops' }
  ];

  it('should create a multi-checkbox field with correct type', () => {
    const field = dbxForgeChecklistField({ key: 'tags', label: 'Tags', options: testOptions });
    expect(field.type).toBe('multi-checkbox');
    expect(field.key).toBe('tags');
    expect(field.label).toBe('Tags');
  });

  it('should set options on the field', () => {
    const field = dbxForgeChecklistField({ key: 'tags', options: testOptions });
    expect(field.options).toEqual(testOptions);
  });

  it('should set required when specified', () => {
    const field = dbxForgeChecklistField({ key: 'tags', options: testOptions, required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when specified', () => {
    const field = dbxForgeChecklistField({ key: 'tags', options: testOptions, readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map description to hint in props', () => {
    const field = dbxForgeChecklistField({ key: 'tags', options: testOptions, description: 'Select your skills' });
    expect(field.props?.hint).toBe('Select your skills');
  });

  it('should set labelPosition in props', () => {
    const field = dbxForgeChecklistField({ key: 'tags', options: testOptions, labelPosition: 'before' });
    expect(field.props?.labelPosition).toBe('before');
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeChecklistField({ key: 'tags', options: [{ label: 'A', value: 'a' }], logic });
    expect((field as any).logic).toEqual(logic);
  });

  it('should work with numeric option values', () => {
    const numOptions = [
      { label: 'Priority 1', value: 1 },
      { label: 'Priority 2', value: 2 }
    ];
    const field = dbxForgeChecklistField({ key: 'priorities', options: numOptions, value: [1] });
    expect(field.value).toEqual([1]);
    expect(field.options).toEqual(numOptions);
  });
});
