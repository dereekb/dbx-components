import { describe, it, expect } from 'vitest';
import { forgeArrayField, FORGE_ARRAY_FIELD_TYPE_NAME } from './array.field';

describe('forgeArrayField()', () => {
  it('should create a field with the correct type', () => {
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' }
    });
    expect(field.type).toBe(FORGE_ARRAY_FIELD_TYPE_NAME);
  });

  it('should use the provided key', () => {
    const field = forgeArrayField({
      key: 'phones',
      template: { key: 'number', type: 'input' as const, label: 'Number' }
    });
    expect(field.key).toBe('phones');
  });

  it('should default value to empty array', () => {
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' }
    });
    expect(field.value).toEqual([]);
  });

  it('should use provided initial values', () => {
    const values = [{ name: 'Alice' }, { name: 'Bob' }];
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' },
      value: values
    });
    expect(field.value).toEqual(values);
  });

  it('should pass template through props', () => {
    const template = [
      { key: 'name', type: 'input' as const, label: 'Name' },
      { key: 'age', type: 'input' as const, label: 'Age' }
    ];
    const field = forgeArrayField({ key: 'items', template });
    expect(field.props?.template).toEqual(template);
  });

  it('should pass single-field template', () => {
    const template = { key: 'tag', type: 'input' as const, label: 'Tag' };
    const field = forgeArrayField({ key: 'tags', template });
    expect(field.props?.template).toEqual(template);
  });

  it('should pass addText through props', () => {
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' },
      addText: 'Add Item'
    });
    expect(field.props?.addText).toBe('Add Item');
  });

  it('should pass removeText through props', () => {
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' },
      removeText: 'Delete'
    });
    expect(field.props?.removeText).toBe('Delete');
  });

  it('should pass disableRearrange through props', () => {
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' },
      disableRearrange: true
    });
    expect(field.props?.disableRearrange).toBe(true);
  });

  it('should pass maxLength through props', () => {
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' },
      maxLength: 5
    });
    expect(field.props?.maxLength).toBe(5);
  });

  it('should pass allowDuplicate through props', () => {
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' },
      allowDuplicate: true,
      duplicateText: 'Copy'
    });
    expect(field.props?.allowDuplicate).toBe(true);
    expect(field.props?.duplicateText).toBe('Copy');
  });

  it('should pass labelForField string through props', () => {
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' },
      labelForField: 'Item'
    });
    expect(field.props?.labelForField).toBe('Item');
  });

  it('should pass labelForField function through props', () => {
    const labelFn = (pair: { index: number }) => `Entry ${pair.index}`;
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' },
      labelForField: labelFn
    });
    expect(field.props?.labelForField).toBe(labelFn);
  });

  it('should pass addButtonStyle through props', () => {
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' },
      addButtonStyle: { type: 'flat', color: 'accent' }
    });
    expect(field.props?.addButtonStyle).toEqual({ type: 'flat', color: 'accent' });
  });

  it('should pass removeButtonStyle through props', () => {
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' },
      removeButtonStyle: { type: 'stroked', color: 'warn' }
    });
    expect(field.props?.removeButtonStyle).toEqual({ type: 'stroked', color: 'warn' });
  });

  it('should pass duplicateButtonStyle through props', () => {
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' },
      duplicateButtonStyle: { type: 'tonal', color: 'primary' }
    });
    expect(field.props?.duplicateButtonStyle).toEqual({ type: 'tonal', color: 'primary' });
  });

  it('should not include undefined optional props', () => {
    const field = forgeArrayField({
      key: 'items',
      template: { key: 'name', type: 'input' as const, label: 'Name' }
    });

    // Only template should be present in props
    expect(field.props?.template).toBeDefined();
    expect(field.props?.addText).toBeUndefined();
    expect(field.props?.maxLength).toBeUndefined();
  });
});
