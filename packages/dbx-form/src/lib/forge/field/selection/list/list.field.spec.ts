import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { forgeListSelectionField } from './list.field';
import { type AbstractDbxSelectionListWrapperDirective } from '@dereekb/dbx-web';
import { successResult } from '@dereekb/rxjs';
import type { Type } from '@angular/core';
import type { DbxForgeFormFieldWrapperFieldDef } from '../../wrapper/formfield/formfield.field';
import type { FieldDef, LogicConfig } from '@ng-forge/dynamic-forms';

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

// MARK: forgeListSelectionField
describe('forgeListSelectionField()', () => {
  const stubListComponentClass = of(class {} as unknown as Type<AbstractDbxSelectionListWrapperDirective<unknown>>);
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

  it('should pass logic through to the wrapper field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = forgeListSelectionField({ ...minimalConfig(), logic });
    expect((field as any).logic).toEqual(logic);
  });

  describe('with wrapper (default)', () => {
    it('should return a wrapper with the correct type', () => {
      const wrapper = forgeListSelectionField(minimalConfig());
      expect(wrapper.type).toBe('dbx-forge-form-field');
    });

    it('should set the inner field type to dbx-list-selection', () => {
      const wrapper = forgeListSelectionField(minimalConfig()) as DbxForgeFormFieldWrapperFieldDef;
      const inner = getInnerField(wrapper);
      expect(inner.type).toBe('dbx-list-selection');
    });

    it('should set the inner field key', () => {
      const wrapper = forgeListSelectionField(minimalConfig()) as DbxForgeFormFieldWrapperFieldDef;
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

    it('should set empty label on the inner field', () => {
      const wrapper = forgeListSelectionField({ ...minimalConfig(), label: 'Items' }) as DbxForgeFormFieldWrapperFieldDef;
      const inner = getInnerField(wrapper);
      expect(inner.label).toBe('');
    });

    it('should set required on the inner field when provided', () => {
      const wrapper = forgeListSelectionField({ ...minimalConfig(), required: true }) as DbxForgeFormFieldWrapperFieldDef;
      const inner = getInnerField(wrapper);
      expect(inner.required).toBe(true);
    });

    it('should not set required on the inner field when not provided', () => {
      const wrapper = forgeListSelectionField(minimalConfig()) as DbxForgeFormFieldWrapperFieldDef;
      const inner = getInnerField(wrapper);
      expect(inner.required).toBeUndefined();
    });

    it('should set readonly on the inner field when provided', () => {
      const wrapper = forgeListSelectionField({ ...minimalConfig(), readonly: true }) as DbxForgeFormFieldWrapperFieldDef;
      const inner = getInnerField(wrapper);
      expect(inner.readonly).toBe(true);
    });

    it('should map description to wrapper props.hint', () => {
      const wrapper = forgeListSelectionField({ ...minimalConfig(), description: 'Select items from the list' });
      expect((wrapper as DbxForgeFormFieldWrapperFieldDef).props?.hint).toBe('Select items from the list');
    });

    it('should not set hint on wrapper when description is not provided', () => {
      const wrapper = forgeListSelectionField(minimalConfig());
      expect((wrapper as DbxForgeFormFieldWrapperFieldDef).props?.hint).toBeUndefined();
    });

    it('should propagate listComponentClass through inner field props', () => {
      const wrapper = forgeListSelectionField(minimalConfig()) as DbxForgeFormFieldWrapperFieldDef;
      const inner = getInnerField(wrapper);
      expect(inner.props?.listComponentClass).toBe(stubListComponentClass);
    });

    it('should propagate readKey through inner field props', () => {
      const wrapper = forgeListSelectionField(minimalConfig()) as DbxForgeFormFieldWrapperFieldDef;
      const inner = getInnerField(wrapper);
      expect(inner.props?.readKey).toBe(stubReadKey);
    });

    it('should propagate state$ through inner field props', () => {
      const wrapper = forgeListSelectionField(minimalConfig()) as DbxForgeFormFieldWrapperFieldDef;
      const inner = getInnerField(wrapper);
      expect(inner.props?.state$).toBe(stubState$);
    });

    it('should propagate loadMore through inner field props when provided', () => {
      const loadMore = () => {
        // noop
      };
      const wrapper = forgeListSelectionField({ ...minimalConfig(), loadMore }) as DbxForgeFormFieldWrapperFieldDef;
      const inner = getInnerField(wrapper);
      expect(inner.props?.loadMore).toBe(loadMore);
    });

    it('should not set loadMore on the inner field when not provided', () => {
      const wrapper = forgeListSelectionField(minimalConfig()) as DbxForgeFormFieldWrapperFieldDef;
      const inner = getInnerField(wrapper);
      expect(inner.props?.loadMore).toBeUndefined();
    });

    it('should wrap when wrapInFormField is true', () => {
      const wrapper = forgeListSelectionField({ ...minimalConfig(), wrapInFormField: true });
      expect(wrapper.type).toBe('dbx-forge-form-field');
    });
  });

  describe('without wrapper (wrapInFormField: false)', () => {
    it('should return the raw field with the correct type', () => {
      const field = forgeListSelectionField({ ...minimalConfig(), wrapInFormField: false });
      expect(field.type).toBe('dbx-list-selection');
    });

    it('should set the field key', () => {
      const field = forgeListSelectionField({ ...minimalConfig(), wrapInFormField: false });
      expect(field.key).toBe('selectedItems');
    });

    it('should set the label on the field when provided', () => {
      const field = forgeListSelectionField({ ...minimalConfig(), wrapInFormField: false, label: 'Items' });
      expect(field.label).toBe('Items');
    });

    it('should default label to empty string when not provided', () => {
      const field = forgeListSelectionField({ ...minimalConfig(), wrapInFormField: false });
      expect(field.label).toBe('');
    });

    it('should map description to props.hint', () => {
      const field = forgeListSelectionField({ ...minimalConfig(), wrapInFormField: false, description: 'Select items' });
      expect(field.props?.hint).toBe('Select items');
    });

    it('should set required when provided', () => {
      const field = forgeListSelectionField({ ...minimalConfig(), wrapInFormField: false, required: true });
      expect(field.required).toBe(true);
    });

    it('should set readonly when provided', () => {
      const field = forgeListSelectionField({ ...minimalConfig(), wrapInFormField: false, readonly: true });
      expect(field.readonly).toBe(true);
    });

    it('should propagate listComponentClass through props', () => {
      const field = forgeListSelectionField({ ...minimalConfig(), wrapInFormField: false });
      expect(field.props?.listComponentClass).toBe(stubListComponentClass);
    });

    it('should propagate readKey through props', () => {
      const field = forgeListSelectionField({ ...minimalConfig(), wrapInFormField: false });
      expect(field.props?.readKey).toBe(stubReadKey);
    });

    it('should propagate state$ through props', () => {
      const field = forgeListSelectionField({ ...minimalConfig(), wrapInFormField: false });
      expect(field.props?.state$).toBe(stubState$);
    });

    it('should propagate loadMore through props when provided', () => {
      const loadMore = () => {
        // noop
      };
      const field = forgeListSelectionField({ ...minimalConfig(), wrapInFormField: false, loadMore });
      expect(field.props?.loadMore).toBe(loadMore);
    });
  });
});
