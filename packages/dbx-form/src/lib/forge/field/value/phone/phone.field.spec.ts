import { describe, it, expect } from 'vitest';
import { forgePhoneField, forgeWrappedPhoneAndLabelField, forgePhoneAndLabelSectionField, forgePhoneListField } from './phone.field';

// MARK: forgePhoneField
describe('forgePhoneField()', () => {
  it('should create a field with type phone', () => {
    const field = forgePhoneField({ key: 'phone' });
    expect(field.type).toBe('phone');
  });

  it('should set the key from config', () => {
    const field = forgePhoneField({ key: 'myPhone' });
    expect(field.key).toBe('myPhone');
  });

  it('should default label to Phone Number', () => {
    const field = forgePhoneField({ key: 'phone' });
    expect(field.label).toBe('Phone Number');
  });

  it('should use a custom label when provided', () => {
    const field = forgePhoneField({ key: 'phone', label: 'Work Phone' });
    expect(field.label).toBe('Work Phone');
  });

  it('should default value to empty string', () => {
    const field = forgePhoneField({ key: 'phone' });
    expect(field.value).toBe('');
  });

  it('should use a custom defaultValue when provided', () => {
    const field = forgePhoneField({ key: 'phone', defaultValue: '+15551234567' });
    expect(field.value).toBe('+15551234567');
  });

  it('should set required when provided', () => {
    const field = forgePhoneField({ key: 'phone', required: true });
    expect(field.required).toBe(true);
  });

  it('should set readonly when provided', () => {
    const field = forgePhoneField({ key: 'phone', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should not set props when no phone-specific config is provided', () => {
    const field = forgePhoneField({ key: 'phone' });
    expect(field.props).toBeUndefined();
  });

  it('should set preferredCountries in props', () => {
    const field = forgePhoneField({ key: 'phone', preferredCountries: ['us', 'ca'] });
    expect(field.props?.preferredCountries).toEqual(['us', 'ca']);
  });

  it('should set onlyCountries in props', () => {
    const field = forgePhoneField({ key: 'phone', onlyCountries: ['us'] });
    expect(field.props?.onlyCountries).toEqual(['us']);
  });

  it('should set enableSearch in props', () => {
    const field = forgePhoneField({ key: 'phone', enableSearch: false });
    expect(field.props?.enableSearch).toBe(false);
  });

  it('should set allowExtension in props', () => {
    const field = forgePhoneField({ key: 'phone', allowExtension: true });
    expect(field.props?.allowExtension).toBe(true);
  });

  it('should set description as hint in props', () => {
    const field = forgePhoneField({ key: 'phone', description: 'Enter your phone' });
    expect(field.props?.hint).toBe('Enter your phone');
  });

  it('should combine multiple props', () => {
    const field = forgePhoneField({
      key: 'phone',
      preferredCountries: ['us'],
      enableSearch: true,
      allowExtension: true,
      description: 'Phone number'
    });
    expect(field.props?.preferredCountries).toEqual(['us']);
    expect(field.props?.enableSearch).toBe(true);
    expect(field.props?.allowExtension).toBe(true);
    expect(field.props?.hint).toBe('Phone number');
  });
});

// MARK: forgeWrappedPhoneAndLabelField
describe('forgeWrappedPhoneAndLabelField()', () => {
  it('should create a row field', () => {
    const field = forgeWrappedPhoneAndLabelField();
    expect(field.type).toBe('row');
  });

  it('should contain two child fields', () => {
    const field = forgeWrappedPhoneAndLabelField();
    expect((field as unknown as { fields: unknown[] }).fields).toHaveLength(2);
  });

  it('should have a phone field as the first child with col 8', () => {
    const field = forgeWrappedPhoneAndLabelField();
    const fields = (field as unknown as { fields: Array<{ key: string; type: string; col: number }> }).fields;
    expect(fields[0].key).toBe('phone');
    expect(fields[0].type).toBe('phone');
    expect(fields[0].col).toBe(8);
  });

  it('should have a label text field as the second child with col 4', () => {
    const field = forgeWrappedPhoneAndLabelField();
    const fields = (field as unknown as { fields: Array<{ key: string; type: string; col: number }> }).fields;
    expect(fields[1].key).toBe('label');
    expect(fields[1].type).toBe('input');
    expect(fields[1].col).toBe(4);
  });

  it('should propagate phoneField config', () => {
    const field = forgeWrappedPhoneAndLabelField({ phoneField: { required: true, label: 'Work Phone' } });
    const fields = (field as unknown as { fields: Array<{ required?: boolean; label?: string }> }).fields;
    expect(fields[0].required).toBe(true);
    expect(fields[0].label).toBe('Work Phone');
  });

  it('should use custom label field key', () => {
    const field = forgeWrappedPhoneAndLabelField({ labelField: { key: 'phoneName' } });
    const fields = (field as unknown as { fields: Array<{ key: string }> }).fields;
    expect(fields[1].key).toBe('phoneName');
  });

  it('should use custom label field label', () => {
    const field = forgeWrappedPhoneAndLabelField({ labelField: { label: 'Phone Type' } });
    const fields = (field as unknown as { fields: Array<{ label?: string }> }).fields;
    expect(fields[1].label).toBe('Phone Type');
  });
});

// MARK: forgePhoneAndLabelSectionField
describe('forgePhoneAndLabelSectionField()', () => {
  it('should create a group field', () => {
    const field = forgePhoneAndLabelSectionField();
    expect(field.type).toBe('group');
  });

  it('should default key to _section_ prefix when not specified', () => {
    const field = forgePhoneAndLabelSectionField();
    expect((field.key as string).startsWith('_section_')).toBe(true);
  });

  it('should use provided key', () => {
    const field = forgePhoneAndLabelSectionField({ key: 'contactPhone' });
    expect(field.key).toBe('contactPhone');
  });

  it('should contain one child field which is a row', () => {
    const field = forgePhoneAndLabelSectionField();
    const fields = (field as unknown as { fields: Array<{ type: string }> }).fields;
    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe('row');
  });

  it('should propagate phoneField config to the inner row', () => {
    const field = forgePhoneAndLabelSectionField({ phoneField: { required: true } });
    const innerRow = (field as unknown as { fields: Array<{ fields: Array<{ key: string; required?: boolean }> }> }).fields[0];
    expect(innerRow.fields[0].key).toBe('phone');
    expect(innerRow.fields[0].required).toBe(true);
  });

  it('should propagate labelField config to the inner row', () => {
    const field = forgePhoneAndLabelSectionField({ labelField: { key: 'type', label: 'Type' } });
    const innerRow = (field as unknown as { fields: Array<{ fields: Array<{ key: string; label?: string }> }> }).fields[0];
    expect(innerRow.fields[1].key).toBe('type');
    expect(innerRow.fields[1].label).toBe('Type');
  });
});

// MARK: forgePhoneListField
describe('forgePhoneListField()', () => {
  it('should create an array field', () => {
    const field = forgePhoneListField();
    expect(field.type).toBe('array');
  });

  it('should default key to phones', () => {
    const field = forgePhoneListField();
    expect(field.key).toBe('phones');
  });

  it('should use a custom key when provided', () => {
    const field = forgePhoneListField({ key: 'phoneNumbers' });
    expect(field.key).toBe('phoneNumbers');
  });

  it('should have a default template with phone and label fields', () => {
    const field = forgePhoneListField();
    const template = field.template as Array<{ key: string; type: string }>;
    expect(template).toHaveLength(2);
    expect(template[0].key).toBe('phone');
    expect(template[0].type).toBe('phone');
    expect(template[1].key).toBe('label');
    expect(template[1].type).toBe('input');
  });

  it('should use a custom template when provided', () => {
    const customTemplate = [{ key: 'number', type: 'input' as const, label: 'Number' }];
    const field = forgePhoneListField({ template: customTemplate });
    expect(field.template).toBe(customTemplate);
  });

  it('should default addButton label to Add Phone Number', () => {
    const field = forgePhoneListField();
    expect((field.addButton as { label: string }).label).toBe('Add Phone Number');
  });

  it('should default removeButton label to Remove Phone Number', () => {
    const field = forgePhoneListField();
    expect((field.removeButton as { label: string }).label).toBe('Remove Phone Number');
  });

  it('should use custom addButton label', () => {
    const field = forgePhoneListField({ addButtonLabel: 'Add Entry' });
    expect((field.addButton as { label: string }).label).toBe('Add Entry');
  });

  it('should use custom removeButton label', () => {
    const field = forgePhoneListField({ removeButtonLabel: 'Delete Entry' });
    expect((field.removeButton as { label: string }).label).toBe('Delete Entry');
  });

  it('should set minLength when provided', () => {
    const field = forgePhoneListField({ minLength: 1 });
    expect(field.minLength).toBe(1);
  });

  it('should set maxLength when provided', () => {
    const field = forgePhoneListField({ maxLength: 5 });
    expect(field.maxLength).toBe(5);
  });

  it('should not set minLength when not provided', () => {
    const field = forgePhoneListField();
    expect(field.minLength).toBeUndefined();
  });

  it('should not set maxLength when not provided', () => {
    const field = forgePhoneListField();
    expect(field.maxLength).toBeUndefined();
  });
});
