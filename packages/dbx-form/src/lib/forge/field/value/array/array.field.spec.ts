import { describe, it, expect } from 'vitest';
import { dbxForgeArrayField } from './array.field';
import { DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME } from '../../wrapper/array-field/array-field.wrapper';
import { DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME } from '../../wrapper/array-field/array-field.element.wrapper';

describe('dbxForgeArrayField()', () => {
  const basicFields = [{ key: 'name', type: 'input' as const, label: 'Name' }] as any[];

  it('should create a field with array type', () => {
    const field = dbxForgeArrayField({ key: 'items', fields: basicFields });
    expect(field.type).toBe('array');
  });

  it('should use the provided key', () => {
    const field = dbxForgeArrayField({ key: 'phones', fields: basicFields });
    expect(field.key).toBe('phones');
  });

  it('should pass maxLength on the field def', () => {
    const field = dbxForgeArrayField({ key: 'items', fields: basicFields, maxLength: 5 });
    expect(field.maxLength).toBe(5);
  });

  describe('outer wrapper', () => {
    it('should add the array field wrapper', () => {
      const field = dbxForgeArrayField({ key: 'items', fields: basicFields });
      const wrapper = (field.wrappers as any[])?.find((w) => w.type === DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME);
      expect(wrapper).toBeDefined();
    });

    it('should pass label to wrapper props', () => {
      const field = dbxForgeArrayField({ key: 'items', fields: basicFields, props: { label: 'My Items' } });
      const wrapper = (field.wrappers as any[])?.find((w) => w.type === DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME);
      expect(wrapper.props.label).toBe('My Items');
    });

    it('should pass hint to wrapper props', () => {
      const field = dbxForgeArrayField({ key: 'items', fields: basicFields, props: { hint: 'A list of items' } });
      const wrapper = (field.wrappers as any[])?.find((w) => w.type === DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME);
      expect(wrapper.props.hint).toBe('A list of items');
    });

    it('should pass addText to wrapper props', () => {
      const field = dbxForgeArrayField({ key: 'items', fields: basicFields, props: { addText: 'Add Item' } });
      const wrapper = (field.wrappers as any[])?.find((w) => w.type === DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME);
      expect(wrapper.props.addText).toBe('Add Item');
    });
  });

  describe('element wrapper', () => {
    function getElementWrapper(field: any): any {
      return field.fields[0].wrappers[0];
    }

    it('should wrap fields in a ContainerField with the element wrapper', () => {
      const field = dbxForgeArrayField({ key: 'items', fields: basicFields }) as any;
      expect(field.fields).toHaveLength(1);
      expect(field.fields[0].type).toBe('container');

      const elementWrapper = getElementWrapper(field);
      expect(elementWrapper.type).toBe(DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME);
    });

    it('should contain the original fields inside the container', () => {
      const fields = [
        { key: 'name', type: 'input' as const, label: 'Name' },
        { key: 'email', type: 'input' as const, label: 'Email' }
      ] as any[];

      const field = dbxForgeArrayField({ key: 'items', fields }) as any;
      expect(field.fields[0].fields).toEqual(fields);
    });

    it('should pass elementProps to the element wrapper', () => {
      const field = dbxForgeArrayField({
        key: 'items',
        fields: basicFields,
        elementProps: { labelForEntry: 'Item', disableRearrange: true }
      }) as any;

      const elementWrapper = getElementWrapper(field);
      expect(elementWrapper.props.labelForEntry).toBe('Item');
      expect(elementWrapper.props.disableRearrange).toBe(true);
    });

    it('should flow removeText from outer props to element wrapper', () => {
      const field = dbxForgeArrayField({
        key: 'items',
        fields: basicFields,
        props: { removeText: 'Delete' }
      }) as any;

      const elementWrapper = getElementWrapper(field);
      expect(elementWrapper.props.removeText).toBe('Delete');
    });

    it('should flow allowRemove from outer props to element wrapper', () => {
      const field = dbxForgeArrayField({
        key: 'items',
        fields: basicFields,
        props: { allowRemove: false }
      }) as any;

      const elementWrapper = getElementWrapper(field);
      expect(elementWrapper.props.allowRemove).toBe(false);
    });

    it('should flow disableRearrange from outer props to element wrapper', () => {
      const field = dbxForgeArrayField({
        key: 'items',
        fields: basicFields,
        props: { disableRearrange: true }
      }) as any;

      const elementWrapper = getElementWrapper(field);
      expect(elementWrapper.props.disableRearrange).toBe(true);
    });

    it('should allow elementProps to override flowed outer props', () => {
      const field = dbxForgeArrayField({
        key: 'items',
        fields: basicFields,
        props: { removeText: 'Delete' },
        elementProps: { removeText: 'Custom Remove' }
      }) as any;

      const elementWrapper = getElementWrapper(field);
      expect(elementWrapper.props.removeText).toBe('Custom Remove');
    });
  });
});
