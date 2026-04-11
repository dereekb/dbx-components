import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { forgePickableChipField, forgePickableListField } from './pickable.field';
import type { DbxForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import type { FieldDef } from '@ng-forge/dynamic-forms';

// MARK: Shared Stubs
const stubLoadValues = () => of([{ value: 'a' }, { value: 'b' }]);
const stubDisplayForValue = (values: { value: string }[]) => of(values.map((v) => ({ ...v, label: String(v.value) })));
const stubFilterValues = (_text: string | undefined | null, values: { value: string }[]) => of(values.map((v) => v.value));

// MARK: Helpers
/**
 * Extracts the inner field from a DbxForgeFormFieldWrapperFieldDef.
 * The wrapper nests the actual field inside props.fields[0].
 */
function getInnerField(wrapper: DbxForgeFormFieldWrapperFieldDef): FieldDef<unknown> {
  const fields = wrapper.props?.fields;
  expect(fields).toBeDefined();
  expect(fields!.length).toBeGreaterThan(0);
  return fields![0];
}

// MARK: forgePickableChipField
describe('forgePickableChipField()', () => {
  function minimalConfig() {
    return {
      key: 'tags',
      loadValues: stubLoadValues,
      displayForValue: stubDisplayForValue
    } as Parameters<typeof forgePickableChipField>[0];
  }

  it('should return a wrapper with the correct type', () => {
    const wrapper = forgePickableChipField(minimalConfig());
    expect(wrapper.type).toBe('dbx-forge-form-field');
  });

  it('should set the inner field type to dbx-pickable-chip', () => {
    const wrapper = forgePickableChipField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.type).toBe('dbx-pickable-chip');
  });

  it('should set the inner field key', () => {
    const wrapper = forgePickableChipField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.key).toBe('tags');
  });

  it('should set the wrapper label when provided', () => {
    const wrapper = forgePickableChipField({ ...minimalConfig(), label: 'Tags' });
    expect(wrapper.label).toBe('Tags');
  });

  it('should default wrapper label to empty string when not provided', () => {
    const wrapper = forgePickableChipField(minimalConfig());
    expect(wrapper.label).toBe('');
  });

  it('should set required on the inner field when provided', () => {
    const wrapper = forgePickableChipField({ ...minimalConfig(), required: true });
    const inner = getInnerField(wrapper);
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const wrapper = forgePickableChipField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const wrapper = forgePickableChipField({ ...minimalConfig(), readonly: true });
    const inner = getInnerField(wrapper);
    expect(inner.readonly).toBe(true);
  });

  it('should map description to wrapper props.hint', () => {
    const wrapper = forgePickableChipField({ ...minimalConfig(), description: 'Pick your tags' });
    expect(wrapper.props?.hint).toBe('Pick your tags');
  });

  it('should not set hint on wrapper when description is not provided', () => {
    const wrapper = forgePickableChipField(minimalConfig());
    expect(wrapper.props?.hint).toBeUndefined();
  });

  it('should propagate loadValues through inner field props', () => {
    const wrapper = forgePickableChipField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.props?.loadValues).toBe(stubLoadValues);
  });

  it('should propagate displayForValue through inner field props', () => {
    const wrapper = forgePickableChipField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate multiSelect through inner field props when provided', () => {
    const wrapper = forgePickableChipField({ ...minimalConfig(), multiSelect: false });
    const inner = getInnerField(wrapper);
    expect(inner.props?.multiSelect).toBe(false);
  });

  it('should not set multiSelect on the inner field when not provided', () => {
    const wrapper = forgePickableChipField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.props?.multiSelect).toBeUndefined();
  });

  it('should propagate asArrayValue through inner field props when provided', () => {
    const wrapper = forgePickableChipField({ ...minimalConfig(), asArrayValue: false });
    const inner = getInnerField(wrapper);
    expect(inner.props?.asArrayValue).toBe(false);
  });

  it('should propagate filterValues through inner field props when provided', () => {
    const wrapper = forgePickableChipField({ ...minimalConfig(), filterValues: stubFilterValues } as Parameters<typeof forgePickableChipField>[0]);
    const inner = getInnerField(wrapper);
    expect(inner.props?.filterValues).toBe(stubFilterValues);
  });

  it('should propagate filterLabel through inner field props when provided', () => {
    const wrapper = forgePickableChipField({ ...minimalConfig(), filterLabel: 'Search tags' });
    const inner = getInnerField(wrapper);
    expect(inner.props?.filterLabel).toBe('Search tags');
  });

  it('should not set filterLabel on the inner field when not provided', () => {
    const wrapper = forgePickableChipField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.props?.filterLabel).toBeUndefined();
  });
});

// MARK: forgePickableListField
describe('forgePickableListField()', () => {
  function minimalConfig() {
    return {
      key: 'categories',
      loadValues: stubLoadValues,
      displayForValue: stubDisplayForValue
    } as Parameters<typeof forgePickableListField>[0];
  }

  it('should return a wrapper with the correct type', () => {
    const wrapper = forgePickableListField(minimalConfig());
    expect(wrapper.type).toBe('dbx-forge-form-field');
  });

  it('should set the inner field type to dbx-pickable-list', () => {
    const wrapper = forgePickableListField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.type).toBe('dbx-pickable-list');
  });

  it('should set the inner field key', () => {
    const wrapper = forgePickableListField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.key).toBe('categories');
  });

  it('should set the wrapper label when provided', () => {
    const wrapper = forgePickableListField({ ...minimalConfig(), label: 'Categories' });
    expect(wrapper.label).toBe('Categories');
  });

  it('should default wrapper label to empty string when not provided', () => {
    const wrapper = forgePickableListField(minimalConfig());
    expect(wrapper.label).toBe('');
  });

  it('should set required on the inner field when provided', () => {
    const wrapper = forgePickableListField({ ...minimalConfig(), required: true });
    const inner = getInnerField(wrapper);
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const wrapper = forgePickableListField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const wrapper = forgePickableListField({ ...minimalConfig(), readonly: true });
    const inner = getInnerField(wrapper);
    expect(inner.readonly).toBe(true);
  });

  it('should map description to wrapper props.hint', () => {
    const wrapper = forgePickableListField({ ...minimalConfig(), description: 'Choose categories' });
    expect(wrapper.props?.hint).toBe('Choose categories');
  });

  it('should not set hint on wrapper when description is not provided', () => {
    const wrapper = forgePickableListField(minimalConfig());
    expect(wrapper.props?.hint).toBeUndefined();
  });

  it('should propagate loadValues through inner field props', () => {
    const wrapper = forgePickableListField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.props?.loadValues).toBe(stubLoadValues);
  });

  it('should propagate displayForValue through inner field props', () => {
    const wrapper = forgePickableListField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate multiSelect through inner field props when provided', () => {
    const wrapper = forgePickableListField({ ...minimalConfig(), multiSelect: false });
    const inner = getInnerField(wrapper);
    expect(inner.props?.multiSelect).toBe(false);
  });

  it('should not set multiSelect on the inner field when not provided', () => {
    const wrapper = forgePickableListField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.props?.multiSelect).toBeUndefined();
  });

  it('should propagate asArrayValue through inner field props when provided', () => {
    const wrapper = forgePickableListField({ ...minimalConfig(), asArrayValue: false });
    const inner = getInnerField(wrapper);
    expect(inner.props?.asArrayValue).toBe(false);
  });

  it('should propagate filterValues through inner field props when provided', () => {
    const wrapper = forgePickableListField({ ...minimalConfig(), filterValues: stubFilterValues } as Parameters<typeof forgePickableListField>[0]);
    const inner = getInnerField(wrapper);
    expect(inner.props?.filterValues).toBe(stubFilterValues);
  });

  it('should propagate filterLabel through inner field props when provided', () => {
    const wrapper = forgePickableListField({ ...minimalConfig(), filterLabel: 'Filter items' });
    const inner = getInnerField(wrapper);
    expect(inner.props?.filterLabel).toBe('Filter items');
  });

  it('should not set filterLabel on the inner field when not provided', () => {
    const wrapper = forgePickableListField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.props?.filterLabel).toBeUndefined();
  });
});
