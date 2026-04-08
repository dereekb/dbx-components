import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { forgeSearchableTextField, forgeSearchableChipField, forgeSearchableStringChipField } from './searchable.field';

// MARK: Shared Stubs
const stubSearch = (_text: string) => of([{ value: 'a' }]);
const stubDisplayForValue = (values: { value: string }[]) => of(values.map((v) => ({ ...v, label: String(v.value) })));

// MARK: forgeSearchableTextField
describe('forgeSearchableTextField()', () => {
  function minimalConfig() {
    return {
      key: 'assignee',
      search: stubSearch,
      displayForValue: stubDisplayForValue
    } as Parameters<typeof forgeSearchableTextField>[0];
  }

  it('should set the correct type', () => {
    const field = forgeSearchableTextField(minimalConfig());
    expect(field.type).toBe('dbx-searchable-text');
  });

  it('should set the key', () => {
    const field = forgeSearchableTextField(minimalConfig());
    expect(field.key).toBe('assignee');
  });

  it('should set the label when provided', () => {
    const field = forgeSearchableTextField({ ...minimalConfig(), label: 'Assignee' });
    expect(field.label).toBe('Assignee');
  });

  it('should default label to empty string when not provided', () => {
    const field = forgeSearchableTextField(minimalConfig());
    expect(field.label).toBe('');
  });

  it('should set required when provided', () => {
    const field = forgeSearchableTextField({ ...minimalConfig(), required: true });
    expect(field.required).toBe(true);
  });

  it('should not set required when not provided', () => {
    const field = forgeSearchableTextField(minimalConfig());
    expect(field.required).toBeUndefined();
  });

  it('should set readonly when provided', () => {
    const field = forgeSearchableTextField({ ...minimalConfig(), readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map description to props.hint', () => {
    const field = forgeSearchableTextField({ ...minimalConfig(), description: 'Search for a person' });
    expect(field.props?.hint).toBe('Search for a person');
  });

  it('should not set hint when description is not provided', () => {
    const field = forgeSearchableTextField(minimalConfig());
    expect(field.props?.hint).toBeUndefined();
  });

  it('should propagate search through props', () => {
    const field = forgeSearchableTextField(minimalConfig());
    expect(field.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through props', () => {
    const field = forgeSearchableTextField(minimalConfig());
    expect(field.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate allowStringValues through props when provided', () => {
    const field = forgeSearchableTextField({ ...minimalConfig(), allowStringValues: true });
    expect(field.props?.allowStringValues).toBe(true);
  });

  it('should not set allowStringValues when not provided', () => {
    const field = forgeSearchableTextField(minimalConfig());
    expect(field.props?.allowStringValues).toBeUndefined();
  });

  it('should propagate searchOnEmptyText through props when provided', () => {
    const field = forgeSearchableTextField({ ...minimalConfig(), searchOnEmptyText: true });
    expect(field.props?.searchOnEmptyText).toBe(true);
  });

  it('should not set searchOnEmptyText when not provided', () => {
    const field = forgeSearchableTextField(minimalConfig());
    expect(field.props?.searchOnEmptyText).toBeUndefined();
  });

  it('should propagate showClearValue through props when provided', () => {
    const field = forgeSearchableTextField({ ...minimalConfig(), showClearValue: false });
    expect(field.props?.showClearValue).toBe(false);
  });

  it('should propagate searchLabel through props when provided', () => {
    const field = forgeSearchableTextField({ ...minimalConfig(), searchLabel: 'Find...' });
    expect(field.props?.searchLabel).toBe('Find...');
  });
});

// MARK: forgeSearchableChipField
describe('forgeSearchableChipField()', () => {
  function minimalConfig() {
    return {
      key: 'tags',
      search: stubSearch,
      displayForValue: stubDisplayForValue
    } as Parameters<typeof forgeSearchableChipField>[0];
  }

  it('should set the correct type', () => {
    const field = forgeSearchableChipField(minimalConfig());
    expect(field.type).toBe('dbx-searchable-chip');
  });

  it('should set the key', () => {
    const field = forgeSearchableChipField(minimalConfig());
    expect(field.key).toBe('tags');
  });

  it('should set the label when provided', () => {
    const field = forgeSearchableChipField({ ...minimalConfig(), label: 'Tags' });
    expect(field.label).toBe('Tags');
  });

  it('should default label to empty string when not provided', () => {
    const field = forgeSearchableChipField(minimalConfig());
    expect(field.label).toBe('');
  });

  it('should set required when provided', () => {
    const field = forgeSearchableChipField({ ...minimalConfig(), required: true });
    expect(field.required).toBe(true);
  });

  it('should not set required when not provided', () => {
    const field = forgeSearchableChipField(minimalConfig());
    expect(field.required).toBeUndefined();
  });

  it('should set readonly when provided', () => {
    const field = forgeSearchableChipField({ ...minimalConfig(), readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should map description to props.hint', () => {
    const field = forgeSearchableChipField({ ...minimalConfig(), description: 'Add tags' });
    expect(field.props?.hint).toBe('Add tags');
  });

  it('should not set hint when description is not provided', () => {
    const field = forgeSearchableChipField(minimalConfig());
    expect(field.props?.hint).toBeUndefined();
  });

  it('should propagate search through props', () => {
    const field = forgeSearchableChipField(minimalConfig());
    expect(field.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through props', () => {
    const field = forgeSearchableChipField(minimalConfig());
    expect(field.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate allowStringValues through props when provided', () => {
    const field = forgeSearchableChipField({ ...minimalConfig(), allowStringValues: true });
    expect(field.props?.allowStringValues).toBe(true);
  });

  it('should not set allowStringValues when not provided', () => {
    const field = forgeSearchableChipField(minimalConfig());
    expect(field.props?.allowStringValues).toBeUndefined();
  });

  it('should propagate searchOnEmptyText through props when provided', () => {
    const field = forgeSearchableChipField({ ...minimalConfig(), searchOnEmptyText: true });
    expect(field.props?.searchOnEmptyText).toBe(true);
  });

  it('should not set searchOnEmptyText when not provided', () => {
    const field = forgeSearchableChipField(minimalConfig());
    expect(field.props?.searchOnEmptyText).toBeUndefined();
  });

  it('should propagate multiSelect through props when provided', () => {
    const field = forgeSearchableChipField({ ...minimalConfig(), multiSelect: false });
    expect(field.props?.multiSelect).toBe(false);
  });

  it('should not set multiSelect when not provided', () => {
    const field = forgeSearchableChipField(minimalConfig());
    expect(field.props?.multiSelect).toBeUndefined();
  });

  it('should propagate asArrayValue through props when provided', () => {
    const field = forgeSearchableChipField({ ...minimalConfig(), asArrayValue: false });
    expect(field.props?.asArrayValue).toBe(false);
  });
});

// MARK: forgeSearchableStringChipField
describe('forgeSearchableStringChipField()', () => {
  function minimalConfig() {
    return {
      key: 'keywords',
      search: stubSearch,
      displayForValue: stubDisplayForValue
    } as Parameters<typeof forgeSearchableStringChipField>[0];
  }

  it('should set the correct type', () => {
    const field = forgeSearchableStringChipField(minimalConfig());
    expect(field.type).toBe('dbx-searchable-chip');
  });

  it('should set the key', () => {
    const field = forgeSearchableStringChipField(minimalConfig());
    expect(field.key).toBe('keywords');
  });

  it('should set the label when provided', () => {
    const field = forgeSearchableStringChipField({ ...minimalConfig(), label: 'Keywords' });
    expect(field.label).toBe('Keywords');
  });

  it('should default label to empty string when not provided', () => {
    const field = forgeSearchableStringChipField(minimalConfig());
    expect(field.label).toBe('');
  });

  it('should always set allowStringValues to true', () => {
    const field = forgeSearchableStringChipField(minimalConfig());
    expect(field.props?.allowStringValues).toBe(true);
  });

  it('should set required when provided', () => {
    const field = forgeSearchableStringChipField({ ...minimalConfig(), required: true });
    expect(field.required).toBe(true);
  });

  it('should map description to props.hint', () => {
    const field = forgeSearchableStringChipField({ ...minimalConfig(), description: 'Enter keywords' });
    expect(field.props?.hint).toBe('Enter keywords');
  });

  it('should propagate search through props', () => {
    const field = forgeSearchableStringChipField(minimalConfig());
    expect(field.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through props', () => {
    const field = forgeSearchableStringChipField(minimalConfig());
    expect(field.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate searchOnEmptyText through props when provided', () => {
    const field = forgeSearchableStringChipField({ ...minimalConfig(), searchOnEmptyText: true });
    expect(field.props?.searchOnEmptyText).toBe(true);
  });
});
