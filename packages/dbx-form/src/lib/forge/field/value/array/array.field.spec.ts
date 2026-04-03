import { describe, it, expect } from 'vitest';
import { forgeRepeatArrayField } from './array.field';
import { forgeTextField } from '../text/text.field';
import { forgeNumberField } from '../number/number.field';

describe('forgeRepeatArrayField()', () => {
  it('should create an array field with correct type and key', () => {
    const template = forgeTextField({ key: 'item', label: 'Item' });
    const field = forgeRepeatArrayField({ key: 'items', template });
    expect(field.type).toBe('array');
    expect(field.key).toBe('items');
  });

  it('should accept a single field as template', () => {
    const template = forgeTextField({ key: 'name', label: 'Name' });
    const field = forgeRepeatArrayField({ key: 'names', template });
    expect(field.template).toBe(template);
  });

  it('should accept an array of fields as template', () => {
    const template = [forgeTextField({ key: 'name', label: 'Name' }), forgeNumberField({ key: 'qty', label: 'Qty' })];

    const field = forgeRepeatArrayField({ key: 'items', template });
    expect(field.template).toBe(template);
  });

  it('should set value when provided', () => {
    const template = forgeTextField({ key: 'name', label: 'Name' });
    const field = forgeRepeatArrayField({ key: 'items', template, value: ['a', 'b'] });
    expect(field.value).toEqual(['a', 'b']);
  });

  it('should not include value when not provided', () => {
    const template = forgeTextField({ key: 'name', label: 'Name' });
    const field = forgeRepeatArrayField({ key: 'items', template });
    expect(field.value).toBeUndefined();
  });

  it('should set minLength when specified', () => {
    const template = forgeTextField({ key: 'name', label: 'Name' });
    const field = forgeRepeatArrayField({ key: 'items', template, minLength: 1 });
    expect(field.minLength).toBe(1);
  });

  it('should set maxLength when specified', () => {
    const template = forgeTextField({ key: 'name', label: 'Name' });
    const field = forgeRepeatArrayField({ key: 'items', template, maxLength: 5 });
    expect(field.maxLength).toBe(5);
  });

  it('should not include minLength and maxLength when not specified', () => {
    const template = forgeTextField({ key: 'name', label: 'Name' });
    const field = forgeRepeatArrayField({ key: 'items', template });
    expect(field.minLength).toBeUndefined();
    expect(field.maxLength).toBeUndefined();
  });

  it('should set addButton config when provided', () => {
    const template = forgeTextField({ key: 'name', label: 'Name' });
    const addButton = { label: 'Add Item' };
    const field = forgeRepeatArrayField({ key: 'items', template, addButton });
    expect(field.addButton).toEqual(addButton);
  });

  it('should set removeButton config when provided', () => {
    const template = forgeTextField({ key: 'name', label: 'Name' });
    const removeButton = { label: 'Remove' };
    const field = forgeRepeatArrayField({ key: 'items', template, removeButton });
    expect(field.removeButton).toEqual(removeButton);
  });

  it('should disable addButton when set to false', () => {
    const template = forgeTextField({ key: 'name', label: 'Name' });
    const field = forgeRepeatArrayField({ key: 'items', template, addButton: false });
    expect(field.addButton).toBe(false);
  });

  it('should disable removeButton when set to false', () => {
    const template = forgeTextField({ key: 'name', label: 'Name' });
    const field = forgeRepeatArrayField({ key: 'items', template, removeButton: false });
    expect(field.removeButton).toBe(false);
  });
});
