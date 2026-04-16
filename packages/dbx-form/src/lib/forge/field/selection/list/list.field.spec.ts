/**
 * Exhaustive type and runtime tests for the list selection forge field.
 */
import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import { type DynamicText, type LogicConfig, type ValidatorConfig, type ValidationMessages } from '@ng-forge/dynamic-forms';
import { of } from 'rxjs';
import { forgeListSelectionField } from './list.field';
import type { DbxForgeListSelectionFieldConfig, DbxForgeListSelectionFieldDef, DbxForgeListSelectionFieldProps } from './list.field';
import { type AbstractDbxSelectionListWrapperDirective } from '@dereekb/dbx-web';
import { successResult } from '@dereekb/rxjs';
import type { Type } from '@angular/core';
import type { DbxForgeFormFieldWrapperWrappedFieldDef } from '../../wrapper/formfield/formfield.wrapper';
import { getDbxForgeFormFieldWrapperWrappedField } from '../../wrapper/formfield/formfield.wrapper.util';

type ListWrapperFieldDef = DbxForgeFormFieldWrapperWrappedFieldDef<DbxForgeListSelectionFieldDef<any, any, any>>;

/**
 * Extracts the inner field from a wrapper field.
 * Returns `any` for convenient runtime property access in tests.
 */
function getInnerField(wrapper: ListWrapperFieldDef): any {
  return getDbxForgeFormFieldWrapperWrappedField(wrapper);
}

// MARK: Shared Stubs
const stubListComponentClass = of(class {} as unknown as Type<AbstractDbxSelectionListWrapperDirective<unknown>>);
const stubReadKey = (item: { id: string }) => item.id;
const stubState$ = of(successResult([]));

// ============================================================================
// DbxForgeListSelectionFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeListSelectionFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgeListSelectionFieldDef>
    | 'key'
    | 'label'
    | 'placeholder'
    | 'value'
    | 'required'
    | 'readonly'
    | 'disabled'
    | 'hidden'
    | 'className'
    | 'meta'
    | 'logic'
    | 'props'
    | 'hint'
    | 'description'
    | 'pattern'
    | 'minLength'
    | 'maxLength'
    | 'min'
    | 'max'
    | 'email'
    | 'validators'
    | 'validationMessages'
    | 'derivation'
    | 'schemas'
    | 'col'
    | 'tabIndex'
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    // Phantom brand
    | '__fieldDef';

  type ActualKeys = keyof DbxForgeListSelectionFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<DbxForgeListSelectionFieldConfig['key']>().toEqualTypeOf<string>();
    });
  });

  describe('inherited optional keys', () => {
    it('label', () => {
      expectTypeOf<DbxForgeListSelectionFieldConfig['label']>().toEqualTypeOf<DynamicText | undefined>();
    });

    it('required', () => {
      expectTypeOf<DbxForgeListSelectionFieldConfig['required']>().toEqualTypeOf<boolean | undefined>();
    });

    it('validators', () => {
      expectTypeOf<DbxForgeListSelectionFieldConfig['validators']>().toEqualTypeOf<ValidatorConfig[] | undefined>();
    });

    it('validationMessages', () => {
      expectTypeOf<DbxForgeListSelectionFieldConfig['validationMessages']>().toEqualTypeOf<ValidationMessages | undefined>();
    });
  });
});

// ============================================================================
// DbxForgeListSelectionFieldDef - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeListSelectionFieldDef - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From FieldDef
    | 'key'
    | 'type'
    | 'label'
    | 'props'
    | 'className'
    | 'disabled'
    | 'readonly'
    | 'hidden'
    | 'tabIndex'
    | 'col'
    | 'meta'
    // Value exclusion config
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    // From FieldWithValidation
    | 'required'
    | 'email'
    | 'min'
    | 'max'
    | 'minLength'
    | 'maxLength'
    | 'pattern'
    | 'validators'
    | 'validationMessages'
    | 'logic'
    | 'derivation'
    | 'schemas'
    // From BaseValueField
    | 'value'
    | 'placeholder';

  type ActualKeys = keyof DbxForgeListSelectionFieldDef;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('type is literal dbx-list-selection', () => {
    expectTypeOf<DbxForgeListSelectionFieldDef['type']>().toEqualTypeOf<'dbx-list-selection'>();
  });

  it('props is DbxForgeListSelectionFieldProps', () => {
    expectTypeOf<DbxForgeListSelectionFieldDef['props']>().toEqualTypeOf<DbxForgeListSelectionFieldProps | undefined>();
  });
});

// ============================================================================
// DbxForgeFormFieldWrapperWrappedFieldDef<DbxForgeListSelectionFieldDef> - Structure
// ============================================================================

describe('DbxForgeFormFieldWrapperWrappedFieldDef<DbxForgeListSelectionFieldDef>', () => {
  it('fields[0] is typed as DbxForgeListSelectionFieldDef', () => {
    type WrapperFieldDef = DbxForgeFormFieldWrapperWrappedFieldDef<DbxForgeListSelectionFieldDef>;
    expectTypeOf<WrapperFieldDef['fields'][0]>().toEqualTypeOf<DbxForgeListSelectionFieldDef>();
  });
});

// ============================================================================
// Usage Tests (type-level)
// ============================================================================

describe('DbxForgeListSelectionFieldDef - Usage', () => {
  it('should accept valid list selection field configuration', () => {
    const field = {
      type: 'dbx-list-selection',
      key: 'selectedItems',
      label: 'Items'
    } as const satisfies DbxForgeListSelectionFieldDef;

    expectTypeOf(field.type).toEqualTypeOf<'dbx-list-selection'>();
  });
});

// ============================================================================
// Runtime Factory Tests - forgeListSelectionField()
// ============================================================================

describe('forgeListSelectionField()', () => {
  function minimalConfig() {
    return {
      key: 'selectedItems',
      props: {
        listComponentClass: stubListComponentClass,
        readKey: stubReadKey,
        state$: stubState$
      }
    } as Parameters<typeof forgeListSelectionField>[0];
  }

  // MARK: Wrapper structure
  it('should return a wrapper with type "wrapper"', () => {
    const wrapper = forgeListSelectionField(minimalConfig());
    expect(wrapper.type).toBe('wrapper');
  });

  it('should use key_wrapper naming for the wrapper key', () => {
    const wrapper = forgeListSelectionField(minimalConfig());
    expect(wrapper.key).toContain('_wrapper');
  });

  it('should set the inner field type to dbx-list-selection', () => {
    const inner = getInnerField(forgeListSelectionField(minimalConfig()) as ListWrapperFieldDef);
    expect(inner.type).toBe('dbx-list-selection');
  });

  it('should set the inner field key', () => {
    const inner = getInnerField(forgeListSelectionField(minimalConfig()) as ListWrapperFieldDef);
    expect(inner.key).toBe('selectedItems');
  });

  // MARK: Label
  it('should set the label on the inner field when provided', () => {
    const inner = getInnerField(forgeListSelectionField({ ...minimalConfig(), label: 'Items' }) as ListWrapperFieldDef);
    expect(inner.label).toBe('Items');
  });

  // MARK: Required/readonly
  it('should set required on the inner field when provided', () => {
    const inner = getInnerField(forgeListSelectionField({ ...minimalConfig(), required: true }) as ListWrapperFieldDef);
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const inner = getInnerField(forgeListSelectionField(minimalConfig()) as ListWrapperFieldDef);
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const inner = getInnerField(forgeListSelectionField({ ...minimalConfig(), readonly: true }) as ListWrapperFieldDef);
    expect(inner.readonly).toBe(true);
  });

  // MARK: Hint/description
  it('should map description to inner field props.hint', () => {
    const inner = getInnerField(forgeListSelectionField({ ...minimalConfig(), description: 'Select items from the list' }) as ListWrapperFieldDef);
    expect(inner.props?.hint).toBe('Select items from the list');
  });

  it('should not set hint on inner field when description is not provided', () => {
    const inner = getInnerField(forgeListSelectionField(minimalConfig()) as ListWrapperFieldDef);
    expect(inner.props?.hint).toBeUndefined();
  });

  // MARK: Props passthrough
  it('should propagate listComponentClass through inner field props', () => {
    const inner = getInnerField(forgeListSelectionField(minimalConfig()) as ListWrapperFieldDef);
    expect(inner.props?.listComponentClass).toBe(stubListComponentClass);
  });

  it('should propagate readKey through inner field props', () => {
    const inner = getInnerField(forgeListSelectionField(minimalConfig()) as ListWrapperFieldDef);
    expect(inner.props?.readKey).toBe(stubReadKey);
  });

  it('should propagate state$ through inner field props', () => {
    const inner = getInnerField(forgeListSelectionField(minimalConfig()) as ListWrapperFieldDef);
    expect(inner.props?.state$).toBe(stubState$);
  });

  it('should propagate loadMore through inner field props when provided', () => {
    const loadMore = () => {};
    const inner = getInnerField(forgeListSelectionField({ ...minimalConfig(), props: { ...minimalConfig().props!, loadMore } }) as ListWrapperFieldDef);
    expect(inner.props?.loadMore).toBe(loadMore);
  });

  it('should not set loadMore on the inner field when not provided', () => {
    const inner = getInnerField(forgeListSelectionField(minimalConfig()) as ListWrapperFieldDef);
    expect(inner.props?.loadMore).toBeUndefined();
  });

  // MARK: Logic passthrough
  it('should pass logic through to the inner field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const inner = getInnerField(forgeListSelectionField({ ...minimalConfig(), logic }) as ListWrapperFieldDef);
    expect(inner.logic).toEqual(logic);
  });

  // MARK: Validators passthrough
  it('should pass validators through to the inner field definition', () => {
    const validators: ValidatorConfig[] = [{ type: 'custom' as const, expression: 'fieldValue?.length > 0', kind: 'mustSelectItem' }];
    const inner = getInnerField(forgeListSelectionField({ ...minimalConfig(), validators }) as ListWrapperFieldDef);
    expect(inner.validators).toEqual(validators);
  });

  // MARK: ValidationMessages passthrough
  it('should pass validationMessages through to the inner field definition', () => {
    const validationMessages: ValidationMessages = { mustSelectItem: 'Please select at least one item' };
    const inner = getInnerField(forgeListSelectionField({ ...minimalConfig(), validationMessages }) as ListWrapperFieldDef);
    expect(inner.validationMessages).toEqual(validationMessages);
  });
});
