import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { dbxForgeValueSelectionField } from './selection.field';
import { resolveForgeSelectionOptions } from './selection.field.component';
import type { LogicConfig } from '@ng-forge/dynamic-forms';
import type { ValueSelectionOption } from '../../../field/field.selection';

// MARK: resolveForgeSelectionOptions
describe('resolveForgeSelectionOptions()', () => {
  it('should pass through value options unchanged', () => {
    const options: ValueSelectionOption<string>[] = [
      { label: 'Red', value: 'red' },
      { label: 'Blue', value: 'blue' }
    ];

    const resolved = resolveForgeSelectionOptions(options, false);
    expect(resolved).toEqual([
      { label: 'Red', value: 'red' },
      { label: 'Blue', value: 'blue' }
    ]);
  });

  it('should map ValueSelectionOptionClear to { label, value: null }', () => {
    const options: ValueSelectionOption<string>[] = [
      { label: 'No Selection', clear: true },
      { label: 'Red', value: 'red' }
    ];

    const resolved = resolveForgeSelectionOptions(options, false);
    expect(resolved).toEqual([
      { label: 'No Selection', value: null },
      { label: 'Red', value: 'red' }
    ]);
  });

  it('should use empty string label for clear option without label', () => {
    const options: ValueSelectionOption<string>[] = [{ clear: true }, { label: 'Red', value: 'red' }];

    const resolved = resolveForgeSelectionOptions(options, false);
    expect(resolved[0]).toEqual({ label: '', value: null });
  });

  it('should prepend a clear option when addClearOption is true and none exists', () => {
    const options: ValueSelectionOption<string>[] = [
      { label: 'Red', value: 'red' },
      { label: 'Blue', value: 'blue' }
    ];

    const resolved = resolveForgeSelectionOptions(options, true);
    expect(resolved).toHaveLength(3);
    expect(resolved[0]).toEqual({ label: '-- Clear --', value: null });
  });

  it('should use custom clear label when addClearOption is a string', () => {
    const options: ValueSelectionOption<string>[] = [{ label: 'Red', value: 'red' }];

    const resolved = resolveForgeSelectionOptions(options, 'Reset');
    expect(resolved[0]).toEqual({ label: 'Reset', value: null });
  });

  it('should NOT prepend a clear option when options already contain one', () => {
    const options: ValueSelectionOption<string>[] = [
      { label: 'None', clear: true },
      { label: 'Red', value: 'red' }
    ];

    const resolved = resolveForgeSelectionOptions(options, true);
    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toEqual({ label: 'None', value: null });
  });

  it('should preserve disabled state on value options', () => {
    const options: ValueSelectionOption<string>[] = [{ label: 'Disabled', value: 'x', disabled: true }];

    const resolved = resolveForgeSelectionOptions(options, false);
    expect(resolved[0].disabled).toBe(true);
  });
});

// MARK: dbxForgeValueSelectionField
describe('dbxForgeValueSelectionField()', () => {
  const testOptions: ValueSelectionOption<string>[] = [
    { label: 'Red', value: 'red' },
    { label: 'Blue', value: 'blue' },
    { label: 'Green', value: 'green' }
  ];

  it('should set the field type to dbx-value-selection', () => {
    const field = dbxForgeValueSelectionField({ key: 'color', options: testOptions });
    expect(field.type).toBe('dbx-value-selection');
  });

  it('should set the field key', () => {
    const field = dbxForgeValueSelectionField({ key: 'color', options: testOptions });
    expect(field.key).toBe('color');
  });

  it('should set the label when provided', () => {
    const field = dbxForgeValueSelectionField({ key: 'color', label: 'Color', options: testOptions });
    expect(field.label).toBe('Color');
  });

  it('should set required on the field when provided', () => {
    const field = dbxForgeValueSelectionField({ key: 'color', options: testOptions, required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly on the field when provided', () => {
    const field = dbxForgeValueSelectionField({ key: 'color', options: testOptions, readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should pass static options through props', () => {
    const field = dbxForgeValueSelectionField({ key: 'color', options: testOptions });
    expect(field.props?.options).toBe(testOptions);
  });

  it('should pass Observable options through props', () => {
    const options$ = of(testOptions);
    const field = dbxForgeValueSelectionField({ key: 'color', options: options$ });
    expect(field.props?.options).toBe(options$);
  });

  it('should pass multiple through props', () => {
    const field = dbxForgeValueSelectionField({ key: 'colors', options: testOptions, multiple: true });
    expect(field.props?.multiple).toBe(true);
  });

  it('should pass addClearOption through props', () => {
    const field = dbxForgeValueSelectionField({ key: 'color', options: testOptions, addClearOption: 'Reset' });
    expect(field.props?.addClearOption).toBe('Reset');
  });

  it('should pass description as hint in props', () => {
    const field = dbxForgeValueSelectionField({ key: 'color', options: testOptions, description: 'Pick a color' });
    expect(field.props?.hint).toBe('Pick a color');
  });

  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeValueSelectionField({ key: 'color', options: testOptions, logic });
    expect((field as any).logic).toEqual(logic);
  });

  it('should accept options with ValueSelectionOptionClear entries', () => {
    const optionsWithClear: ValueSelectionOption<string>[] = [
      { label: 'No Change', clear: true },
      { label: 'Red', value: 'red' }
    ];
    const field = dbxForgeValueSelectionField({ key: 'color', options: optionsWithClear });
    expect(field.props?.options).toBe(optionsWithClear);
  });

  it('should work with numeric option values', () => {
    const numOptions: ValueSelectionOption<number>[] = [
      { label: 'One', value: 1 },
      { label: 'Two', value: 2 }
    ];
    const field = dbxForgeValueSelectionField({ key: 'num', options: numOptions, value: 1 });
    expect(field.value).toBe(1);
    expect(field.props?.options).toEqual(numOptions);
  });
});
