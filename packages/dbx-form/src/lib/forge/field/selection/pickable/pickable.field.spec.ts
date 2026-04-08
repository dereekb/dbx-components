import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { forgePickableChipField, forgePickableListField } from './pickable.field';

// MARK: Shared Stubs
const stubLoadValues = () => of([{ value: 'a' }, { value: 'b' }]);
const stubDisplayForValue = (values: { value: string }[]) => of(values.map((v) => ({ ...v, label: String(v.value) })));
const stubFilterValues = (_text: string | undefined | null, values: { value: string }[]) => of(values.map((v) => v.value));

// MARK: forgePickableChipField
describe('forgePickableChipField()', () => {
  function minimalConfig() {
    return {
      key: 'tags',
      loadValues: stubLoadValues,
      displayForValue: stubDisplayForValue
    } as Parameters<typeof forgePickableChipField>[0];
  }

  it('should set the correct type', () => {
    const field = forgePickableChipField(minimalConfig());
    expect(field.type).toBe('dbx-pickable-chip');
  });

  it('should set the key', () => {
    const field = forgePickableChipField(minimalConfig());
    expect(field.key).toBe('tags');
  });

  it('should set the label when provided', () => {
    const field = forgePickableChipField({ ...minimalConfig(), label: 'Tags' });
    expect(field.label).toBe('Tags');
  });

  it('should default label to empty string when not provided', () => {
    const field = forgePickableChipField(minimalConfig());
    expect(field.label).toBe('');
  });

  it('should set required when provided', () => {
    const field = forgePickableChipField({ ...minimalConfig(), required: true });
    expect(field.required).toBe(true);
  });

  it('should not set required when not provided', () => {
    const field = forgePickableChipField(minimalConfig());
    expect(field.required).toBeUndefined();
  });

  it('should set readonly when provided', () => {
    const field = forgePickableChipField({ ...minimalConfig(), readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map description to props.hint', () => {
    const field = forgePickableChipField({ ...minimalConfig(), description: 'Pick your tags' });
    expect(field.props?.hint).toBe('Pick your tags');
  });

  it('should not set hint when description is not provided', () => {
    const field = forgePickableChipField(minimalConfig());
    expect(field.props?.hint).toBeUndefined();
  });

  it('should propagate loadValues through props', () => {
    const field = forgePickableChipField(minimalConfig());
    expect(field.props?.loadValues).toBe(stubLoadValues);
  });

  it('should propagate displayForValue through props', () => {
    const field = forgePickableChipField(minimalConfig());
    expect(field.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate multiSelect through props when provided', () => {
    const field = forgePickableChipField({ ...minimalConfig(), multiSelect: false });
    expect(field.props?.multiSelect).toBe(false);
  });

  it('should not set multiSelect when not provided', () => {
    const field = forgePickableChipField(minimalConfig());
    expect(field.props?.multiSelect).toBeUndefined();
  });

  it('should propagate asArrayValue through props when provided', () => {
    const field = forgePickableChipField({ ...minimalConfig(), asArrayValue: false });
    expect(field.props?.asArrayValue).toBe(false);
  });

  it('should propagate filterValues through props when provided', () => {
    const field = forgePickableChipField({ ...minimalConfig(), filterValues: stubFilterValues } as Parameters<typeof forgePickableChipField>[0]);
    expect(field.props?.filterValues).toBe(stubFilterValues);
  });

  it('should propagate filterLabel through props when provided', () => {
    const field = forgePickableChipField({ ...minimalConfig(), filterLabel: 'Search tags' });
    expect(field.props?.filterLabel).toBe('Search tags');
  });

  it('should not set filterLabel when not provided', () => {
    const field = forgePickableChipField(minimalConfig());
    expect(field.props?.filterLabel).toBeUndefined();
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

  it('should set the correct type', () => {
    const field = forgePickableListField(minimalConfig());
    expect(field.type).toBe('dbx-pickable-list');
  });

  it('should set the key', () => {
    const field = forgePickableListField(minimalConfig());
    expect(field.key).toBe('categories');
  });

  it('should set the label when provided', () => {
    const field = forgePickableListField({ ...minimalConfig(), label: 'Categories' });
    expect(field.label).toBe('Categories');
  });

  it('should default label to empty string when not provided', () => {
    const field = forgePickableListField(minimalConfig());
    expect(field.label).toBe('');
  });

  it('should set required when provided', () => {
    const field = forgePickableListField({ ...minimalConfig(), required: true });
    expect(field.required).toBe(true);
  });

  it('should not set required when not provided', () => {
    const field = forgePickableListField(minimalConfig());
    expect(field.required).toBeUndefined();
  });

  it('should set readonly when provided', () => {
    const field = forgePickableListField({ ...minimalConfig(), readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map description to props.hint', () => {
    const field = forgePickableListField({ ...minimalConfig(), description: 'Choose categories' });
    expect(field.props?.hint).toBe('Choose categories');
  });

  it('should not set hint when description is not provided', () => {
    const field = forgePickableListField(minimalConfig());
    expect(field.props?.hint).toBeUndefined();
  });

  it('should propagate loadValues through props', () => {
    const field = forgePickableListField(minimalConfig());
    expect(field.props?.loadValues).toBe(stubLoadValues);
  });

  it('should propagate displayForValue through props', () => {
    const field = forgePickableListField(minimalConfig());
    expect(field.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate multiSelect through props when provided', () => {
    const field = forgePickableListField({ ...minimalConfig(), multiSelect: false });
    expect(field.props?.multiSelect).toBe(false);
  });

  it('should not set multiSelect when not provided', () => {
    const field = forgePickableListField(minimalConfig());
    expect(field.props?.multiSelect).toBeUndefined();
  });

  it('should propagate asArrayValue through props when provided', () => {
    const field = forgePickableListField({ ...minimalConfig(), asArrayValue: false });
    expect(field.props?.asArrayValue).toBe(false);
  });

  it('should propagate filterValues through props when provided', () => {
    const field = forgePickableListField({ ...minimalConfig(), filterValues: stubFilterValues } as Parameters<typeof forgePickableListField>[0]);
    expect(field.props?.filterValues).toBe(stubFilterValues);
  });

  it('should propagate filterLabel through props when provided', () => {
    const field = forgePickableListField({ ...minimalConfig(), filterLabel: 'Filter items' });
    expect(field.props?.filterLabel).toBe('Filter items');
  });

  it('should not set filterLabel when not provided', () => {
    const field = forgePickableListField(minimalConfig());
    expect(field.props?.filterLabel).toBeUndefined();
  });
});
