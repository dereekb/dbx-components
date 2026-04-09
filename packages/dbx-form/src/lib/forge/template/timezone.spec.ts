import { describe, it, expect } from 'vitest';
import { forgeTimezoneStringField } from './timezone';
import type { ForgeSearchableTextFieldDef } from '../field/selection/searchable/searchable.field.component';

describe('forgeTimezoneStringField()', () => {
  function innerField(config?: Parameters<typeof forgeTimezoneStringField>[0]): ForgeSearchableTextFieldDef {
    const wrapper = forgeTimezoneStringField(config);
    return wrapper.props!.fields[0] as unknown as ForgeSearchableTextFieldDef;
  }

  it('should create a wrapper field with type dbx-forge-form-field', () => {
    const wrapper = forgeTimezoneStringField();
    expect(wrapper.type).toBe('dbx-forge-form-field');
  });

  it('should contain an inner searchable text field with type dbx-searchable-text', () => {
    expect(innerField().type).toBe('dbx-searchable-text');
  });

  it('should default to key "timezone" on the inner field', () => {
    expect(innerField().key).toBe('timezone');
  });

  it('should default to label "Timezone" on the wrapper', () => {
    const wrapper = forgeTimezoneStringField();
    expect(wrapper.label).toBe('Timezone');
  });

  it('should allow overriding key', () => {
    expect(innerField({ key: 'tz' }).key).toBe('tz');
  });

  it('should allow overriding label', () => {
    const wrapper = forgeTimezoneStringField({ label: 'Select Timezone' });
    expect(wrapper.label).toBe('Select Timezone');
  });

  it('should set required on the inner field when specified', () => {
    expect(innerField({ required: true }).required).toBe(true);
  });

  it('should set readonly on the inner field when specified', () => {
    expect(innerField({ readonly: true }).readonly).toBe(true);
  });

  it('should configure search and display props on the inner field', () => {
    const field = innerField();
    expect(field.props).toBeDefined();
    expect(field.props?.search).toBeDefined();
    expect(field.props?.displayForValue).toBeDefined();
    expect(field.props?.searchOnEmptyText).toBe(true);
    expect(field.props?.allowStringValues).toBe(false);
    expect(field.props?.showClearValue).toBe(true);
  });

  it('should work with no arguments', () => {
    expect(() => forgeTimezoneStringField()).not.toThrow();
  });

  it('should work with empty config', () => {
    expect(() => forgeTimezoneStringField({})).not.toThrow();
  });
});
