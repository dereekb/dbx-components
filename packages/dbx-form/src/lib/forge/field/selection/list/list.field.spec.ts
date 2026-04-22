/**
 * Exhaustive type and runtime tests for the list selection forge field.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { expectTypeOf } from 'vitest';
import { type DynamicText, type LogicConfig, type ValidatorConfig, type ValidationMessages } from '@ng-forge/dynamic-forms';
import { firstValueFrom, NEVER, of, type Observable } from 'rxjs';
import { dbxForgeListSelectionField } from './list.field';
import type { DbxForgeListSelectionFieldConfig, DbxForgeListSelectionFieldDef, DbxForgeListSelectionFieldProps } from './list.field';
import { DbxForgeListSelectionFieldComponent } from './list.field.component';
import { type AbstractDbxSelectionListWrapperDirective, type ListSelectionState } from '@dereekb/dbx-web';
import { successResult } from '@dereekb/rxjs';
import { waitForMs, type Maybe } from '@dereekb/util';
import type { Type } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DBX_FORGE_TEST_PROVIDERS } from '../../../form/forge.component.spec';
import { DbxForgeAsyncConfigFormComponent } from '../../../form';

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
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
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
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
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

// ============================================================================
// Runtime Form Scenarios - dbxForgeListSelectionField()
// ============================================================================

describe('scenarios', () => {
  let fixture: ComponentFixture<DbxForgeAsyncConfigFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...DBX_FORGE_TEST_PROVIDERS]
    });

    fixture = TestBed.createComponent(DbxForgeAsyncConfigFormComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('disabled state', () => {
    type Item = { readonly id: string };
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    async function renderDisabledListFieldFixture() {
      const field = dbxForgeListSelectionField<Item, AbstractDbxSelectionListWrapperDirective<Item>, string>({
        key: 'selectedItems',
        props: {
          // NEVER keeps the inner dbx-injection list inert so the outer
          // forge list selection field renders without needing a real
          // list wrapper component in the test bed.
          listComponentClass: NEVER as unknown as Observable<Type<AbstractDbxSelectionListWrapperDirective<Item>>>,
          readKey: (item) => item.id,
          state$: of(successResult(items))
        }
      });

      const context = fixture.componentInstance.context;
      context.stripEmptyValues = false;
      context.requireValid = false;
      fixture.componentInstance.config.set({ fields: [field] });

      fixture.detectChanges();
      await fixture.whenStable();
      // Extra settle for the lazy-rendered list field component + its
      // FORM_OPTIONS-backed dbxForgeFieldDisabled() computed signal.
      await waitForMs(100);
      fixture.detectChanges();
      await fixture.whenStable();

      context.setDisabled(undefined, true);
      fixture.detectChanges();
      await fixture.whenStable();

      const listComponent = fixture.debugElement.query(By.directive(DbxForgeListSelectionFieldComponent))?.componentInstance as Maybe<DbxForgeListSelectionFieldComponent<Item, AbstractDbxSelectionListWrapperDirective<Item>, string>>;

      return { context, listComponent };
    }

    // Regression: the list selection view still let users toggle items and
    // pushed those selections back into the form value even when the forge
    // form was marked disabled. `isDisabled()` was wired up on the outer
    // component (driving the `dbx-forge-disabled` class), but the
    // selectionChange -> _updateForSelection -> _setFieldValue path never
    // consulted it, so simulating a selection change while disabled still
    // mutated the form value.
    it('should expose isDisabled()=true on the list field component when the form is disabled', async () => {
      const { listComponent } = await renderDisabledListFieldFixture();
      expect(listComponent).toBeDefined();
      expect(listComponent!.isDisabled()).toBe(true);
    });

    it('should not update the form value when a selection change fires while the form is disabled', async () => {
      const { context, listComponent } = await renderDisabledListFieldFixture();
      expect(listComponent).toBeDefined();

      // Capture the pre-selection-change value so we can assert it is unchanged,
      // regardless of how the form framework initializes an unset selection field.
      const before = (await firstValueFrom(context.getValue())) as { selectedItems?: unknown };

      const selection: ListSelectionState<Item> = {
        items: items.map((itemValue, i) => ({ itemValue, selected: i === 0 }))
      };

      // Mirrors what AbstractDbxSelectionListWrapperDirective.selectionChange
      // emits when the user toggles an item. _updateForSelection is private
      // at the TS layer but is the documented entry point the component
      // wires selectionChange to in its config$ init callback.
      (listComponent as unknown as { _updateForSelection: (s: ListSelectionState<Item>) => void })._updateForSelection(selection);

      fixture.detectChanges();
      await fixture.whenStable();

      const after = (await firstValueFrom(context.getValue())) as { selectedItems?: unknown };
      expect(after.selectedItems).toEqual(before.selectedItems);
      expect(after.selectedItems).not.toEqual(['a']);
    });
  });
});
