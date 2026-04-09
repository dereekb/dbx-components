import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { forgeListSelectionField } from './list.field';
import { type AbstractDbxSelectionListWrapperDirective } from '@dereekb/dbx-web';
import { successResult } from '@dereekb/rxjs';
import type { ForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import type { FieldDef } from '@ng-forge/dynamic-forms';

// MARK: Helpers
/**
 * Extracts the inner field from a ForgeFormFieldWrapperFieldDef.
 * The wrapper nests the actual field inside props.fields[0].
 */
function getInnerField(wrapper: ForgeFormFieldWrapperFieldDef): FieldDef<unknown> {
  const fields = wrapper.props?.fields;
  expect(fields).toBeDefined();
  expect(fields!.length).toBeGreaterThan(0);
  return fields![0];
}

// MARK: forgeListSelectionField
describe('forgeListSelectionField()', () => {
  const stubListComponentClass = of(class {} as unknown as import('@angular/core').Type<AbstractDbxSelectionListWrapperDirective<unknown>>);
  const stubReadKey = (item: { id: string }) => item.id;
  const stubState$ = of(successResult([]));

  function minimalConfig() {
    return {
      key: 'selectedItems',
      listComponentClass: stubListComponentClass,
      readKey: stubReadKey,
      state$: stubState$
    } as Parameters<typeof forgeListSelectionField>[0];
  }

  it('should return a wrapper with the correct type', () => {
    const wrapper = forgeListSelectionField(minimalConfig());
    expect(wrapper.type).toBe('dbx-forge-form-field');
  });

  it('should set the inner field type to dbx-list-selection', () => {
    const wrapper = forgeListSelectionField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.type).toBe('dbx-list-selection');
  });

  it('should set the inner field key', () => {
    const wrapper = forgeListSelectionField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.key).toBe('selectedItems');
  });

  it('should set the wrapper label when provided', () => {
    const wrapper = forgeListSelectionField({ ...minimalConfig(), label: 'Items' });
    expect(wrapper.label).toBe('Items');
  });

  it('should default wrapper label to empty string when not provided', () => {
    const wrapper = forgeListSelectionField(minimalConfig());
    expect(wrapper.label).toBe('');
  });

  it('should set required on the inner field when provided', () => {
    const wrapper = forgeListSelectionField({ ...minimalConfig(), required: true });
    const inner = getInnerField(wrapper);
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const wrapper = forgeListSelectionField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const wrapper = forgeListSelectionField({ ...minimalConfig(), readonly: true });
    const inner = getInnerField(wrapper);
    expect(inner.readonly).toBe(true);
  });

  it('should map description to wrapper props.hint', () => {
    const wrapper = forgeListSelectionField({ ...minimalConfig(), description: 'Select items from the list' });
    expect(wrapper.props?.hint).toBe('Select items from the list');
  });

  it('should not set hint on wrapper when description is not provided', () => {
    const wrapper = forgeListSelectionField(minimalConfig());
    expect(wrapper.props?.hint).toBeUndefined();
  });

  it('should propagate listComponentClass through inner field props', () => {
    const wrapper = forgeListSelectionField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.props?.listComponentClass).toBe(stubListComponentClass);
  });

  it('should propagate readKey through inner field props', () => {
    const wrapper = forgeListSelectionField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.props?.readKey).toBe(stubReadKey);
  });

  it('should propagate state$ through inner field props', () => {
    const wrapper = forgeListSelectionField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.props?.state$).toBe(stubState$);
  });

  it('should propagate loadMore through inner field props when provided', () => {
    const loadMore = () => {};
    const wrapper = forgeListSelectionField({ ...minimalConfig(), loadMore });
    const inner = getInnerField(wrapper);
    expect(inner.props?.loadMore).toBe(loadMore);
  });

  it('should not set loadMore on the inner field when not provided', () => {
    const wrapper = forgeListSelectionField(minimalConfig());
    const inner = getInnerField(wrapper);
    expect(inner.props?.loadMore).toBeUndefined();
  });
});
