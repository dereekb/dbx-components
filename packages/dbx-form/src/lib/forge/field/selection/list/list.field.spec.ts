/**
 * Exhaustive type and runtime tests for the list selection forge field.
 */
import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import { type DynamicText, type LogicConfig, type ValidatorConfig, type ValidationMessages } from '@ng-forge/dynamic-forms';
import { of } from 'rxjs';
import { dbxForgeListSelectionField } from './list.field';
import type { DbxForgeListSelectionFieldConfig, DbxForgeListSelectionFieldDef, DbxForgeListSelectionFieldProps } from './list.field';
import { type AbstractDbxSelectionListWrapperDirective } from '@dereekb/dbx-web';
import { successResult } from '@dereekb/rxjs';
import type { Type } from '@angular/core';

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
    | 'wrappers'
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
    | 'wrappers'
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
// Runtime Factory Tests - dbxForgeListSelectionField()
// ============================================================================

describe('dbxForgeListSelectionField()', () => {
  function minimalConfig() {
    return {
      key: 'selectedItems',
      props: {
        listComponentClass: stubListComponentClass,
        readKey: stubReadKey,
        state$: stubState$
      }
    } as Parameters<typeof dbxForgeListSelectionField>[0];
  }

  // MARK: Field structure
  it('should return a field with type "dbx-list-selection"', () => {
    const field = dbxForgeListSelectionField(minimalConfig()) as any;
    expect(field.type).toBe('dbx-list-selection');
  });

  it('should set the field key', () => {
    const field = dbxForgeListSelectionField(minimalConfig()) as any;
    expect(field.key).toBe('selectedItems');
  });

  // MARK: Label
  it('should set the label on the field when provided', () => {
    const field = dbxForgeListSelectionField({ ...minimalConfig(), label: 'Items' }) as any;
    expect(field.label).toBe('Items');
  });

  // MARK: Required/readonly
  it('should set required on the field when provided', () => {
    const field = dbxForgeListSelectionField({ ...minimalConfig(), required: true }) as any;
    expect(field.required).toBe(true);
  });

  it('should not set required on the field when not provided', () => {
    const field = dbxForgeListSelectionField(minimalConfig()) as any;
    expect(field.required).toBeUndefined();
  });

  it('should set readonly on the field when provided', () => {
    const field = dbxForgeListSelectionField({ ...minimalConfig(), readonly: true }) as any;
    expect(field.readonly).toBe(true);
  });

  // MARK: Hint/description
  it('should map description to field props.hint', () => {
    const field = dbxForgeListSelectionField({ ...minimalConfig(), description: 'Select items from the list' }) as any;
    expect(field.props?.hint).toBe('Select items from the list');
  });

  it('should not set hint on field when description is not provided', () => {
    const field = dbxForgeListSelectionField(minimalConfig()) as any;
    expect(field.props?.hint).toBeUndefined();
  });

  // MARK: Props passthrough
  it('should propagate listComponentClass through field props', () => {
    const field = dbxForgeListSelectionField(minimalConfig()) as any;
    expect(field.props?.listComponentClass).toBe(stubListComponentClass);
  });

  it('should propagate readKey through field props', () => {
    const field = dbxForgeListSelectionField(minimalConfig()) as any;
    expect(field.props?.readKey).toBe(stubReadKey);
  });

  it('should propagate state$ through field props', () => {
    const field = dbxForgeListSelectionField(minimalConfig()) as any;
    expect(field.props?.state$).toBe(stubState$);
  });

  it('should propagate loadMore through field props when provided', () => {
    const loadMore = () => {};
    const field = dbxForgeListSelectionField({ ...minimalConfig(), props: { ...minimalConfig().props!, loadMore } }) as any;
    expect(field.props?.loadMore).toBe(loadMore);
  });

  it('should not set loadMore on the field when not provided', () => {
    const field = dbxForgeListSelectionField(minimalConfig()) as any;
    expect(field.props?.loadMore).toBeUndefined();
  });

  // MARK: Logic passthrough
  it('should pass logic through to the field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const field = dbxForgeListSelectionField({ ...minimalConfig(), logic }) as any;
    expect(field.logic).toEqual(logic);
  });

  // MARK: Validators passthrough
  it('should pass validators through to the field definition', () => {
    const validators: ValidatorConfig[] = [{ type: 'custom' as const, expression: 'fieldValue?.length > 0', kind: 'mustSelectItem' }];
    const field = dbxForgeListSelectionField({ ...minimalConfig(), validators }) as any;
    expect(field.validators).toEqual(validators);
  });

  // MARK: ValidationMessages passthrough
  it('should pass validationMessages through to the field definition', () => {
    const validationMessages: ValidationMessages = { mustSelectItem: 'Please select at least one item' };
    const field = dbxForgeListSelectionField({ ...minimalConfig(), validationMessages }) as any;
    expect(field.validationMessages).toEqual(validationMessages);
  });
});
