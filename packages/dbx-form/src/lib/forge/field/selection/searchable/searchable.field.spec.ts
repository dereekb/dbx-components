import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { forgeSearchableTextField, forgeSearchableChipField, forgeSearchableStringChipField } from './searchable.field';
import type { ForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import type { FieldDef } from '@ng-forge/dynamic-forms';

// MARK: Shared Stubs
const stubSearch = (_text: string) => of([{ value: 'a' }]);
const stubDisplayForValue = (values: { value: string }[]) => of(values.map((v) => ({ ...v, label: String(v.value) })));

// MARK: Helpers
/**
 * Extracts the inner field from a ForgeFormFieldWrapperFieldDef.
 * The wrapper nests the actual field inside `props.fields[0]`.
 */
function getInnerField(wrapper: ForgeFormFieldWrapperFieldDef): FieldDef<unknown> {
  const fields = wrapper.props?.fields;
  expect(fields).toBeDefined();
  expect(fields!.length).toBeGreaterThan(0);
  return fields![0];
}

// MARK: forgeSearchableTextField
describe('forgeSearchableTextField()', () => {
  function minimalConfig() {
    return {
      key: 'assignee',
      search: stubSearch,
      displayForValue: stubDisplayForValue
    } as Parameters<typeof forgeSearchableTextField>[0];
  }

  // -- Wrapper-level tests --

  it('should set the wrapper type to dbx-forge-form-field', () => {
    const wrapper = forgeSearchableTextField(minimalConfig());
    expect(wrapper.type).toBe('dbx-forge-form-field');
  });

  it('should set the label on the wrapper when provided', () => {
    const wrapper = forgeSearchableTextField({ ...minimalConfig(), label: 'Assignee' });
    expect(wrapper.label).toBe('Assignee');
  });

  it('should default wrapper label to empty string when not provided', () => {
    const wrapper = forgeSearchableTextField(minimalConfig());
    expect(wrapper.label).toBe('');
  });

  it('should map description to wrapper props.hint', () => {
    const wrapper = forgeSearchableTextField({ ...minimalConfig(), description: 'Search for a person' });
    expect(wrapper.props?.hint).toBe('Search for a person');
  });

  it('should not set hint on wrapper when description is not provided', () => {
    const wrapper = forgeSearchableTextField(minimalConfig());
    expect(wrapper.props?.hint).toBeUndefined();
  });

  // -- Inner field tests --

  it('should set the correct inner field type', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.type).toBe('dbx-searchable-text');
  });

  it('should set the key on the inner field', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.key).toBe('assignee');
  });

  it('should set required on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableTextField({ ...minimalConfig(), required: true }));
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableTextField({ ...minimalConfig(), readonly: true }));
    expect(inner.readonly).toBe(true);
  });

  it('should propagate search through inner field props', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate allowStringValues through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableTextField({ ...minimalConfig(), allowStringValues: true }));
    expect(inner.props?.allowStringValues).toBe(true);
  });

  it('should not set allowStringValues on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.props?.allowStringValues).toBeUndefined();
  });

  it('should propagate searchOnEmptyText through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableTextField({ ...minimalConfig(), searchOnEmptyText: true }));
    expect(inner.props?.searchOnEmptyText).toBe(true);
  });

  it('should not set searchOnEmptyText on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableTextField(minimalConfig()));
    expect(inner.props?.searchOnEmptyText).toBeUndefined();
  });

  it('should propagate showClearValue through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableTextField({ ...minimalConfig(), showClearValue: false }));
    expect(inner.props?.showClearValue).toBe(false);
  });

  it('should propagate searchLabel through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableTextField({ ...minimalConfig(), searchLabel: 'Find...' }));
    expect(inner.props?.searchLabel).toBe('Find...');
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

  // -- Wrapper-level tests --

  it('should set the wrapper type to dbx-forge-form-field', () => {
    const wrapper = forgeSearchableChipField(minimalConfig());
    expect(wrapper.type).toBe('dbx-forge-form-field');
  });

  it('should set the label on the wrapper when provided', () => {
    const wrapper = forgeSearchableChipField({ ...minimalConfig(), label: 'Tags' });
    expect(wrapper.label).toBe('Tags');
  });

  it('should default wrapper label to empty string when not provided', () => {
    const wrapper = forgeSearchableChipField(minimalConfig());
    expect(wrapper.label).toBe('');
  });

  it('should map description to wrapper props.hint', () => {
    const wrapper = forgeSearchableChipField({ ...minimalConfig(), description: 'Add tags' });
    expect(wrapper.props?.hint).toBe('Add tags');
  });

  it('should not set hint on wrapper when description is not provided', () => {
    const wrapper = forgeSearchableChipField(minimalConfig());
    expect(wrapper.props?.hint).toBeUndefined();
  });

  // -- Inner field tests --

  it('should set the correct inner field type', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.type).toBe('dbx-searchable-chip');
  });

  it('should set the key on the inner field', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.key).toBe('tags');
  });

  it('should set required on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), required: true }));
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), readonly: true }));
    expect(inner.readonly).toBe(true);
  });

  it('should propagate search through inner field props', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate allowStringValues through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), allowStringValues: true }));
    expect(inner.props?.allowStringValues).toBe(true);
  });

  it('should not set allowStringValues on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.props?.allowStringValues).toBeUndefined();
  });

  it('should propagate searchOnEmptyText through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), searchOnEmptyText: true }));
    expect(inner.props?.searchOnEmptyText).toBe(true);
  });

  it('should not set searchOnEmptyText on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.props?.searchOnEmptyText).toBeUndefined();
  });

  it('should propagate multiSelect through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), multiSelect: false }));
    expect(inner.props?.multiSelect).toBe(false);
  });

  it('should not set multiSelect on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.props?.multiSelect).toBeUndefined();
  });

  it('should propagate asArrayValue through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), asArrayValue: false }));
    expect(inner.props?.asArrayValue).toBe(false);
  });

  it('should propagate textInputValidator through inner field props when provided', () => {
    const validator = () => null;
    const inner = getInnerField(forgeSearchableChipField({ ...minimalConfig(), textInputValidator: validator } as Parameters<typeof forgeSearchableChipField>[0]));
    expect(inner.props?.textInputValidator).toBe(validator);
  });

  it('should not set textInputValidator on the inner field when not provided', () => {
    const inner = getInnerField(forgeSearchableChipField(minimalConfig()));
    expect(inner.props?.textInputValidator).toBeUndefined();
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

  // -- Wrapper-level tests --

  it('should set the wrapper type to dbx-forge-form-field', () => {
    const wrapper = forgeSearchableStringChipField(minimalConfig());
    expect(wrapper.type).toBe('dbx-forge-form-field');
  });

  it('should set the label on the wrapper when provided', () => {
    const wrapper = forgeSearchableStringChipField({ ...minimalConfig(), label: 'Keywords' });
    expect(wrapper.label).toBe('Keywords');
  });

  it('should default wrapper label to empty string when not provided', () => {
    const wrapper = forgeSearchableStringChipField(minimalConfig());
    expect(wrapper.label).toBe('');
  });

  it('should map description to wrapper props.hint', () => {
    const wrapper = forgeSearchableStringChipField({ ...minimalConfig(), description: 'Enter keywords' });
    expect(wrapper.props?.hint).toBe('Enter keywords');
  });

  // -- Inner field tests --

  it('should set the correct inner field type', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()));
    expect(inner.type).toBe('dbx-searchable-chip');
  });

  it('should set the key on the inner field', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()));
    expect(inner.key).toBe('keywords');
  });

  it('should always set allowStringValues to true on the inner field', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()));
    expect(inner.props?.allowStringValues).toBe(true);
  });

  it('should set required on the inner field when provided', () => {
    const inner = getInnerField(forgeSearchableStringChipField({ ...minimalConfig(), required: true }));
    expect(inner.required).toBe(true);
  });

  it('should propagate search through inner field props', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()));
    expect(inner.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = getInnerField(forgeSearchableStringChipField(minimalConfig()));
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate searchOnEmptyText through inner field props when provided', () => {
    const inner = getInnerField(forgeSearchableStringChipField({ ...minimalConfig(), searchOnEmptyText: true }));
    expect(inner.props?.searchOnEmptyText).toBe(true);
  });
});
